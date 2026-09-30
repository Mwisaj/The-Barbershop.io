import { useState } from "react";
import { storageSet } from "../lib/storage";
import { PasswordAdmin } from "./PasswordAdmin";

export function SettingsAdmin({ settings, setSettings }) {
  const [draft, setDraft] = useState(settings);
  async function save() { if (await storageSet("settings", draft, true)) setSettings(draft); }
  const fields = [
    ["name", "Business name"], ["slogan", "Slogan"], ["address", "Address"], ["phone", "Phone"],
    ["whatsapp", "WhatsApp number (digits only, with country code)"], ["mapsUrl", "Google Maps link"],
    ["instagram", "Instagram link"], ["facebook", "Facebook link"], ["tiktok", "TikTok link"],
  ];
  return (
    <div className="max-w-lg space-y-3">
      {fields.map(([key, label]) => (
        <div key={key}>
          <label className="text-xs text-[var(--text-soft)]">{label}</label>
          <input value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
        </div>
      ))}
      <div>
        <label className="text-xs text-[var(--text-soft)]">Cancellation / late-arrival policy</label>
        <textarea value={draft.policy} onChange={(e) => setDraft({ ...draft, policy: e.target.value })} rows={3}
          className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
      </div>
      <button onClick={save} className="bg-[var(--accent-strong)] text-white px-6 py-2.5 rounded-sm font-medium">Save settings</button>
      <PasswordAdmin />
    </div>
  );
}

/* ---------------------------------------------------------------------
   APP ROOT
--------------------------------------------------------------------- */
