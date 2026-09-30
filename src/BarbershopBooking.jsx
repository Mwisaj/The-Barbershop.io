import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { FontLoad } from "./components/FontLoad";
import { Footer, NavBar, WhatsAppFAB } from "./components/Layout";
import { DEFAULT_SCHEDULE, DEFAULT_SERVICES, DEFAULT_SETTINGS } from "./config/defaults";
import { api, storageGet } from "./lib/storage";
import { HomePage } from "./pages/HomePage";
import { ServicesPage } from "./pages/ServicesPage";
import { BookPage } from "./pages/BookPage";
import { ManagePage } from "./pages/ManagePage";
import { GalleryPage } from "./pages/GalleryPage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { AdminPage } from "./admin/AdminPage";

export default function BarbershopBooking() {
  const [page, setPage] = useState(() => window.location.hash.startsWith('#admin') ? 'admin' : 'home');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [gallery, setGallery] = useState([]);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bumpRefresh = () => setRefreshSignal((n) => n + 1);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);



  useEffect(() => {
    (async () => {
      const [svc, sch, set, images] = await Promise.all([
        storageGet("services", true, DEFAULT_SERVICES),
        storageGet("schedule", true, DEFAULT_SCHEDULE),
        storageGet("settings", true, DEFAULT_SETTINGS),
        api('/gallery'),
      ]);
      setServices(svc); setSchedule(sch); setSettings(set);
      setGallery(images);
      setReady(true);
    })().catch(() => setLoadError("Unable to connect. Please try again shortly."));
  }, []);

  if (loadError) return <main role="alert" className="p-10 text-center">{loadError}<button className="block mx-auto mt-4 underline" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center font-body text-[var(--text-soft)]"><FontLoad />Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]" style={{ colorScheme: "dark" }}>
      <FontLoad />
      <NavBar page={page} setPage={setPage} settings={settings} />
      {page === "home" && <HomePage setPage={setPage} settings={settings} schedule={schedule} />}
      {page === "services" && <ServicesPage services={services} setPage={setPage} />}
      {page === "book" && <BookPage services={services} schedule={schedule} settings={settings} refreshSignal={refreshSignal} bumpRefresh={bumpRefresh} />}
      {page === "manage" && <ManagePage schedule={schedule} />}
      {page === "gallery" && <GalleryPage items={gallery} />}
      {page === "about" && <AboutPage settings={settings} />}
      {page === "contact" && <ContactPage settings={settings} />}
      {page === "admin" && (
        <AdminPage
          gallery={gallery} setGallery={setGallery}
          services={services} setServices={setServices}
          schedule={schedule} setSchedule={setSchedule}
          settings={settings} setSettings={setSettings}
          refreshSignal={refreshSignal} bumpRefresh={bumpRefresh}
        />
      )}
      <Footer settings={settings} setPage={setPage} />
      <WhatsAppFAB settings={settings} />
      {page !== "admin" && (
        <button aria-label="Open administration" onClick={() => setPage("admin")}
          className="fixed bottom-5 left-5 z-40 bg-[var(--ink)] text-[var(--foreground)] rounded-full p-3 shadow-lg opacity-60 hover:opacity-100 transition-opacity">
          <Lock size={16} />
        </button>
      )}
    </div>
  );
}
