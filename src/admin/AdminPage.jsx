import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { api, storageGet, storageKeys, storageSet } from "../lib/storage";
import { ServicesAdmin } from "./ServicesAdmin";
import { ScheduleAdmin } from "./ScheduleAdmin";
import { SettingsAdmin } from "./SettingsAdmin";
import { GalleryAdmin } from "./GalleryAdmin";
import { PasswordRecovery } from './PasswordRecovery';

import { friendlyDate, isoDate } from "../lib/dateTime";
import { BookingLocation } from "./BookingLocation";


export function AdminPage({ services, setServices, schedule, setSchedule, settings, setSettings, gallery, setGallery, refreshSignal, bumpRefresh }) {
  const [authed, setAuthed] = useState(false);
  const [recovering, setRecovering] = useState(() => window.location.hash.startsWith('#admin?reset='));
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [tab, setTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("upcoming");

  useEffect(() => {
    api('/auth/session').then(result => setAuthed(result.authenticated)).catch(() => setAuthError('Unable to connect. Please try again.'));
    const expired = () => { setAuthed(false); setBookings([]); setAuthError('Please sign in again.'); };
    const saveError = event => setAuthError(event.detail);
    window.addEventListener('admin-session-expired', expired);
    window.addEventListener('admin-save-error', saveError);
    return () => { window.removeEventListener('admin-session-expired', expired); window.removeEventListener('admin-save-error', saveError); };
  }, []);
  async function login(event) {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true); setAuthError('');
    try {
      await api('/auth/login', { method: 'POST', body: { password } });
      setPassword(''); setAuthed(true);
    } catch (error) { setAuthError(error.message); }
    finally { setSigningIn(false); }
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      setAuthed(false); setBookings([]); setPassword(''); setAuthError('');
    } catch (error) { setAuthError(error.message); }
  }

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const keys = await storageKeys("bookings:", true);
    const out = [];
    for (const k of keys) {
      const booking = await storageGet(k, true, null);
      if (booking) out.push(booking);
    }
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setBookings(out);
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) loadBookings().catch(error => { setLoading(false); setAuthError(error.message); }); }, [authed, tab, refreshSignal, loadBookings]);

  async function updateBookingStatus(b, status) {
    const updated = { ...b, status };
    if (await storageSet(`bookings:${b.reference}`, updated, true)) {
      loadBookings().catch(error => setAuthError(error.message));
    }
  }

  if (recovering) return <PasswordRecovery onBack={() => { setRecovering(false); setAuthed(false); setAuthError(''); }} />;
  if (!authed) {
    return (
      <div className="font-body max-w-sm mx-auto px-5 py-20 text-center">
        <Lock size={30} className="mx-auto text-[var(--brass)] mb-3" />
        <h1 className="font-head text-2xl text-[var(--foreground)] mb-4">Admin Login</h1>
        <form onSubmit={login}>
        <label htmlFor="admin-password" className="block mb-2 text-sm">Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)] text-center tracking-widest" />
        <button type="submit" disabled={signingIn}
          className="mt-3 w-full bg-[var(--ink)] text-[var(--foreground)] px-6 py-3 rounded-sm font-medium disabled:opacity-50">{signingIn ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <button type="button" onClick={() => { setRecovering(true); setAuthError(''); setPassword(''); }} className="mt-5 text-sm underline">Forgot password?</button>
        {authError && <p role="alert" className="mt-4 text-sm text-[var(--rust)]">{authError}</p>}
      </div>
    );
  }

  const today = isoDate(new Date());
  const filtered = bookings.filter((b) => {
    if (filter === "today") return b.date === today;
    if (filter === "upcoming") return b.date >= today && b.status !== "cancelled";
    if (filter === "cancelled") return b.status === "cancelled";
    return true;
  });

  const stats = {
    total: bookings.length,
    upcoming: bookings.filter((b) => b.date >= today && b.status !== "cancelled").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    revenue: bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0),
  };

  return (
    <div className="font-body max-w-5xl mx-auto px-5 py-10">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck size={20} className="text-[var(--brass)]" />
        <h1 className="font-head text-2xl text-[var(--foreground)]">Admin Dashboard</h1>
        <button onClick={logout} className="ml-auto text-sm underline">Sign out</button>
      </div>
      {authError && <p role="alert" className="mb-4 text-sm text-[var(--rust)]">{authError}</p>}

      <div className="flex gap-2 mb-8 border-b border-[var(--line)] text-sm overflow-x-auto">
        {["bookings", "services", "schedule", "gallery", "settings", "stats"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 capitalize whitespace-nowrap ${tab === t ? "border-b-2 border-[var(--rust)] text-[var(--rust)]" : "text-[var(--text-soft)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "bookings" && (
        <div>
          <div className="flex gap-2 mb-4 text-sm">
            {["today", "upcoming", "cancelled", "all"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-sm border capitalize ${filter === f ? "bg-[var(--ink)] text-[var(--foreground)] border-[var(--ink)]" : "border-[var(--line)] text-[var(--text-soft)]"}`}>{f}</button>
            ))}
          </div>
          {loading ? <p className="text-[var(--text-soft)]">Loading…</p> : filtered.length === 0 ? (
            <p className="text-[var(--text-soft)]">No bookings in this view.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => (
                <div key={b.reference} className="border border-[var(--line)] rounded-sm px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{b.name} · {b.serviceName}</div>
                    <div className="text-xs text-[var(--text-soft)]">{friendlyDate(b.date)} at {b.time} · {b.phone} · Ref {b.reference}</div>
                    {b.notes && <div className="text-xs text-[var(--text-soft)] italic">Note: {b.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-sm ${b.status === "cancelled" ? "bg-red-950 text-[var(--rust)]" : b.status === "completed" ? "bg-green-950 text-green-300" : "bg-[var(--paper-2)] text-[var(--brass-dark)]"}`}>{b.status}</span>
                    {b.status === "pending" && <button onClick={() => updateBookingStatus(b, "confirmed")} className="text-xs underline">Confirm</button>}
                    {b.status !== "completed" && b.status !== "cancelled" && <button onClick={() => updateBookingStatus(b, "completed")} className="text-xs underline">Complete</button>}
                    {b.status !== "cancelled" && <button onClick={() => updateBookingStatus(b, "cancelled")} className="text-xs underline text-[var(--rust)]">Cancel</button>}
                  </div>
                  <div className="w-full min-w-0"><BookingLocation location={b.location} name={b.name} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "services" && <ServicesAdmin services={services} setServices={setServices} />}
      {tab === "schedule" && <ScheduleAdmin schedule={schedule} setSchedule={setSchedule} bumpRefresh={bumpRefresh} />}
      {tab === "settings" && <SettingsAdmin settings={settings} setSettings={setSettings} />}
      {tab === "gallery" && <GalleryAdmin gallery={gallery} setGallery={setGallery} />}
      {tab === "stats" && (
        <div className="grid sm:grid-cols-4 gap-4">
          {[["Total bookings", stats.total], ["Upcoming", stats.upcoming], ["Cancelled", stats.cancelled], ["Revenue (completed)", `K${stats.revenue}`]].map(([label, val]) => (
            <div key={label} className="border border-[var(--line)] rounded-sm p-5">
              <div className="text-2xl font-head text-[var(--rust)]">{val}</div>
              <div className="text-xs text-[var(--text-soft)] mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
