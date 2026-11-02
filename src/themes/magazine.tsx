/** @jsxImportSource hono/jsx */
import type { PostSummary, ThemeOptions } from "../db/types";
import { FONT_STACKS, Html, Time, initial, pageHref, pageWindow } from "./shared";
import type { ListData, Theme, ThemeContext } from "./types";

const css = (o: ThemeOptions) => `
:root{--c:${o.accent};--ink:#14171a;--sub:#6b7280;--rule:#ececec;--paper:#fafafa;--ff:${FONT_STACKS[o.font]}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--ff)}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
.mg-wrap{max-width:1240px;margin:0 auto;padding:0 24px}
.mg-topline{height:4px;background:var(--c)}
.mg-header{background:#fff;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:5}
.mg-header-inner{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:68px;flex-wrap:wrap}
.mg-logo{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;text-transform:uppercase}
.mg-logo span{color:var(--c)}
.mg-nav{display:flex;flex-wrap:wrap;gap:4px}
.mg-nav a{padding:8px 12px;font-size:14px;font-weight:600;border-radius:999px}
.mg-nav a:hover{background:var(--paper);color:var(--c)}
.mg-main{padding:36px 0 64px}
.mg-hero{display:grid;grid-template-columns:1.35fr 1fr;background:#fff;border:1px solid var(--rule);border-radius:14px;overflow:hidden;margin-bottom:40px}
.mg-hero .mg-thumb{aspect-ratio:auto;min-height:340px}
.mg-hero-body{padding:36px;display:flex;flex-direction:column;justify-content:center}
.mg-hero-body h2{font-size:34px;line-height:1.2;margin:10px 0 14px;letter-spacing:-.01em}
.mg-hero-body p{color:var(--sub);margin:0 0 18px}
.mg-section-title{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--sub);margin:0 0 18px;display:flex;align-items:center;gap:12px}
.mg-section-title::after{content:"";flex:1;height:1px;background:var(--rule)}
.mg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}
.mg-grid-2 .mg-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-card{background:#fff;border:1px solid var(--rule);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}
.mg-card:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.06)}
.mg-thumb{display:block;aspect-ratio:16/10;background:var(--c);position:relative;overflow:hidden}
.mg-thumb img{width:100%;height:100%;object-fit:cover}
.mg-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:800;color:rgba(255,255,255,.85);background:linear-gradient(135deg,var(--c),#111)}
.mg-card-body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.mg-card-title{font-size:19px;line-height:1.35;margin:0}
.mg-card-title a:hover{color:var(--c)}
.mg-excerpt{color:var(--sub);font-size:15px;margin:0}
.mg-card time,.mg-byline{color:var(--sub);font-size:13px;margin-top:auto}
.mg-badge{align-self:flex-start;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--c)}
.mg-archive-head{background:#fff;border:1px solid var(--rule);border-radius:14px;padding:34px;margin-bottom:34px}
.mg-archive-head small{color:var(--c);font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:12px}
.mg-archive-head h1{margin:6px 0 0;font-size:36px;line-height:1.2}
.mg-archive-head p{margin:10px 0 0;color:var(--sub)}
.mg-pages{display:flex;justify-content:center;gap:8px;margin-top:44px;flex-wrap:wrap}
.mg-pages a,.mg-pages span{min-width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#fff;border:1px solid var(--rule);font-weight:600;font-size:14px;padding:0 10px}
.mg-pages .on{background:var(--c);border-color:var(--c);color:#fff}
.mg-article{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--rule);border-radius:14px;overflow:hidden}
.mg-article-head{padding:44px 48px 24px}
.mg-article-head h1{font-size:40px;line-height:1.18;margin:10px 0 14px;letter-spacing:-.015em}
.mg-hero-img{width:100%;max-height:480px;object-fit:cover}
.mg-body{padding:30px 48px 40px;font-size:18px;line-height:1.8}
.mg-body a{color:var(--c);text-decoration:underline}
.mg-body h2{font-size:27px;line-height:1.3;margin:1.7em 0 .6em}
.mg-body h3{font-size:22px;margin:1.5em 0 .5em}
.mg-body blockquote{margin:1.5em 0;padding:18px 24px;border-radius:10px;background:var(--paper);font-size:19px;font-style:italic}
.mg-body pre{background:#0f1115;color:#e5e7eb;border-radius:10px;padding:18px;overflow:auto;font-size:14px}
.mg-body table{width:100%;border-collapse:collapse;font-size:15px}
.mg-body th,.mg-body td{border-bottom:1px solid var(--rule);padding:10px;text-align:left}
.mg-body img{border-radius:10px;margin:1.4em auto}
.mg-tags{padding:0 48px 40px;display:flex;flex-wrap:wrap;gap:8px}
.mg-tags a{font-size:13px;padding:5px 12px;border-radius:999px;background:var(--paper);border:1px solid var(--rule)}
.mg-tags a:hover{border-color:var(--c);color:var(--c)}
.mg-related{max-width:1240px;margin:56px auto 0}
.mg-empty{background:#fff;border:1px dashed var(--rule);border-radius:14px;padding:60px;text-align:center;color:var(--sub)}
.mg-footer{background:#111418;color:#c9ced6;padding:48px 0 0;font-size:14px}
.mg-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:40px}
.mg-footer strong{color:#fff;font-size:18px}
.mg-footer h3{color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 12px}
.mg-footer ul{list-style:none;margin:0;padding:0}
.mg-footer li{margin-bottom:8px}
.mg-footer a:hover{color:#fff}
.mg-copy{border-top:1px solid #262b31;margin-top:40px;padding:18px 24px;color:#8b93a1}
@media (max-width:960px){.mg-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mg-hero{grid-template-columns:1fr}.mg-hero .mg-thumb{min-height:220px}}
@media (max-width:640px){.mg-grid,.mg-grid-2 .mg-grid{grid-template-columns:1fr}.mg-footer-grid{grid-template-columns:1fr}.mg-article-head,.mg-body{padding-left:22px;padding-right:22px}.mg-tags{padding:0 22px 30px}.mg-article-head h1{font-size:30px}.mg-hero-body{padding:24px}.mg-hero-body h2{font-size:26px}}
`;

