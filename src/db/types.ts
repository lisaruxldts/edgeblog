export type PostType = "post" | "page";
export type PostStatus = "draft" | "published";
export type ContentFormat = "markdown" | "html";
export type FontChoice = "sans" | "serif" | "mono";

export interface SiteSettings {
	posts_per_page: number;
	permalink: string;
	category_base: string;
	tag_base: string;
	title_separator: string;
	author_name: string;
	author_bio: string;
	nav_links: string;
	head_html: string;
	footer_html: string;
	robots_txt: string;
	noindex_tags: boolean;
}

export interface ThemeOptions {
	accent: string;
	font: FontChoice;
	layout: string;
	custom_css: string;
}

export interface SiteRow {
	id: number;
	name: string;
	tagline: string;
	primary_domain: string;
	language: string;
	timezone: string;
	theme: string;
	theme_options: string;
	settings: string;
	status: string;
	created_at: number;
	updated_at: number;
}

export interface Site extends Omit<SiteRow, "theme_options" | "settings"> {
	theme_options: ThemeOptions;
	settings: SiteSettings;
}

export interface PostRow {
	id: number;
	site_id: number;
	type: PostType;
	status: PostStatus;
	title: string;
	slug: string;
	path: string;
	path_custom: number;
	excerpt: string;
	summary: string;
	content: string;
	content_format: ContentFormat;
	content_html: string;
	cover_image: string | null;
	category_id: number | null;
	author_name: string | null;
	meta_title: string | null;
	meta_description: string | null;
	canonical_url: string | null;
	noindex: number;
	published_at: number | null;
	created_at: number;
	updated_at: number;
}

export interface PostSummary {
	id: number;
	title: string;
	path: string;
	excerpt: string;
	cover_image: string | null;
	author_name: string | null;
	published_at: number;
	updated_at: number;
	category_name: string | null;
	category_slug: string | null;
}

export interface PostView extends PostSummary {
	type: PostType;
	content_html: string;
	meta_title: string | null;
	meta_description: string | null;
	canonical_url: string | null;
	noindex: number;
	category_id: number | null;
}

export interface Term {
	id: number;
	name: string;
	slug: string;
	description: string;
	count?: number;
}

export interface RedirectRow {
	from_path: string;
	to_url: string;
	status_code: number;
}

export interface MediaRow {
	id: number;
	site_id: number;
	path: string;
	filename: string;
	content_type: string;
	size: number;
	created_at: number;
}
