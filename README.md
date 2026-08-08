# PinturilloElements

A real-time multiplayer web game where one player draws the logo of a
tech company and the rest of the room races to guess which one it is.
Logos are recreated from memory on a constrained canvas and the round
is scored against the clock. Some players are humans, others are
player-owned AI agents that draw and guess under the same rules.

## Concept

PinturilloElements takes the Skribbl.io core loop and re-skins it
around a specific catalog: tech-company logos (Vercel, Supabase,
Obsidian, and the rest of the TryElements set). Instead of generic
words, the drawer's word pool is a small list of company names; the
drawer picks one and recreates its logo from their own knowledge of
the brand, and the official reference is shown to the whole room
only when the round ends.

The game is built to be played by humans and AI agents side by side.
Humans join with a pointer (mouse, pen, touch). Agents are owned by a
human and play under the same chat and drawing constraints: they draw
using the canvas's stroke primitives and they guess using the room's
chat. An agent is never given a separate channel that would let it
leak the answer.

## Core loop (Skribbl-style)

Each partida is a sequence of rondas. A ronda plays out as follows.

1. Word choice. The current drawer is presented with three company
   names pulled from the TryElements catalog, picks one, and from
   then on sees only the chosen name in the top bar. The other
   players see that the drawer is choosing and then see only the
   strokes appear.
2. Drawing phase. A 60-second countdown starts. The drawer draws the
   logo of the chosen company from their own knowledge of the brand
   on a restricted canvas: no text, no shapes, no images, no paste,
   only strokes, a small color palette plus a color picker, an
   eraser, undo, redo and a small set of stroke widths. No
   reference image is shown to the drawer at any point during the
   round.
3. Live guessing. The other players see the strokes appear live and
   type guesses in the room chat. A correct guess locks in a
   time-based score, with more points the earlier the correct guess
   lands inside the 60-second window. A wrong guess costs a small
   penalty so guessing blindly is not free.
4. Reveal and rotation. When the timer ends, the official reference
   image is shown to the whole room next to the drawing, the round's
   scores are added to the leaderboard, and the drawer role rotates
   to the next player.

A partida ends after a fixed number of rondas. The room then shows a
final leaderboard with the top guessers and the top drawers. Drawers
are scored on how many players guessed their logo.

## Roles

### Human

A human player joins a room with a name and a Petdex avatar. In a
ronda, a human is either the drawer or a guesser.

- As drawer: draws with the standard tool set (pen, eraser, undo,
  redo, palette, color picker, small / medium / large stroke width).
  Sees only the chosen company name in the top bar. Cannot type
  guesses in chat while drawing (Skribbl parity).
- As guesser: sees only the live canvas and the chat. Types guesses
  freely; correct guesses award points, wrong guesses deduct a small
  penalty.

### Agent

An agent is a player-owned AI that connects to a room on behalf of a
human owner. The owner configures the agent (model, style hints,
name, avatar) and can spectate its play. Agents participate in both
room roles and are bound by the same surface as humans.

- As drawer: the agent receives only the chosen company name, then
  emits a sequence of constrained canvas strokes through the same
  drawing API a human uses: pen tool, color, stroke width, short
  polyline-style segments. The agent's stroke stream is rate-limited
  and bounded in segment count so it draws under the same
  constraints as a human and cannot bypass the canvas tool set.
- As guesser: the agent types into the room chat using the same chat
  channel as a human. It never receives a side-channel answer, never
  sees the company name before the reveal, and never sees the
  reference image in any role during the round. The official
  reference is only shown to the whole room at the post-round
  reveal, not to any player during drawing. This keeps agents and
  humans on a level playing field.

Agents are players in the room, not a separate game mode. A room with
no humans is a valid agent-only partida, and a room with mixed
humans and agents is the intended default.

## Building blocks

PinturilloElements is designed as a thin game shell on top of three
existing systems.

- Portal. The intended realtime transport for rooms: presence,
  stroke streaming, chat, round state and timers. Portal is the
  source of truth for who is in the room, what the current round is
  and what the current timer shows. The local prototype does not
  connect to Portal.
- TryElements. The catalog of company entries the word picker draws
  from. Each entry bundles the company name, the official reference
  image shown to the room at the post-round reveal, and the brand
  metadata. The initial validation set is Vercel, Supabase and
  Obsidian.
- Petdex. The avatar system. Every player (human or agent) is
  represented by a Petdex entry that the room shows next to chat
  lines and on the leaderboard.

## Current status

This repository currently contains only a local throwaway drawing UX
prototype. It is a single-player, single-process, in-browser
experience that lets one person look at a reference logo, recreate
it from memory on a canvas with a basic tool set, and finally see a
side-by-side comparison of their drawing and the reference. There is
no backend, no multiplayer, no chat, no scoring, no agents, no
realtime transport, and no persistence beyond the current browser
session.

The multiplayer core loop, the agent role, the word picker, the
leaderboard, the realtime transport via Portal, the TryElements
catalog integration and the Petdex avatars are all **pending**. The
local prototype exists only to validate the in-hand feel of the
drawing tool before the multiplayer and agent layers are built on top
of it. The prototype is labelled `PROTOTYPE / THROWAWAY` in the UI
to make the gap obvious.

Nothing in the Concept, Core loop, Roles or Building blocks sections
above should be read as already shipped. The gap between those
sections and this Current status is the whole point of the
document.

## Running the local prototype

The repo has no production build. To run the local drawing prototype
on your machine:

```
npm start
```

That runs `npx serve prototype -p 3000 --single`, which serves the
contents of `prototype/` on http://localhost:3000. Open it in a
desktop or landscape-tablet browser; the prototype is not optimised
for small phones.

## Project layout

```
.
+- AGENTS.md        Local agent instructions and vault pointers.
+- opencode.json    Local editor config.
+- package.json     Single script: `npm start` serves the prototype.
+- prototype/
   +- index.html    Local single-player drawing UX prototype.
+- .vault-context/  Local symlinks to the project vault (gitignored).
```

The local prototype is the only thing in the repo today. The
multiplayer game, the agent role, the Portal integration, the
TryElements catalog and the Petdex avatar wiring are all expected to
live outside `prototype/` once the implementation starts, and the
prototype itself is expected to be retired (or at least moved out of
the main flow) once the multiplayer shell exists.
