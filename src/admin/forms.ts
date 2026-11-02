import type { PostInput, SiteInput } from "./service";

type Body = Record<string, string | File>;

const str = (body: Body, key: string): string | undefined => {
	const v = body[key];
	return typeof v === "string" ? v : undefined;
};

const checkbox = (body: Body, key: string): boolean => body[key] === "1" || body[key] === "on";

export function siteInputFromForm(body: Body): SiteInput {
	const theme = str(body, "theme");
	return {
		name: str(body, "name"),
		tagline: str(body, "tagline"),
		primary_domain: str(body, "primary_domain"),
		domains: str(body, "domains") ?? "",
		language: str(body, "language"),
		timezone: str(body, "timezone"),
		theme: theme || undefined,
		status: str(body, "status"),
		theme_options: {
			accent: str(body, "to_accent") ?? "",
			font: str(body, "to_font") ?? "sans",
			layout: str(body, "to_layout") ?? "",
			custom_css: str(body, "to_custom_css") ?? "",
		},
		settings: {
			posts_per_page: str(body, "set_posts_per_page") ?? "10",
			permalink: str(body, "set_permalink") ?? "/%slug%/",
			category_base: str(body, "set_category_base") ?? "category",
			tag_base: str(body, "set_tag_base") ?? "tag",
			title_separator: str(body, "set_title_separator") ?? " - ",
			author_name: str(body, "set_author_name") ?? "",
			author_bio: str(body, "set_author_bio") ?? "",
			nav_links: str(body, "set_nav_links") ?? "",
			head_html: str(body, "set_head_html") ?? "",
			footer_html: str(body, "set_footer_html") ?? "",
			robots_txt: str(body, "set_robots_txt") ?? "",
			noindex_tags: checkbox(body, "set_noindex_tags"),
		},
	};
}

export function postInputFromForm(body: Body): PostInput {
	const published = str(body, "published_at")?.trim();
	return {
		title: str(body, "title"),
		slug: str(body, "slug"),
		content: str(body, "content") ?? "",
		content_format: str(body, "content_format") === "html" ? "html" : "markdown",
		status: str(body, "status") === "draft" ? "draft" : "published",
		type: str(body, "type") === "page" ? "page" : "post",
		excerpt: str(body, "excerpt"),
		category: str(body, "category") ?? "",
		tags: str(body, "tags") ?? "",
		cover_image: str(body, "cover_image") ?? null,
		meta_title: str(body, "meta_title"),
		meta_description: str(body, "meta_description"),
		canonical_url: str(body, "canonical_url"),
		noindex: checkbox(body, "noindex"),
		published_at: published ? published : undefined,
	};
}
