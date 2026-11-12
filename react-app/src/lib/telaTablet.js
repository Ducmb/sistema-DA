/**
 * Tablet conectado ao computador como segunda tela (USB-C/HDMI, monitor de assinatura com caneta, tablet em modo
 * "tela estendida"). O sistema abre sozinho uma janela de assinatura NA TELA DO TABLET — ninguém precisa abrir
 * página nem fazer login no tablet. A janela conversa com a tela do computador por postMessage (mesma origem).
 *
 * Posicionamento: Window Management API (Chrome/Edge) — o navegador pede uma única vez a permissão
 * "Gerenciar janelas". Sem a API (ou sem permissão), a janela abre na tela atual e pode ser arrastada.
 */
export const CANAL = 'da-chaves-tablet';
const NOME = 'da-assinatura-tablet';
const TELA_KEY = 'DA_tablet_tela';

let janela = null;

export const janelaAberta = () => !!(janela && !janela.closed);
export const suportaMultiplasTelas = () => typeof window !== 'undefined' && 'getScreenDetails' in window;

/** Tela do tablet: a escolhida antes (pelo rótulo), senão a primeira tela que não é a do computador. */
function escolherTela(det) {
  let pref = '';
  try { pref = localStorage.getItem(TELA_KEY) || ''; } catch (e) { /* sem storage */ }
  const outras = det.screens.filter((s) => s !== det.currentScreen);
  return (pref && det.screens.find((s) => s.label === pref && s !== det.currentScreen))
    || outras.find((s) => s.isInternal === false && !s.isPrimary) || outras.find((s) => !s.isPrimary) || outras[0] || null;
}

async function posicionar(w) {
  if (!suportaMultiplasTelas()) return false;
  try {
    const det = await window.getScreenDetails();
    const t = escolherTela(det);
    if (!t || w.closed) return false;
    w.moveTo(t.availLeft, t.availTop);
    w.resizeTo(t.availWidth, t.availHeight);
    try { localStorage.setItem(TELA_KEY, t.label || ''); } catch (e) { /* sem storage */ }
    return true;
  } catch (e) { return false; } // permissão negada: fica na tela atual
}

/**
 * Abre (ou reaproveita) a janela de assinatura na tela do tablet. Chamar no clique do usuário,
 * antes de qualquer await — o navegador só permite abrir janelas em resposta a um gesto.
 * Retorna { janela, naTelaDoTablet: Promise<boolean> } ou null se o bloqueador de pop-ups impediu.
 */
export function abrirJanelaTablet() {
  if (janelaAberta()) return { janela, naTelaDoTablet: Promise.resolve(true) };
  const w = window.open('/chaves/assinar', NOME, 'popup=yes,width=1024,height=720');
  if (!w) return null;
  janela = w;
  return { janela: w, naTelaDoTablet: posicionar(w) };
}

export function enviar(msg) {
  if (janelaAberta()) janela.postMessage({ canal: CANAL, ...msg }, window.location.origin);
}

/** Mensagens válidas: mesma origem, vindas da janela do tablet (ou do computador, no lado do tablet). */
export function mensagemValida(e, origemEsperada) {
  return e.origin === window.location.origin && e.source === origemEsperada && e.data && e.data.canal === CANAL;
}

export const janelaAtual = () => janela;
