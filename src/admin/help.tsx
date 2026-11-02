/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./ui";

const Code: FC<{ children: string }> = ({ children }) => (
	<pre style="background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.6;margin:0 0 18px">
		<code>{children}</code>
	</pre>
);

export const HelpPage: FC<{ origin: string }> = ({ origin }) => (
	<Layout title="API" active="help" narrow>
		<h1>JSON API</h1>
		<p class="sub">Automate PBN publishing. Authenticate every request with the API token.</p>

		<div class="card">
			<h2>Auth</h2>
			<p>
				Send the bearer token in the <span class="mono">Authorization</span> header. The token is the{" "}
				<span class="mono">API_TOKEN</span> secret.
			</p>
			<Code>{`Authorization: Bearer <API_TOKEN>`}</Code>
			<p class="muted" style="font-size:13px">
				Base URL: <span class="mono">{origin}/api</span> (any domain bound to this Worker, incl. *.workers.dev)
			</p>
		</div>

		<div class="card">
			<h2>Create a site</h2>
			<Code>{`curl -X POST ${origin}/api/sites \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Blog",
    "primary_domain": "example.com",
    "domains": ["www.example.com"],
    "language": "en",
    "timezone": "UTC"
  }'`}</Code>
			<p class="muted" style="font-size:13px">
				Theme, accent color, font and layout are randomized when omitted — handy for keeping a network visually diverse.
			</p>
		</div>

		<div class="card">
			<h2>Publish posts in bulk</h2>
			<p>Up to 100 per call. Each item succeeds or fails independently.</p>
			<Code>{`curl -X POST ${origin}/api/sites/1/posts/bulk \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "posts": [
    {
      "title": "First Post",
      "content": "# Hello\\n\\nMarkdown body with a [link](https://money-site.com/).",
      "category": "Guides",
      "tags": ["intro", "seo"],
      "cover_image": "/uploads/hero.jpg"
    },
    { "title": "Second Post", "content": "More content", "status": "draft" }
  ] }'`}</Code>
		</div>

		<div class="card">
			<h2>Endpoints</h2>
			<table>
				<tbody>
					<tr><td class="mono">GET</td><td class="mono">/api/sites</td><td>List sites</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites</td><td>Create site</td></tr>
					<tr><td class="mono">PATCH</td><td class="mono">/api/sites/:id</td><td>Update site / settings</td></tr>
					<tr><td class="mono">DELETE</td><td class="mono">/api/sites/:id</td><td>Delete site</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites/:id/purge</td><td>Purge edge cache</td></tr>
					<tr><td class="mono">GET</td><td class="mono">/api/sites/:id/posts</td><td>List posts (status, type, page)</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites/:id/posts</td><td>Create one post</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites/:id/posts/bulk</td><td>Create many posts</td></tr>
					<tr><td class="mono">PATCH</td><td class="mono">/api/sites/:id/posts/:pid</td><td>Update post</td></tr>
					<tr><td class="mono">DELETE</td><td class="mono">/api/sites/:id/posts/:pid</td><td>Delete post</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites/:id/media</td><td>Upload image (multipart or raw body)</td></tr>
					<tr><td class="mono">POST</td><td class="mono">/api/sites/:id/redirects</td><td>Add redirect</td></tr>
				</tbody>
			</table>
		</div>

		<div class="card">
			<h2>Post fields</h2>
			<p class="mono" style="font-size:13px;line-height:2">
				title* · content · content_format (markdown|html) · status (published|draft) · type (post|page) · slug · path ·
				excerpt · category · tags[] · cover_image · author_name · meta_title · meta_description · canonical_url · noindex ·
				published_at (ISO or epoch)
			</p>
		</div>
	</Layout>
);
