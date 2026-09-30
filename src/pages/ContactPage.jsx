import { MapPin, MessageCircle, Phone } from "lucide-react";

export function ContactPage({ settings }) {
  return (
    <div className="font-body max-w-2xl mx-auto px-5 py-14">
      <h1 className="font-head text-3xl text-[var(--foreground)] mb-6">Location & Contact</h1>
      <div className="space-y-4 text-[var(--foreground)]">
        <div className="flex items-center gap-3"><Phone size={18} className="text-[var(--brass)]" />{settings.phone}</div>
        <div className="flex items-center gap-3"><MessageCircle size={18} className="text-[var(--brass)]" />WhatsApp: {settings.whatsapp}</div>
        <div className="flex items-center gap-3"><MapPin size={18} className="text-[var(--brass)]" />{settings.address}</div>
        <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="inline-block underline text-[var(--rust)]">Get directions on Google Maps</a>
      </div>
      <div className="mt-8 border border-[var(--line)] rounded-sm p-5 bg-[var(--paper-2)] aspect-video flex items-center justify-center text-sm text-[var(--text-soft)]">
        Embed your Google Maps location here
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   ADMIN DASHBOARD
--------------------------------------------------------------------- */
