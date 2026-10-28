// Aplica o tema antes da primeira pintura (evita piscar). Arquivo separado para permitir CSP sem 'unsafe-inline'.
try { var t = localStorage.getItem('DA_theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* sem storage */ }
