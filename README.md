# PinturilloElements

Real-time multiplayer web game. One player draws a tech-company logo
from memory on a constrained canvas while the rest of the room races
to guess the brand. A partida is a fixed sequence of rondas scored
against a 60-second clock. The MVP ships a single Skribbl-style loop
with room-funded AI agents and Bring-Your-Own-Key agents.

## How to play

A room runs one partida made of rondas. The default is three rondas.

| Phase | Duration | What happens |
| --- | --- | --- |
| Choosing | 10s | Drawer picks one of three company names from a hard-coded 3-item set (Vercel, Supabase, Obsidian). The pick is private. |
| Drawing | 60s | Drawer recreates the chosen logo with strokes only. No text, no shapes, no images, no reference. Guesser see the canvas live and chat. |
| Result | 5s | Target word is revealed. Per-round scores are added to the leaderboard. Drawer rotates. |

After the last ronda the room shows a final leaderboard and a winner.
A `Nueva partida` button restarts the sequence with the same roster.

## Drawing tools

- Pen, eraser, three stroke widths (small, medium, large)
- Fixed 7-color palette
- No text, no shapes, no image paste, no reference image

## Room modes

Each room has a host who picks one of two modes and the agent roster.

| Mode | Humans | Agents | Host role |
| --- | --- | --- | --- |
| `mixed` | 2 to 8 | 1 to 6 | Plays as human |
| `agents-only` | 0 | 1 to 6 | Watches as spectator |

Agents-only mode adds a `difficulty` setting (easy, medium, hard) that
the host picks when creating the room.

## Players

| Kind | Source | Behavior |
| --- | --- | --- |
| `human` | Joins via room code | Draws with the tool set or types guesses in chat. Guess input is disabled while drawing. |
| `room-agent` | Added by the host | Funded by the room. Reads strokes and asks a model for a guess via `/api/agent-guess`. Also draws predefined strokes for Vercel, Supabase, Obsidian when it is the drawer. |
| `agent-byok` | Future | Bring-Your-Own-Key agent. Not wired to a model in the MVP; uses a timed fallback guess. |

The MVP word pool is hard-coded to Vercel, Supabase, and Obsidian.

## Building blocks

- [Portal](https://docs.useportal.co/) -- realtime transport for rooms.
  Presence, stroke streaming, chat, round state and timers. Each client
  holds its own state machine and exchanges events through the Portal
  channel `room:<roomId>`. Integrated via `@portalsdk/core` and
  `@portalsdk/react`.
- [TryElements](https://github.com/crafter-station/elements) -- the
  catalog the word picker draws from. The MVP serves company logos
  directly from `https://tryelements.dev/r/svg/...` for the picker
  preview. The full catalog API is not wired; the word list itself
  is a hard-coded 3-item array in `lib/gameLogic.ts`.
- [Petdex](https://github.com/crafter-station/petdex) -- the avatar
  system. The join screen fetches pets from `/petdex-api/pets/search`
  and lets each player pick one. The room shows those avatars in the
  lobby roster and next to chat lines. The MVP ships a fallback list
  of six pets in case Petdex is unreachable.

## Local fallback

When `NEXT_PUBLIC_PORTAL_API_KEY` is missing, `components/PortalBridge.tsx`
swaps Portal for an in-memory bus inside the same browser tab. Same
Portal event types, same UI, same timers, no events leave the tab and
no cross-tab multiplayer. With the key set, rooms share state across
tabs and machines through Portal.

## Stack

- Next.js 15, React 19, App Router
- TypeScript, Tailwind CSS
- Portal SDK for realtime
- OpenAI SDK for room-funded agent guesses
- Bun as package manager and runner

## Bun commands

| Command | Effect |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start `next dev` on `http://localhost:3000` |
| `bun run build` | Production build |
| `bun run start` | Start the production server |
| `bun run lint` | `next lint` |

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PORTAL_API_KEY` | Client | Portal SDK publishable key. Without it the app falls back to the local in-memory bus. |
| `NEXT_PUBLIC_ROOM_ID` | Client | Default room id when none is supplied. Defaults to `demo`. |
| `OPENAI_API_KEY` | Server (`.env.local`, not `.env.example`) | OpenAI key used by `/api/agent-guess` for room-funded agents. |

## MVP status

- Landing page that creates or joins a room by id
- Room lobby with copyable room code and link, host edit modal, and a
  roster that includes humans and agents with Petdex avatars
- Full Skribbl loop: 3 rounds by default, 10s word choice, 60s drawing,
  5s result beat, drawer rotation, per-round scoring, end-of-game
  leaderboard, `Nueva partida`
- Drawing canvas with the round's tool set
- Chat panel with player list, live scores, system messages, and a
  guess input disabled for the drawer
- One room-funded agent per room when the host picks `agentCount >= 1`.
  The agent both draws predefined strokes and guesses via OpenAI
- Local fallback for single-developer play without a Portal key

## Known limits

- No deployed or authenticated backend. The app is a Next.js client.
  There is no server-side game state, no auth, no persistence beyond
  the current room session, and no historical leaderboards. Portal
  (or its local fallback) is the only state carrier.
- The agent guess endpoint needs `OPENAI_API_KEY`. Without it, room
  agents do not call a model. BYOK agents use a timed fallback guess
  in the MVP regardless of the key.
- The word pool is hard-coded to Vercel, Supabase, and Obsidian. The
  TryElements catalog API is not integrated.
- Optimised for desktop and landscape tablet. Small phones are not a
  supported target.
- The MVP validation set uses company logos. The vault notes this is
  for internal testing only and is not approval to redistribute brand
  assets at scale.

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
|  |  +- page.tsx       Server entry, suspense around the client.
|  |  +- RoomPageInner.tsx Reads ?name and forwards to client.
|  +- api/agent-guess/  Server route for room-funded agent guesses.
+- components/          Game UI and the PortalBridge provider.
|  +- PortalBridge.tsx  Provider, local fallback, handler hook.
|  +- RoomPageClient.tsx Room client (game state, phases, agents).
|  +- GameCanvas.tsx    Canvas, pen, eraser, palette, widths.
|  +- GameUI.tsx        Header (round, drawer, timer).
|  +- ChatPanel.tsx     Players, chat, guess input.
|  +- JoinRoomProfile.tsx Name + Petdex avatar picker.
+- lib/                 Game logic and Portal event types.
|  +- gameLogic.ts      Phases, scoring, word picker, agent factories.
|  +- types.ts          Player, GameState, Stroke, PortalEvent.
+- .vault-context/      Local symlinks to the project vault (gitignored).
```

The Next.js app under `app/` and `components/` is the MVP.
