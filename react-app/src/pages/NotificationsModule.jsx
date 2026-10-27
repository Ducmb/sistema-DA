import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Layout.jsx';
import { Async, SkeletonRows, Switch, Tabs, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi, useQueryState } from '../lib/hooks.js';
import { MODULE_NAMES } from '../lib/modules.js';

const LV = { critical: ['🔴', '#DC2626'], warning: ['🟠', '#F59E0B'], info: ['🔵', '#3B82F6'] };
const TIPO = { alert: 'Alertas', approval: 'Aprovações', update: 'Atualizações', reminder: 'Lembretes' };
const changed = () => window.dispatchEvent(new Event('da:notificacoes'));

/** "há 8 min", "há 2h", "há 1 dia". */
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts)) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return 'há ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'há ' + h + 'h';
  const d = Math.round(h / 24);
  return 'há ' + d + (d === 1 ? ' dia' : ' dias');
}

/** Central de Notificações: alertas reais dos módulos, com estado por usuário. */
export default function NotificationsModule() {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useQueryState('tab', 'inbox');
  const st = useApi(() => api.get('/notifications'), []);
  const act = async (path, msg) => { try { await api.post('/notifications' + path); if (msg) toast(msg); st.reload(); changed(); } catch (e) { toast(e.message, 'error'); } };
  const open = async (n) => { if (n.unread) await api.post(`/notifications/${encodeURIComponent(n.id)}/read`).catch(() => {}); changed(); if (n.href) nav(n.href); };
  const unread = st.data ? st.data.inbox.filter((n) => n.unread).length : 0;
  const TABS = [{ key: 'inbox', label: '📬 Caixa de Entrada' }, { key: 'unread', label: `🔴 Não Lidas (${unread})` }, { key: 'archived', label: '📦 Arquivadas' }, { key: 'preferences', label: '⚙️ Preferências' }];
  const t = TABS.some((x) => x.key === tab) ? tab : 'inbox';
  return (
    <>
      <PageHeader section="Notificações" title="Central de Notificações" />
      <main className="page">
        <Tabs tabs={TABS} value={t} onChange={setTab} label="Seções da central de notificações" />
        <Async state={st} skeleton={<SkeletonRows n={5} />}>
          {(d) => (
            <div className="fade-up" key={t}>
              {d.disabled && t !== 'preferences' && <p className="card" style={{ padding: 16, marginBottom: 16, fontSize: 13, background: 'var(--warn-bg)', color: 'var(--warn-title)' }}>As notificações no sistema estão desativadas em Configurações › Notificações.</p>}
              {t === 'inbox' && <Inbox items={d.inbox} onOpen={open} act={act} />}
              {t === 'unread' && (
                <div className="stack" style={{ gap: 12 }}>
                  <div><button type="button" className="btn btn-primary" disabled={!unread} onClick={() => act('/read-all', 'Todas marcadas como lidas')}>✓ Marcar tudo como lido</button></div>
                  {d.inbox.filter((n) => n.unread).map((n) => <Item key={n.id} n={n} onOpen={open} act={act} tinted />)}
                  {!unread && <EmptyBox />}
                </div>
              )}
              {t === 'archived' && (
                <div className="stack" style={{ gap: 12 }}>
                  {d.archived.map((n) => (
                    <div key={n.id} className="card row between" style={{ padding: 16, opacity: 0.7, flexWrap: 'nowrap' }}>
                      <div className="row" style={{ gap: 12, flex: 1, minWidth: 0, flexWrap: 'nowrap' }}>
                        <span aria-hidden="true" style={{ fontSize: 16 }}>{(LV[n.level] || LV.info)[0]}</span>
                        <div style={{ minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</p><p className="muted-3" style={{ fontSize: 11 }}>Arquivado {ago(n.archivedAt)}</p></div>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(`/${encodeURIComponent(n.id)}/restore`, 'Notificação restaurada')}>Restaurar</button>
                    </div>
                  ))}
                  {!d.archived.length && <p className="card muted" style={{ padding: 28, textAlign: 'center', fontSize: 13 }}>Nenhuma notificação arquivada.</p>}
                </div>
              )}
              {t === 'preferences' && <Preferencias data={d} onSaved={() => { st.reload(); changed(); }} />}
            </div>
          )}
        </Async>
      </main>
    </>
  );
}

function Inbox({ items, onOpen, act }) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const t = q.trim().toLowerCase();
  const list = items.filter((n) => (!tipo || n.tipo === tipo) && (!t || (n.title + ' ' + n.message).toLowerCase().includes(t)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card row" style={{ padding: 16 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 200 }} placeholder="🔍 Buscar notificações..." aria-label="Buscar notificações" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>{Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className="btn btn-secondary" disabled={!items.length} onClick={() => act('/archive-all', 'Notificações arquivadas')}>Limpar todos</button>
      </div>
      {list.map((n) => <Item key={n.id} n={n} onOpen={onOpen} act={act} />)}
      {!list.length && <EmptyBox />}
    </div>
  );
}

function Item({ n, onOpen, act, tinted }) {
  const [icon, color] = LV[n.level] || LV.info;
  const id = encodeURIComponent(n.id);
  return (
    <div className="card row" role="link" tabIndex={0} onClick={() => onOpen(n)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(n); }}
      style={{ padding: 16, gap: 12, alignItems: 'flex-start', flexWrap: 'nowrap', cursor: 'pointer', borderLeft: '4px solid ' + color, background: tinted ? color + '11' : undefined, animation: 'feedIn .3s ease-out' }}>
      <span aria-hidden="true" style={{ fontSize: 20, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between" style={{ marginBottom: 6, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <p style={{ fontSize: 13, fontWeight: n.unread ? 700 : 600 }}>{n.title}</p>
          {n.unread && <span aria-label="Não lida" style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />}
        </div>
        {n.message && <p className="muted" style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>{n.message}</p>}
        <div className="row between">
          <p className="muted-3" style={{ fontSize: 11 }}>{MODULE_NAMES[n.module] || n.module} · {TIPO[n.tipo]} · {ago(n.firstSeen)}</p>
          <div className="row" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!n.unread} onClick={() => act(`/${id}/read`)}>{n.unread ? '✓ Marcar lido' : 'Lido'}</button>
            <button type="button" className="btn btn-secondary btn-sm" aria-label="Arquivar" title="Arquivar" onClick={() => act(`/${id}/archive`, 'Notificação arquivada')}>📦</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const EmptyBox = () => (
  <div className="card" style={{ textAlign: 'center', padding: 40 }}>
    <p style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">📭</p>
    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nenhuma notificação</p>
    <p className="muted-3" style={{ fontSize: 12 }}>Você está em dia com todas as atualizações</p>
  </div>
);

function Preferencias({ data, onSaved }) {
  const toast = useToast();
  const [p, setP] = useState(data.prefs);
  const [err, setErr] = useState('');
  const save = async () => {
    try { setP(await api.put('/notifications/preferences', p)); setErr(''); toast('Preferências salvas'); onSaved(); } catch (e) { setErr(e.message); }
  };
  const box = (title, children) => <section className="card lg" style={{ marginBottom: 20 }}><h3 className="card-title" style={{ marginBottom: 16 }}>{title}</h3>{children}</section>;
  const check = (label, on, onChange, disabled, hint) => (
    <label className="row" style={{ gap: 10, minHeight: 44, flexWrap: 'nowrap', opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={onChange} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
      <span style={{ fontSize: 13 }}>{label}{hint && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{hint}</span>}</span>
    </label>
  );
  return (
    <div style={{ maxWidth: 600 }}>
      {box('Tipos de Notificação', (
        <div className="stack" style={{ gap: 12 }}>
          {data.types.map((ty) => (
            <div key={ty.id} className="row between" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 6, flexWrap: 'nowrap' }}>
              <div><p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ty.label}</p><p className="muted-3" style={{ fontSize: 11 }}>{ty.description}</p></div>
              <Switch on={p.types[ty.id] !== false} label={ty.label} onChange={(v) => setP({ ...p, types: { ...p.types, [ty.id]: v } })} />
            </div>
          ))}
        </div>
      ))}
      {box('Método de Entrega', (
        <div className="stack" style={{ gap: 4 }}>
          {check('Notificações em tempo real no aplicativo', p.tempoReal, () => setP({ ...p, tempoReal: !p.tempoReal }))}
          {check(`Notificações por e-mail (resumo diário às ${data.resumoHora})`, p.email, () => setP({ ...p, email: !p.email }), !data.emailHabilitado, !data.emailHabilitado ? 'Canal de e-mail desativado em Configurações › Notificações.' : '')}
        </div>
      ))}
      {box('Horário de Silêncio', (
        <>
          <div className="row" style={{ gap: 12 }}>
            {check('Ativar', p.silencio.on, () => setP({ ...p, silencio: { ...p.silencio, on: !p.silencio.on } }))}
            <input type="time" className="input" style={{ width: 'auto' }} aria-label="Início do silêncio" value={p.silencio.inicio} onChange={(e) => setP({ ...p, silencio: { ...p.silencio, inicio: e.target.value } })} />
            <span className="muted-3" style={{ fontSize: 13 }}>até</span>
            <input type="time" className="input" style={{ width: 'auto' }} aria-label="Fim do silêncio" value={p.silencio.fim} onChange={(e) => setP({ ...p, silencio: { ...p.silencio, fim: e.target.value } })} />
          </div>
          <p className="muted-3" style={{ fontSize: 11, marginTop: 8 }}>Apenas notificações críticas são contadas no sino fora do horário de trabalho</p>
        </>
      ))}
      <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={save}>💾 Salvar Preferências</button>
      {err && <p role="alert" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--crit-strong)', textAlign: 'center' }}>{err}</p>}
    </div>
  );
}
