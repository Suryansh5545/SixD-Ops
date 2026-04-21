/**
 * Auth layout used by login and other auth pages.
 * Provides a brighter branded backdrop and keeps the content centered.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(232,81,34,0.18),_transparent_34%),linear-gradient(160deg,#fff7f3_0%,#fff8ef_45%,#f8fafc_100%)]">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-100/70 to-transparent" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand-200/35 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-200/35 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
