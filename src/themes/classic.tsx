/** @jsxImportSource hono/jsx */
import type { PostSummary, ThemeOptions } from "../db/types";
import { fill } from "../lib/i18n";
import { FONT_STACKS, Html, Time, pageHref } from "./shared";
import type { ListData, Theme, ThemeContext } from "./types";

const css = (o: ThemeOptions) => `
:root{--accent:${o.accent};--text:#1f2328;--muted:#5f6b76;--line:#e3e6ea;--soft:#f5f7f9;--font:${FONT_STACKS[o.font]}}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--text);font:17px/1.75 var(--font);-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%;height:auto}
.container{max-width:1120px;margin:0 auto;padding:0 22px}
.site-header{padding:34px 0 0;border-bottom:1px solid var(--line)}
.site-title{margin:0;font-size:31px;line-height:1.2;font-weight:700;letter-spacing:-.01em}
.site-title a{color:var(--text)}
.site-description{margin:6px 0 20px;color:var(--muted);font-size:15px}
.main-nav ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:0 26px}
.main-nav a{display:block;padding:12px 0;color:var(--text);font-size:15px;font-weight:600;border-bottom:3px solid transparent}
.main-nav a:hover{text-decoration:none;border-bottom-color:var(--accent)}
.site-content{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;padding:44px 22px 60px}
.layout-sidebar-left .content-area{order:2}
.layout-no-sidebar{grid-template-columns:minmax(0,760px);justify-content:center}
.layout-no-sidebar .sidebar{display:none}
.entry{padding-bottom:34px;margin-bottom:34px;border-bottom:1px solid var(--line)}
.entry:last-of-type{border-bottom:0}
.entry-title{margin:0 0 6px;font-size:27px;line-height:1.3}
.entry-title a{color:var(--text)}
.entry-meta{color:var(--muted);font-size:14px;margin-bottom:14px}
.entry-meta a{color:var(--muted);text-decoration:underline}
.entry-thumb img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;margin-bottom:14px}
.entry-summary{margin:0 0 10px}
.more-link{font-weight:600;font-size:15px}
.entry-single .entry-title{font-size:36px}
.entry-cover{margin:0 0 26px}
.entry-cover img{width:100%;border-radius:4px}
.entry-content h2{font-size:26px;margin:1.8em 0 .6em;line-height:1.3}
.entry-content h3{font-size:21px;margin:1.6em 0 .5em}
.entry-content p,.entry-content ul,.entry-content ol{margin:0 0 1.15em}
.entry-content blockquote{margin:1.4em 0;padding:4px 20px;border-left:4px solid var(--accent);background:var(--soft);color:#3d454d}
.entry-content pre{background:#1e2329;color:#e6edf3;padding:16px;overflow:auto;border-radius:4px;font-size:14px}
.entry-content code{font-size:.88em}
.entry-content :not(pre)>code{background:var(--soft);padding:2px 5px;border-radius:3px}
.entry-content table{width:100%;border-collapse:collapse;margin:0 0 1.2em;font-size:15px}
.entry-content th,.entry-content td{border:1px solid var(--line);padding:8px 10px;text-align:left}
.entry-content img{border-radius:4px}
.entry-footer{margin-top:26px;font-size:14px;color:var(--muted)}
.entry-footer a{display:inline-block;margin:0 6px 6px 0;padding:2px 10px;background:var(--soft);border-radius:3px;color:var(--text)}
.author-box{display:flex;gap:16px;padding:20px;background:var(--soft);border-radius:4px;margin:10px 0 34px}
.author-box h3{margin:0 0 4px;font-size:16px}
.author-box p{margin:0;font-size:15px;color:var(--muted)}
.related h2,.archive-title{font-size:22px;margin:0 0 14px}
.archive-header{margin-bottom:34px;padding-bottom:18px;border-bottom:2px solid var(--text)}
.archive-header p{margin:6px 0 0;color:var(--muted)}
.related ul{margin:0;padding-left:20px}
.related li{margin-bottom:6px}
.pagination{display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:600}
.pagination span{color:var(--muted);font-weight:400}
.widget{margin-bottom:38px;font-size:15px}
.widget-title{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--accent)}
.widget ul{list-style:none;margin:0;padding:0}
.widget li{padding:7px 0;border-bottom:1px solid var(--line)}
.widget li a{color:var(--text)}
.widget .count{color:var(--muted);float:right}
.widget p{margin:0;color:var(--muted)}
.site-footer{border-top:1px solid var(--line);padding:26px 0 40px;color:var(--muted);font-size:14px;background:var(--soft)}
.site-footer nav{margin-bottom:8px}
.site-footer nav a{margin-right:18px;color:var(--muted)}
.not-found{text-align:center;padding:30px 0}
.not-found h1{font-size:64px;margin:0;color:var(--accent)}
@media (max-width:860px){.site-content{grid-template-columns:minmax(0,1fr);gap:20px}.layout-sidebar-left .content-area{order:0}.entry-single .entry-title{font-size:29px}}
`;

