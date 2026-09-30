import { useEffect, useId, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidLocation, locationUrl } from '../lib/location.js';

function LocationMap({ location, name }) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const point = [location.lat, location.lng];
    const map = L.map(container.current, { scrollWheelZoom: false }).setView(point, 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => setFailed(true)).addTo(map);
    L.marker(point, {
      title: 'Customer appointment location',
      icon: L.divIcon({ className: 'appointment-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
    }).addTo(map);
    return () => map.remove();
  }, [location.lat, location.lng]);
  return <>
    <div ref={container} className="appointment-map mt-3" aria-label={`Pinned appointment location for ${name}`} />
    {failed && <p role="status" className="mt-2 text-xs text-[var(--text-soft)]">Map tiles could not load. Use the location or directions link below.</p>}
  </>;
}

export function BookingLocation({ location, name }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!isValidLocation(location)) return <p className="mt-3 text-xs text-[var(--text-soft)]">Location not provided.</p>;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  return <section className="location-picker mt-3 rounded-sm border border-[var(--line)] bg-[var(--paper-2)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm"><MapPin size={16} />Customer location</h3>
        <p className="mt-1 text-xs text-[var(--text-soft)]">Saved appointment pin · {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
      </div>
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)} className="text-sm underline underline-offset-4">{expanded ? 'Hide map' : 'Show map'}</button>
    </div>
    <div id={id}>{expanded && <LocationMap location={location} name={name} />}</div>
    <div className="mt-3 flex flex-wrap gap-4 text-sm">
      <a href={locationUrl(location)} target="_blank" rel="noreferrer" className="underline underline-offset-4">Open in Google Maps</a>
      <a href={directions} target="_blank" rel="noreferrer" className="underline underline-offset-4">Get directions</a>
    </div>
  </section>;
}
