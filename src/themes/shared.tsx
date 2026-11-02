/** @jsxImportSource hono/jsx */
import type { FontChoice } from "../db/types";
import { isoDate } from "../lib/util";

export const FONT_STACKS: Record<FontChoice, string> = {
	sans: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`,
	serif: `Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, "Noto Serif", "Songti SC", STSong, serif`,
	mono: `ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace`,
};

export const pageHref = (baseHref: string, n: number): string => (n <= 1 ? baseHref : `${baseHref}page/${n}/`);

export const initial = (text: string): string => (text.trim()[0] ?? "#").toUpperCase();

export const Html = (props: { html: string; class?: string }) => (
	<div class={props.class} dangerouslySetInnerHTML={{ __html: props.html }} />
);

export const Time = (props: { ts: number; label: string; class?: string }) => (
	<time class={props.class} datetime={isoDate(props.ts)}>
		{props.label}
	</time>
);

export function pageWindow(page: number, total: number, radius = 2): (number | null)[] {
	const out: (number | null)[] = [];
	for (let n = 1; n <= total; n++) {
		if (n === 1 || n === total || Math.abs(n - page) <= radius) out.push(n);
		else if (out[out.length - 1] !== null) out.push(null);
	}
	return out;
}
