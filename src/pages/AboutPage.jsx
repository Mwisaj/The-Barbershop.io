export function AboutPage({ settings }) {
  return (
    <div className="font-body max-w-2xl mx-auto px-5 py-14">
      <h1 className="font-head text-3xl text-[var(--foreground)] mb-4">About {settings.name}</h1>
      <p className="text-[var(--foreground)]/85 leading-relaxed">
        We're a small neighbourhood barbershop focused on doing one thing properly: a sharp,
        unhurried haircut. We started taking online appointments on Sundays to cut the waiting-room
        line, and we're growing our hours as the shop does.
      </p>
    </div>
  );
}
