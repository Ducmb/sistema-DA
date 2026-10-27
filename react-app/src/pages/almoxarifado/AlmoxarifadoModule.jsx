import React from 'react';
import { PageHeader } from '../../components/Layout.jsx';
import { useQueryState } from '../../lib/hooks.js';
import Contagem from './Contagem.jsx';
import Estoque from './Estoque.jsx';
import Parametros from './Parametros.jsx';

/** Almoxarifado: contagem por amostragem, atualização de estoque (RME/BRM) e parametrização. */
export default function AlmoxarifadoModule() {
  const [view, setView] = useQueryState('view', 'count');
  const v = view === 'inventario' ? 'count' : view;
  const tab = (key, label, extra) => (
    <button type="button" role="tab" aria-selected={v === key} className="tab" style={{ fontSize: 13.5, fontWeight: 700 }} onClick={() => setView(key)}>{label}{extra}</button>
  );
  return (
    <>
      <PageHeader section="Almoxarifado" title="Controle de Contagem por Amostragem" />
      <main className="page">
        <div role="tablist" aria-label="Seções do almoxarifado" className="tabs" style={{ borderBottomWidth: 1 }}>
          {tab('count', '📋 Contagem')}
          {tab('estoque', '📦 Atualização de Estoque')}
          {tab('params', '⚙ Parametrização', <span className="badge" style={{ marginLeft: 4, background: '#FEF3C7', color: '#92400E' }}>Responsável</span>)}
        </div>
        <div className="fade-up" key={v}>
          {v === 'count' && <Contagem />}
          {v === 'estoque' && <Estoque />}
          {v === 'params' && <Parametros />}
        </div>
      </main>
    </>
  );
}
