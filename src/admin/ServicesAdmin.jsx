import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { storageSet } from "../lib/storage";

export function ServicesAdmin({ services, setServices }) {
  const [draft, setDraft] = useState({ name: "", duration: 30, price: 0 });
  async function save(list) { if (await storageSet("services", list, true)) setServices(list); }
  function addService() {
    if (!draft.name.trim()) return;
    save([...services, { id: "s" + Date.now(), name: draft.name, duration: Number(draft.duration), price: Number(draft.price) }]);
    setDraft({ name: "", duration: 30, price: 0 });
  }
  function updateField(id, field, value) {
    save(services.map((s) => (s.id === id ? { ...s, [field]: field === "name" ? value : Number(value) } : s)));
  }
  function remove(id) { save(services.filter((s) => s.id !== id)); }

  return (
    <div>
      <div className="space-y-2 mb-6">
        {services.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border border-[var(--line)] rounded-sm px-3 py-2">
            <input value={s.name} onChange={(e) => updateField(s.id, "name", e.target.value)}
              className="flex-1 min-w-[140px] bg-transparent outline-none border-b border-transparent focus:border-[var(--brass)]" />
            <input type="number" value={s.duration} onChange={(e) => updateField(s.id, "duration", e.target.value)}
              className="w-20 bg-transparent outline-none border-b border-transparent focus:border-[var(--brass)]" /> min
            <span>K</span>
            <input type="number" value={s.price} onChange={(e) => updateField(s.id, "price", e.target.value)}
              className="w-20 bg-transparent outline-none border-b border-transparent focus:border-[var(--brass)]" />
            <button onClick={() => remove(s.id)} className="text-[var(--rust)]"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
        <input placeholder="New service name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="border border-[var(--line)] rounded-sm px-3 py-2 flex-1 min-w-[160px]" />
        <input type="number" placeholder="Minutes" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
          className="border border-[var(--line)] rounded-sm px-3 py-2 w-24" />
        <input type="number" placeholder="Price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          className="border border-[var(--line)] rounded-sm px-3 py-2 w-24" />
        <button onClick={addService} className="bg-[var(--ink)] text-[var(--foreground)] px-4 py-2 rounded-sm flex items-center gap-1"><Plus size={15} />Add</button>
      </div>
    </div>
  );
}
