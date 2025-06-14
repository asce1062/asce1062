import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const artifactsDir = path.join(distDir, '../../artifacts');

/**
 *
 * remove leading forward slash to linked generated stylesheets
 * replace href="/_astro/index..." > href="_astro/index..."
 *
 */
function fixHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  content = content.replace(/href="\/(_astro\/[^"]+\.css)"/g, 'href="$1"');

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

function removeDirRecursively(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`🗑️ Removed existing directory: ${dirPath}`);
  }
}

/**
 *
 * cheeky workaround to have our sources and site hosted on github
 * move static files /dist > ../../artifacts
 *
 */

function copyDirRecursively(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.statSync(srcPath).isDirectory()) {
      copyDirRecursively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`📁 Copied dist → ${dest}`);
}

// Main
console.log('🔧 Running post-build fix and copy...');
walkAndFix(distDir);
// removeDirRecursively(docsDir);
// copyDirRecursively(distDir, docsDir);
console.log('🎉 All done!');
