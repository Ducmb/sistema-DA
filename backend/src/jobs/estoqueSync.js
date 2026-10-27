/**
 * Rotina de atualização de estoque — lê RMEs (saídas) e BRMs (entradas) de uma pasta do Google Drive.
 * Agendada diariamente às 07h (node-cron) e acionável por POST /api/almoxarifado/estoque/sync.
 *
 * Requisitos:
 *  - Conta de serviço Google com acesso de LEITURA à pasta (compartilhar a pasta com o e-mail da conta).
 *  - Variáveis: GOOGLE_APPLICATION_CREDENTIALS, DRIVE_FOLDER_ID.
 *  - Dependências: googleapis, pdf-parse, node-cron.
 *
 * Garantias:
 *  - Idempotente: cada documento é identificado por (tipo, numero) e pelo fileId do Drive (UNIQUE no banco).
 *  - Transacional: cada documento é aplicado em uma transação; se um item falhar, nada daquele documento é gravado.
 *  - RME baixa estoque em qualquer status (Atendida, Pendente, Parcial...): usa a quantidade ATENDIDA e, se ela for zero, a REQUISITADA. BRM soma a quantidade recebida.
 *  - Código não cadastrado não altera saldo: fica em estoque_pendencias até o cadastro do material.
 */
const { google } = require('googleapis');
const pdf = require('pdf-parse');
const db = require('../db');
const { parseText } = require('../services/estoqueParser');

async function listPdfs(drive, folderId) {
  const files = []; let pageToken;
  do {
    const r = await drive.files.list({ q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`, fields: 'nextPageToken, files(id, name, modifiedTime, md5Checksum)', pageSize: 200, pageToken });
    files.push(...r.data.files); pageToken = r.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function run({ actorId = null } = {}) {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const files = await listPdfs(drive, process.env.DRIVE_FOLDER_ID);
  const { rows: done } = await db.query('SELECT drive_file_id FROM estoque_documentos WHERE drive_file_id = ANY($1)', [files.map(f => f.id)]);
  const seen = new Set(done.map(r => r.drive_file_id));
  const report = { encontrados: files.length, processados: [], ignorados: [], erros: [] };
  for (const f of files.filter(x => !seen.has(x.id))) {
    try {
      const buf = Buffer.from((await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'arraybuffer' })).data);
      const doc = parseText((await pdf(buf)).text);
      if (!doc) { report.ignorados.push({ arquivo: f.name, motivo: 'Não é RME nem BRM' }); continue; }
      if (!doc.valido) { report.ignorados.push({ arquivo: f.name, motivo: doc.codigosEncontrados ? `${doc.tipo} ${doc.numero}: códigos encontrados sem quantidade reconhecida` : `${doc.tipo} ${doc.numero}: sem texto de itens (PDF escaneado?)` }); continue; }
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const ins = await client.query('INSERT INTO estoque_documentos (tipo, numero, data_doc, drive_file_id, arquivo, origem, processado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tipo, numero) DO NOTHING RETURNING id', [doc.tipo, doc.numero, doc.data || null, f.id, f.name, doc.setor || doc.fornecedor || null, actorId]);
        if (!ins.rowCount) { await client.query('ROLLBACK'); report.ignorados.push({ arquivo: f.name, motivo: `${doc.tipo} ${doc.numero} já computado` }); continue; }
        const docId = ins.rows[0].id, sign = doc.tipo === 'RME' ? -1 : 1;
        for (const it of doc.itens) {
          const digits = it.code.replace(/\D/g, '');
          const up = await client.query('UPDATE materiais SET saldo = saldo + $1, atualizado_em = NOW() WHERE codigo_digitos = $2 RETURNING id, saldo', [sign * it.qtd, digits]);
          if (up.rowCount) await client.query('INSERT INTO estoque_movimentos (material_id, documento_id, quantidade, saldo_apos) VALUES ($1,$2,$3,$4)', [up.rows[0].id, docId, sign * it.qtd, up.rows[0].saldo]);
          else await client.query('INSERT INTO estoque_pendencias (documento_id, codigo_digitos, descricao, quantidade, unidade) VALUES ($1,$2,$3,$4,$5)', [docId, digits, it.desc, sign * it.qtd, it.unit]);
        }
        await client.query('INSERT INTO audit_logs (user_id, action, module, details) VALUES ($1,$2,$3,$4)', [actorId, 'Atualização de estoque', 'almoxarifado', JSON.stringify({ documento: `${doc.tipo} ${doc.numero}`, arquivo: f.name })]);
        await client.query('COMMIT');
        report.processados.push(`${doc.tipo} ${doc.numero}`);
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (e) { report.erros.push({ arquivo: f.name, motivo: 'Falha ao processar' }); console.error('[estoqueSync]', f.name, e); }
  }
  return report;
}

function schedule() { require('node-cron').schedule('0 7 * * *', () => run().catch(e => console.error('[estoqueSync]', e)), { timezone: 'America/Sao_Paulo' }); }

module.exports = { run, schedule };