const Title = ({ ctx }: { ctx: ThemeContext }) =>
	ctx.view === "home" ? (
		<h1 class="site-title">
			<a href="/">{ctx.site.name}</a>
		</h1>
	) : (
		<div class="site-title">
			<a href="/">{ctx.site.name}</a>
		</div>
	);

const Sidebar = ({ ctx }: { ctx: ThemeContext }) => (
	<aside class="sidebar">
		{(ctx.site.settings.author_bio || ctx.site.tagline) && (
			<section class="widget">
				<h2 class="widget-title">{ctx.t.about}</h2>
				<p>{ctx.site.settings.author_bio || ctx.site.tagline}</p>
			</section>
		)}
		{ctx.recent.length > 0 && (
			<section class="widget">
				<h2 class="widget-title">{ctx.t.recent}</h2>
				<ul>
					{ctx.recent.slice(0, 5).map((p) => (
						<li>
							<a href={ctx.href(p.path)}>{p.title}</a>
						</li>
					))}
				</ul>
			</section>
		)}
		{ctx.categories.length > 0 && (
			<section class="widget">
				<h2 class="widget-title">{ctx.t.categories}</h2>
				<ul>
					{ctx.categories.map((c) => (
						<li>
							<a href={ctx.catHref(c.slug)}>{c.name}</a>
							<span class="count">{c.count}</span>
						</li>
					))}
				</ul>
			</section>
		)}
	</aside>
);

const Entry = ({ ctx, post }: { ctx: ThemeContext; post: PostSummary }) => (
	<article class="entry">
		<h2 class="entry-title">
			<a href={ctx.href(post.path)}>{post.title}</a>
		</h2>
		<div class="entry-meta">
			<Time ts={post.published_at} label={ctx.date(post.published_at)} />
			{post.category_slug && (
				<>
					{" · "}
					<a href={ctx.catHref(post.category_slug)}>{post.category_name}</a>
				</>
			)}
		</div>
		{post.cover_image && (
			<a class="entry-thumb" href={ctx.href(post.path)}>
				<img src={post.cover_image} alt={post.title} loading="lazy" />
			</a>
		)}
		<p class="entry-summary">{post.excerpt}</p>
		<a class="more-link" href={ctx.href(post.path)}>
			{ctx.t.readMore} →
		</a>
	</article>
);

const EntryList = ({ ctx, data }: { ctx: ThemeContext; data: ListData }) => (
	<>
		{data.posts.length === 0 && <p>{ctx.t.noPosts}</p>}
		{data.posts.map((p) => (
			<Entry ctx={ctx} post={p} />
		))}
		{data.totalPages > 1 && (
			<nav class="pagination">
				{data.page > 1 ? <a href={pageHref(data.baseHref, data.page - 1)}>← {ctx.t.newer}</a> : <i />}
				<span>{fill(ctx.t.pageOf, { n: data.page, total: data.totalPages })}</span>
				{data.page < data.totalPages ? <a href={pageHref(data.baseHref, data.page + 1)}>{ctx.t.older} →</a> : <i />}
			</nav>
		)}
	</>
);

