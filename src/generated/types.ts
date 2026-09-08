/* AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. */

export type CardTheme = 'light' | 'dark';

export type RenderOptions = {
  theme?: CardTheme;
  watermark?: string;
};

export interface ComparisonCardData {
  schemaVersion: '1';
  type: 'comparison';
  title: string;
  subtitle?: string;
  time?: string;
  modules: Array<{
    type: 'metric' | 'text' | 'diff' | 'image' | 'entity';
    name?: string;
    items?: Array<{
      label?: string;
      before?: string | number;
      after?: string | number;
      name?: string;
      handle?: string;
      bio?: string;
      action?: string;
      color?: 'green' | 'red' | 'gray';
    }>;
    before?: string | { url: string; label?: string };
    after?: string | { url: string; label?: string };
  }>;
  options?: RenderOptions;
}

export interface ComparisonCardContent {
  schemaVersion: '1';
  type: 'comparison';
  title: string;
  subtitle?: string;
  time?: string;
  modules: Array<{
    type: 'metric' | 'text' | 'diff' | 'image' | 'entity';
    name?: string;
    items?: Array<{
      label?: string;
      before?: string | number;
      after?: string | number;
      name?: string;
      handle?: string;
      bio?: string;
      action?: string;
      color?: 'green' | 'red' | 'gray';
    }>;
    before?: string | { url: string; label?: string };
    after?: string | { url: string; label?: string };
  }>;
}

export interface SocialPostCardData {
  schemaVersion: '1';
  type: 'social_post';
  author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
  source?: string;
  postUrl?: string;
  postKind?: 'post' | 'reply' | 'quote' | 'reshare';
  content?: string;
  translation?: { text: string; sourceLanguage?: string; model?: string };
  media?: Array<{
    type?: 'image' | 'video' | 'gif' | 'audio';
    url: string;
    previewUrl?: string;
    alt?: string;
  }>;
  replyChain?: Array<{
    author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
    content?: string;
    translation?: { text: string; sourceLanguage?: string; model?: string };
    media?: Array<{
      type?: 'image' | 'video' | 'gif' | 'audio';
      url: string;
      previewUrl?: string;
      alt?: string;
    }>;
    publishedAt?: string;
  }>;
  quotedPost?: {
    author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
    content?: string;
    translation?: { text: string; sourceLanguage?: string; model?: string };
    media?: Array<{
      type?: 'image' | 'video' | 'gif' | 'audio';
      url: string;
      previewUrl?: string;
      alt?: string;
    }>;
    publishedAt?: string;
  };
  reshare?: { by: { name: string }; publishedAt?: string };
  publishedAt?: string;
  options?: RenderOptions;
}

export interface SocialPostCardContent {
  schemaVersion: '1';
  type: 'social_post';
  author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
  source?: string;
  postUrl?: string;
  postKind?: 'post' | 'reply' | 'quote' | 'reshare';
  content?: string;
  translation?: { text: string; sourceLanguage?: string; model?: string };
  media?: Array<{
    type?: 'image' | 'video' | 'gif' | 'audio';
    url: string;
    previewUrl?: string;
    alt?: string;
  }>;
  replyChain?: Array<{
    author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
    content?: string;
    translation?: { text: string; sourceLanguage?: string; model?: string };
    media?: Array<{
      type?: 'image' | 'video' | 'gif' | 'audio';
      url: string;
      previewUrl?: string;
      alt?: string;
    }>;
    publishedAt?: string;
  }>;
  quotedPost?: {
    author?: { name?: string; handle?: string; avatarUrl?: string; verified?: boolean };
    content?: string;
    translation?: { text: string; sourceLanguage?: string; model?: string };
    media?: Array<{
      type?: 'image' | 'video' | 'gif' | 'audio';
      url: string;
      previewUrl?: string;
      alt?: string;
    }>;
    publishedAt?: string;
  };
  reshare?: { by: { name: string }; publishedAt?: string };
  publishedAt?: string;
}

export interface CardTypeMap {
  comparison: ComparisonCardData;
  social_post: SocialPostCardData;
}

export interface CardContentTypeMap {
  comparison: ComparisonCardContent;
  social_post: SocialPostCardContent;
}

export type CardType = keyof CardTypeMap;
export type CardData = CardTypeMap[CardType];
export type CardContentData = CardContentTypeMap[CardType];
export type CardProps<TCardType extends CardType = CardType> = {
  data: CardContentTypeMap[TCardType];
};
