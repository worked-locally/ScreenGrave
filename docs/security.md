# Security and privacy

ScreenGrave is built to run on your own server, for you. This page explains what it stores, what leaves your server, and how it protects your library.

**Contents:** [What's stored](#whats-stored-and-where) · [What leaves your server](#what-leaves-your-server) · [Sign-in](#sign-in) · [Browser protections](#browser-protections) · [Server protections](#server-protections) · [Running it on the internet](#running-it-on-the-internet) · [Reporting a problem](#reporting-a-security-problem)

---

## What's stored, and where

Everything lives in one SQLite file on your server, `data/screengrave.db` (in Docker, the `/app/data` volume):

- your library, watched episodes, and settings
- your PIN or password, stored only as a scrambled fingerprint (scrypt with a random salt), never as readable text
- sign-in sessions, stored only as fingerprints of the session tokens
- your Trakt sign-in tokens, if you connect Trakt
- your notification settings, including any webhook address or bot token you enter

> Treat the `data` folder and any backups of it like a password file. Anyone with a copy can read your library and use your Trakt and notification connections.

Your browser keeps only small conveniences: cached show details (refreshed every few hours), which boxes you collapsed, and similar view settings. No account data is stored in the browser beyond the sign-in cookie.

## What leaves your server

ScreenGrave has **no analytics, tracking, or telemetry**. Nothing is sent to the ScreenGrave project. The only outside services it talks to are these:

| Service | When | What it sees |
| --- | --- | --- |
| **TMDB** | Searching, browsing, opening a title | Which titles are looked up. Your server's TMDB key is added on the server and never reaches the browser. |
| **TMDB images** (`image.tmdb.org`) | Showing posters and backdrops | Your device loads these directly, so TMDB's image servers see your device's IP address. |
| **YouTube** | Only when you press **Trailer** | The trailer you play, like any embedded YouTube video. |
| **Trakt** | Only if you connect it | Your watchlist and watch history, both ways, as you'd expect from sync. Turn two-way sync off in Settings to stop sending changes. |
| **Your notification service** | Only if you turn notifications on | The daily list of new releases, sent to the service you chose (Discord, ntfy, Gotify, Telegram, or your webhook). |

Fonts and the app itself are served from your own server.

## Sign-in

You choose how to sign in the first time you open ScreenGrave:

- **PIN** (4 to 8 numbers): quick, and a good fit for a home network.
- **Password** (8 or more characters): use this if ScreenGrave can be reached from the internet.
- **No sign-in**: anyone who can reach the server can see and change your library. Only for a network you fully trust.

How sign-in is protected:

- Sessions last 30 days, in a cookie that page scripts can't read (`HttpOnly`) and that other sites can't send along (`SameSite`). Over HTTPS, the cookie is also marked secure.
- **Guessing is slowed down:** after 8 wrong tries from one device, or 30 from all devices combined, sign-in pauses for 15 minutes. Every wrong try also waits half a second.
- Changing your PIN or password **signs out every other device**.
- If you set `APP_PASSWORD` in `.env`, that password is used instead, and it can't be changed from the app. `AUTH_DISABLED=true` turns sign-in off completely.

> **First run:** until a sign-in method is chosen, whoever opens ScreenGrave first gets to choose. Open it yourself right after you start it.

## Browser protections

Every page tells the browser to:

- load scripts, styles, and fonts only from ScreenGrave itself, images only from ScreenGrave and TMDB, and embedded video only from YouTube (a Content Security Policy)
- refuse to be shown inside another website's page, so clicks can't be hijacked
- not guess file types, not send your ScreenGrave address to other sites, and not ask for the camera, microphone, or location

Signed-in data from the server is marked so browsers and proxies never cache it.

## Server protections

- **Only ScreenGrave's own pages can change things.** Requests that add, remove, or change anything are refused if they come from another website, even one on the same domain as yours.
- Every `/api` request needs a valid session, except the health check (`/api/health`) and sign-in itself.
- Incoming data is checked before it's saved: title and episode identifiers must match the expected format, and requests over 2 MB are refused.
- Calls to TMDB, Trakt, and notification services give up after 15 to 20 seconds instead of hanging.
- Trakt sign-in uses Trakt's recommended protections (PKCE and a one-time state code).
- The Docker image runs as a regular user, not as root, and contains only Node.js, the built app, and a single server file.

## Running it on the internet

ScreenGrave works fine on a home network over plain HTTP. If you make it reachable from outside your home:

1. **Use a password, not a PIN or no sign-in.** Change it in **Settings → Account**.
2. **Put it behind HTTPS**, for example with a reverse proxy like Nginx Proxy Manager or Caddy and a free Let's Encrypt certificate.
3. **Consider a VPN instead** (WireGuard, Tailscale, or your router's built-in VPN). Then ScreenGrave never has to face the open internet at all.
4. **Keep it updated** (see [Updating](install.md#updating)) and **back up** the `data` folder.

## Reporting a security problem

If you find a security issue, please don't post the details in a public issue. Use GitHub's **Report a vulnerability** button on the repository's **Security** tab, so it can be fixed before it's widely known. For anything else, a regular issue is perfect.
