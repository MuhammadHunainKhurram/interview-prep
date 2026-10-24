import type { ComponentType } from 'react';
import { HistoryPage } from './history/HistoryPage';
import { HomePage } from './home/HomePage';
import { ProblemsPage } from './problems/ProblemsPage';
import { ReviewsPage } from './reviews/ReviewsPage';
import { SettingsPage } from './settings/SettingsPage';
import { StatsPage } from './stats/StatsPage';
import { ThemesPage } from './themes/ThemesPage';
import {
  IconChart,
  IconClock,
  IconHome,
  IconList,
  IconPalette,
  IconRepeat,
  IconSettings,
} from '@/shared/ui/icons';

export interface DashboardPage {
  /** URL hash route, e.g. "#/stats". */
  route: string;
  label: string;
  /** One line under the page heading. */
  description: string;
  icon: ComponentType<{ size?: number }>;
  component: ComponentType;
}

/**
 * Dashboard pages, in navigation order. To add a feature page, create it under
 * src/features/<name>/ and add an entry here. Nothing else needs to change.
 */
export const PAGES: readonly DashboardPage[] = [
  {
    route: 'home',
    label: 'Home',
    description: "Today's plan, your streak and roadmap progress",
    icon: IconHome,
    component: HomePage,
  },
  {
    route: 'problems',
    label: 'Problems',
    description: 'Every list in NeetCode roadmap order',
    icon: IconList,
    component: ProblemsPage,
  },
  {
    route: 'reviews',
    label: 'Reviews',
    description: 'Problems coming back for a re-solve',
    icon: IconRepeat,
    component: ReviewsPage,
  },
  {
    route: 'history',
    label: 'History',
    description: 'Every attempt you have logged',
    icon: IconClock,
    component: HistoryPage,
  },
  {
    route: 'stats',
    label: 'Stats',
    description: 'How your practice is going',
    icon: IconChart,
    component: StatsPage,
  },
  {
    route: 'themes',
    label: 'Themes',
    description: 'Pick a color and light or dark mode',
    icon: IconPalette,
    component: ThemesPage,
  },
  {
    route: 'settings',
    label: 'Settings',
    description: 'Your plan, rest days, reminders and data',
    icon: IconSettings,
    component: SettingsPage,
  },
];
