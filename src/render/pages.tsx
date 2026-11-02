/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";
import type { Common } from "../db/queries";
import type { PostSummary, PostView, Site, Term } from "../db/types";
import { fill } from "../lib/i18n";
import { isoDate, toAbsolute, truncate } from "../lib/util";
import { getTheme } from "../themes";
import { FONT_STACKS } from "../themes/shared";
import type { ArchiveData, ListData, PostData, ThemeContext } from "../themes/types";
import { buildContext } from "./context";
import { type DocumentHead, type MetaLink, type MetaTag, renderDocument } from "./document";

interface HeadInput {
	title: string;
	description?: string;
	canonicalPath: string;
	robots?: string;
	ogType?: string;
	image?: string | null;
	jsonLd?: unknown[];
	links?: MetaLink[];
}

function assembleHead(ctx: ThemeContext, body: string, input: HeadInput): string {
	const site = ctx.site;
	const canonical = ctx.origin + ctx.href(input.canonicalPath);
	const sep = site.settings.title_separator;
	const fullTitle = input.title === site.name ? site.name : `${input.title}${sep}${site.name}`;
	const image = toAbsolute(ctx.origin, input.image ?? undefined);

	const metas: MetaTag[] = [
		{ property: "og:site_name", content: site.name },
		{ property: "og:type", content: input.ogType ?? "website" },
		{ property: "og:title", content: input.title },
		{ property: "og:url", content: canonical },
		{ name: "twitter:card", content: image ? "summary_large_image" : "summary" },
	];
	if (input.description) {
		metas.push({ property: "og:description", content: input.description });
		metas.push({ name: "twitter:description", content: input.description });
	}
	if (image) {
		metas.push({ property: "og:image", content: image });
		metas.push({ name: "twitter:image", content: image });
	}

	const graph: unknown[] = [
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: site.name,
			url: `${ctx.origin}/`,
			inLanguage: site.language,
		},
		...(input.jsonLd ?? []),
	];

	const head: DocumentHead = {
		lang: site.language,
		title: fullTitle,
		description: input.description,
		robots: input.robots,
		canonical,
		metas,
		links: [{ rel: "alternate", type: "application/rss+xml", title: site.name, href: `${ctx.origin}/feed.xml` }, ...(input.links ?? [])],
		jsonLd: graph,
		styleTag: buildCss(ctx),
		headHtml: site.settings.head_html || undefined,
		bodyHtml: body,
		footerHtml: site.settings.footer_html || undefined,
	};
	return renderDocument(head);
}

function buildCss(ctx: ThemeContext): string {
	const theme = getTheme(ctx.site.theme);
	const base = `html{-webkit-text-size-adjust:100%}body{font-family:${FONT_STACKS[ctx.site.theme_options.font]}}`;
	return base + theme.css(ctx.site.theme_options) + (ctx.site.theme_options.custom_css || "");
}

function toHtml(node: Child): string {
	// 组件树全部同步（无 Suspense / async 组件），JSXNode.toString() 同步返回字符串
	const out = (node as { toString(): string | Promise<string> }).toString();
	if (typeof out !== "string") throw new Error("Unexpected async render in SSR tree");
	return out;
}

function postDescription(post: PostView): string {
	return post.meta_description || post.excerpt || "";
}

function articleJsonLd(ctx: ThemeContext, post: PostView): unknown {
	const author = post.author_name || ctx.site.settings.author_name || ctx.site.name;
	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: truncate(post.title, 110),
		datePublished: isoDate(post.published_at),
		dateModified: isoDate(post.updated_at),
		author: { "@type": "Person", name: author },
		publisher: { "@type": "Organization", name: ctx.site.name },
		mainEntityOfPage: ctx.origin + ctx.href(post.path),
		...(post.cover_image ? { image: toAbsolute(ctx.origin, post.cover_image) } : {}),
		...(postDescription(post) ? { description: postDescription(post) } : {}),
		inLanguage: ctx.site.language,
	};
}

function breadcrumb(ctx: ThemeContext, trail: { name: string; path: string }[]): unknown {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: trail.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: ctx.origin + ctx.href(item.path),
		})),
	};
}

function paginationLinks(ctx: ThemeContext, data: ListData): MetaLink[] {
	const links: MetaLink[] = [];
	const page = (n: number) => ctx.origin + ctx.href(n <= 1 ? data.baseHref : `${data.baseHref}page/${n}/`);
	if (data.page > 1) links.push({ rel: "prev", href: page(data.page - 1) });
	if (data.page < data.totalPages) links.push({ rel: "next", href: page(data.page + 1) });
	return links;
}

const Shell = ({ ctx, children }: { ctx: ThemeContext; children: Child }) => {
	const Theme = getTheme(ctx.site.theme);
	return <Theme.Shell ctx={ctx}>{children}</Theme.Shell>;
};

