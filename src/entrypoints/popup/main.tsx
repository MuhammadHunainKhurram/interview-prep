import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from '@/features/popup/Popup';
import '@/shared/ui/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
