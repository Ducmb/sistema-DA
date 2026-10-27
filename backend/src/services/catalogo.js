/**
 * Catálogo compras.gov.br (CATMAT/CATSER). A sincronização roda no servidor (rotina diária e botão manual),
 * consultando a API de Dados Abertos — nunca pelo navegador.
 * Base: https://dadosabertos.compras.gov.br
 */
const db = require('../db');

const BASE = process.env.COMPRAS_GOV_API || 'https://dadosabertos.compras.gov.br';
const ENDPOINTS = [
  ['grupos', '/modulo-material/1_consultarGrupoMaterial'],
  ['classes', '/modulo-material/2_consultarClasseMaterial'],
  ['pdms', '/modulo-material/3_consultarPdmMaterial'],
  ['catmat', '/modulo-material/4_consultarItemMaterial'],
  ['catser', '/modulo-servico/6_consultarItemServico']
];
const DEFAULT_COUNTS = { grupos: 79, classes: 663, pdms: 26418, catmat: 168902, catser: 3171 };

async function itens() {
  const { rows } = await db.query('SELECT * FROM catalogo_itens ORDER BY catalogo, nome');
  return rows;
}

async function status() {
  const { rows } = await db.query('SELECT s.*, u.name AS por_nome FROM catalogo_sync s LEFT JOIN users u ON u.id = s.por ORDER BY executado_em DESC LIMIT 1');
  const last = rows[0];
  const { rows: ok } = await db.query("SELECT contagens FROM catalogo_sync WHERE modo = 'api' ORDER BY executado_em DESC LIMIT 1");
  return {
    lastSync: last ? last.executado_em : null,
    status: last ? last.status : 'Base local (ainda não sincronizada)',
    modo: last ? last.modo : 'local',
    por: last ? last.por_nome || 'Rotina automática' : null,
    counts: { ...DEFAULT_COUNTS, ...(ok[0] ? ok[0].contagens : {}) },
    endpoints: ENDPOINTS.map(([k, path]) => ({ key: k, path, status: last && last.endpoints[k] ? last.endpoints[k] : null }))
  };
}

async function fetchCount(path, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(BASE + path + '?pagina=1', { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return typeof j.totalRegistros === 'number' ? j.totalRegistros : null;
  } finally {
    clearTimeout(t);
  }
}

/** Consulta os endpoints e registra o resultado. Nunca lança. */
async function sync(userId = null, { timeoutMs = 8000 } = {}) {
  const endpoints = {}, counts = {};
  let okCount = 0;
  for (const [k, path] of ENDPOINTS) {
    try {
      const n = await fetchCount(path, timeoutMs);
      endpoints[k] = 'ok';
      if (n != null) counts[k] = n;
      okCount++;
    } catch (e) {
      endpoints[k] = 'falha';
    }
  }
  const modo = okCount === ENDPOINTS.length ? 'api' : 'falha';
  const st = modo === 'api' ? 'Sincronizado via API oficial' : okCount ? `Sincronização parcial (${okCount} de ${ENDPOINTS.length} endpoints)` : 'Falha ao acessar a API — mantida a base local';
  await db.query('INSERT INTO catalogo_sync (modo, status, contagens, endpoints, por) VALUES ($1,$2,$3,$4,$5)', [modo, st, JSON.stringify(counts), JSON.stringify(endpoints), userId]);
  return { modo, status: st, counts, endpoints };
}

module.exports = { itens, status, sync, ENDPOINTS };
