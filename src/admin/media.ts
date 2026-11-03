import { mediaTag, siteTag } from "../db/site";
import type { MediaRow } from "../db/types";
import { imageSize } from "../lib/imagesize";
import { HttpError, now, slugify } from "../lib/util";
import type { Ctx } from "./service";

const EXT: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
	"image/svg+xml": "svg",
};

const MAX_BYTES = 15 * 1024 * 1024;

export async function listMedia(db: D1Database, siteId: number): Promise<MediaRow[]> {
	const rows = await db
		.prepare(`SELECT * FROM media WHERE site_id = ? ORDER BY created_at DESC LIMIT 200`)
		.bind(siteId)
		.all<MediaRow>();
	return rows.results;
}

export async function uploadMedia(
	ctx: Ctx,
	bucket: R2Bucket,
	siteId: number,
	filename: string,
	contentType: string,
	body: ArrayBuffer,
): Promise<MediaRow> {
	const ext = EXT[contentType];
	if (!ext) throw new HttpError(415, `unsupported media type: ${contentType}`);
	if (body.byteLength === 0) throw new HttpError(400, "empty file");
	if (body.byteLength > MAX_BYTES) throw new HttpError(413, "file too large (max 15MB)");

	const ts = now();
	const stem = slugify(filename.replace(/\.[^.]+$/, "")) || "file";
	const rand = crypto.randomUUID().slice(0, 8);
	const path = `/uploads/${ts}-${stem}-${rand}.${ext}`;
	const key = `${siteId}${path}`;

	await bucket.put(key, body, {
		httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
	});
	const dims = imageSize(body);
	const row = await ctx.db
		.prepare(`INSERT INTO media (site_id, path, filename, content_type, size, width, height, created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING *`)
		.bind(siteId, path, filename.slice(0, 200), contentType, body.byteLength, dims?.width ?? null, dims?.height ?? null, ts)
		.first<MediaRow>();
	await ctx.purge({ tags: [mediaTag(siteId)] });
	return row as MediaRow;
}

export async function deleteMedia(ctx: Ctx, bucket: R2Bucket, siteId: number, path: string): Promise<void> {
	const row = await ctx.db.prepare(`SELECT path FROM media WHERE site_id = ? AND path = ?`).bind(siteId, path).first<{ path: string }>();
	if (!row) throw new HttpError(404, "media not found");
	await bucket.delete(`${siteId}${path}`);
	await ctx.db.prepare(`DELETE FROM media WHERE site_id = ? AND path = ?`).bind(siteId, path).run();
	await ctx.purge({ tags: [siteTag(siteId), mediaTag(siteId)] });
}
