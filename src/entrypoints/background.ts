import { browser } from 'wxt/browser';
import { createHandlers, dispatch } from '@/background/router';
import { updateActionIcon } from '@/background/action-icon';
import { TrackerService } from '@/background/tracker-service';
import { systemClock } from '@/core/calendar/logical-day';
import { getCatalog } from '@/core/catalog';
import { fsrsScheduler } from '@/core/srs/fsrs-scheduler';
import { createRepositories } from '@/data/create-repositories';
import { loadConfig } from '@/shared/config/env';
import type { TabMessage } from '@/shared/messaging/contract';

const ALARM_REMINDER = 'daily-reminder';
const ALARM_HOUSEKEEPING = 'housekeeping';
const NOTIFICATION_ID = 'daily-reminder';

export default defineBackground(() => {
  const service = new TrackerService(
    createRepositories(loadConfig()),
    getCatalog(),
    fsrsScheduler,
    systemClock,
  );

  async function openDashboard(route?: string) {
    const url = browser.runtime.getURL('/dashboard.html');
    await browser.tabs.create({ url: route ? `${url}#/${route.replace(/^\/+/, '')}` : url });
  }

  /** Schedules the next reminder at the configured local time, or clears it. */
  async function scheduleReminder() {
    await browser.alarms.clear(ALARM_REMINDER);
    const { enabled, time } = await service.reminderSettings();
    if (!enabled) return;
    const [h, m] = time.split(':').map(Number) as [number, number];
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    await browser.alarms.create(ALARM_REMINDER, { when: next.getTime() });
  }

  async function refreshIcon() {
    await updateActionIcon((await service.getSettings()).accent);
  }

  async function afterSettingsChange() {
    await Promise.all([scheduleReminder(), refreshIcon()]);
  }

  async function ensureAlarms() {
    if (!(await browser.alarms.get(ALARM_HOUSEKEEPING)))
      await browser.alarms.create(ALARM_HOUSEKEEPING, { periodInMinutes: 60, delayInMinutes: 1 });
    if (!(await browser.alarms.get(ALARM_REMINDER))) await scheduleReminder();
  }

  const handlers = createHandlers({
    service,
    openDashboard,
    onSettingsChanged: afterSettingsChange,
    onDataChanged: afterSettingsChange,
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void dispatch(handlers, message, sender, browser.runtime.id).then(sendResponse);
    return true; // keep the channel open for the async response
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_HOUSEKEEPING) void service.housekeeping();
    if (alarm.name === ALARM_REMINDER) {
      void (async () => {
        const r = await service.reminder();
        if (r)
          await browser.notifications.create(NOTIFICATION_ID, {
            type: 'basic',
            iconUrl: browser.runtime.getURL('/icon/128.png'),
            title: 'Interview Prep',
            message:
              `${r.remaining} problem${r.remaining === 1 ? '' : 's'} left to hit today's goal.` +
              (r.streak > 0 ? ` Keep your ${r.streak}-day streak going.` : ''),
          });
        await scheduleReminder();
      })();
    }
  });

  browser.notifications.onClicked.addListener((id) => {
    if (id !== NOTIFICATION_ID) return;
    void browser.notifications.clear(id);
    void openDashboard();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'open-widget') return;
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) return;
      const msg: TabMessage = { channel: 'interview-prep', type: 'widget/open' };
      // No content script on this page (not a problem page): nothing to open.
      await browser.tabs.sendMessage(tab.id, msg).catch(() => undefined);
    })();
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    void ensureAlarms();
    if (reason === 'install') void openDashboard();
  });
  browser.runtime.onStartup.addListener(() => void ensureAlarms());
  // The service worker starts often; keep the icon in sync each time.
  void refreshIcon();
});
