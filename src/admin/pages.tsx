/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import type { MediaRow, PostRow, Site } from "../db/types";
import { THEMES } from "../themes";
import { editableSummary } from "./content";
import { Checkbox, Field, Layout, Select, StatusTag, TextArea } from "./ui";
import type { Flash } from "./ui";

const LANGS: [string, string][] = [
	["en", "English"],
	["zh", "简体中文"],
	["zh-tw", "繁體中文"],
	["ja", "日本語"],
	["es", "Español"],
	["de", "Deutsch"],
	["fr", "Français"],
	["pt", "Português"],
];

const THEME_OPTS: [string, string][] = Object.values(THEMES).map((t) => [t.id, t.name]);
const FONT_OPTS: [string, string][] = [
	["sans", "Sans-serif"],
	["serif", "Serif"],
	["mono", "Monospace"],
];

export const LoginPage: FC<{ flash?: Flash }> = ({ flash }) => (
	<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<meta name="robots" content="noindex, nofollow" />
			<title>Sign in · EdgeBlog</title>
			<style
				dangerouslySetInnerHTML={{
					__html: `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;font:15px system-ui,-apple-system,sans-serif}
.box{background:#fff;padding:36px;border-radius:14px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
h1{margin:0 0 6px;font-size:24px;text-align:center}h1 span{color:#2563eb}
p{margin:0 0 24px;text-align:center;color:#6b7280;font-size:13px}
label{display:block;font-weight:600;font-size:13px;margin-bottom:6px}
input{width:100%;padding:11px;border:1px solid #d1d5db;border-radius:8px;font:inherit;box-sizing:border-box}
button{width:100%;margin-top:18px;padding:11px;background:#2563eb;color:#fff;border:0;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#1d4ed8}
.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:10px;border-radius:8px;font-size:13px;margin-bottom:18px}`,
				}}
			/>
		</head>
		<body>
			<form class="box" method="post" action="/admin/login">
				<h1>
					Edge<span>Blog</span>
				</h1>
				<p>Admin sign in</p>
				{flash?.type === "err" && <div class="err">{flash.text}</div>}
				<label for="password">Admin password</label>
				<input id="password" name="password" type="password" autofocus required />
				<button type="submit">Sign in</button>
			</form>
		</body>
	</html>
);

type SiteListItem = Site & { domains: string[]; post_count: number };

