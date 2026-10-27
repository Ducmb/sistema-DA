process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'a3f9c1e07b5d4a2e9f8c6b1d0e7a5c3f9b2d4e6a8c0f1e3d5b7a9c2e4f6a8b0d';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://da:da_local_dev@localhost:5432/sistema_da_test';
process.env.TODAY_OVERRIDE = process.env.TODAY_OVERRIDE || '2026-10-27';
process.env.APP_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'sistema-da-test-uploads');
