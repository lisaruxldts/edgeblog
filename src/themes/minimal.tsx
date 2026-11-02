/** @jsxImportSource hono/jsx */
import type { PostSummary, ThemeOptions } from "../db/types";
import { FONT_STACKS, Html, Time, pageHref } from "./shared";
import type { ListData, Theme, ThemeContext } from "./types";

const css = (o: ThemeOptions) => `
:root{--hl:${o.accent};--fg:#222;--dim:#777;--hair:#e8e8e8;--f:${FONT_STACKS[o.font]}}
*{box-sizing:border-box}
body{margin:0;color:var(--fg);background:#fffefc;font:18px/1.7 var(--f)}
a{color:var(--fg);text-decoration:underline;text-decoration-color:var(--hl);text-underline-offset:3px}
a:hover{color:var(--hl)}
img{max-width:100%;height:auto}
.wrap{max-width:680px;margin:0 auto;padding:48px 24px 72px}
.wide .wrap{max-width:820px}
.top{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:56px}
.brand{margin:0;font-size:20px;font-weight:700}
.brand a{text-decoration:none}
.links{font-size:15px;color:var(--dim)}
.links a{text-decoration:none;color:var(--dim)}
.links a:hover{color:var(--hl)}
.links a+a::before{content:"/";margin:0 10px;color:var(--hair)}
.intro{margin:0 0 48px;font-size:20px;color:#444}
.year{font-size:14px;font-weight:400;color:var(--dim);margin:40px 0 8px;letter-spacing:.05em}
.list{list-style:none;margin:0;padding:0}
.list li{display:flex;gap:18px;padding:7px 0;align-items:baseline}
.list time{flex:0 0 72px;color:var(--dim);font-size:14px;font-variant-numeric:tabular-nums}
.list a{text-decoration:none}
.list a:hover{text-decoration:underline}
.pager{display:flex;justify-content:space-between;margin-top:48px;font-size:15px}
.kicker{font-size:14px;color:var(--dim);margin:0 0 6px}
.post h1,.head h1{font-size:34px;line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}
.meta{color:var(--dim);font-size:15px;margin:0 0 36px}
.meta a{color:var(--dim)}
.body h2{font-size:24px;margin:2em 0 .5em}
.body h3{font-size:20px;margin:1.6em 0 .4em}
.body blockquote{margin:1.5em 0;padding-left:18px;border-left:2px solid var(--hl);color:#555}
.body pre{background:#f4f3ef;padding:16px;overflow:auto;font-size:14px;border-radius:2px}
.body code{font-size:.85em}
.body table{width:100%;border-collapse:collapse;font-size:16px}
.body th,.body td{border-bottom:1px solid var(--hair);padding:6px 8px;text-align:left}
.body hr{border:0;border-top:1px solid var(--hair);margin:2.5em 0}
.cover{margin:0 0 32px}
.tags{margin-top:40px;font-size:15px;color:var(--dim)}
.tags a{margin-right:12px;color:var(--dim)}
.more{margin-top:56px;padding-top:24px;border-top:1px solid var(--hair)}
.more h2{font-size:15px;font-weight:400;color:var(--dim);margin:0 0 10px}
.bottom{margin-top:80px;padding-top:20px;border-top:1px solid var(--hair);font-size:14px;color:var(--dim);display:flex;flex-wrap:wrap;gap:6px 18px}
.bottom a{color:var(--dim)}
@media (max-width:560px){body{font-size:17px}.wrap{padding-top:28px}.list li{flex-direction:column;gap:0}.list time{flex:none}}
`;

function groupByYear(ctx: ThemeContext, posts: PostSummary[]): [string, PostSummary[]][] {
	const groups = new Map<string, PostSummary[]>();
	for (const p of posts) {
		const y = ctx.yearOf(p.published_at);
		groups.set(y, [...(groups.get(y) ?? []), p]);
	}
	return [...groups];
}

