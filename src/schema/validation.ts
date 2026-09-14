import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import { CARD_REGISTRY, CARD_TYPES } from '../generated/registry';
import { validateCardAssetUrls } from '../renderer/assetUrls';
import type { CardData, CardType } from '../types/card';
import type { CardJsonSchema } from './types';

const strictAjv = new Ajv2020({ allErrors: true, strict: false });
const runtimeAjv = new Ajv2020({ allErrors: true, strict: false, removeAdditional: true });

const strictValidators = Object.fromEntries(
  CARD_TYPES.map((cardType) => [
    cardType,
    strictAjv.compile(CARD_REGISTRY[cardType].jsonSchema as AnySchema),
  ]),
) as Record<CardType, ValidateFunction>;

const runtimeValidators = Object.fromEntries(
  CARD_TYPES.map((cardType) => [
    cardType,
    runtimeAjv.compile(CARD_REGISTRY[cardType].jsonSchema as AnySchema),
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

function cloneRuntimeInput(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }

  return JSON.parse(JSON.stringify(data)) as unknown;
}

function validateCardDataForSchemaWithMode(
  data: unknown,
  cardType: CardType,
  mode: 'strict' | 'runtime',
): ValidationResult<CardData> {
  const candidate = mode === 'runtime' ? cloneRuntimeInput(data) : data;
  const validators = mode === 'runtime' ? runtimeValidators : strictValidators;
  const validate = validators[cardType];
  if (validate(candidate)) {
    const assetErrors = validateCardAssetUrls(candidate as CardData);
    if (assetErrors.length > 0) {
      return { valid: false, errors: assetErrors };
    }
    return { valid: true, data: candidate as CardData, errors: [] };
  }
  return { valid: false, errors: validate.errors ?? ['CardData validation failed.'] };
}

export function validateCardDataForSchema(
  data: unknown,
  cardType: CardType,
): ValidationResult<CardData> {
  return validateCardDataForSchemaWithMode(data, cardType, 'strict');
}

function validateCardDataWithMode(
  data: unknown,
  mode: 'strict' | 'runtime',
): ValidationResult<CardData> {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return { valid: false, errors: ['CardData.type must identify a supported card schema.'] };
  }

  if (!isCardType(data.type)) {
    return { valid: false, errors: [`Unsupported card type: ${data.type}`] };
  }

  return validateCardDataForSchemaWithMode(data, data.type, mode);
}

export function validateCardData(data: unknown): ValidationResult<CardData> {
  return validateCardDataWithMode(data, 'strict');
}

export function validateCardDataForRuntime(data: unknown): ValidationResult<CardData> {
  return validateCardDataWithMode(data, 'runtime');
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
