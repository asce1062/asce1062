import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import fs from 'fs';
import path from 'path';
import { BLOG_TITLE, BLOG_DESCRIPTION } from '../config';

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
import stepByStepImg from '../assets/blog/step-by-step.png';
import goodInEverydayImg from '../assets/blog/finding-good-in-every-day.png';

// Map blog images for optimization
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
  '/src/assets/blog/step-by-step.png': stepByStepImg,
  '/src/assets/blog/finding-good-in-every-day.png': goodInEverydayImg,
};

export async function GET(context: { site: string | URL }) {
  const blog = await getCollection('blog');

  // Sort posts by publication date (newest first)
  const sortedPosts = blog.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );

  // Process images to get optimized URLs
  const postsWithOptimizedImages = await Promise.all(
    sortedPosts.map(async (post) => {
      const imageAsset = imageMap[post.data.image.url];
      const optimizedImage = imageAsset
        ? await getImage({ src: imageAsset, format: 'webp' })
        : null;

      return {
        ...post,
        optimizedImageUrl: optimizedImage
          ? new URL(optimizedImage.src, context.site).href
          : new URL(
              post.data.image.url.replace('/src/assets/', '/astro/'),
              context.site
            ).href,
      };
    })
  );

  const publicDir = path.resolve('./public');
  const primaryImagePath = path.join(publicDir, 'social-preview.png');

  // Use primary if it exists, otherwise fallback
  const channelImage = fs.existsSync(primaryImagePath)
    ? new URL('/social-preview.png', context.site).href
    : new URL('/social-preview-no-bg.png', context.site).href;

  // Get most recent date for <lastBuildDate> and <pubDate>
  const lastBuildDate = sortedPosts[0]?.data.pubDate.toUTCString();

  return rss({
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    site: context.site,
    items: postsWithOptimizedImages.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: `<img src="${post.optimizedImageUrl}" alt="${post.data.image.alt}" /><br/><br/>${post.data.description}`,
      link: `/blog/${post.id.replace('.mdx', '')}/`,
      categories: post.data.tags,
    })),
    customData: `
      <language>en</language>
      <lastBuildDate>${lastBuildDate}</lastBuildDate>
      <pubDate>${lastBuildDate}</pubDate>
      <ttl>60</ttl>
      <generator>Astro RSS Generator</generator>
      <!-- Podcast Metadata for platforms like YouTube -->
      <managingEditor>tnkratos@gmail.com (Alex Mbugua Ngugi)</managingEditor>
      <image>
        <url>${channelImage}</url>
        <title>${BLOG_TITLE}</title>
        <link>${context.site}</link>
      </image>
      <itunes:owner>
        <itunes:name>Alex Mbugua Ngugi</itunes:name>
        <itunes:email>tnkratos@gmail.com</itunes:email>
      </itunes:owner>
      <itunes:author>Alex Mbugua Ngugi</itunes:author>
      <itunes:explicit>no</itunes:explicit>
      <itunes:category text="Society &amp; Culture">
        <itunes:category text="Personal Journals" />
      </itunes:category>
      <itunes:category text="Society &amp; Culture">
        <itunes:category text="Philosophy" />
      </itunes:category>
      <itunes:category text="Technology"/>
      <itunes:category text="Religion &amp; Spirituality">
        <itunes:category text="Spirituality" />
      </itunes:category>
      <itunes:category text="Religion &amp; Spirituality">
        <itunes:category text="Christianity" />
      </itunes:category>
      <itunes:category text="Education">
        <itunes:category text="How To" />
      </itunes:category>
      <itunes:category text="Music"/>
      <atom:link href="${new URL('/rss.xml', context.site).href}" rel="self" type="application/rss+xml" />
      <copyright>© ${new Date().getFullYear()} Alex Mbugua Ngugi. You are free to Share i.e copy and redistribute the material in any medium or format. You are free to Adapt i.e transform, and build upon the material. Content by Alex Ngugi is licensed under Attribution Non-Commercial Creative Commons License (https://creativecommons.org/licenses/by-nc-sa/4.0/). For commercial uses, don't hesitate to contact me: mailto:tnkratos@gmail.com</copyright>
    `,
    xmlns: {
      dc: 'http://purl.org/dc/elements/1.1/',
      atom: 'http://www.w3.org/2005/Atom',
      itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
    },
  });
}
