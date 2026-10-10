# Cyber Siege: Line Wars ⚔️🛡️

A real-time 1v1 multiplayer tug-of-war tower defense game built with **React**, **Vite**, **PartyKit**, and **HTML5 Canvas**.

---

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

## 🚀 Running Locally

### 1. Installation
```bash
npm install
```

### 2. Start Both Dev Servers
Run both client and multiplayer server in separate terminals:

```bash
# Terminal 1: Client Dev Server (port 3000)
npm run dev

# Terminal 2: PartyKit Multiplayer Server (port 1999)
npm run server:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 How to Deploy (Step-by-Step)

Deploying Cyber Siege is completely **free** and takes 2 simple steps:

### Step 1: Deploy the Multiplayer Server (Cloudflare Workers via Wrangler)
Cloudflare acquired PartyKit and now hosts PartyServer directly on your free Cloudflare account with zero limits or fees.

1. In your terminal, run:
   ```bash
   npx wrangler login
   ```
   *(Opens browser to log in or create a free Cloudflare account in 10 seconds)*

2. Deploy the server:
   ```bash
   npm run server:deploy
   # (or: npx wrangler deploy)
   ```
3. Once deployed, Wrangler outputs your live URL, for example:
   ```text
   Uploaded cyber-siege (X.XX sec)
   Deployed to https://cyber-siege.<your-subdomain>.workers.dev
   ```
4. Copy your live domain: `cyber-siege.<your-subdomain>.workers.dev`.

---

### Step 2: Deploy the Frontend to Vercel

1. Go to [Vercel](https://vercel.com/) and click **"Add New Project"**.
2. Select your GitHub repository: `Escanor244/cyber-siege`.
3. In the project configuration:
   - **Framework Preset**: Vite (detected automatically)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **"Environment Variables"** and add:
   - **Key**: `VITE_PARTYKIT_HOST`
   - **Value**: `cyber-siege.<your-username>.partykit.dev` *(from Step 1)*
5. Click **"Deploy"**.
6. In ~30 seconds, Vercel will give you a live production link (e.g. `https://cyber-siege.vercel.app`)!

---

## 📦 How to Create a Release on GitHub

To create a downloadable version release (e.g. `v1.0.0`):

1. Go to your repo on GitHub: [https://github.com/Escanor244/cyber-siege](https://github.com/Escanor244/cyber-siege)
2. On the right-hand sidebar, click **"Releases"** (or click **"Create a new release"**).
3. Click **"Draft a new release"**.
4. Click **"Choose a tag"**, type `v1.0.0`, and select **"Create new tag"**.
5. Set Release title: `Cyber Siege v1.0.0 - Production Launch`.
6. Add notes describing the release features and click **"Publish release"**.
7. GitHub will automatically attach `.zip` and `.tar.gz` source code downloads under that release!

---

## 📄 License
MIT
