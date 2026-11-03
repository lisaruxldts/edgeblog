import { renderContent } from "../lib/markdown";
import { now, slugify, stripHtml, truncate } from "../lib/util";
import type { ContentFormat } from "../db/types";

export interface PreparedContent {
	content_html: string;
	summary: string;
	excerpt: string;
}

const SUMMARY_MAX = 160;

// 后台保存时一次性把 Markdown/HTML 渲染成 HTML 存库；前台直接取 content_html，零渲染开销
export function prepareContent(content: string, format: ContentFormat, explicitExcerpt: string): PreparedContent {
	const html = renderContent(content, format);
	const plain = stripHtml(html);
	const excerpt = explicitExcerpt.trim() || truncate(plain, SUMMARY_MAX);
	return { content_html: html, summary: excerpt, excerpt: plain };
}

// 编辑表单回显的摘要。注意 excerpt 列存的是全文纯文本，摘要在 summary 列。
// 自动截取的（以及被旧版表单误存成全文的）都回显为空，保存时按正文重新生成，不会被冻结成手填摘要
export function editableSummary(post: { summary: string; excerpt: string }): string {
	return post.summary === post.excerpt || post.summary === truncate(post.excerpt, SUMMARY_MAX) ? "" : post.summary;
}

const IMG_TAG = /<img\b[^>]*>/gi;
const UPLOAD_SRC = /\ssrc\s*=\s*(["'])(\/uploads\/[^"'?#]+)\1/i;
const HAS_SIZE = /\s(?:width|height)\s*=/i;

// 正文里引用本站上传图片（/uploads/...）且还没写宽高的 <img>
export function uploadedImages(html: string): string[] {
	const paths = new Set<string>();
	for (const tag of html.match(IMG_TAG) ?? []) {
		const src = tag.match(UPLOAD_SRC)?.[2];
		if (src && !HAS_SIZE.test(tag)) paths.add(src);
	}
	return [...paths];
}

export function withImageSizes(html: string, sizes: Map<string, { width: number; height: number }>): string {
	if (sizes.size === 0) return html;
	return html.replace(IMG_TAG, (tag) => {
		const src = tag.match(UPLOAD_SRC)?.[2];
		const size = src && !HAS_SIZE.test(tag) ? sizes.get(src) : undefined;
		return size ? tag.replace(/^<img\b/i, `<img width="${size.width}" height="${size.height}"`) : tag;
	});
}

export function metaDescription(explicit: string, summary: string): string {
	return truncate((explicit.trim() || summary).replace(/\s+/g, " "), 160);
}

export function ensureSlug(slug: string, title: string, fallbackId: number): string {
	const base = slugify(slug) || slugify(title);
	return base || `post-${fallbackId || now()}`;
}
