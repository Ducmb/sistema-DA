-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(128) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_id INT REFERENCES roles(id),
  department VARCHAR(128),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  token_version INT NOT NULL DEFAULT 0
);

-- Password reset tokens (RF03): only the SHA-256 hash is stored; single use; 30 min
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  module VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id INT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_id VARCHAR(128)
);

-- Products (Inventory) table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(128) UNIQUE NOT NULL,
  category VARCHAR(128),
  unit VARCHAR(50),
  stock_quantity INT DEFAULT 0,
  min_stock INT DEFAULT 0,
  max_stock INT DEFAULT 0,
  unit_price DECIMAL(10, 2),
  supplier_id INT REFERENCES suppliers(id),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  cnpj VARCHAR(18) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  action VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  notes TEXT,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  requested_by INT REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  due_date DATE,
  total_value DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  purchase_request_id INT REFERENCES purchase_requests(id),
  supplier_id INT REFERENCES suppliers(id),
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  validity_days INT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  registration_number VARCHAR(128) UNIQUE,
  position VARCHAR(128),
  department VARCHAR(128),
  salary DECIMAL(12, 2),
  hire_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vacation requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by INT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  month INT NOT NULL,
  year INT NOT NULL,
  base_salary DECIMAL(12, 2),
  discounts DECIMAL(12, 2) DEFAULT 0,
  bonuses DECIMAL(12, 2) DEFAULT 0,
  net_salary DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'pending',
  processed_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, month, year)
);

-- Legislative motions table
CREATE TABLE IF NOT EXISTS motions (
  id SERIAL PRIMARY KEY,
  number VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  submission_date DATE,
  deadline DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Honorificences table
CREATE TABLE IF NOT EXISTS honorificences (
  id SERIAL PRIMARY KEY,
  number VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  recipient VARCHAR(255),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  approval_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_vacation_requests_employee_id ON vacation_requests(employee_id);
CREATE INDEX idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX idx_payroll_employee_month_year ON payroll(employee_id, month, year);


-- Permission required to read employee personal data (LGPD)
INSERT INTO permissions (name, description, module) VALUES ('view_employees', 'Visualizar dados pessoais de servidores', 'rh') ON CONFLICT (name) DO NOTHING;


-- Almoxarifado: materiais e atualização de estoque por RME/BRM
CREATE TABLE IF NOT EXISTS materiais (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  codigo_digitos VARCHAR(10) NOT NULL UNIQUE CHECK (codigo_digitos ~ '^[0-9]{10}$'),
  descricao VARCHAR(255) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  categoria VARCHAR(60),
  prioridade VARCHAR(10) NOT NULL DEFAULT 'Baixa' CHECK (prioridade IN ('Alta','Média','Baixa')),
  saldo NUMERIC(14,3) NOT NULL DEFAULT 0,
  consumo_medio NUMERIC(14,3) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS estoque_documentos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(3) NOT NULL CHECK (tipo IN ('RME','BRM')),
  numero VARCHAR(20) NOT NULL,
  data_doc DATE,
  drive_file_id VARCHAR(128) NOT NULL UNIQUE,
  arquivo VARCHAR(255) NOT NULL,
  origem VARCHAR(255),
  processado_por INTEGER REFERENCES users(id),
  processado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, numero)
);
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES materiais(id),
  documento_id INTEGER REFERENCES estoque_documentos(id),
  quantidade NUMERIC(14,3) NOT NULL,
  saldo_apos NUMERIC(14,3) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS estoque_pendencias (
  id SERIAL PRIMARY KEY,
  documento_id INTEGER NOT NULL REFERENCES estoque_documentos(id),
  codigo_digitos VARCHAR(10) NOT NULL,
  descricao VARCHAR(255),
  quantidade NUMERIC(14,3) NOT NULL,
  unidade VARCHAR(10),
  resolvida_em TIMESTAMP
);
