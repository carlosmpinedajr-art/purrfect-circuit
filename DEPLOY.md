# Purrfect Circuit — Deployment

The game is a Node.js server that serves the static client and runs Socket.io multiplayer.

## Requirements

- Node.js 18+ (22 recommended)
- Port `3000` by default (or set `PORT`)

## Local / LAN hosting

```bash
cd "Race Game"
npm install
npm start
```

Open `http://localhost:3000` on each player's machine. For LAN play, use the host machine's IP: `http://192.168.x.x:3000`.

## Docker

```bash
docker build -t purrfect-circuit .
docker run -p 3000:3000 purrfect-circuit
```

## Render (free tier)

1. Push this folder to a GitHub repo.
2. In [Render](https://render.com), create a **Web Service** from the repo.
3. Use `render.yaml` in the repo root, or set manually:
   - **Build command:** `npm ci --omit=dev`
   - **Start command:** `node server/index.js`
   - **Health check path:** `/health`
4. Deploy. Share the Render URL with players (e.g. `https://purrfect-circuit.onrender.com`).

Free tier may sleep after inactivity; the first visit can take ~30s to wake.

## Railway / Fly.io

Same start command: `node server/index.js`  
Set `PORT` from the platform's environment variable.

## Environment variables

| Variable   | Default | Description        |
|-----------|---------|--------------------|
| `PORT`    | `3000`  | HTTP listen port   |
| `NODE_ENV`| —       | Set to `production` in deploy |

## Multiplayer notes

- Players must use the **server URL**, not `file://`.
- **Mid-race reconnect:** refresh the page; the browser restores your session from local storage and rejoins via `room:rejoin`.
- Rooms expire after 2 hours of server uptime without cleanup restart.
- Only the **host** can skip the race or start training/race from lobby/lineup.

## Health check

`GET /health` returns `{ "ok": true, "service": "purrfect-circuit" }`.