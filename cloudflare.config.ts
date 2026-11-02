import { bindings, defineConfig, exports, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// 站点域名：每个域名必须是当前 Cloudflare 账号里的 zone（apex 和 www 都要单独列出）。
// 部署时会自动创建 Workers Custom Domain 并签发证书；在后台把同样的域名绑定到具体站点即可。
const DOMAINS: string[] = [
	// "example.com",
	// "www.example.com",
];

export default defineConfig({
	worker: {
		name: "edgeblog",
		compatibilityDate: "2026-10-23",
		entrypoint,
		domains: DOMAINS,
		// 后台和 API 默认走 *.workers.dev；若改用自定义后台域名，可关掉它并在 ADMIN_HOSTS 中声明
		workersDev: true,
		observability: {
			enabled: true,
			logs: { enabled: true, invocationLogs: false },
			traces: { enabled: true, headSamplingRate: 0.05 },
		},
		// 只给渲染入口 SiteRenderer 开 Workers Cache（命中时不执行代码）；
		// default 入口不缓存，每次运行：分流后台、拦截爬虫、给缓存键带上主机名。
		exports: {
			SiteRenderer: exports.worker({ cache: { enabled: true } }),
		},
		triggers: [triggers.scheduled({ schedule: "*/10 * * * *" })],
		env: {
			DB: bindings.d1({ name: "edgeblog" }),
			MEDIA: bindings.r2({ name: "edgeblog-media" }),
			// 额外的后台域名，逗号分隔（*.workers.dev 与 localhost 始终可进后台）
			ADMIN_HOSTS: bindings.text(""),
			// 对 Ahrefs / Semrush / Majestic 等 SEO 爬虫直接返回 403
			BLOCK_SEO_BOTS: bindings.text("true"),
			ADMIN_PASSWORD: bindings.secret(),
			API_TOKEN: bindings.secret(),
		},
	},
});
