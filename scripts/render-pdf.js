// Sprite x NBA Workshop Synthesis — PDF Renderer
// Editorial layout modeled on the LA28 synthesis. Not a whitepaper cover — a
// dense, scannable read: title + thick green rule + stat pills + sections.
//
// Usage:  node scripts/render-pdf.js   (from project root)

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const { chromium } = require("playwright");

const ENGAGEMENT_DIR = path.resolve(__dirname, "../docs/engagement");
const MD_PATH = path.join(ENGAGEMENT_DIR, "Sprite x NBA Workshop Synthesis.md");
const HTML_PATH = path.join(ENGAGEMENT_DIR, "Sprite x NBA Workshop Synthesis.html");
const PDF_PATH = path.join(ENGAGEMENT_DIR, "Sprite x NBA Workshop Synthesis.pdf");

// ---- Load markdown ----
let md = fs.readFileSync(MD_PATH, "utf8");

// ---- Display-only cleanup: trim truncated "..." idea names ----
md = md.replace(/([A-Za-z0-9,;:!?)])\s+\w{1,6}\.{3}/g, "$1");
md = md.replace(/\.{3,}/g, "");

// ---- Drop the title and meta lines in markdown — we'll render our own header block ----
md = md.replace(/^# Sprite x NBA Workshop.*$/m, "");
md = md.replace(/^\*Companion to the Integrated Next Steps document\*\s*$/m, "");
md = md.replace(/^\*Workshop: April 14-15, 2026.*\*\s*$/m, "");
md = md.replace(/^\*Data: 86 ideas.*\*\s*$/m, "");
md = md.replace(/^---\s*$/gm, "");

// ---- Convert ## to H1 (major sections), ### to H2, etc. to match LA28 hierarchy ----
// LA28 uses h1 for "Cross-Team Patterns", h2 for "Collectibility is the dominant..."
// Our markdown uses ## for major sections, ### for sub-sections.
// We'll let marked keep the structure and style h2 as major, h3 as minor via CSS.

// ---- Parse markdown → HTML ----
marked.setOptions({ breaks: false, gfm: true });
let bodyHtml = marked.parse(md);

// ---- Post-processing: add semantic classes for editorial styling ----

// 1. Color-tag bucket names inline wherever they appear in prose (not inside headings)
// Protect headings by processing them separately
function tagBuckets(html) {
  // Replace inside paragraphs + list items, not inside headings
  return html.replace(
    /(<(?:p|li)[^>]*>)([\s\S]*?)(<\/(?:p|li)>)/g,
    (m, open, inner, close) => {
      let out = inner;
      out = out.replace(/\b(Refreshing the Game)\b/g, '<span class="b-fresh">$1</span>');
      out = out.replace(/\b(And One Sprite)\b/g, '<span class="b-andone">$1</span>');
      out = out.replace(/\b(Bounce To This)\b/g, '<span class="b-bounce">$1</span>');
      return open + out + close;
    }
  );
}

// 2. Section-scoped transforms — Gaps, Kernels, Shared Dependencies
// We split the HTML into sections by h2 (major section) and style each section's content.

function transformGapsSection(sectionHtml) {
  // Convert h3 + following p into .gap-item blocks
  return sectionHtml.replace(
    /<h3[^>]*>(.*?)<\/h3>\s*([\s\S]*?)(?=<h3|$)/g,
    (m, title, body) => {
      return `<div class="gap-item"><h4>${title}</h4>${body.trim()}</div>\n`;
    }
  );
}

function transformKernelsSection(sectionHtml) {
  // Intro paragraph(s) kept as-is. Then kernel entries are bolded idea names followed by
  // a meta-in-parens line and description. Our markdown produces:
  //   <p><strong>Idea Name</strong> (Bucket, coached)<br>Description text...</p>
  // We convert each kernel <p> into a .kernel card.
  return sectionHtml.replace(
    /<p>\s*<strong>([^<]+)<\/strong>\s*\(([^)]+)\)\s*([\s\S]*?)<\/p>/g,
    (m, title, meta, body) => {
      const cleanBody = body.replace(/^(\s*<br\s*\/?>\s*)+/, "").trim();
      return `<div class="kernel"><h4>${title}</h4><div class="kernel-meta">${meta}</div><p>${cleanBody}</p></div>`;
    }
  );
}

