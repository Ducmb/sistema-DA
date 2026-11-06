import React from 'react';
import { Badge } from './ui.jsx';
import { fmtDateTime } from '../lib/format.js';

const ORIGEM = { api: 'consultado agora no Compras.gov', cache: 'do cache local', 'cache-vencido': 'do cache local (API indisponível)' };

/** Hierarquia de um item CATMAT/CATSER retornado por /compras/catalogo/consulta. */
export default function CatalogoItem({ item, origem, compact }) {
  if (!item) return null;
  const linhas = item.catalogo === 'CATMAT'
    ? [['Grupo', item.grupo], ['Classe', item.classe], ['PDM', item.pdm]]
    : [['Seção', item.secao], ['Divisão', item.divisao], ['Grupo', item.grupo], ['Classe', item.classe], ['Subclasse', item.subclasse]];
  return (
    <div className="stack" style={{ gap: 6, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{item.catalogo} {item.codigo}</span>
        {item.ativo === false && <Badge level="warning">Item inativo no catálogo</Badge>}
        {origem && <span className="muted-3" style={{ fontSize: 11 }}>{ORIGEM[origem] || origem}{item.atualizadoEm && origem !== 'api' ? ' · ' + fmtDateTime(item.atualizadoEm) : ''}</span>}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{item.descricao}</p>
      {!compact && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 12, margin: 0 }}>
          {linhas.filter(([, v]) => v).map(([l, v]) => (
            <React.Fragment key={l}><dt className="muted" style={{ fontWeight: 600 }}>{l}</dt><dd style={{ margin: 0 }}><span className="mono">{v.cod}</span> — {v.nome}</dd></React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}
