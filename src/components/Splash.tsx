export function Splash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-600 text-white" role="status">
      <img src="/favicon.svg" alt="" className="h-24 w-24 animate-pop rounded-3xl shadow-xl" />
      <h1 className="mt-5 font-display text-3xl font-bold">WeAreCooking</h1>
      <p className="mt-1 text-sm text-brand-100">Home-style meals · Akurdi, Pune</p>
      <p className="mt-10 text-xs text-brand-100/90">{message ?? 'Warming up the tawa…'}</p>
    </div>
  );
}
