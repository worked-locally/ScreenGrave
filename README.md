# ScreenGrave

ScreenGrave is a clean, minimal, mobile-first TV show and movie tracker inspired by the Hobi app. It is built as a Progressive Web App (PWA) using Vite, React, TypeScript, and Tailwind CSS. ScreenGrave fetches metadata, posters, trailers, and episode info from the TMDB API and syncs data with the Trakt API.

## Features

- **Tabs**: Bottom tab bar with Watchlist (default), Upcoming, Discover, and Watched.
- **Discover**: TMDB multi-search and trending grid with Google-style suggestions dropdown.
- **Detail Sheet**: Slide-up bottom sheet with backdrop and gradient, poster, overview, and trailer button.
- **Episode Tracker**: Season pills, per-episode checkmarks, and "Mark season watched".
- **Persistence**: LocalStorage only with migration from old "watching" entries to "watchlist".
- **Animations**: Tap ripple, sparkle, sheet slide-up, and tab fade.
- **PWA Basics**: Manifest, display: standalone, and iOS meta tags.

## Installation and Setup

1. **Clone the Repository**:
   ```sh
   git clone https://github.com/worked-locally/screengrave.git
   cd screengrave
