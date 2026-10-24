import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from '@/features/dashboard/Dashboard';
import '@/shared/ui/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
