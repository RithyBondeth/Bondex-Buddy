import { heroNames } from '../../website/shared/hero-motion';
import type { CompanionId } from '../../website/shared/abilities';

export type { CompanionId };
export const companionNames = {
  ember: 'Ember',
  moon: 'Moon',
  moss: 'Moss',
  'blue-jelly': 'Blue Jelly',
  ...heroNames,
} satisfies Record<CompanionId, string>;

export function isCompanion(value: unknown): value is CompanionId {
  return typeof value === 'string' && Object.hasOwn(companionNames, value);
}
