# Node Chat — Neon CRT Terminal

Real-time chat app with a 90s/early-2000s “hacker” terminal vibe. Web clients use Socket.IO, and a Telnet bridge lets CLI users chat from a terminal.

## Features
- Real-time messaging via Socket.IO (web)
- Telnet bridge on TCP `2323` (configurable)
- Green-on-black CRT theme with scanlines/glow
- Auto-generated usernames; rename support
- Join/leave/rename system notices
- Basic XSS safety in the web client (HTML-escaped rendering)

## Quick Start
Requirements: Node.js 18+ recommended.

1. Install dependencies:
   - `npm install`
2. Start the server:
   - `npm start`
3. Open the web chat:
   - http://localhost:3000
4. Connect via Telnet (optional):
   - `telnet localhost 2323` (or `nc localhost 2323`)

## Usage
- Web: type in the input and press Enter to send.
- Set name (web): use the CALLSIGN field and click SET.
- Telnet: type `/name YourCallsign` to rename, then send messages normally.

Messages and system events are mirrored between web and telnet clients. Telnet messages show as `[HH:MM] name> text`.

## Configuration
Environment variables:
- `PORT` — HTTP server port (default: `3000`)
- `TELNET_PORT` — Telnet listener port (default: `2323`)

Examples:
- `PORT=8080 npm start`
- `TELNET_PORT=23 npm start`

## Project Structure
- `server.js` — Express + Socket.IO server and Telnet bridge
- `public/index.html` — Chat UI markup
- `public/styles.css` — Neon CRT hacker theme
- `public/client.js` — Client-side Socket.IO and UI logic

## Development
- Start in dev mode: `npm run dev`
- The server serves static files from `public/` and a `/health` endpoint for checks.

### Telnet Notes
- Basic Telnet negotiation sequences are stripped; standard clients work.
- Commands: `/name <callsign>`
- Output includes a small MOTD banner and timestamps.

## Security and Limitations
- Demo app: no authentication, no persistence, no rate limiting.
- Telnet is plaintext; do not expose the Telnet port to untrusted networks. If needed, tunnel over SSH or place behind a VPN.
- All data is in-memory; restarts clear users/history.

## Ideas to Extend
- Message history and persistence (e.g., SQLite/Redis)
- Rooms/channels and private messages
- Typing indicators and user list
- ANSI color for telnet, MOTD, and command help
- Optional TLS for web and secure remote access patterns
