const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

export type SpotifyImage = {
	url: string;
	width?: number;
	height?: number;
};

export type SpotifyTrack = {
	id: string;
	name: string;
	url: string;
	artists: string;
	album: string;
	image: string | null;
};

export type SpotifyArtist = {
	id: string;
	name: string;
	url: string;
	image: string | null;
};

export type SpotifyAlbum = {
	id: string;
	name: string;
	url: string;
	artists: string;
	image: string | null;
};

export type NowPlaying = {
	isPlaying: boolean;
	progressMs: number | null;
	durationMs: number | null;
	track: SpotifyTrack | null;
};

export type SpotifyStats = {
	configured: boolean;
	artists: SpotifyArtist[];
	topAlbum: SpotifyAlbum | null;
	onRepeat: SpotifyTrack | null;
	year: number;
};

type SpotifyConfig = {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
};

const getConfig = (): SpotifyConfig | null => {
	const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
	const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;
	const refreshToken = import.meta.env.SPOTIFY_REFRESH_TOKEN;

	if (!clientId || !clientSecret || !refreshToken) return null;

	return { clientId, clientSecret, refreshToken };
};

export const isSpotifyConfigured = () => getConfig() !== null;

const getAccessToken = async (config: SpotifyConfig): Promise<string> => {
	const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basic}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: config.refreshToken,
		}),
	});

	if (!res.ok) {
		throw new Error(`Spotify token refresh failed (${res.status})`);
	}

	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error('Spotify access token missing');
	return data.access_token;
};

const spotifyFetch = async <T>(path: string, config: SpotifyConfig): Promise<T | null> => {
	const token = await getAccessToken(config);
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`Spotify ${path} failed (${res.status})`);
	return (await res.json()) as T;
};

type RawTrack = {
	id: string;
	name: string;
	external_urls?: { spotify?: string };
	artists?: Array<{ name: string }>;
	album?: {
		name?: string;
		images?: SpotifyImage[];
	};
	duration_ms?: number;
};

type RawArtist = {
	id: string;
	name: string;
	external_urls?: { spotify?: string };
	images?: SpotifyImage[];
};

const pickImage = (images?: SpotifyImage[]) => images?.[0]?.url ?? null;

const mapTrack = (track: RawTrack): SpotifyTrack => ({
	id: track.id,
	name: track.name,
	url: track.external_urls?.spotify ?? '#',
	artists: (track.artists ?? []).map((a) => a.name).join(', '),
	album: track.album?.name ?? '',
	image: pickImage(track.album?.images),
});

const mapArtist = (artist: RawArtist): SpotifyArtist => ({
	id: artist.id,
	name: artist.name,
	url: artist.external_urls?.spotify ?? '#',
	image: pickImage(artist.images),
});

export const getNowPlaying = async (): Promise<NowPlaying> => {
	const config = getConfig();
	if (!config) {
		return { isPlaying: false, progressMs: null, durationMs: null, track: null };
	}

	try {
		const data = await spotifyFetch<{
			is_playing?: boolean;
			progress_ms?: number;
			item?: RawTrack | null;
			currently_playing_type?: string;
		}>('/me/player/currently-playing', config);

		if (!data?.item || data.currently_playing_type === 'episode') {
			return { isPlaying: false, progressMs: null, durationMs: null, track: null };
		}

		return {
			isPlaying: Boolean(data.is_playing),
			progressMs: data.progress_ms ?? null,
			durationMs: data.item.duration_ms ?? null,
			track: mapTrack(data.item),
		};
	} catch {
		return { isPlaying: false, progressMs: null, durationMs: null, track: null };
	}
};

const getTopTracks = async (config: SpotifyConfig, timeRange: string, limit: number) => {
	const data = await spotifyFetch<{ items: RawTrack[] }>(
		`/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
		config,
	);
	return data?.items ?? [];
};

const deriveTopAlbum = (tracks: RawTrack[]): SpotifyAlbum | null => {
	const scores = new Map<
		string,
		{ count: number; album: SpotifyAlbum }
	>();

	for (const track of tracks) {
		const albumName = track.album?.name;
		if (!albumName) continue;

		const key = `${albumName}::${(track.artists ?? []).map((a) => a.name).join(',')}`;
		const existing = scores.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}

		scores.set(key, {
			count: 1,
			album: {
				id: key,
				name: albumName,
				url: track.external_urls?.spotify ?? '#',
				artists: (track.artists ?? []).map((a) => a.name).join(', '),
				image: pickImage(track.album?.images),
			},
		});
	}

	let best: { count: number; album: SpotifyAlbum } | null = null;
	for (const entry of scores.values()) {
		if (!best || entry.count > best.count) best = entry;
	}
	return best?.album ?? null;
};

export const getSpotifyStats = async (): Promise<SpotifyStats> => {
	const year = new Date().getFullYear();
	const empty: SpotifyStats = {
		configured: false,
		artists: [],
		topAlbum: null,
		onRepeat: null,
		year,
	};

	const config = getConfig();
	if (!config) return empty;

	try {
		const [artistsData, yearTracks, recentTracks] = await Promise.all([
			spotifyFetch<{ items: RawArtist[] }>('/me/top/artists?time_range=medium_term&limit=5', config),
			getTopTracks(config, 'medium_term', 20),
			getTopTracks(config, 'short_term', 5),
		]);

		return {
			configured: true,
			artists: (artistsData?.items ?? []).map(mapArtist),
			topAlbum: deriveTopAlbum(yearTracks),
			onRepeat: recentTracks[0] ? mapTrack(recentTracks[0]) : null,
			year,
		};
	} catch {
		return { ...empty, configured: true };
	}
};
