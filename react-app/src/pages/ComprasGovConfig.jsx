import React, { useState } from 'react';
import { Async, Badge, SkeletonCards } from '../components/ui.jsx';
import CatalogoItem from '../components/CatalogoItem.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { fmtDateTime, num } from '../lib/format.js';

const NOMES = { grupos: 'Grupos de material', classes: 'Classes de material', pdms: 'PDMs', catmat: 'Itens CATMAT', catser: 'Itens CATSER' };

/**
 * Configurações › API Compras.gov: status da integração com a API de Dados Abertos
 * (dadosabertos.compras.gov.br), teste de conexão e consulta de teste por código.
 * Os parâmetros (endereço, tempo-limite, cache) ficam nos campos acima, salvos como as demais configurações.
 */
export default function ComprasGovConfig({ toast, versao }) {
  const st = useApi(() => api.get('/config/comprasgov'), [versao]);
  const [testando, setTestando] = useState(false);
  const [erros, setErros] = useState({});
  const testar = async () => {
    setTestando(true);
    try {
      const r = await api.post('/config/comprasgov/testar');
      st.setData(r); setErros(r.erros || {});
      toast(r.modo === 'api' ? 'Conexão com o Compras.gov funcionando' : r.status, r.modo === 'api' ? 'success' : 'error');
    } catch (e) { toast(e.message, 'error'); } finally { setTestando(false); }
  };
  return (
    <Async state={st} skeleton={<SkeletonCards n={2} h={180} />}>
      {(d) => (
        <div className="stack" style={{ gap: 20, marginTop: 20 }}>
          <section className="card lg">
            <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="card-title">Status da integração</h3>
                <p className="card-sub">API de Dados Abertos do Compras.gov — catálogo CATMAT (materiais) e CATSER (serviços). As consultas saem do servidor, nunca do navegador.</p>
                <p style={{ fontSize: 12, marginTop: 6 }}>
                  <span className="mono" style={{ overflowWrap: 'anywhere' }}>{d.baseUrl}</span> ·{' '}
                  <a href={d.baseUrl + '/swagger-ui/index.html'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Documentação da API ↗</a>
                </p>
              </div>
              <button type="button" className="btn btn-primary" disabled={testando || !d.ativo} onClick={testar}>{testando ? 'Testando…' : '↻ Testar conexão agora'}</button>
            </div>
            {!d.ativo && <p role="status" style={{ fontSize: 12.5, color: 'var(--warn-title)', background: 'var(--warn-bg)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>A consulta à API está desligada: o cadastro da despesa usa apenas os itens já guardados no cache.</p>}
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              <Badge level={d.modo === 'api' ? 'success' : d.modo === 'falha' ? 'critical' : 'info'}>{d.status}</Badge>
              <span className="muted" style={{ fontSize: 12 }}>Última verificação: {d.lastSync ? fmtDateTime(d.lastSync) + ' · ' + d.por : 'nunca'}</span>
            </div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 560 }}>
                <thead><tr><th>Consulta</th><th>Endpoint</th><th>Situação</th><th className="num">Tempo</th><th className="num">Registros na base oficial</th></tr></thead>
                <tbody>
                  {d.endpoints.map((e) => (
                    <tr key={e.key}>
                      <td style={{ fontWeight: 600 }}>{NOMES[e.key]}</td>
                      <td className="mono muted" style={{ fontSize: 11.5 }}>{e.path}</td>
                      <td>{e.status === 'ok' ? <Badge level="success">OK</Badge> : e.status === 'falha' ? <Badge level="critical" >{erros[e.key] ? 'Falha: ' + erros[e.key] : 'Falha'}</Badge> : <span className="muted-3">—</span>}</td>
                      <td className="num">{e.ms != null ? num(e.ms) + ' ms' : '—'}</td>
                      <td className="num">{num(d.counts[e.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Itens guardados no cache local: {num(d.cache.CATMAT || 0)} CATMAT e {num(d.cache.CATSER || 0)} CATSER.</p>
          </section>
          <ConsultaTeste />
        </div>
      )}
    </Async>
  );
}

function ConsultaTeste() {
  const [tipo, setTipo] = useState('CATMAT');
  const [codigo, setCodigo] = useState('');
  const [st, setSt] = useState({ loading: false, res: null, err: '' });
  const consultar = async (e) => {
    e.preventDefault();
    if (!/^\d{1,9}$/.test(codigo.trim())) { setSt({ loading: false, res: null, err: 'O código deve ter só números (até 9 dígitos).' }); return; }
    setSt({ loading: true, res: null, err: '' });
    try { const r = await api.get(`/compras/catalogo/consulta?tipo=${tipo}&codigo=${codigo.trim()}`); setSt({ loading: false, res: r, err: r.item ? '' : r.aviso || '' }); } catch (x) { setSt({ loading: false, res: null, err: x.message }); }
  };
  return (
    <section className="card lg">
      <h3 className="card-title">Consultar código</h3>
      <p className="card-sub" style={{ marginBottom: 14 }}>Confere o que o cadastro da despesa vai preencher para um código CATMAT ou CATSER.</p>
      <form className="row" style={{ gap: 10, alignItems: 'flex-end' }} onSubmit={consultar}>
        <div className="field"><label htmlFor="cg-tipo">Catálogo</label><select id="cg-tipo" className="select" style={{ width: 'auto' }} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="CATMAT">CATMAT (material)</option><option value="CATSER">CATSER (serviço)</option></select></div>
        <div className="field"><label htmlFor="cg-cod">Código</label><input id="cg-cod" className="input" inputMode="numeric" style={{ width: 160 }} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="Ex.: 445099" /></div>
        <button type="submit" className="btn btn-primary" disabled={st.loading || !codigo}>{st.loading ? 'Consultando…' : 'Consultar'}</button>
      </form>
      <div style={{ marginTop: 14 }} aria-live="polite">
        {st.err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)' }}>{st.err}</p>}
        {st.res && st.res.item && <CatalogoItem item={st.res.item} origem={st.res.origem} />}
      </div>
    </section>
  );
}
