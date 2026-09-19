'use client';

import { useState } from 'react';
import { ChevronDown, LoaderCircle, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutOfGoogle } from './cloud-plan';
import { ProfilePhoto } from './profile-photo';

/**
 * Who is using the plan, always visible in the header: the Google picture, the
 * name, and the way out. Leaving returns to the login screen, which greets this
 * person by name the next time they open the app on this device.
 */
export default function AccountMenu({
  account,
  name,
}: {
  account: User;
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fullName = account.displayName || name;
  const email = account.email ?? '';

  const leave = () => {
    if (busy) return;
    setBusy(true);
    setError('');
    void signOutOfGoogle()
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.',
        );
      })
      // Signing out unmounts this menu, so only a failure ever lands here.
      .finally(() => setBusy(false));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="account-chip"
        aria-label={`Cuenta de ${fullName}${email ? ` (${email})` : ''}`}
      >
        <ProfilePhoto photo={account.photoURL} name={fullName} />
        <span className="account-chip-name">{name}</span>
        <ChevronDown size={15} className="account-chip-caret" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="account-menu" align="end" sideOffset={8}>
        <div className="account-menu-head">
          <ProfilePhoto photo={account.photoURL} name={fullName} className="is-large" />
          <span className="account-menu-id">
            <strong>{fullName}</strong>
            {email && <span>{email}</span>}
          </span>
        </div>
        <p className="account-menu-note">
          Tu plano se guarda en esta cuenta de Google.
        </p>
        {error && (
          <p className="account-menu-error" role="alert">
            {error}
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="account-menu-out"
          disabled={busy}
          onClick={leave}
        >
          {busy ? <LoaderCircle size={16} className="export-spinner" /> : <LogOut size={16} />}
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
