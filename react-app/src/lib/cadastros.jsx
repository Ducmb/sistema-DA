import React from 'react';
import { useAuth } from './auth.jsx';
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

/** Exercício fiscal do usuário (preferência salva no servidor). */
export function useExercicio() {
  const { user, setPreference } = useAuth();
  const anos = useExercicioAnos();
  const ano = (user && user.preferences && +user.preferences.exercicio) || anos[0] || new Date().getFullYear();
  return [ano, (a) => setPreference({ exercicio: +a }), anos.length ? anos : [ano]];
}

/** Seletor "Exercício fiscal" usado nos cabeçalhos. */
export function ExercicioSelect({ label = 'Exercício fiscal' }) {
  const [ano, setAno, anos] = useExercicio();
  return React.createElement('label', { className: 'row', style: { gap: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '0 6px 0 14px', minHeight: 44, flexWrap: 'nowrap', whiteSpace: 'nowrap' } },
    label + ':',
    React.createElement('select', { value: ano, onChange: (e) => setAno(e.target.value), 'aria-label': 'Selecionar exercício fiscal', className: 'select', style: { minHeight: 34, height: 34, width: 'auto', fontWeight: 700, color: 'var(--accent)' } },
      anos.map((a) => React.createElement('option', { key: a, value: a }, a))));
}
