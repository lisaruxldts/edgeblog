import { Hono } from "hono";
import { ensureSchema } from "../db/schema";
import { purgeTags } from "../site/purge";
import type { Ctx } from "./service";
import type { Env } from "./auth";
import api from "./api";
import html from "./html";

const admin = new Hono<Env>();

// 建表 + 注入 Ctx（purge 通过 RPC 落到 SiteRenderer 入口，命中它自己的缓存；被限流时自动入队重试）
admin.use("*", async (c, next) => {
	await ensureSchema(c.env.DB);
	const renderer = c.executionCtx.exports.SiteRenderer;
	const ctx: Ctx = {
		db: c.env.DB,
		purge: (options) => purgeTags(c.env.DB, renderer, options.tags ?? []),
	};
	c.set("ctx", ctx);
	await next();
});

admin.route("/api", api);
admin.route("/admin", html);

export default admin;
