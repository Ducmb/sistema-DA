/**
 * Leitura de parâmetros do sistema com cache curto em memória.
 */
const db = require('../db');
const { FIELDS } = require('./configSchema');

let cache = null, cacheAt = 0;
const TTL = 10000;

async function load() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const { rows } = await db.query('SELECT key, value FROM system_config');
  const vals = {};
  rows.forEach((r) => { if (FIELDS[r.key]) vals[r.key] = r.value; });
  cache = vals; cacheAt = Date.now();
  return vals;
}

function invalidate() { cache = null; }

/** Todos os valores efetivos (gravado ou padrão). */
async function all() {
  const vals = await load();
  const out = {};
  Object.keys(FIELDS).forEach((k) => { out[k] = Object.prototype.hasOwnProperty.call(vals, k) ? vals[k] : FIELDS[k].def; });
  return out;
}

async function get(key) {
  if (!FIELDS[key]) throw new Error('Configuração desconhecida: ' + key);
  const vals = await load();
  return Object.prototype.hasOwnProperty.call(vals, key) ? vals[key] : FIELDS[key].def;
}

/** Retorna um getter síncrono a partir de um snapshot (útil em cálculos com muitas leituras). */
async function snapshot() {
  const v = await all();
  return (k) => v[k];
}

module.exports = { all, get, snapshot, invalidate, load };
