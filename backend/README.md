# Sistema DA - Backend

Node.js + PostgreSQL backend for Sistema DA administrative system.

## Setup

```bash
npm install
cp .env.example .env
# Configure .env with your database credentials
npm run migrate
npm run seed
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` – User login
- `GET /api/auth/me` – Get current user
- `POST /api/auth/logout` – Logout

### RBAC (Role-Based Access Control)
- `GET /api/rbac/roles` – List roles
- `GET /api/rbac/permissions` – List permissions
- `GET /api/rbac/roles/:roleId/permissions` – Role permissions
- `PUT /api/rbac/roles/:roleId/permissions/:permissionId` – Update role permission
- `POST /api/rbac/users/:userId/role` – Assign role to user
- `GET /api/rbac/user-permissions/:userId` – Get user's effective permissions

### Audit Logs
- `GET /api/audit/logs` – List audit logs
- `GET /api/audit/logs/:logId` – Get audit log details
- `GET /api/audit/summary` – Audit summary statistics

### Inventory
- `GET /api/inventory/products` – List products
- `POST /api/inventory/products/:productId/transaction` – Record inventory transaction

### Purchases (Compras)
- `GET /api/compras/requests` – List purchase requests
- `POST /api/compras/requests` – Create purchase request

### Human Resources
- `GET /api/rh/employees` – List employees
- `GET /api/rh/payroll/:month/:year` – Get payroll
- `POST /api/rh/vacation-requests` – Create vacation request

### Protocolo (Legislative)
- `GET /api/protocolo/motions` – List motions
- `GET /api/protocolo/honorificences` – List honorificences

## Security

- JWT-based authentication
- Role-based access control (RBAC)
- Permission validation on all endpoints
- Comprehensive audit logging
- Password hashing with bcryptjs
- CORS protection
- Helmet security headers

## Database

PostgreSQL schema includes:
- Users, Roles, Permissions
- Audit logs with full request context
- Inventory, Products, Suppliers
- Purchase Requests, Quotations
- Employees, Payroll, Vacation Requests
- Motions, Honorificences

## Environment Variables

See `.env.example` for configuration options.

## Testing

```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure `DATABASE_URL` to production database
4. Set appropriate `CORS_ORIGIN`
5. Enable HTTPS
6. Monitor audit logs regularly
