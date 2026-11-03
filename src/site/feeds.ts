import type { PostSummary, Site } from "../db/types";
import { escapeXml, isoDate, toAbsolute } from "../lib/util";

export function renderFeed(site: Site, origin: string, posts: PostSummary[]): string {
	const self = `${origin}/feed.xml`;
	const updated = posts[0] ? isoDate(posts[0].updated_at) : isoDate(Math.floor(Date.now() / 1000));
	const entries = posts
		.map((p) => {
			const url = origin + encodeURI(p.path);
			return `  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${escapeXml(url)}"/>
    <id>${escapeXml(url)}</id>
    <updated>${isoDate(p.updated_at)}</updated>
    <published>${isoDate(p.published_at)}</published>
    <summary>${escapeXml(p.excerpt)}</summary>${
			p.author_name ? `\n    <author><name>${escapeXml(p.author_name)}</name></author>` : ""
		}
  </entry>`;
		})
		.join("\n");
	return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(site.language)}">
  <title>${escapeXml(site.name)}</title>
  <subtitle>${escapeXml(site.tagline)}</subtitle>
  <link href="${escapeXml(`${origin}/`)}"/>
  <link rel="self" href="${escapeXml(self)}"/>
  <id>${escapeXml(`${origin}/`)}</id>
  <updated>${updated}</updated>
${entries}
</feed>`;
}

export interface SitemapEntry {
	path: string;
	lastmod: number;
	changefreq?: string;
	priority?: string;
}

export function renderSitemap(origin: string, entries: SitemapEntry[]): string {
	const urls = entries
		.map((e) => {
			const loc = toAbsolute(origin, e.path) ?? origin;
			return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${isoDate(e.lastmod)}</lastmod>${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ""}${
			e.priority ? `\n    <priority>${e.priority}</priority>` : ""
		}
  </url>`;
		})
		.join("\n");
	return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function renderRobots(site: Site, origin: string): string {
	if (site.settings.robots_txt.trim()) {
		return site.settings.robots_txt.includes("Sitemap:") ? site.settings.robots_txt : `${site.settings.robots_txt}\nSitemap: ${origin}/sitemap.xml\n`;
	}
	// 标签页不在这里屏蔽：它们自带 noindex（noindex_tags），被 robots.txt 挡住的页面 Google 读不到 noindex，
	// 反而会以「已编入索引，但被 robots.txt 屏蔽」的形式出现，文章指向标签页的链接也成了死胡同
	const disallow = [`/admin`, `/api/`];
	return `User-agent: *
${disallow.map((d) => `Disallow: ${d}`).join("\n")}

Sitemap: ${origin}/sitemap.xml
`;
}
