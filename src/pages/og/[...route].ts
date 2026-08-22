import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { formatOgDate, ogCardOptions } from '../../lib/og';

const posts = await getCollection('blog');

const pages = Object.fromEntries([
	[
		'blog',
		{
			title: 'blog',
			description: 'writing and notes',
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
]);

export const { getStaticPaths, GET } = await OGImageRoute({
	param: 'route',
	pages,
	getImageOptions: (_path, page) => ogCardOptions(page.title, page.description),
});
