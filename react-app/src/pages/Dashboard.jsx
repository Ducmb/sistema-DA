import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Layout.jsx';
import { Async, SkeletonCards } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useApi, useInterval, useIsMobile } from '../lib/hooks.js';
import { ExercicioSelect, useExercicio } from '../lib/cadastros.jsx';

const ICONS = { concluidos: ['✔', 'var(--accent-soft)', 'var(--accent)'], andamento: ['⏱', 'var(--info-bg)', 'var(--info-strong)'], assinatura: ['✍', 'var(--warn-bg)', 'var(--warn)'] };
const LEVEL = {
  critical: { bg: 'var(--crit-bg)', color: 'var(--crit)', title: 'var(--crit-title)', desc: 'var(--crit-strong)' },
  warning: { bg: 'var(--warn-bg)', color: 'var(--warn)', title: 'var(--warn-title)', desc: 'var(--warn)' },
  info: { bg: 'var(--info-bg)', color: 'var(--info)', title: 'var(--info-title)', desc: 'var(--info-strong)' }
};
const ORD = { critical: 0, warning: 1, info: 2 };
const DISMISS_KEY = 'DA_feed_dismissed';
const readDismissed = () => { try { return JSON.parse(sessionStorage.getItem(DISMISS_KEY)) || []; } catch (e) { return []; } };

