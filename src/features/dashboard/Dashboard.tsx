import { useEffect, useState } from 'react';
import { cx } from '@/shared/ui/tones';
import { useRequest, useTheme } from '@/shared/ui/hooks';
import { PAGES } from '../registry';

function currentRoute(): string {
  const route = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some((p) => p.route === route) ? route : 'home';
}

export function Dashboard() {
  const [route, setRoute] = useState(currentRoute);
  const settings = useRequest('settings/get', {});
  useTheme(settings.data?.theme);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const page = PAGES.find((p) => p.route === route) ?? PAGES[0]!;
  useEffect(() => {
    document.title = `${page.label} · Interview Prep`;
  }, [page]);

  const Page = page.component;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav
        aria-label="Main"
        className="border-b-2 border-border bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r-2"
      >
        <p className="hidden px-5 pb-4 pt-6 text-xl font-extrabold text-green md:block">
          Interview Prep
        </p>
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
          {PAGES.map((p) => {
            const Icon = p.icon;
            const active = p.route === page.route;
            return (
              <li key={p.route}>
                <a
                  href={`#/${p.route}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 whitespace-nowrap rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide',
                    active
                      ? 'border-blue bg-blue-soft text-text'
                      : 'border-transparent text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <Icon size={20} />
                  {p.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
        <h1 className="mb-6 text-2xl font-extrabold">{page.label}</h1>
        <Page key={page.route} />
      </main>
    </div>
  );
}
