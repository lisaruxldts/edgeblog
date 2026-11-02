import type { Site } from "../db/types";
import { safeDecode } from "../lib/util";

export type Route =
	| { kind: "home"; page: number }
	| { kind: "entry"; path: string }
	| { kind: "category"; slug: string; page: number }
	| { kind: "tag"; slug: string; page: number }
	| { kind: "feed" }
	| { kind: "sitemap" }
	| { kind: "robots" }
	| { kind: "media"; path: string }
	| { kind: "not-found" };

function pageFromParts(parts: string[]): { page: number; rest: string[] } | null {
	if (parts.length >= 2 && parts[parts.length - 2] === "page") {
		const page = Number(parts[parts.length - 1]);
		if (!Number.isInteger(page) || page < 1) return null;
		return { page, rest: parts.slice(0, -2) };
	}
	return { page: 1, rest: parts };
}

export function resolveRoute(site: Site, pathname: string): Route {
	const clean = pathname.replace(/\/+$/, "") || "/";

	if (clean === "/feed" || clean === "/feed.xml" || clean === "/rss" || clean === "/rss.xml") return { kind: "feed" };
	if (clean === "/sitemap.xml" || clean === "/sitemap") return { kind: "sitemap" };
	if (clean === "/robots.txt") return { kind: "robots" };

	const segments = clean.split("/").filter(Boolean);
	if (segments[0] === "uploads") return { kind: "media", path: `/${segments.join("/")}` };

	if (clean === "/") return { kind: "home", page: 1 };

	const paged = pageFromParts(segments);
	if (paged) {
		const { page, rest } = paged;
		if (rest.length === 0 && page > 1) return { kind: "home", page };
		if (rest.length === 2 && rest[0] === site.settings.category_base) {
			return { kind: "category", slug: safeDecode(rest[1]), page };
		}
		if (rest.length === 2 && rest[0] === site.settings.tag_base) {
			return { kind: "tag", slug: safeDecode(rest[1]), page };
		}
	}

	// 其余一律按文章/页面的完整路径查库（permalink 可自定义，path 存全量）。
	// 用 safeDecode：/foo%zz/ 这类畸形编码按原样查库、正常 404，不再让 decodeURIComponent 抛异常变成 500
	return { kind: "entry", path: `/${segments.map(safeDecode).join("/")}/` };
}

// 根据 permalink 模板生成文章路径；页面固定 /slug/
export function buildPostPath(args: {
	permalink: string;
	slug: string;
	categorySlug: string | null;
	publishedAt: number;
	timezone: string;
}): string {
	const d = new Date(args.publishedAt * 1000);
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: args.timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(d);
	const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
	const out = args.permalink
		.replace(/%year%/g, get("year"))
		.replace(/%month%/g, get("month"))
		.replace(/%day%/g, get("day"))
		.replace(/%category%/g, args.categorySlug ?? "uncategorized")
		.replace(/%slug%/g, args.slug);
	const normalized = `/${out.split("/").filter(Boolean).join("/")}/`;
	return normalized === "//" ? `/${args.slug}/` : normalized;
}
