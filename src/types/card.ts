import type {
  CardContentData,
  CardContentTypeMap,
  CardData,
  CardProps,
  CardTheme,
  ComparisonCardData,
  ComparisonCardContent,
  RenderOptions,
  CardType,
  CardTypeMap,
  SocialPostCardData,
  SocialPostCardContent,
} from '../generated/types';

export type {
  CardContentData,
  CardContentTypeMap,
  CardData,
  CardProps,
  CardTheme,
  ComparisonCardData,
  ComparisonCardContent,
  RenderOptions,
  CardType,
  CardTypeMap,
  SocialPostCardData,
  SocialPostCardContent,
};

export type CardAuthor = NonNullable<SocialPostCardData['author']>;
export type CardMedia = NonNullable<NonNullable<SocialPostCardData['media']>[number]>;
export type SocialPostMediaLayout = NonNullable<SocialPostCardData['mediaLayout']>;
export type CardTranslation = NonNullable<SocialPostCardData['translation']>;
export type SocialPostSnapshot = NonNullable<NonNullable<SocialPostCardData['replyChain']>[number]>;

export interface FormaApi {
  render(data: unknown): Promise<void>;
  reset(): Promise<void>;
  readonly version: string;
}

declare global {
  interface Window {
    forma: FormaApi;
  }
}

export {};
