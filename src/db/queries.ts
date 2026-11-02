import { parseSite } from "./site";
import type { PostSummary, Site, SiteRow, Term } from "./types";

// 前台只读查询。参数约定：?1 = site_id，?2 = 当前时间戳（未到发布时间的文章不可见）
export const SUMMARY_COLS = `p.id, p.title, p.path, p.summary AS excerpt, p.cover_image, p.author_name,
	p.published_at, p.updated_at, t.name AS category_name, t.slug AS category_slug`;

export const VIEW_COLS = `${SUMMARY_COLS}, p.type, p.content_html, p.meta_title, p.meta_description,
	p.canonical_url, p.noindex, p.category_id`;

export const VISIBLE = `p.status = 'published' AND p.published_at <= ?2`;

// 前台读路径拿到的可能是 D1Database，也可能是读副本会话 D1DatabaseSession，两者都只用到 prepare/batch
export type Reader = Pick<D1Database, "prepare" | "batch">;

export async function getSiteByHost(db: Reader, host: string): Promise<Site | null> {
	const row = await db
		.prepare(`SELECT s.* FROM domains d JOIN sites s ON s.id = d.site_id WHERE d.hostname = ?`)
		.bind(host)
		.first<SiteRow>();
	return row ? parseSite(row) : null;
}

export async function getSiteById(db: D1Database, id: number): Promise<Site | null> {
	const row = await db.prepare(`SELECT * FROM sites WHERE id = ?`).bind(id).first<SiteRow>();
	return row ? parseSite(row) : null;
}

export interface PageLink {
	title: string;
	path: string;
}

export interface Common {
	categories: Term[];
	pages: PageLink[];
	recent: PostSummary[];
}

export function commonStatements(db: Reader, siteId: number, ts: number): D1PreparedStatement[] {
	return [
		db
			.prepare(
				`SELECT t.id, t.name, t.slug, t.description, COUNT(p.id) AS count FROM terms t
				JOIN posts p ON p.category_id = t.id AND p.type = 'post' AND ${VISIBLE}
				WHERE t.site_id = ?1 AND t.taxonomy = 'category'
				GROUP BY t.id ORDER BY count DESC, t.name LIMIT 30`,
			)
			.bind(siteId, ts),
		db
			.prepare(
				`SELECT p.title, p.path FROM posts p
				WHERE p.site_id = ?1 AND p.type = 'page' AND ${VISIBLE} ORDER BY p.id LIMIT 20`,
			)
			.bind(siteId, ts),
		db
			.prepare(
				`SELECT ${SUMMARY_COLS} FROM posts p LEFT JOIN terms t ON t.id = p.category_id
				WHERE p.site_id = ?1 AND p.type = 'post' AND ${VISIBLE}
				ORDER BY p.published_at DESC LIMIT 6`,
			)
			.bind(siteId, ts),
	];
}

export function readCommon(results: D1Result<unknown>[]): Common {
	const [categories, pages, recent] = results;
	return {
		categories: categories.results as Term[],
		pages: pages.results as PageLink[],
		recent: recent.results as PostSummary[],
	};
}
