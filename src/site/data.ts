import { SUMMARY_COLS, VIEW_COLS, VISIBLE, commonStatements, readCommon } from "../db/queries";
import type { Common, Reader } from "../db/queries";
import type { PostSummary, PostView, RedirectRow, Site, Term } from "../db/types";
import { canonicalFor, encodePath, now } from "../lib/util";
import type { SitemapEntry } from "./feeds";

// 每种页面的数据在一个 batch 里查完（一次往返）：重定向规则、正文或列表、侧栏。
// 原来要依赖上一步结果的条件（分类 id、文章 id）改成按 slug / path 的子查询，不再分几轮串行查。
// 404 也照样带上侧栏：放在同一个 batch 里不多占往返，单独省掉反而让正常页面多一轮

interface BasePage {
	redirect: RedirectRow | null;
	common: Common;
}

export interface ListPage extends BasePage {
	posts: PostSummary[];
	total: number;
}

export interface ArchivePage extends ListPage {
	term: Term | null;
}

export interface EntryPage extends BasePage {
	post: PostView | null;
	tags: Term[];
	related: PostSummary[];
}

const COUNT_LIMIT = 1000;
const RELATED_LIMIT = 5;

type Rows = D1Result<Record<string, unknown>>;

const countOf = (r: Rows): number => Number((r.results[0] as { c: number }).c);

// redirectPath 为 null 时不查重定向（首页）；返回页面自己那几条语句的结果，顺序与传入一致
async function load(
	db: Reader,
	site: Site,
	ts: number,
	redirectPath: string | null,
	statements: D1PreparedStatement[],
): Promise<{ redirect: RedirectRow | null; own: Rows[]; common: Common }> {
	const head =
		redirectPath === null
			? []
			: [db.prepare(`SELECT from_path, to_url, status_code FROM redirects WHERE site_id = ? AND from_path = ?`).bind(site.id, redirectPath)];
	const results = await db.batch<Record<string, unknown>>([...head, ...statements, ...commonStatements(db, site.id, ts)]);
	return {
		redirect: head.length ? ((results[0].results[0] as unknown as RedirectRow | undefined) ?? null) : null,
		own: results.slice(head.length, head.length + statements.length),
		common: readCommon(results.slice(head.length + statements.length) as D1Result<unknown>[]),
	};
}

