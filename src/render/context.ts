import type { Common } from "../db/queries";
import type { Site } from "../db/types";
import { getDict } from "../lib/i18n";
import { dateParts, encodePath, formatDate, parseList } from "../lib/util";
import type { NavItem, ThemeContext, View } from "../themes/types";

function buildNav(site: Site, common: Common, t: ReturnType<typeof getDict>): NavItem[] {
	const items: NavItem[] = [{ label: t.home, href: "/" }];
	for (const raw of parseList(site.settings.nav_links)) {
		const [label, href] = raw.split("|").map((s) => s.trim());
		if (label && href) items.push({ label, href });
	}
	if (items.length === 1) {
		for (const c of common.categories.slice(0, 5)) {
			items.push({ label: c.name, href: `/${site.settings.category_base}/${c.slug}/` });
		}
		for (const p of common.pages.slice(0, 3)) items.push({ label: p.title, href: p.path });
	}
	return items;
}

export function buildContext(args: {
	site: Site;
	origin: string;
	view: View;
	common: Common;
}): ThemeContext {
	const { site, origin, view, common } = args;
	const t = getDict(site.language);
	const dateCache = new Map<number, string>();

	return {
		...common,
		site,
		t,
		origin,
		view,
		nav: buildNav(site, common, t),
		currentYear: Number(dateParts(Math.floor(Date.now() / 1000), site.timezone).year),
		date(ts) {
			let v = dateCache.get(ts);
			if (v === undefined) {
				v = formatDate(ts, site.language, site.timezone);
				dateCache.set(ts, v);
			}
			return v;
		},
		dateShort(ts) {
			const { month, day } = dateParts(ts, site.timezone);
			return `${month}-${day}`;
		},
		yearOf(ts) {
			return dateParts(ts, site.timezone).year;
		},
		href: (path) => encodePath(path),
		catHref: (slug) => `/${site.settings.category_base}/${encodeURIComponent(slug)}/`,
		tagHref: (slug) => `/${site.settings.tag_base}/${encodeURIComponent(slug)}/`,
	};
}
