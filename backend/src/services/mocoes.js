/**
 * Moções & Homenagens: cota de homenagens, situação dos empréstimos de bandeiras,
 * eventos do calendário integrado e alertas (portado de MocoesHomenagens, HomenagensArranjos,
 * HomenagensBandeiras e design/calendar-feed.js).
 */
const db = require('../db');
const config = require('./config');
const { today, addDays, daysTo, fmtBR, year } = require('../lib/dates');

const TIPOS = ['Aplauso', 'Congratulação', 'Pesar', 'Apoio', 'Repúdio', 'Reconhecimento'];
const STATUS = ['Em Análise', 'Aprovada', 'Rejeitada', 'Arquivada'];
const ENTREGA_STATUS = ['PLACA ENCOMENDADA', 'ARRANJO ENCOMENDADO', 'PLACA ENTREGUE E ARRANJO ENCOMENDADO', 'PLACA ENTREGUE - EVENTO FORA', 'ENTREGUE'];
const ITENS = [['bauru', 'Bandeira de Bauru', 'Bauru'], ['sp', 'Bandeira de São Paulo', 'São Paulo'], ['brasil', 'Bandeira do Brasil', 'Brasil'], ['mastros', 'Mastros', 'Mastros'], ['suporte', 'Suporte', 'Suporte']];
const HREF = { mocoes: '/mocoes', arranjos: '/mocoes?tab=arranjos', bandeiras: '/mocoes?tab=bandeiras' };

/** Legislaturas de 4 anos a partir de 2025 (2025-2028, 2029-2032…). */
function legislatura(iso = today()) {
  const y = year(iso), s = 2025 + 4 * Math.floor((y - 2025) / 4);
  return s + '-' + (s + 3);
}
const legislaturas = () => { const a = legislatura(); const s = +a.slice(0, 4); return [a, (s - 4) + '-' + (s - 1)]; };

/** Situação do empréstimo de bandeiras. */
function bandeiraStatus(r, hoje = today()) {
  if (!r.retirado) return r.retirada && r.retirada < hoje ? 'naoRetirado' : 'aguardando';
  if (r.conformidade === 'Sim') return 'devolvido';
  if (r.conformidade === 'Não') return 'pendencia';
  return r.devolucao && r.devolucao < hoje ? 'atrasado' : 'emprestado';
}

const entregaPendente = (h) => /ENCOMENDAD/i.test(h.status);
const entregue = (h) => /^ENTREGUE/i.test(h.status);

async function entregas(client = db) {
  const { rows } = await client.query(
    `SELECT e.*, v.nome AS vereador FROM homenagens_entregas e JOIN vereadores v ON v.id = e.vereador_id
     ORDER BY e.data NULLS LAST, e.id`);
  return rows.map((r) => ({ id: r.id, homenageado: r.homenageado, honraria: r.honraria, vereadorId: r.vereador_id, vereador: r.vereador, material: r.material, processo: r.processo, decreto: r.decreto, data: r.data, horario: r.horario, status: r.status, obs: r.obs }));
}

async function bandeiras(client = db) {
  const { rows } = await client.query('SELECT * FROM bandeiras_emprestimos ORDER BY solicitacao DESC, id DESC');
  const hoje = today();
  return rows.map((r) => ({ id: r.id, solicitacao: r.solicitacao, entidade: r.entidade, documento: r.documento, telefone: r.telefone, protocolo: r.protocolo, itens: r.itens,
    retirado: r.retirado, retirada: r.retirada || '', devolucao: r.devolucao || '', conformidade: r.conformidade, obs: r.obs, situacao: bandeiraStatus({ ...r, retirada: r.retirada || '', devolucao: r.devolucao || '' }, hoje) }));
}

