/**
 * Dados base de desenvolvimento/homologação: centros de custo, vereadores e usuários de teste.
 * Senhas de teste conforme README (somente fora de produção).
 */
const pw = require('../../services/passwords');

const CC = [
  ['CC-001', 'Diretoria Administrativa'], ['CC-002', 'Serviço de Licitações e Contratos'], ['CC-003', 'Serviço de Almoxarifado e Patrimônio'],
  ['CC-004', 'Presidência'], ['CC-005', 'Secretaria Legislativa'], ['CC-006', 'Procuradoria Jurídica'], ['CC-007', 'Controle Interno'],
  ['CC-008', 'Comunicação Social'], ['CC-009', 'Tecnologia da Informação'], ['CC-010', 'Gestão de Pessoal']
];
const PAT = [['PAT-001', 'Almoxarifado Central'], ['PAT-002', 'Sala de Sessões'], ['PAT-003', 'Protocolo'], ['PAT-004', 'Diretoria Administrativa'], ['PAT-005', 'Plenário'], ['PAT-006', 'Gabinetes dos Vereadores'], ['PAT-007', 'Recepção']];
const VEREADORES = ['Márcio Teixeira', 'Beatriz Lopes', 'Fernando Souza', 'Helena Duarte', 'Natalino', 'Marcos Antonio de Souza', 'Arnaldo Ribeiro', 'Hélio Venâncio', 'Julio Cesar', 'André Maldonado', 'Borgo', 'Edmilson Marinho da Silva Júnior'];

// [username, senha, nome, e-mail, matrícula, cargo, hierarquia, setor, perfis, telefone, e-mail pessoal, aniversário]
const USERS = [
  ['admin', '123456', 'Dr. Roberto Alencar', 'roberto.alencar@camara.local', 'DA-2026-948', 'Diretor Administrativo', 'Diretoria', 'Diretoria Administrativa', ['Administrativo'], '(14) 99812-3344', 'roberto.alencar@email.com', '1972-03-09'],
  ['operador', 'senha123', 'Ana Beatriz Silva', 'ana.silva@camara.local', 'MAT-2019-014', 'Chefe do Almoxarifado', 'Chefia', 'Serviço de Almoxarifado e Patrimônio', ['Almoxarifado'], '(14) 98765-4321', '', '1988-11-02'],
  ['compras', 'teste2026', 'Carlos Mendes Oliveira', 'carlos.oliveira@camara.local', 'MAT-2015-031', 'Chefe de Licitações e Contratos', 'Chefia', 'Serviço de Licitações e Contratos', ['Compras'], '', '', ''],
  ['almoxarifado', 'teste2026', 'João Pedro Costa', 'joao.costa@camara.local', 'MAT-2021-007', 'Auxiliar de Almoxarifado', 'Funcionário', 'Serviço de Almoxarifado e Patrimônio', ['Almoxarifado'], '', '', ''],
  ['patrimonio', 'teste2026', 'Maria Clara Gomes', 'maria.gomes@camara.local', 'MAT-2020-022', 'Assistente de Patrimônio', 'Funcionário', 'Serviço de Almoxarifado e Patrimônio', ['Patrimônio'], '', '', ''],
  ['gerencia', 'teste2026', 'Patricia de Souza', 'patricia.souza@camara.local', 'MAT-2018-019', 'Gerente de Protocolo', 'Chefia', 'Diretoria Administrativa', ['Gerenciamento'], '', '', ''],
  ['visualizador', 'teste2026', 'Carlos Eduardo Costa', 'carlos.costa@camara.local', 'MAT-2022-040', 'Assessor Administrativo', 'Funcionário', 'Controle Interno', ['Visualizador'], '', '', ''],
  ['marina.duarte', 'teste2026', 'Marina Duarte', 'marina.duarte@camara.local', 'MAT-2017-051', 'Agente de Contratação', 'Funcionário', 'Serviço de Licitações e Contratos', ['Compras'], '', '', ''],
  ['paulo.reis', 'teste2026', 'Paulo Reis', 'paulo.reis@camara.local', 'MAT-2016-052', 'Agente de Contratação', 'Funcionário', 'Serviço de Licitações e Contratos', ['Compras'], '', '', ''],
  ['silvia.prado', 'teste2026', 'Sílvia Prado', 'silvia.prado@camara.local', 'MAT-2019-053', 'Agente de Contratação', 'Funcionário', 'Serviço de Licitações e Contratos', ['Compras'], '', '', ''],
  ['otavio.lemos', 'teste2026', 'Otávio Lemos', 'otavio.lemos@camara.local', 'MAT-2020-054', 'Agente de Contratação', 'Funcionário', 'Serviço de Licitações e Contratos', ['Compras'], '', '', '']
];

async function seed(c) {
  for (const [codigo, nome] of CC) await c.query("INSERT INTO cost_centers (codigo, nome, tipo) VALUES ($1,$2,'padrao') ON CONFLICT DO NOTHING", [codigo, nome]);
  for (const [codigo, nome] of PAT) await c.query("INSERT INTO cost_centers (codigo, nome, tipo) VALUES ($1,$2,'patrimonio') ON CONFLICT DO NOTHING", [codigo, nome]);
  for (const n of VEREADORES) await c.query('INSERT INTO vereadores (nome) VALUES ($1) ON CONFLICT DO NOTHING', [n]);
  const ids = {};
  for (const u of USERS) {
    const [username, senha, name, email, reg, position, hierarchy, dept, roles, phone, pemail, bday] = u;
    const r = await c.query(
      `INSERT INTO users (username, email, name, registration, position, hierarchy, department, password_hash, phone, personal_email, birthday)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [username, email, name, reg, position, hierarchy, dept, await pw.hash(senha), phone || null, pemail || null, bday || null]);
    ids[name] = r.rows[0].id;
    for (const role of roles) await c.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, role]);
  }
  return { users: ids };
}

module.exports = { seed, USERS };
