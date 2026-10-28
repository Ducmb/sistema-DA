import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LEVELS } from '../theme.js';

/* ---------- Toast ("Salvo com sucesso") ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const show = useCallback((msg, kind = 'success') => {
    clearTimeout(timer.current);
    setT({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setT(null), kind === 'error' ? 4500 : 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={'toast' + (t.kind === 'error' ? ' error' : '')}>{t.kind === 'error' ? '⚠' : '✓'} {t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Básicos ---------- */
export function Card({ title, sub, actions, children, className = '', style, plainHead, delay }) {
  return (
    <section className={'card lg fade-up ' + className} style={{ animationDelay: delay ? delay + 's' : undefined, ...style }}>
      {(title || actions) && (
        <div className={'section-head' + (plainHead ? ' plain' : '')}>
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ level, color, bg, children, style }) {
  const l = level ? LEVELS[level] || LEVELS.info : null;
  return <span className="badge" style={{ color: color || (l && l.fg), backgroundColor: bg || (l && l.bg), ...style }}>{children}</span>;
}

export function Switch({ on, onChange, label, disabled, title }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} title={title} disabled={disabled} className="switch" onClick={() => !disabled && onChange(!on)} />;
}

export function Field({ label, error, hint, children, htmlFor, style }) {
  return (
    <div className="field" style={style}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((t) => (
        <button key={t.key} role="tab" type="button" aria-selected={value === t.key} className="tab" onClick={() => onChange(t.key)}>
          {t.icon && <span aria-hidden="true">{t.icon}</span>}{t.label}{t.count ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/* ---------- Modal e drawer ---------- */
function useEsc(onClose) {
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = prev; };
  }, [onClose]);
}

export function Modal({ title, sub, onClose, children, footer, wide, labelledBy }) {
  useEsc(onClose);
  const id = labelledBy || 'modal-title';
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="modal-head">
          <div><h3 id={id}>{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, sub, onClose, children, footer }) {
  useEsc(onClose);
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="modal-head">
          <div><h3 id="drawer-title">{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </div>
  );
}

/** Confirmação com justificativa opcional. */
export function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger, requireText, textLabel, textPlaceholder, onConfirm, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (requireText !== undefined && !text.trim()) { setErr('Informe ' + (textLabel || 'a justificativa').toLowerCase() + '.'); return; }
    setBusy(true);
    try { await onConfirm(text.trim()); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} disabled={busy} onClick={go}>{busy ? 'Salvando…' : confirmLabel}</button>
    </>}>
      {message && <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{message}</p>}
      {requireText !== undefined && (
        <Field label={textLabel || 'Justificativa'} error={err}>
          <textarea className="textarea" value={text} placeholder={textPlaceholder} onChange={(e) => { setText(e.target.value); setErr(''); }} autoFocus />
        </Field>
      )}
      {err && requireText === undefined && <div className="alert-box error">{err}</div>}
    </Modal>
  );
}

/* ---------- Estados ---------- */
export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />;
}

export function SkeletonCards({ n = 3, h = 120 }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} h={h} style={{ borderRadius: 12 }} />)}
    </div>
  );
}

export function SkeletonRows({ n = 6 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} h={38} />)}
    </div>
  );
}

export function Loader({ label = 'Carregando…' }) {
  return <div className="columns-loader" role="status" aria-label={label}><span /><span /><span /><span /><span /></div>;
}

export function Empty({ icon = '🔍', title, children }) {
  return (
    <div className="empty">
      <p className="big" aria-hidden="true">{icon}</p>
      <strong>{title}</strong>
      {children && <p style={{ marginTop: 4, fontSize: 12.5 }}>{children}</p>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert-box error" role="alert" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <span>⚠ {error.message || String(error)}</span>
      {onRetry && <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Tentar novamente</button>}
    </div>
  );
}

/** Conteúdo com estados padronizados: carregando (skeleton), erro e vazio. */
export function Async({ state, skeleton, children, empty }) {
  if (state.loading && !state.data) return skeleton || <SkeletonRows />;
  if (state.error && !state.data) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (empty && empty.when(state.data)) return <Empty icon={empty.icon} title={empty.title}>{empty.text}</Empty>;
  return children(state.data);
}

export function Kpi({ label, value, color, onClick, active, sub }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="kpi" onClick={onClick} style={{ borderColor: active ? 'var(--accent)' : undefined }}>
      <p className="k-label">{label}</p>
      <p className="k-value" style={{ color: color || 'var(--accent)' }}>{value}</p>
      {sub && <p className="hint" style={{ marginTop: 2 }}>{sub}</p>}
    </Tag>
  );
}

export function Progress({ value, color }) {
  const w = Math.max(0, Math.min(100, Math.round((value || 0) * 100)));
  return <div className="progress" role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}><div style={{ width: w + '%', background: color }} /></div>;
}

/** Paginação simples. */
export function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Anterior</button>
      <span className="muted" style={{ fontSize: 12 }}>Página {page} de {pages}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima ›</button>
    </div>
  );
}
