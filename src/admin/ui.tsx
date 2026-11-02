/** @jsxImportSource hono/jsx */
import type { Child, FC } from "hono/jsx";

export const ADMIN_CSS = `
*{box-sizing:border-box}
:root{--bg:#f3f4f6;--card:#fff;--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--brand:#2563eb;--brand-d:#1d4ed8;--danger:#dc2626;--ok:#059669;--soft:#f9fafb}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.topbar{background:#111827;color:#fff;position:sticky;top:0;z-index:10}
.topbar-in{max-width:1180px;margin:0 auto;padding:0 20px;height:56px;display:flex;align-items:center;gap:22px}
.topbar .logo{font-weight:800;font-size:18px;letter-spacing:-.01em}
.topbar .logo span{color:#60a5fa}
.topbar nav{display:flex;gap:18px;flex:1}
.topbar nav a{color:#cbd5e1;font-size:14px;font-weight:500}
.topbar nav a:hover,.topbar nav a.on{color:#fff;text-decoration:none}
.topbar form{margin:0}
.btn-link{background:none;border:0;color:#cbd5e1;font:inherit;font-size:14px;cursor:pointer;padding:0}
.btn-link:hover{color:#fff}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
.narrow{max-width:760px}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:0 0 14px}
.sub{color:var(--muted);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;margin-bottom:20px}
.card.pad0{padding:0;overflow:hidden}
.grid{display:grid;gap:16px}
.grid.cols-3{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.grid.cols-2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.flash{padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px}
.flash.ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.flash.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
label{display:block;font-weight:600;font-size:13px;margin:0 0 6px;color:#374151}
.hint{font-weight:400;color:var(--muted);font-size:12px}
input[type=text],input[type=password],input[type=url],input[type=number],input[type=datetime-local],select,textarea{
width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:7px;font:inherit;background:#fff;color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:2px solid var(--brand);outline-offset:-1px;border-color:var(--brand)}
textarea{resize:vertical;min-height:120px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.field{margin-bottom:16px}
.row{display:flex;gap:16px;flex-wrap:wrap}
.row>.field{flex:1;min-width:180px}
.check{display:flex;align-items:center;gap:8px;font-weight:500}
.check input{width:auto}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--brand);color:#fff;border:0;border-radius:7px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer}
.btn:hover{background:var(--brand-d);text-decoration:none}
.btn.secondary{background:#fff;color:var(--ink);border:1px solid #d1d5db}
.btn.secondary:hover{background:var(--soft)}
.btn.danger{background:var(--danger)}
.btn.sm{padding:5px 10px;font-size:13px}
.actions{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:middle}
th{background:var(--soft);font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
tr:last-child td{border-bottom:0}
.tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.tag.green{background:#dcfce7;color:#166534}.tag.gray{background:#f3f4f6;color:#4b5563}.tag.blue{background:#dbeafe;color:#1e40af}.tag.amber{background:#fef3c7;color:#92400e}
.muted{color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.stat{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px}
.stat .n{font-size:30px;font-weight:800;line-height:1}
.stat .l{color:var(--muted);font-size:13px}
.breadcrumb{font-size:13px;color:var(--muted);margin-bottom:14px}
.breadcrumb a{color:var(--muted)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.swatch{width:26px;height:26px;border-radius:6px;border:1px solid rgba(0,0,0,.1);display:inline-block;vertical-align:middle}
.empty{text-align:center;padding:48px 20px;color:var(--muted)}
.list-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.pagelink{padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:#fff}
.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.media-item{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
.media-item img{width:100%;height:100px;object-fit:cover;display:block;background:var(--soft)}
.media-item .meta{padding:6px 8px;font-size:11px}
@media(max-width:640px){.topbar nav{gap:12px}.wrap{padding:20px 14px}}
`;

export const Layout: FC<{ title: string; active?: string; children?: Child; narrow?: boolean; flash?: Flash }> = (props) => (
	<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<meta name="robots" content="noindex, nofollow" />
			<title>{props.title} · EdgeBlog Admin</title>
			<style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
		</head>
		<body>
			<header class="topbar">
				<div class="topbar-in">
					<a class="logo" href="/admin/sites">
						Edge<span>Blog</span>
					</a>
					<nav>
						<a class={props.active === "sites" ? "on" : ""} href="/admin/sites">
							Sites
						</a>
						<a class={props.active === "new" ? "on" : ""} href="/admin/sites/new">
							New site
						</a>
						<a href="/admin/help" class={props.active === "help" ? "on" : ""}>
							API
						</a>
					</nav>
					<form method="post" action="/admin/logout">
						<button class="btn-link" type="submit">
							Sign out
						</button>
					</form>
				</div>
			</header>
			<main class={props.narrow ? "wrap narrow" : "wrap"}>
				{props.flash && <FlashMessage flash={props.flash} />}
				{props.children}
			</main>
		</body>
	</html>
);

export interface Flash {
	type: "ok" | "err";
	text: string;
}

export const FlashMessage: FC<{ flash: Flash }> = ({ flash }) => <div class={`flash ${flash.type}`}>{flash.text}</div>;

export const Field: FC<{
	label: string;
	name: string;
	value?: string | number | null;
	type?: string;
	hint?: string;
	placeholder?: string;
	required?: boolean;
}> = (p) => (
	<div class="field">
		<label for={p.name}>
			{p.label} {p.hint && <span class="hint">— {p.hint}</span>}
		</label>
		<input
			id={p.name}
			name={p.name}
			type={p.type ?? "text"}
			value={p.value === null || p.value === undefined ? "" : String(p.value)}
			placeholder={p.placeholder}
			required={p.required}
		/>
	</div>
);

export const TextArea: FC<{ label: string; name: string; value?: string; hint?: string; rows?: number; mono?: boolean }> = (p) => (
	<div class="field">
		<label for={p.name}>
			{p.label} {p.hint && <span class="hint">— {p.hint}</span>}
		</label>
		<textarea id={p.name} name={p.name} rows={p.rows ?? 5} style={p.mono ? "" : "font-family:inherit;font-size:14px"}>
			{p.value ?? ""}
		</textarea>
	</div>
);

export const Select: FC<{ label: string; name: string; value: string; options: [string, string][]; hint?: string }> = (p) => (
	<div class="field">
		<label for={p.name}>
			{p.label} {p.hint && <span class="hint">— {p.hint}</span>}
		</label>
		<select id={p.name} name={p.name}>
			{p.options.map(([val, text]) => (
				<option value={val} selected={val === p.value}>
					{text}
				</option>
			))}
		</select>
	</div>
);

export const Checkbox: FC<{ label: string; name: string; checked: boolean }> = (p) => (
	<div class="field">
		<label class="check">
			<input type="checkbox" name={p.name} value="1" checked={p.checked} />
			{p.label}
		</label>
	</div>
);

export const StatusTag: FC<{ status: string }> = ({ status }) => {
	const cls = status === "published" || status === "active" ? "green" : status === "draft" ? "gray" : status === "paused" ? "amber" : "blue";
	return <span class={`tag ${cls}`}>{status}</span>;
};
