import { getSiteById } from "../db/queries";
import { DEFAULT_SETTINGS, DEFAULT_THEME_OPTIONS, hostTag, normalizeSettings, normalizeThemeOptions, siteTag } from "../db/site";
import type { ContentFormat, PostStatus, PostType, Site, SiteRow, Term } from "../db/types";
import { getTheme, randomTheme } from "../themes";
import {
	HttpError,
	isValidTimezone,
	normalizeHost,
	normalizePath,
	now,
	parseList,
	parseTimestamp,
	slugify,
} from "../lib/util";
import { ensureSlug, metaDescription, prepareContent } from "./content";
import { buildPostPath } from "../site/resolve";

export interface Ctx {
	db: D1Database;
	// 以 SiteRenderer 身份清缓存：env.SITE_RENDERER.purge(...)
	purge(options: CachePurgeOptions): Promise<CachePurgeResult>;
}

export interface SiteInput {
	name?: string;
	tagline?: string;
	primary_domain?: string;
	domains?: unknown;
	language?: string;
	timezone?: string;
	theme?: string;
	theme_options?: Record<string, unknown>;
	settings?: Record<string, unknown>;
	status?: string;
}

const LANG = /^[a-z]{2}(-[a-z]{2,4})?$/i;

function languageOf(input: string | undefined, fallback: string): string {
	const v = (input ?? "").trim();
	return LANG.test(v) ? v.toLowerCase() : fallback;
}

async function collectDomains(primary: string, extra: unknown): Promise<string[]> {
	const hosts = new Set<string>([primary]);
	for (const raw of parseList(extra)) {
		const host = normalizeHost(raw);
		if (host) hosts.add(host);
	}
	return [...hosts];
}

export async function listSites(db: D1Database): Promise<(Site & { domains: string[]; post_count: number })[]> {
	const rows = await db
		.prepare(
			`SELECT s.*, (SELECT COUNT(*) FROM posts p WHERE p.site_id = s.id) AS post_count,
			(SELECT GROUP_CONCAT(d.hostname) FROM domains d WHERE d.site_id = s.id) AS domain_list
			FROM sites s ORDER BY s.id DESC`,
		)
		.all<SiteRow & { post_count: number; domain_list: string | null }>();
	return rows.results.map((row) => {
		const { settings, theme_options } = {
			settings: normalizeSettings(JSON.parse(row.settings || "{}")),
			theme_options: normalizeThemeOptions(JSON.parse(row.theme_options || "{}")),
		};
		return {
			...row,
			settings,
			theme_options,
			domains: (row.domain_list ?? "").split(",").filter(Boolean),
			post_count: Number(row.post_count),
		};
	});
}

export async function getSiteDomains(db: D1Database, siteId: number): Promise<string[]> {
	const rows = await db.prepare(`SELECT hostname FROM domains WHERE site_id = ? ORDER BY hostname`).bind(siteId).all<{ hostname: string }>();
	return rows.results.map((r) => r.hostname);
}

