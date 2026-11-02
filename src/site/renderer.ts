import { WorkerEntrypoint } from "cloudflare:workers";
import { getSiteByHost } from "../db/queries";
import { ensureSchema } from "../db/schema";
import { hostTag, mediaTag, siteTag } from "../db/site";
import type { RedirectRow, Site } from "../db/types";
import { isSeoBot } from "../lib/bots";
import { flag } from "../lib/util";
import { renderFeed, renderRobots, renderSitemap } from "./feeds";
import * as data from "./data";
import {
	type RenderInput,
	archiveData,
	listData,
	renderArchive,
	renderHome,
	renderNotFound,
	renderPage,
	renderPost,
} from "../render/pages";
import { resolveRoute } from "./resolve";

const HTML = "text/html; charset=utf-8";

// 命中缓存时整段响应直接从边缘返回，不会进入该入口
function html(body: string, status: number, site: Site, cacheSeconds: number): Response {
	const headers: Record<string, string> = {
		"content-type": HTML,
		"content-language": site.language,
		"cache-tag": [siteTag(site.id), hostTag(site.primary_domain)].join(","),
	};
	headers["cache-control"] =
		status === 200 ? `public, max-age=${cacheSeconds}, stale-while-revalidate=120, stale-if-error=86400` : "public, max-age=30";
	return new Response(body, { status, headers });
}

function text(body: string, contentType: string, site: Site, cacheSeconds: number): Response {
	return new Response(body, {
		headers: {
			"content-type": contentType,
			"cache-control": `public, max-age=${cacheSeconds}, stale-while-revalidate=300`,
			"cache-tag": siteTag(site.id),
		},
	});
}

export class SiteRenderer extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const host = url.hostname;
		await ensureSchema(this.env.DB); // isolate 内布尔守卫，预热后为空操作
		const site = await getSiteByHost(this.env.DB, host);
		if (!site || site.status !== "active") {
			return new Response("Site not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
		}

		if (flag(this.env.BLOCK_SEO_BOTS) && isSeoBot(request.headers.get("user-agent"))) {
			return new Response("Forbidden", { status: 403, headers: { "cache-control": "public, max-age=3600" } });
		}

		const origin = `${url.protocol}//${url.host}`;
		const route = resolveRoute(site, url.pathname);

		// 这些路由不渲染主题，跳过侧栏数据查询
		switch (route.kind) {
			case "robots":
				return text(renderRobots(site, origin), "text/plain; charset=utf-8", site, 3600);
			case "feed": {
				const posts = await data.feedPosts(this.env.DB, site, 20);
				return text(renderFeed(site, origin, posts), "application/atom+xml; charset=utf-8", site, 900);
			}
			case "sitemap":
				return text(renderSitemap(origin, await data.sitemapEntries(this.env.DB, site)), "application/xml; charset=utf-8", site, 1800);
			case "media":
				return this.serveMedia(site, route.path);
		}

		const input: RenderInput = { site, origin, common: await data.loadCommon(this.env.DB, site) };
		const perPage = site.settings.posts_per_page;

		switch (route.kind) {
			case "home": {
				const { posts, total } = await data.homeListing(this.env.DB, site, (route.page - 1) * perPage, perPage);
				const pages = data.totalPages(total, perPage);
				if (route.page > pages && route.page > 1) return this.notFound(input, site);
				const body = renderHome(input, listData(posts, route.page, pages, "/"));
				return html(body, 200, site, 300);
			}
			case "category":
			case "tag": {
				const taxonomy = route.kind;
				const term = await data.getTermBySlug(this.env.DB, site.id, taxonomy, route.slug);
				if (!term) return this.notFound(input, site);
				const base = `/${taxonomy === "category" ? site.settings.category_base : site.settings.tag_base}/${route.slug}/`;
				const listing =
					taxonomy === "category"
						? await data.categoryListing(this.env.DB, site, term.id, (route.page - 1) * perPage, perPage)
						: await data.tagListing(this.env.DB, site, term.id, (route.page - 1) * perPage, perPage);
				const pages = data.totalPages(listing.total, perPage);
				if (route.page > pages && route.page > 1) return this.notFound(input, site);
				const body = renderArchive(input, archiveData(taxonomy, term, listing.posts, route.page, pages, base));
				return html(body, 200, site, 300);
			}
			case "entry": {
				const redirect = await this.findRedirect(site.id, route.path);
				if (redirect) {
					return new Response(null, {
						status: redirect.status_code,
						headers: { location: redirect.to_url, "cache-control": "public, max-age=3600" },
					});
				}
				const post = await data.getEntryByPath(this.env.DB, site, route.path);
				if (!post) return this.notFound(input, site);
				if (post.type === "page") return html(renderPage(input, post), 200, site, 600);
				const [tags, related] = await Promise.all([
					data.getPostTags(this.env.DB, post.id),
					data.getRelated(this.env.DB, site, post, 5),
				]);
				return html(renderPost(input, { post, tags, related }), 200, site, 600);
			}
			default:
				return this.notFound(input, site);
		}
	}

	private notFound(input: RenderInput, site: Site): Response {
		return html(renderNotFound(input), 404, site, 30);
	}

	private async findRedirect(siteId: number, path: string): Promise<RedirectRow | null> {
		return this.env.DB.prepare(`SELECT from_path, to_url, status_code FROM redirects WHERE site_id = ? AND from_path = ?`)
			.bind(siteId, path)
			.first<RedirectRow>();
	}

	// 由网关入口通过 RPC 调用：以 SiteRenderer 身份执行，才能命中它自己的缓存命名空间。
	async purge(options: CachePurgeOptions): Promise<CachePurgeResult> {
		if (!this.ctx.cache) return { success: true, errors: [] };
		return this.ctx.cache.purge(options);
	}

	private async serveMedia(site: Site, path: string): Promise<Response> {
		const key = `${site.id}${path}`;
		const object = await this.env.MEDIA.get(key);
		if (!object) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("cache-control", "public, max-age=31536000, immutable");
		headers.set("cache-tag", [siteTag(site.id), mediaTag(site.id)].join(","));
		return new Response(object.body, { headers });
	}
}
