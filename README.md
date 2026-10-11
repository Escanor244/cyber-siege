# Cyber Siege: Line Wars ⚔️🛡️

A real-time 1v1 tug-of-war tower defense game: **React + Vite + HTML5 Canvas** on the front end, a **Cloudflare Worker + Durable Object** (via `partyserver`) for multiplayer, and a full solo mode against an AI opponent.

---

## 🎮 Gameplay

- **Natural waves** every 22 seconds on both lanes (hand-made waves 1–8, then endless escalation with a boss every 4th wave).
- **Kill bounties**: every creep you destroy pays gold.
- **Raids & bosses**: send creeps down your opponent's lane.
- **Sabotage**: EMP (stuns 2 enemy turrets), Frenzy (faster enemy creeps), Orbital Strike (destroys a turret). Cooldowns are enforced by the server.
- **Power grid**: permanent income upgrades.
- **Armor types**:
  - Gatlings shred light units but bounce off mechs.
  - Mortars crack heavy armor.
  - Tesla breaks Aegis shields.
  - Railguns destroy bosses.
- **Targeting modes** per turret: first / last / strongest / closest.
- **Solo skirmish**: Easy / Normal / Hard. Smarter bots place turrets for path coverage and counter-pick raids against your turret types.
- **Phones & tablets**: tap a tile → range preview → ✓ to build. On phones the enemy board collapses into a bar you can expand.

---

## 🧱 Architecture

```
src/shared/      Pure game rules — run on the server AND in the browser (no DOM, seeded RNG)
  config/        towers, creeps, spells, economy, waves, map, rule constants
  rules/         reducer (all game rules), validation, creep ledger, wave generator, state
  sim/           deterministic lane simulation (creeps, towers, projectiles, damage)
  room/          RoomCore: joins, phases, clock, pause/forfeit, persistence hooks
  bot/           solo AI
party/index.js   Cloudflare Durable Object adapter around RoomCore
src/net/         client store, WebSocket transport, in-browser room for solo, bot client
src/game/        own-lane controller (runs the sim, reports kills/leaks), enemy-lane view
src/render/      canvas renderer, art, effects, auto graphics quality
src/components/  React UI
tests/           Vitest unit + integration tests
```

**Who decides what.** The server owns gold, towers, spells, cooldowns, hp, waves and the result. Each player's browser simulates their *own* lane at 60 fps and reports which creeps it killed or leaked. The server's **creep ledger** pays each bounty once and applies each leak once. If a creep is never reported (for example a frozen background tab), the server counts it as a leak.

**Solo mode** runs the same `RoomCore` in the browser, with the AI as a second player that plays through the same rules. Solo and multiplayer can't drift apart.

---

## 🚀 Running locally

```bash
npm install
npm run server:dev   # multiplayer server (Cloudflare Worker) on :1999
npm run dev          # game on http://localhost:3000
```

Solo mode works without the server.

### Tests & checks

```bash
npm test             # unit + integration tests (rules, simulation, rooms, solo, bots)
npm run lint
npm run build
```

---

## 🌐 Deploying (free tiers)

### 1. Multiplayer server → Cloudflare Workers

```bash
npx wrangler login
npm run server:deploy
```

Wrangler prints your URL, e.g. `https://cyber-siege.<you>.workers.dev`.

### 2. Frontend → Vercel

1. Import the GitHub repo in Vercel (framework preset: **Vite**, build `npm run build`, output `dist`).
2. Add the environment variable:
   ```env
   VITE_PARTYKIT_HOST=cyber-siege.<you>.workers.dev
   ```
3. Deploy. Redeploy whenever you change the variable, because it's baked in at build time.

> The server and client must be deployed from the same version. The game checks a protocol version and asks players to refresh if they don't match.

---

## 📄 License
MIT
