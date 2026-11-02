const enc = new TextEncoder();

export async function safeEqual(a: string, b: string): Promise<boolean> {
	const [ha, hb] = await Promise.all([
		crypto.subtle.digest("SHA-256", enc.encode(a)),
		crypto.subtle.digest("SHA-256", enc.encode(b)),
	]);
	return crypto.subtle.timingSafeEqual(ha, hb);
}

function base64url(buf: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function sign(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(`edgeblog-session:${secret}`),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return base64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

// 会话密钥由 ADMIN_PASSWORD 派生：改密码即让所有旧会话失效
export async function createSession(secret: string, ttlSeconds: number): Promise<string> {
	const payload = `${Math.floor(Date.now() / 1000) + ttlSeconds}.${crypto.randomUUID()}`;
	return `${payload}.${await sign(secret, payload)}`;
}

export async function verifySession(secret: string, token: string | undefined): Promise<boolean> {
	if (!secret || !token) return false;
	const i = token.lastIndexOf(".");
	if (i <= 0) return false;
	const payload = token.slice(0, i);
	const expires = Number(payload.split(".")[0]);
	if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
	return safeEqual(await sign(secret, payload), token.slice(i + 1));
}
