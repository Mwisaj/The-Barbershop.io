import { useState } from "react";
import { whatsappUrl } from "../lib/whatsapp.js";
import { Scissors, Phone, MapPin, MessageCircle, Menu, Instagram, Facebook, Music2 } from "lucide-react";

export function NavBar({ page, setPage, settings }) {
  const [open, setOpen] = useState(false);
  const links = [
    ["home", "Home"], ["services", "Services & Prices"], ["book", "Book"],
    ["gallery", "Gallery"], ["about", "About"], ["contact", "Contact"],
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--ink)]/95 text-[var(--foreground)] shadow-lg backdrop-blur-md font-body">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <button onClick={() => setPage("home")} className="group flex items-center gap-3 font-head text-lg tracking-wide">
          <span>{settings.name}</span>
        </button>
        <nav className="hidden items-center gap-5 md:flex text-sm">
          {links.map(([id, label]) => (
            <button key={id} onClick={() => setPage(id)}
              className={`relative py-2 transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-left after:rounded-full after:bg-[var(--brass)] after:transition-transform ${page === id ? "text-[var(--brass)] after:scale-x-100" : "text-[var(--foreground)]/75 after:scale-x-0 hover:text-[var(--foreground)] hover:after:scale-x-100"}`}>
              {label}
            </button>
          ))}
          <button onClick={() => setPage("book")}
            className="ml-2 rounded-full bg-[var(--cta)] px-5 py-2.5 font-semibold text-[var(--ink)] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--cta-hover)]">
            Book an Appointment
          </button>
        </nav>
        <button aria-label="Toggle navigation menu" className="rounded-lg p-2 transition-colors hover:bg-white/10 md:hidden" onClick={() => setOpen(!open)}><Menu size={22} /></button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-5 py-4 text-sm md:hidden">
          {links.map(([id, label]) => (
            <button key={id} className={`rounded-lg px-3 py-2.5 text-left ${page === id ? "bg-white/10 text-[var(--brass)]" : "text-[var(--foreground)]/80"}`} onClick={() => { setPage(id); setOpen(false); }}>{label}</button>
          ))}
          <button onClick={() => { setPage("book"); setOpen(false); }} className="mt-2 rounded-full bg-[var(--cta)] px-4 py-3 text-left font-semibold text-[var(--ink)] hover:bg-[var(--cta-hover)]">Book an Appointment</button>
        </div>
      )}
    </header>
  );
}

export function Footer({ settings, setPage }) {
  return (
    <footer className="mt-16 bg-[var(--ink)] text-[var(--foreground)] font-body">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-sm sm:grid-cols-3 md:px-8">
        <div>
          <div className="mb-3 flex items-center gap-2 font-head text-lg text-[var(--foreground)]"><Scissors size={18} className="text-[var(--brass)]" />{settings.name}</div>
          <p className="max-w-xs leading-6 text-[var(--foreground)]/65">{settings.slogan}</p>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brass)]">Contact</div>
          <div className="mb-2 flex items-center gap-2 text-[var(--foreground)]/80"><Phone size={14} className="text-[var(--brass)]" />{settings.phone}</div>
          <div className="flex items-center gap-2 text-[var(--foreground)]/80"><MapPin size={14} className="text-[var(--brass)]" />{settings.address}</div>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brass)]">Manage a booking</div>
          <button onClick={() => setPage("manage")} className="text-left leading-6 text-[var(--foreground)]/80 underline decoration-[var(--brass)]/60 underline-offset-4 hover:text-[var(--brass)]">Reschedule or cancel with your reference</button>
          <div className="mt-5 flex gap-3">
            <a href={settings.instagram} target="_blank" rel="noreferrer"><Instagram size={18} /></a>
            <a href={settings.facebook} target="_blank" rel="noreferrer"><Facebook size={18} /></a>
            <a href={settings.tiktok} target="_blank" rel="noreferrer"><Music2 size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFAB({ settings }) {
  return (
    <a href={whatsappUrl(settings.whatsapp)} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/20 transition-transform hover:scale-110">
      <MessageCircle size={22} />
    </a>
  );
}
