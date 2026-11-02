#!/usr/bin/env node
// PBN 批量发文示例客户端。
// 用法：
//   EDGEBLOG_BASE=https://edgeblog.<account>.workers.dev \
//   EDGEBLOG_TOKEN=<API_TOKEN> \
//   node scripts/publish.mjs ./posts.json [siteId]
//
// posts.json 可以是文章数组，或 { "site": {...}, "posts": [...] }。
// 传了 site 且没传 siteId 时，会先按 site 建站再发文。

import { readFile } from "node:fs/promises";

const BASE = (process.env.EDGEBLOG_BASE || "").replace(/\/$/, "");
const TOKEN = process.env.EDGEBLOG_TOKEN || "";
const [file, siteArg] = process.argv.slice(2);

if (!BASE || !TOKEN || !file) {
	console.error("set EDGEBLOG_BASE, EDGEBLOG_TOKEN and pass a JSON file path");
	process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function api(method, path, body) {
	const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	const data = text ? JSON.parse(text) : {};
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error || text}`);
	return data;
}

const doc = JSON.parse(await readFile(file, "utf8"));
const posts = Array.isArray(doc) ? doc : doc.posts || [];
let siteId = siteArg ? Number(siteArg) : undefined;

if (!siteId && doc.site) {
	const { site } = await api("POST", "/api/sites", doc.site);
	siteId = site.id;
	console.log(`created site #${siteId} (${site.primary_domain}) theme=${site.theme}`);
}
if (!siteId) throw new Error("no siteId: pass one as 2nd arg or include a `site` object");

// 分批发送，单批最多 100 篇
for (let i = 0; i < posts.length; i += 100) {
	const batch = posts.slice(i, i + 100);
	const out = await api("POST", `/api/sites/${siteId}/posts/bulk`, { posts: batch });
	console.log(`batch ${i / 100 + 1}: created ${out.created}, failed ${out.failed}`);
	for (const r of out.results.filter((r) => !r.ok)) console.log(`  ✗ ${r.error}`);
}
console.log("done");
