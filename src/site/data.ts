import { SUMMARY_COLS, VIEW_COLS, VISIBLE, commonStatements, readCommon } from "../db/queries";
import type { Common } from "../db/queries";
import type { PostSummary, PostView, Site, Term } from "../db/types";
import { now } from "../lib/util";
import type { SitemapEntry } from "./feeds";

export interface Listing {
	posts: PostSummary[];
	total: number;
}

const COUNT_LIMIT = 1000;

export async function loadCommon(db: D1Database, site: Site): Promise<Common> {
	const results = await db.batch(commonStatements(db, site.id, now()));
	return readCommon(results as D1Result<unknown>[]);
}

export async function homeListing(db: D1Database, site: Site, offset: number, limit: number): Promise<Listing> {
	const ts = now();
	const [rows, count] = await db.batch<Record<string, unknown>>([
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?3 OFFSET ?4`,
			)
			.bind(site.id, ts, limit, offset),
		db
			.prepare(`SELECT COUNT(*) AS c FROM (SELECT 1 FROM posts p WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`)
			.bind(site.id, ts),
	]);
	return { posts: rows.results as unknown as PostSummary[], total: Number((count.results[0] as { c: number }).c) };
}

export async function getTermBySlug(db: D1Database, siteId: number, taxonomy: string, slug: string): Promise<Term | null> {
	return db
		.prepare(`SELECT id, name, slug, description FROM terms WHERE site_id = ? AND taxonomy = ? AND slug = ?`)
		.bind(siteId, taxonomy, slug)
		.first<Term>();
}

export async function categoryListing(db: D1Database, site: Site, termId: number, offset: number, limit: number): Promise<Listing> {
	const ts = now();
	const [rows, count] = await db.batch<Record<string, unknown>>([
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND p.category_id = ?3 AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?4 OFFSET ?5`,
			)
			.bind(site.id, ts, termId, limit, offset),
		db
			.prepare(
				`SELECT COUNT(*) AS c FROM (SELECT 1 FROM posts p WHERE p.site_id = ?1 AND p.category_id = ?3 AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`,
			)
			.bind(site.id, ts, termId),
	]);
	return { posts: rows.results as unknown as PostSummary[], total: Number((count.results[0] as { c: number }).c) };
}

export async function tagListing(db: D1Database, site: Site, termId: number, offset: number, limit: number): Promise<Listing> {
	const ts = now();
	const [rows, count] = await db.batch<Record<string, unknown>>([
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM post_tags pt JOIN posts p ON p.id = pt.post_id
				LEFT JOIN terms t ON t.id = p.category_id
				WHERE pt.term_id = ?3 AND p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?4 OFFSET ?5`,
			)
			.bind(site.id, ts, termId, limit, offset),
		db
			.prepare(
				`SELECT COUNT(*) AS c FROM (SELECT 1 FROM post_tags pt JOIN posts p ON p.id = pt.post_id
				WHERE pt.term_id = ?3 AND p.site_id = ?1 AND ${VISIBLE} LIMIT ${COUNT_LIMIT})`,
			)
			.bind(site.id, ts, termId),
	]);
	return { posts: rows.results as unknown as PostSummary[], total: Number((count.results[0] as { c: number }).c) };
}

export async function getEntryByPath(db: D1Database, site: Site, path: string): Promise<PostView | null> {
	return db
		.prepare(
			`SELECT ${VIEW_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
			WHERE p.site_id = ?1 AND p.path = ?3 AND ${VISIBLE}`,
		)
		.bind(site.id, now(), path)
		.first<PostView>();
}

export async function getPostTags(db: D1Database, postId: number): Promise<Term[]> {
	const rows = await db
		.prepare(`SELECT t.id, t.name, t.slug, t.description FROM post_tags pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = ? ORDER BY t.name`)
		.bind(postId)
		.all<Term>();
	return rows.results;
}

export async function getRelated(db: D1Database, site: Site, post: PostView, limit: number): Promise<PostSummary[]> {
	const ts = now();
	if (post.category_id !== null) {
		const rows = await db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND p.category_id = ?3 AND p.id != ?4 AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT ?5`,
			)
			.bind(site.id, ts, post.category_id, post.id, limit)
			.all<Record<string, unknown>>();
		if (rows.results.length > 0) return rows.results as unknown as PostSummary[];
	}
	const rows = await db
		.prepare(
			`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
			WHERE p.site_id = ?1 AND p.type = 'post' AND p.id != ?3 AND ${VISIBLE}
			ORDER BY p.published_at DESC LIMIT ?4`,
		)
		.bind(site.id, ts, post.id, limit)
		.all<Record<string, unknown>>();
	return rows.results as unknown as PostSummary[];
}

export async function sitemapEntries(db: D1Database, site: Site): Promise<SitemapEntry[]> {
	const ts = now();
	const [posts, cats] = await db.batch<Record<string, unknown>>([
		db
			.prepare(
				`SELECT p.path, p.updated_at, p.type FROM posts p
				WHERE p.site_id = ?1 AND ${VISIBLE} AND p.noindex = 0 ORDER BY p.published_at DESC LIMIT 5000`,
			)
			.bind(site.id, ts),
		db
			.prepare(
				`SELECT t.slug, MAX(p.updated_at) AS updated_at FROM terms t
				JOIN posts p ON p.category_id = t.id AND ${VISIBLE}
				WHERE t.site_id = ?1 AND t.taxonomy = 'category' GROUP BY t.id LIMIT 500`,
			)
			.bind(site.id, ts),
	]);

	const entries: SitemapEntry[] = [{ path: "/", lastmod: ts, changefreq: "daily", priority: "1.0" }];
	for (const row of posts.results as { path: string; updated_at: number; type: string }[]) {
		entries.push({
			path: row.path,
			lastmod: Number(row.updated_at),
			changefreq: row.type === "page" ? "monthly" : "weekly",
			priority: row.type === "page" ? "0.5" : "0.8",
		});
	}
	for (const row of cats.results as { slug: string; updated_at: number }[]) {
		entries.push({
			path: `/${site.settings.category_base}/${row.slug}/`,
			lastmod: Number(row.updated_at),
			changefreq: "weekly",
			priority: "0.6",
		});
	}
	return entries;
}

export async function feedPosts(db: D1Database, site: Site, limit: number): Promise<PostSummary[]> {
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
