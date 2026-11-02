import type { Child, FC } from "hono/jsx";
import type { Common } from "../db/queries";
import type { PostSummary, PostView, Site, Term, ThemeOptions } from "../db/types";
import type { Dict } from "../lib/i18n";

export type View = "home" | "archive" | "post" | "page" | "404";

export interface NavItem {
	label: string;
	href: string;
}

export interface ThemeContext extends Common {
	site: Site;
	t: Dict;
	origin: string;
	view: View;
	nav: NavItem[];
	currentYear: number;
	date(ts: number): string;
	dateShort(ts: number): string;
	yearOf(ts: number): string;
	href(path: string): string;
	catHref(slug: string): string;
	tagHref(slug: string): string;
}

export interface ListData {
	posts: PostSummary[];
	page: number;
	totalPages: number;
	baseHref: string;
}

export interface ArchiveData extends ListData {
	kind: "category" | "tag";
	term: Term;
}

export interface PostData {
	post: PostView;
	tags: Term[];
	related: PostSummary[];
}

export interface PageData {
	post: PostView;
}

export interface Theme {
	id: string;
	name: string;
	layouts: readonly string[];
	css(options: ThemeOptions): string;
	Shell: FC<{ ctx: ThemeContext; children?: Child }>;
	Home: FC<{ ctx: ThemeContext; data: ListData }>;
	Archive: FC<{ ctx: ThemeContext; data: ArchiveData }>;
	Post: FC<{ ctx: ThemeContext; data: PostData }>;
	Page: FC<{ ctx: ThemeContext; data: PageData }>;
	NotFound: FC<{ ctx: ThemeContext }>;
}
