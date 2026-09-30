import { Scissors, Phone, Clock, MapPin, Sparkles, Smile, Users, Zap, ArrowRight, Check, CalendarDays, ShieldCheck } from "lucide-react";
import { DAY_NAMES } from "../lib/dateTime";
import { HeroMedia } from "../components/HeroMedia";

function InfoItem({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10"><Icon size={20} className="text-[var(--brass)]" aria-hidden="true" /></div>
      <div><p className="font-medium text-[var(--foreground)]">{title}</p><p className="mt-0.5 text-sm text-[var(--text-soft)]">{subtitle}</p></div>
    </div>
  );
}

function ServiceCard({ icon: Icon, title, description, number, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-[var(--brass)] hover:shadow-xl">
      <span className="absolute right-5 top-4 font-head text-5xl text-[var(--foreground)]/[0.04] transition-colors group-hover:text-[var(--brass)]/10">{number}</span>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--brass)] shadow-md transition-all duration-300 group-hover:bg-[var(--brass)] group-hover:text-[var(--ink)]"><Icon size={22} aria-hidden="true" /></div>
      <h3 className="mt-6 font-head text-xl text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{description}</p>
      <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--rust)]">Book this service<ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" /></div>
    </button>
  );
}

const SERVICES = [
  { icon: Scissors, title: "Classic Haircut", description: "A clean, precise haircut professionally tailored to your style and personality." },
  { icon: Sparkles, title: "Beard Trim & Shape", description: "Detailed trimming, shaping and line-ups for a fresh, well-groomed finish." },
  { icon: Smile, title: "Kids Haircuts", description: "Friendly and patient grooming that keeps young clients comfortable and looking sharp." },
  { icon: Zap, title: "Fades & Designs", description: "Premium skin fades, tapers and custom hair designs for a bold modern look." },
];

export function HomePage({ setPage, settings, schedule }) {
  const enabledDays = schedule?.enabledDays ?? [];
  const openDayNames = enabledDays.map((day) => DAY_NAMES[day]).join(", ") || "By appointment";
  const openTime = schedule?.openTime || "08:00";
  const closeTime = schedule?.closeTime || "17:00";
  const businessName = settings?.name || "TJ Barbershop";
  const slogan = settings?.slogan || "Premium grooming delivered to your doorstep";
  const address = settings?.address || "Serving your local area";
  const phone = settings?.phone || "";
  const phoneLink = phone.replace(/[^\d+]/g, "");

  return (
    <main className="overflow-hidden bg-[var(--paper)] font-body">
      <section className="relative isolate overflow-hidden bg-[var(--ink)] text-white" aria-labelledby="hero-heading">
        <HeroMedia />
        <div className="absolute inset-0 -z-10 bg-black/65 md:bg-black/35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
        <div className="mx-auto flex min-h-[680px] max-w-6xl flex-col justify-center px-5 py-20 md:min-h-[740px] md:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h1 id="hero-heading" className="font-head text-5xl leading-[1.08] text-white sm:text-6xl lg:text-8xl">Fresh Haircut.<span className="block text-[var(--cta)]">Feel confident.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80">Skip the queues and crowded barbershops. We bring professional grooming directly to your home, giving you convenience, comfort and a premium haircut experience.</p>
            <div className="mt-7 grid max-w-xl gap-3 text-sm text-white/90 sm:grid-cols-2">
              {['Professional home service', 'Simple online booking', 'Clean and hygienic tools', 'Grooming for all ages'].map(benefit => <div key={benefit} className="flex items-center gap-2"><Check size={17} className="shrink-0 text-[var(--brass)]" aria-hidden="true" />{benefit}</div>)}
            </div>
            <div className="mt-9 flex flex-wrap gap-4">
              <button type="button" onClick={() => setPage('book')} className="group flex items-center gap-2 rounded-lg bg-[var(--cta)] px-7 py-4 font-semibold text-[var(--ink)] shadow-lg transition hover:-translate-y-1 hover:bg-[var(--cta-hover)]">Book an Appointment<ArrowRight size={18} className="booking-button-icon transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
              {phone && <a href={'tel:' + phoneLink} aria-label={'Call ' + businessName} className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur-sm transition hover:-translate-y-1 hover:bg-white/15 hover:text-white"><Phone size={18} aria-hidden="true" />Call Now</a>}
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-white/20 pt-5 text-sm text-white/80"><CalendarDays size={19} className="shrink-0 text-[var(--brass)]" aria-hidden="true" /><p>Available on <span className="font-semibold text-white">{openDayNames}</span></p></div>
          </div>
        </div>
      </section>
      <section className="border-y border-[var(--line)] bg-[var(--paper-2)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
          <InfoItem icon={Clock} title={`Available ${openDayNames}`} subtitle={`${openTime} – ${closeTime}`} />
          <InfoItem icon={MapPin} title={address} subtitle="Mobile service delivered to your location" />
          <InfoItem icon={Phone} title={phone || "Contact us"} subtitle="Call or WhatsApp for assistance" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rust)]">Our services</p>
            <h2 className="mt-3 font-head text-4xl leading-tight text-[var(--foreground)] md:text-5xl">Premium grooming for every style</h2>
            <p className="mt-4 leading-7 text-[var(--text-soft)]">Choose your preferred grooming service and reserve a convenient appointment time in just a few steps.</p>
          </div>
          <button type="button" onClick={() => setPage("book")} className="group flex w-fit items-center gap-2 font-semibold text-[var(--rust)]">View available slots<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{SERVICES.map((service, index) => <ServiceCard key={service.title} {...service} number={String(index + 1).padStart(2, "0")} onClick={() => setPage("book")} />)}</div>
      </section>
      <section className="bg-[var(--paper-2)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rust)]">Why choose us</p>
            <h2 className="mt-3 font-head text-4xl text-[var(--foreground)]">The barbershop comes to you</h2>
            <p className="mt-5 leading-7 text-[var(--text-soft)]">Our service is designed for busy clients who want excellent grooming without travelling or waiting in long queues.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--paper)] p-6 shadow-sm"><Clock size={24} className="text-[var(--brass)]" aria-hidden="true" /><h3 className="mt-4 font-head text-lg text-[var(--foreground)]">Save valuable time</h3><p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">Book online and avoid travelling or waiting in a queue.</p></div>
            <div className="rounded-xl bg-[var(--paper)] p-6 shadow-sm"><ShieldCheck size={24} className="text-[var(--brass)]" aria-hidden="true" /><h3 className="mt-4 font-head text-lg text-[var(--foreground)]">Clean and professional</h3><p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">Quality grooming using clean tools and professional techniques.</p></div>
          </div>
        </div>
      </section>
      <section className="relative overflow-hidden bg-[var(--ink)]">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[var(--brass)]/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 md:flex-row md:items-center md:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brass)]"><Users size={24} className="text-[var(--ink)]" aria-hidden="true" /></div>
            <div><h2 className="font-head text-3xl text-[var(--foreground)]">Ready for your fresh new look?</h2><p className="mt-2 max-w-xl leading-6 text-[var(--foreground)]/65">Reserve your appointment for {openDayNames}. Booking takes less than a minute.</p></div>
          </div>
          <button type="button" onClick={() => setPage("book")} className="group flex shrink-0 items-center gap-2 rounded-lg bg-[var(--cta)] px-7 py-4 font-semibold text-[var(--ink)] transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--cta-hover)]">Book an Appointment<ArrowRight size={18} className="booking-button-icon transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
        </div>
      </section>
    </main>
  );
}