const Thumb = ({ ctx, post }: { ctx: ThemeContext; post: PostSummary }) => (
	<a class="mg-thumb" href={ctx.href(post.path)} aria-label={post.title}>
		{post.cover_image ? <img src={post.cover_image} alt={post.title} loading="lazy" /> : <span class="mg-ph">{initial(post.title)}</span>}
	</a>
);

const Badge = ({ ctx, post }: { ctx: ThemeContext; post: PostSummary }) =>
	post.category_slug ? (
		<a class="mg-badge" href={ctx.catHref(post.category_slug)}>
			{post.category_name}
		</a>
	) : null;

const Card = ({ ctx, post }: { ctx: ThemeContext; post: PostSummary }) => (
	<article class="mg-card">
		<Thumb ctx={ctx} post={post} />
		<div class="mg-card-body">
			<Badge ctx={ctx} post={post} />
			<h3 class="mg-card-title">
				<a href={ctx.href(post.path)}>{post.title}</a>
			</h3>
			<p class="mg-excerpt">{post.excerpt}</p>
			<Time ts={post.published_at} label={ctx.date(post.published_at)} />
		</div>
	</article>
);

const Pages = ({ data }: { data: ListData }) =>
	data.totalPages > 1 ? (
		<nav class="mg-pages">
			{pageWindow(data.page, data.totalPages).map((n) =>
				n === null ? (
					<span>…</span>
				) : n === data.page ? (
					<span class="on">{n}</span>
				) : (
					<a href={pageHref(data.baseHref, n)}>{n}</a>
				),
			)}
		</nav>
	) : null;

const Grid = ({ ctx, data, skipFirst }: { ctx: ThemeContext; data: ListData; skipFirst?: boolean }) => {
	const posts = skipFirst ? data.posts.slice(1) : data.posts;
	return (
		<>
			{data.posts.length === 0 && <div class="mg-empty">{ctx.t.noPosts}</div>}
			{posts.length > 0 && (
				<div class="mg-grid">
					{posts.map((p) => (
						<Card ctx={ctx} post={p} />
					))}
				</div>
			)}
			<Pages data={data} />
		</>
	);
};

