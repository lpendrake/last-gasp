import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './theme';
import App from './app.tsx';
import { ConfirmDialogProvider } from './shared/confirm-dialog/confirm-provider';

ThemeProvider.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmDialogProvider>
      <App />
    </ConfirmDialogProvider>
  </StrictMode>,
);
