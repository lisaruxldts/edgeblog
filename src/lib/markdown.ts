import { Marked } from "marked";
import type { ContentFormat } from "../db/types";

const md = new Marked({ gfm: true });

export function renderContent(content: string, format: ContentFormat): string {
	const html = format === "html" ? content : md.parse(content, { async: false });
	return html.replace(/<img (?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async" ');
}
