const fg = require('fast-glob');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

async function collectHtmlFiles(root) {
  const patterns = [
    '**/*.html',
    '!node_modules/**',
    '!.git/**',
    '!index.html',
    '!.github/**',
    '!tools/**',
    '!templates/**',
    '!static/**'
  ];
  const files = await fg(patterns, { cwd: root, dot: true });
  return files.sort();
}

async function extractMeta(root, relativePath) {
  const full = path.join(root, relativePath);
  const raw = await fs.readFile(full, 'utf8');
  const $ = cheerio.load(raw);
  const title = ($('title').first().text() || '').trim();
  const firstHeading = ($('h1,h2,h3').first().text() || '').trim();
  const stat = await fs.stat(full);
  return {
    path: relativePath.replace(/\\/g, '/'),
    title,
    firstHeading,
    sizeBytes: stat.size
  };
}

function groupFiles(items) {
  const groups = {};
  for (const it of items) {
    const parts = it.path.split('/');
    const group = parts.length > 1 ? parts[0] : 'Root';
    groups[group] = groups[group] || [];
    groups[group].push(it);
  }
  return groups;
}

function renderTocHtml(groups) {
  let html = '';
  for (const [groupName, files] of Object.entries(groups)) {
    html += `<section class="toc-group">
  <h2 class="group-title">${escapeHtml(groupName)}</h2>
  <ul class="group-list">
`;
    for (const f of files) {
      const display = f.title || f.firstHeading || path.basename(f.path);
      const subtitle = f.firstHeading ? `<span class="subtitle">${escapeHtml(f.firstHeading)}</span>` : '';
      html += `    <li class="toc-item"><a href="${encodeURI(f.path)}">${escapeHtml(display)}</a> ${subtitle} <small class="meta">${f.sizeBytes} bytes</small></li>\n`;
    }
    html += '  </ul>\n</section>\n';
  }
  return html;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;'}[c]));
}

async function loadTemplate(root) {
  const tplPath = path.join(root, 'templates', 'toc_template.html');
  try {
    const tpl = await fs.readFile(tplPath, 'utf8');
    return tpl;
  } catch (e) {
    return null;
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const files = await collectHtmlFiles(root);
  const items = [];
  for (const f of files) {
    try {
      const meta = await extractMeta(root, f);
      items.push(meta);
    } catch (err) {
      console.warn('Skipping', f, err.message);
    }
  }

  const groups = groupFiles(items);
  const tocHtml = renderTocHtml(groups);
  const generatedAt = new Date().toISOString();

  const template = await loadTemplate(root);
  let outHtml;
  if (template) {
    outHtml = template.replace('<!--TOC_ITEMS-->', tocHtml).replace('<!--GENERATED_AT-->', generatedAt);
  } else {
    outHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Repository Table of Contents</title>
  <link rel="stylesheet" href="static/toc.css">
</head>
<body>
  <header><h1>Repository Table of Contents</h1></header>
  <main>
  ${tocHtml}
  </main>
  <footer>Generated at ${generatedAt}</footer>
  <script src="static/toc.js"></script>
</body>
</html>`;
  }

  const outPath = path.join(root, 'index.html');
  await fs.writeFile(outPath, outHtml, 'utf8');
  console.log(`Wrote ${outPath} with ${items.length} HTML files.`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
