import { WorkerEntrypoint } from "cloudflare:workers";
import { getSiteByHost } from "../db/queries";
import { ensureSchema } from "../db/schema";
import { hostTag, mediaTag, siteTag } from "../db/site";
import type { RedirectRow, Site } from "../db/types";
import { redirectKey } from "../lib/util";
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
		status === 200 ? `public, max-age=${cacheSeconds}, stale-while-revalidate=120, stale-if-error=86400` : `public, max-age=${cacheSeconds}`;
	return new Response(body, { status, headers });
}

// 带 cache-tag：改了重定向或域名后，按站点/主机清缓存能清掉旧的跳转
function redirect(location: string, status: number, tags: string[]): Response {
	return new Response(null, {
		status,
		headers: { location, "cache-control": "public, max-age=3600", "cache-tag": tags.join(",") },
	});
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
		try {
			return await this.render(request);
		} catch (err) {
			// 前台不再在每个新 isolate 上先跑建表检查（其中 CREATE TABLE 是写操作，必须绕到主库）。
			// 只有部署了新迁移、后台和定时任务都还没跑过时才会撞上缺表/缺列，这时补跑一次再重试
			if (!/no such (table|column)/i.test(String(err))) throw err;
			await ensureSchema(this.env.DB);
			return this.render(request);
		}
	}

	private async render(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const host = url.hostname;
		// 只读会话：开了 D1 读副本后，第一条查询（找站点）走主库，后面那一整批可以落到就近副本，且不会早于主库此刻的状态——
		// 刚发布、刚清过缓存的内容不会因为副本延迟被渲染成旧版本再缓存下来。没开读副本时等同于直连主库
		const db = this.env.DB.withSession("first-primary");
		const site = await getSiteByHost(db, host);
		if (!site || site.status !== "active") {
			return new Response("Site not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
		}

		// 只认主域名：www/裸域等别名一律 301 过去，否则同一个站在搜索引擎眼里是两份。
		// 查询串不进缓存键，所以也不带过去，免得一个人的参数被缓存后跳给所有人
		if (host !== site.primary_domain) {
			return redirect(`https://${site.primary_domain}${url.pathname}`, 301, [siteTag(site.id), hostTag(host)]);
		}

		// canonical、og:url、站点地图、RSS 里的绝对地址固定用 https 主域名：缓存键不含协议，不能取自请求
		const origin = `https://${site.primary_domain}`;
		const route = resolveRoute(site, url.pathname);

		// 这些路由不渲染主题，跳过侧栏数据查询
		switch (route.kind) {
			case "robots":
				return text(renderRobots(site, origin), "text/plain; charset=utf-8", site, 3600);
			case "feed": {
				const posts = await data.feedPosts(db, site, 20);
				return text(renderFeed(site, origin, posts), "application/atom+xml; charset=utf-8", site, 900);
			}
			case "sitemap":
				return text(renderSitemap(origin, await data.sitemapEntries(db, site)), "application/xml; charset=utf-8", site, 1800);
			case "media":
				return this.serveMedia(site, route.path);
		}

		// 重定向优先于内容（首页除外），分类、标签、分页路径也查；和页面数据放在同一个 batch 里。
		// 键用 redirectKey 规范化，和后台存库的写法一致，/a、/a/、/a.html 都能命中
		const redirectPath = route.kind === "home" && route.page === 1 ? null : redirectKey(url.pathname);
		const perPage = site.settings.posts_per_page;

		switch (route.kind) {
			case "home": {
				const page = await data.homePage(db, site, route.page, perPage, redirectPath);
				if (page.redirect) return this.follow(site, page.redirect);
				const input: RenderInput = { site, origin, common: page.common };
				const pages = data.totalPages(page.total, perPage);
				if (route.page > pages && route.page > 1) return this.notFound(input, site);
				return html(renderHome(input, listData(page.posts, route.page, pages, "/")), 200, site, 300);
			}
			case "category":
			case "tag": {
				const taxonomy = route.kind;
				const page = await data.archivePage(db, site, taxonomy, route.slug, route.page, perPage, redirectPath);
				if (page.redirect) return this.follow(site, page.redirect);
				const input: RenderInput = { site, origin, common: page.common };
				if (!page.term) return this.notFound(input, site);
				const base = `/${taxonomy === "category" ? site.settings.category_base : site.settings.tag_base}/${route.slug}/`;
				const pages = data.totalPages(page.total, perPage);
				if (route.page > pages && route.page > 1) return this.notFound(input, site);
				return html(renderArchive(input, archiveData(taxonomy, page.term, page.posts, route.page, pages, base)), 200, site, 300);
			}
			case "entry": {
				const page = await data.entryPage(db, site, route.path, redirectPath);
				if (page.redirect) return this.follow(site, page.redirect);
				const input: RenderInput = { site, origin, common: page.common };
				if (!page.post) return this.notFound(input, site);
				if (page.post.type === "page") return html(renderPage(input, page.post), 200, site, 600);
				return html(renderPost(input, { post: page.post, tags: page.tags, related: page.related }), 200, site, 600);
			}
			default: {
				const page = await data.basePage(db, site, redirectPath);
				if (page.redirect) return this.follow(site, page.redirect);
				return this.notFound({ site, origin, common: page.common }, site);
			}
		}
	}

	// 404 带站点 tag，发文、改路径、定时发布都会把它清掉，所以可以缓存久一点，挡住扫描器对同一批路径的反复探测
	private notFound(input: RenderInput, site: Site): Response {
		return html(renderNotFound(input), 404, site, 600);
	}

	private follow(site: Site, rule: RedirectRow): Response {
		return redirect(rule.to_url, rule.status_code, [siteTag(site.id)]);
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
