/**
 * Catálogo CATMAT/CATSER pela API de Dados Abertos do Compras.gov (https://dadosabertos.compras.gov.br).
 * Todas as chamadas saem do servidor — nunca do navegador. Parâmetros em Configurações › API Compras.gov.
 * As consultas por código ficam em cache (catalogo_itens) pelo prazo configurado; se a API falhar,
 * o cache é usado mesmo vencido.
 */
const db = require('../db');
const config = require('./config');

const ENDPOINTS = [
  ['grupos', '/modulo-material/1_consultarGrupoMaterial'],
  ['classes', '/modulo-material/2_consultarClasseMaterial'],
  ['pdms', '/modulo-material/3_consultarPdmMaterial'],
  ['catmat', '/modulo-material/4_consultarItemMaterial'],
  ['catser', '/modulo-servico/6_consultarItemServico']
];
const DEFAULT_COUNTS = { grupos: 79, classes: 663, pdms: 26418, catmat: 168902, catser: 3171 };
const CODIGO = /^\d{1,9}$/;

class ApiError extends Error {}

/** GET na API oficial com tempo-limite; sem seguir redirecionamentos. Retorna { json, ms }. */
async function apiGet(path, params = {}) {
  const base = await config.get('comprasgov.baseUrl');
  const timeoutMs = (await config.get('comprasgov.timeout')) * 1000;
  const url = new URL(base + path);
  Object.entries({ pagina: 1, ...params }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new ApiError('HTTP ' + r.status);
    const json = await r.json();
    return { json, ms: Date.now() - t0 };
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'tempo-limite excedido' : e instanceof ApiError ? e.message : 'falha de conexão');
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- Consulta por código (autocomplete do cadastro da despesa) ---------------- */
const fromMaterial = (x) => ({
  catalogo: 'CATMAT', codigo: String(x.codigoItem), nome: (x.descricaoItem || '').trim(),
  grupo_cod: x.codigoGrupo != null ? String(x.codigoGrupo) : null, grupo_nome: x.nomeGrupo || null,
  classe_cod: x.codigoClasse != null ? String(x.codigoClasse) : null, classe_nome: x.nomeClasse || null,
  pdm_cod: x.codigoPdm != null ? String(x.codigoPdm) : null, pdm_nome: x.nomePdm || null,
  ativo: x.statusItem !== false, extra: { sustentavel: !!x.itemSustentavel, ncm: x.codigo_ncm || null, atualizadoNaFonte: x.dataHoraAtualizacao || null }
});
const fromServico = (x) => ({
  catalogo: 'CATSER', codigo: String(x.codigoServico), nome: (x.nomeServico || '').trim(),
  grupo_cod: x.codigoGrupo != null ? String(x.codigoGrupo) : null, grupo_nome: x.nomeGrupo || null,
  classe_cod: x.codigoClasse != null ? String(x.codigoClasse) : null, classe_nome: x.nomeClasse || null,
  pdm_cod: null, pdm_nome: null,
  ativo: x.statusServico !== false,
  extra: { secao: x.codigoSecao != null ? { cod: String(x.codigoSecao), nome: x.nomeSecao } : null, divisao: x.codigoDivisao != null ? { cod: String(x.codigoDivisao), nome: x.nomeDivisao } : null, subclasse: x.codigoSubclasse != null ? { cod: String(x.codigoSubclasse), nome: x.nomeSubclasse } : null, cpc: x.codigoCpc || null, atualizadoNaFonte: x.dataHoraAtualizacao || null }
});

const itemOf = (r) => ({
  catalogo: r.catalogo, codigo: r.codigo, descricao: r.nome, ativo: r.ativo,
  grupo: r.grupo_cod ? { cod: r.grupo_cod, nome: r.grupo_nome } : null,
  classe: r.classe_cod ? { cod: r.classe_cod, nome: r.classe_nome } : null,
  pdm: r.pdm_cod ? { cod: r.pdm_cod, nome: r.pdm_nome } : null,
  ...(r.catalogo === 'CATSER' ? { secao: (r.extra || {}).secao || null, divisao: (r.extra || {}).divisao || null, subclasse: (r.extra || {}).subclasse || null } : {}),
  atualizadoEm: r.atualizado_em, fonte: r.fonte
});

async function upsert(it) {
  const { rows } = await db.query(
    `INSERT INTO catalogo_itens (catalogo, codigo, nome, grupo_cod, grupo_nome, classe_cod, classe_nome, pdm_cod, pdm_nome, ativo, extra, fonte, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'api',NOW())
     ON CONFLICT (catalogo, codigo) DO UPDATE SET nome=EXCLUDED.nome, grupo_cod=EXCLUDED.grupo_cod, grupo_nome=EXCLUDED.grupo_nome,
       classe_cod=EXCLUDED.classe_cod, classe_nome=EXCLUDED.classe_nome, pdm_cod=EXCLUDED.pdm_cod, pdm_nome=EXCLUDED.pdm_nome,
       ativo=EXCLUDED.ativo, extra=EXCLUDED.extra, fonte='api', atualizado_em=NOW()
     RETURNING *`,
    [it.catalogo, it.codigo, it.nome.slice(0, 1000), it.grupo_cod, it.grupo_nome, it.classe_cod, it.classe_nome, it.pdm_cod, it.pdm_nome, it.ativo, JSON.stringify(it.extra)]);
  return rows[0];
}

/**
 * Item do catálogo por código. Usa o cache dentro da validade; senão consulta a API.
 * Resultado: { item, origem: 'cache'|'api'|'cache-vencido'|null, aviso? }. item null = não encontrado.
 * `online: false` usa só o cache (ex.: ao gravar a despesa).
 */
async function consultar(catalogo, codigo, { online = true } = {}) {
  if (!['CATMAT', 'CATSER'].includes(catalogo) || !CODIGO.test(String(codigo))) throw new Error('Código inválido.');
  const cod = String(+codigo);
  const { rows } = await db.query('SELECT * FROM catalogo_itens WHERE catalogo = $1 AND codigo = $2', [catalogo, cod]);
  const cached = rows[0];
  const dias = await config.get('comprasgov.cacheDias');
  const fresco = cached && cached.fonte === 'api' && Date.now() - new Date(cached.atualizado_em).getTime() < dias * 864e5;
  if (fresco || !online) return { item: cached ? itemOf(cached) : null, origem: cached ? 'cache' : null };
  if (!(await config.get('comprasgov.ativo'))) {
    return { item: cached ? itemOf(cached) : null, origem: cached ? 'cache' : null, aviso: 'Consulta à API desativada em Configurações › API Compras.gov.' };
  }
  try {
    const { json } = catalogo === 'CATMAT'
      ? await apiGet('/modulo-material/4_consultarItemMaterial', { codigoItem: cod })
      : await apiGet('/modulo-servico/6_consultarItemServico', { codigoServico: cod });
    const x = Array.isArray(json.resultado) ? json.resultado[0] : null;
    if (!x) return { item: null, origem: 'api' };
    return { item: itemOf(await upsert(catalogo === 'CATMAT' ? fromMaterial(x) : fromServico(x))), origem: 'api' };
  } catch (e) {
    if (cached) return { item: itemOf(cached), origem: 'cache-vencido', aviso: 'API do Compras.gov indisponível (' + e.message + '); exibindo dados do cache.' };
    return { item: null, origem: null, aviso: 'API do Compras.gov indisponível (' + e.message + '). Tente de novo ou preencha manualmente.' };
  }
}

/* ---------------- Status, sincronização e teste de conexão ---------------- */
async function itens() {
  const { rows } = await db.query('SELECT * FROM catalogo_itens ORDER BY catalogo, nome');
  return rows;
}

async function status() {
  const { rows } = await db.query('SELECT s.*, u.name AS por_nome FROM catalogo_sync s LEFT JOIN users u ON u.id = s.por ORDER BY executado_em DESC LIMIT 1');
  const last = rows[0];
  const { rows: ok } = await db.query("SELECT contagens FROM catalogo_sync WHERE modo = 'api' ORDER BY executado_em DESC LIMIT 1");
  const { rows: cache } = await db.query("SELECT catalogo, COUNT(*)::int n FROM catalogo_itens WHERE fonte = 'api' GROUP BY 1");
  return {
    lastSync: last ? last.executado_em : null,
    status: last ? last.status : 'Base local (ainda não sincronizada)',
    modo: last ? last.modo : 'local',
    por: last ? last.por_nome || 'Rotina automática' : null,
    counts: { ...DEFAULT_COUNTS, ...(ok[0] ? ok[0].contagens : {}) },
    cache: Object.fromEntries(cache.map((c) => [c.catalogo, c.n])),
    baseUrl: await config.get('comprasgov.baseUrl'),
    ativo: await config.get('comprasgov.ativo'),
    endpoints: ENDPOINTS.map(([k, path]) => ({ key: k, path, status: last && last.endpoints[k] ? last.endpoints[k] : null, ms: last && last.latencias ? last.latencias[k] ?? null : null }))
  };
}

/** Consulta cada endpoint (1ª página), registra contagens e tempos. Nunca lança. */
async function sync(userId = null) {
  const endpoints = {}, counts = {}, latencias = {}, erros = {};
  let okCount = 0;
  if (!(await config.get('comprasgov.ativo'))) {
    const st = 'Consulta à API desativada em Configurações';
    await db.query('INSERT INTO catalogo_sync (modo, status, contagens, endpoints, por) VALUES ($1,$2,$3,$4,$5)', ['falha', st, '{}', '{}', userId]);
    return { modo: 'falha', status: st, counts, endpoints, latencias, erros };
  }
  for (const [k, path] of ENDPOINTS) {
    try {
      const { json, ms } = await apiGet(path);
      endpoints[k] = 'ok'; latencias[k] = ms;
      if (typeof json.totalRegistros === 'number') counts[k] = json.totalRegistros;
      okCount++;
    } catch (e) {
      endpoints[k] = 'falha'; erros[k] = e.message;
    }
  }
  const modo = okCount === ENDPOINTS.length ? 'api' : 'falha';
  const st = modo === 'api' ? 'Sincronizado via API oficial' : okCount ? `Sincronização parcial (${okCount} de ${ENDPOINTS.length} endpoints)` : 'Falha ao acessar a API — mantida a base local';
  await db.query('INSERT INTO catalogo_sync (modo, status, contagens, endpoints, latencias, por) VALUES ($1,$2,$3,$4,$5,$6)', [modo, st, JSON.stringify(counts), JSON.stringify(endpoints), JSON.stringify(latencias), userId]);
  return { modo, status: st, counts, endpoints, latencias, erros };
}

/** Rotina diária: respeita Configurações › API Compras.gov › verificação diária. */
async function syncAgendado() {
  if (!(await config.get('comprasgov.syncDiario'))) return null;
  return sync(null);
}

module.exports = { itens, status, sync, syncAgendado, consultar, apiGet, ENDPOINTS };
