import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { safeEqual, verifySession } from "../lib/auth";
import type { Ctx } from "./service";

export const SESSION_COOKIE = "eb_session";
export const SESSION_TTL = 60 * 60 * 24 * 7;

export interface Vars {
	ctx: Ctx;
}

export type Env = {
	Bindings: Cloudflare.Env;
	Variables: Vars;
};

export async function requireBearer(c: Context<Env>): Promise<Response | null> {
	const token = c.env.API_TOKEN;
	const header = c.req.header("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header);
	if (!token || !match || !(await safeEqual(match[1], token))) {
		return c.json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
	}
	return null;
}

export async function hasAdminSession(c: Context<Env>): Promise<boolean> {
	return verifySession(c.env.ADMIN_PASSWORD, getCookie(c, SESSION_COOKIE));
}
