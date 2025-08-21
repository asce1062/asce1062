import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const blog = await getCollection('blog');

  // Sort posts by publication date (newest first)
  const sortedPosts = blog.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Alex Mbugua\'s Blog',
    description: 'My space on the internet. Thoughts on life, tech, and everything in between. I\'m happy you\'re here ^^',
    site: context.site,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: `<img src="${new URL(post.data.image.url.replace('/src/assets/', '/astro/'), context.site).href}" alt="${post.data.image.alt}" /><br/><br/>${post.data.description}`,
      link: `/blog/${post.id.replace('.mdx', '')}/`,
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
