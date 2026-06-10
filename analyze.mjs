import { readFileSync } from 'fs';
import path from 'path';

const pages = ['home', 'blog', 'contactus', 'foreclosure-timeline', 'what-is-a-nod'];
const baseDir = 'C:/Users/Owner/siyht-backup/siyht-backup/stayinyourhometoday.com';

function extractUrls(str, prefix) {
  const results = new Set();
  let pos = 0;
  while (true) {
    const idx = str.indexOf(prefix, pos);
    if (idx === -1) break;
    let end = idx + prefix.length;
    while (end < str.length) {
      const c = str[end];
      const code = c.charCodeAt(0);
      // stop at: quote, paren, angle, space, backslash, newline
      if (c === '"' || c === "'" || c === ')' || c === '<' || c === '>' || code === 32 || code === 92 || code === 10 || code === 13) break;
      end++;
    }
    results.add(str.slice(idx, end));
    pos = idx + 1;
  }
  return results;
}

const allLeadUrls = new Set();
const allFilesafeUrls = new Set();
const allStorageUrls = new Set();

for (const page of pages) {
  const html = readFileSync(path.join(baseDir, page + '.html'), 'utf8');
  extractUrls(html, 'https://images.leadconnectorhq.com/').forEach(u => allLeadUrls.add(u));
  extractUrls(html, 'https://assets.cdn.filesafe.space/').forEach(u => allFilesafeUrls.add(u));
  extractUrls(html, 'https://storage.googleapis.com/').forEach(u => allStorageUrls.add(u));
}

console.log('=== Leadconnector image proxy URLs ===');
[...allLeadUrls].sort().forEach(u => {
  const parts = u.split('/');
  const fname = parts[parts.length - 1];
  // extract r_ (resize) dimension
  const rMatch = u.match(/\/r_(\d+)\//);
  const dim = rMatch ? rMatch[1] : '?';
  console.log('r=' + dim.padStart(4) + ' src=' + fname + ' <- ' + u.slice(0, 110));
});

console.log('\n=== Filesafe direct URLs ===');
[...allFilesafeUrls].sort().forEach(u => console.log(u));

console.log('\n=== Storage.googleapis.com URLs ===');
[...allStorageUrls].sort().forEach(u => console.log(u));
