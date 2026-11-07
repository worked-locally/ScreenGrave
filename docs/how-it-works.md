# How ScreenGrave works

ScreenGrave runs on **your own server**. Your phone or computer opens it like a website, and everything you track is saved in a single file on that server. Movie and show information comes from TMDB. Trakt sync and notifications are optional extras you can turn on in **Settings**.

![How ScreenGrave works, in detail: your devices connect to your ScreenGrave server (directly, or through an optional reverse proxy for HTTPS). The server looks up movie data from TMDB, optionally syncs with Trakt and sends daily notifications, and saves everything in one database file. Your device loads posters from TMDB and trailers from YouTube directly.](images/how-it-works-detailed.png)

---

## The pieces

### Your devices
An iPhone, iPad, or computer opens ScreenGrave in the browser or from the home screen. The browser only keeps small conveniences:

- your sign-in cookie (30 days)
- cached show details, refreshed every few hours
- view choices, like which Watchlist boxes you collapsed

Your library itself always lives on the server, so every device you sign in from sees the same thing.

### The connection
- **On your home network:** plain HTTP on port 8787, like `http://192.168.1.50:8787`. No domain or certificate needed.
- **With your own domain (optional):** a reverse proxy such as Nginx Proxy Manager or Caddy adds HTTPS in front of ScreenGrave. That's also what lets the app work offline on your iPhone.

### Your ScreenGrave server
One Docker container that does everything:

| Part | What it does |
| --- | --- |
| **Web app** | Sends your device the pages, styles, and icons. |
| **Sign-in** | Checks your PIN or password, keeps you signed in, and slows down guessing. |
| **Library** | Saves your Watchlist, Watched titles, checked-off episodes, and settings. |
| **TMDB lookups** | Asks TMDB for titles, episodes, and air dates, adding your TMDB key on the server so it never reaches your device. |
| **Trakt sync** *(optional)* | Pulls your Trakt history and watchlist, and sends your changes back, retrying if Trakt is down. |
| **Daily notifications** *(optional)* | Once a day, sends new episodes and releases to the service you picked. |

### The database
Everything is saved in one SQLite file, `screengrave.db` (in Docker, the `/app/data` volume):

- your library, watched episodes, and settings
- your PIN or password, stored only as a scrambled fingerprint
- sign-in sessions, your Trakt tokens, and notification settings

Back up this one file and you've backed up ScreenGrave. Treat backups like a password file.

### Outside services
| Service | Who talks to it | When |
| --- | --- | --- |
| **TMDB API** | Your server | Searching, browsing, opening a title, and checking for new episodes |
| **TMDB images** | Your device, directly | Showing posters and backdrops |
| **YouTube** | Your device, directly | Only when you press **Trailer** |
| **Trakt** *(optional)* | Your server | When you sync, and shortly after you make changes |
| **Notification service** *(optional)* | Your server | Once a day, only on days with something new |

There's no analytics or tracking, and nothing is ever sent to the ScreenGrave project.

---

## A day in the life

1. **You open the app.** Your device loads ScreenGrave from your server and shows your Watchlist right away, while the other screens download quietly in the background.
2. **You check off an episode.** Your device tells the server, which saves it in the database. If Trakt is connected with two-way sync on, the change goes to Trakt a few seconds later.
3. **You open a show you haven't seen.** The server asks TMDB for its details, and your device loads the poster straight from TMDB's image servers.
4. **A new episode airs.** If notifications are on, your server sends you a message at the hour you picked. The next time you open the app, ScreenGrave spots the new episode and moves the show back to your Watchlist.

For more on how all of this is protected, see [Security and privacy](security.md).
