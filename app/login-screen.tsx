'use client';

import { useCallback, useState } from 'react';
import {
  Armchair,
  LoaderCircle,
  Lock,
  MailWarning,
  PlugZap,
  RotateCcw,
  X,
} from 'lucide-react';
import { signInWithGoogle, signOutOfGoogle } from './cloud-plan';
import { ProfilePhoto } from './profile-photo';
import {
  forgetAccount,
  readRememberedAccounts,
  type RememberedAccount,
} from './remembered-accounts';
import type { AccessState } from './use-plan-persistence';

/** The official Google mark, so the only way in looks like what it is. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginScreen({ access }: { access: AccessState }) {
  // Read once on mount: signing out unmounts the organizer and mounts this
  // screen again, so the list is always fresh without watching for changes.
  const [remembered, setRemembered] = useState<RememberedAccount[]>(
    readRememberedAccounts,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? String(cause.code)
          : '';
      // Closing the Google window is a choice, not a failure worth reporting.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      setError(
        code === 'auth/popup-blocked'
          ? 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de este sitio e inténtalo otra vez.'
          : code === 'auth/network-request-failed'
            ? 'No hay conexión con Google. Revisa la red e inténtalo otra vez.'
            : code === 'auth/unauthorized-domain'
              ? 'Este dominio todavía no está autorizado en Firebase Authentication.'
              : cause instanceof Error
                ? cause.message
                : 'No se pudo entrar con Google.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const enter = (hint?: string) => void run(() => signInWithGoogle(hint));
  // A refused account has to leave before Google will offer a different one.
  const switchAccount = () =>
    void run(async () => {
      await signOutOfGoogle();
      await signInWithGoogle();
    });

  const forget = (email: string) => {
    forgetAccount(email);
    setRemembered(readRememberedAccounts());
  };

  const [first, ...others] = remembered;

  return (
    <main className="login-screen">
      <div className="login-card">
        <span className="login-brand">
          <span className="brand-icon">
            <Armchair size={23} strokeWidth={1.8} />
          </span>
          Recepción<span className="brand-dot">.</span>
        </span>

        {access.status === 'checking' && (
          <output className="login-state" aria-live="polite">
            <LoaderCircle size={26} className="export-spinner" />
            <span>Abriendo tu sesión…</span>
          </output>
        )}

        {access.status === 'signed-out' && first && (
          <>
            <h1 className="login-title">
              Hola, {first.name.split(' ')[0]}
            </h1>
            <p className="login-subtitle">Bienvenido de vuelta.</p>
            <button
              className="login-account"
              disabled={busy}
              onClick={() => enter(first.email)}
            >
              <ProfilePhoto photo={first.photo} name={first.name || first.email} />
              <span className="login-account-text">
                <strong>{first.name || first.email}</strong>
                <span>{first.email}</span>
              </span>
              {busy ? <LoaderCircle size={18} className="export-spinner" /> : <GoogleMark />}
            </button>
            {others.length > 0 && (
              <ul className="login-others">
                {others.map((account) => (
                  <li key={account.email}>
                    <button
                      className="login-account light"
                      disabled={busy}
                      onClick={() => enter(account.email)}
                    >
                      <ProfilePhoto photo={account.photo} name={account.name || account.email} />
                      <span className="login-account-text">
                        <strong>{account.name || account.email}</strong>
                        <span>{account.email}</span>
                      </span>
                    </button>
                    <button
                      className="login-forget"
                      aria-label={`Olvidar ${account.email} en este dispositivo`}
                      title="Olvidar en este dispositivo"
                      disabled={busy}
                      onClick={() => forget(account.email)}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="login-link" disabled={busy} onClick={() => enter()}>
              Entrar con otra cuenta de Google
            </button>
            <button
              className="login-link muted-link"
              disabled={busy}
              onClick={() => forget(first.email)}
            >
              No soy {first.name.split(' ')[0]} · olvidar esta cuenta
            </button>
          </>
        )}

        {access.status === 'signed-out' && !first && (
          <>
            <h1 className="login-title">Organiza tu recepción</h1>
            <p className="login-subtitle">
              Entra con tu cuenta de Google para abrir el plano de las mesas.
            </p>
            <button className="login-google" disabled={busy} onClick={() => enter()}>
              {busy ? (
                <LoaderCircle size={18} className="export-spinner" />
              ) : (
                <GoogleMark />
              )}
              Entrar con Google
            </button>
          </>
        )}

        {access.status === 'denied' && (
          <>
            <span className="login-icon login-icon-locked">
              <Lock size={22} />
            </span>
            <h1 className="login-title">Este plano es privado</h1>
            <p className="login-subtitle">
              {access.name ? `Hola, ${access.name}. ` : ''}
              La cuenta <strong>{access.email || 'con la que entraste'}</strong> no está
              en la lista de quienes pueden abrirlo. Entra con la cuenta de Google de
              siempre.
            </p>
            <button className="login-google" disabled={busy} onClick={switchAccount}>
              {busy ? (
                <LoaderCircle size={18} className="export-spinner" />
              ) : (
                <GoogleMark />
              )}
              Entrar con otra cuenta
            </button>
          </>
        )}

        {access.status === 'not-google' && (
          <>
            <span className="login-icon login-icon-locked">
              <Lock size={22} />
            </span>
            <h1 className="login-title">Necesitas una cuenta de Google</h1>
            <p className="login-subtitle">
              Esta sesión no viene de Google. Aquí solo se entra con una cuenta de
              Google; no hay usuario ni contraseña aparte.
            </p>
            <button className="login-google" disabled={busy} onClick={switchAccount}>
              {busy ? (
                <LoaderCircle size={18} className="export-spinner" />
              ) : (
                <GoogleMark />
              )}
              Entrar con Google
            </button>
          </>
        )}

        {access.status === 'unverified' && (
          <>
            <span className="login-icon login-icon-warn">
              <MailWarning size={22} />
            </span>
            <h1 className="login-title">Verifica tu correo</h1>
            <p className="login-subtitle">
              Google todavía no confirma <strong>{access.email}</strong>. Verifícalo
              en tu cuenta de Google y vuelve a entrar.
            </p>
            <button className="login-google" disabled={busy} onClick={switchAccount}>
              {busy ? (
                <LoaderCircle size={18} className="export-spinner" />
              ) : (
                <GoogleMark />
              )}
              Entrar con otra cuenta
            </button>
          </>
        )}

        {access.status === 'unconfigured' && (
          <>
            <span className="login-icon login-icon-warn">
              <PlugZap size={22} />
            </span>
            <h1 className="login-title">Falta conectar Google</h1>
            <p className="login-subtitle">
              Esta copia de la aplicación no tiene las credenciales de Firebase, así
              que todavía no se puede entrar. Los pasos están en{' '}
              <code>docs/guardar-con-google.md</code>.
            </p>
          </>
        )}

        {access.status === 'error' && (
          <>
            <span className="login-icon login-icon-warn">
              <MailWarning size={22} />
            </span>
            <h1 className="login-title">No se pudo abrir la sesión</h1>
            <p className="login-subtitle">{access.message}</p>
            <button className="login-google" onClick={() => window.location.reload()}>
              <RotateCcw size={18} />
              Reintentar
            </button>
          </>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <p className="login-note">
          Solo se entra con Google. No hay contraseña que recordar ni recuperar.
        </p>
      </div>
    </main>
  );
}