export const magazine: Theme = {
	id: "magazine",
	name: "Magazine（杂志卡片）",
	layouts: ["grid-3", "grid-2"],
	css,
	Shell: ({ ctx, children }) => {
		const name = ctx.site.name;
		const logo = (
			<a href="/">
				{name.slice(0, -1)}
				<span>{name.slice(-1)}</span>
			</a>
		);
		return (
			<div class={ctx.site.theme_options.layout === "grid-2" ? "mg-grid-2" : undefined}>
				<div class="mg-topline" />
				<header class="mg-header">
					<div class="mg-wrap mg-header-inner">
						{ctx.view === "home" ? <h1 class="mg-logo">{logo}</h1> : <div class="mg-logo">{logo}</div>}
						<nav class="mg-nav">
							{ctx.nav.map((n) => (
								<a href={n.href}>{n.label}</a>
							))}
						</nav>
					</div>
				</header>
				<main class="mg-main">
					<div class="mg-wrap">{children}</div>
				</main>
				<footer class="mg-footer">
					<div class="mg-wrap mg-footer-grid">
						<div>
							<strong>{name}</strong>
							{ctx.site.tagline && <p>{ctx.site.tagline}</p>}
						</div>
						{ctx.categories.length > 0 && (
							<div>
								<h3>{ctx.t.categories}</h3>
								<ul>
									{ctx.categories.slice(0, 8).map((c) => (
										<li>
											<a href={ctx.catHref(c.slug)}>{c.name}</a>
										</li>
									))}
								</ul>
							</div>
						)}
						{ctx.pages.length > 0 && (
							<div>
								<h3>{ctx.t.pages}</h3>
								<ul>
									{ctx.pages.map((p) => (
										<li>
											<a href={ctx.href(p.path)}>{p.title}</a>
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
					<div class="mg-copy">
						© {ctx.currentYear} {name}. {ctx.t.rights}
					</div>
				</footer>
			</div>
		);
	},
	Home: ({ ctx, data }) => {
		const lead = data.page === 1 ? data.posts[0] : undefined;
		return (
			<>
				{lead && (
					<article class="mg-hero">
						<Thumb ctx={ctx} post={lead} />
						<div class="mg-hero-body">
							<Badge ctx={ctx} post={lead} />
							<h2>
								<a href={ctx.href(lead.path)}>{lead.title}</a>
							</h2>
							<p>{lead.excerpt}</p>
							<Time class="mg-byline" ts={lead.published_at} label={ctx.date(lead.published_at)} />
						</div>
					</article>
				)}
				{data.posts.length > 1 && <h2 class="mg-section-title">{ctx.t.latest}</h2>}
				<Grid ctx={ctx} data={data} skipFirst={!!lead} />
			</>
		);
	},
	Archive: ({ ctx, data }) => (
		<>
			<header class="mg-archive-head">
				<small>{data.kind === "category" ? ctx.t.category : ctx.t.tag}</small>
				<h1>{data.term.name}</h1>
				{data.term.description && <p>{data.term.description}</p>}
			</header>
			<Grid ctx={ctx} data={data} />
		</>
	),
	Post: ({ ctx, data: { post, tags, related } }) => {
		const author = post.author_name || ctx.site.settings.author_name;
		return (
			<>
				<article class="mg-article">
					<header class="mg-article-head">
						<Badge ctx={ctx} post={post} />
						<h1>{post.title}</h1>
						<div class="mg-byline">
							{author && `${ctx.t.by} ${author} · `}
							<Time ts={post.published_at} label={ctx.date(post.published_at)} />
						</div>
					</header>
					{post.cover_image && <img class="mg-hero-img" src={post.cover_image} alt={post.title} />}
					<Html class="mg-body" html={post.content_html} />
					{tags.length > 0 && (
						<div class="mg-tags">
							{tags.map((t) => (
								<a href={ctx.tagHref(t.slug)}>#{t.name}</a>
							))}
						</div>
					)}
				</article>
				{related.length > 0 && (
					<section class="mg-related">
						<h2 class="mg-section-title">{ctx.t.related}</h2>
						<div class="mg-grid">
							{related.slice(0, 3).map((p) => (
								<Card ctx={ctx} post={p} />
							))}
						</div>
					</section>
				)}
			</>
		);
	},
	Page: ({ data: { post } }) => (
		<article class="mg-article">
			<header class="mg-article-head">
				<h1>{post.title}</h1>
			</header>
			<Html class="mg-body" html={post.content_html} />
		</article>
	),
	NotFound: ({ ctx }) => (
		<>
			<header class="mg-archive-head">
				<small>404</small>
				<h1>{ctx.t.notFound}</h1>
				<p>
					{ctx.t.notFoundText} <a href="/">{ctx.t.backHome} →</a>
				</p>
			</header>
			{ctx.recent.length > 0 && (
				<div class="mg-grid">
					{ctx.recent.slice(0, 3).map((p) => (
						<Card ctx={ctx} post={p} />
					))}
				</div>
			)}
		</>
	),
};
