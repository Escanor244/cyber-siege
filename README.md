# Cyber Siege: Line Wars ⚔️🛡️

A real-time 1v1 multiplayer tug-of-war tower defense game built with **React**, **Vite**, **PartyKit**, and **HTML5 Canvas**.

## 🎮 Gameplay Overview

In **Cyber Siege**, two commanders duel on mirrored battlegrounds. Players build defense towers along their sector pathway to eliminate oncoming waves while spending gold to spam monster raids, summon dread bosses, and cast orbital sabotages against the opponent!

- **Natural Waves**: Escalating waves arrive every 22 seconds on both lanes, granting gold bounties on survival.
- **Offensive Raids**: Send fast sprinters, armored mechs, drone swarms, and shield vanguard units directly into your opponent's lane.
- **Boss Summons**: Dispatch massive Cyber Behemoths and Void Reavers that deal devastating leak damage to the enemy Core.
- **Power Grid**: Independently upgrade your energy reactor to boost your gold income rate every 2 seconds.
- **Orbital Sabotages**: Deploy EMP stuns, frenzy surges, and precision orbital strikes to demolish enemy defense towers.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, Canvas Confetti
- **Multiplayer Backend**: PartyKit (Cloudflare Workers Durable Objects)
- **Audio**: Web Audio API Procedural Synthesizer
- **Styling**: Cyberpunk Glassmorphic Vanilla CSS

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation
```bash
npm install
```

### Running Locally
Run both client and multiplayer server in separate terminals:

```bash
# Terminal 1: Client Dev Server (port 3000)
npm run dev

# Terminal 2: PartyKit Multiplayer Server (port 1999)
npm run server:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Deployment

### 1. Multiplayer Backend (PartyKit)
```bash
npm run party:deploy
```
This deploys the WebSocket room coordinator to Cloudflare's global edge network.

### 2. Frontend (Vercel / Cloudflare Pages / Netlify)
Set the environment variable in your Vercel or hosting dashboard:
```env
VITE_PARTYKIT_HOST=cyber-siege.<your-partykit-username>.partykit.dev
```
Then build and deploy:
```bash
npm run build
```
The output will be generated in `dist/`.

---

## 📄 License
MIT
