import { useState } from "react";
import { storageGet, storageSet } from "../lib/storage";

export function BlockSlotForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState("");
  async function block() {
    if (!date || !time) return;
    try {
      const existing = await storageGet(`blocked:${date}`, true, []);
      if (await storageSet(`blocked:${date}`, [...new Set([...existing, time])], true)) setMsg(`Blocked ${time} on ${date}.`);
      else setMsg('Unable to block this slot. Please try again.');
    } catch (error) { setMsg(error.message); }
  }
  return (
    <div className="border-t border-[var(--line)] pt-6">
      <div className="text-sm font-medium text-[var(--foreground)] mb-2">Block a time slot</div>
      <p className="text-xs text-[var(--text-soft)] mb-3">Use this for breaks, holidays, or times you're unavailable.</p>
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[var(--line)] rounded-sm px-3 py-2" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="border border-[var(--line)] rounded-sm px-3 py-2" />
        <button onClick={block} className="bg-[var(--ink)] text-[var(--foreground)] px-4 py-2 rounded-sm">Block</button>
      </div>
      {msg && <p className="text-xs text-[var(--brass-dark)] mt-2">{msg}</p>}
    </div>
  );
}
