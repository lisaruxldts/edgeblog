import { escapeXml } from "../lib/util";

export interface MetaLink {
	rel: string;
	href: string;
	hreflang?: string;
	type?: string;
	title?: string;
}

export interface MetaTag {
	property?: string;
	name?: string;
	content: string;
}

export interface DocumentHead {
	lang: string;
	title: string;
	description?: string;
	robots?: string;
	canonical?: string;
	metas: MetaTag[];
	links: MetaLink[];
	jsonLd: unknown[];
	styleTag: string;
	headHtml?: string;
	bodyHtml: string;
	footerHtml?: string;
}

const attr = (v: string): string => escapeXml(v);

function renderMeta(m: MetaTag): string {
	const key = m.property ? `property="${attr(m.property)}"` : `name="${attr(m.name ?? "")}"`;
	return `<meta ${key} content="${attr(m.content)}">`;
}

function renderLink(l: MetaLink): string {
	const parts = [`rel="${attr(l.rel)}"`, `href="${attr(l.href)}"`];
	if (l.hreflang) parts.push(`hreflang="${attr(l.hreflang)}"`);
	if (l.type) parts.push(`type="${attr(l.type)}"`);
	if (l.title) parts.push(`title="${attr(l.title)}"`);
	return `<link ${parts.join(" ")}>`;
}

export function renderDocument(head: DocumentHead): string {
	const parts = [
		"<!doctype html>",
		`<html lang="${attr(head.lang)}">`,
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		`<title>${escapeXml(head.title)}</title>`,
	];
	if (head.description) parts.push(renderMeta({ name: "description", content: head.description }));
	if (head.robots) parts.push(renderMeta({ name: "robots", content: head.robots }));
	if (head.canonical) parts.push(renderLink({ rel: "canonical", href: head.canonical }));
	parts.push(...head.links.map(renderLink));
	parts.push(...head.metas.map(renderMeta));
	for (const block of head.jsonLd) {
		parts.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`);
	}
	parts.push(`<style>${head.styleTag}</style>`);
	if (head.headHtml) parts.push(head.headHtml);
	parts.push("</head>", "<body>", head.bodyHtml);
	if (head.footerHtml) parts.push(head.footerHtml);
	parts.push("</body>", "</html>");
	return parts.join("\n");
}
