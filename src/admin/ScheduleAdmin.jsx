import { DAY_NAMES } from "../lib/dateTime";
import { storageSet } from "../lib/storage";
import { BlockSlotForm } from "./BlockSlotForm";

export function ScheduleAdmin({ schedule, setSchedule, bumpRefresh }) {
  async function save(next) { if (await storageSet("schedule", next, true)) { setSchedule(next); bumpRefresh(); } }
  function toggleDay(d) {
    const enabledDays = schedule.enabledDays.includes(d)
      ? schedule.enabledDays.filter((x) => x !== d)
      : [...schedule.enabledDays, d].sort();
    save({ ...schedule, enabledDays });
  }
  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <div className="text-sm font-medium text-[var(--foreground)] mb-2">Appointment days</div>
        <p className="text-xs text-[var(--text-soft)] mb-3">Sunday is on by default. Switch on more days whenever you're ready — no rebuild needed.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES.map((name, d) => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`px-3 py-2 rounded-sm border text-sm ${schedule.enabledDays.includes(d) ? "bg-[var(--brass)] text-[var(--ink)] border-[var(--brass)]" : "border-[var(--line)] text-[var(--text-soft)]"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-[var(--text-soft)]">Opening time</label>
          <input type="time" value={schedule.openTime} onChange={(e) => save({ ...schedule, openTime: e.target.value })}
            className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-soft)]">Closing time</label>
          <input type="time" value={schedule.closeTime} onChange={(e) => save({ ...schedule, closeTime: e.target.value })}
            className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-soft)]">Slot length (min)</label>
          <input type="number" value={schedule.slotMinutes} onChange={(e) => save({ ...schedule, slotMinutes: Number(e.target.value) })}
            className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
        </div>
      </div>
      <BlockSlotForm />
    </div>
  );
}
