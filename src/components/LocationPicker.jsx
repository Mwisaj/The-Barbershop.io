import { useEffect, useRef, useState } from 'react';
import { Check, LocateFixed, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { locationUrl } from '../lib/location.js';

export function LocationPicker({ value, onChange }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  const initial = useRef(value);
  const request = useRef(0);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(Boolean(value));
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  change.current = onChange;

  function selectPoint(latlng) {
    request.current++;
    setLocating(false);
    setError('');
    setAccuracy(null);
    const point = latlng.wrap();
    change.current({ lat: Math.max(-90, Math.min(90, point.lat)), lng: point.lng });
  }

  useEffect(() => {
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
      initial.current ? [initial.current.lat, initial.current.lng] : [-15.4167, 28.2833],
      initial.current ? 17 : 12,
    );
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => setTileError(true)).addTo(instance);
    instance.on('click', ({ latlng }) => selectPoint(latlng));
    return () => { request.current++; instance.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const point = [value.lat, value.lng];
    if (!marker.current) {
      marker.current = L.marker(point, {
        draggable: true,
        title: 'Your appointment location. Drag to adjust.',
        icon: L.divIcon({ className: 'appointment-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
      }).addTo(map.current);
      marker.current.on('dragend', () => selectPoint(marker.current.getLatLng()));
    } else marker.current.setLatLng(point);
    map.current.panTo(point);
  }, [value]);

  useEffect(() => {
    if (!showMap) return;
    const frame = requestAnimationFrame(() => {
      map.current?.invalidateSize();
      if (value) map.current?.panTo([value.lat, value.lng]);
    });
    return () => cancelAnimationFrame(frame);
  }, [showMap, value]);

  function locate() {
    if (!navigator.geolocation) {
      setError('Your browser cannot find your location. Choose your spot on the map below.');
      setShowMap(true);
      return;
    }
    const id = ++request.current;
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request.current !== id || !map.current) return;
      setLocating(false);
      setAccuracy(Math.round(coords.accuracy));
      change.current({ lat: coords.latitude, lng: coords.longitude });
      setShowMap(true);
      map.current.setView([coords.latitude, coords.longitude], 17);
    }, error => {
      if (request.current !== id || !map.current) return;
      setLocating(false);
      setShowMap(true);
      setError(error.code === 1
        ? 'Location access is off. Tap your spot on the map, or allow location in your browser and try again.'
        : 'We could not find your location. Try again or tap your spot on the map.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  return <section className="location-picker rounded-sm border border-[var(--line)] p-4" aria-labelledby="location-heading">
    <h2 id="location-heading" className="flex flex-wrap items-center gap-2 text-base"><MapPin size={18} />Where should we come?<span className="text-xs text-[var(--text-soft)]">Optional</span></h2>
    <p id="location-help" className="mt-2 text-sm text-[var(--text-soft)]">At the appointment address? Use your location to add a pin in one tap.</p>
    <button type="button" disabled={locating} onClick={locate} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[var(--ink)] disabled:opacity-60"><LocateFixed size={20} />{locating ? 'Finding your location…' : value ? 'Use my current location again' : 'Use my location'}</button>
    <p className="mt-2 text-center text-xs text-[var(--text-soft)]" role="status">{locating ? 'Choose Allow if your browser asks for location access.' : 'Your location is shared with the barber when you confirm the booking.'}</p>
    {locating && <button type="button" onClick={() => { request.current++; setLocating(false); setShowMap(true); }} className="mt-2 min-h-11 w-full text-sm underline">Choose on the map instead</button>}
    {!showMap && !locating && <button type="button" onClick={() => setShowMap(true)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] text-sm hover:bg-[var(--paper-2)]"><MapPin size={18} />Choose a different location on the map</button>}
    {error && <p role="alert" className="mt-3 text-sm text-[var(--rust)]">{error}</p>}
    {value && <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--paper-2)] p-3" aria-live="polite"><p className="flex items-center gap-2 text-sm font-semibold"><Check size={18} />Location selected</p><p className="mt-1 text-xs text-[var(--text-soft)]">{accuracy > 100 ? `Your device estimates accuracy within ${accuracy} metres. Move the pin to your entrance if needed.` : 'Check the pin is at your appointment address. Tap the map or drag the pin to adjust it.'}</p></div>}
    <div hidden={!showMap}>
      <p className="mb-2 mt-4 text-sm text-[var(--text-soft)]">{value ? 'Need to adjust it? Tap your entrance.' : 'Tap where you want your appointment. Pinch to zoom.'}</p>
      <div ref={container} className="appointment-map" aria-label="Choose your appointment location on the map" aria-describedby="location-help" />
      {tileError && <p role="status" className="mt-2 text-sm text-[var(--rust)]">Map tiles could not load. You can still use your current location or enter your address in the notes.</p>}
      <button type="button" className="mt-3 min-h-11 w-full rounded-lg border border-[var(--line)] px-3 text-sm hover:bg-[var(--paper-2)]" onClick={() => { if (map.current) selectPoint(map.current.getCenter()); }}>Use the centre of this map</button>
    </div>
    {value && <div className="mt-2 flex flex-wrap justify-between gap-3 text-sm"><a href={locationUrl(value)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">View in Google Maps</a><button type="button" className="min-h-11 text-[var(--text-soft)] underline" onClick={() => { request.current++; setLocating(false); setAccuracy(null); setError(''); onChange(null); }}>Remove location</button></div>}
  </section>;
}
