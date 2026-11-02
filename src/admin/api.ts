import { Hono } from "hono";
import { getSiteById } from "../db/queries";
import { siteTag } from "../db/site";
import type { PostRow } from "../db/types";
import { HttpError } from "../lib/util";
import { type Env, requireBearer } from "./auth";
import { deleteMedia, listMedia, uploadMedia } from "./media";
import {
	type PostInput,
	type SiteInput,
	createPost,
	createSite,
	deletePost,
	deleteRedirect,
	deleteSite,
	getSiteDomains,
	listSites,
	setRedirect,
	updatePost,
	updateSite,
} from "./service";

const api = new Hono<Env>();

api.use("*", async (c, next) => {
	const denied = await requireBearer(c);
	if (denied) return denied;
	await next();
});

api.onError((err, c) => {
	if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
	console.error("API error", err);
	return c.json({ error: "internal error" }, 500);
});

const siteId = (c: { req: { param(k: string): string } }): number => {
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "invalid site id");
	return id;
};

async function jsonBody(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, "invalid JSON body");
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "expected JSON object");
	return body as Record<string, unknown>;
}

api.get("/health", (c) => c.json({ ok: true, service: "edgeblog", time: Math.floor(Date.now() / 1000) }));

api.get("/sites", async (c) => c.json({ sites: await listSites(c.env.DB) }));

api.post("/sites", async (c) => {
	const site = await createSite(c.var.ctx, (await jsonBody(c)) as SiteInput);
	return c.json({ site, domains: await getSiteDomains(c.env.DB, site.id) }, 201);
});

api.get("/sites/:id", async (c) => {
	const id = siteId(c);
	const site = await getSiteById(c.env.DB, id);
	if (!site) throw new HttpError(404, "site not found");
	return c.json({ site, domains: await getSiteDomains(c.env.DB, id) });
});

api.patch("/sites/:id", async (c) => {
	const site = await updateSite(c.var.ctx, siteId(c), (await jsonBody(c)) as SiteInput);
	return c.json({ site, domains: await getSiteDomains(c.env.DB, site.id) });
});

api.delete("/sites/:id", async (c) => {
	await deleteSite(c.var.ctx, siteId(c));
	return c.json({ ok: true });
});

api.post("/sites/:id/purge", async (c) => {
	const result = await c.var.ctx.purge({ tags: [siteTag(siteId(c))] });
	return c.json(result);
});

api.get("/sites/:id/posts", async (c) => {
	const id = siteId(c);
	const status = c.req.query("status");
	const type = c.req.query("type");
	const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50));

	const filters: string[] = ["site_id = ?"];
	const binds: unknown[] = [id];
	if (status === "draft" || status === "published") {
		filters.push("status = ?");
		binds.push(status);
	}
	if (type === "post" || type === "page") {
		filters.push("type = ?");
		binds.push(type);
	}
	const where = filters.join(" AND ");
	const rows = await c.env.DB.prepare(
		`SELECT id, type, status, title, slug, path, published_at, updated_at FROM posts WHERE ${where} ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
	)
		.bind(...binds, limit, (page - 1) * limit)
		.all<Partial<PostRow>>();
	const total = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM posts WHERE ${where}`).bind(...binds).first<{ c: number }>();
	return c.json({ posts: rows.results, total: Number(total?.c ?? 0), page, limit });
});

api.post("/sites/:id/posts", async (c) => {
	const result = await createPost(c.var.ctx, siteId(c), (await jsonBody(c)) as PostInput);
	return c.json(result, 201);
});

// 批量发文：PBN 自动化主入口，逐条独立成败，返回每条结果
api.post("/sites/:id/posts/bulk", async (c) => {
	const id = siteId(c);
	const body = await c.req.json().catch(() => null);
	const items = Array.isArray(body) ? body : Array.isArray((body as { posts?: unknown })?.posts) ? (body as { posts: unknown[] }).posts : null;
	if (!items) throw new HttpError(400, "expected an array of posts or { posts: [...] }");
	if (items.length > 100) throw new HttpError(400, "max 100 posts per request");

	const results: { ok: boolean; id?: number; path?: string; error?: string }[] = [];
	let created = 0;
	for (const item of items) {
		try {
			if (!item || typeof item !== "object") throw new HttpError(400, "invalid post item");
			const res = await createPost(c.var.ctx, id, item as PostInput);
			results.push({ ok: true, ...res });
			created++;
		} catch (err) {
			results.push({ ok: false, error: err instanceof Error ? err.message : String(err) });
		}
	}
	return c.json({ created, failed: items.length - created, results }, created > 0 ? 201 : 400);
});

api.get("/sites/:id/posts/:postId", async (c) => {
	const id = siteId(c);
	const postId = Number(c.req.param("postId"));
	const post = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ? AND site_id = ?`).bind(postId, id).first<PostRow>();
	if (!post) throw new HttpError(404, "post not found");
	return c.json({ post });
});

api.patch("/sites/:id/posts/:postId", async (c) => {
	const result = await updatePost(c.var.ctx, siteId(c), Number(c.req.param("postId")), (await jsonBody(c)) as PostInput);
	return c.json(result);
});

api.delete("/sites/:id/posts/:postId", async (c) => {
	await deletePost(c.var.ctx, siteId(c), Number(c.req.param("postId")));
	return c.json({ ok: true });
});

api.post("/sites/:id/redirects", async (c) => {
	const body = await jsonBody(c);
	const from = String(body.from ?? "");
	const to = String(body.to ?? "");
	if (!from || !to) throw new HttpError(400, "from and to are required");
	await setRedirect(c.var.ctx, siteId(c), from, to, Number(body.status ?? 301));
	return c.json({ ok: true }, 201);
});

api.delete("/sites/:id/redirects", async (c) => {
	const from = c.req.query("from");
	if (!from) throw new HttpError(400, "from query param is required");
	await deleteRedirect(c.var.ctx, siteId(c), from);
	return c.json({ ok: true });
});

api.get("/sites/:id/media", async (c) => c.json({ media: await listMedia(c.env.DB, siteId(c)) }));

api.post("/sites/:id/media", async (c) => {
	const id = siteId(c);
	const contentType = c.req.header("content-type") ?? "";
	if (contentType.includes("multipart/form-data")) {
		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) throw new HttpError(400, "missing file field");
		const row = await uploadMedia(c.var.ctx, c.env.MEDIA, id, file.name || "upload", file.type, await file.arrayBuffer());
		return c.json({ media: row }, 201);
	}
	const filename = c.req.header("x-filename") || "upload";
	const row = await uploadMedia(c.var.ctx, c.env.MEDIA, id, filename, contentType, await c.req.arrayBuffer());
	return c.json({ media: row }, 201);
});

api.delete("/sites/:id/media", async (c) => {
	const path = c.req.query("path");
	if (!path) throw new HttpError(400, "path query param is required");
	await deleteMedia(c.var.ctx, c.env.MEDIA, siteId(c), path);
	return c.json({ ok: true });
});

export default api;
