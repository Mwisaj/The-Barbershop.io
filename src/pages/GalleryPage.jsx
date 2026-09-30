import { Scissors, Star } from "lucide-react";
import chairImage from "../../images/download (4).jpg";

export function GalleryPage({ items = [] }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 font-body md:px-8">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rust)]">The experience</p>
        <h1 className="mt-3 font-head text-4xl text-[var(--foreground)] md:text-5xl">A fresh look, every time.</h1>
        <p className="mt-4 leading-7 text-[var(--text-soft)]">A glimpse into the calm, considered experience we bring to every appointment.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.id} className={`group relative aspect-square overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
            {item.src && <img src={item.src === 'default-chair' ? chairImage : item.src} alt={item.caption} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/75 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 flex items-center gap-2 p-5 text-white">
            <Scissors size={26} className="text-[var(--brass)]" />
            <span className="text-sm font-semibold">{item.caption}</span>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-[var(--text-soft)]">New photos coming soon.</p>}
      <h2 className="font-head text-xl text-[var(--foreground)] mt-12 mb-4">What clients say</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          ["Mwansa K.", "Booked a Sunday slot in two minutes, no waiting when I arrived."],
          ["Joseph B.", "Beard shaping was the best I've had in Lusaka — clean lines every time."],
        ].map(([n, q]) => (
          <div key={n} className="border border-[var(--line)] rounded-sm p-5">
            <div className="flex gap-0.5 text-[var(--brass)] mb-2">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
            <p className="text-sm text-[var(--foreground)]/90">"{q}"</p>
            <div className="text-xs text-[var(--text-soft)] mt-2">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
