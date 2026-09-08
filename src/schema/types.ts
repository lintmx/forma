import type { ComponentType } from 'react';
import type { CardContentData, CardData, CardType } from '../generated/types';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonSchemaType =
  'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';

export interface CardJsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: JsonSchemaType | JsonSchemaType[];
  const?: JsonValue;
  properties?: Record<string, CardJsonSchema>;
  required?: string[];
  items?: CardJsonSchema;
  enum?: Array<string | number | boolean | null>;
  default?: JsonValue;
  minimum?: number;
  minItems?: number;
  additionalProperties?: boolean;
  ['x-forma-widget']?: string;
  ['x-forma-group']?: string;
  ['x-forma-order']?: number;
}

export interface FixtureDefinition<TData extends CardData = CardData> {
  id: string;
  label: string;
  description: string;
  data: TData;
}

export type CardComponent = ComponentType<{ data: CardContentData }>;

export interface CardSchemaDefinition<TData extends CardData = CardData> {
  id: CardType;
  title: string;
  description: string;
  jsonSchema: CardJsonSchema;
  contentSchema: CardJsonSchema;
  defaultData: TData;
  fixtures: FixtureDefinition<TData>[];
}

export interface CardRegistryEntry<
  TData extends CardData = CardData,
> extends CardSchemaDefinition<TData> {
  component: CardComponent;
}
