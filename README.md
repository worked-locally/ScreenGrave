# ScreenGrave

> Track the shows and movies you love, in a clean, cinema-dark interface.

**Version 0.3.0** · React + TypeScript · Installable PWA

ScreenGrave is a minimal, mobile-first tracker for TV shows and movies. It is inspired by the clean look of Hobi and built as a calmer alternative to Trakt's busy interface. Posters, trailers, genres, ratings, and episode data come from [TMDB](https://www.themoviedb.org/).

---

## Features

### Watchlist (landing page)
- Two boxes, **Movies** and **TV Shows**, each collapsible. The app remembers which ones you collapsed.
- Each box grows to 3 rows of posters, then scrolls on its own. Empty boxes stay slim.
- Progress bar and "x / y eps" on shows you haven't caught up with. Those shows sort first.
- "Not out yet" overlay with the release date on unreleased titles.
- Status icons on posters: eye (watching), check (watched), bookmark + clock (not out yet), bookmark + play (out now, not started).

### Upcoming
- A timeline of new episodes and movie releases for everything on your watchlist, grouped by day (Today, Tomorrow, weekday, date).

### Discover
- Search with Google-style suggestions. Tap a suggestion to open its details right away.
- **Trending carousel** with 3D DVD-box covers. It loops endlessly, supports swipe and mouse drag (with momentum), has arrow buttons on desktop, and gives a gentle swipe hint after 3 seconds.
- **Browse** by Movies or Series, by **streaming service** (Netflix, Prime Video, Apple TV+, Disney+, and more), and by **genre**. Filters combine, for example "Popular on Hulu · Comedy".
- Shows 6 rows at a time with a **Load more** button.
- Floating **search** button, plus a **scroll-up** button at the bottom of the page that jumps back to the browse filters.

### Watched
- Search, plus sorting by Newest, Oldest, A-Z, Top rated, or Recently watched.
- Year headers that stay pinned while you scroll.

### Detail sheet
- Backdrop, poster, overview, genres, and an audience rating chip.
- **Trailer** button that plays inside the app.
- **Watchlist / Watched** toggles. They show "(Added)" when active, and a short "Removed from..." message when you tap again.
- Season and episode tracker. It opens on the season you're currently on, with "Mark season watched".
- Marking a show **Watched** checks off every aired episode in every season.
- Close with the X button or by tapping the blurred background. The page behind stays put.

### Look and feel
- "After-hours cinema" theme: plum-black surfaces, ember-amber accent, teal for done states.
- Icon tab bar, tap ripple and sparkle, slide-up sheets, film-themed section dividers.
- Respects the "reduce motion" setting.

### Account menu (temporary)
- User chip at the top right (username, then icon) opens a popover:
  - Signed out: **Login**, **Register**, **About**
  - Signed in: **Sync Now**, **Settings**, **About**, **Log out**
- Login and Register currently just save a display name in this browser, as a placeholder for real accounts.

---

## Upcoming and in development

| Feature | Status |
| --- | --- |
| Trakt login (OAuth with PKCE) | In development |
| Trakt import: watched shows and movies, plus your Trakt watchlist | In development |
| Home-screen app icons for iPhone and PWA | In development |
| Working **Sync Now** | Upcoming |
| Google (Gmail) sign-in | Upcoming |
| Settings screen | Upcoming |
| Loading skeletons and a sliding tab-bar indicator | Upcoming |
| Celebration effect when you finish a season or show | Upcoming |
| Auto-move finished, fully watched shows to Watched | Upcoming |
| Show more than one upcoming episode per show | Upcoming |
| Self-hosting on a Linux server over HTTPS | Upcoming |
| Server-side library so your lists sync across devices | Upcoming |

---

## Tech stack

- Vite, React, TypeScript
- Tailwind CSS v4
- `vite-plugin-pwa` (installable on iPhone and desktop)
- Inter font (`@fontsource-variable/inter`)
- TMDB API for data, Trakt API for sync (in development)
- Data is stored in the browser's localStorage for now

## Getting started

Requires [Node.js](https://nodejs.org/) (LTS).

```powershell
npm install
```

Create a file named `.env.local` in the project root:

```
VITE_TMDB_TOKEN=your_tmdb_read_access_token
VITE_TRAKT_CLIENT_ID=your_trakt_client_id
```

Then:

```powershell
npm run dev       # start the dev server at http://localhost:5173
npm run build     # production build in /dist
```

> `.env.local` is gitignored, so never commit it. Variables starting with `VITE_` are bundled into the built site, so keep any deployment private until the TMDB token is moved behind a small server.

## Project layout

```
src/
  components/   Poster, TabBar, DetailSheet, EpisodeTracker, Carousel3D, UserMenu, ...
  screens/      Watchlist, Upcoming, Discover, Watched
  lib/          tmdb.ts, library.ts, episodes.ts, showinfo.ts, status.ts
```

---

## Changelog

### 0.3.0 (Day 3)

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

### 0.2.0 (Day 2)
- Watchlist as the landing page, with progress bars and a new Upcoming timeline tab.
- Search suggestions, in-app trailers, and Watchlist / Watched toggles.
- Status icons on posters, and a Watched page with search, sorting, and year headers.
- Discover redesign: 3D DVD-box carousel, streaming-service and genre filters.
- Marking a show Watched now checks off all of its episodes.
- Amber and teal theme, blurred sheet backdrop, tap effects, Inter font.
- Fixed poster alignment on the Watchlist.

### 0.1.0 (Day 1)
- Project setup with TMDB search and trending.
- Watchlist and Watched lists, saved locally.
- Season and episode tracking.
- PWA manifest so it installs on a phone's home screen.

---

## Credits

Data and images provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
