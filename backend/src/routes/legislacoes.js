/**
 * Legislações (módulo legislacoes): consulta para todos com acesso; edição conforme leg.editores.
 * PDFs ficam em UPLOAD_DIR com nome aleatório e são servidos apenas a usuários autenticados.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const { ah, parse, idParam, notFound, badRequest, forbidden } = require('../lib/http');

const router = express.Router();
const TIPOS = ['Base legal', 'Decreto', 'Resolução', 'Portaria', 'Recomendação'];
const MAX_PDF = 15 * 1024 * 1024;
const dir = () => path.resolve(process.env.UPLOAD_DIR || 'uploads', 'legislacoes');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF, files: 1 } });

async function canEdit(user) {
  if (user.isAdmin) return true;
  return (await config.get('leg.editores')) === 'Administrativo e Gerenciamento' && user.roles.includes('Gerenciamento');
}
async function requireEditor(req) { if (!(await canEdit(req.user))) throw forbidden('Somente ' + (await config.get('leg.editores')) + ' pode editar as legislações.'); }

const normaOf = (n) => ({ id: n.id, tipo: n.tipo, numero: n.numero, ementa: n.ementa, orgao: n.orgao, data: n.data || '', link: n.link, tags: n.tags, texto: n.texto, ativa: n.ativa, pdfNome: n.pdf_nome || '', pdfTamanho: n.pdf_tamanho || 0 });

router.get('/', ah(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM normas ORDER BY data DESC NULLS LAST, id DESC');
  res.json({ canEdit: await canEdit(req.user), tipos: TIPOS, mostrarInativas: await config.get('leg.mostrarInativas'), pagina: await config.get('leg.pagina'), items: rows.map(normaOf) });
}));

const normaSchema = z.object({
  tipo: z.enum(TIPOS),
  numero: z.string().trim().min(1, 'Informe o número/título e a ementa.').max(160),
  ementa: z.string().trim().min(1, 'Informe o número/título e a ementa.').max(1000),
  orgao: z.string().trim().max(160).optional().default(''),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').optional().or(z.literal('')).transform((v) => v || null),
  link: z.string().trim().max(500).optional().default('').refine((v) => !v || /^https?:\/\//i.test(v), 'O link deve começar com http:// ou https://'),
  tags: z.string().trim().max(300).optional().default(''),
  texto: z.string().max(200000).optional().default(''),
  ativa: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional().default(true),
  removerPdf: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(false)
});

/** Valida o PDF pelo conteúdo (assinatura %PDF-) e grava com nome aleatório. */
function savePdf(file) {
  if (!file) return null;
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw badRequest('Selecione um arquivo PDF.');
  fs.mkdirSync(dir(), { recursive: true });
  const name = crypto.randomBytes(16).toString('hex') + '.pdf';
  fs.writeFileSync(path.join(dir(), name), file.buffer);
  return { nome: path.basename(file.originalname).slice(0, 200), arquivo: name, tamanho: file.size };
}
const unlink = (arquivo) => { if (arquivo) fs.rm(path.join(dir(), path.basename(arquivo)), { force: true }, () => {}); };

const single = (req, res, next) => upload.single('pdf')(req, res, (err) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return next(badRequest('O PDF deve ter no máximo 15 MB.'));
  next(err);
});

router.post('/', ah(async (req, res, next) => { await requireEditor(req); next(); }), single, ah(async (req, res) => {
  const b = parse(normaSchema, req.body);
  const pdf = savePdf(req.file);
  const { rows } = await db.query(
    `INSERT INTO normas (tipo, numero, ementa, orgao, data, link, tags, texto, ativa, pdf_nome, pdf_arquivo, pdf_tamanho, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [b.tipo, b.numero, b.ementa, b.orgao, b.data, b.link, b.tags, b.texto, b.ativa, pdf && pdf.nome, pdf && pdf.arquivo, pdf && pdf.tamanho, req.user.id]);
  await audit.log(req, { action: 'Norma cadastrada', module: 'legislacoes', detail: b.numero });
  res.status(201).json(normaOf(rows[0]));
}));

router.put('/:id', ah(async (req, res, next) => { await requireEditor(req); next(); }), single, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(normaSchema, req.body);
  const cur = (await db.query('SELECT * FROM normas WHERE id = $1', [id])).rows[0];
  if (!cur) throw notFound('Norma não encontrada.');
  const pdf = savePdf(req.file);
  const keep = !pdf && !b.removerPdf;
  const { rows } = await db.query(
    `UPDATE normas SET tipo=$2, numero=$3, ementa=$4, orgao=$5, data=$6, link=$7, tags=$8, texto=$9, ativa=$10,
       pdf_nome=$11, pdf_arquivo=$12, pdf_tamanho=$13, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, b.tipo, b.numero, b.ementa, b.orgao, b.data, b.link, b.tags, b.texto, b.ativa,
      keep ? cur.pdf_nome : pdf && pdf.nome, keep ? cur.pdf_arquivo : pdf && pdf.arquivo, keep ? cur.pdf_tamanho : pdf && pdf.tamanho]);
  if (!keep) unlink(cur.pdf_arquivo);
  await audit.log(req, { action: 'Norma editada', module: 'legislacoes', detail: b.numero });
  res.json(normaOf(rows[0]));
}));

router.patch('/:id/ativa', ah(async (req, res) => {
  await requireEditor(req);
  const id = idParam(req.params.id);
  const { ativa } = parse(z.object({ ativa: z.boolean() }), req.body);
  const { rows } = await db.query('UPDATE normas SET ativa = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, ativa]);
  if (!rows.length) throw notFound('Norma não encontrada.');
  await audit.log(req, { action: ativa ? 'Norma reativada' : 'Norma inativada', module: 'legislacoes', detail: rows[0].numero });
  res.json(normaOf(rows[0]));
}));

router.get('/:id/pdf', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const n = (await db.query('SELECT pdf_nome, pdf_arquivo FROM normas WHERE id = $1', [id])).rows[0];
  if (!n || !n.pdf_arquivo) throw notFound('PDF não encontrado.');
  const file = path.join(dir(), path.basename(n.pdf_arquivo));
  if (!fs.existsSync(file)) throw notFound('PDF não encontrado.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(n.pdf_nome)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).pipe(res);
}));

module.exports = router;
