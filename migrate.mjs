/**
 * migrate.mjs
 * Full HTTrack mirror → Astro migration script.
 * Run: node migrate.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const MIRROR = 'C:/Users/Owner/siyht-backup/siyht-backup';
const PROJECT = 'C:/Users/Owner/stayinyourhometoday';
const PUBLIC_ASSETS = PROJECT + '/public/assets';
const SRC_DATA = PROJECT + '/src/data';
const SRC_PAGES = PROJECT + '/src/pages';

// ─── helpers ──────────────────────────────────────────────────────────────────

function mkdir(p) { mkdirSync(p, { recursive: true }); }

function copyIfExists(src, dest) {
  if (existsSync(src)) {
    mkdir(path.dirname(dest));
    copyFileSync(src, dest);
    return true;
  }
  return false;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    mkdir(path.dirname(dest));
    const proto = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function walkFiles(dir) {
  let out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) out = out.concat(walkFiles(full));
    else out.push(full);
  }
  return out;
}

// Extract URLs (stops at quote/space/backslash/angle)
function extractUrls(html, prefix) {
  const results = new Set();
  let pos = 0;
  while (true) {
    const idx = html.indexOf(prefix, pos);
    if (idx === -1) break;
    let end = idx + prefix.length;
    while (end < html.length) {
      const code = html.charCodeAt(end);
      // stop at: " ' ) < > space(32) backslash(92) newline(10) CR(13)
      if (code === 34 || code === 39 || code === 41 || code === 60 || code === 62 ||
          code === 32 || code === 92 || code === 10 || code === 13) break;
      end++;
    }
    results.add(html.slice(idx, end));
    pos = idx + 1;
  }
  return [...results];
}

// Extract all <style> blocks from head
function extractHeadStyles(html) {
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) return '';
  const headHTML = html.slice(0, headEnd + 7);
  let styles = '';
  let pos = 0;
  while (true) {
    const start = headHTML.indexOf('<style', pos);
    if (start === -1) break;
    const end = headHTML.indexOf('</style>', start) + 8;
    styles += headHTML.slice(start, end) + '\n';
    pos = end;
  }
  return styles;
}

// Extract #preview-container with depth-matched closing div
function extractPreviewContainer(html) {
  const start = html.indexOf('<div id="preview-container"');
  if (start === -1) {
    // fallback: body content
    const bodyStart = html.indexOf('<body');
    const bodyOpen = html.indexOf('>', bodyStart) + 1;
    const bodyEnd = html.lastIndexOf('</body>');
    return html.slice(bodyOpen, bodyEnd);
  }
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html[i] === '<') {
      if (html.slice(i, i + 4) === '<div') depth++;
      else if (html.slice(i, i + 6) === '</div>') {
        depth--;
        if (depth === 0) return html.slice(start, i + 6);
      }
    }
    i++;
  }
  return html.slice(start);
}

// Apply all URL replacements
function localizeUrls(html) {
  let out = html;

  // 1a. HTTrack relative leadconnector image paths → /assets/leadconnector/
  //     ../images.leadconnectorhq.com/image/... → /assets/leadconnector/image/...
  out = out.split('../images.leadconnectorhq.com/').join('/assets/leadconnector/');

  // 1b. Absolute https://images.leadconnectorhq.com/image/f_webp/.../u_https://...filesafe.../FILENAME
  //     → /assets/filesafe/FILENAME  (the few remaining absolute proxy URLs)
  out = out.replace(
    /https:\/\/images\.leadconnectorhq\.com\/image\/f_webp\/q_80\/r_\d+\/u_https:\/\/assets\.cdn\.filesafe\.space\/[^\/]+\/media\/([^"'\s<>\\]+)/g,
    '/assets/filesafe/$1'
  );

  // 1c. Any remaining absolute https://images.leadconnectorhq.com → /assets/leadconnector/
  out = out.split('https://images.leadconnectorhq.com/').join('/assets/leadconnector/');

  // 2. Filesafe direct URLs → local
  out = out.replace(
    /https:\/\/assets\.cdn\.filesafe\.space\/[^\/]+\/media\/([^"'\s<>\\]+)/g,
    '/assets/filesafe/$1'
  );

  // 3. Storage.googleapis.com → local filesafe (same filename)
  out = out.replace(
    /https:\/\/storage\.googleapis\.com\/msgsndr\/[^\/]+\/media\/([^"'\s<>\\]+)/g,
    '/assets/filesafe/$1'
  );

  // 4. img.youtube.com thumbnails → local
  out = out.replace(
    /https:\/\/img\.youtube\.com\/vi\/([^\/]+)\/([^"'\s<>\\]+)/g,
    '/assets/youtube/$1/$2'
  );

  return out;
}

// ─── STEP 1: Set up public/assets and copy files ──────────────────────────────

console.log('\n=== STEP 1: Copying assets to public/ ===');

mkdir(PUBLIC_ASSETS + '/filesafe');
mkdir(PUBLIC_ASSETS + '/youtube');

// filesafe.space mirror files
const filesafeMirror = MIRROR + '/assets.cdn.filesafe.space/OOvHLIiXWiw25KBrd30j/media';
for (const f of walkFiles(filesafeMirror)) {
  const dest = PUBLIC_ASSETS + '/filesafe/' + path.basename(f);
  copyIfExists(f, dest);
  console.log('  copied filesafe:', path.basename(f));
}

// storage.googleapis.com mirror files (same hex IDs as filesafe)
const storageMirror = MIRROR + '/storage.googleapis.com/msgsndr/OOvHLIiXWiw25KBrd30j/media';
for (const f of walkFiles(storageMirror)) {
  const dest = PUBLIC_ASSETS + '/filesafe/' + path.basename(f);
  if (!existsSync(dest)) {
    copyIfExists(f, dest);
    console.log('  copied storage→filesafe:', path.basename(f));
  }
}

// YouTube thumbnails
const ytMirror = MIRROR + '/img.youtube.com/vi';
for (const f of walkFiles(ytMirror)) {
  // f = .../vi/VIDEO_ID/filename.jpg
  const parts = f.replace(/\\/g, '/').split('/');
  const filename = parts.pop();
  const videoId = parts.pop();
  const dest = PUBLIC_ASSETS + '/youtube/' + videoId + '/' + filename;
  copyIfExists(f, dest);
  console.log('  copied youtube:', videoId + '/' + filename);
}

// Copy entire leadconnector image mirror → public/assets/leadconnector/
// HTTrack saved processed images as tmp*.webp under the same directory structure
const leadconnectorMirror = path.resolve(MIRROR + '/images.leadconnectorhq.com');
mkdir(PUBLIC_ASSETS + '/leadconnector');
for (const f of walkFiles(leadconnectorMirror)) {
  // Preserve subdirectory structure: /image/f_webp/q_80/r_NNN/u_https_/...
  const rel = f.replace(leadconnectorMirror, '').replace(/\\/g, '/');
  const dest = PUBLIC_ASSETS + '/leadconnector' + rel;
  mkdir(path.dirname(dest));
  copyFileSync(f, dest);
}
const lcFiles = walkFiles(PUBLIC_ASSETS + '/leadconnector');
console.log('  copied leadconnector:', lcFiles.length, 'files');

// ─── STEP 2: Download missing assets ──────────────────────────────────────────

console.log('\n=== STEP 2: Downloading missing assets ===');

const missingAssets = [
  // SVG used in home page (not in any mirror)
  {
    url: 'https://assets.cdn.filesafe.space/OOvHLIiXWiw25KBrd30j/media/69e7746f5e482c379ba2a20f.svg',
    dest: PUBLIC_ASSETS + '/filesafe/69e7746f5e482c379ba2a20f.svg'
  },
  {
    url: 'https://assets.cdn.filesafe.space/OOvHLIiXWiw25KBrd30j/media/6840b14bd77c62629b3f297b.png',
    dest: PUBLIC_ASSETS + '/filesafe/6840b14bd77c62629b3f297b.png'
  },
  {
    url: 'https://assets.cdn.filesafe.space/OOvHLIiXWiw25KBrd30j/media/696fb354eb392b7b7600a5f6.png',
    dest: PUBLIC_ASSETS + '/filesafe/696fb354eb392b7b7600a5f6.png'
  },
];

const downloadPromises = missingAssets.map(async ({ url, dest }) => {
  if (existsSync(dest)) {
    console.log('  already exists:', path.basename(dest));
    return;
  }
  try {
    await download(url, dest);
    console.log('  downloaded:', path.basename(dest));
  } catch (e) {
    console.warn('  WARN: failed to download', url, e.message);
  }
});

await Promise.all(downloadPromises);

// ─── STEP 3: Process each HTML page into data modules ─────────────────────────

console.log('\n=== STEP 3: Processing HTML pages → data modules ===');

mkdir(SRC_DATA);

const pageConfigs = [
  { slug: 'home',                 mirrorFile: 'home.html' },
  { slug: 'blog',                 mirrorFile: 'blog.html' },
  { slug: 'contactus',            mirrorFile: 'contactus.html' },
  { slug: 'foreclosure-timeline', mirrorFile: 'foreclosure-timeline.html' },
  { slug: 'what-is-a-nod',        mirrorFile: 'what-is-a-nod.html' },
];

for (const { slug, mirrorFile } of pageConfigs) {
  const htmlPath = MIRROR + '/stayinyourhometoday.com/' + mirrorFile;
  const html = readFileSync(htmlPath, 'utf8');

  const styles = extractHeadStyles(html);
  const body = extractPreviewContainer(html);
  const combined = localizeUrls(styles + '\n' + body);

  const modPath = SRC_DATA + '/ghl-' + slug + '-content.js';
  writeFileSync(modPath, 'export const ghlContent = ' + JSON.stringify(combined) + ';\n', 'utf8');
  console.log('  ' + slug + ': ' + combined.length + ' bytes → ' + modPath);
}

// ─── STEP 4: Create/update .astro pages ───────────────────────────────────────

console.log('\n=== STEP 4: Writing .astro pages ===');

// Page definitions
const astroPages = [
  {
    file: SRC_PAGES + '/home.astro',
    dataModule: '../data/ghl-home-content.js',
    title: 'Behind on payments? You still have options.',
    description: 'Whether you want to stay in your home or sell it and walk away with equity, the Tru Agency Team helps Utah homeowners facing foreclosure understand every option — free and confidential.',
    schema: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Stay In Your Home Today",
      "description": "CDPS-certified foreclosure help and short sale assistance for Utah homeowners",
      "url": "https://stayinyourhometoday.com",
      "telephone": "(435) 244-3210",
      "email": "brad@truhomebuyer.com",
      "address": { "@type": "PostalAddress", "addressRegion": "UT", "addressCountry": "US" },
      "areaServed": [
        { "@type": "State", "name": "Utah" },
        { "@type": "AdministrativeArea", "name": "Salt Lake County" },
        { "@type": "AdministrativeArea", "name": "Tooele County" },
        { "@type": "AdministrativeArea", "name": "Weber County" }
      ],
      "knowsAbout": ["Foreclosure Prevention", "Short Sale", "Loan Modification", "Distressed Property"],
      "hasCredential": "CDPS — Certified Distressed Property Specialist"
    }
  },
  {
    file: SRC_PAGES + '/blog/index.astro',
    dataModule: '../../data/ghl-blog-content.js',
    title: 'Foreclosure Resources & Blog | Stay In Your Home Today',
    description: 'Free guides and resources on Utah foreclosure timelines, your options after a Notice of Default, and how to protect your home — from CDPS-certified broker Tiffany Lancaster.',
    schema: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "Stay In Your Home Today — Foreclosure Education Blog",
      "description": "Expert guidance on Utah foreclosure timelines, options, and rights from CDPS-certified broker Tiffany Lancaster.",
      "url": "https://stayinyourhometoday.com/blog",
      "publisher": {
        "@type": "Organization",
        "name": "Stay In Your Home Today",
        "url": "https://stayinyourhometoday.com"
      }
    }
  },
  {
    file: SRC_PAGES + '/contactus.astro',
    dataModule: '../data/ghl-contactus-content.js',
    title: 'Contact Us | Stay In Your Home Today',
    description: 'Get your free, confidential foreclosure options review from the Tru Agency Team. Call (435) 244-3210 or fill out the form — no pressure, no judgment.',
    schema: null
  },
  {
    file: SRC_PAGES + '/foreclosure-timeline.astro',
    dataModule: '../data/ghl-foreclosure-timeline-content.js',
    title: 'Utah Foreclosure Timeline: How Long Does Foreclosure Take?',
    description: "Utah's non-judicial foreclosure takes a minimum of 240 days — but your options expire long before the auction. CDPS-certified broker Tiffany Lancaster explains every stage.",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Utah Foreclosure Timeline: How Long Does Foreclosure Take in Utah?",
      "author": { "@type": "Person", "name": "Tiffany Lancaster" },
      "publisher": { "@type": "Organization", "name": "Stay In Your Home Today" },
      "url": "https://stayinyourhometoday.com/foreclosure-timeline"
    }
  },
];

for (const page of astroPages) {
  const schemaStr = page.schema ? JSON.stringify(page.schema, null, 2) : 'null';
  const layoutPath = page.file.includes('/blog/') ? '../../layouts/BaseLayout.astro' : '../layouts/BaseLayout.astro';

  const content = `---
import BaseLayout from '${layoutPath}';
import { ghlContent } from '${page.dataModule}';
${page.schema ? `
const schema = ${schemaStr};` : ''}
---

<BaseLayout
  title="${page.title.replace(/"/g, '&quot;')}"
  description="${page.description.replace(/"/g, '&quot;')}"
  ${page.schema ? 'schema={schema}' : ''}
>
  <Fragment set:html={ghlContent} />
</BaseLayout>
`;

  mkdir(path.dirname(page.file));
  writeFileSync(page.file, content, 'utf8');
  console.log('  wrote:', page.file.replace(PROJECT + '/', ''));
}

// ─── STEP 4b: what-is-a-nod blog post ─────────────────────────────────────────

console.log('\n  writing blog/what-is-a-nod.astro ...');
const nodSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "What Is a Notice of Default (NOD)? Utah Homeowners Guide",
  "author": { "@type": "Person", "name": "Tiffany Lancaster" },
  "publisher": { "@type": "Organization", "name": "Stay In Your Home Today" },
  "url": "https://stayinyourhometoday.com/blog/what-is-a-nod"
};

const nodPage = `---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { ghlContent } from '../../data/ghl-what-is-a-nod-content.js';

const schema = ${JSON.stringify(nodSchema, null, 2)};
---

<BaseLayout
  title="What Is a Notice of Default? Utah Homeowners Guide | Stay In Your Home Today"
  description="A Notice of Default is the first formal step in Utah's foreclosure process. CDPS-certified broker Tiffany Lancaster explains what it means, your timeline, and every option available."
  schema={schema}
>
  <Fragment set:html={ghlContent} />
</BaseLayout>
`;

writeFileSync(SRC_PAGES + '/blog/what-is-a-nod.astro', nodPage, 'utf8');
console.log('  wrote: src/pages/blog/what-is-a-nod.astro');

// ─── STEP 5: Verify asset files exist ─────────────────────────────────────────

console.log('\n=== STEP 5: Asset inventory ===');
const assetFiles = walkFiles(PUBLIC_ASSETS);
console.log('Total asset files:', assetFiles.length);
assetFiles.forEach(f => {
  const rel = f.replace(PUBLIC_ASSETS, '').replace(/\\/g, '/');
  const size = statSync(f).size;
  console.log('  ' + rel + ' (' + size + 'b)');
});

console.log('\n✅ Migration script complete. Run: npm run build');
