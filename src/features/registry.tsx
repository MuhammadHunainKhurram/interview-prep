import type { ComponentType } from 'react';
import { HistoryPage } from './history/HistoryPage';
import { HomePage } from './home/HomePage';
import { ProblemsPage } from './problems/ProblemsPage';
import { ReviewsPage } from './reviews/ReviewsPage';
import { SettingsPage } from './settings/SettingsPage';
import { StatsPage } from './stats/StatsPage';
import {
  IconChart,
  IconClock,
  IconHome,
  IconList,
  IconRepeat,
  IconSettings,
} from '@/shared/ui/icons';

export interface DashboardPage {
  /** URL hash route, e.g. "#/stats". */
  route: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  component: ComponentType;
}

/**
 * Dashboard pages, in navigation order. To add a feature page, create it under
 * src/features/<name>/ and add an entry here. Nothing else needs to change.
 */
export const PAGES: readonly DashboardPage[] = [
  { route: 'home', label: 'Home', icon: IconHome, component: HomePage },
  { route: 'problems', label: 'Problems', icon: IconList, component: ProblemsPage },
  { route: 'reviews', label: 'Reviews', icon: IconRepeat, component: ReviewsPage },
  { route: 'history', label: 'History', icon: IconClock, component: HistoryPage },
  { route: 'stats', label: 'Stats', icon: IconChart, component: StatsPage },
  { route: 'settings', label: 'Settings', icon: IconSettings, component: SettingsPage },
];
