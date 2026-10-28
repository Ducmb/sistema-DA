/**
 * Cria o primeiro administrador em produção (o seed é bloqueado em NODE_ENV=production).
 * Não recebe senha: gera um link de convite de uso único (72 h) para a pessoa definir a própria senha.
 *
 *   npm run create-admin -- --nome "Fulana de Tal" --email fulana@camara.sp.gov.br --matricula 2026-001 [--cargo "Diretora"]
 *
 * Recusa se já houver administrador ativo (a partir daí, use Gestão de Pessoal › Usuários).
 */
require('dotenv').config({ quiet: true });
const db = require('../src/db');
const pw = require('../src/services/passwords');
const audit = require('../src/services/audit');

const INVITE_HOURS = 72;
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? String(process.argv[i + 1] || '').trim() : ''; };

async function main() {
  const nome = arg('nome'), email = arg('email').toLowerCase(), matricula = arg('matricula'), cargo = arg('cargo');
  if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !matricula) {
    throw new Error('Uso: npm run create-admin -- --nome "Nome completo" --email email@instituicao --matricula 0000 [--cargo "Cargo"]');
  }
  const { rows: adm } = await db.query("SELECT 1 FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.role = 'Administrativo' AND u.status = 'active' LIMIT 1");
  if (adm.length) throw new Error('Já existe administrador ativo. Cadastre novos usuários pela tela Gestão de Pessoal › Usuários.');
  const raw = pw.randomToken();
  const id = await db.tx(async (c) => {
    const dup = await c.query('SELECT 1 FROM users WHERE lower(email) = $1 OR registration = $2', [email, matricula]);
    if (dup.rows.length) throw new Error('E-mail ou matrícula já cadastrados.');
    const username = email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 60) || 'admin';
    const r = await c.query(
      `INSERT INTO users (username, email, name, registration, position, hierarchy, department, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,'Diretoria','Diretoria Administrativa',$6,'active') RETURNING id`, [username, email, nome, matricula, cargo || null, pw.UNUSABLE]);
    await c.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'Administrativo')", [r.rows[0].id]);
    await c.query("INSERT INTO password_resets (user_id, token_hash, purpose, expires_at) VALUES ($1,$2,'convite', NOW() + make_interval(hours => $3))", [r.rows[0].id, pw.sha256(raw), INVITE_HOURS]);
    return r.rows[0].id;
  });
  await audit.log(null, { action: 'Usuário Criado', module: 'usuarios', detail: nome + ' · Perfis: Administrativo (linha de comando)', userName: 'Sistema (linha de comando)', targetUserId: id });
  console.log(`Administrador criado. Envie este link a ${nome} por um canal seguro (uso único, ${INVITE_HOURS} h):`);
  console.log((process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '') + '/redefinir-senha?token=' + raw + '&convite=1');
}

main().then(() => db.pool.end(), (e) => { console.error('Erro:', e.message); db.pool.end(); process.exitCode = 1; });