export async function homePage(db: Reader, site: Site, page: number, perPage: number, redirectPath: string | null): Promise<ListPage> {
	const ts = now();
	const { redirect, own, common } = await load(db, site, ts, redirectPath, [
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?3 OFFSET ?4`,
			)
			.bind(site.id, ts, perPage, (page - 1) * perPage),
		db
			.prepare(`SELECT COUNT(*) AS c FROM (SELECT 1 FROM posts p WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`)
			.bind(site.id, ts),
	]);
	const [rows, count] = own;
	return { redirect, common, posts: rows.results as unknown as PostSummary[], total: countOf(count) };
}

// 分类/标签 id 按 slug（?3）现取，和列表放在同一个 batch 里，省掉先查 term 的那一轮
const termIdBySlug = (taxonomy: "category" | "tag"): string =>
	`(SELECT id FROM terms WHERE site_id = ?1 AND taxonomy = '${taxonomy}' AND slug = ?3)`;

function archiveStatements(db: Reader, site: Site, ts: number, taxonomy: "category" | "tag", slug: string, offset: number, limit: number) {
	if (taxonomy === "category") {
		return [
			db
				.prepare(
					`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
					WHERE p.site_id = ?1 AND p.type = 'post' AND p.category_id = ${termIdBySlug("category")} AND ${VISIBLE}
					ORDER BY p.published_at DESC LIMIT ?4 OFFSET ?5`,
				)
				.bind(site.id, ts, slug, limit, offset),
			db
				.prepare(
					`SELECT COUNT(*) AS c FROM (SELECT 1 FROM posts p WHERE p.site_id = ?1 AND p.category_id = ${termIdBySlug("category")} AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`,
				)
				.bind(site.id, ts, slug),
		];
	}
	return [
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM post_tags pt JOIN posts p ON p.id = pt.post_id
				LEFT JOIN terms t ON t.id = p.category_id
				WHERE pt.term_id = ${termIdBySlug("tag")} AND p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?4 OFFSET ?5`,
			)
			.bind(site.id, ts, slug, limit, offset),
		db
			.prepare(
				`SELECT COUNT(*) AS c FROM (SELECT 1 FROM post_tags pt JOIN posts p ON p.id = pt.post_id
				WHERE pt.term_id = ${termIdBySlug("tag")} AND p.site_id = ?1 AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`,
			)
			.bind(site.id, ts, slug),
	];
}

export async function archivePage(
	db: Reader,
	site: Site,
	taxonomy: "category" | "tag",
	slug: string,
	page: number,
	perPage: number,
	redirectPath: string | null,
): Promise<ArchivePage> {
	const ts = now();
	const { redirect, own, common } = await load(db, site, ts, redirectPath, [
		db.prepare(`SELECT id, name, slug, description FROM terms WHERE site_id = ? AND taxonomy = ? AND slug = ?`).bind(site.id, taxonomy, slug),
		...archiveStatements(db, site, ts, taxonomy, slug, (page - 1) * perPage, perPage),
	]);
	const [term, rows, count] = own;
	return {
		redirect,
		common,
		term: (term.results[0] as unknown as Term | undefined) ?? null,
		posts: rows.results as unknown as PostSummary[],
		total: countOf(count),
	};
}

// 标签和相关文章按 path（?3）用子查询现取文章 id / 分类，和正文一起查。
// 相关文章先取同分类，没有（或文章没分类）再退回最新文章，与原来两步查询的结果一致
export async function entryPage(db: Reader, site: Site, path: string, redirectPath: string | null): Promise<EntryPage> {
	const ts = now();
	const { redirect, own, common } = await load(db, site, ts, redirectPath, [
		db
			.prepare(
				`SELECT ${VIEW_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.path = ?3 AND ${VISIBLE}`,
			)
			.bind(site.id, ts, path),
		db
			.prepare(
				`SELECT t.id, t.name, t.slug, t.description FROM post_tags pt JOIN terms t ON t.id = pt.term_id
				WHERE pt.post_id = (SELECT id FROM posts WHERE site_id = ? AND path = ?) ORDER BY t.name`,
			)
			.bind(site.id, path),
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND p.category_id = (SELECT category_id FROM posts WHERE site_id = ?1 AND path = ?3)
				AND p.path != ?3 AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?4`,
			)
			.bind(site.id, ts, path, RELATED_LIMIT),
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND p.path != ?3 AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?4`,
			)
			.bind(site.id, ts, path, RELATED_LIMIT),
	]);
	const [entry, tags, sameCategory, latest] = own;
	return {
		redirect,
		common,
		post: (entry.results[0] as unknown as PostView | undefined) ?? null,
		tags: tags.results as unknown as Term[],
		related: (sameCategory.results.length > 0 ? sameCategory : latest).results as unknown as PostSummary[],
	};
}

// 其余路由（目前只有 not-found）：只查重定向和渲染 404 要用的侧栏
export async function basePage(db: Reader, site: Site, redirectPath: string | null): Promise<BasePage> {
	const { redirect, common } = await load(db, site, now(), redirectPath, []);
	return { redirect, common };
}

// lastmod 必须是真实的内容变化时间：Google 只在它一贯准确时才采信，否则连带忽略整个 sitemap 的 lastmod。
// 文章取更新和发布时间里较晚的（定时文章到点才出现，那一刻才算变化）；首页取全站最近一次变化
export async function sitemapEntries(db: Reader, site: Site): Promise<SitemapEntry[]> {
	const ts = now();
	const [posts, cats] = await db.batch<Record<string, unknown>>([
		db
			.prepare(
				`SELECT p.path, p.type, p.canonical_url, MAX(p.updated_at, p.published_at) AS lastmod FROM posts p
				WHERE p.site_id = ?1 AND ${VISIBLE} AND p.noindex = 0 ORDER BY p.published_at DESC LIMIT 5000`,
			)
			.bind(site.id, ts),
		db
			.prepare(
				`SELECT t.slug, MAX(MAX(p.updated_at, p.published_at)) AS lastmod FROM terms t
				JOIN posts p ON p.category_id = t.id AND ${VISIBLE}
				WHERE t.site_id = ?1 AND t.taxonomy = 'category' GROUP BY t.id LIMIT 500`,
			)
			.bind(site.id, ts),
	]);
	const rows = posts.results as { path: string; type: string; canonical_url: string | null; lastmod: number }[];
	const origin = `https://${site.primary_domain}`;

	const entries: SitemapEntry[] = [
		{ path: "/", lastmod: rows.reduce((max, r) => Math.max(max, Number(r.lastmod)), site.updated_at), changefreq: "daily", priority: "1.0" },
	];
	for (const row of rows) {
		// sitemap 只列规范地址：canonical 指向别处（转载）的文章不列
		if (canonicalFor(origin, row.path, row.canonical_url) !== origin + encodePath(row.path)) continue;
		entries.push({
			path: row.path,
			lastmod: Number(row.lastmod),
			changefreq: row.type === "page" ? "monthly" : "weekly",
			priority: row.type === "page" ? "0.5" : "0.8",
		});
	}
	for (const row of cats.results as { slug: string; lastmod: number }[]) {
		entries.push({
			path: `/${site.settings.category_base}/${row.slug}/`,
			lastmod: Number(row.lastmod),
			changefreq: "weekly",
			priority: "0.6",
		});
	}
	return entries;
}

export async function feedPosts(db: Reader, site: Site, limit: number): Promise<PostSummary[]> {
	const rows = await db
		.prepare(
			`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
			WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
			ORDER BY p.published_at DESC LIMIT ?3`,
		)
		.bind(site.id, now(), limit)
		.all<Record<string, unknown>>();
	return rows.results as unknown as PostSummary[];
}

export function totalPages(total: number, perPage: number): number {
	return Math.max(1, Math.ceil(total / perPage));
}
