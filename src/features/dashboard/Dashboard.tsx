import { useEffect, useState } from 'react';
import { LogoMark } from '@/shared/ui/components';
import { useRequest, useTheme } from '@/shared/ui/hooks';
import { cx } from '@/shared/ui/tones';
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
  const Page = page.component;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav
        aria-label="Main"
        className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r"
      >
        <a
          href="#/home"
          className="hidden items-center gap-2.5 px-5 pb-6 pt-6 text-[17px] font-extrabold md:flex"
        >
          <LogoMark size={28} />
          Interview Prep
        </a>
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:px-3 md:py-0">
          {PAGES.map((p) => {
            const Icon = p.icon;
            const active = p.route === page.route;
            return (
              <li key={p.route}>
                <a
                  href={`#/${p.route}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 whitespace-nowrap rounded-xl border-2 px-3 py-2 text-[15px] font-bold',
                    active
                      ? 'border-accent bg-accent-soft text-accent-text'
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-10">
        <header className="mb-8">
          <h1 className="text-[28px] font-extrabold leading-tight text-balance">{page.label}</h1>
          <p className="mt-1 text-[15px] text-muted">{page.description}</p>
        </header>
        <Page key={page.route} />
      </main>
    </div>
  );
}
