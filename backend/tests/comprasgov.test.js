const { db, login, api } = require('./helpers');
const config = require('../src/services/config');

afterAll(() => db.pool.end());

// Respostas reais da API de Dados Abertos (formato de 11/2026) — sem acesso à rede nos testes
const MATERIAL = { resultado: [{ codigoItem: 150055, codigoGrupo: 68, nomeGrupo: 'SUBSTÂNCIAS E PRODUTOS QUÍMICOS', codigoClasse: 6810, nomeClasse: 'PRODUTOS QUÍMICOS', codigoPdm: 15367, nomePdm: 'CICLOHEXANONA', descricaoItem: 'CICLOHEXANONA, NOME: CICLOHEXANO ', statusItem: false, itemSustentavel: false, codigo_ncm: null, dataHoraAtualizacao: '2021-10-16T09:43:08' }], totalRegistros: 1, totalPaginas: 1, paginasRestantes: 0 };
const SERVICO = { resultado: [{ codigoSecao: 9, nomeSecao: 'SERVIÇOS DA COMUNIDADE', codigoDivisao: 91, nomeDivisao: 'ADMINISTRAÇÃO PÚBLICA', codigoGrupo: 911, nomeGrupo: 'SERVIÇOS ADMINISTRATIVOS DO GOVERNO', codigoClasse: null, nomeClasse: null, codigoSubclasse: null, nomeSubclasse: null, codigoServico: 5380, nomeServico: 'PRESTACAO DE SERVICOS DE APOIO ADMINISTRATIVO', codigoCpc: 911, statusServico: true }], totalRegistros: 1, totalPaginas: 1, paginasRestantes: 0 };
const VAZIO = { resultado: [], totalRegistros: 0, totalPaginas: 0, paginasRestantes: 0 };

let chamadas = [];
let modo = 'ok';
const realFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn(async (url) => {
    const u = new URL(url); chamadas.push(u);
    if (modo === 'falha') throw new Error('ECONNREFUSED');
    const body = u.pathname.endsWith('4_consultarItemMaterial') ? (u.searchParams.get('codigoItem') === '150055' ? MATERIAL : u.searchParams.get('codigoItem') ? VAZIO : { ...VAZIO, totalRegistros: 346029 })
      : u.pathname.endsWith('6_consultarItemServico') ? (u.searchParams.get('codigoServico') === '5380' ? SERVICO : { ...VAZIO, totalRegistros: 3107 })
        : { ...VAZIO, totalRegistros: 99 };
    return { ok: true, status: 200, json: async () => body };
  });
});
afterAll(() => { global.fetch = realFetch; });

describe('API Compras.gov (CATMAT/CATSER)', () => {
  let compras, admin, op;
  beforeAll(async () => { compras = await login('compras'); admin = await login('admin'); op = await login('operador'); });

  test('consulta CATMAT preenche grupo, classe, PDM e descrição e passa a usar o cache', async () => {
    chamadas = [];
    const r = await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=150055');
    expect(r.status).toBe(200);
    expect(r.body.origem).toBe('api');
    expect(r.body.item).toMatchObject({ catalogo: 'CATMAT', codigo: '150055', descricao: 'CICLOHEXANONA, NOME: CICLOHEXANO', ativo: false, grupo: { cod: '68' }, classe: { cod: '6810', nome: 'PRODUTOS QUÍMICOS' }, pdm: { cod: '15367' } });
    expect(chamadas[0].origin + chamadas[0].pathname).toBe('https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial');
    expect((await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=150055')).body.origem).toBe('cache');
    expect(chamadas).toHaveLength(1);
  });

  test('consulta CATSER traz seção, divisão e grupo', async () => {
    const r = await api(compras).get('/compras/catalogo/consulta?tipo=CATSER&codigo=5380');
    expect(r.body.item).toMatchObject({ catalogo: 'CATSER', grupo: { cod: '911' }, classe: null, secao: { cod: '9' }, divisao: { cod: '91' } });
  });

  test('código inexistente, inválido e sem acesso ao módulo', async () => {
    expect((await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=123')).status).toBe(404);
    expect((await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=12a')).status).toBe(400);
    expect((await api(compras).get('/compras/catalogo/consulta?tipo=XPTO&codigo=1')).status).toBe(400);
    expect((await api(op).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=150055')).status).toBe(403);
  });

  test('API fora do ar: usa o cache vencido ou avisa', async () => {
    await db.query("UPDATE catalogo_itens SET atualizado_em = NOW() - INTERVAL '400 days' WHERE codigo = '150055'");
    modo = 'falha';
    const r = await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=150055');
    expect(r.body.origem).toBe('cache-vencido');
    expect(r.body.aviso).toMatch(/indisponível/);
    const n = await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=777777');
    expect(n.status).toBe(200);
    expect(n.body.item).toBeNull();
    modo = 'ok';
  });

  test('despesa grava PDM e a hierarquia do catálogo; CATMAT e CATSER juntos são recusados', async () => {
    const base = { processo: '999', objeto: 'Reagentes', catmat: '150055', classe: '6810', pdm: '15367', modalidade: 'Dispensa', empenhado: 120, dataEmpenho: '2026-10-20' };
    expect((await api(compras).post('/compras/despesas').send({ ...base, catser: '5380' })).body.error).toMatch(/não os dois/);
    const r = await api(compras).post('/compras/despesas').send(base);
    expect(r.status).toBe(201);
    const { rows } = await db.query('SELECT pdm, catalogo_info FROM despesas WHERE id = $1', [r.body.id]);
    expect(rows[0].pdm).toBe('15367');
    expect(rows[0].catalogo_info).toMatchObject({ catalogo: 'CATMAT', classe: { cod: '6810' }, grupo: { cod: '68' } });
  });

  test('material de grupo 54 não vira engenharia: só serviços usam o grupo', async () => {
    const C = require('../src/services/compras');
    expect(C.isEng({ classe: '5410', grupo: '54' })).toBe(false);
    expect(C.isEng({ classe: '', grupo: '542' })).toBe(true);
  });

  test('configuração: endereço só HTTPS .gov.br, desligar a API e teste de conexão (admin)', async () => {
    expect((await api(admin).put('/config/values/comprasgov.baseUrl').send({ value: 'http://169.254.169.254' })).status).toBe(400);
    expect((await api(admin).put('/config/values/comprasgov.baseUrl').send({ value: 'https://interno.local' })).status).toBe(400);
    expect((await api(compras).post('/config/comprasgov/testar')).status).toBe(403);
    const t = await api(admin).post('/config/comprasgov/testar');
    expect(t.body.modo).toBe('api');
    expect(t.body.counts.catmat).toBe(346029);
    expect(t.body.endpoints.every((e) => e.status === 'ok' && typeof e.ms === 'number')).toBe(true);
    await api(admin).put('/config/values/comprasgov.ativo').send({ value: false });
    chamadas = [];
    const off = await api(compras).get('/compras/catalogo/consulta?tipo=CATMAT&codigo=888888');
    expect(off.body.aviso).toMatch(/desativada/);
    expect(chamadas).toHaveLength(0);
    await api(admin).put('/config/values/comprasgov.ativo').send({ value: true });
    config.invalidate();
  });
});
