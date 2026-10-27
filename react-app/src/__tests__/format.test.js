import { describe, expect, test } from 'vitest';
import { fmtDate, initials, maskDoc, maskPhone, parsePrazo, todayIso } from '../lib/format.js';

describe('format', () => {
  test('datas', () => {
    expect(fmtDate('2026-10-27')).toBe('27/10/2026');
    expect(fmtDate('')).toBe('—');
  });
  test('prazo: dd/mm/aaaa, ISO e atalho +X dias', () => {
    expect(parsePrazo('05/11/2026')).toBe('2026-11-05');
    expect(parsePrazo('31/02/2026')).toBe('');
    expect(parsePrazo('2026-12-01')).toBe('2026-12-01');
    const d = new Date(); d.setDate(d.getDate() + 15);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    expect(parsePrazo('+15')).toBe(iso);
    expect(parsePrazo('+15 dias')).toBe(iso);
    expect(parsePrazo('amanhã')).toBe('');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  test('máscaras de CPF/CNPJ e telefone', () => {
    expect(maskDoc('79873340815')).toBe('798.733.408-15');
    expect(maskDoc('45030566000102')).toBe('45.030.566/0001-02');
    expect(maskPhone('14998045019')).toBe('(14) 99804-5019');
    expect(maskPhone('1432345678')).toBe('(14) 3234-5678');
  });
  test('iniciais ignoram pronomes de tratamento', () => {
    expect(initials('Dr. Roberto Alencar')).toBe('RA');
    expect(initials('Ana')).toBe('A');
  });
});
