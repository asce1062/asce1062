import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

const __dirname = path.dirname(fileURLToPath(
  import.meta.url));

const rssPath = path.join(__dirname, '../dist/rss.xml');

if (fs.existsSync(rssPath)) {
  let rssContent = fs.readFileSync(rssPath, 'utf8');

  // Add xml:base attribute
  // Reorder namespaces
  rssContent = rssContent.replace(
    /<rss version="2\.0" xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/,
    '<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" xml:base="https://alexmbugua.me/">'
  );

  fs.writeFileSync(rssPath, rssContent);
  console.log('✓ Added xml:base attribute and reordered namespaces in RSS feed');
} else {
  console.log('RSS file not found at', rssPath);
}
