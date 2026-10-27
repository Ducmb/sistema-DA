import { useEffect, useState } from 'react';
import { api } from './api.js';

/** Cache curto dos cadastros base compartilhados (centros de custo, vereadores). */
const cache = {};
function load(key, path) {
  const c = cache[key];
  if (c && Date.now() - c.at < 60000) return c.p;
  const p = api.get(path).catch((e) => { delete cache[key]; throw e; });
  cache[key] = { p, at: Date.now() };
  return p;
}
export const invalidateCadastros = () => Object.keys(cache).forEach((k) => delete cache[k]);

/** Nomes dos centros de custo ativos ('padrao' ou 'patrimonio'). */
export function useCostCenters(tipo = 'padrao') {
  const [list, setList] = useState([]);
  useEffect(() => { load('cc-' + tipo, '/cost-centers?tipo=' + tipo).then((r) => setList(r.items.map((c) => c.nome))).catch(() => {}); }, [tipo]);
  return list;
}

/** Vereadores ativos (ordem alfabética). */
export function useVereadores() {
  const [list, setList] = useState([]);
  useEffect(() => { load('vereadores', '/vereadores').then((r) => setList(r.map((v) => v.nome))).catch(() => {}); }, []);
  return list;
}

/** Exercício fiscal: anos disponíveis e o selecionado pelo usuário. */
export function useExercicioAnos() {
  const [anos, setAnos] = useState([]);
  useEffect(() => { load('exercicio', '/exercicio').then((r) => setAnos(r.anos)).catch(() => {}); }, []);
  return anos;
}
