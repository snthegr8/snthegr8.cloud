#!/usr/bin/env node
/**
 * One-time helper to mint a Spotify refresh token for this site.
 *
 * Usage:
 *   1. Put SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in .env
 *   2. Add redirect URI http://127.0.0.1:3000/callback in the Spotify dashboard
 *   3. pnpm spotify:token
 *   4. Open the printed URL, approve, then paste SPOTIFY_REFRESH_TOKEN into .env
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const loadEnv = () => {
	const path = resolve(process.cwd(), '.env');
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const i = trimmed.indexOf('=');
		if (i === -1) continue;
		const key = trimmed.slice(0, i).trim();
		const value = trimmed.slice(i + 1).trim();
		if (!process.env[key]) process.env[key] = value;
	}
};

loadEnv();

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = 'http://127.0.0.1:3000/callback';
const scopes = [
	'user-read-currently-playing',
	'user-read-playback-state',
	'user-top-read',
].join(' ');

if (!clientId || !clientSecret) {
	console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
	process.exit(1);
}

const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('scope', scopes);

console.log('\nOpen this URL in your browser:\n');
console.log(authUrl.toString());
console.log('\nWaiting for Spotify callback on', redirectUri, '...\n');

const server = createServer(async (req, res) => {
	if (!req.url?.startsWith('/callback')) {
		res.writeHead(404);
		res.end('Not found');
		return;
	}

	const url = new URL(req.url, redirectUri);
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	if (error || !code) {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		res.end(`Auth failed: ${error ?? 'missing code'}`);
		server.close();
		process.exit(1);
		return;
	}

	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basic}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
		}),
	});

	const data = await tokenRes.json();
	if (!tokenRes.ok || !data.refresh_token) {
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end(JSON.stringify(data, null, 2));
		server.close();
		process.exit(1);
		return;
	}

	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(
		'<html><body style="font-family:serif;padding:2rem"><h1>Spotify connected</h1><p>You can close this tab and return to the terminal.</p></body></html>',
	);

	console.log('\nAdd this to your .env:\n');
	console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
	server.close();
	process.exit(0);
});

server.listen(3000, '127.0.0.1');
