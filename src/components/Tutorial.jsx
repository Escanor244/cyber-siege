// First-run coach: five short steps, skippable, remembered per browser.
import { useState } from "react";
import { Shield, Swords, Skull, BatteryCharging, Target } from "lucide-react";

const STEPS = [
  { Icon: Target, title: "DEFEND YOUR CORE", text: "Creeps walk the glowing path toward your reactor core (right side). Every creep that reaches it costs core HP. Hit 0 and you lose." },
  { Icon: Shield, title: "BUILD TURRETS", text: "Pick a turret in DEFENSE (or press 1–5), then click an empty tile. On touch screens tap a tile, check the range preview, then tap ✓ to build." },
  { Icon: Swords, title: "EARN & ATTACK", text: "Kills pay bounty gold. Spend it in RAIDS to send creeps down your opponent's lane — their screen shows on the right (or the minimap on phones)." },
  { Icon: Skull, title: "BOSSES & SABOTAGE", text: "Summon bosses, EMP enemy turrets, speed up their creeps or orbital-strike a turret. Each spell has a cooldown." },
  { Icon: BatteryCharging, title: "GROW YOUR ECONOMY", text: "POWER GRID upgrades raise your income every 2 seconds. Waves arrive every 22s and get harder — balance defense, offense and economy!" },
];

export default function Tutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const { Icon, title, text } = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="modal-overlay tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="modal-container tutorial-card">
        <div className="tutorial-step">
          STEP {step + 1} / {STEPS.length}
        </div>
        <div className="mode-icon-box">
          <Icon size={30} className="ic-cyan" />
        </div>
        <h2 id="tutorial-title" className="tutorial-title">
          {title}
        </h2>
        <p className="modal-subtitle">{text}</p>
        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`dot ${i === step ? "dot-on" : ""}`} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button type="button" className="action-secondary-btn" onClick={onDone}>
            SKIP
          </button>
          <button type="button" className="action-primary-btn" onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? "LET'S GO" : "NEXT"}
          </button>
        </div>
      </div>
    </div>
  );
}
