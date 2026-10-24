import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Interview Prep',
    description:
      'Track NeetCode and LeetCode progress with spaced repetition, daily plans and streaks.',
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'notifications'],
    commands: {
      'open-widget': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Open the tracker on the current problem',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
