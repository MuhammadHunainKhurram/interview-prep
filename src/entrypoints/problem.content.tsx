import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { parseProblemUrl, type ProblemLocation } from '@/core/catalog/url';
import type { TabMessage } from '@/shared/messaging/contract';
import { Widget } from '@/features/widget/Widget';
import '@/shared/ui/widget.css';

export default defineContentScript({
  // Both sites are single-page apps, so the script runs on every page and only
  // shows the widget on problem pages.
  matches: ['https://leetcode.com/*', 'https://neetcode.io/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let ui: ShadowRootContentScriptUi<{ root: Root; host: HTMLElement }> | null = null;
    let location: ProblemLocation | null = null;
    let openSignal = 0;

    const render = () => {
      if (!ui?.mounted || !location) return;
      const { root, host } = ui.mounted;
      // Keyed by problem so the form resets when navigating to another problem.
      root.render(
        <Widget
          key={`${location.site}:${location.slug}`}
          location={location}
          openSignal={openSignal}
          host={host}
        />,
      );
    };

    const update = async () => {
      const next = parseProblemUrl(window.location.href);
      if (!next) {
        ui?.remove();
        ui = null;
        location = null;
        return;
      }
      location = next;
      if (!ui) {
        ui = await createShadowRootUi(ctx, {
          name: 'interview-prep-widget',
          position: 'inline',
          anchor: 'body',
          append: 'last',
          onMount: (container, _shadow, host) => {
            const root = createRoot(container);
            return { root, host };
          },
          onRemove: (mounted) => mounted?.root.unmount(),
        });
        ui.mount();
      }
      render();
    };

    ctx.addEventListener(window, 'wxt:locationchange', () => void update());

    browser.runtime.onMessage.addListener((message: unknown, sender) => {
      if (sender.id !== browser.runtime.id) return;
      const m = message as Partial<TabMessage> | null;
      if (m?.channel !== 'interview-prep' || m.type !== 'widget/open') return;
      openSignal++;
      render();
    });

    await update();
  },
});