function transformDependenciesSection(sectionHtml) {
  // Convert bulleted "collision" lists under headings like "Fighting over the same moments"
  // or "Competing claims..." into .flag-card boxes.
  return sectionHtml.replace(
    /(<h3[^>]*>\s*(?:Fighting over[^<]*|Competing claims[^<]*)<\/h3>\s*)(<ul>([\s\S]*?)<\/ul>)/i,
    (m, heading, _ul, items) => {
      const cards = items.replace(
        /<li>\s*<strong>([^<]+?)\.?<\/strong>\s*[—:–-]?\s*([\s\S]*?)<\/li>/g,
        (_m2, t, d) => `<div class="flag-card"><h4>${t}</h4><p>${d.trim()}</p></div>`
      );
      return heading + cards;
    }
  );
}

// Apply section-scoped transforms
bodyHtml = bodyHtml.replace(
  /<h2[^>]*>([^<]+)<\/h2>([\s\S]*?)(?=<h2|$)/g,
  (m, title, content) => {
    const t = title.trim();
    let transformed = content;
    if (/gaps/i.test(t)) transformed = transformGapsSection(content);
    else if (/interesting kernels/i.test(t)) transformed = transformKernelsSection(content);
    else if (/shared dependencies/i.test(t)) transformed = transformDependenciesSection(content);
    return `<h2>${title}</h2>${transformed}`;
  }
);

bodyHtml = tagBuckets(bodyHtml);

// ---- HTML template ----
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sprite x NBA Workshop — Synthesis</title>
<style>
@page { margin: 0.75in; size: letter; }
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --green: #01A44D;
  --green-bright: #00C853;
  --yellow: #F8CD24;
  --fresh: #01A44D;
  --andone: #9C27B0;
  --bounce: #00A3E0;
  --ink: #1a1a1a;
  --ink-soft: #444;
  --mute: #888;
  --rule: #e0e0e0;
  --soft: #f5f5f5;
  --card: #fafafa;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.65;
  color: var(--ink);
  max-width: 8in;
  margin: 0 auto;
  padding: 0.75in;
  text-wrap: pretty;
}

/* Header block */
.report-header {
  border-bottom: 3px solid var(--green);
  padding-bottom: 20px;
  margin-bottom: 24px;
}
.report-header .eyebrow {
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: var(--green);
  margin-bottom: 10px;
}
.report-header h1 {
  font-size: 26pt;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin-bottom: 14px;
  text-wrap: balance;
  border: none;
  page-break-before: avoid;
  margin-top: 0;
  color: var(--ink);
}
.report-meta {
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
  font-size: 9.5pt;
  color: var(--mute);
  font-weight: 500;
}
.report-meta span { white-space: nowrap; }

/* Stat pills */
.stats-row {
  display: flex;
  gap: 10px;
  margin: 24px 0 32px;
  flex-wrap: wrap;
}
.stat-pill {
  background: var(--soft);
  border: 1px solid var(--rule);
  padding: 12px 16px;
  flex: 1;
  min-width: 110px;
  text-align: center;
}
.stat-pill .num {
  font-size: 22pt;
  font-weight: 800;
  display: block;
  line-height: 1.05;
  color: var(--ink);
  letter-spacing: -0.5px;
}
.stat-pill .label {
  font-size: 7.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.8px;
  color: var(--mute);
  display: block;
  margin-top: 5px;
}

/* Sections */
h2 {
  font-size: 20pt;
  font-weight: 800;
  letter-spacing: -0.4px;
  margin-top: 40px;
  margin-bottom: 6px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 6px;
  page-break-before: auto;
  page-break-after: avoid;
  text-wrap: balance;
  color: var(--ink);
}
h2:first-of-type { page-break-before: avoid; }

h3 {
  font-size: 12.5pt;
  font-weight: 700;
  margin-top: 24px;
  margin-bottom: 6px;
  color: var(--ink);
  page-break-after: avoid;
  text-wrap: balance;
}

p {
  margin: 6px 0;
  color: var(--ink-soft);
  orphans: 3;
  widows: 3;
}
p + p { margin-top: 8px; }

strong { color: var(--ink); font-weight: 700; }
em { color: var(--mute); font-style: italic; }

