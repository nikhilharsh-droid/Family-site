# Family site

The Harsh family home page. Edit `index.html` and push to `main`; It is live at https://nikhilharsh.com within a few minutes (the game is at https://play.nikhilharsh.com).

- **LinkedIn button:** set `LINKEDIN_URL` near the bottom of `index.html`.
- **Company logos:** add official logo files (SVG or PNG) in `assets/logos/` named `bigscoots.svg`, `datto.svg` and `inverness-graham.svg`. Each one replaces the company name on the page when it is present. Logos show in white on the dark background.
- **Chess Club:** lives in `chess/` (`index.html` for the page, `engine.js` for the rules). Puzzles come live from the free Lichess puzzle API; if Lichess can't be reached it falls back to a small built-in set.
