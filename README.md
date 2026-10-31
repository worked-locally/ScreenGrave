# ScreenGrave

> Track the shows and movies you love, in a clean, cinema-dark interface.

**Version 0.5.0** · React + TypeScript · Node + SQLite · Docker · Installable PWA

ScreenGrave is a minimal, mobile-first tracker for TV shows and movies. It is inspired by the clean look of Hobi and built as a calmer alternative to Trakt's busy interface. It runs on your own server in Docker, keeps your library in a small SQLite database, and can import your history from Trakt. Posters, trailers, genres, ratings, and episode data come from [TMDB](https://www.themoviedb.org/).

**Contents:** [Features](#features) · [Upcoming and in development](#upcoming-and-in-development) · [Tech stack](#tech-stack) · [Getting API keys](#getting-api-keys) · [Install with Docker](#install-with-docker) · [Development](#development) · [Project layout](#project-layout) · [Changelog](#changelog) · [Credits](#credits)

---

## Features

### Watchlist (landing page)
- Two boxes, **Movies** and **TV Shows**, each collapsible. The app remembers which ones you collapsed.
- Each box grows to 3 rows of posters, then scrolls on its own. Empty boxes stay slim.
- Progress bar and "x / y eps" on shows you haven't caught up with. Those shows sort first.
- "Not out yet" overlay with the release date on unreleased titles.
- Status icons on posters: eye (watching), check (watched), bookmark + clock (not out yet), bookmark + play (out now, not started).

### Smart Watchlist
- The Watchlist only holds what you still need to watch.
- Caught up on a show? It moves to Watched. If it's still running and a next episode is announced, it also appears in Upcoming.
- When new episodes air for a show in Watched, it moves back to the Watchlist with a progress bar.
- Put a caught-up show back on the Watchlist yourself (for a rewatch) and it stays there.

### Upcoming
- A timeline of new episodes and movie releases, grouped by day (Today, Tomorrow, weekday, date). Dates in another year show the year.
- Follows your Watchlist plus caught-up shows in Watched, so their next episodes still appear.

### Discover
- Search with Google-style suggestions. Tap a suggestion to open its details right away.
- **Trending carousel** with 3D DVD-box covers. It loops endlessly, supports swipe and mouse drag (with momentum), has arrow buttons on desktop, and gives a gentle swipe hint after 3 seconds.
- **Browse** by Movies or Series, by **streaming service** (Netflix, Prime Video, Apple TV+, Disney+, and more), and by **genre**. Filters combine, for example "Popular on Hulu · Comedy".
- Shows 6 rows at a time with a **Load more** button.
- Floating **search** button (hidden while the search bar is on screen), plus a **scroll-up** button at the bottom of the page that jumps back to the browse filters.

### Watched
- Search, plus sorting by Newest, Oldest, A-Z, Top rated, or Recently watched.
- Year headers that stay pinned while you scroll, and a floating search button.

### Detail sheet
- Backdrop, poster, overview, genres, and an audience rating chip.
- **Trailer** button that plays inside the app.
- **Watchlist / Watched** toggles. They show "(Added)" when active, and a short "Removed from..." message when you tap again.
- Season and episode tracker. It opens on the season you're currently on, with "Mark season watched".
- Marking a show **Watched** checks off every aired episode in every season.
- Close with the X button or by tapping the blurred background. The page behind stays put.

### Sign-in and Trakt
- Password-protected: the server shows a sign-in page until you log in, and keeps you signed in for 30 days. Changing the password signs out every device.
- **Connect Trakt** in the user menu shows a short code: enter it at trakt.tv on any device and you're connected. No redirect address or HTTPS needed, so it works on a plain local network too.
- The first sync imports your watched movies, your watched shows with episode progress, and your Trakt watchlist. It only adds what's missing and never overwrites your data.
- **Sync Now** re-runs the import, and only re-checks shows you've watched since the last sync.
- Your Trakt login and TMDB key stay on the server and are never sent to the browser.

### Look and feel
- "After-hours cinema" theme: plum-black surfaces, ember-amber accent, teal for done states.
- Popcorn-bucket tombstone app icon for the browser tab and the iPhone home screen.
- Icon tab bar, page titles with matching icons, tap ripple and sparkle, slide-up sheets, film-themed section dividers.
- Respects the "reduce motion" setting.

---

## Upcoming and in development

| Feature | Status |
| --- | --- |
| HTTPS with your own domain (reverse proxy + Let's Encrypt) | In development |
| Settings screen | Upcoming |
| First-run setup (choose your password in the app) | Upcoming |
| Onboarding: pick favorite genres, mark what you've watched, choose what you're watching | Upcoming |
| **For You** tab on Discover with personal recommendations | Upcoming |
| Show more than one upcoming episode per show | Upcoming |
| Loading skeletons and a sliding tab-bar indicator | Upcoming |
| Celebration effect when you finish a season or show | Upcoming |
| Prebuilt Docker images on GitHub (no local build needed) | Upcoming |
| Google (Gmail) sign-in | Upcoming |
| Multi-user accounts | Upcoming |

--- | --- |
| Docker image and compose file | In development |
| Self-hosting on a Linux server over HTTPS | In development |
| Settings screen | Upcoming |
| First-run setup (choose your password in the app) | Upcoming |
| Onboarding: pick favorite genres, mark what you've watched, choose what you're watching | Upcoming |
| **For You** tab on Discover with personal recommendations | Upcoming |
| Show more than one upcoming episode per show | Upcoming |
| Loading skeletons and a sliding tab-bar indicator | Upcoming |
| Celebration effect when you finish a season or show | Upcoming |
| Google (Gmail) sign-in | Upcoming |
| Multi-user accounts | Upcoming |

---

## Tech stack

- **Web app:** Vite, React, TypeScript, Tailwind CSS v4, `vite-plugin-pwa`, Inter font
- **Server:** Node.js 24 with [Hono](https://hono.dev/), and Node's built-in SQLite (`node:sqlite`)
- **Packaging:** Docker image (Node 24 slim) with Docker Compose
- **Data:** TMDB API for titles and artwork, Trakt API for sync
- Your library lives in `data/screengrave.db` on the server, shared by every device you sign in from

---

## Getting API keys

ScreenGrave needs a free TMDB key. Trakt is optional and only needed for Trakt sync.

### TMDB (required)

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/) and sign in.
2. Go to **[Request an API key](https://www.themoviedb.org/settings/api/request)** and choose **Developer**.
3. Fill in the form. "Personal use" for a self-hosted tracker is fine.
4. Back on your API settings page, copy the **API Read Access Token**. It's the long one that starts with `eyJ`, not the short "API Key".
5. Put it in `.env.local` as `TMDB_TOKEN`.

### Trakt (optional)

1. Sign in at [trakt.tv](https://trakt.tv/), then open the **[Trakt developer apps page](https://developer.trakt.tv/apps)**.
2. Create a new app and give it any name, for example "ScreenGrave". A development app is fine, since you're its owner.
3. Open the app's **Credentials** and copy the **Client ID**. No client secret is needed.
4. Put it in your settings file as `TRAKT_CLIENT_ID`.

That's it. ScreenGrave signs in to Trakt with a short code, so you don't need to register a redirect URI.

> Optional: the menu also offers a redirect-based sign-in. Trakt development apps only allow `localhost` redirect addresses, so that method is mainly useful for local development.

---

## Install with Docker

The quickest way to run ScreenGrave is on a Linux server on your home network:

```bash
git clone https://github.com/worked-locally/ScreenGrave.git
cd ScreenGrave
cp .env.example .env     # then fill in TMDB_TOKEN, APP_PASSWORD, and optionally TRAKT_CLIENT_ID
docker compose up -d --build
```

Then open `http://<server-ip>:8787` on any device on your network.

**Full guide:** [docs/install.md](docs/install.md), covering settings, connecting Trakt, updating, and backups.

---

## Development

Requires [Node.js](https://nodejs.org/) **24 or newer** (for the built-in SQLite).

```powershell
npm install
```

Create a file named `.env.local` in the project root:

```
TMDB_TOKEN=your_tmdb_read_access_token
TRAKT_CLIENT_ID=your_trakt_client_id
APP_USERNAME=YourName
APP_PASSWORD=choose-a-password
```

Leave `APP_PASSWORD` out to turn sign-in off, which is handy for local development.

Then:

```powershell
npm run dev       # web app at http://localhost:5173, plus the server on 8787
npm run build     # type check and production build in /dist
npm start         # serves the built app and API at http://localhost:8787
```

> `.env.local`, `.env`, and `data/` are gitignored, so never commit them. `TMDB_TOKEN`, `TRAKT_CLIENT_ID`, and the password stay on the server and are never sent to the browser.

The version number lives only in `package.json`. The app and server both read it from there.

---

## Project layout

```
server/         index.ts (server), api.ts (library), auth.ts (sign-in),
                trakt.ts (Trakt sync), tmdb.ts, db.ts (SQLite)
src/
  components/   Poster, TabBar, DetailSheet, EpisodeTracker, Carousel3D, UserMenu, ...
  screens/      Watchlist, Upcoming, Discover, Watched, Login
  lib/          api.ts, auth.ts, trakt.ts, tmdb.ts, library.ts, episodes.ts, showinfo.ts, status.ts
public/         app icons
docs/           install guide
data/           screengrave.db (created on first run, local development)
Dockerfile, docker-compose.yml, .env.example
```

---

## Changelog

<details open>
<summary><strong>0.5.0 (Day 5)</strong></summary>

**New**
- Docker packaging: a `Dockerfile` (Node 24 slim, health check, runs as a non-root user) and `docker-compose.yml` with a data volume and auto-restart.
- Runs on plain HTTP on port 8787 by default, so it works on a home network with no domain or certificate.
- Trakt **device sign-in**: Connect Trakt shows a short code to enter at trakt.tv. No redirect address needed, so it works on any address, including LAN IPs over HTTP.
- Tap the code to copy it, with a fallback that also works on plain-HTTP pages and iPhone Safari.
- The redirect sign-in is still available as an option, and its redirect address is now worked out automatically from the address you're using.
- New install guide: [docs/install.md](docs/install.md).

**Improvements**
- The version number now lives only in `package.json`. The About screen, the health check, and the server all read it from there.
- The server shuts down cleanly when Docker stops it, so the database closes properly.
- The Docker image only contains what the server needs at runtime.
- `.env` (the Docker settings file) is gitignored, and `.env.example` documents every setting.

**Found during testing**
- Trakt development apps only accept `localhost` redirect addresses, which is why device sign-in is now the default.

</details>

<details>
<summary><strong>0.4.5 (Day 4, part 2)</strong></summary>

**New**
- Sign-in page with a password and a 30-day session (HttpOnly cookie). Repeated wrong passwords are throttled.
- Trakt connect (OAuth with PKCE, handled on the server) and import of watched movies, watched shows with episode progress, and your Trakt watchlist.
- Working Sync Now, with "last synced" shown in the menu.
- Smart Watchlist: caught-up shows move to Watched, and come back automatically when new episodes air.
- Upcoming now follows caught-up shows in Watched, so their next episodes still appear.
- Popcorn-bucket tombstone app icons for the browser tab, the iPhone home screen, and the PWA install.

**Bug fixes**
- Trakt's watched list no longer includes episode details, so episode progress is now imported per show.
- Line endings are now consistent (LF), which ends the CRLF warnings on Windows.

</details>

<details>
<summary><strong>0.4.0 (Day 4)</strong></summary>

**Bug fixes**
- Floating search button no longer hides behind the scroll arrows on desktop, and it now stays hidden while the search bar is on screen.
- Upcoming shows the year for dates outside the current year, like "Fri, Jan 15, 2027".
- Removed a leftover unused variable that would have broken production builds.

**Improvements**
- Floating search button on the Watched page.
- Over 30 film-themed divider phrases.
- Page titles now show their tab-bar icon.

**Backend (new)**
- Added a small server (Hono) that serves the app and passes TMDB requests through, so the TMDB token is no longer in the browser code.
- Library and episode progress are now stored in SQLite (`data/screengrave.db`), shared across every browser and device that uses the server.
- Data saved in a browser before this version is uploaded to the server automatically the first time that browser opens the app.
- One `npm run dev` starts both the web app and the server, and `npm run build` then `npm start` runs it in production mode.

</details>

<details>
<summary><strong>0.3.0 (Day 3)</strong></summary>

**Bug fixes**
- The page behind the detail sheet no longer jumps to the top when a title opens. Your scroll position is kept and restored.
- The detail sheet now opens on your current unfinished season instead of Season 1.
- Floating section titles on the Watchlist now stay pinned flush to the top of their box.
- Carousel: smooth endless loop, no blank space at the edges, momentum when dragging with a mouse.
- Discover is limited to 6 rows at a time, with Load more.
- More padding at the top and bottom of every page.
- Faster tap effect.

**Improvements**
- Watchlist split into collapsible Movies and TV Shows boxes with film-themed dividers.
- "Not out yet" overlay on unreleased titles.
- Icon-first tab bar with centered labels.
- Rating chip next to the Trailer button, and genres under the overview.
- X close button on the detail sheet.
- Temporary user menu at the top right.
- Floating search and scroll-up buttons on Discover.
- Arrow buttons on every horizontally scrollable row (desktop).
- Swipe hint on the trending carousel.
- Smaller, parenthesized counts in page titles, such as Watchlist (12).

</details>

<details>
<summary><strong>0.2.0 (Day 2)</strong></summary>

- Watchlist as the landing page, with progress bars and a new Upcoming timeline tab.
- Search suggestions, in-app trailers, and Watchlist / Watched toggles.
- Status icons on posters, and a Watched page with search, sorting, and year headers.
- Discover redesign: 3D DVD-box carousel, streaming-service and genre filters.
- Marking a show Watched now checks off all of its episodes.
- Amber and teal theme, blurred sheet backdrop, tap effects, Inter font.
- Fixed poster alignment on the Watchlist.

</details>

<details>
<summary><strong>0.1.0 (Day 1)</strong></summary>

- Project setup with TMDB search and trending.
- Watchlist and Watched lists, saved locally.
- Season and episode tracking.
- PWA manifest so it installs on a phone's home screen.

</details>

---

## Credits

Data and images provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Trakt sync uses the Trakt API.
