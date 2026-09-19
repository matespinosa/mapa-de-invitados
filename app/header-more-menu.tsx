'use client';

import { CircleHelp, CloudOff, Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Extra header actions on phones. Export stays visible; help and retry live
 * behind this menu so the session photo still fits.
 */
export default function HeaderMoreMenu({
  canRetry,
  onHelp,
  onRetry,
}: {
  canRetry: boolean;
  onHelp: () => void;
  onRetry: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="icon-button header-more"
        aria-label="Más acciones"
      >
        <Ellipsis size={22} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="header-more-menu" align="end" sideOffset={8}>
        <DropdownMenuItem onClick={onHelp}>
          <CircleHelp size={16} />
          Cómo usar el organizador
        </DropdownMenuItem>
        {canRetry && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="header-more-retry" onClick={onRetry}>
              <CloudOff size={16} />
              Reintentar guardado
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
