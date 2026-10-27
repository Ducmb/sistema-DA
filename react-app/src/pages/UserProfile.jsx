import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Skeleton, ErrorBox, useToast } from '../components/ui.jsx';
import PasswordStrength, { checkPassword, usePasswordRules } from '../components/PasswordStrength.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useIsMobile } from '../lib/hooks.js';
import { EMAIL_RE, PHONE_RE, initials, maskPhone } from '../lib/format.js';

const EDITABLE = ['phone', 'personalEmail', 'birthday'];
const pick = (p) => Object.fromEntries(EDITABLE.map((k) => [k, p[k] || '']));

/** Tela 04 — Meus Dados (RF09–RF11, RNF04). */
export default function UserProfile() {
  const isMobile = useIsMobile();
  const { user, setPreference, replaceToken } = useAuth();
  const toast = useToast();
  const st = useApi(() => api.get('/profile'), []);
  const [edit, setEdit] = useState(null);
  const [orig, setOrig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ ok: false, err: '' });

  useEffect(() => { if (st.data) { setEdit(pick(st.data)); setOrig(pick(st.data)); } }, [st.data]);

  const changed = edit && orig && JSON.stringify(edit) !== JSON.stringify(orig);
  const set = (k, v) => { setEdit((e) => ({ ...e, [k]: v })); setMsg({ ok: false, err: '' }); };

  const save = async (e) => {
    e.preventDefault();
    if (edit.personalEmail && !EMAIL_RE.test(edit.personalEmail)) { setMsg({ ok: false, err: 'E-mail pessoal inválido' }); return; }
    if (edit.phone && !PHONE_RE.test(edit.phone)) { setMsg({ ok: false, err: 'Telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX' }); return; }
    setSaving(true);
    try {
      const r = await api.put('/profile', edit);
      setOrig(pick(r)); setEdit(pick(r));
      setMsg({ ok: true, err: '' });
      setTimeout(() => setMsg((m) => ({ ...m, ok: false })), 3000);
    } catch (err) {
      setMsg({ ok: false, err: err.message });
    } finally { setSaving(false); }
  };

  const p = st.data;
  const dark = user.preferences.theme === 'dark';
  const cols = isMobile ? '1fr' : '1fr 1fr';
  const ro = (label, value, id) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" value={value || '—'} readOnly aria-readonly="true" /></div>
  );

  return (
    <>
      <PageHeader section="Meu Perfil" title="Meu Perfil" />
      <main className="page narrow">
        <ErrorBox error={st.error} onRetry={st.reload} />
        {!p || !edit ? (
          <div className="stack"><Skeleton h={128} /><Skeleton h={180} /><Skeleton h={180} /></div>
        ) : (
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card fade-up" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div className="avatar" style={{ width: 80, height: 80, background: '#1C543A', color: '#fff', fontWeight: 600, fontSize: 32 }}>{initials(p.name)}</div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 600 }}>{p.name}</p>
                <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>{p.department} • {p.roles.join(', ')}</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>{p.institutionalEmail}</p>
              </div>
            </div>

            <div className="card fade-up" style={{ padding: 24, animationDelay: '0.1s' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 20, letterSpacing: 0.5, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>Dados Funcionais</h2>
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 20 }}>
                {ro('Nome Completo', p.name, 'pf-nome')}
                {ro('Matrícula', p.registration, 'pf-mat')}
                {ro('Cargo', p.position, 'pf-cargo')}
                {ro('E-mail Institucional', p.institutionalEmail, 'pf-email')}
              </div>
              <p className="hint" style={{ marginTop: 14 }}>Dados funcionais só podem ser alterados pela Gestão de Pessoal.</p>
            </div>

            <div className="card fade-up" style={{ padding: 24, animationDelay: '0.2s' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 20, letterSpacing: 0.5, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>Dados Pessoais e de Contato</h2>
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 20 }}>
                <div className="field"><label htmlFor="pf-tel">Telefone</label><input id="pf-tel" className="input" type="tel" inputMode="tel" value={edit.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} placeholder="(XX) XXXXX-XXXX" /></div>
                <div className="field"><label htmlFor="pf-pemail">E-mail Pessoal</label><input id="pf-pemail" className="input" type="email" value={edit.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} placeholder="seu.email@example.com" /></div>
                <div className="field" style={{ gridColumn: 1 }}><label htmlFor="pf-bday">Data de Aniversário</label><input id="pf-bday" className="input" type="date" value={edit.birthday} onChange={(e) => set('birthday', e.target.value)} /></div>
              </div>
            </div>

            <div className="row end fade-up" style={{ animationDelay: '0.3s' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setEdit(orig); setMsg({ ok: false, err: '' }); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={!changed || saving}>{saving ? 'Salvando…' : 'Salvar Alterações'}</button>
            </div>
            {msg.ok && <div className="alert-box success" role="status">✓ Perfil atualizado com sucesso</div>}
            {msg.err && <div className="alert-box error" role="alert">⚠ {msg.err}</div>}
          </form>
        )}

        <section className="card fade-up" style={{ padding: 22, animationDelay: '0.35s' }}>
          <div className="section-head">
            <div><h3 className="card-title">Aparência</h3><p className="card-sub">A escolha vale só para o seu usuário. Outros servidores continuam com a aparência que escolheram.</p></div>
          </div>
          <div role="radiogroup" aria-label="Tema" className="row" style={{ gap: 12 }}>
            {[['light', 'Modo padrão', 'Fundo branco institucional', '#FFFFFF', '#E0E0E0'], ['dark', 'Modo escuro', 'Fundo grafite, menos brilho', '#1B2024', '#3A4247']].map(([t, label, sub, bg, bar]) => {
              const on = (t === 'dark') === dark;
              return (
                <button key={t} type="button" role="radio" aria-checked={on} onClick={() => { setPreference({ theme: t }).then(() => toast('Aparência atualizada')).catch((e) => toast(e.message, 'error')); }}
                  style={{ flex: 1, minWidth: 200, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: 14, borderRadius: 8, border: '2px solid ' + (on ? 'var(--accent)' : 'var(--border)'), background: 'var(--surface)' }}>
                  <span aria-hidden="true" style={{ width: 52, height: 38, borderRadius: 6, overflow: 'hidden', display: 'flex', flexShrink: 0, border: '1px solid var(--border)' }}>
                    <span style={{ width: 14, background: '#1C543A' }} />
                    <span style={{ flex: 1, background: bg, display: 'flex', flexDirection: 'column', gap: 3, padding: 5 }}><span style={{ height: 5, borderRadius: 2, background: bar }} /><span style={{ height: 5, width: '60%', borderRadius: 2, background: bar }} /></span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{label}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{sub}</span></span>
                  <span style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 800 }}>{on ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
        </section>

        <ChangePassword onToken={replaceToken} />
      </main>
    </>
  );
}

function ChangePassword({ onToken }) {
  const rules = usePasswordRules();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); setOk(false); };

  const submit = async () => {
    if (!f.current) { setErr('Informe a senha atual.'); return; }
    if (checkPassword(f.next, rules).some((r) => !r.ok)) { setErr('A nova senha não atende a todos os requisitos.'); return; }
    if (f.next === f.current) { setErr('A nova senha deve ser diferente da atual.'); return; }
    if (f.next !== f.confirm) { setErr('A confirmação não confere com a nova senha.'); return; }
    setBusy(true);
    try {
      const r = await api.put('/auth/password', { currentPassword: f.current, newPassword: f.next });
      onToken(r.token);
      setF({ current: '', next: '', confirm: '' }); setOk(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const type = visible ? 'text' : 'password';
  return (
    <section className="card fade-up" style={{ padding: 22, animationDelay: '0.4s' }}>
      <div className="section-head">
        <div><h2 className="card-title">Segurança — Alterar Senha</h2><p className="card-sub">A senha é armazenada com hash seguro (RNF01). Você será desconectado dos outros dispositivos.</p></div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVisible(!visible)}>{visible ? '🙈 Ocultar senhas' : '👁 Mostrar senhas'}</button>
      </div>
      <div className="grid" style={{ '--min': '220px', gap: 14 }}>
        <div className="field"><label htmlFor="pw-cur">Senha atual</label><input id="pw-cur" className="input" type={type} value={f.current} onChange={set('current')} placeholder="••••••••" autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="pw-new">Nova senha</label><input id="pw-new" className="input" type={type} value={f.next} onChange={set('next')} placeholder={'Mínimo ' + rules.min + ' caracteres'} autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="pw-conf">Confirmar nova senha</label><input id="pw-conf" className="input" type={type} value={f.confirm} onChange={set('confirm')} placeholder="Repita a nova senha" autoComplete="new-password" /></div>
      </div>
      <div style={{ marginTop: 14 }}><PasswordStrength value={f.next} rules={rules} /></div>
      {err && <p role="alert" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
      {ok && <p role="status" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>✓ Senha alterada com sucesso.</p>}
      <div className="row end" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" disabled={!(f.current && f.next && f.confirm) || busy} onClick={submit}>{busy ? 'Alterando…' : 'Alterar senha'}</button>
      </div>
    </section>
  );
}
