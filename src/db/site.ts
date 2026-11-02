import { safeJson, slugify } from "../lib/util";
import type { Site, SiteRow, SiteSettings, ThemeOptions } from "./types";

export const DEFAULT_SETTINGS: SiteSettings = {
	posts_per_page: 10,
	permalink: "/%slug%/",
	category_base: "category",
	tag_base: "tag",
	title_separator: " - ",
	author_name: "",
	author_bio: "",
	nav_links: "",
	head_html: "",
	footer_html: "",
	robots_txt: "",
	noindex_tags: true,
};

export const DEFAULT_THEME_OPTIONS: ThemeOptions = {
	accent: "#2563eb",
	font: "sans",
	layout: "",
	custom_css: "",
};

const RESERVED_BASES = new Set(["page", "uploads", "feed", "admin"]);

export const toBool = (v: unknown): boolean => v === true || v === 1 || /^(1|true|on|yes)$/i.test(String(v ?? ""));

export function normalizeSettings(input: Record<string, unknown>, base: SiteSettings = DEFAULT_SETTINGS): SiteSettings {
	const str = (key: keyof SiteSettings): string => (typeof input[key] === "string" ? (input[key] as string) : String(base[key]));
	const base_ = (key: "category_base" | "tag_base"): string => {
		const v = slugify(str(key));
		return v && !RESERVED_BASES.has(v) ? v : DEFAULT_SETTINGS[key];
	};

	const perPage = Number(input.posts_per_page ?? base.posts_per_page);
	let permalink = str("permalink").trim();
	if (!permalink.includes("%slug%")) permalink = base.permalink;
	if (!permalink.startsWith("/")) permalink = `/${permalink}`;

	const category_base = base_("category_base");
	let tag_base = base_("tag_base");
	if (tag_base === category_base) tag_base = category_base === "tag" ? "topic" : "tag";

	return {
		posts_per_page: Number.isFinite(perPage) ? Math.min(50, Math.max(1, Math.round(perPage))) : base.posts_per_page,
		permalink,
		category_base,
		tag_base,
		title_separator: str("title_separator") || DEFAULT_SETTINGS.title_separator,
		author_name: str("author_name").trim(),
		author_bio: str("author_bio").trim(),
		nav_links: str("nav_links"),
		head_html: str("head_html"),
		footer_html: str("footer_html"),
		robots_txt: str("robots_txt"),
		noindex_tags: input.noindex_tags === undefined ? base.noindex_tags : toBool(input.noindex_tags),
	};
}

export function normalizeThemeOptions(input: Record<string, unknown>, base: ThemeOptions = DEFAULT_THEME_OPTIONS): ThemeOptions {
	const accent = typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent.toLowerCase() : base.accent;
	const font = input.font === "sans" || input.font === "serif" || input.font === "mono" ? input.font : base.font;
	return {
		accent,
		font,
		layout: typeof input.layout === "string" ? input.layout : base.layout,
		custom_css: typeof input.custom_css === "string" ? input.custom_css : base.custom_css,
	};
}

export function parseSite(row: SiteRow): Site {
	return {
		...row,
		settings: normalizeSettings(safeJson(row.settings)),
		theme_options: normalizeThemeOptions(safeJson(row.theme_options)),
	};
}

export const siteTag = (siteId: number): string => `s${siteId}`;
export const mediaTag = (siteId: number): string => `m${siteId}`;
export const hostTag = (host: string): string => `h-${host}`;
