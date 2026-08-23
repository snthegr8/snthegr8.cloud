import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { formatOgDate, ogCardOptions } from '../../lib/og';

const posts = await getCollection('blog');
const links = await getCollection('links');

const pages = Object.fromEntries([
  [
    'blog',
    {
      title: 'blog',
      description: 'articles on interest, software, things...',
    },
  ],
  [
    'notes',
    {
      title: 'notes',
      description: 'short thoughts',
    },
  ],
  [
    'links',
    {
      title: 'links',
      description: 'curated reads',
    },
  ],
  [
    'experience',
    {
      title: 'experience',
      description: 'work & resume',
    },
  ],
  ...posts.map((post) => [
    `blog/${post.id}`,
    {
      title: post.data.title,
      description: formatOgDate(post.data.pubDate),
    },
  ]),
  ...links.map((link) => [
    `links/${link.id}`,
    {
      title: `${link.data.title} by ${link.data.author}`,
      description: formatOgDate(link.data.pubDate),
    },
  ]),
]);

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ogCardOptions(page.title, page.description),
});
