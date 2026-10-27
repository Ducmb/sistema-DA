import React from 'react';
import { PageHeader } from '../../components/Layout.jsx';
import { Tabs } from '../../components/ui.jsx';
import { useQueryState } from '../../lib/hooks.js';
import { ExercicioSelect } from '../../lib/cadastros.jsx';
import Processos from './Processos.jsx';
import Fornecedores from './Fornecedores.jsx';
import Contratos from './Contratos.jsx';
import Dotacao from './Dotacao.jsx';
import Limites from './Limites.jsx';

const TABS = [
  { key: 'processos', label: 'Controle de Processos' }, { key: 'suppliers', label: 'Fornecedores' }, { key: 'contratos', label: 'Contratos' },
  { key: 'analytics', label: 'Dotação Orçamentária' }, { key: 'limits', label: 'Limites Legais' }
];

/** Módulo de Compras & Licitações. */
export default function ComprasModule() {
  const [tab, setTab] = useQueryState('tab', 'processos');
  return (
    <>
      <PageHeader section="Compras & Licitações" title="Módulo de Compras"><ExercicioSelect /></PageHeader>
      <main className="page">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Seções de Compras" />
        <div className="fade-up" key={tab}>
          {tab === 'processos' && <Processos />}
          {tab === 'suppliers' && <Fornecedores />}
          {tab === 'contratos' && <Contratos />}
          {tab === 'analytics' && <Dotacao />}
          {tab === 'limits' && <Limites />}
        </div>
      </main>
    </>
  );
}
