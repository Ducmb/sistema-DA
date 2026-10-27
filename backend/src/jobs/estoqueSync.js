/**
 * Rotina de atualização de estoque pelo Google Drive — lê RMEs (saídas) e BRMs (entradas) das pastas monitoradas.
 * Agendada pelo intervalo de Configurações › Almoxarifado ("Verificar a pasta monitorada a cada") e acionável
 * por POST /api/almoxarifado/estoque/sync.
 *
 * Requisitos (.env):
 *  - GOOGLE_APPLICATION_CREDENTIALS: JSON da conta de serviço (somente leitura). Compartilhe as pastas com o e-mail da conta.
 *  - DRIVE_FOLDER_ID_RME e DRIVE_FOLDER_ID_BRM: IDs das pastas (o trecho final do link da pasta).
 */
const db = require('../db');
const audit = require('../services/audit');
const estoque = require('../services/estoque');

const FOLDERS = () => [['RME', process.env.DRIVE_FOLDER_ID_RME], ['BRM', process.env.DRIVE_FOLDER_ID_BRM]].filter(([, id]) => id);
const configured = () => !!process.env.GOOGLE_APPLICATION_CREDENTIALS && FOLDERS().length > 0;

async function client() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  return auth.getClient();
}

async function listPdfs(c, folderId) {
  const files = []; let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId.replace(/'/g, '')}' in parents and mimeType='application/pdf' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime)&pageSize=200${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await c.request({ url });
    files.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken || '';
  } while (pageToken);
  return files;
}

/** Lista os arquivos das pastas com indicação de computado/novo. */
async function arquivos() {
  if (!configured()) return null;
  const c = await client();
  const out = [];
  for (const [tipo, id] of FOLDERS()) (await listPdfs(c, id)).forEach((f) => out.push({ ...f, tipo }));
  const { rows } = await db.query('SELECT drive_file_id FROM estoque_documentos WHERE drive_file_id = ANY($1)', [out.map((f) => f.id)]);
  const done = new Set(rows.map((r) => r.drive_file_id));
  return out.map((f) => ({ name: f.name, modified: f.modifiedTime, tipo: f.tipo, computado: done.has(f.id) }));
}

async function run({ userId = null, req = null } = {}) {
  if (!configured()) throw Object.assign(new Error('Integração com o Google Drive não configurada (GOOGLE_APPLICATION_CREDENTIALS e DRIVE_FOLDER_ID_RME/BRM).'), { status: 400, expose: true });
  const c = await client();
  const results = []; let encontrados = 0;
  for (const [tipo, folderId] of FOLDERS()) {
    const files = await listPdfs(c, folderId);
    encontrados += files.length;
    const { rows } = await db.query('SELECT drive_file_id FROM estoque_documentos WHERE drive_file_id = ANY($1)', [files.map((f) => f.id)]);
    const seen = new Set(rows.map((r) => r.drive_file_id));
    for (const f of files.filter((x) => !seen.has(x.id))) {
      try {
        const r = await c.request({ url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, responseType: 'arraybuffer' });
        results.push(await estoque.processPdf(Buffer.from(r.data), { arquivo: f.name, fonte: 'drive', driveFileId: f.id, userId, tipoPasta: tipo }));
      } catch (e) {
        console.error('[estoqueSync]', f.name, e.message);
        results.push({ status: 'erro', arquivo: f.name, motivo: 'Falha ao baixar ou processar' });
      }
    }
  }
  const rep = estoque.report(results, encontrados);
  await audit.log(req, { action: 'Atualização de estoque', module: 'almoxarifado', detail: `${rep.processados.length} documento(s) computado(s): ${rep.processados.map((d) => d.key).join(', ') || 'nenhum novo'}`, actor: req ? undefined : { id: null, name: 'Rotina automática', roles: [] } });
  return rep;
}

module.exports = { run, arquivos, configured };