const Listing = ({ ctx, data }: { ctx: ThemeContext; data: ListData }) => (
	<>
		{data.posts.length === 0 && <p class="meta">{ctx.t.noPosts}</p>}
		{groupByYear(ctx, data.posts).map(([year, posts]) => (
			<section>
				<h2 class="year">{year}</h2>
				<ul class="list">
					{posts.map((p) => (
						<li>
							<Time ts={p.published_at} label={ctx.dateShort(p.published_at)} />
							<a href={ctx.href(p.path)}>{p.title}</a>
						</li>
					))}
				</ul>
			</section>
		))}
		{data.totalPages > 1 && (
			<nav class="pager">
				{data.page > 1 ? <a href={pageHref(data.baseHref, data.page - 1)}>← {ctx.t.newer}</a> : <span />}
				{data.page < data.totalPages ? <a href={pageHref(data.baseHref, data.page + 1)}>{ctx.t.older} →</a> : <span />}
			</nav>
		)}
	</>
);

export const minimal: Theme = {
	id: "minimal",
	name: "Minimal（极简单栏）",
	layouts: ["narrow", "wide"],
	css,
	Shell: ({ ctx, children }) => (
		<div class={ctx.site.theme_options.layout === "wide" ? "wide" : undefined}>
			<div class="wrap">
				<header class="top">
					{ctx.view === "home" ? (
						<h1 class="brand">
							<a href="/">{ctx.site.name}</a>
						</h1>
					) : (
						<div class="brand">
							<a href="/">{ctx.site.name}</a>
						</div>
					)}
					<nav class="links">
						{ctx.nav.map((n) => (
							<a href={n.href}>{n.label}</a>
						))}
					</nav>
				</header>
				<main>{children}</main>
				<footer class="bottom">
					<span>
						© {ctx.currentYear} {ctx.site.name}
					</span>
					{ctx.pages.map((p) => (
						<a href={ctx.href(p.path)}>{p.title}</a>
					))}
				</footer>
			</div>
		</div>
	),
	Home: ({ ctx, data }) => (
		<>
			{data.page === 1 && ctx.site.tagline && <p class="intro">{ctx.site.tagline}</p>}
			<Listing ctx={ctx} data={data} />
		</>
	),
	Archive: ({ ctx, data }) => (
		<>
			<header class="head">
				<p class="kicker">{data.kind === "category" ? ctx.t.category : ctx.t.tag}</p>
				<h1>{data.term.name}</h1>
				{data.term.description && <p class="meta">{data.term.description}</p>}
			</header>
			<Listing ctx={ctx} data={data} />
		</>
	),
	Post: ({ ctx, data: { post, tags, related } }) => (
		<>
			<article class="post">
				<h1>{post.title}</h1>
				<p class="meta">
					<Time ts={post.published_at} label={ctx.date(post.published_at)} />
					{post.category_slug && (
						<>
							{" · "}
							<a href={ctx.catHref(post.category_slug)}>{post.category_name}</a>
						</>
					)}
				</p>
				{post.cover_image && <img class="cover" src={post.cover_image} alt={post.title} />}
				<Html class="body" html={post.content_html} />
				{tags.length > 0 && (
					<p class="tags">
						{tags.map((t) => (
							<a href={ctx.tagHref(t.slug)}>#{t.name}</a>
						))}
					</p>
				)}
			</article>
			{related.length > 0 && (
				<aside class="more">
					<h2>{ctx.t.related}</h2>
					<ul class="list">
						{related.map((p) => (
							<li>
								<Time ts={p.published_at} label={ctx.dateShort(p.published_at)} />
								<a href={ctx.href(p.path)}>{p.title}</a>
							</li>
						))}
					</ul>
				</aside>
			)}
		</>
	),
	Page: ({ data: { post } }) => (
		<article class="post">
			<h1>{post.title}</h1>
			<Html class="body" html={post.content_html} />
		</article>
	),
	NotFound: ({ ctx }) => (
		<article class="post">
			<p class="kicker">404</p>
			<h1>{ctx.t.notFound}</h1>
			<p class="meta">{ctx.t.notFoundText}</p>
			<p>
				<a href="/">← {ctx.t.backHome}</a>
			</p>
		</article>
	),
};
