import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const docsDir = path.join(distDir, '../../');

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

/**
 *
 * cheeky workaround to have our sources and site hosted on github
 * move static files /dist > ../../
 *
 */

function copyDirContentsToRoot(src, destRoot) {
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(destRoot, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirContentsToRoot(srcPath, destPath);
    } else {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`📄 Copied ${srcPath} → ${destPath}`);
    }
  }
}

// Main
console.log('🔧 Running post-build fix and copy...');
walkAndFix(distDir);
copyDirContentsToRoot(distDir, docsDir);
console.log('🎉 All done!');