/** Painel Administrativo Geral: indicadores do exercício e feed de alertas em tempo real. */
export default function Dashboard() {
  const [ano] = useExercicio();
  const mobile = useIsMobile();
  const st = useApi((signal) => api.get('/painel' + qs({ ano }), { signal }), [ano]);
  const refresh = st.data ? st.data.feed.refresh : 30;
  useInterval(() => api.get('/painel' + qs({ ano }), { background: true }).then(st.setData).catch(() => {}), Math.max(5, refresh) * 1000);
  return (
    <>
      <PageHeader section="Dashboard" title={<span className="row" style={{ alignItems: 'baseline', gap: 10 }}>Painel Administrativo Geral{st.data && <span className="badge" style={{ borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '6px 12px', fontSize: 12 }}>Perfil: {st.data.perfil}</span>}</span>}>
        <ExercicioSelect label="Exercício Fiscal" />
      </PageHeader>
      <main className="page">
        <Async state={st} skeleton={<SkeletonCards n={6} h={160} />}>
          {(d) => (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                {d.cards.map((c, i) => {
                  const [icon, bg, color] = ICONS[c.key];
                  return (
                    <div key={c.key} className="card row fade-up" style={{ padding: 18, gap: 14, alignItems: 'flex-start', flexWrap: 'nowrap', borderRadius: 12, animationDelay: i * 60 + 'ms' }}>
                      <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-3)', textTransform: 'uppercase' }}>{c.label}</p>
                        <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{c.value}</p>
                        {c.sub && <p className="muted-3" style={{ fontSize: 11.5, marginTop: 4 }}>{c.sub}</p>}
                        {c.badge && <span className="badge" style={{ marginTop: 6, background: 'var(--warn-bg)', color: 'var(--warn)' }}>{c.badge}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
                <div className="stack" style={{ gap: 20, minWidth: 0, order: 1 }}>
                  {d.fluxo.visivel && <Fluxo fluxo={d.fluxo} />}
                  <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                    {d.auditoria && (
                      <section className="card" style={{ padding: 20, borderRadius: 12 }}>
                        <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Auditoria de Almoxarifado</h3>
                        <p className="muted-3" style={{ fontSize: 11.5, marginBottom: 14 }}>Auditorias da Semana: {d.auditoria.contados} de {d.auditoria.total} itens contados</p>
                        <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 46, flexWrap: 'nowrap' }}>
                          {d.auditoria.colunas.map((c) => <div key={c.dia} title={c.dia + ': ' + c.n + ' contagem(ns)'} style={{ flex: 1, height: c.pct + '%', minHeight: 4, background: c.alt ? '#2E6B4E' : 'var(--primary)', borderRadius: '2px 2px 0 0', opacity: c.n ? 1 : 0.25 }} />)}
                        </div>
                      </section>
                    )}
                    {d.capacidade.length > 0 && (
                      <section className="card" style={{ padding: 20, borderRadius: 12 }}>
                        <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Capacidade Operacional de Contagem</h3>
                        <p className="muted-3" style={{ fontSize: 11.5, marginBottom: 16 }}>Demandas ativas por setor</p>
                        <div className="stack" style={{ gap: 12 }}>
                          {d.capacidade.map((r) => (
                            <div key={r.label} className="row between" style={{ borderTop: '1px solid var(--divider)', paddingTop: 12, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 12.5 }}>{r.label}</span>
                              {r.destaque ? <span className="badge" style={{ background: 'var(--warn-bg)', color: 'var(--warn-title)', whiteSpace: 'nowrap' }}>{r.value}</span> : <span style={{ fontSize: 13, fontWeight: 700 }}>{r.value}</span>}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    {d.agentes && (
                      <Link to="/compras" className="card" style={{ display: 'block', padding: 20, borderRadius: 12, textDecoration: 'none', color: 'inherit' }}>
                        <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Carga por Agente de Contratação</h3>
                        <p className="muted" style={{ fontSize: 11.5, marginBottom: 14 }}>Processos ativos em Compras &amp; Licitações</p>
                        <div className="stack" style={{ gap: 10 }}>
                          {d.agentes.map((a) => (
                            <div key={a.agente} className="stack" style={{ gap: 4 }}>
                              <div className="row between" style={{ fontSize: 12.5, flexWrap: 'nowrap' }}><span style={{ fontWeight: 600 }}>{a.agente}</span><span style={{ fontWeight: 600, color: a.atrasados ? 'var(--crit-strong)' : 'var(--text-2)' }}>{a.ativos} ativos{a.atrasados ? ' · ' + a.atrasados + ' atrasado(s)' : ''}</span></div>
                              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)' }}><div style={{ height: 6, borderRadius: 999, background: 'var(--primary)', width: a.pct + '%' }} /></div>
                            </div>
                          ))}
                          {!d.agentes.length && <p className="muted" style={{ fontSize: 12 }}>Nenhum agente de contratação cadastrado.</p>}
                        </div>
                      </Link>
                    )}
                    {d.metas && (
                      <section className="card" style={{ padding: 20, borderRadius: 12 }}>
                        <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Indicador Metas Legislativas (DA)</h3>
                        <p className="muted-3" style={{ fontSize: 11.5, marginBottom: 18 }}>Documentos do Protocolo por fase no exercício</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, alignItems: 'end', height: 90 }}>
                          {d.metas.map((m, i) => <div key={m.nome} style={{ display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'flex-end' }}><div title={m.nome + ': ' + m.n} style={{ width: '100%', maxWidth: 34, height: Math.max(6, (m.pct / 100) * 70) + 'px', background: ['var(--primary)', '#2E6B4E', '#4E8A6C', '#9DBFAD'][i], borderRadius: '4px 4px 0 0' }} /></div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
                          {d.metas.map((m) => <p key={m.nome} className="muted-3" style={{ fontSize: 10.5, fontWeight: 600, textAlign: 'center' }}>{m.nome}<br /><strong style={{ color: 'var(--text)' }}>{m.n}</strong></p>)}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: 0, order: mobile ? 0 : 2 }}>
                  <Feed alertas={d.alertas} cfg={d.feed} />
                </div>
              </div>
            </>
          )}
        </Async>
      </main>
    </>
  );
}

function Fluxo({ fluxo }) {
  const W = 400, H = 120, n = fluxo.serie.length;
  const mx = Math.max(1, ...fluxo.serie.map((s) => s.valor));
  const pts = fluxo.serie.map((s, i) => [n > 1 ? (i / (n - 1)) * W : W / 2, H - 10 - (s.valor / mx) * (H - 30)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const v = fluxo.variacao;
  return (
    <section className="card fade-up" style={{ padding: 22, borderRadius: 12 }}>
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h3 style={{ fontSize: 15.5, fontWeight: 700 }}>Fluxo de Processos</h3>
          <p className="muted-3" style={{ fontSize: 12, marginTop: 3 }}>Movimentações mensais na Diretoria Administrativa (etapas concluídas e documentos protocolados)</p>
        </div>
        {v !== null && <span className="badge" style={{ fontSize: 11.5, background: v >= 0 ? 'var(--accent-soft)' : 'var(--crit-bg)', color: v >= 0 ? 'var(--accent)' : 'var(--crit-strong)', padding: '5px 10px', whiteSpace: 'nowrap' }}>{v >= 0 ? '↗ +' : '↘ '}{String(v).replace('.', ',')}% este mês</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img" aria-label={'Fluxo mensal: ' + fluxo.serie.map((s) => s.mes + ' ' + s.valor).join(', ')}>
        <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--border)" strokeWidth="1" />
        <path d={`M ${pts[0][0]} ${pts[0][1]} ` + pts.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${W} ${H + 30} L 0 ${H + 30} Z`} fill="url(#areaGradient)" />
        <polyline points={line} stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--primary)"><title>{fluxo.serie[i].mes}: {fluxo.serie[i].valor}</title></circle>)}
      </svg>
      <div className="row between" style={{ marginTop: 6, padding: '0 2px', flexWrap: 'nowrap' }}>
        {fluxo.serie.map((s) => <span key={s.mes} className="muted-3" style={{ fontSize: 11, fontWeight: 600 }}>{s.mes}</span>)}
      </div>
    </section>
  );
}

/**
 * Feed de alertas (regras do protótipo): ordem por gravidade e chegada; a cada `autoDismiss` segundos
 * o aviso do topo avança — azuis saem do feed, amarelos/vermelhos voltam ao fim da fila. Pausa no hover.
 * Alterações num alerta já exibido viram "+N atualização(ões)" quando `agrupar` está ligado.
 */
function Feed({ alertas, cfg }) {
  const nav = useNavigate();
  const meta = useRef({});
  const first = useRef(true);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [hidden, setHidden] = useState([]);
  const [rot, setRot] = useState(0);
  const [rotAt, setRotAt] = useState(Date.now());
  const [hover, setHover] = useState(false);
  const [, tick] = useState(0);
  const [lastAt, setLastAt] = useState(Date.now());

  useEffect(() => {
    const now = Date.now();
    alertas.forEach((a) => {
      const sig = a.title + '|' + a.description + '|' + a.level, m = meta.current[a.id];
      if (!m) meta.current[a.id] = { first: first.current ? now - 2000 : now, sig, count: 0, pulse: 0 };
      else if (m.sig !== sig) meta.current[a.id] = cfg.agrupar !== false ? { ...m, sig, count: m.count + 1, pulse: now } : { first: now, sig, count: 0, pulse: 0 };
    });
    first.current = false;
    setLastAt(now);
  }, [alertas]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = alertas.filter((a) => !dismissed.includes(a.id) && !hidden.includes(a.id))
    .sort((a, b) => (ORD[a.level] ?? 2) - (ORD[b.level] ?? 2) || (meta.current[b.id] || {}).first - (meta.current[a.id] || {}).first);
  const r = base.length ? rot % base.length : 0;
  const list = base.slice(r).concat(base.slice(0, r));
  const autoMs = Math.max(2, cfg.autoDismiss) * 1000;

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      if (hover || now - rotAt < autoMs || !list.length) { if (!list.length) setRotAt(now); tick((x) => x + 1); return; }
      const top = list[0];
      if (top.level === 'info') setHidden((h) => [...h, top.id]); else setRot((x) => x + 1);
      setRotAt(now);
    }, 500);
    return () => clearInterval(t);
  });

  const dismiss = (id) => { const l = [...dismissed, id]; setDismissed(l); try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(l)); } catch (e) { /* sem storage */ } };
  const now = Date.now();
  const left = Math.max(0, Math.ceil((autoMs - (now - rotAt)) / 1000));
  const ago = Math.max(0, Math.round((now - lastAt) / 1000));
  const status = list.length + ' alerta(s) ativos · ' + (hover ? 'pausado enquanto o cursor está no feed' : list.length > 1 ? 'próximo aviso em ' + left + 's' : 'atualizado ' + (ago < 2 ? 'agora' : 'há ' + ago + 's')) + '. Avisos azuis saem do feed após serem exibidos; amarelos e vermelhos voltam ao fim da fila.';

  return (
    <section className="card fade-up" style={{ padding: 20, borderRadius: 12 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}><span aria-hidden="true" style={{ fontSize: 15 }}>🔔</span><h3 style={{ fontSize: 14, fontWeight: 700 }}>Alertas em Tempo Real</h3></div>
        <span className="row" style={{ gap: 5, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'liveDot 1.6s ease-in-out infinite' }} />Ao vivo</span>
      </div>
      <p className="muted" style={{ fontSize: 11, marginBottom: 14, lineHeight: 1.4 }} aria-live="polite">{status}</p>
      <div className="stack" style={{ gap: 10, maxHeight: 420, overflowY: 'auto', opacity: hover ? 1 : cfg.opacidade / 100, transition: 'opacity .3s ease' }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
        {list.slice(0, 5).map((a, idx) => {
          const L = LEVEL[a.level] || LEVEL.info, m = meta.current[a.id] || { first: now, count: 0, pulse: 0 };
          const isNew = now - m.first < 1200, pulsing = now - m.pulse < 1200;
          const anim = isNew ? 'feedIn .5s cubic-bezier(.2,.8,.2,1) both' : idx === 0 ? `feedDown .45s ease-out both` : pulsing ? 'feedPulse 1s ease-out' : 'none';
          return (
            <div key={a.id + (idx === 0 ? '-' + rot + '-' + hidden.length : '')} role="link" tabIndex={0} title="Abrir a origem do alerta"
              onClick={() => a.href && nav(a.href)} onKeyDown={(e) => { if (e.key === 'Enter' && a.href) nav(a.href); }}
              style={{ position: 'relative', background: L.bg, borderRadius: 8, padding: '12px 40px 12px 14px', cursor: 'pointer', animation: anim, outline: idx === 0 && list.length > 1 ? '2px solid ' + L.color : 'none', outlineOffset: -1 }}>
              <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: L.color }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, color: L.color, textTransform: 'uppercase' }}>{a.category}</span>
                {m.count > 0 && <span style={{ display: 'inline-flex', overflow: 'hidden', fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--surface)', color: L.color, border: '1px solid ' + L.color }}><span style={{ animation: pulsing ? 'numRoll .4s ease-out' : 'none' }}>+{m.count} atualização(ões)</span></span>}
                {isNew && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: L.color, color: '#fff' }}>Novo</span>}
              </div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: L.title, lineHeight: 1.3 }}>{a.title}</p>
              <p style={{ fontSize: 11.5, color: L.desc, marginTop: 3, lineHeight: 1.35 }}>{a.description}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: L.color, marginTop: 6 }}>Abrir →</p>
              <button type="button" aria-label="Dispensar alerta" title="Dispensar" onClick={(e) => { e.stopPropagation(); dismiss(a.id); }}
                style={{ position: 'absolute', top: 6, right: 6, width: 32, height: 32, border: 'none', borderRadius: 6, background: 'transparent', color: L.color, fontSize: 13 }}>✕</button>
            </div>
          );
        })}
        <Link to="/notificacoes" className="row" style={{ justifyContent: 'center', minHeight: 44, border: '1px dashed var(--border-input)', borderRadius: 10, color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
          {list.length > 5 ? 'Ver todos os ' + list.length + ' alertas na Central →' : 'Abrir Central de Notificações (histórico completo) →'}
        </Link>
      </div>
    </section>
  );
}
