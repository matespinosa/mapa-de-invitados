'use client';

import { Beef, CircleDashed, Drumstick, Leaf } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mealLabels, type Meal } from './seating';

/** 'pending' is how the roster spells "no menu chosen yet". */
export type MealChoice = Meal | 'pending';

export const mealIcons = {
  pending: CircleDashed,
  chicken: Drumstick,
  beef: Beef,
  vegetarian: Leaf,
} as const;

/** Short words for the chips, where the full label would not fit. */
export const mealShortLabels = {
  pending: 'Por confirmar',
  chicken: 'Pollo',
  beef: 'Carne',
  vegetarian: 'Veg.',
} as const;

export const mealChoices = Object.keys(mealLabels) as MealChoice[];

export const toChoice = (meal: Meal | null | undefined): MealChoice => meal ?? 'pending';

/** The roster stores "no menu yet" as null, not as the 'pending' word. */
export const fromChoice = (choice: MealChoice): Meal | null =>
  choice === 'pending' ? null : choice;

/**
 * The protein of one person, changed in place. The plan already arrives with
 * everyone's menu from the confirmation list; this only edits what is there.
 */
export function MealPicker({
  value,
  personName,
  onChange,
  compact = false,
  tag = false,
}: {
  value: Meal | null | undefined;
  personName: string;
  onChange: (meal: Meal | null) => void;
  compact?: boolean;
  tag?: boolean;
}) {
  const choice = toChoice(value);
  const Icon = mealIcons[choice];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          tag
            ? 'meal-tag'
            : `meal-chip meal-${choice} ${compact ? 'meal-chip-compact' : ''}`
        }
        title={`Menú de ${personName}: ${mealLabels[choice]}. Tocar para cambiar.`}
        aria-label={`Menú de ${personName}: ${mealLabels[choice]}. Cambiar`}
        // The row underneath starts a drag on pointer down; the chip must not.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {tag ? (
          <span>{mealShortLabels[choice]}</span>
        ) : (
          <>
            <Icon size={14} />
            {!compact && <span>{mealShortLabels[choice]}</span>}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="meal-menu" align="end">
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(next) => onChange(fromChoice(next as MealChoice))}
        >
          {mealChoices.map((option) => {
            const OptionIcon = mealIcons[option];
            return (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                // Picking a protein is the whole errand: close on the choice.
                closeOnClick
                className={`meal-option meal-${option}`}
              >
                <OptionIcon size={15} />
                {mealLabels[option]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
