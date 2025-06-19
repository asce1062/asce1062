/**
 * this scripts helps us automate some fixes to allows us to deploy our site with github pages
 * leading slashes break path leading to assets not being accessed correctly.
 * redirects need to access assets in the root directory
 * static files are generated a level above css files nested in folders.
 *
 */

import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

const __dirname = path.dirname(fileURLToPath(
  import.meta.url));
const distDir = path.join(__dirname, "../dist");

/**
 *
 * remove leading forward slash and underscore to linked generated stylesheets
 * replace href="/_astro/index..." > href="astro/index..."
 *
 */
function fixHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // Remove leading slash and underscore (/_astro) on paths references to astro on index.html
  content = content
    .replace(/href="\/_(astro\/[^"]+\.css)"/g, 'href="$1"')
    .replace(/src="\/_(astro\/[^"]+\.webp)"/g, 'src="$1"');

  // Determine relative path depth to distDir
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(distDir, fileDir);
  const depth = relativePath === "" ? 0 : relativePath.split(path.sep).length;

  if (path.basename(filePath) === "index.html" && depth > 0) {
    const prefix = "../".repeat(depth); // e.g., "../../" for 2 levels

    content = content
      // Update css/ paths
      .replace(/href="(css\/[^"]+)"/g, (_, p1) => `href="${prefix}${p1}"`)
      // Update href="astro/*.css paths
      .replace(/href="(astro\/[^"]+)"/g, (_, p1) => `href="${prefix}${p1}"`)
      // update src="astro/*.webp paths
      .replace(/src="(astro\/[^"]+\.webp)"/g, (_, p1) => `src="${prefix}${p1}"`)
      // Update resume PDF path
      .replace(/href="(Alex%20Mbugua%20Ngugi%20-%20Resume\.pdf)"/g, (_, p1) => `href="${prefix}${p1}"`);
  }

  if (content !== original) {
    console.log(`✅ Fixed paths in HTML: ${filePath}`);
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
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  content = content.replace(/url\(\s*['"]?\/([^)'"]+)['"]?\s*\)/g, "url(../$1)");

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
    } else if (file.endsWith(".html")) {
      fixHtmlFile(fullPath);
    } else if (file.endsWith(".css")) {
      fixCssFile(fullPath);
    }
  }
}

// Main
console.log("🔧 Running pre-deploy fixes...");
walkAndFix(distDir);
console.log("🎉 All done!");
