import type { Site } from "../db/types";
import { escapeXml } from "../lib/util";
import { FONT_STACKS, initial } from "../themes/shared";

// 自动生成的站点图标：主题色圆角方块 + 站名首字。Google 搜索结果在站名旁显示它（缺失时是默认的地球图标）；
// SVG 不受「48px 的倍数」尺寸要求限制。颜色和字体跟着各站的主题选项走，站与站之间不会是同一个图标
export function renderFavicon(site: Site): string {
	const accent = site.theme_options.accent;
	const bg = /^#(?:[0-9a-f]{3}){1,2}$/i.test(accent) ? accent : "#2563eb";
	const fg = lightness(bg) > 0.6 ? "#111" : "#fff";
	const font = escapeXml(FONT_STACKS[site.theme_options.font] ?? FONT_STACKS.sans);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="32" dy=".35em" text-anchor="middle" font-family="${font}" font-size="38" font-weight="700" fill="${fg}">${escapeXml(initial(site.name))}</text></svg>`;
}

// 粗略亮度（0–1），只用来在深色底配白字、浅色底配黑字之间选
function lightness(hex: string): number {
	const full = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
