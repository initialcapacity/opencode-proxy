import { html } from 'hono/html';

export function landingPage(origin: string) {
	return html`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>opencode</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			background: #000;
			color: #fff;
			font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		pre {
			color: #e0e0e0;
			font: inherit;
			font-size: 0.95rem;
			letter-spacing: 0.02em;
			line-height: 1.8;
		}
	</style>
</head>
<body>
	<pre>brew install opencode cloudflare/cloudflare/cloudflared
opencode auth login ${origin}
opencode</pre>
</body>
</html>`;
}
