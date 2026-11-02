/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { getSiteById } from "../db/queries";
import { siteTag } from "../db/site";
import type { PostRow, RedirectRow, Site } from "../db/types";
import { createSession, safeEqual } from "../lib/auth";
import { HttpError } from "../lib/util";
import { SESSION_COOKIE, SESSION_TTL, type Env, hasAdminSession } from "./auth";
import { postInputFromForm, siteInputFromForm } from "./forms";
import { HelpPage } from "./help";
import {
	LoginPage,
	MediaPage,
	PostForm,
	PostsPage,
	RedirectsPage,
	SiteDashboard,
	SiteForm,
	SitesPage,
} from "./pages";
import { deleteMedia, listMedia, uploadMedia } from "./media";
import {
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
import type { Flash } from "./ui";

const html = new Hono<Env>();

function flashFrom(c: { req: { query(k: string): string | undefined } }): Flash | undefined {
	const ok = c.req.query("ok");
	const err = c.req.query("err");
	if (ok) return { type: "ok", text: ok };
	if (err) return { type: "err", text: err };
	return undefined;
}

const redirectWith = (c: { redirect: (u: string, s?: 301 | 302) => Response }, path: string, kind: "ok" | "err", msg: string): Response =>
	c.redirect(`${path}?${kind}=${encodeURIComponent(msg)}`, 302);

function errMessage(err: unknown): string {
	return err instanceof HttpError ? err.message : err instanceof Error ? err.message : "unexpected error";
}

async function needSite(c: { env: { DB: D1Database }; req: { param(k: string): string } }): Promise<Site> {
	const id = Number(c.req.param("id"));
	const site = await getSiteById(c.env.DB, id);
	if (!site) throw new HttpError(404, "site not found");
	return site;
}

// 登录页免鉴权；其余 /admin/* 需要会话
html.use("*", async (c, next) => {
	const path = c.req.path;
	if (path === "/admin/login" || path === "/admin/logout") return next();
	if (!(await hasAdminSession(c))) {
		if (c.req.method !== "GET") return c.text("Unauthorized", 401);
		return c.redirect("/admin/login", 302);
	}
	await next();
});

html.get("/login", async (c) => {
	if (await hasAdminSession(c)) return c.redirect("/admin/sites", 302);
	return c.html(<LoginPage flash={flashFrom(c)} />);
});

html.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const password = typeof body.password === "string" ? body.password : "";
	if (!c.env.ADMIN_PASSWORD || !(await safeEqual(password, c.env.ADMIN_PASSWORD))) {
		return redirectWith(c, "/admin/login", "err", "Incorrect password");
	}
	const token = await createSession(c.env.ADMIN_PASSWORD, SESSION_TTL);
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: new URL(c.req.url).protocol === "https:",
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL,
	});
	return c.redirect("/admin/sites", 302);
});

html.post("/logout", (c) => {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
	return c.redirect("/admin/login", 302);
});

html.get("/", (c) => c.redirect("/admin/sites", 302));

html.get("/help", (c) => c.html(<HelpPage origin={new URL(c.req.url).origin} />));

html.get("/sites", async (c) => {
	const sites = await listSites(c.env.DB);
	return c.html(<SitesPage sites={sites} origin={new URL(c.req.url).origin} flash={flashFrom(c)} />);
});

html.get("/sites/new", (c) => c.html(<SiteForm flash={flashFrom(c)} />));

html.post("/sites", async (c) => {
	const body = await c.req.parseBody();
	try {
		const site = await createSite(c.var.ctx, siteInputFromForm(body));
		return redirectWith(c, `/admin/sites/${site.id}`, "ok", "Site created");
	} catch (err) {
		return redirectWith(c, "/admin/sites/new", "err", errMessage(err));
	}
});

