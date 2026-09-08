/* AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. */

import type {
  CardComponent,
  CardJsonSchema,
  CardRegistryEntry,
  FixtureDefinition,
} from '../schema/types';
import type { CardType, CardTypeMap } from './types';
import renderOptionsSchema from '../../src/schema/render-options.json';
import SocialPostCard from '../../cards/social_post/Card';
import social_postSchema from '../../cards/social_post/schema.json';
import social_postDefaultFixture from '../../cards/social_post/fixtures/default.json';
import social_postMinimalFixture from '../../cards/social_post/fixtures/minimal.json';
import social_postLongTextFixture from '../../cards/social_post/fixtures/long-text.json';
import social_postMediaOnlyFixture from '../../cards/social_post/fixtures/media-only.json';
import social_postMultiImageFixture from '../../cards/social_post/fixtures/multi-image.json';
import social_postRelationsFixture from '../../cards/social_post/fixtures/relations.json';
import social_postReplyFixture from '../../cards/social_post/fixtures/reply.json';
import social_postReshareFixture from '../../cards/social_post/fixtures/reshare.json';
import social_postTranslatedFixture from '../../cards/social_post/fixtures/translated.json';

export const RENDER_OPTIONS_SCHEMA = renderOptionsSchema as CardJsonSchema;

const social_postComposedSchema = {
  ...social_postSchema,
  properties: {
    ...social_postSchema.properties,
    options: renderOptionsSchema,
  },
};

const social_postFixtures: FixtureDefinition<CardTypeMap['social_post']>[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Default fixture scenario.',
    data: social_postDefaultFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Minimal fixture scenario.',
    data: social_postMinimalFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'long-text',
    label: 'Long Text',
    description: 'Long Text fixture scenario.',
    data: social_postLongTextFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'media-only',
    label: 'Media Only',
    description: 'Media Only fixture scenario.',
    data: social_postMediaOnlyFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'multi-image',
    label: 'Multi Image',
    description: 'Multi Image fixture scenario.',
    data: social_postMultiImageFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'relations',
    label: 'Relations',
    description: 'Relations fixture scenario.',
    data: social_postRelationsFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'reply',
    label: 'Reply',
    description: 'Reply fixture scenario.',
    data: social_postReplyFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'reshare',
    label: 'Reshare',
    description: 'Reshare fixture scenario.',
    data: social_postReshareFixture as unknown as CardTypeMap['social_post'],
  },
  {
    id: 'translated',
    label: 'Translated',
    description: 'Translated fixture scenario.',
    data: social_postTranslatedFixture as unknown as CardTypeMap['social_post'],
  },
];

export const CARD_REGISTRY = {
  social_post: {
    id: 'social_post',
    title: 'Social Post',
    description: '跨平台社交内容的统一表现形式。',
    jsonSchema: social_postComposedSchema as CardJsonSchema,
    contentSchema: social_postSchema as CardJsonSchema,
    defaultData: social_postDefaultFixture as unknown as CardTypeMap['social_post'],
    fixtures: social_postFixtures,
    component: SocialPostCard as unknown as CardComponent,
  },
} satisfies Record<CardType, CardRegistryEntry>;

export const CARD_TYPES: CardType[] = Object.keys(CARD_REGISTRY) as CardType[];
export const DEFAULT_CARD_DATA = CARD_REGISTRY[CARD_TYPES[0]].defaultData;
