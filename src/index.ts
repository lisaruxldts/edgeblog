import admin from "./admin/app";
import { ensureSchema } from "./db/schema";
import { siteTag } from "./db/site";
import { isSeoBot } from "./lib/bots";
import { flag, parseList } from "./lib/util";
import { flushPurgeQueue, queuePurge } from "./site/purge";

export { SiteRenderer } from "./site/renderer";

function isAdminHost(host: string, env: Env): boolean {
	if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1") return true;
	if (host.endsWith(".workers.dev")) return true;
	return parseList(env.ADMIN_HOSTS).includes(host);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const host = url.hostname;

		// 后台 / API 仅在管理域名（*.workers.dev、localhost、ADMIN_HOSTS）上开放
		if (isAdminHost(host, env)) {
			if (url.pathname === "/" || url.pathname === "/admin") {
				return Response.redirect(`${url.origin}/admin/sites`, 302);
			}
			if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api")) {
				return admin.fetch(request, env, ctx);
			}
		}

		// 拦 SEO 爬虫只能放在这个不缓存的入口：SiteRenderer 命中缓存时代码不运行，
		// 且缓存键不含 User-Agent——在那里返回的 403 会被存下来，发给 Googlebot 和所有访客
		if (flag(env.BLOCK_SEO_BOTS) && isSeoBot(request.headers.get("user-agent"))) {
			return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
		}

		// 租户站点：走 SiteRenderer 入口（已开缓存）。自定义缓存键按「主机名+路径」隔离多站点，
		// 并丢弃查询串，天然合并掉 utm 等追踪参数。
		return ctx.exports.SiteRenderer.fetch(request, {
			cf: { cacheKey: `/${host}${url.pathname}` },
		});
	},

	// 定时任务：让“定时发布”的文章到点可见——给刚过发布时间的站点清缓存，并重试之前被限流的清缓存
	async scheduled(_controller, env, ctx): Promise<void> {
		await ensureSchema(env.DB);
		const nowTs = Math.floor(Date.now() / 1000);
		const windowStart = nowTs - 20 * 60;
		const rows = await env.DB.prepare(
			`SELECT DISTINCT site_id FROM posts
			WHERE status = 'published' AND published_at > ? AND published_at <= ? LIMIT 200`,
		)
			.bind(windowStart, nowTs)
			.all<{ site_id: number }>();
		// 不再逐站调用 purge（每账号 5 次/分钟、单请求最多 32 次调用）：先入队，再按 100 个 tag 一批冲刷
		await queuePurge(env.DB, rows.results.map(({ site_id }) => siteTag(site_id)));
		await flushPurgeQueue(env.DB, ctx.exports.SiteRenderer);
	},
} satisfies ExportedHandler<Env>;
