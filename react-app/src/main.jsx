import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './components/ui.jsx';
import { light, dark, cssVars } from './theme.js';
import './styles.css';

// Tokens de theme.js publicados como variáveis CSS (claro e escuro)
const style = document.createElement('style');
style.id = 'da-tokens';
style.textContent = `:root { ${cssVars(light)} } html[data-theme="dark"] { ${cssVars(dark)} }`;
document.head.prepend(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
