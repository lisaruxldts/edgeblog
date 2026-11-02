export const now = (): number => Math.floor(Date.now() / 1000);

export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export function safeJson(s: string | null | undefined): Record<string, unknown> {
	try {
		const v: unknown = JSON.parse(s ?? "");
		return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

export function safeDecode(path: string): string {
	try {
		return decodeURIComponent(path);
	} catch {
		return path;
	}
}

export const encodePath = (path: string): string => encodeURI(path);

export function flag(value: string | undefined): boolean {
	return /^(1|true|yes|on)$/i.test(value ?? "");
}

export function slugify(input: string, max = 80): string {
	const s = input
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/['’"]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return s.slice(0, max).replace(/-+$/, "");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function stripHtml(html: string): string {
	return html
		.replace(/<(script|style|figure|pre)[\s\S]*?<\/\1>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
			if (e[0] === "#") {
				const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
				return Number.isFinite(code) ? String.fromCodePoint(code) : m;
			}
			return ENTITIES[e.toLowerCase()] ?? m;
		})
		.replace(/\s+/g, " ")
		.trim();
}

export function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const space = cut.lastIndexOf(" ");
	const base = space > max * 0.6 ? cut.slice(0, space) : cut;
	return `${base.replace(/[\s,.;:!?，。；：！？、]+$/u, "")}…`;
}

export const escapeXml = (s: string): string =>
	s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);

export function normalizeHost(input: string): string | null {
	const s = input
		.trim()
		.toLowerCase()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
		.split(/[/?#]/)[0]
		.replace(/\.$/, "");
	if (!s) return null;
	try {
		const host = new URL(`http://${s}`).hostname;
		return /^[a-z0-9.-]+$/.test(host) && (host.includes(".") || host === "localhost") ? host : null;
	} catch {
		return null;
	}
}

export function normalizePath(input: string): string {
	let p = input.trim();
	if (/^https?:\/\//i.test(p)) {
		try {
			p = new URL(p).pathname;
		} catch {
			/* keep as-is */
		}
	}
	p = safeDecode(p.split(/[?#]/)[0]);
	if (!p.startsWith("/")) p = `/${p}`;
	return p.replace(/\/{2,}/g, "/");
}

export function parseTimestamp(v: unknown): number | null {
	if (v === null || v === undefined || v === "") return null;
	if (typeof v === "number") return Number.isFinite(v) ? Math.floor(v > 1e12 ? v / 1000 : v) : null;
	const s = String(v).trim();
	if (/^\d+$/.test(s)) return parseTimestamp(Number(s));
	const t = Date.parse(s);
	return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

export function parseList(v: unknown): string[] {
	const items = Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,，\n]/);
	return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

export function isValidTimezone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export function formatDate(ts: number, lang: string, tz: string): string {
	try {
		return new Intl.DateTimeFormat(lang, { year: "numeric", month: "long", day: "numeric", timeZone: tz }).format(ts * 1000);
	} catch {
		return new Date(ts * 1000).toISOString().slice(0, 10);
	}
}

export const isoDate = (ts: number): string => new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

export function dateParts(ts: number, tz: string): { year: string; month: string; day: string } {
	try {
		const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ts * 1000);
		const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
		return { year: get("year"), month: get("month"), day: get("day") };
	} catch {
		const iso = new Date(ts * 1000).toISOString();
		return { year: iso.slice(0, 4), month: iso.slice(5, 7), day: iso.slice(8, 10) };
	}
}

export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function toAbsolute(origin: string, value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	if (/^https?:\/\//i.test(value)) return value;
	return value.startsWith("/") ? origin + encodePath(value) : value;
}
