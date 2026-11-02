import { renderContent } from "../lib/markdown";
import { now, slugify, stripHtml, truncate } from "../lib/util";
import type { ContentFormat } from "../db/types";

export interface PreparedContent {
	content_html: string;
	summary: string;
	excerpt: string;
}

// 后台保存时一次性把 Markdown/HTML 渲染成 HTML 存库；前台直接取 content_html，零渲染开销
export function prepareContent(content: string, format: ContentFormat, explicitExcerpt: string): PreparedContent {
	const html = renderContent(content, format);
	const plain = stripHtml(html);
	const excerpt = explicitExcerpt.trim() || truncate(plain, 160);
	return { content_html: html, summary: excerpt, excerpt: plain };
}

export function metaDescription(explicit: string, summary: string): string {
	return truncate((explicit.trim() || summary).replace(/\s+/g, " "), 160);
}

export function ensureSlug(slug: string, title: string, fallbackId: number): string {
	const base = slugify(slug) || slugify(title);
	return base || `post-${fallbackId || now()}`;
}
