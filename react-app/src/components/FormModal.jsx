import React, { useState } from 'react';
import { Modal, Field } from './ui.jsx';

/**
 * Modal de formulário simples a partir de uma lista de campos.
 * fields: [{ key, label, type: 'text'|'number'|'date'|'email'|'select'|'textarea'|'datalist', options?, placeholder?, full? }]
 * onSubmit(form) deve lançar erro (ApiError) para exibir a mensagem.
 */
export default function FormModal({ title, sub, fields, initial, onSubmit, onClose, submitLabel = 'Salvar', children, wide, cols = '200px' }) {
  const [form, setForm] = useState(initial || {});
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr({}); };
  const submit = async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    try { await onSubmit(form); } catch (er) { setErr({ ...(er.fields || {}), _: er.message }); setBusy(false); }
  };
  return (
    <Modal title={title} sub={sub} onClose={onClose} wide={wide} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Salvando…' : submitLabel}</button>
    </>}>
      {typeof children === 'function' ? children(form, set) : children}
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cols}), 1fr))`, gap: 12 }}>
        {fields.map((f) => {
          const id = 'fm-' + f.key;
          const v = form[f.key] == null ? '' : form[f.key];
          let input;
          if (f.type === 'select') input = <select id={id} className="select" value={v} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => (typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o}>{o}</option>))}</select>;
          else if (f.type === 'textarea') input = <textarea id={id} className="textarea" rows={3} value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
          else if (f.type === 'datalist') input = <><input id={id} className="input" list={id + '-dl'} autoComplete="off" value={v} placeholder={f.placeholder || 'Digite ou selecione'} onChange={(e) => set(f.key, e.target.value)} /><datalist id={id + '-dl'}>{f.options.map((o) => <option key={o} value={o} />)}</datalist></>;
          else input = <input id={id} className={'input' + (err[f.key] ? ' invalid' : '')} type={f.type || 'text'} step={f.type === 'number' ? (f.step || '0.01') : undefined} min={f.type === 'number' ? 0 : undefined} value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
          return <Field key={f.key} label={f.label} htmlFor={id} error={err[f.key]} hint={f.hint} style={f.full ? { gridColumn: '1 / -1' } : undefined}>{input}</Field>;
        })}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      {err._ && <div className="alert-box error" role="alert">{err._}</div>}
    </Modal>
  );
}
