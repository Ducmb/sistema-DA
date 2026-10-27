import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

let cached = null;
/** Regras de senha vindas do servidor (Configurações › Geral › Senhas). */
export function usePasswordRules() {
  const [r, setR] = useState(cached || { min: 8, complex: true });
  useEffect(() => { if (!cached) api.get('/auth/password-rules').then((x) => { cached = x; setR(x); }).catch(() => {}); }, []);
  return r;
}

export function checkPassword(p, rules) {
  const list = [{ label: rules.min + '+ caracteres', ok: p.length >= rules.min }];
  if (rules.complex) list.push({ label: 'Letra maiúscula', ok: /[A-Z]/.test(p) }, { label: 'Letra minúscula', ok: /[a-z]/.test(p) }, { label: 'Número', ok: /\d/.test(p) }, { label: 'Símbolo', ok: /[^A-Za-z0-9]/.test(p) });
  return list;
}

const COLORS = ['var(--border)', '#DC2626', '#F59E0B', '#3B82F6', 'var(--accent)'];
const LABELS = ['Digite a nova senha', 'Fraca', 'Razoável', 'Boa', 'Forte'];

/** Barras de força + checklist de requisitos. */
export default function PasswordStrength({ value, rules }) {
  const list = checkPassword(value, rules);
  const ratio = value ? list.filter((r) => r.ok).length / list.length : 0;
  const score = value ? Math.max(1, Math.round(ratio * 4)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4, maxWidth: 320 }} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= score ? COLORS[score] : 'var(--border)', transition: 'background-color 0.2s' }} />)}
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: score ? COLORS[score] : 'var(--text-2)' }}>{LABELS[score]}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {list.map((r) => <span key={r.label} style={{ fontSize: 12, color: r.ok ? 'var(--accent)' : 'var(--text-2)' }}>{r.ok ? '✓' : '○'} {r.label}</span>)}
      </div>
    </div>
  );
}
