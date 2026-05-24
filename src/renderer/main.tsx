import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './theme';
import App from './app.tsx';

ThemeProvider.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
