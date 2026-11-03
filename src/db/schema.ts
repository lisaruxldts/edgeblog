// 迁移内置在代码里：部署到任意账号后，首次访问后台 / API / 定时任务时自动建表。
// 只能在末尾追加新迁移，不要修改已发布的条目。
const MIGRATIONS: string[][] = [
	[
		`CREATE TABLE IF NOT EXISTS sites (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			tagline TEXT NOT NULL DEFAULT '',
			primary_domain TEXT NOT NULL UNIQUE,
			language TEXT NOT NULL DEFAULT 'en',
			timezone TEXT NOT NULL DEFAULT 'UTC',
			theme TEXT NOT NULL DEFAULT 'classic',
			theme_options TEXT NOT NULL DEFAULT '{}',
			settings TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'active',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS domains (
			hostname TEXT PRIMARY KEY,
			site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_domains_site ON domains(site_id)`,
		`CREATE TABLE IF NOT EXISTS terms (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
			taxonomy TEXT NOT NULL,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			UNIQUE (site_id, taxonomy, slug)
		)`,
		`CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
			type TEXT NOT NULL DEFAULT 'post',
			status TEXT NOT NULL DEFAULT 'draft',
			title TEXT NOT NULL,
			slug TEXT NOT NULL,
			path TEXT NOT NULL,
			path_custom INTEGER NOT NULL DEFAULT 0,
			excerpt TEXT NOT NULL DEFAULT '',
			summary TEXT NOT NULL DEFAULT '',
			content TEXT NOT NULL DEFAULT '',
			content_format TEXT NOT NULL DEFAULT 'markdown',
			content_html TEXT NOT NULL DEFAULT '',
			cover_image TEXT,
			category_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
			author_name TEXT,
			meta_title TEXT,
			meta_description TEXT,
			canonical_url TEXT,
			noindex INTEGER NOT NULL DEFAULT 0,
			published_at INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			UNIQUE (site_id, path)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_list ON posts(site_id, type, status, published_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id, published_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_due ON posts(status, published_at)`,
		`CREATE TABLE IF NOT EXISTS post_tags (
			post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
			PRIMARY KEY (post_id, term_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_post_tags_term ON post_tags(term_id)`,
		`CREATE TABLE IF NOT EXISTS redirects (
			site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
			from_path TEXT NOT NULL,
			to_url TEXT NOT NULL,
			status_code INTEGER NOT NULL DEFAULT 301,
			PRIMARY KEY (site_id, from_path)
		)`,
		`CREATE TABLE IF NOT EXISTS media (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
			path TEXT NOT NULL,
			filename TEXT NOT NULL,
			content_type TEXT NOT NULL,
			size INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			UNIQUE (site_id, path)
		)`,
		`CREATE TABLE IF NOT EXISTS purge_queue (
			tag TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL
		)`,
	],
	// v2：重定向来源统一去掉尾斜杠，与 redirectKey 一致；规范化后撞键的旧行以已存在的无斜杠版本为准
	[
		`UPDATE OR IGNORE redirects SET from_path = rtrim(from_path, '/') WHERE from_path <> '/' AND from_path LIKE '%/'`,
		`DELETE FROM redirects WHERE from_path <> '/' AND from_path LIKE '%/'`,
	],
	// v3：media 记录像素宽高（上传时从文件头读出），渲染时给 <img> 补 width/height
	[`ALTER TABLE media ADD COLUMN width INTEGER`, `ALTER TABLE media ADD COLUMN height INTEGER`],
];

let schemaReady = false;

export async function ensureSchema(db: D1Database): Promise<void> {
	if (schemaReady) return;
	await db.prepare(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
	const row = await db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).first<{ value: string }>();
	for (let version = row ? Number(row.value) : 0; version < MIGRATIONS.length; version++) {
		await db.batch([
			...MIGRATIONS[version].map((sql) => db.prepare(sql)),
			db
				.prepare(`INSERT INTO _meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
				.bind(String(version + 1)),
		]);
	}
	schemaReady = true;
}

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
	const row = await db.prepare(`SELECT value FROM _meta WHERE key = ?`).bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

export async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
	await db
		.prepare(`INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
		.bind(key, value)
		.run();
}
