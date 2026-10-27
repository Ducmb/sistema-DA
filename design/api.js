(function(){
if (window.__apiLoaded) return; window.__apiLoaded = true;
/**
 * Mock API Integration Layer
 * Provides fetch-based client for all Sistema DA modules
 * Swaps endpoint base URL for live backend integration
 */

const API_BASE = 'http://localhost:3000/api'; // Swap for production URL
const API_TIMEOUT = 5000;

/**
 * Fetch wrapper with timeout, error handling, RBAC headers
 */
async function apiCall(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    userId = null,
    role = 'viewer',
    timeout = API_TIMEOUT
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(window.DASession && window.DASession.token() ? { 'Authorization': 'Bearer ' + window.DASession.token() } : {}),
        'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...headers
      },
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && window.DASession) { window.DASession.logout('expirada'); throw new Error('Sessão expirada'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error ${response.status}: ${error.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API request timeout');
    }
    throw error;
  }
}

/**
 * Mock data fallback for development
 * Replace with real API calls by swapping endpoint base URL
 */
const mockData = {
  // Auth & Users
  login: async (username, password) => {
    const U = {
      admin: { pwd: '123456', user: { id: 1, name: 'Dr. Roberto Alencar', role: 'Administrativo', email: 'roberto.alencar@camara.gov.br' } },
      operador: { pwd: 'senha123', user: { id: 2, name: 'Ana Beatriz Silva', role: 'Almoxarifado', email: 'ana.silva@camara.gov.br' } },
      compras: { pwd: 'teste2026', user: { id: 3, name: 'Carlos Mendes Oliveira', role: 'Compras', email: 'carlos.mendes@camara.gov.br' } },
      almoxarifado: { pwd: 'teste2026', user: { id: 2, name: 'Ana Beatriz Silva', role: 'Almoxarifado', email: 'ana.silva@camara.gov.br' } },
      patrimonio: { pwd: 'teste2026', user: { id: 4, name: 'Patricia de Souza', role: 'Patrimônio', email: 'patricia.souza@camara.gov.br' } },
      gerencia: { pwd: 'teste2026', user: { id: 5, name: 'João Pedro Costa', role: 'Gerenciamento', email: 'joao.costa@camara.gov.br' } },
      visualizador: { pwd: 'teste2026', user: { id: 6, name: 'Maria Clara Gomes', role: 'Visualizador', email: 'maria.gomes@camara.gov.br' } }
    };
    const u = U[String(username || '').trim().toLowerCase()];
    if (!u || u.pwd !== password) return { success: false };
    return { success: true, user: u.user, token: 'dev.' + btoa(String(u.user.id) + ':' + Date.now()) + '.mock' };
  },

  getCurrentUser: async () => ({
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    department: 'Administrativo',
    avatar: 'https://api.example.com/avatar/1'
  }),

  // Inventory
  getProducts: async () => [
    { id: 1, name: 'Caderno Universitário', sku: 'CAD-001', stock: 15, minStock: 50, category: 'Papelaria', unit: 'caixa' },
    { id: 2, name: 'Caneta Azul (caixa 50)', sku: 'CAN-002', stock: 120, minStock: 100, category: 'Papelaria', unit: 'caixa' },
    { id: 3, name: 'Resma A4 (papel branco)', sku: 'PAP-001', stock: 45, minStock: 200, category: 'Papelaria', unit: 'resma' },
    { id: 4, name: 'Envelope Branco #10', sku: 'ENV-001', stock: 300, minStock: 500, category: 'Papelaria', unit: 'caixa' },
    { id: 5, name: 'Clips 50mm (caixa 500)', sku: 'CLP-001', stock: 20, minStock: 30, category: 'Papelaria', unit: 'caixa' },
    { id: 6, name: 'Grampeador de Escritório', sku: 'EQP-001', stock: 5, minStock: 10, category: 'Equipamento', unit: 'unidade' },
    { id: 7, name: 'Perfurador de Papel 2 Furos', sku: 'EQP-002', stock: 8, minStock: 5, category: 'Equipamento', unit: 'unidade' },
    { id: 8, name: 'Fita Adesiva 50mm x 50m', sku: 'ADH-001', stock: 60, minStock: 40, category: 'Adesivos', unit: 'rolo' },
    { id: 9, name: 'Gel de Limpeza Mãos (frasco 500ml)', sku: 'HIG-001', stock: 25, minStock: 50, category: 'Higiene', unit: 'frasco' },
    { id: 10, name: 'Álcool 70% (litro)', sku: 'HIG-002', stock: 18, minStock: 30, category: 'Higiene', unit: 'litro' }
  ],

  getInventoryHistory: async () => [
    { id: 1, product: 'Caderno Universitário', action: 'Entrada', quantity: 50, date: '2025-01-10', user: 'Ana Silva' },
    { id: 2, product: 'Caneta Azul', action: 'Saída', quantity: 100, date: '2025-01-12', user: 'Carlos Mendes' },
    { id: 3, product: 'Resma A4', action: 'Contagem', quantity: 45, date: '2025-01-15', user: 'Maria Clara' }
  ],

  // Compras (Purchases)
  getPurchaseRequests: async () => [
    { id: 1, product: 'Caderno Universitário', quantity: 200, status: 'Aprovado', dueDate: '2025-02-15', requester: 'Ana Silva', value: 'R$ 1.200,00' },
    { id: 2, product: 'Caneta Azul (caixa 50)', quantity: 50, status: 'Pendente', dueDate: '2025-02-10', requester: 'Carlos Mendes', value: 'R$ 500,00' },
    { id: 3, product: 'Resma A4', quantity: 100, status: 'Em Processamento', dueDate: '2025-02-20', requester: 'Maria Clara', value: 'R$ 800,00' }
  ],

  getQuotations: async () => [
    { id: 1, supplier: 'Distribuidora ABC', product: 'Caderno Universitário', quantity: 200, unitPrice: 'R$ 6,00', total: 'R$ 1.200,00', validity: '15 dias', status: 'Ativa' },
    { id: 2, supplier: 'Fornecedor XYZ', product: 'Caderno Universitário', quantity: 200, unitPrice: 'R$ 5,80', total: 'R$ 1.160,00', validity: '10 dias', status: 'Ativa' }
  ],

  // RH (Human Resources)
  getEmployees: async () => [
    { id: 1, name: 'Ana Silva Santos', registration: '2019-001', position: 'Assessor Administrativo', department: 'Compras', status: 'Ativo' },
    { id: 2, name: 'Carlos Mendes Oliveira', registration: '2018-045', position: 'Gerente de Compras', department: 'Compras', status: 'Ativo' },
    { id: 3, name: 'Maria Clara Gomes', registration: '2020-012', position: 'Analista de RH', department: 'RH', status: 'Afastado' },
    { id: 4, name: 'João Pedro Costa', registration: '2017-089', position: 'Contador', department: 'Financeiro', status: 'Ativo' },
    { id: 5, name: 'Patricia de Souza', registration: '2021-034', position: 'Assistente Administrativo', department: 'Administrativo', status: 'Ativo' }
  ],

  getPayroll: async (month, year) => [
    { id: 1, employee: 'Ana Silva Santos', position: 'Assessor', base: 3200.00, discounts: 620.50, net: 2579.50, status: 'Processado', month, year },
    { id: 2, employee: 'Carlos Mendes Oliveira', position: 'Gerente', base: 5800.00, discounts: 1125.80, net: 4674.20, status: 'Processado', month, year },
    { id: 3, employee: 'Maria Clara Gomes', position: 'Analista', base: 4500.00, discounts: 870.25, net: 3629.75, status: 'Aguardando', month, year }
  ],

  getVacationRequests: async () => [
    { id: 1, employee: 'Ana Silva Santos', type: 'Férias', startDate: '2025-02-20', endDate: '2025-03-06', status: 'Aprovado', daysUsed: 10 },
    { id: 2, employee: 'Carlos Mendes Oliveira', type: 'Licença Médica', startDate: '2025-01-15', endDate: '2025-01-22', status: 'Pendente', daysUsed: 5 }
  ],

  getRoles: async () => [
    { id: 'admin', name: 'Administrador', description: 'Acesso total', userCount: 2 },
    { id: 'manager', name: 'Gerenciador', description: 'Gestão de RH e Compras', userCount: 3 },
    { id: 'analyst', name: 'Analista', description: 'Visualização e relatórios', userCount: 5 },
    { id: 'viewer', name: 'Visualizador', description: 'Acesso somente leitura', userCount: 8 }
  ],

  getPermissions: async () => [
    { id: 'create_server', name: 'Criar Servidor', roles: { admin: true, manager: true, analyst: false } },
    { id: 'view_documents', name: 'Visualizar Documentos', roles: { admin: true, manager: true, analyst: true } },
    { id: 'process_payroll', name: 'Processar Folha', roles: { admin: true, manager: true, analyst: false } }
  ],

  // Protocolo (Legislative)
  getMotions: async () => [
    { id: 1, number: '402/2026', title: 'Moção de Repúdio', status: 'Em Discussão', author: 'Vereador Márcio Teixeira', submissionDate: '2025-01-10', deadline: '2025-02-10' },
    { id: 2, number: '403/2026', title: 'Requerimento de Informação', status: 'Aprovado', author: 'Vereadora Beatriz Silva', submissionDate: '2025-01-05', deadline: '2025-01-25' }
  ],

  getHonorificences: async () => [
    { id: 1, number: '040/2026', title: 'Moção de Louvor', recipient: 'Vereador Márcio Teixeira', reason: 'Req. 274/2026', status: 'Aprovado', date: '2025-01-12' }
  ],

  // Dashboard
  getDashboardMetrics: async () => ({
    processes: { completed: 68, inProgress: 42, awaitingSignature: 85 },
    sectors: [
      { name: 'Compras', count: 24, percentage: 85 },
      { name: 'Compras - Fornecedores', count: 12, percentage: 55 },
      { name: 'RH', count: 18, percentage: 65 },
      { name: 'Protocolo', count: 31, percentage: 100 }
    ],
    alerts: [
      { id: 1, icon: '🔴', title: 'Item Crítico: Caderno', category: 'Almoxarifado', severity: 'high', time: '15min' },
      { id: 2, icon: '🟠', title: 'Processo 402/2026', category: 'Protocolo', severity: 'medium', time: '1h' }
    ]
  })
};

/**
 * Exported API methods (use these in DCs)
 * Return mock data; swap for real API calls by uncommenting apiCall()
 */
window.API = {
  // Auth
  login: (username, password) => mockData.login(username, password),
  getCurrentUser: () => mockData.getCurrentUser(),

  // Inventory
  getProducts: () => mockData.getProducts(),
  getInventoryHistory: () => mockData.getInventoryHistory(),
  createSampling: (productId, quantity, notes) => Promise.resolve({ success: true, id: Date.now() }),

  // Compras
  getPurchaseRequests: () => mockData.getPurchaseRequests(),
  getQuotations: () => mockData.getQuotations(),
  createPurchaseRequest: (data) => Promise.resolve({ success: true, id: Date.now() }),

  // RH
  getEmployees: () => mockData.getEmployees(),
  getPayroll: (month, year) => mockData.getPayroll(month, year),
  getVacationRequests: () => mockData.getVacationRequests(),
  getRoles: () => mockData.getRoles(),
  getPermissions: () => mockData.getPermissions(),
  updatePermission: (permId, roleId, value) => Promise.resolve({ success: true }),

  // Protocolo
  getMotions: () => mockData.getMotions(),
  getHonorificences: () => mockData.getHonorificences(),

  // Dashboard
  getDashboardMetrics: () => mockData.getDashboardMetrics(),

  // Generic error handler
  handleError: (error) => {
    console.error('API Error:', error.message);
    return { success: false, message: error.message };
  }
};

})();