export interface RenderInput {
	site: Site;
	origin: string;
	common: Common;
}

export function renderHome(input: RenderInput, data: ListData): string {
	const ctx = buildContext({ ...input, view: "home" });
	const Theme = getTheme(ctx.site.theme);
	const body = toHtml(
		<Shell ctx={ctx}>
			<Theme.Home ctx={ctx} data={data} />
		</Shell>,
	);
	const title = data.page > 1 ? `${ctx.site.name} - ${fill(ctx.t.pageN, { n: data.page })}` : ctx.site.name;
	return assembleHead(ctx, body, {
		title: data.page > 1 ? title : ctx.site.name,
		description: ctx.site.tagline || truncate(ctx.site.name, 150),
		canonicalPath: data.page > 1 ? `/page/${data.page}/` : "/",
		robots: data.page > 1 ? "noindex, follow" : undefined,
		links: paginationLinks(ctx, data),
	});
}

export function renderArchive(input: RenderInput, data: ArchiveData): string {
	const view = "archive";
	const ctx = buildContext({ ...input, view });
	const Theme = getTheme(ctx.site.theme);
	const body = toHtml(
		<Shell ctx={ctx}>
			<Theme.Archive ctx={ctx} data={data} />
		</Shell>,
	);
	const noindexTag = data.kind === "tag" && ctx.site.settings.noindex_tags;
	const label = data.kind === "category" ? ctx.t.category : ctx.t.tag;
	return assembleHead(ctx, body, {
		title: data.page > 1 ? `${data.term.name} - ${fill(ctx.t.pageN, { n: data.page })}` : data.term.name,
		description: data.term.description || `${label}: ${data.term.name}`,
		canonicalPath: data.page > 1 ? `${data.baseHref}page/${data.page}/` : data.baseHref,
		robots: noindexTag || data.page > 1 ? "noindex, follow" : undefined,
		jsonLd: [breadcrumb(ctx, [{ name: ctx.t.home, path: "/" }, { name: data.term.name, path: data.baseHref }])],
		links: paginationLinks(ctx, data),
	});
}

export function renderPost(input: RenderInput, data: PostData): string {
	const ctx = buildContext({ ...input, view: "post" });
	const Theme = getTheme(ctx.site.theme);
	const body = toHtml(
		<Shell ctx={ctx}>
			<Theme.Post ctx={ctx} data={data} />
		</Shell>,
	);
	const trail = [{ name: ctx.t.home, path: "/" }];
	if (data.post.category_slug) trail.push({ name: data.post.category_name ?? "", path: ctx.catHref(data.post.category_slug) });
	trail.push({ name: data.post.title, path: data.post.path });
	return assembleHead(ctx, body, {
		title: data.post.meta_title || data.post.title,
		description: postDescription(data.post),
		canonicalPath: data.post.path,
		ogType: "article",
		image: data.post.cover_image,
		robots: data.post.noindex ? "noindex, follow" : undefined,
		jsonLd: [articleJsonLd(ctx, data.post), breadcrumb(ctx, trail)],
	});
}

export function renderPage(input: RenderInput, post: PostView): string {
	const ctx = buildContext({ ...input, view: "page" });
	const Theme = getTheme(ctx.site.theme);
	const body = toHtml(
		<Shell ctx={ctx}>
			<Theme.Page ctx={ctx} data={{ post }} />
		</Shell>,
	);
	return assembleHead(ctx, body, {
		title: post.meta_title || post.title,
		description: postDescription(post),
		canonicalPath: post.path,
		image: post.cover_image,
		robots: post.noindex ? "noindex, follow" : undefined,
		jsonLd: [breadcrumb(ctx, [{ name: ctx.t.home, path: "/" }, { name: post.title, path: post.path }])],
	});
}

export function renderNotFound(input: RenderInput): string {
	const ctx = buildContext({ ...input, view: "404" });
	const Theme = getTheme(ctx.site.theme);
	const body = toHtml(
		<Shell ctx={ctx}>
			<Theme.NotFound ctx={ctx} />
		</Shell>,
	);
	return assembleHead(ctx, body, {
		title: ctx.t.notFound,
		description: ctx.t.notFoundText,
		canonicalPath: "/404",
		robots: "noindex, follow",
	});
}

export function listData(posts: PostSummary[], page: number, totalPages: number, baseHref: string): ListData {
	return { posts, page, totalPages, baseHref };
}

export function archiveData(
	kind: "category" | "tag",
	term: Term,
	posts: PostSummary[],
	page: number,
	totalPages: number,
	baseHref: string,
): ArchiveData {
	return { kind, term, posts, page, totalPages, baseHref };
}
