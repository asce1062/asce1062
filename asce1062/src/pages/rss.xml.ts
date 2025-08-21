import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';

// Import all blog images
import escapeRoomImg from '../assets/blog/2u-escape-room.jpg';
import profileImg from '../assets/blog/profile.jpg';
import timeImg from '../assets/blog/time.png';
import progressImg from '../assets/blog/progress.png';
import yourOwnSiteImg from '../assets/blog/your-own-site.png';
import hindsightImg from '../assets/blog/hindsight.png';
import perspectiveImg from '../assets/blog/perspective.png';
import purposeImg from '../assets/blog/purpose.png';
import shineImg from '../assets/blog/shine.png';
import startTodayImg from '../assets/blog/start-today.png';
import bePresentImg from '../assets/blog/be-present.png';
import currentOfLifeImg from '../assets/blog/current-of-life.png';
import letWoundsHealImg from '../assets/blog/let-wounds-heal.png';
import walkFreeImg from '../assets/blog/walk-free.png';
import icomoonImg from '../assets/blog/icomoon.png';
import itWillBeOkayImg from '../assets/blog/it-will-be-okay-in-the-end.png';

// Create image mapping
const imageMap = {
  '/src/assets/blog/2u-escape-room.jpg': escapeRoomImg,
  '/src/assets/blog/profile.jpg': profileImg,
  '/src/assets/blog/time.png': timeImg,
  '/src/assets/blog/progress.png': progressImg,
  '/src/assets/blog/your-own-site.png': yourOwnSiteImg,
  '/src/assets/blog/hindsight.png': hindsightImg,
  '/src/assets/blog/perspective.png': perspectiveImg,
  '/src/assets/blog/purpose.png': purposeImg,
  '/src/assets/blog/shine.png': shineImg,
  '/src/assets/blog/start-today.png': startTodayImg,
  '/src/assets/blog/be-present.png': bePresentImg,
  '/src/assets/blog/current-of-life.png': currentOfLifeImg,
  '/src/assets/blog/let-wounds-heal.png': letWoundsHealImg,
  '/src/assets/blog/walk-free.png': walkFreeImg,
  '/src/assets/blog/icomoon.png': icomoonImg,
  '/src/assets/blog/it-will-be-okay-in-the-end.png': itWillBeOkayImg,
};

export async function GET(context: { site: string | URL; }) {
  const blog = await getCollection('blog');

  // Sort posts by publication date (newest first)
  const sortedPosts = blog.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  // Process images to get optimized URLs
  const sortedPostsWithHeaderImages = await Promise.all(
    sortedPosts.map(async (post) => {
      const imageAsset = imageMap[post.data.image.url];
      if (imageAsset) {
        const optimizedImage = await getImage({ src: imageAsset, format: 'webp' });
        return {
          ...post,
          optimizedImageUrl: new URL(optimizedImage.src, context.site).href
        };
      } else {
        // Fallback to original path conversion if image not in map
        return {
          ...post,
          optimizedImageUrl: new URL(post.data.image.url.replace('/src/assets/', '/astro/'), context.site).href
        };
      }
    })
  );

  return rss({
    title: 'Alex Mbugua\'s Blog',
    description: 'My space on the internet. Thoughts on life, tech, and everything in between. I\'m happy you\'re here ^^',
    site: context.site,
    items: sortedPostsWithHeaderImages.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: `<img src="${post.optimizedImageUrl}" alt="${post.data.image.alt}" /><br/><br/>${post.data.description}`,
      link: `/blog/${post.id.replace('.mdx', '')}/`,
      categories: post.data.tags,
    })),
    customData: `<language>en</language>
    <atom:link href="${new URL('/rss.xml', context.site).href}" rel="self" type="application/rss+xml" />`,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      atom: "http://www.w3.org/2005/Atom"
    }
  });
}
