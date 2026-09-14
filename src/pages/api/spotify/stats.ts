import type { APIRoute } from 'astro';
import { getSpotifyStats, isSpotifyConfigured } from '../../../lib/spotify';

export const prerender = false;

export const GET: APIRoute = async () => {
	if (!isSpotifyConfigured()) {
		return new Response(
			JSON.stringify({
				configured: false,
				artists: [],
				topAlbum: null,
				onRepeat: null,
				year: new Date().getFullYear(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
				},
			},
		);
	}

	try {
		const stats = await getSpotifyStats();
		return new Response(JSON.stringify(stats), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'spotify_error';
		return new Response(JSON.stringify({ configured: true, error: message }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
