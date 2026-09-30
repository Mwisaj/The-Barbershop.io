import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/storage";
import { friendlyDate } from "../lib/dateTime";
import { locationUrl } from "../lib/location.js";

export function ManagePage({ schedule }) {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState(undefined); // undefined = not searched, null = not found
  const [msg, setMsg] = useState("");

  async function lookup() {
    setMsg('');
    try {
      setBooking(await api('/bookings/lookup', { method: 'POST', body: { reference: ref.trim().toUpperCase(), phone } }));
    } catch (error) { setBooking(null); setMsg(error.message); }
  }
  async function cancelBooking() {
    try {
      const updated = await api('/bookings/cancel', { method: 'POST', body: { reference: booking.reference, phone } });
      setBooking(updated);
      setMsg('Your appointment has been cancelled. The slot is now open for others.');
    } catch (error) { setMsg(error.message); }
  }
  return (
    <div className="font-body max-w-md mx-auto px-5 py-14">
      <h1 className="font-head text-3xl text-[var(--foreground)] mb-2">Manage Your Booking</h1>
      <p className="text-[var(--text-soft)] mb-6">Enter your booking reference and the phone number you booked with.</p>
      <div className="space-y-3">
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Booking reference e.g. CC-4F7A2B"
          className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number"
          className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)]" />
        <button onClick={lookup} className="w-full bg-[var(--ink)] text-[var(--foreground)] px-6 py-3 rounded-sm font-medium flex items-center justify-center gap-2">
          <Search size={16} /> Find Booking
        </button>
      </div>

      {!booking && msg && <p role="alert" className="mt-4 text-sm text-[var(--rust)]">{msg}</p>}
      {booking === null && !msg && <p className="mt-5 text-sm text-[var(--rust)]">No matching booking found. Check your reference and phone number.</p>}

      {booking && (
        <div className="mt-6 border border-[var(--line)] rounded-sm p-5 bg-[var(--paper-2)]">
          <div className="font-medium text-[var(--foreground)]">{booking.serviceName}</div>
          <div className="text-sm text-[var(--text-soft)]">{friendlyDate(booking.date)} at {booking.time}</div>
          <div className="text-sm mt-1">
            Status: <span className={booking.status === "cancelled" ? "text-[var(--rust)]" : "text-[var(--brass-dark)]"}>{booking.status}</span>
          </div>
          {booking.status !== "cancelled" && (
            <button onClick={cancelBooking} className="mt-4 text-sm border border-[var(--rust)] text-[var(--rust)] px-4 py-2 rounded-sm hover:bg-[var(--accent-strong)] hover:text-white transition-colors">
              Cancel this appointment
            </button>
          )}
          {msg && <p className="mt-3 text-sm text-[var(--brass-dark)]">{msg}</p>}
          {locationUrl(booking.location) && <a href={locationUrl(booking.location)} target="_blank" rel="noreferrer" className="mt-3 block text-sm underline">View your pinned location</a>}
          <p className="mt-4 text-xs text-[var(--text-soft)]">To reschedule, cancel this slot and book a new one from the Book page.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   GALLERY / ABOUT / CONTACT
--------------------------------------------------------------------- */
