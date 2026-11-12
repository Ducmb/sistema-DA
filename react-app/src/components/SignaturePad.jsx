import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Área de assinatura com Pointer Events: aceita caneta (com pressão — mesas digitalizadoras e tablets de
 * assinatura ligados ao computador), toque (tablet) e mouse. Fundo branco e tinta preta em qualquer tema,
 * para a assinatura sair igual no termo impresso.
 * ref: { clear(), isEmpty(), toDataURL() } — toDataURL gera PNG (máx. 1200 px de largura).
 */
const SignaturePad = forwardRef(function SignaturePad({ height = 200, label = 'Assinatura', onChange, disabled }, ref) {
  const canvas = useRef(null);
  const strokes = useRef([]);
  const drawing = useRef(null);
  const [empty, setEmpty] = useState(true);

  const ctx = () => canvas.current.getContext('2d');
  const redraw = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const g = ctx(), dpr = window.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = '#111111'; g.lineCap = 'round'; g.lineJoin = 'round';
    strokes.current.forEach((s) => {
      for (let i = 1; i < s.length; i++) {
        g.lineWidth = s[i].w; g.beginPath(); g.moveTo(s[i - 1].x, s[i - 1].y); g.lineTo(s[i].x, s[i].y); g.stroke();
      }
      if (s.length === 1) { g.beginPath(); g.arc(s[0].x, s[0].y, s[0].w / 2, 0, Math.PI * 2); g.fillStyle = '#111111'; g.fill(); }
    });
  }, []);

  // Ajusta a resolução ao tamanho real (e redesenha) — telas de alta densidade e rotação do tablet
  useEffect(() => {
    const c = canvas.current;
    const fit = () => {
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c);
    return () => ro.disconnect();
  }, [redraw]);

  const pt = (e) => {
    const r = canvas.current.getBoundingClientRect();
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: 1.2 + p * 3.2 };
  };
  const down = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    drawing.current = [pt(e)];
    strokes.current.push(drawing.current);
    redraw();
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    evs.forEach((x) => drawing.current.push(pt(x)));
    redraw();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = null;
    const vazio = !strokes.current.some((s) => s.length > 2);
    setEmpty(vazio); if (onChange) onChange(!vazio);
  };

  useImperativeHandle(ref, () => ({
    clear() { strokes.current = []; redraw(); setEmpty(true); if (onChange) onChange(false); },
    isEmpty() { return !strokes.current.some((s) => s.length > 2); },
    toDataURL() {
      const c = canvas.current, max = 1200;
      if (c.width <= max) return c.toDataURL('image/png');
      const o = document.createElement('canvas'); o.width = max; o.height = Math.round(c.height * (max / c.width));
      const g = o.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0, o.width, o.height);
      return o.toDataURL('image/png');
    }
  }), [redraw, onChange]);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvas} role="img" aria-label={label + (empty ? ' (vazia)' : ' (preenchida)')}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          style={{ display: 'block', width: '100%', height, background: '#FFFFFF', border: '2px dashed ' + (disabled ? 'var(--border)' : 'var(--primary)'), borderRadius: 10, touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 24, right: 24, bottom: Math.round(height * 0.22), borderBottom: '1px solid #9CA3AF', pointerEvents: 'none' }} />
        {empty && <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '38%', textAlign: 'center', color: '#9CA3AF', fontSize: 14, pointerEvents: 'none' }}>Assine aqui com a caneta ou o dedo</span>}
      </div>
    </div>
  );
});

export default SignaturePad;