/* Lists */
ul, ol { margin: 8px 0 10px; padding-left: 20px; }
li { margin: 5px 0; color: var(--ink-soft); orphans: 3; widows: 3; text-wrap: pretty; }
li + li { margin-top: 5px; }
li strong { color: var(--ink); }

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th {
  background: var(--soft);
  font-weight: 700;
  text-align: left;
  padding: 7px 10px;
  border-bottom: 2px solid #ddd;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--mute);
}
td {
  padding: 6px 10px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
  color: var(--ink-soft);
}
tr:last-child td { border-bottom: none; }

/* Blockquote — minimal, editorial */
blockquote {
  margin: 14px 0;
  padding: 10px 16px;
  border-left: 3px solid var(--green);
  background: #f8faf6;
  font-size: 10.5pt;
  color: var(--ink);
  font-weight: 500;
  page-break-inside: avoid;
}
blockquote p { color: var(--ink); margin: 0; }

/* Bucket color tags (inline spans inserted by post-processor) */
.b-fresh   { color: var(--fresh); font-weight: 600; }
.b-andone  { color: var(--andone); font-weight: 600; }
.b-bounce  { color: var(--bounce); font-weight: 600; }

/* Gap items */
.gap-item {
  margin: 12px 0;
  padding: 4px 0 4px 16px;
  border-left: 3px solid var(--green);
  page-break-inside: avoid;
}
.gap-item h4 {
  font-size: 11pt;
  font-weight: 700;
  margin-bottom: 3px;
  color: var(--ink);
}
.gap-item p { font-size: 10pt; color: var(--ink-soft); }

/* Kernel cards */
.kernel {
  border-left: 3px solid var(--rule);
  padding: 8px 16px;
  margin: 14px 0;
  page-break-inside: avoid;
}
.kernel h4 {
  font-size: 11pt;
  font-weight: 700;
  margin-bottom: 3px;
  color: var(--ink);
}
.kernel .kernel-meta {
  font-size: 8pt;
  color: var(--mute);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.3px;
  margin-bottom: 5px;
}
.kernel p { font-size: 10pt; color: var(--ink-soft); margin: 0; }

/* Flag cards (dependencies, conflicts) */
.flag-card {
  border: 1px solid var(--rule);
  background: var(--card);
  padding: 12px 16px;
  margin: 10px 0;
  page-break-inside: avoid;
}
.flag-card h4 {
  font-size: 10.5pt;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--ink);
}
.flag-card p { font-size: 10pt; margin: 2px 0; color: var(--ink-soft); }

/* HR hidden — section breaks come from H2 rule */
hr { display: none; }

/* Print safety */
@media print {
  body { padding: 0; max-width: none; }
  .report-header { page-break-after: avoid; }
  h2 { page-break-after: avoid; }
  h3 { page-break-after: avoid; }
  .gap-item, .kernel, .flag-card { page-break-inside: avoid; }
  .stat-pill { border: 1px solid #ccc; }
}
</style>
</head>
<body>

<div class="report-header">
  <div class="eyebrow">Sprite · NBA · Workshop Synthesis</div>
  <h1>Refreshing the Game: Workshop Synthesis</h1>
  <div class="report-meta">
    <span>April 14–15, 2026</span>
    <span>Coca-Cola HQ, Atlanta</span>
    <span>Co-Creation Workshop · Day 2 Ideation</span>
    <span>TCCC × NBA × WPP Open X</span>
  </div>
</div>

<div class="stats-row">
  <div class="stat-pill"><span class="num">86</span><span class="label">Ideas</span></div>
  <div class="stat-pill"><span class="num">41</span><span class="label">Coaching Sessions</span></div>
  <div class="stat-pill"><span class="num">3</span><span class="label">Creative Platforms</span></div>
  <div class="stat-pill"><span class="num">8</span><span class="label">Resolved Concepts</span></div>
  <div class="stat-pill"><span class="num">3.5h</span><span class="label">Active Ideation</span></div>
</div>

${bodyHtml}

</body>
</html>`;

fs.writeFileSync(HTML_PATH, html);
console.log(`HTML: ${HTML_PATH}`);

// ---- Render to PDF ----
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("file://" + HTML_PATH, { waitUntil: "networkidle" });

  await page.pdf({
    path: PDF_PATH,
    format: "Letter",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });

  await browser.close();
  console.log(`PDF:  ${PDF_PATH}`);
  const sz = fs.statSync(PDF_PATH).size;
  console.log(`Size: ${(sz / 1024).toFixed(1)} KB`);
})();
