/**
 * Protocolo: fluxo de documentos, processos e prazos próprios (portado de ProtocoloModule).
 */
const db = require('../db');
const config = require('./config');
const { today, addDays } = require('../lib/dates');

const DOC_FLOW = ['Registrado', 'Em Processamento', 'Finalizado', 'Arquivado'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

/** Prazos em aberto com a referência (documento ou processo). */
async function prazos(client = db) {
  const { rows } = await client.query(
    `SELECT z.id, z.descricao, z.vencimento, z.documento_id, z.processo_id,
            COALESCE(d.protocolo, p.codigo) AS ref, COALESCE(d.assunto, p.titulo) AS ref_titulo
     FROM protocolo_prazos z
     LEFT JOIN protocolo_documentos d ON d.id = z.documento_id LEFT JOIN protocolo_processos p ON p.id = z.processo_id
     WHERE z.concluido_em IS NULL ORDER BY z.vencimento, z.id`);
  return rows.map((r) => ({ id: r.id, descricao: r.descricao, vencimento: r.vencimento, ref: r.ref, refTitulo: r.ref_titulo, refTipo: r.documento_id ? 'documento' : 'processo', refId: r.documento_id || r.processo_id }));
}

/** Nível do prazo: vencido = crítico; até prot.alertaAntes dias = atenção. */
async function calendarEvents() {
  const hoje = today(), lim = addDays(hoje, await config.get('prot.alertaAntes'));
  return (await prazos()).map((z) => ({
    title: z.ref + ' — ' + z.descricao, start: z.vencimento, end: z.vencimento,
    level: z.vencimento < hoje ? 'critical' : z.vencimento <= lim ? 'warning' : 'info', deadline: true, own: true, ref: z.id,
    href: '/protocolo?tab=calendario&modo=lista'
  }));
}

async function alerts() {
  return (await calendarEvents()).filter((e) => e.level !== 'info').map((e) => ({
    id: 'prot-prazo-' + e.ref, module: 'protocolo', category: 'PROTOCOLO', level: e.level,
    title: (e.level === 'critical' ? 'Prazo vencido — ' : 'Prazo próximo — ') + e.title, description: 'Vencimento em ' + e.start.split('-').reverse().join('/'), href: e.href
  }));
}

module.exports = { DOC_FLOW, PRIORIDADES, prazos, calendarEvents, alerts };
