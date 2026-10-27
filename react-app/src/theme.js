/**
 * Design tokens do Sistema DA (README › Design tokens). Fonte única para claro e escuro.
 * As mesmas cores são publicadas como variáveis CSS em styles.css (:root e [data-theme="dark"]).
 * Use estes valores em gráficos SVG e cálculos; em estilos, prefira var(--…).
 */
export const light = {
  primary: '#1C543A', primaryHover: '#164530', accent: '#1C543A', accentSoft: '#EAF3EE',
  bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F9F9F9', surface3: '#F5F5F5',
  border: '#E8E8E8', borderInput: '#E0E0E0', divider: '#F0F0F0', track: '#EDEDEB',
  text: '#1D1D1B', text2: '#666666', text3: '#999999', disabled: '#CCCCCC', switchOff: '#D9D9D9',
  warn: '#B45309', warnBg: '#FDF8EC', warnTitle: '#78350F',
  crit: '#B91C1C', critStrong: '#DC2626', critBg: '#FDF3F2', critTitle: '#7F1D1D',
  info: '#1E40AF', infoStrong: '#2563EB', infoBg: '#EEF4FD', infoTitle: '#1E3A8A',
  purple: '#5B21B6', purpleBg: '#F3EEFD', teal: '#0F766E', gray: '#6B7280',
  sidebar: '#1C543A'
};

export const dark = {
  primary: '#2E7D55', primaryHover: '#276B49', accent: '#86D9A8', accentSoft: '#173326',
  bg: '#111518', surface: '#1A1F23', surface2: '#222A2F', surface3: '#222A2F',
  border: '#353E44', borderInput: '#39434A', divider: '#2A3237', track: '#39434A',
  text: '#E8ECEA', text2: '#AEB5B1', text3: '#959D99', disabled: '#3A4247', switchOff: '#46515A',
  warn: '#F4C978', warnBg: '#362C14', warnTitle: '#F4C978',
  crit: '#FFA3A0', critStrong: '#FFA3A0', critBg: '#3A1F22', critTitle: '#FFA3A0',
  info: '#9DC0FA', infoStrong: '#9DC0FA', infoBg: '#1A2840', infoTitle: '#9DC0FA',
  purple: '#CBB4F8', purpleBg: '#2A2240', teal: '#5EC4B6', gray: '#AEB5B1',
  sidebar: '#0F2D20'
};

export const fontSans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const fontSerif = 'Georgia, "Times New Roman", serif';
export const BREAKPOINT = 900;

/** Níveis semânticos usados em alertas, badges e calendário. */
export const LEVELS = {
  critical: { label: 'Crítico', color: 'var(--crit-strong)', bg: 'var(--crit-bg)', title: 'var(--crit-title)', fg: 'var(--crit)' },
  warning: { label: 'Atenção', color: 'var(--warn)', bg: 'var(--warn-bg)', title: 'var(--warn-title)', fg: 'var(--warn)' },
  info: { label: 'Informativo', color: 'var(--info-strong)', bg: 'var(--info-bg)', title: 'var(--info-title)', fg: 'var(--info)' },
  success: { label: 'Concluído', color: 'var(--accent)', bg: 'var(--accent-soft)', title: 'var(--accent)', fg: 'var(--accent)' }
};

const kebab = (k) => k.replace(/[A-Z]|\d+/g, (m) => '-' + m.toLowerCase());
/** Gera o bloco de variáveis CSS a partir dos tokens. */
export function cssVars(t) {
  return Object.entries(t).map(([k, v]) => `--${kebab(k)}: ${v};`).join(' ');
}
