import { CARD_REGISTRY, CARD_TYPES } from '../generated/registry';
import type { FixtureDefinition } from '../schema/types';
import type { CardData, CardType } from '../types/card';

export const FIXTURES: Record<CardType, FixtureDefinition[]> = Object.fromEntries(
  CARD_TYPES.map((cardType) => [cardType, CARD_REGISTRY[cardType].fixtures]),
) as Record<CardType, FixtureDefinition[]>;

export function getFixtures(cardType: CardType): FixtureDefinition[] {
  return FIXTURES[cardType];
}

export function cloneCardData(data: CardData): CardData {
  return JSON.parse(JSON.stringify(data)) as CardData;
}
