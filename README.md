Personal site and blog for [snthegr8.cloud](https://snthegr8.cloud).

Built with Astro, MDX, GSAP.

Font: Linux Libertine.

You're welcome to use this as a starting point for your own site. Fork it, swap the copy in `src/data/home.ts` and `src/data/experience.ts`, add posts under `src/content/blog/`, drop your photo in `public/me.png`, and update `src/consts.ts` with your name and domain.

```sh
pnpm install
pnpm dev
pnpm build
```

## Spotify

The home intro can show currently listening, top artists, top album, and on-repeat.

1. Create an app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URI `http://127.0.0.1:3000/callback`
3. Copy `.env.example` → `.env` and fill `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`
4. Run `pnpm spotify:token`, approve access, paste the refresh token into `.env`
5. Restart `pnpm dev`

Live now-playing hits `/api/spotify/now-playing` (Vercel adapter). Set the three Spotify env vars in the Vercel project settings.
