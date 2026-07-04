export function App() {
  return (
    <main className="min-h-screen bg-psf-background px-5 py-8 text-psf-text">
      <section className="mx-auto max-w-3xl rounded-[2rem] bg-psf-surface p-8 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-psf-blue">PSFPREDICT</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">A experiência oficial de palpites da PSF.</h1>
        <p className="mt-4 text-lg text-psf-secondary">
          Fundação Cloudflare-first pronta: React + Vite no frontend e Hono Worker para API, sync e cron.
        </p>
        <a className="mt-8 inline-flex rounded-full bg-psf-blue px-6 py-3 font-bold text-white" href="/palpites">
          Ir para palpites
        </a>
      </section>
    </main>
  );
}
