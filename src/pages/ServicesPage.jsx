import { Clock } from "lucide-react";

export function ServicesPage({ services, setPage }) {
  return (
    <div className="font-body max-w-3xl mx-auto px-5 py-14">
      <h1 className="font-head text-3xl text-[var(--foreground)] mb-2">Services & Prices</h1>
      <p className="text-[var(--text-soft)] mb-8">Every price includes a wash-down and a straight-razor edge finish.</p>
      <div className="border border-[var(--line)] rounded-sm overflow-hidden">
        {services.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between px-5 py-4 ${i % 2 ? "bg-[var(--paper-2)]" : ""}`}>
            <div>
              <div className="font-medium text-[var(--foreground)]">{s.name}</div>
              <div className="text-sm text-[var(--text-soft)] flex items-center gap-1"><Clock size={13} />{s.duration} minutes</div>
            </div>
            <div className="font-head text-xl text-[var(--rust)]">K{s.price}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setPage("book")}
        className="mt-8 bg-[var(--accent-strong)] text-white px-6 py-3 rounded-sm font-medium hover:bg-[var(--ink)] transition-colors">
        Book an Appointment
      </button>
    </div>
  );
}

