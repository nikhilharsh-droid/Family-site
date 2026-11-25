# Family site

The Harsh family home page. Edit the files and push to `main`; Cloudflare builds and publishes it at https://nikhilharsh.com within a few minutes (the typing game is at https://play.nikhilharsh.com).

- **How it runs:** `wrangler.jsonc` is the Cloudflare setup. Page files in this folder are served as they are; `worker/` handles the live parts (Chess Club stats, the featured art wall, `/status.json`). Security headers are in `_headers`, and `404.html` is the page for wrong addresses. Other branches get their own preview link, but they share the live database.
- **Try it locally:** `npm install`, then `npm run dev` (uses a stand-in database on your computer).

- **LinkedIn button:** set `LINKEDIN_URL` near the bottom of `index.html`.
- **Company logos:** stored in `assets/logos/` and listed on the About page (`about/index.html`). Logos show in white on the dark background.
- **Chess Club:** lives in `chess/` (`index.html` for the page, `engine.js` for the rules). Puzzles come live from the free Lichess puzzle API; if Lichess can't be reached it falls back to a small built-in set.
- **Rolling back:** in Cloudflare, open family-site, then Deployments, and roll back to an earlier version. Each push to `main` makes a new one.