html.get("/sites/:id", async (c) => {
	const site = await needSite(c);
	const [domains, counts, recent] = await Promise.all([
		getSiteDomains(c.env.DB, site.id),
		c.env.DB.prepare(
			`SELECT
				SUM(CASE WHEN type='post' AND status='published' THEN 1 ELSE 0 END) AS published,
				SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS drafts,
				SUM(CASE WHEN type='page' THEN 1 ELSE 0 END) AS pages
			FROM posts WHERE site_id = ?`,
		)
			.bind(site.id)
			.first<{ published: number; drafts: number; pages: number }>(),
		c.env.DB.prepare(
			`SELECT id, type, status, title, path, published_at, updated_at FROM posts WHERE site_id = ? ORDER BY updated_at DESC LIMIT 8`,
		)
			.bind(site.id)
			.all<PostRow>(),
	]);
	return c.html(
		<SiteDashboard
			site={site}
			domains={domains}
			counts={{
				published: Number(counts?.published ?? 0),
				drafts: Number(counts?.drafts ?? 0),
				pages: Number(counts?.pages ?? 0),
			}}
			recent={recent.results}
			flash={flashFrom(c)}
		/>,
	);
});

html.get("/sites/:id/edit", async (c) => {
	const site = await needSite(c);
	const domains = await getSiteDomains(c.env.DB, site.id);
	return c.html(<SiteForm site={site} domains={domains} flash={flashFrom(c)} />);
});

html.post("/sites/:id", async (c) => {
	const site = await needSite(c);
	const body = await c.req.parseBody();
	try {
		await updateSite(c.var.ctx, site.id, siteInputFromForm(body));
		return redirectWith(c, `/admin/sites/${site.id}/edit`, "ok", "Saved");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/edit`, "err", errMessage(err));
	}
});

html.post("/sites/:id/delete", async (c) => {
	const site = await needSite(c);
	await deleteSite(c.var.ctx, site.id);
	return redirectWith(c, "/admin/sites", "ok", `Deleted ${site.name}`);
});

html.post("/sites/:id/purge", async (c) => {
	const site = await needSite(c);
	await c.var.ctx.purge({ tags: [siteTag(site.id)] });
	return redirectWith(c, `/admin/sites/${site.id}`, "ok", "Cache purged");
});

html.get("/sites/:id/posts", async (c) => {
	const site = await needSite(c);
	const filter = c.req.query("filter") ?? "all";
	const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
	const perPage = 30;

	const filters = ["site_id = ?"];
	const binds: unknown[] = [site.id];
	if (filter === "published") filters.push("status = 'published' AND type = 'post'");
	else if (filter === "draft") filters.push("status = 'draft'");
	else if (filter === "page") filters.push("type = 'page'");
	const where = filters.join(" AND ");

	const rows = await c.env.DB.prepare(
		`SELECT id, type, status, title, path, published_at, updated_at FROM posts WHERE ${where}
		ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
	)
		.bind(...binds, perPage + 1, (page - 1) * perPage)
		.all<PostRow>();
	const hasNext = rows.results.length > perPage;
	return c.html(
		<PostsPage site={site} posts={rows.results.slice(0, perPage)} filter={filter} page={page} hasNext={hasNext} flash={flashFrom(c)} />,
	);
});

html.get("/sites/:id/posts/new", async (c) => {
	const site = await needSite(c);
	return c.html(<PostForm site={site} flash={flashFrom(c)} />);
});

