import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import { CARD_REGISTRY, CARD_TYPES } from '../generated/registry';
import { validateCardAssetUrls } from '../renderer/assetUrls';
import type { CardData, CardType } from '../types/card';
import type { CardJsonSchema } from './types';

const ajv = new Ajv2020({ allErrors: true, strict: false });

const validators = Object.fromEntries(
  CARD_TYPES.map((cardType) => [
    cardType,
    ajv.compile(CARD_REGISTRY[cardType].jsonSchema as AnySchema),
  ]),
) as Record<CardType, ValidateFunction>;

export interface ValidationSuccess<TValue> {
  valid: true;
  data: TValue;
  errors: [];
}

export interface ValidationFailure {
  valid: false;
  errors: ErrorObject[] | string[];
}

export type ValidationResult<TValue> = ValidationSuccess<TValue> | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCardType(value: string): value is CardType {
  return CARD_TYPES.includes(value as CardType);
}

export function validateCardDataForSchema(
  data: unknown,
  cardType: CardType,
): ValidationResult<CardData> {
  const validate = validators[cardType];
  if (validate(data)) {
    const assetErrors = validateCardAssetUrls(data as CardData);
    if (assetErrors.length > 0) {
      return { valid: false, errors: assetErrors };
    }
    return { valid: true, data: data as CardData, errors: [] };
  }
  return { valid: false, errors: validate.errors ?? ['CardData validation failed.'] };
}

export function validateCardData(data: unknown): ValidationResult<CardData> {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return { valid: false, errors: ['CardData.type must identify a supported card schema.'] };
  }

  if (!isCardType(data.type)) {
    return { valid: false, errors: [`Unsupported card type: ${data.type}`] };
  }

  return validateCardDataForSchema(data, data.type);
}

function instancePath(error: ErrorObject): string {
  const path = error.instancePath || 'CardData';
  if (error.keyword === 'required') {
    return `${path}.${String(error.params.missingProperty)}`;
  }
  if (error.keyword === 'additionalProperties') {
    return `${path}.${String(error.params.additionalProperty)}`;
  }
  return path;
}

export function formatValidationErrors(errors: ErrorObject[] | string[]): string {
  return errors
    .map((error) => {
      if (typeof error === 'string') {
        return error;
      }
      return `${instancePath(error)} ${error.message ?? 'is invalid'}`;
    })
    .join('；');
}

export function isCardJsonSchema(schema: CardJsonSchema): boolean {
  return schema.type === 'object' && Boolean(schema.properties);
}
