import type { ThemeOptions } from "../db/types";
import { pick } from "../lib/util";
import { classic } from "./classic";
import { magazine } from "./magazine";
import { minimal } from "./minimal";
import type { Theme } from "./types";

export const THEMES: Record<string, Theme> = { classic, magazine, minimal };

export const getTheme = (id: string): Theme => THEMES[id] ?? classic;

const ACCENTS = [
	"#2563eb", "#0f766e", "#b91c1c", "#7c3aed", "#c2410c", "#15803d",
	"#0369a1", "#be185d", "#4d7c0f", "#334155", "#9333ea", "#a16207",
	"#0e7490", "#9f1239", "#1d4ed8", "#065f46",
];

// 新站点随机挑主题、配色、字体、布局，避免整批站点长得一样
export function randomTheme(): { theme: string; options: ThemeOptions } {
	const theme = pick(Object.values(THEMES));
	return {
		theme: theme.id,
		options: {
			accent: pick(ACCENTS),
			font: pick(["sans", "sans", "serif", "serif", "mono"] as const),
			layout: pick(theme.layouts),
			custom_css: "",
		},
	};
}