html.post("/sites/:id/posts", async (c) => {
	const site = await needSite(c);
	const body = await c.req.parseBody();
	try {
		const res = await createPost(c.var.ctx, site.id, postInputFromForm(body));
		return redirectWith(c, `/admin/sites/${site.id}/posts/${res.id}`, "ok", "Post created");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/posts/new`, "err", errMessage(err));
	}
});

async function loadPostForm(c: { env: { DB: D1Database }; req: { param(k: string): string } }, site: Site) {
	const postId = Number(c.req.param("postId"));
	const post = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ? AND site_id = ?`).bind(postId, site.id).first<PostRow>();
	if (!post) throw new HttpError(404, "post not found");
	const [cat, tags] = await Promise.all([
		post.category_id
			? c.env.DB.prepare(`SELECT name FROM terms WHERE id = ?`).bind(post.category_id).first<{ name: string }>()
			: Promise.resolve(null),
		c.env.DB.prepare(`SELECT t.name FROM post_tags pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = ? ORDER BY t.name`)
			.bind(postId)
			.all<{ name: string }>(),
	]);
	return { post, category: cat?.name ?? "", tags: tags.results.map((t) => t.name) };
}

html.get("/sites/:id/posts/:postId", async (c) => {
	const site = await needSite(c);
	const { post, category, tags } = await loadPostForm(c, site);
	return c.html(<PostForm site={site} post={post} category={category} tags={tags} flash={flashFrom(c)} />);
});

html.post("/sites/:id/posts/:postId", async (c) => {
	const site = await needSite(c);
	const postId = Number(c.req.param("postId"));
	const body = await c.req.parseBody();
	try {
		await updatePost(c.var.ctx, site.id, postId, postInputFromForm(body));
		return redirectWith(c, `/admin/sites/${site.id}/posts/${postId}`, "ok", "Saved");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/posts/${postId}`, "err", errMessage(err));
	}
});

html.post("/sites/:id/posts/:postId/delete", async (c) => {
	const site = await needSite(c);
	await deletePost(c.var.ctx, site.id, Number(c.req.param("postId")));
	return redirectWith(c, `/admin/sites/${site.id}/posts`, "ok", "Post deleted");
});

html.get("/sites/:id/media", async (c) => {
	const site = await needSite(c);
	return c.html(<MediaPage site={site} media={await listMedia(c.env.DB, site.id)} flash={flashFrom(c)} />);
});

html.post("/sites/:id/media", async (c) => {
	const site = await needSite(c);
	try {
		const body = await c.req.parseBody();
		const file = body.file;
		if (!(file instanceof File)) throw new HttpError(400, "choose a file");
		await uploadMedia(c.var.ctx, c.env.MEDIA, site.id, file.name || "upload", file.type, await file.arrayBuffer());
		return redirectWith(c, `/admin/sites/${site.id}/media`, "ok", "Uploaded");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/media`, "err", errMessage(err));
	}
});

html.post("/sites/:id/media/delete", async (c) => {
	const site = await needSite(c);
	const body = await c.req.parseBody();
	const path = typeof body.path === "string" ? body.path : "";
	try {
		await deleteMedia(c.var.ctx, c.env.MEDIA, site.id, path);
		return redirectWith(c, `/admin/sites/${site.id}/media`, "ok", "Deleted");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/media`, "err", errMessage(err));
	}
});

html.get("/sites/:id/redirects", async (c) => {
	const site = await needSite(c);
	const rows = await c.env.DB.prepare(`SELECT from_path, to_url, status_code FROM redirects WHERE site_id = ? ORDER BY from_path`)
		.bind(site.id)
		.all<RedirectRow>();
	return c.html(<RedirectsPage site={site} redirects={rows.results} flash={flashFrom(c)} />);
});

html.post("/sites/:id/redirects", async (c) => {
	const site = await needSite(c);
	const body = await c.req.parseBody();
	try {
		await setRedirect(
			c.var.ctx,
			site.id,
			String(body.from ?? ""),
			String(body.to ?? ""),
			Number(body.status ?? 301),
		);
		return redirectWith(c, `/admin/sites/${site.id}/redirects`, "ok", "Redirect saved");
	} catch (err) {
		return redirectWith(c, `/admin/sites/${site.id}/redirects`, "err", errMessage(err));
	}
});

html.post("/sites/:id/redirects/delete", async (c) => {
	const site = await needSite(c);
	const body = await c.req.parseBody();
	await deleteRedirect(c.var.ctx, site.id, String(body.from ?? ""));
	return redirectWith(c, `/admin/sites/${site.id}/redirects`, "ok", "Redirect deleted");
});

export default html;
