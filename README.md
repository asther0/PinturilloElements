# PinturilloElements

A real-time multiplayer web game where one player draws the logo of a
tech company and the rest of the room races to guess which one it is.
Logos are recreated from memory on a constrained canvas and the round
is scored against the clock. The shipped MVP has one human and one
built-in demo agent ("Bot") per room; a mix of humans and
player-owned AI agents is the design target, not the current state.

## Concept

PinturilloElements takes the Skribbl.io core loop and re-skins it
around a specific catalog: tech-company logos (Vercel, Supabase,
Obsidian, and the rest of the TryElements set). Instead of generic
words, the drawer's word pool is a small list of company names; the
drawer picks one and recreates its logo from their own knowledge of
the brand.

The design target is a mix of humans and AI agents playing side by
side under the same chat and drawing constraints: agents would draw
through the canvas's stroke primitives and guess through the room's
chat, without a side-channel answer and without seeing the target
before the round ends. The MVP does not yet implement that target:
today's room has one human and one built-in demo agent (see Roles),
and the demo agent is not connected to any model.

## Core loop (Skribbl-style)

Each partida is a sequence of rondas. A ronda plays out as follows.

1. Word choice. The current drawer is presented with three company
   names from a fixed 3-item validation set (Vercel, Supabase,
   Obsidian), picks one, and from then on sees only the chosen
   name in the top bar. The other players see that the drawer is
   choosing and then see only the strokes appear.
2. Drawing phase. A 60-second countdown starts. The drawer draws
   the logo of the chosen company from their own knowledge of the
   brand on a restricted canvas: no text, no shapes, no images, no
   paste, only strokes, a small fixed color palette, an eraser and
   three stroke widths. No reference image is shown to the drawer
   at any point during the round.
3. Live guessing. The other players see the strokes appear live and
   type guesses in the room chat. A correct guess locks in a
   time-based score, with more points the earlier the correct
   guess lands inside the 60-second window. Wrong guesses are
   appended to the chat but do not change the score.
4. Reveal and rotation. When the timer ends, the target word is
   shown in the chat and on a brief result screen, the round's
   scores are added to the leaderboard, and the drawer role
   rotates to the next player.

A partida ends after a fixed number of rondas (three by default).
When the last round's result beat ends, the room shows a final
leaderboard with the totals of each player and declares the winner.
A "Nueva partida" button resets the state and runs another set of
rondas with the same players.

## Roles

### Human

A human player joins a room with a name. In a ronda, a human is
either the drawer or a guesser.

- As drawer: draws with the available tool set (pen, eraser, a
  fixed 7-color palette, small / medium / large stroke width).
  Sees only the chosen company name in the top bar. Cannot type
  guesses in chat while drawing (Skribbl parity).
- As guesser: sees only the live canvas and the chat. Types
  guesses freely; correct guesses award points.

### Agent (MVP: built-in Bot)

The MVP ships a single built-in agent, "Bot", that is added to
every room as a second player alongside the human. Bot is a
deterministic local demo guesser. It does not call a model, has
no API key, no tokens, no LLM round-trip and no separate
transport. It runs in the same browser tab as the human and reads
the target word from the local game state. Once a drawing phase
starts it waits a random delay (10 to 40 seconds) and then posts
that target word into the room chat through the same channel a
human uses.

Bot is not the hackathon AI feature yet. The intended design for
a player-owned, model-backed agent is the one in Concept: a
constrained drawing API, a shared chat channel, no side-channel
answer, no reference image until reveal. Wiring that agent is a
follow-up.

## Building blocks

PinturilloElements is a thin game shell on top of three existing
systems.

