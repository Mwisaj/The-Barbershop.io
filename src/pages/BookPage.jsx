import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Check, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { api } from "../lib/storage";
import { LocationPicker } from "../components/LocationPicker";
import { locationUrl } from "../lib/location.js";
import { whatsappUrl } from "../lib/whatsapp.js";
import { DAY_NAMES, SHOP_TIME_LABEL, appointmentTimestamp, friendlyDate, generateSlots, getUpcomingDates, rangesOverlap, timeToMinutes } from "../lib/dateTime";

export function BookPage({ services, schedule, settings, refreshSignal, bumpRefresh }) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [name, setName] = useState("");
  const [phoneNum, setPhoneNum] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState(null);
  const [busySlots, setBusySlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const dates = useMemo(() => getUpcomingDates(schedule.enabledDays, 6), [schedule]);

  // Load existing bookings + blocked slots for the chosen date to compute availability.
  useEffect(() => {
    if (!date) return;
    let active = true;
    setLoadingSlots(true);
    api('/availability?date=' + encodeURIComponent(date))
      .then(slots => { if (active) { setBusySlots(slots); setError(''); } })
      .catch(error => { if (active) { setBusySlots([{ start: 0, end: 1440 }]); setError(error.message); } })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [date, schedule.slotMinutes, refreshSignal]);

  const allSlots = useMemo(
    () => generateSlots(schedule.openTime, schedule.closeTime, schedule.slotMinutes),
    [schedule]
  );
  const availableSlots = useMemo(() => {
    if (!service) return [];
    return allSlots.filter((t) => {
      if (appointmentTimestamp(date, t) <= Date.now()) return false;
      const start = timeToMinutes(t);
      const end = start + service.duration;
      if (end > timeToMinutes(schedule.closeTime)) return false;
      return !busySlots.some((b) => rangesOverlap(start, end, b.start, b.end));
    });
  }, [allSlots, busySlots, service, schedule.closeTime, date]);

  async function submitBooking() {
    if (submitting) return;
    setError("");
    if (!name.trim() || !phoneNum.trim()) { setError("Please enter your name and phone number."); return; }
    if (!service || !date || !time || !availableSlots.includes(time) || appointmentTimestamp(date, time) <= Date.now()) {
      setError("Please select an available future appointment time.");
      setStep(3);
      return;
    }
    setSubmitting(true);
    try {
    const booking = await api('/bookings', {
      method: 'POST', body: { serviceId, date, time, name: name.trim(), phone: phoneNum.trim(), notes: notes.trim(), location },
    });
    setConfirmedBooking(booking);
    setStep(5);
    bumpRefresh();
    } catch (error) {
      setError(error.message);
      if (error.status === 409) { bumpRefresh(); setStep(3); }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedBooking) {
    const waText = (
      `Hi ${settings.name}, would like to confirm my booking.\nRef: ${confirmedBooking.reference}\nService: ${confirmedBooking.serviceName}\nDate: ${friendlyDate(confirmedBooking.date)}\nTime: ${confirmedBooking.time} (${SHOP_TIME_LABEL})\nName: ${confirmedBooking.name}\nPhone: ${confirmedBooking.phone}${confirmedBooking.location ? '\nLocation: ' + locationUrl(confirmedBooking.location) : ''}`
    );
    return (
      <div className="font-body max-w-lg mx-auto px-5 py-16 text-center">
        <Check size={40} className="mx-auto text-[var(--brass)] mb-3" />
        <h1 className="font-head text-3xl text-[var(--foreground)] mb-2">Booking received</h1>
        <p className="text-[var(--text-soft)] mb-6">Send the message below on WhatsApp to confirm with the shop — we'll reply to lock it in.</p>
        <div className="border border-[var(--line)] rounded-sm p-6 text-left bg-[var(--paper-2)]">
          <div className="text-sm text-[var(--text-soft)]">Booking reference</div>
          <div className="font-head text-2xl text-[var(--rust)] mb-3">{confirmedBooking.reference}</div>
          <div className="text-sm space-y-1 text-[var(--foreground)]">
            <div>{confirmedBooking.serviceName} · K{confirmedBooking.price} · {confirmedBooking.durationMinutes} min</div>
            <div>{friendlyDate(confirmedBooking.date)} at {confirmedBooking.time}</div>
            <div>{confirmedBooking.name} · {confirmedBooking.phone}</div>
          </div>
        </div>
        {confirmedBooking.location && <a href={locationUrl(confirmedBooking.location)} target="_blank" rel="noreferrer" className="mt-4 block text-sm underline">View your pinned location</a>}
        <a
            href={whatsappUrl(settings.whatsapp, waText)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-sm font-medium"
          >
            <MessageCircle size={18} />
            Confirm on WhatsApp
          </a>
        <p className="mt-4 text-xs text-[var(--text-soft)]">Keep your reference — you'll need it to reschedule or cancel.</p>
      </div>
    );
  }

  const steps = ["Service", "Date", "Time", "Details"];
  return (
    <div className="font-body max-w-2xl mx-auto px-5 py-14">
      <h1 className="font-head text-3xl text-[var(--foreground)] mb-1">Book an Appointment</h1>
      <p className="text-[var(--text-soft)] mb-8">All times are {SHOP_TIME_LABEL}. Appointments are currently open on {schedule.enabledDays.map((d) => DAY_NAMES[d]).join(", ")}.</p>

      <div className="flex items-center gap-2 mb-8 text-xs">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 ${i + 1 <= step ? "text-[var(--rust)]" : "text-[var(--text-soft)]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${i + 1 <= step ? "border-[var(--rust)] bg-[var(--accent-strong)] text-white" : "border-[var(--line)]"}`}>{i + 1}</span>
            {s}{i < steps.length - 1 && <ChevronRight size={13} className="text-[var(--line)]" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          {services.map((s) => (
            <button key={s.id} onClick={() => { setServiceId(s.id); setStep(2); }}
              className="w-full text-left border border-[var(--line)] rounded-sm px-5 py-4 flex justify-between items-center hover:border-[var(--brass)] transition-colors">
              <div>
                <div className="font-medium text-[var(--foreground)]">{s.name}</div>
                <div className="text-sm text-[var(--text-soft)]">{s.duration} minutes</div>
              </div>
              <div className="font-head text-lg text-[var(--rust)]">K{s.price}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          {dates.length === 0 ? (
            <p className="text-[var(--text-soft)]">No appointment days are enabled yet. Please check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {dates.map((d) => (
                <button key={d} onClick={() => { if (d !== date) setLoadingSlots(true); setTime(null); setDate(d); setStep(3); }}
                  className="border border-[var(--line)] rounded-sm px-5 py-4 flex items-center gap-3 hover:border-[var(--brass)] transition-colors">
                  <Calendar size={18} className="text-[var(--brass)]" />
                  <span className="text-[var(--foreground)]">{friendlyDate(d)}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep(1)} className="mt-6 text-sm text-[var(--text-soft)] flex items-center gap-1"><ChevronLeft size={14} />Back</button>
        </div>
      )}

      {step === 3 && (
        <div>
          {loadingSlots ? (
            <p className="text-[var(--text-soft)]">Checking availability…</p>
          ) : availableSlots.length === 0 ? (
            <p className="text-[var(--text-soft)]">No open times left on {friendlyDate(date)}. Try another date.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map((t) => (
                <button key={t} onClick={() => { setTime(t); setStep(4); }}
                  className="border border-[var(--line)] rounded-sm py-2 text-sm hover:border-[var(--brass)] hover:bg-[var(--paper-2)] transition-colors text-[var(--foreground)]">
                  {t}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep(2)} className="mt-6 text-sm text-[var(--text-soft)] flex items-center gap-1"><ChevronLeft size={14} />Back</button>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="border border-[var(--line)] rounded-sm p-4 mb-5 bg-[var(--paper-2)] text-sm">
            <div className="font-medium text-[var(--foreground)]">{service?.name} · K{service?.price}</div>
            <div className="text-[var(--text-soft)]">{friendlyDate(date)} at {time}</div>
          </div>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
              className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)]" />
            <input value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} placeholder="Phone number"
              className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)]" />
            <LocationPicker value={location} onChange={setLocation} />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Address, directions or other notes (optional)" aria-label="Address, directions or other notes" rows={3}
              className="w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent outline-none focus:border-[var(--brass)]" />
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={submitting} onClick={() => setStep(3)} className="text-sm text-[var(--text-soft)] flex items-center gap-1 px-2"><ChevronLeft size={14} />Back</button>
            <button disabled={submitting} onClick={submitBooking} className="ml-auto bg-[var(--accent-strong)] text-white px-6 py-3 rounded-sm font-medium hover:bg-[var(--ink)] transition-colors disabled:opacity-50">
              {submitting ? "Saving booking…" : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}
      {error && <div role="alert" className="mt-3 text-sm text-[var(--rust)] flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------
   MANAGE BOOKING (cancel / reschedule via reference)
--------------------------------------------------------------------- */
