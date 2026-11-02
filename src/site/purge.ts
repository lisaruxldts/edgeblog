// 清缓存的统一出口。Workers Cache 的 purge 不论套餐一律按免费档限流（每账号 5 次/分钟，桶容量 25），
// 单次最多 100 个 tag；每次调用还要经过 ctx.exports，单个请求最多 32 次。
// 所以一个操作只调一次 purge；失败（限流或调用异常）的 tag 写进 purge_queue，由定时任务重试，不再静默失效。

const MAX_TAGS = 100;

interface Purger {
	purge(options: CachePurgeOptions): Promise<unknown>;
}

async function tryPurge(renderer: Purger, tags: string[]): Promise<CachePurgeResult> {
	try {
		return (await renderer.purge({ tags })) as CachePurgeResult;
	} catch (err) {
		return { success: false, errors: [{ code: 0, message: err instanceof Error ? err.message : String(err) }] };
	}
}

// created_at 用毫秒：出队时只删读到的那一版，期间又被入队的 tag 会留到下一轮
export async function queuePurge(db: D1Database, tags: string[]): Promise<void> {
	const unique = [...new Set(tags)];
	if (unique.length === 0) return;
	const ts = Date.now();
	await db.batch(
		unique.map((tag) =>
			db
				.prepare(`INSERT INTO purge_queue (tag, created_at) VALUES (?, ?) ON CONFLICT(tag) DO UPDATE SET created_at = excluded.created_at`)
				.bind(tag, ts),
		),
	);
}

export async function purgeTags(db: D1Database, renderer: Purger, tags: string[]): Promise<CachePurgeResult> {
	const unique = [...new Set(tags)];
	for (let i = 0; i < unique.length; i += MAX_TAGS) {
		const result = await tryPurge(renderer, unique.slice(i, i + MAX_TAGS));
		if (!result.success) {
			console.error("cache purge failed, queued for retry", result.errors);
			await queuePurge(db, unique.slice(i));
			return result;
		}
	}
	return { success: true, errors: [] };
}

// 定时任务调用：按 100 个一批清掉队列里的 tag，成功才出队；遇到失败就停，等下一轮
export async function flushPurgeQueue(db: D1Database, renderer: Purger): Promise<void> {
	const { results } = await db
		.prepare(`SELECT tag, created_at FROM purge_queue ORDER BY created_at LIMIT ?`)
		.bind(MAX_TAGS * 3)
		.all<{ tag: string; created_at: number }>();
	for (let i = 0; i < results.length; i += MAX_TAGS) {
		const chunk = results.slice(i, i + MAX_TAGS);
		const result = await tryPurge(renderer, chunk.map((r) => r.tag));
		if (!result.success) {
			console.error("queued cache purge failed, retrying next run", result.errors);
			return;
		}
		await db.batch(chunk.map((r) => db.prepare(`DELETE FROM purge_queue WHERE tag = ? AND created_at <= ?`).bind(r.tag, r.created_at)));
	}
}
