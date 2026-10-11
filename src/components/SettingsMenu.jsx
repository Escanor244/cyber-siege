// Settings: volume, graphics quality, damage numbers, reduced motion.
import { useSyncExternalStore, useState } from "react";
import { X } from "lucide-react";
import { settings } from "../lib/settings.js";
import { sound } from "../audio/soundFx.js";

export default function SettingsMenu({ onClose, onShowTutorial }) {
  const s = useSyncExternalStore(settings.subscribe, settings.get);
  const [volume, setVolume] = useState(Math.round(sound.volume * 100));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <div className="modal-container settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2 id="settings-title" className="settings-title">
            SETTINGS
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <label className="setting-row">
          <span>MASTER VOLUME</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              sound.setVolume(v / 100);
            }}
            onPointerUp={() => sound.playCoin()}
          />
          <span className="setting-val">{volume}%</span>
        </label>

        <div className="setting-row">
          <span>GRAPHICS</span>
          <div className="segmented" role="radiogroup" aria-label="Graphics quality">
            {["auto", "high", "low"].map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={s.quality === q}
                className={`segment segment-sm ${s.quality === q ? "segment-active" : ""}`}
                onClick={() => settings.set({ quality: q })}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <label className="setting-row">
          <span>DAMAGE NUMBERS</span>
          <input type="checkbox" checked={s.damageNumbers} onChange={(e) => settings.set({ damageNumbers: e.target.checked })} />
        </label>

        <label className="setting-row">
          <span>REDUCED MOTION</span>
          <input type="checkbox" checked={s.reducedMotion} onChange={(e) => settings.set({ reducedMotion: e.target.checked })} />
        </label>

        <div className="modal-actions mt-3">
          <button type="button" className="action-secondary-btn" onClick={onShowTutorial}>
            SHOW TUTORIAL AGAIN
          </button>
          <button type="button" className="action-primary-btn" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