export const SitesPage: FC<{ sites: SiteListItem[]; origin: string; flash?: Flash }> = ({ sites, origin, flash }) => (
	<Layout title="Sites" active="sites" flash={flash}>
		<div class="list-head">
			<div>
				<h1>Sites</h1>
				<p class="sub">{sites.length} site(s) on this Worker</p>
			</div>
			<a class="btn" href="/admin/sites/new">
				+ New site
			</a>
		</div>
		{sites.length === 0 ? (
			<div class="card empty">
				No sites yet. <a href="/admin/sites/new">Create your first site</a> or use the JSON API.
			</div>
		) : (
			<div class="card pad0">
				<table>
					<thead>
						<tr>
							<th>Site</th>
							<th>Primary domain</th>
							<th>Theme</th>
							<th>Posts</th>
							<th>Status</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{sites.map((s) => (
							<tr>
								<td>
									<strong>{s.name}</strong>
									{s.domains.length > 1 && <div class="muted mono">{s.domains.length} domains</div>}
								</td>
								<td>
									<a href={`https://${s.primary_domain}/`} target="_blank" rel="noreferrer">
										{s.primary_domain}
									</a>
								</td>
								<td>
									<span class="swatch" style={`background:${s.theme_options.accent}`} /> {s.theme}
								</td>
								<td>{s.post_count}</td>
								<td>
									<StatusTag status={s.status} />
								</td>
								<td>
									<a href={`/admin/sites/${s.id}`}>Manage →</a>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)}
		<p class="muted" style="font-size:13px">
			Origin: <span class="mono">{origin}</span>
		</p>
	</Layout>
);

export const SiteForm: FC<{ site?: Site; domains?: string[]; flash?: Flash }> = ({ site, domains, flash }) => {
	const isNew = !site;
	const s = site;
	const opt = s?.settings;
	const to = s?.theme_options;
	return (
		<Layout title={isNew ? "New site" : `Edit ${s?.name}`} active={isNew ? "new" : "sites"} flash={flash} narrow>
			<div class="breadcrumb">
				<a href="/admin/sites">Sites</a> / {isNew ? "New" : s?.name}
			</div>
			<h1>{isNew ? "Create site" : "Site settings"}</h1>
			<p class="sub">
				{isNew ? "A new blog. Theme, colors and layout are randomized if you leave them default." : "Changes purge this site's edge cache."}
			</p>
			<form method="post" action={isNew ? "/admin/sites" : `/admin/sites/${s?.id}`}>
				<div class="card">
					<h2>Basics</h2>
					<Field label="Site name" name="name" value={s?.name} required placeholder="My Travel Blog" />
					<Field label="Tagline" name="tagline" value={s?.tagline} placeholder="Notes on slow travel" />
					<div class="row">
						<Field label="Primary domain" name="primary_domain" value={s?.primary_domain} required placeholder="example.com" hint="apex or sub" />
						<Select label="Status" name="status" value={s?.status ?? "active"} options={[["active", "Active"], ["paused", "Paused"]]} />
					</div>
					<TextArea
						label="Extra domains"
						name="domains"
						value={(domains ?? []).filter((d) => d !== s?.primary_domain).join("\n")}
						hint="one per line; all must be zones on this account"
						rows={2}
					/>
				</div>
				<div class="card">
					<h2>Locale</h2>
					<div class="row">
						<Select label="Language" name="language" value={s?.language ?? "en"} options={LANGS} />
						<Field label="Timezone" name="timezone" value={s?.timezone ?? "UTC"} hint="IANA, e.g. Asia/Shanghai" />
					</div>
				</div>
				<div class="card">
					<h2>Appearance</h2>
					<div class="row">
						<Select label="Theme" name="theme" value={s?.theme ?? ""} options={isNew ? [["", "Random"], ...THEME_OPTS] : THEME_OPTS} />
						<Select label="Font" name="to_font" value={to?.font ?? "sans"} options={FONT_OPTS} />
						<Field label="Accent color" name="to_accent" value={to?.accent} type="text" hint="#2563eb or blank" />
					</div>
					<Field label="Layout variant" name="to_layout" value={to?.layout} hint="theme-specific, blank = random/default" />
					<TextArea label="Custom CSS" name="to_custom_css" value={to?.custom_css} hint="appended to theme CSS" rows={3} />
				</div>
				<div class="card">
					<h2>SEO & content</h2>
					<div class="row">
						<Field label="Posts per page" name="set_posts_per_page" value={opt?.posts_per_page ?? 10} type="number" />
						<Field label="Permalink" name="set_permalink" value={opt?.permalink ?? "/%slug%/"} hint="%slug% %year% %month% %category%" />
					</div>
					<div class="row">
						<Field label="Category base" name="set_category_base" value={opt?.category_base ?? "category"} />
						<Field label="Tag base" name="set_tag_base" value={opt?.tag_base ?? "tag"} />
					</div>
					<div class="row">
						<Field label="Author name" name="set_author_name" value={opt?.author_name} />
						<Field label="Title separator" name="set_title_separator" value={opt?.title_separator ?? " - "} />
					</div>
					<TextArea label="Author bio" name="set_author_bio" value={opt?.author_bio} rows={2} />
					<TextArea label="Nav links" name="set_nav_links" value={opt?.nav_links} hint="Label|/path per line" rows={2} />
					<Checkbox label="Noindex tag archives (recommended for SEO)" name="set_noindex_tags" checked={opt?.noindex_tags ?? true} />
					<TextArea label="Custom <head> HTML" name="set_head_html" value={opt?.head_html} hint="analytics, verification tags" rows={2} />
					<TextArea label="Footer HTML" name="set_footer_html" value={opt?.footer_html} rows={2} />
					<TextArea label="Custom robots.txt" name="set_robots_txt" value={opt?.robots_txt} hint="blank = sensible default" rows={2} />
				</div>
				<div class="actions">
					<button class="btn" type="submit">
						{isNew ? "Create site" : "Save changes"}
					</button>
					<a class="btn secondary" href="/admin/sites">
						Cancel
					</a>
				</div>
			</form>
			{!isNew && (
				<div class="card" style="margin-top:24px">
					<h2>Danger zone</h2>
					<form method="post" action={`/admin/sites/${s?.id}/delete`} onsubmit="return confirm('Delete this site and all its posts? This cannot be undone.')">
						<button class="btn danger" type="submit">
							Delete site
						</button>
					</form>
				</div>
			)}
		</Layout>
	);
};

type PostRowLite = Pick<PostRow, "id" | "type" | "status" | "title" | "path" | "published_at" | "updated_at">;

export const SiteDashboard: FC<{
	site: Site;
	domains: string[];
	counts: { published: number; drafts: number; pages: number };
	recent: PostRowLite[];
	flash?: Flash;
}> = ({ site, domains, counts, recent, flash }) => (
	<Layout title={site.name} active="sites" flash={flash}>
		<div class="breadcrumb">
			<a href="/admin/sites">Sites</a> / {site.name}
		</div>
		<div class="list-head">
			<div>
				<h1>{site.name}</h1>
				<p class="sub">
					<a href={`https://${site.primary_domain}/`} target="_blank" rel="noreferrer">
						{site.primary_domain}
					</a>{" "}
					· <StatusTag status={site.status} />
				</p>
			</div>
			<div class="actions">
				<a class="btn" href={`/admin/sites/${site.id}/posts/new`}>
					+ New post
				</a>
				<a class="btn secondary" href={`/admin/sites/${site.id}/edit`}>
					Settings
				</a>
			</div>
		</div>
		<div class="grid cols-2">
			<div class="card">
				<h2>Content</h2>
				<div class="stat">
					<div>
						<div class="n">{counts.published}</div>
						<div class="l">Published</div>
					</div>
					<div>
						<div class="n">{counts.drafts}</div>
						<div class="l">Drafts</div>
					</div>
					<div>
						<div class="n">{counts.pages}</div>
						<div class="l">Pages</div>
					</div>
				</div>
				<div class="actions">
					<a class="btn secondary sm" href={`/admin/sites/${site.id}/posts`}>
						All posts
					</a>
					<a class="btn secondary sm" href={`/admin/sites/${site.id}/media`}>
						Media
					</a>
					<a class="btn secondary sm" href={`/admin/sites/${site.id}/redirects`}>
						Redirects
					</a>
				</div>
			</div>
			<div class="card">
				<h2>Domains</h2>
				<ul style="margin:0;padding-left:18px">
					{domains.map((d) => (
						<li>
							<a href={`https://${d}/`} target="_blank" rel="noreferrer" class="mono">
								{d}
							</a>
						</li>
					))}
				</ul>
				<form method="post" action={`/admin/sites/${site.id}/purge`} style="margin-top:14px">
					<button class="btn secondary sm" type="submit">
						Purge edge cache
					</button>
				</form>
			</div>
		</div>
		<div class="card pad0">
			<div style="padding:16px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
				<h2 style="margin:0">Recent posts</h2>
				<a href={`/admin/sites/${site.id}/posts`}>View all →</a>
			</div>
			{recent.length === 0 ? (
				<div class="empty">No posts yet.</div>
			) : (
				<table>
					<tbody>
						{recent.map((p) => (
							<tr>
								<td>
									<a href={`/admin/sites/${site.id}/posts/${p.id}`}>{p.title}</a>
									<div class="muted mono">{p.path}</div>
								</td>
								<td>
									<StatusTag status={p.status} />
								</td>
								<td class="muted">{p.type}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	</Layout>
);

export const PostsPage: FC<{
	site: Site;
	posts: PostRowLite[];
	filter: string;
	page: number;
	hasNext: boolean;
	flash?: Flash;
}> = ({ site, posts, filter, page, hasNext, flash }) => {
	const q = (f: string) => `/admin/sites/${site.id}/posts?filter=${f}`;
	return (
		<Layout title={`Posts · ${site.name}`} active="sites" flash={flash}>
			<div class="breadcrumb">
				<a href="/admin/sites">Sites</a> / <a href={`/admin/sites/${site.id}`}>{site.name}</a> / Posts
			</div>
			<div class="list-head">
				<h1>Posts</h1>
				<a class="btn" href={`/admin/sites/${site.id}/posts/new`}>
					+ New post
				</a>
			</div>
			<div class="toolbar">
				{[["all", "All"], ["published", "Published"], ["draft", "Drafts"], ["page", "Pages"]].map(([f, label]) => (
					<a class={`pagelink ${filter === f ? "on" : ""}`} href={q(f)} style={filter === f ? "background:#2563eb;color:#fff" : ""}>
						{label}
					</a>
				))}
			</div>
			<div class="card pad0">
				{posts.length === 0 ? (
					<div class="empty">No posts match this filter.</div>
				) : (
					<table>
						<thead>
							<tr>
								<th>Title</th>
								<th>Path</th>
								<th>Status</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{posts.map((p) => (
								<tr>
									<td>
										<a href={`/admin/sites/${site.id}/posts/${p.id}`}>
											<strong>{p.title}</strong>
										</a>
										<span class="muted"> · {p.type}</span>
									</td>
									<td class="mono muted">{p.path}</td>
									<td>
										<StatusTag status={p.status} />
									</td>
									<td>
										{p.status === "published" && (
											<a href={`https://${site.primary_domain}${p.path}`} target="_blank" rel="noreferrer">
												View
											</a>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
			<div class="toolbar" style="justify-content:space-between">
				{page > 1 ? (
					<a class="pagelink" href={`${q(filter)}&page=${page - 1}`}>
						← Prev
					</a>
				) : (
					<span />
				)}
				{hasNext ? (
					<a class="pagelink" href={`${q(filter)}&page=${page + 1}`}>
						Next →
					</a>
				) : (
					<span />
				)}
			</div>
		</Layout>
	);
};

export const PostForm: FC<{
	site: Site;
	post?: PostRow;
	tags?: string[];
	category?: string;
	flash?: Flash;
}> = ({ site, post, tags, category, flash }) => {
	const isNew = !post;
	const action = isNew ? `/admin/sites/${site.id}/posts` : `/admin/sites/${site.id}/posts/${post?.id}`;
	return (
		<Layout title={isNew ? "New post" : `Edit · ${post?.title}`} active="sites" flash={flash}>
			<div class="breadcrumb">
				<a href="/admin/sites">Sites</a> / <a href={`/admin/sites/${site.id}`}>{site.name}</a> /{" "}
				<a href={`/admin/sites/${site.id}/posts`}>Posts</a> / {isNew ? "New" : "Edit"}
			</div>
			<h1>{isNew ? "New post" : "Edit post"}</h1>
			<form method="post" action={action}>
				<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start">
					<div>
						<div class="card">
							<Field label="Title" name="title" value={post?.title} required placeholder="How to…" />
							<div class="row">
								<Select
									label="Content format"
									name="content_format"
									value={post?.content_format ?? "markdown"}
									options={[["markdown", "Markdown"], ["html", "HTML"]]}
								/>
								<Field label="Slug" name="slug" value={post?.slug} hint="blank = from title" />
							</div>
							<TextArea label="Content" name="content" value={post?.content} rows={20} mono hint="Markdown or raw HTML" />
							<TextArea label="Excerpt" name="excerpt" value={post && editableSummary(post)} hint="blank = auto from content" rows={2} />
						</div>
						<div class="card">
							<h2>SEO</h2>
							<Field label="Meta title" name="meta_title" value={post?.meta_title} hint="blank = post title" />
							<TextArea label="Meta description" name="meta_description" value={post?.meta_description ?? ""} rows={2} />
							<Field label="Canonical URL" name="canonical_url" value={post?.canonical_url} type="url" hint="for cross-posting" />
							<Checkbox label="Noindex this post" name="noindex" checked={!!post?.noindex} />
						</div>
					</div>
					<div>
						<div class="card">
							<h2>Publish</h2>
							<Select
								label="Status"
								name="status"
								value={post?.status ?? "published"}
								options={[["published", "Published"], ["draft", "Draft"]]}
							/>
							<Select label="Type" name="type" value={post?.type ?? "post"} options={[["post", "Post"], ["page", "Page"]]} />
							<Field
								label="Publish date"
								name="published_at"
								type="datetime-local"
								value={post?.published_at ? toLocalInput(post.published_at) : ""}
								hint="blank = now"
							/>
							<div class="actions">
								<button class="btn" type="submit">
									{isNew ? "Create" : "Save"}
								</button>
							</div>
						</div>
						<div class="card">
							<h2>Organize</h2>
							<Field label="Category" name="category" value={category} hint="single; created if new" />
							<Field label="Tags" name="tags" value={(tags ?? []).join(", ")} hint="comma separated" />
							<Field label="Cover image URL" name="cover_image" value={post?.cover_image} hint="/uploads/… or full URL" />
						</div>
						{!isNew && (
							<div class="card">
								<form
									method="post"
									action={`/admin/sites/${site.id}/posts/${post?.id}/delete`}
									onsubmit="return confirm('Delete this post?')"
								>
									<button class="btn danger sm" type="submit">
										Delete post
									</button>
								</form>
							</div>
						)}
					</div>
				</div>
			</form>
		</Layout>
	);
};

function toLocalInput(ts: number): string {
	return new Date(ts * 1000).toISOString().slice(0, 16);
}

export const MediaPage: FC<{ site: Site; media: MediaRow[]; flash?: Flash }> = ({ site, media, flash }) => (
	<Layout title={`Media · ${site.name}`} active="sites" flash={flash}>
		<div class="breadcrumb">
			<a href="/admin/sites">Sites</a> / <a href={`/admin/sites/${site.id}`}>{site.name}</a> / Media
		</div>
		<h1>Media</h1>
		<p class="sub">Stored in R2, served from /uploads/… with 1-year immutable cache.</p>
		<div class="card">
			<form method="post" action={`/admin/sites/${site.id}/media`} enctype="multipart/form-data">
				<div class="row" style="align-items:flex-end">
					<div class="field" style="flex:1">
						<label>Upload image</label>
						<input type="file" name="file" accept="image/*" required />
					</div>
					<button class="btn" type="submit">
						Upload
					</button>
				</div>
			</form>
		</div>
		{media.length === 0 ? (
			<div class="card empty">No media yet.</div>
		) : (
			<div class="media-grid">
				{media.map((m) => (
					<div class="media-item">
						<img src={`https://${site.primary_domain}${m.path}`} alt={m.filename} loading="lazy" />
						<div class="meta">
							<div class="mono" style="word-break:break-all">
								{m.path}
							</div>
							<form
								method="post"
								action={`/admin/sites/${site.id}/media/delete`}
								onsubmit="return confirm('Delete this file?')"
								style="margin-top:4px"
							>
								<input type="hidden" name="path" value={m.path} />
								<button class="btn-link" type="submit" style="color:#dc2626">
									Delete
								</button>
							</form>
						</div>
					</div>
				))}
			</div>
		)}
	</Layout>
);

export const RedirectsPage: FC<{
	site: Site;
	redirects: { from_path: string; to_url: string; status_code: number }[];
	flash?: Flash;
}> = ({ site, redirects, flash }) => (
	<Layout title={`Redirects · ${site.name}`} active="sites" flash={flash}>
		<div class="breadcrumb">
			<a href="/admin/sites">Sites</a> / <a href={`/admin/sites/${site.id}`}>{site.name}</a> / Redirects
		</div>
		<h1>Redirects</h1>
		<p class="sub">
			301/302 redirects, checked before content on every path except the home page. Trailing slashes don't matter; query
			strings (/?p=123) are not supported.
		</p>
		<div class="card">
			<form method="post" action={`/admin/sites/${site.id}/redirects`}>
				<div class="row" style="align-items:flex-end">
					<Field label="From path" name="from" placeholder="/old-url/" required />
					<Field label="To URL" name="to" placeholder="/new-url/ or https://…" required />
					<div class="field" style="max-width:120px">
						<Select label="Code" name="status" value="301" options={[["301", "301"], ["302", "302"], ["308", "308"]]} />
					</div>
					<button class="btn" type="submit">
						Add
					</button>
				</div>
			</form>
		</div>
		{redirects.length > 0 && (
			<div class="card pad0">
				<table>
					<thead>
						<tr>
							<th>From</th>
							<th>To</th>
							<th>Code</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{redirects.map((r) => (
							<tr>
								<td class="mono">{r.from_path}</td>
								<td class="mono muted">{r.to_url}</td>
								<td>{r.status_code}</td>
								<td>
									<form method="post" action={`/admin/sites/${site.id}/redirects/delete`}>
										<input type="hidden" name="from" value={r.from_path} />
										<button class="btn-link" type="submit" style="color:#dc2626">
											Delete
										</button>
									</form>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)}
	</Layout>
);