async function calendarEvents() {
  const cfg = await config.snapshot();
  const hoje = today(), aviso = cfg('mocoes.bandAmarelo'), vermelho = cfg('mocoes.bandVermelho') !== false;
  const ev = [];
  const { rows: ms } = await db.query("SELECT numero, ano, assunto, sessao, status FROM mocoes WHERE sessao IS NOT NULL");
  ms.forEach((m) => ev.push({ title: `Sessão — moção ${String(m.numero).padStart(3, '0')}/${m.ano} · ${m.assunto}`, start: m.sessao, end: m.sessao, level: m.status === 'Em Análise' ? 'warning' : 'info', deadline: m.status === 'Em Análise', href: HREF.mocoes }));
  (await entregas()).filter((h) => h.data).forEach((h) => {
    const done = entregue(h);
    ev.push({ title: 'Entrega: ' + h.material + ' — ' + h.homenageado + (h.horario ? ' (' + h.horario + ')' : ''), start: h.data, end: h.data, level: done ? 'info' : h.data < hoje ? 'critical' : 'info', deadline: !done, href: HREF.arranjos });
  });
  (await bandeiras()).forEach((r) => {
    if (!r.retirado && r.retirada) ev.push({ title: 'Retirada agendada de bandeiras — ' + r.entidade, start: r.retirada, end: r.retirada, level: r.retirada < hoje ? 'critical' : 'info', deadline: true, href: HREF.bandeiras });
    if (r.retirado && !r.conformidade && r.devolucao) {
      const lv = r.devolucao < hoje ? (vermelho ? 'critical' : 'warning') : r.devolucao <= addDays(hoje, aviso) ? 'warning' : 'info';
      ev.push({ title: 'Devolução prevista de bandeiras — ' + r.entidade, start: r.devolucao, end: r.devolucao, level: lv, deadline: true, href: HREF.bandeiras });
    }
  });
  return ev;
}

/** Entregas sem data (aparecem como "a agendar" nos prazos críticos). */
async function pendingItems() {
  return (await entregas()).filter((h) => !h.data && !entregue(h)).map((h) => ({ title: 'Entrega a agendar: ' + h.material + ' — ' + h.homenageado, href: HREF.arranjos }));
}

async function alerts() {
  const cfg = await config.snapshot();
  const hoje = today(), aviso = cfg('mocoes.bandAmarelo'), vermelho = cfg('mocoes.bandVermelho') !== false, ant = cfg('mocoes.antecedencia');
  const out = [];
  (await bandeiras()).forEach((r) => {
    if (r.situacao === 'atrasado') out.push({ id: 'band-atraso-' + r.id, module: 'mocoes', category: 'BANDEIRAS', level: vermelho ? 'critical' : 'warning', title: 'Devolução de bandeiras atrasada — ' + r.entidade, description: 'Prevista para ' + fmtBR(r.devolucao) + (r.protocolo ? ' · protocolo ' + r.protocolo : ''), href: HREF.bandeiras });
    else if (r.situacao === 'emprestado' && r.devolucao && r.devolucao <= addDays(hoje, aviso)) out.push({ id: 'band-dev-' + r.id, module: 'mocoes', category: 'BANDEIRAS', level: 'warning', title: 'Devolução de bandeiras ' + (r.devolucao === hoje ? 'hoje' : 'em ' + fmtBR(r.devolucao)) + ' — ' + r.entidade, description: 'Conferir os itens na devolução', href: HREF.bandeiras });
    if (r.situacao === 'naoRetirado') out.push({ id: 'band-ret-' + r.id, module: 'mocoes', category: 'BANDEIRAS', level: 'warning', title: 'Retirada de bandeiras não realizada — ' + r.entidade, description: 'Agendada para ' + fmtBR(r.retirada), href: HREF.bandeiras });
    if (r.situacao === 'pendencia') out.push({ id: 'band-pend-' + r.id, module: 'mocoes', category: 'BANDEIRAS', level: 'warning', title: 'Bandeiras devolvidas com pendência — ' + r.entidade, description: r.obs || 'Itens fora de conformidade', href: HREF.bandeiras });
  });
  (await entregas()).forEach((h) => {
    if (!h.data || entregue(h)) return;
    const d = daysTo(h.data);
    if (d < 0) out.push({ id: 'hom-atraso-' + h.id, module: 'mocoes', category: 'HOMENAGENS', level: 'critical', title: 'Entrega de homenagem não concluída — ' + h.homenageado, description: h.material + ' · prevista em ' + fmtBR(h.data), href: HREF.arranjos });
    else if (d <= ant && entregaPendente(h)) out.push({ id: 'hom-enc-' + h.id, module: 'mocoes', category: 'HOMENAGENS', level: 'warning', title: 'Entrega em ' + d + ' dia(s) com item encomendado — ' + h.homenageado, description: h.material + ' · ' + fmtBR(h.data) + (h.horario ? ' às ' + h.horario : '') + ' · ' + h.status.toLowerCase(), href: HREF.arranjos });
  });
  return out;
}

module.exports = { TIPOS, STATUS, ENTREGA_STATUS, ITENS, legislatura, legislaturas, bandeiraStatus, entregas, bandeiras, calendarEvents, pendingItems, alerts };
