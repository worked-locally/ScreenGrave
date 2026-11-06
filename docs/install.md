# Installing ScreenGrave

This guide gets ScreenGrave running on a server on your home network with Docker. You don't need a domain name or HTTPS for this. Those are an optional upgrade, covered in a later guide.

**Contents:** [What you need](#what-you-need) · [1. Get the code](#1-get-the-code) · [2. Settings](#2-settings) · [3. Start it](#3-start-it) · [4. Open it](#4-open-it) · [5. Connect Trakt](#5-connect-trakt-optional) · [6. Notifications](#6-notifications-optional) · [Updating](#updating) · [Backups](#backups) · [Useful commands](#useful-commands) · [Troubleshooting](#troubleshooting)

---

## What you need

- A Linux machine or VM on your network with **Docker Engine** and the **Docker Compose plugin**. Check with:
  ```bash
  docker version
  docker compose version
  ```
- **Git**, to download the code.
- A free **TMDB API Read Access Token** (required). See [Getting API keys](../README.md#getting-api-keys).
- A **Trakt Client ID**, only if you want Trakt sync.

A small VM is plenty: 2 CPU cores, 2 GB of RAM, and 20 GB of disk.

---

## 1. Get the code

```bash
git clone https://github.com/worked-locally/ScreenGrave.git
cd ScreenGrave
```

## 2. Settings

Copy the example settings file and fill it in:

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

| Setting | Required | What it does |
| --- | --- | --- |
| `TMDB_TOKEN` | Yes | Your TMDB API Read Access Token (the long one starting with `eyJ`). |
| `TRAKT_CLIENT_ID` | No | Turns on Trakt sync. |
| `APP_PASSWORD` | No | Only if you want to manage the password in this file. Leave it out to choose a PIN, password, or no sign-in in the app. |
| `AUTH_DISABLED` | No | Set to `true` to turn sign-in off completely. Only on a network you fully trust. |
| `TRAKT_REDIRECT_URI` | No | Only for the optional redirect sign-in. Normally leave it out. |

`.env` holds your keys. It's gitignored and never copied into the Docker image.

## 3. Start it

```bash
docker compose up -d --build
```

The first build takes a few minutes. Then check that it's running:

```bash
docker compose ps
```

The **screengrave** container should show `Up`, and `(healthy)` after about 30 seconds.

## 4. Open it

Find the server's IP address with `ip -4 addr`, then open this on any device on your network:

```
http://<server-ip>:8787
```

The first time, ScreenGrave asks for your name and how you want to sign in:

- **PIN** (recommended): 4 to 8 numbers, quick to type. Great for a home network.
- **Password:** best if the server can be reached from the internet.
- **No sign-in:** anyone who can reach the server can see and change your library.

> Do this right after the first start: until it's chosen, whoever opens the app first gets to choose. You can change it later in **Settings**.

### Add it to your iPhone home screen

**If you open ScreenGrave with `https://`** (your own domain behind a reverse proxy):

1. Open the address in **Safari**.
2. Tap the **Share** button (on iOS 26, tap **⋯** next to the address bar first, then **Share**).
3. Scroll down and tap **Add to Home Screen**.
4. Leave **Open as Web App** on, then tap **Add**.

It opens full screen like a regular app and keeps working offline.

**If you open it with `http://`** (for example `http://192.168.1.50:8787` on your home network):

An iPhone home-screen web app may show a blank page over plain HTTP. Add it as a bookmark instead, which opens in Safari and works fine:

1. Open `http://<server-ip>:8787` in **Safari** and sign in.
2. Tap the **Share** button (on iOS 26, tap **⋯** next to the address bar first, then **Share**).
3. Scroll down and tap **Add to Home Screen**.
4. Turn **Open as Web App** **off**.
5. Tap **Add**.

The icon opens ScreenGrave in a Safari tab, with Safari's address bar showing. Everything works except offline use. If you already added a version that shows a blank page, press and hold its icon, tap **Remove Bookmark** (or **Delete**), and add it again with these steps.

> On iOS 18 or earlier there's no **Open as Web App** switch. If the icon shows a blank page there, save ScreenGrave to Safari's **Favorites** instead, or put it behind a reverse proxy with HTTPS.

> Give the server a fixed IP (a DHCP reservation on your router) so the address doesn't change.

## 5. Connect Trakt (optional)

1. In the app, tap your name at the top right, then **Connect Trakt**.
2. A short code appears. Tap it to copy.
3. Open the link shown (Trakt's activate page) on any device, sign in to Trakt, and enter the code.
4. Approve. ScreenGrave connects and imports your watched history and watchlist.

No redirect address is needed for this, so it works over plain HTTP on your local network. **Sync Now** in the same menu pulls in new activity later.

Sync works both ways: titles you add or remove and episodes you check off in ScreenGrave are sent to Trakt within seconds, and removals are mirrored too. The first sync also uploads anything Trakt was missing, without creating duplicate plays. You can turn two-way sync off in **Settings → Trakt**.

## 6. Notifications (optional)

ScreenGrave can send one message a day listing new episodes of shows you follow and movies on your watchlist that come out that day. Nothing is sent on days with nothing new, and nothing is sent twice.

In **Settings → Notifications**, pick a service, fill in its fields, choose a time, and press **Send test**:

| Service | What you need |
| --- | --- |
| ntfy | A topic name (add something random to it; on ntfy.sh anyone who knows the topic can read it). Subscribe to the same topic in the ntfy app. |
| Discord | A webhook URL: Server Settings → Integrations → Webhooks → New Webhook. |
| Gotify | Your server address and an app token. |
| Telegram | A bot token from @BotFather and your chat ID. |
| Webhook | Any URL that accepts a JSON POST (Home Assistant, n8n, and so on). |

---

## Updating

```bash
cd ScreenGrave
git pull
docker compose up -d --build
```

Your library is stored in a Docker volume, so updates never touch it.

## Backups

Your whole library lives in one file inside the `screengrave_screengrave-data` volume. To save a copy to the current folder:

```bash
docker compose stop
docker run --rm -v screengrave_screengrave-data:/data -v "$PWD":/backup alpine \
  cp /data/screengrave.db /backup/screengrave-backup.db
docker compose start
```

To restore, stop ScreenGrave, copy the file back the other way, and start it again:

```bash
docker compose stop
docker run --rm -v screengrave_screengrave-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -f /data/screengrave.db-wal /data/screengrave.db-shm && cp /backup/screengrave-backup.db /data/screengrave.db && chown 1000:1000 /data/screengrave.db"
docker compose start
```

> The volume name starts with the project folder's name. If you cloned into a folder other than `ScreenGrave`, run `docker volume ls` to find it.

## Useful commands

| Command | What it does |
| --- | --- |
| `docker compose ps` | Shows whether ScreenGrave is running and healthy. |
| `docker compose logs --tail 50` | Shows the latest log lines. Add `-f` to keep watching. |
| `docker compose restart` | Restarts it (for example, after editing `.env`). |
| `docker compose down` | Stops and removes the container. Your data stays in the volume. |

## Troubleshooting

- **The page doesn't load:** check `docker compose ps`, and make sure port 8787 isn't blocked by a firewall on the server (`sudo ufw allow 8787/tcp` on Ubuntu with ufw).
- **Posters and search are empty:** `TMDB_TOKEN` is missing or wrong. Fix it in `.env`, then `docker compose restart`.
- **"Wrong password" when you're sure it's right:** after changing `APP_PASSWORD` in `.env`, run `docker compose restart` so it takes effect.
- **Forgot your PIN or app password:** this clears only the sign-in (your library and Trakt connection stay), then the app asks you to choose again:
  ```bash
  docker compose exec screengrave node -e "new (require('node:sqlite').DatabaseSync)('/app/data/screengrave.db').exec(\"DELETE FROM settings WHERE key IN ('auth','auth_password'); DELETE FROM sessions\")"
  ```
  Open the app right after, since whoever opens it first gets to choose.
- **No notifications arrive:** press **Send test** in Settings. If the test fails, the message under the buttons says what the service replied.
- **Trakt says the code expired:** codes last a few minutes. Tap **Get a new code** and try again.
- **Anything else:** `docker compose logs --tail 50` usually says what went wrong.
