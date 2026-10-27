import React, { useState } from 'react';
import { fmtDate, parsePrazo } from '../../lib/format.js';

/** Campo de prazo: aceita dd/mm/aaaa ou o atalho "+X" (dias a partir de hoje). `value` é ISO. */
export default function PrazoInput({ id, label, value, onChange, padrao }) {
  const [txt, setTxt] = useState(value ? fmtDate(value) : '');
  const iso = parsePrazo(txt);
  const commit = () => { if (iso) setTxt(fmtDate(iso)); };
  const invalid = txt.trim() && !iso;
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(+X = dias a partir de hoje{padrao ? '; padrão +' + padrao : ''})</span></label>
      <input id={id} className="input" inputMode="numeric" placeholder="dd/mm/aaaa ou +X dias" value={txt} aria-invalid={invalid || undefined}
        onChange={(e) => { setTxt(e.target.value); onChange(parsePrazo(e.target.value)); }} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' && /^\+/.test(txt.trim())) { e.preventDefault(); commit(); } }} />
      {invalid ? <span className="hint" style={{ color: 'var(--crit-strong)' }}>Data inválida.</span> : /^\+/.test(txt.trim()) && iso ? <span className="hint">{fmtDate(iso)}</span> : null}
    </div>
  );
}
