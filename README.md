# PinturilloElements

[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Portal](https://img.shields.io/badge/Portal-realtime-4B32C3)](https://docs.useportal.co/)
[![TryElements](https://img.shields.io/badge/TryElements-catalog-111111)](https://github.com/crafter-station/elements)
[![Petdex](https://img.shields.io/badge/Petdex-avatars-111111)](https://github.com/crafter-station/petdex)

Real-time multiplayer web game. One player draws a tech-company logo
from memory on a constrained canvas while the rest of the room races
to guess the brand. A partida is a fixed sequence of rondas scored
against a timed clock. Human-only rooms: 2 to 8 players, host-driven
setup, no bots or AI.

[![Screenshot-2026-08-09-at-8-54-49-PM.png](https://i.postimg.cc/TYmMf3sR/Screenshot-2026-08-09-at-8-54-49-PM.png)](https://postimg.cc/dLqS9wvX)

## How to play

A room runs one partida made of rondas. The default is three rondas.

| Phase | Duration | What happens |
| --- | --- | --- |
| Choosing | 10s | Drawer picks one of three company names from the TryElements catalog. The pick is private. |
| Drawing | 45-90s | Drawer recreates the chosen logo with strokes only. No text, no shapes, no images, no reference. Guessers see the canvas live and chat. |
| Result | 5s | Target word is revealed. Per-round scores are added to the leaderboard. Drawer rotates. |

After the last ronda the room shows a final leaderboard and a winner.
A `Nueva partida` button restarts the sequence with the same roster.

## Drawing tools

- Pen, eraser, three stroke widths (small, medium, large)
- Fixed 7-color palette
- No text, no shapes, no image paste, no reference image

## Room setup

The host creates a public room and configures:

- Human capacity: 2 to 8 players
- Rondas: 3, 4, or 5
- Draw time: 45, 60, or 90 seconds
- Late-join policy: spectator or closed
- Logo source: full TryElements catalog (206 logos) or filtered collections

Guests join via room code. All players are human. No agents, no bots,
no AI guessing, no BYOK.

## Players

| Kind | Source | Behavior |
| --- | --- | --- |
| `human` | Joins via room code | Draws with the tool set or types guesses in chat. Guess input is disabled while drawing. |

## Building blocks

- [Portal](https://docs.useportal.co/) -- realtime transport for rooms.
  Presence, stroke streaming, chat, round state and timers. Each client
  holds its own state machine and exchanges events through the Portal
  channel `room:<roomId>`. Integrated via `@portalsdk/core` and
  `@portalsdk/react`.
- [TryElements](https://github.com/crafter-station/elements) -- the
  catalog the word picker draws from. The MVP serves company logos
  directly from `https://tryelements.dev/r/svg/...` for the picker
  preview. The word picker uses a generated catalog snapshot in
  `lib/logoCollections.ts`.

  [![image.png](https://i.postimg.cc/sxkcTyPL/image.png)](https://postimg.cc/zHkKfscw)
- [Petdex](https://github.com/crafter-station/petdex) -- the avatar
  system. The join screen fetches pets from `/petdex-api/pets/search`
  and lets each player pick one. The room shows those avatars in the
  lobby roster and next to chat lines. The MVP ships a fallback list
  of six pets in case Petdex is unreachable.

  [![image.png](https://i.postimg.cc/SRJTZDB6/image.png)](https://postimg.cc/5QWSyqNy)

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

## MVP status

- Landing page that creates or joins a room by id
- Room lobby with copyable room code, host edit modal, and a human
  roster with Petdex avatars
- Full Skribbl loop: 3 rounds by default, 10s word choice, 60s drawing,
  5s result beat, drawer rotation, per-round scoring, end-of-game
  leaderboard, `Nueva partida`
- Drawing canvas with the round's tool set
- Chat panel with player list, live scores, system messages, and a
  guess input disabled for the drawer
- Local fallback for single-developer play without a Portal key

## Known limits

- No deployed or authenticated backend. The app is a Next.js client.
  There is no server-side game state, no auth, no persistence beyond
  the current room session, and no historical leaderboards. Portal
  (or its local fallback) is the only state carrier.
- The TryElements catalog is imported as a generated snapshot rather than
  requested live at runtime.
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
+- components/          Game UI and the PortalBridge provider.
|  +- PortalBridge.tsx  Provider, local fallback, handler hook.
|  +- RoomPageClient.tsx Room client (game state, phases).
|  +- GameCanvas.tsx    Canvas, pen, eraser, palette, widths.
|  +- GameUI.tsx        Header (round, drawer, timer).
|  +- ChatPanel.tsx     Players, chat, guess input.
|  +- JoinRoomProfile.tsx Name + Petdex avatar picker.
+- lib/                 Game logic and Portal event types.
|  +- gameLogic.ts      Phases, scoring, word picker.
|  +- types.ts          Player, GameState, Stroke, PortalEvent.
+- .vault-context/      Local symlinks to the project vault (gitignored).
```

The Next.js app under `app/` and `components/` is the MVP.

## Next improvements

- Optional AI-agent players
- Infrastructure optimization
