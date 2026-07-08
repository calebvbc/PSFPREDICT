export function TopNav({ route, navigate }: { route: string; navigate: (path: string) => void }) {
  const links = [
    ['/', 'Home'],
    ['/palpites', 'Palpites'],
    ['/ranking', 'Ranking'],
    ['/feed', 'Feed'],
  ] as const;

  return (
    <nav className="sticky top-0 z-30 border-b border-black/5 bg-psf-background/90 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <button className="text-left text-xs font-black uppercase tracking-[0.24em] text-psf-blue sm:text-sm" onClick={() => navigate('/')} type="button">PSFPREDICT</button>
        <div className="flex gap-1 overflow-x-auto rounded-full bg-psf-surface p-1 shadow-card sm:gap-2">
          {links.map(([href, label]) => (
            <button className={`shrink-0 rounded-full px-3 py-2 text-xs font-black sm:px-4 sm:text-sm ${route === href ? 'bg-psf-blue text-white' : 'text-psf-secondary'}`} key={href} onClick={() => navigate(href)} type="button">{label}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}