export const classic: Theme = {
	id: "classic",
	name: "Classic（经典侧栏）",
	layouts: ["sidebar-right", "sidebar-left", "no-sidebar"],
	css,
	Shell: ({ ctx, children }) => {
		const layout = classic.layouts.includes(ctx.site.theme_options.layout) ? ctx.site.theme_options.layout : classic.layouts[0];
		return (
			<>
				<header class="site-header">
					<div class="container">
						<Title ctx={ctx} />
						{ctx.site.tagline && <p class="site-description">{ctx.site.tagline}</p>}
						<nav class="main-nav">
							<ul>
								{ctx.nav.map((n) => (
									<li>
										<a href={n.href}>{n.label}</a>
									</li>
								))}
							</ul>
						</nav>
					</div>
				</header>
				<div class={`container site-content layout-${layout}`}>
					<main class="content-area">{children}</main>
					<Sidebar ctx={ctx} />
				</div>
				<footer class="site-footer">
					<div class="container">
						{ctx.pages.length > 0 && (
							<nav>
								{ctx.pages.map((p) => (
									<a href={ctx.href(p.path)}>{p.title}</a>
								))}
							</nav>
						)}
						© {ctx.currentYear} {ctx.site.name}. {ctx.t.rights}
					</div>
				</footer>
			</>
		);
	},
	Home: ({ ctx, data }) => <EntryList ctx={ctx} data={data} />,
	Archive: ({ ctx, data }) => (
		<>
			<header class="archive-header">
				<h1 class="archive-title">
					{data.kind === "category" ? ctx.t.category : ctx.t.tag}: {data.term.name}
				</h1>
				{data.term.description && <p>{data.term.description}</p>}
			</header>
			<EntryList ctx={ctx} data={data} />
		</>
	),
	Post: ({ ctx, data: { post, tags, related } }) => {
		const author = post.author_name || ctx.site.settings.author_name;
		return (
			<>
				<article class="entry entry-single">
					<header>
						<h1 class="entry-title">{post.title}</h1>
						<div class="entry-meta">
							<Time ts={post.published_at} label={ctx.date(post.published_at)} />
							{author && ` · ${ctx.t.by} ${author}`}
							{post.category_slug && (
								<>
									{" · "}
									<a href={ctx.catHref(post.category_slug)}>{post.category_name}</a>
								</>
							)}
						</div>
					</header>
					{post.cover_image && (
						<figure class="entry-cover">
							<img
								src={post.cover_image}
								alt={post.title}
								width={post.cover_width ?? undefined}
								height={post.cover_height ?? undefined}
								fetchpriority="high"
							/>
						</figure>
					)}
					<Html class="entry-content" html={post.content_html} />
					{tags.length > 0 && (
						<footer class="entry-footer">
							{ctx.t.tags}:{" "}
							{tags.map((t) => (
								<a href={ctx.tagHref(t.slug)}>{t.name}</a>
							))}
						</footer>
					)}
				</article>
				{ctx.site.settings.author_bio && author && (
					<section class="author-box">
						<div>
							<h3>
								{ctx.t.aboutAuthor}: {author}
							</h3>
							<p>{ctx.site.settings.author_bio}</p>
						</div>
					</section>
				)}
				{related.length > 0 && (
					<section class="related">
						<h2>{ctx.t.related}</h2>
						<ul>
							{related.map((p) => (
								<li>
									<a href={ctx.href(p.path)}>{p.title}</a>
								</li>
							))}
						</ul>
					</section>
				)}
			</>
		);
	},
	Page: ({ ctx, data: { post } }) => (
		<article class="entry entry-single">
			<h1 class="entry-title">{post.title}</h1>
			<Html class="entry-content" html={post.content_html} />
		</article>
	),
	NotFound: ({ ctx }) => (
		<section class="not-found">
			<h1>404</h1>
			<h2>{ctx.t.notFound}</h2>
			<p>{ctx.t.notFoundText}</p>
			<p>
				<a href="/">← {ctx.t.backHome}</a>
			</p>
		</section>
	),
};
