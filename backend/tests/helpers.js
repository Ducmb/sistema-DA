const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const PASS = { admin: '123456', operador: 'senha123' };
async function login(username, password) {
  const r = await request(app).post('/api/auth/login').send({ username, password: password || PASS[username] || 'teste2026' });
  if (r.status !== 200) throw new Error('login falhou para ' + username + ': ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.token;
}
const api = (token) => {
  const wrap = (m) => (url) => request(app)[m]('/api' + url).set('Authorization', 'Bearer ' + token);
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
};
module.exports = { app, db, request, login, api };