export async function createSite(ctx: Ctx, input: SiteInput): Promise<Site> {
	const name = (input.name ?? "").trim();
	if (!name) throw new HttpError(400, "name is required");
	const primary = normalizeHost(input.primary_domain ?? "");
	if (!primary) throw new HttpError(400, "primary_domain is invalid");

	const ts = now();
	const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC";
	const language = languageOf(input.language, "en");
	const rnd = randomTheme();
	const theme = input.theme && getTheme(input.theme).id === input.theme ? input.theme : rnd.theme;
	const themeOptions = normalizeThemeOptions(input.theme_options ?? {}, rnd.options);
	const settings = normalizeSettings(input.settings ?? {}, { ...DEFAULT_SETTINGS, author_name: name });
	const domains = await collectDomains(primary, input.domains);

	try {
		const row = await ctx.db
			.prepare(
				`INSERT INTO sites (name, tagline, primary_domain, language, timezone, theme, theme_options, settings, status, created_at, updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
			)
			.bind(
				name,
				(input.tagline ?? "").trim(),
				primary,
				language,
				timezone,
				theme,
				JSON.stringify(themeOptions),
				JSON.stringify(settings),
				input.status === "paused" ? "paused" : "active",
				ts,
				ts,
			)
			.first<SiteRow>();
		if (!row) throw new HttpError(500, "failed to create site");
		await bindDomains(ctx.db, row.id, domains);
		await ctx.purge({ tags: domains.map(hostTag) });
		return (await getSiteById(ctx.db, row.id)) as Site;
	} catch (err) {
		throw mapConstraint(err, "domain already bound to another site");
	}
}

export async function updateSite(ctx: Ctx, siteId: number, input: SiteInput): Promise<Site> {
	const site = await getSiteById(ctx.db, siteId);
	if (!site) throw new HttpError(404, "site not found");

	const name = input.name?.trim() || site.name;
	const primary = input.primary_domain ? normalizeHost(input.primary_domain) : site.primary_domain;
	if (!primary) throw new HttpError(400, "primary_domain is invalid");
	const theme = input.theme && getTheme(input.theme).id === input.theme ? input.theme : site.theme;
	const themeOptions = input.theme_options ? normalizeThemeOptions(input.theme_options, site.theme_options) : site.theme_options;
	const settings = input.settings ? normalizeSettings(input.settings, site.settings) : site.settings;
	const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : site.timezone;
	const language = input.language ? languageOf(input.language, site.language) : site.language;
	const status = input.status === "active" || input.status === "paused" ? input.status : site.status;

	const oldDomains = await getSiteDomains(ctx.db, siteId);
	const domains = input.domains !== undefined || input.primary_domain ? await collectDomains(primary, input.domains ?? oldDomains) : oldDomains;

	try {
		await ctx.db
			.prepare(
				`UPDATE sites SET name=?, tagline=?, primary_domain=?, language=?, timezone=?, theme=?, theme_options=?, settings=?, status=?, updated_at=? WHERE id=?`,
			)
			.bind(
				name,
				input.tagline !== undefined ? input.tagline.trim() : site.tagline,
				primary,
				language,
				timezone,
				theme,
				JSON.stringify(themeOptions),
				JSON.stringify(settings),
				status,
				now(),
				siteId,
			)
			.run();
		if (input.domains !== undefined || input.primary_domain) await replaceDomains(ctx.db, siteId, domains);
	} catch (err) {
		throw mapConstraint(err, "domain already bound to another site");
	}

	await ctx.purge({ tags: [siteTag(siteId), ...[...new Set([...oldDomains, ...domains])].map(hostTag)] });
	return (await getSiteById(ctx.db, siteId)) as Site;
}

export async function deleteSite(ctx: Ctx, siteId: number): Promise<void> {
	const domains = await getSiteDomains(ctx.db, siteId);
	const res = await ctx.db.prepare(`DELETE FROM sites WHERE id = ?`).bind(siteId).run();
	if (!res.meta.changes) throw new HttpError(404, "site not found");
	await ctx.purge({ tags: [siteTag(siteId), ...domains.map(hostTag)] });
}

async function bindDomains(db: D1Database, siteId: number, domains: string[]): Promise<void> {
	if (domains.length === 0) return;
	await db.batch(domains.map((host) => db.prepare(`INSERT INTO domains (hostname, site_id) VALUES (?, ?)`).bind(host, siteId)));
}

async function replaceDomains(db: D1Database, siteId: number, domains: string[]): Promise<void> {
	await db.prepare(`DELETE FROM domains WHERE site_id = ?`).bind(siteId).run();
	await bindDomains(db, siteId, domains);
}

export interface PostInput {
	type?: PostType;
	status?: PostStatus;
	title?: string;
	slug?: string;
	path?: string;
	content?: string;
	content_format?: ContentFormat;
	excerpt?: string;
	cover_image?: string | null;
	category?: string;
	tags?: unknown;
	author_name?: string;
	meta_title?: string;
	meta_description?: string;
	canonical_url?: string;
	noindex?: boolean;
	published_at?: unknown;
}

export async function upsertTerm(db: D1Database, siteId: number, taxonomy: "category" | "tag", name: string): Promise<Term> {
	const clean = name.trim();
	if (!clean) throw new HttpError(400, "term name is empty");
	const slug = slugify(clean) || `t-${now()}`;
	const existing = await db
		.prepare(`SELECT id, name, slug, description FROM terms WHERE site_id = ? AND taxonomy = ? AND (slug = ? OR name = ?)`)
		.bind(siteId, taxonomy, slug, clean)
		.first<Term>();
	if (existing) return existing;
	const row = await db
		.prepare(`INSERT INTO terms (site_id, taxonomy, name, slug, description) VALUES (?,?,?,?,'') RETURNING id, name, slug, description`)
		.bind(siteId, taxonomy, clean, slug)
		.first<Term>();
	return row as Term;
}

async function resolveTags(db: D1Database, siteId: number, tags: unknown): Promise<number[]> {
	const names = parseList(tags).slice(0, 15);
	const ids: number[] = [];
	for (const name of names) ids.push((await upsertTerm(db, siteId, "tag", name)).id);
	return ids;
}

function contentFormat(v: unknown): ContentFormat {
	return v === "html" ? "html" : "markdown";
}

export async function createPost(ctx: Ctx, siteId: number, input: PostInput): Promise<{ id: number; path: string }> {
	const site = await getSiteById(ctx.db, siteId);
	if (!site) throw new HttpError(404, "site not found");

	const title = (input.title ?? "").trim();
	if (!title) throw new HttpError(400, "title is required");
	const type: PostType = input.type === "page" ? "page" : "post";
	const status: PostStatus = input.status === "draft" ? "draft" : "published";
	const format = contentFormat(input.content_format);
	const prepared = prepareContent(input.content ?? "", format, input.excerpt ?? "");
	const ts = now();
	const publishedAt = status === "published" ? parseTimestamp(input.published_at) ?? ts : parseTimestamp(input.published_at);

	const categoryId = input.category?.trim() ? (await upsertTerm(ctx.db, siteId, "category", input.category)).id : null;
	const categorySlug = categoryId
		? (await ctx.db.prepare(`SELECT slug FROM terms WHERE id = ?`).bind(categoryId).first<{ slug: string }>())?.slug ?? null
		: null;

	const slug = ensureSlug(input.slug ?? "", title, 0);
	const path = resolvePath(site, type, slug, categorySlug, publishedAt ?? ts, input.path);

	try {
		const row = await ctx.db
			.prepare(
				`INSERT INTO posts (site_id, type, status, title, slug, path, path_custom, excerpt, summary, content, content_format, content_html,
				cover_image, category_id, author_name, meta_title, meta_description, canonical_url, noindex, published_at, created_at, updated_at)
				VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?21) RETURNING id`,
			)
			.bind(
				siteId,
				type,
				status,
				title,
				slug,
				path,
				input.path ? 1 : 0,
				prepared.excerpt,
				prepared.summary,
				input.content ?? "",
				format,
				prepared.content_html,
				input.cover_image?.trim() || null,
				categoryId,
				input.author_name?.trim() || null,
				input.meta_title?.trim() || null,
				metaDescription(input.meta_description ?? "", prepared.summary),
				input.canonical_url?.trim() || null,
				input.noindex ? 1 : 0,
				publishedAt,
				ts,
			)
			.first<{ id: number }>();
		if (!row) throw new HttpError(500, "failed to create post");
		const tagIds = await resolveTags(ctx.db, siteId, input.tags);
		await attachTags(ctx.db, row.id, tagIds);
		await ctx.purge({ tags: [siteTag(siteId)] });
		return { id: row.id, path };
	} catch (err) {
		throw mapConstraint(err, `path already exists: ${path}`);
	}
}

export async function updatePost(ctx: Ctx, siteId: number, postId: number, input: PostInput): Promise<{ id: number; path: string }> {
	const site = await getSiteById(ctx.db, siteId);
	if (!site) throw new HttpError(404, "site not found");
	const existing = await ctx.db
		.prepare(`SELECT * FROM posts WHERE id = ? AND site_id = ?`)
		.bind(postId, siteId)
		.first<import("../db/types").PostRow>();
	if (!existing) throw new HttpError(404, "post not found");

	const title = input.title?.trim() || existing.title;
	const type: PostType = input.type ?? (existing.type as PostType);
	const status: PostStatus = input.status ?? (existing.status as PostStatus);
	const format = input.content_format ? contentFormat(input.content_format) : (existing.content_format as ContentFormat);
	const rawContent = input.content !== undefined ? input.content : existing.content;
	const prepared = prepareContent(rawContent, format, input.excerpt ?? (input.content !== undefined ? "" : existing.summary));

	let categoryId = existing.category_id;
	let categorySlug: string | null = null;
	if (input.category !== undefined) categoryId = input.category.trim() ? (await upsertTerm(ctx.db, siteId, "category", input.category)).id : null;
	if (categoryId) categorySlug = (await ctx.db.prepare(`SELECT slug FROM terms WHERE id = ?`).bind(categoryId).first<{ slug: string }>())?.slug ?? null;

	const slug = input.slug !== undefined ? ensureSlug(input.slug, title, postId) : existing.slug;
	const publishedAt =
		input.published_at !== undefined
			? parseTimestamp(input.published_at) ?? (status === "published" ? now() : null)
			: existing.published_at ?? (status === "published" ? now() : null);

	// path 固定或用户显式指定时不变；否则按当前 permalink 规则重算
	let path = existing.path;
	if (input.path) path = normalizePath(input.path);
	else if (!existing.path_custom && (input.slug !== undefined || input.category !== undefined || input.published_at !== undefined)) {
		path = resolvePath(site, type, slug, categorySlug, publishedAt ?? existing.created_at, undefined);
	}

	try {
		await ctx.db
			.prepare(
				`UPDATE posts SET type=?, status=?, title=?, slug=?, path=?, path_custom=?, excerpt=?, summary=?, content=?, content_format=?,
				content_html=?, cover_image=?, category_id=?, author_name=?, meta_title=?, meta_description=?, canonical_url=?, noindex=?, published_at=?, updated_at=?
				WHERE id=?`,
			)
			.bind(
				type,
				status,
				title,
				slug,
				path,
				input.path ? 1 : existing.path_custom,
				prepared.excerpt,
				prepared.summary,
				rawContent,
				format,
				prepared.content_html,
				input.cover_image !== undefined ? input.cover_image?.trim() || null : existing.cover_image,
				categoryId,
				input.author_name !== undefined ? input.author_name.trim() || null : existing.author_name,
				input.meta_title !== undefined ? input.meta_title.trim() || null : existing.meta_title,
				input.meta_description !== undefined ? metaDescription(input.meta_description, prepared.summary) : existing.meta_description,
				input.canonical_url !== undefined ? input.canonical_url.trim() || null : existing.canonical_url,
				input.noindex !== undefined ? (input.noindex ? 1 : 0) : existing.noindex,
				publishedAt,
				now(),
				postId,
			)
			.run();
		if (input.tags !== undefined) {
			await ctx.db.prepare(`DELETE FROM post_tags WHERE post_id = ?`).bind(postId).run();
			await attachTags(ctx.db, postId, await resolveTags(ctx.db, siteId, input.tags));
		}
	} catch (err) {
		throw mapConstraint(err, `path already exists: ${path}`);
	}
	await ctx.purge({ tags: [siteTag(siteId)] });
	return { id: postId, path };
}

export async function deletePost(ctx: Ctx, siteId: number, postId: number): Promise<void> {
	const res = await ctx.db.prepare(`DELETE FROM posts WHERE id = ? AND site_id = ?`).bind(postId, siteId).run();
	if (!res.meta.changes) throw new HttpError(404, "post not found");
	await ctx.purge({ tags: [siteTag(siteId)] });
}

async function attachTags(db: D1Database, postId: number, termIds: number[]): Promise<void> {
	if (termIds.length === 0) return;
	await db.batch(termIds.map((id) => db.prepare(`INSERT OR IGNORE INTO post_tags (post_id, term_id) VALUES (?, ?)`).bind(postId, id)));
}

function resolvePath(
	site: Site,
	type: PostType,
	slug: string,
	categorySlug: string | null,
	publishedAt: number,
	custom: string | undefined,
): string {
	if (custom) return normalizePath(custom);
	if (type === "page") return `/${slug}/`;
	return buildPostPath({ permalink: site.settings.permalink, slug, categorySlug, publishedAt, timezone: site.timezone });
}

export async function setRedirect(ctx: Ctx, siteId: number, from: string, to: string, status: number): Promise<void> {
	const fromPath = normalizePath(from);
	const code = status === 302 || status === 307 || status === 308 ? status : 301;
	await ctx.db
		.prepare(
			`INSERT INTO redirects (site_id, from_path, to_url, status_code) VALUES (?,?,?,?)
			ON CONFLICT(site_id, from_path) DO UPDATE SET to_url = excluded.to_url, status_code = excluded.status_code`,
		)
		.bind(siteId, fromPath, to.trim(), code)
		.run();
	await ctx.purge({ tags: [siteTag(siteId)] });
}

export async function deleteRedirect(ctx: Ctx, siteId: number, from: string): Promise<void> {
	await ctx.db.prepare(`DELETE FROM redirects WHERE site_id = ? AND from_path = ?`).bind(siteId, normalizePath(from)).run();
	await ctx.purge({ tags: [siteTag(siteId)] });
}

function mapConstraint(err: unknown, message: string): HttpError {
	if (err instanceof HttpError) return err;
	const text = err instanceof Error ? err.message : String(err);
	if (/UNIQUE constraint failed/i.test(text)) return new HttpError(409, message);
	return new HttpError(500, text);
}
