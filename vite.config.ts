import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	// 仅本地开发：允许任意 Host，便于用假域名测试多租户渲染（部署不使用该配置）
	server: { allowedHosts: true },
});
