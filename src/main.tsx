import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './assets/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
