import type { APIRoute } from 'astro';
import { getNowPlaying, isSpotifyConfigured } from '../../../lib/spotify';

export const prerender = false;

export const GET: APIRoute = async () => {
	if (!isSpotifyConfigured()) {
		return new Response(JSON.stringify({ configured: false, isPlaying: false, track: null }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30',
			},
		});
	}

	try {
		const now = await getNowPlaying();
		return new Response(JSON.stringify({ configured: true, ...now }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'spotify_error';
		return new Response(JSON.stringify({ configured: true, error: message, isPlaying: false, track: null }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
