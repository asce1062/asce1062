/**
 * this scripts helps us automate some fixes to allows us to deploy our site with github pages
 * leading slashes break path leading to assets not being accessed correctly.
 * static files are generated a level above css files nested in folders.
 *
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');

/**
 *
 * remove leading forward slash and underscore to linked generated stylesheets
 * replace href="/_astro/index..." > href="astro/index..."
 *
 */
function fixHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  content = content.replace(/href="\/_(astro\/[^"]+\.css)"/g, 'href="$1"');

  if (content !== original) {
    console.log(`✅ Fixed href path in HTML: ${filePath}`);
    fs.writeFileSync(filePath, content);
  }
}

/**
 *
 * move asset links one level up on generated stylesheets
 * replace url(/...) > url(../...)
 *
 */
function fixCssFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  content = content.replace(/url\(\s*['"]?\/([^)'"]+)['"]?\s*\)/g, 'url(../$1)');

  if (content !== original) {
    console.log(`✅ Fixed url() path in CSS: ${filePath}`);
    fs.writeFileSync(filePath, content);
  }
}

function walkAndFix(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkAndFix(fullPath);
    } else if (file.endsWith('.html')) {
      fixHtmlFile(fullPath);
    } else if (file.endsWith('.css')) {
      fixCssFile(fullPath);
    }
  }
}

// Main
console.log('🔧 Running pre-deploy fixes...');
walkAndFix(distDir);
console.log('🎉 All done!');
