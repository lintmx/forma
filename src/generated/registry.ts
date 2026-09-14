/* AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. */

import type {
  CardComponent,
  CardJsonSchema,
  CardRegistryEntry,
  FixtureDefinition,
} from '../schema/types';
import type { CardType, CardTypeMap } from './types';
import renderOptionsSchema from '../../src/schema/render-options.json';
import ArticleCard from '../../cards/article/Card';
import articleSchema from '../../cards/article/schema.json';
import articleDefaultFixture from '../../cards/article/fixtures/default.json';
import articleMinimalFixture from '../../cards/article/fixtures/minimal.json';
import articleLongTextFixture from '../../cards/article/fixtures/long-text.json';
import articleMarkdownFixture from '../../cards/article/fixtures/markdown.json';
import articlePlainTextFixture from '../../cards/article/fixtures/plain-text.json';
import articleRelativeMediaFixture from '../../cards/article/fixtures/relative-media.json';
import articleTranslatedFixture from '../../cards/article/fixtures/translated.json';
import ComparisonCard from '../../cards/comparison/Card';
import comparisonSchema from '../../cards/comparison/schema.json';
import comparisonDefaultFixture from '../../cards/comparison/fixtures/default.json';
import comparisonMinimalFixture from '../../cards/comparison/fixtures/minimal.json';
import comparisonDiffFixture from '../../cards/comparison/fixtures/diff.json';
import comparisonEntityFixture from '../../cards/comparison/fixtures/entity.json';
import comparisonImageFixture from '../../cards/comparison/fixtures/image.json';
import comparisonMetricFixture from '../../cards/comparison/fixtures/metric.json';
import comparisonTextFixture from '../../cards/comparison/fixtures/text.json';
import SocialPostCard from '../../cards/social_post/Card';
import social_postSchema from '../../cards/social_post/schema.json';
import social_postDefaultFixture from '../../cards/social_post/fixtures/default.json';
import social_postMinimalFixture from '../../cards/social_post/fixtures/minimal.json';
import social_postLongTextFixture from '../../cards/social_post/fixtures/long-text.json';
import social_postMediaCollageFixture from '../../cards/social_post/fixtures/media-collage.json';
import social_postMediaOnlyFixture from '../../cards/social_post/fixtures/media-only.json';
import social_postMultiImageFixture from '../../cards/social_post/fixtures/multi-image.json';
import social_postRelationsFixture from '../../cards/social_post/fixtures/relations.json';
import social_postReplyFixture from '../../cards/social_post/fixtures/reply.json';
import social_postReshareFixture from '../../cards/social_post/fixtures/reshare.json';
import social_postTranslatedFixture from '../../cards/social_post/fixtures/translated.json';

export const RENDER_OPTIONS_SCHEMA = renderOptionsSchema as CardJsonSchema;

const articleComposedSchema = {
  ...articleSchema,
  properties: {
    ...articleSchema.properties,
    options: renderOptionsSchema,
  },
};

const comparisonComposedSchema = {
  ...comparisonSchema,
  properties: {
    ...comparisonSchema.properties,
    options: renderOptionsSchema,
  },
};

const social_postComposedSchema = {
  ...social_postSchema,
  properties: {
    ...social_postSchema.properties,
    options: renderOptionsSchema,
  },
};

const articleFixtures: FixtureDefinition<CardTypeMap['article']>[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Default fixture scenario.',
    data: articleDefaultFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Minimal fixture scenario.',
    data: articleMinimalFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'long-text',
    label: 'Long Text',
    description: 'Long Text fixture scenario.',
    data: articleLongTextFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Markdown fixture scenario.',
    data: articleMarkdownFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'plain-text',
    label: 'Plain Text',
    description: 'Plain Text fixture scenario.',
    data: articlePlainTextFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'relative-media',
    label: 'Relative Media',
    description: 'Relative Media fixture scenario.',
    data: articleRelativeMediaFixture as unknown as CardTypeMap['article'],
  },
  {
    id: 'translated',
    label: 'Translated',
    description: 'Translated fixture scenario.',
    data: articleTranslatedFixture as unknown as CardTypeMap['article'],
  },
];

const comparisonFixtures: FixtureDefinition<CardTypeMap['comparison']>[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Default fixture scenario.',
    data: comparisonDefaultFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Minimal fixture scenario.',
    data: comparisonMinimalFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'diff',
    label: 'Diff',
    description: 'Diff fixture scenario.',
    data: comparisonDiffFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'entity',
    label: 'Entity',
    description: 'Entity fixture scenario.',
    data: comparisonEntityFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Image fixture scenario.',
    data: comparisonImageFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'metric',
    label: 'Metric',
    description: 'Metric fixture scenario.',
    data: comparisonMetricFixture as unknown as CardTypeMap['comparison'],
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Text fixture scenario.',
    data: comparisonTextFixture as unknown as CardTypeMap['comparison'],
  },
];

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
    id: 'media-collage',
    label: 'Media Collage',
    description: 'Media Collage fixture scenario.',
    data: social_postMediaCollageFixture as unknown as CardTypeMap['social_post'],
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
  article: {
    id: 'article',
    title: 'Article',
    description: '跨平台长文内容的统一表现形式。',
    jsonSchema: articleComposedSchema as CardJsonSchema,
    contentSchema: articleSchema as CardJsonSchema,
    defaultData: articleDefaultFixture as unknown as CardTypeMap['article'],
    fixtures: articleFixtures,
    component: ArticleCard as unknown as CardComponent,
  },
  comparison: {
    id: 'comparison',
    title: 'Data Comparison',
    description:
      '对比前后数据并由系统生成指标、文本、逐行差异、实体列表和图片对照；entity 模块直接展示调用方传入的实体列表。',
    jsonSchema: comparisonComposedSchema as CardJsonSchema,
    contentSchema: comparisonSchema as CardJsonSchema,
    defaultData: comparisonDefaultFixture as unknown as CardTypeMap['comparison'],
    fixtures: comparisonFixtures,
    component: ComparisonCard as unknown as CardComponent,
  },
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
