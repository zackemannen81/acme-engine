/** In-package CSS — no CDN (ADR-0024). */

export const WORKBENCH_CSS = `
:root {
  color-scheme: light;
  --bg: #f7f3f2;
  --surface: #ffffff;
  --ink: #1c1b1b;
  --muted: #46474a;
  --line: #e1e1e1;
  --pass: #107c10;
  --fail: #d83b01;
  --warn: #8a6d00;
  --info: #0078d4;
  --blocked: #323130;
  --font: "Segoe UI", system-ui, sans-serif;
  --mono: "Cascadia Mono", "Consolas", ui-monospace, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  line-height: 1.45;
}
a { color: var(--info); }
.shell { display: grid; grid-template-columns: 14rem 1fr; min-height: 100vh; }
nav {
  background: #1b1b1c;
  color: #f4f0ef;
  padding: 1rem 0.75rem;
}
nav h1 {
  font-size: 0.95rem;
  margin: 0 0 1rem;
  letter-spacing: 0.02em;
}
nav a {
  display: block;
  color: #e5e2e1;
  text-decoration: none;
  padding: 0.4rem 0.55rem;
  border-radius: 0.25rem;
  font-size: 0.9rem;
}
nav a:hover, nav a[aria-current="page"] {
  background: #313030;
  color: #fff;
}
main { padding: 1.25rem 1.5rem 2rem; }
header.page h2 { margin: 0 0 0.25rem; font-size: 1.35rem; }
header.page p { margin: 0 0 1rem; color: var(--muted); font-size: 0.95rem; }
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 0.25rem;
  padding: 1rem;
  margin-bottom: 1rem;
}
.meta { color: var(--muted); font-size: 0.85rem; }
.badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 0.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.badge-pass { background: #dff6dd; color: var(--pass); }
.badge-fail { background: #fde7e9; color: var(--fail); }
.badge-unavailable { background: #f3f2f1; color: var(--blocked); }
.badge-info { background: #deecf9; color: var(--info); }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; font-size: 0.8rem; }
code, .mono { font-family: var(--mono); font-size: 0.85em; }
.stack { display: grid; gap: 0.5rem; }
.pipeline { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.pipeline span {
  border: 1px solid var(--line);
  padding: 0.2rem 0.45rem;
  border-radius: 0.2rem;
  font-size: 0.8rem;
}
.pipeline .passed { border-color: var(--pass); color: var(--pass); }
.pipeline .failed { border-color: var(--fail); color: var(--fail); }
.pipeline .reached { border-color: var(--warn); color: var(--warn); }
.pipeline .not-reached { color: var(--muted); }
.empty { color: var(--muted); font-style: italic; }
.error-banner {
  border-left: 4px solid var(--fail);
  padding: 0.75rem 1rem;
  background: #fff5f4;
}
`.trim();