- [Portal](https://docs.useportal.co/) -- the realtime transport for
  rooms: presence, stroke streaming, chat, round state and timers.
  Each client holds its own state machine and exchanges events
  through the Portal channel `room:<roomId>`. The MVP integrates
  Portal through `@portalsdk/core` and `@portalsdk/react`, and
  falls back to a single-process in-memory bus when no API key is
  configured (see Running the MVP below).
- [TryElements](https://github.com/crafter-station/elements) -- the
  catalog of company entries the word picker draws from. Each
  entry bundles the company name, the official reference image
  and the brand metadata. The MVP validation set is Vercel,
  Supabase and Obsidian. The catalog is currently a hard-coded
  3-item list in `lib/gameLogic.ts`; the full integration is not
  wired in the MVP.
- [Petdex](https://github.com/crafter-station/petdex) -- the avatar
  system. Every player is intended to be represented by a Petdex
  entry shown next to chat lines and on the leaderboard. Petdex is
  not wired in the MVP: the player list and chat show plain names.

## Current status

The repo ships an internal MVP: a Next.js 15 + React 19 web app
that runs the full Skribbl-style loop with Portal as the realtime
transport, a built-in Bot that plays as a second guesser, and a
hard-coded 3-item TryElements validation set (Vercel, Supabase,
Obsidian). The earlier single-player drawing prototype in
`prototype/` is kept for reference only and is not part of the
MVP flow.

What is currently shipped:

- Landing page that creates a new room or joins an existing one
  by id.
- Room page with the full Skribbl loop: 3 rounds by default,
  10-second word choice, 60-second drawing phase, 5-second result
  beat, drawer rotation, per-round scoring, end-of-game
  leaderboard and "Nueva partida".
- Drawing canvas with the round's tool set: pen, eraser, a
  fixed 7-color palette, three stroke widths.
- Chat panel with a player list, live scores, system messages
  and a guess input that is disabled while the local player is
  the drawer.
- A built-in Bot player that auto-guesses from 10 to 40 seconds
  into each drawing phase through the same chat channel humans
  use.
- Portal SDK integration for realtime transport, with an
  automatic local fallback (see below) so a single developer can
  play a full partida end-to-end on one machine.

## Current limits

The MVP is a working, playable client but is not a production
deployment.

- No deployed or authenticated backend. The app is a Next.js
  client. There is no server-side game state, no auth, no
  persistence beyond the current room session, and no historical
  leaderboards. Portal (or its local fallback) is the only state
  carrier.
- No AI provider. The built-in Bot does not call a model. It
  plays a hand-coded guesser behaviour in the same browser tab
  as the human, with no API key, no tokens and no LLM round-trip.
  Wiring a real player-owned, model-backed agent is a follow-up,
  not part of the MVP.
- TryElements and Petdex are referenced as building blocks but
  the catalog API and the avatar system are not yet integrated at
  runtime. The MVP uses a hard-coded 3-item word list and plain
  player names.
- Optimised for desktop and landscape tablet. Small phones are not
  a supported target.

## Running the MVP

The MVP is a Next.js 15 app. Bun is the package manager and
runner.

Install:

```
bun install
```

Start the dev server:

```
bun run dev
```

That runs `next dev` on http://localhost:3000. Open the URL in a
desktop or landscape-tablet browser. The landing page lets you
create a new room or join an existing one by id; both flows land
you in the same room client.

Other scripts:

- `bun run build` -- production build.
- `bun run start` -- start the production server.
- `bun run lint` -- `next lint`.

### Portal environment setup

Realtime transport goes through the Portal SDK
(`@portalsdk/core` + `@portalsdk/react`). Configure the
publishable API key (safe for browser bundles) and an optional
default room id in `.env.local`:

```
NEXT_PUBLIC_PORTAL_API_KEY=pk_live_...
NEXT_PUBLIC_ROOM_ID=demo
```

`.env.example` is the template. With a key set, rooms share state
across tabs and machines through the Portal channel
`room:<roomId>`. Without a key, the app silently falls back to a
local in-memory bus (see below).

### Local fallback

When `NEXT_PUBLIC_PORTAL_API_KEY` is missing or unset,
`components/PortalBridge.tsx` swaps the live Portal provider for a
local fallback provider that dispatches events inside the same
browser tab via an in-memory handler. This lets a single developer
open a room and play a full partida end-to-end on one machine,
with the same UI, the same round and timer logic and the same
Portal event types. It is a development affordance: no events
leave the tab and there is no multiplayer. To play with another
person on the network, configure a Portal key.

## Project layout

```
.
+- AGENTS.md            Local agent instructions and vault pointers.
+- opencode.json        Local editor config.
+- package.json         Next.js scripts and Portal SDK dependency.
+- .env.example         Template for NEXT_PUBLIC_PORTAL_API_KEY etc.
+- next.config.ts       Next.js config.
+- tailwind.config.ts   Tailwind config.
+- postcss.config.mjs   PostCSS config.
+- tsconfig.json        TypeScript config.
+- .eslintrc.json       ESLint config.
+- app/                 Next.js App Router entry points.
|  +- layout.tsx        Root layout.
|  +- page.tsx          Landing page (create / join room).
|  +- room/[id]/        Room page (room id route).
|     +- page.tsx       Server entry, suspense around the client.
|     +- RoomPageInner.tsx Reads ?name and forwards to client.
+- components/          Game UI and the PortalBridge provider.
|  +- PortalBridge.tsx  Provider, local fallback, handler hook.
|  +- RoomPageClient.tsx Room client (game state, phases, agent).
|  +- GameCanvas.tsx    Canvas, pen, eraser, palette, widths.
|  +- GameUI.tsx        Header (round, drawer, timer).
|  +- ChatPanel.tsx     Players, chat, guess input.
|  +- DrawingCanvas.tsx, DrawingTools.tsx, GameHeader.tsx,
|    PlayerList.tsx, WordPicker.tsx -- small UI helpers.
+- lib/                 Game logic and Portal event types.
|  +- gameLogic.ts      Phases, scoring, word picker, agent.
|  +- types.ts          Player, GameState, Stroke, PortalEvent.
+- prototype/           Earlier single-player HTML prototype
|                       (reference only; not served by the MVP).
+- .vault-context/      Local symlinks to the project vault
                        (gitignored).
```

The Next.js app under `app/` and `components/` is the MVP. The
`prototype/` folder is the earlier single-player drawing
prototype; it is not served by `bun run dev` and is kept only for
reference.
