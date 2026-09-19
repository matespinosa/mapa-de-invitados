'use client';

import { useState } from 'react';

/** Up to two initials, for when Google has no photo or it fails to load. */
export const initialsOf = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '·';

/**
 * The picture Google keeps for the account, with the initials as a fallback.
 * Shown on the login screen and in the header, so both places recognise the
 * person the same way.
 */
export function ProfilePhoto({
  photo,
  name,
  className = '',
}: {
  photo: string | null | undefined;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      <img
        className={`profile-photo ${className}`}
        src={photo}
        alt=""
        // Google serves profile pictures only when no referrer is sent.
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`profile-photo profile-photo-text ${className}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
