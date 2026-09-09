import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import prettier from 'prettier';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardsRoot = path.join(projectRoot, 'cards');
const generatedRoot = path.join(projectRoot, 'src', 'generated');
const renderOptionsSchemaPath = path.join(projectRoot, 'src', 'schema', 'render-options.json');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFixtureNames(left, right) {
  const priority = { default: 0, minimal: 1 };
  const leftPriority = priority[path.basename(left, '.json')];
  const rightPriority = priority[path.basename(right, '.json')];
  if (leftPriority !== undefined || rightPriority !== undefined) {
    return (leftPriority ?? 2) - (rightPriority ?? 2);
  }
  return compareNames(left, right);
}

async function writeOrCheck(filePath, content, checkOnly) {
  const prettierConfig = (await prettier.resolveConfig(filePath)) ?? {};
  const formattedContent = await prettier.format(content, {
    ...prettierConfig,
    filepath: filePath,
  });
  if (checkOnly) {
    if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== formattedContent) {
      throw new Error(`Generated file is out of date: ${path.relative(projectRoot, filePath)}`);
    }
    return;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath) && readFileSync(filePath, 'utf8') === formattedContent) {
    return;
  }
  writeFileSync(filePath, formattedContent);
}

function pascalCase(value) {
  const result = value
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');
  return /^[0-9]/u.test(result) ? `Card${result}` : result || 'Card';
}

function identifier(value) {
  return value.replace(/[^a-zA-Z0-9_$]/gu, '_');
}

function jsonLiteral(value) {
  return JSON.stringify(value);
}

function propertyName(name) {
  return /^[a-zA-Z_$][\w$]*$/u.test(name) ? name : JSON.stringify(name);
}

function schemaType(schema) {
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    return jsonLiteral(schema.const);
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => jsonLiteral(value)).join(' | ');
  }

  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => schemaType({ ...schema, type })).join(' | ');
  }

  switch (schema.type) {
    case 'object': {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const fields = Object.entries(properties).map(
        ([name, propertySchema]) =>
          `${propertyName(name)}${required.has(name) ? '' : '?'}: ${schemaType(propertySchema)};`,
      );
      return fields.length ? `{ ${fields.join(' ')} }` : 'Record<string, never>';
    }
    case 'array':
      return schema.items ? `Array<${schemaType(schema.items)}>` : 'Array<unknown>';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'string':
      return 'string';
    default:
      return 'unknown';
  }
}

function composeCardSchema(schema, renderOptionsSchema) {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      options: renderOptionsSchema,
    },
  };
}

function validateRenderOptionsSchema(schema) {
  if (
    schema.type !== 'object' ||
    schema.additionalProperties !== false ||
    !schema.properties?.theme ||
    !schema.properties?.watermark ||
    !schema.properties?.assetBaseUrl
  ) {
    throw new Error(
      'src/schema/render-options.json must define an object with theme, watermark, and assetBaseUrl properties.',
    );
  }
  if (
    schema.properties.theme.type !== 'string' ||
    !Array.isArray(schema.properties.theme.enum) ||
    !schema.properties.theme.enum.length
  ) {
    throw new Error('Render options theme must define a non-empty string enum.');
  }
}

function formatValidationErrors(errors) {
  return (errors ?? [])
    .map((error) => {
      const pathText = error.instancePath || 'CardData';
      if (error.keyword === 'required') {
        return `${pathText}.${error.params.missingProperty} is required`;
      }
      return `${pathText} ${error.message ?? 'is invalid'}`;
    })
    .join('; ');
}

function fixtureLabel(id) {
  return id
    .split(/[-_]+/u)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function fixtureDescription(id) {
  return `${fixtureLabel(id)} fixture scenario.`;
}

function collectFields(schema, prefix = '', fields = []) {
  const properties = (schema.properties ?? {}) as Record<
    string,
    {
      type?: string | string[];
      items?: { type?: string | string[] };
    }
  >;
  for (const [name, childSchema] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${name}` : name;
    const required = (schema.required ?? []).includes(name);
    fields.push({ path: fieldPath, schema: childSchema, required });
    const isObject =
      childSchema.type === 'object' ||
      (Array.isArray(childSchema.type) && childSchema.type.includes('object'));
    const isArray =
      childSchema.type === 'array' ||
      (Array.isArray(childSchema.type) && childSchema.type.includes('array'));
    const itemIsObject =
      childSchema.items?.type === 'object' ||
      (Array.isArray(childSchema.items?.type) && childSchema.items.type.includes('object'));
    if (isObject) {
      collectFields(childSchema, fieldPath, fields);
    }
    if (isArray && itemIsObject) {
      collectFields(childSchema.items, `${fieldPath}[]`, fields);
    }
  }
  return fields;
}

function tableCell(value) {
  return String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function generateCardReadme(entry) {
  const version = entry.schema.properties?.schemaVersion?.const ?? '1';
  const fields = collectFields(entry.composedSchema);
  const rows = fields
    .map((field) => {
      const fieldSchema = field.schema;
      const type = fieldSchema.const !== undefined ? 'const' : (fieldSchema.type ?? 'unknown');
      const enumText = Array.isArray(fieldSchema.enum)
        ? fieldSchema.enum.map((value) => `\`${value}\``).join(', ')
        : '—';
      const defaultText =
        fieldSchema.default === undefined ? '—' : `\`${JSON.stringify(fieldSchema.default)}\``;
      return `| \`${tableCell(field.path)}\` | ${tableCell(type)} | ${field.required ? 'Required' : 'Optional'} | ${enumText} | ${defaultText} | ${tableCell(fieldSchema.description)} |`;
    })
    .join('\n');
  const fixtureLinks = entry.fixtures
    .map((fixture) => `- [${fixtureLabel(fixture.id)}](./fixtures/${fixture.id}.json)`)
    .join('\n');

  return `<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->
# ${entry.schema.title}

- Card type: \`${entry.type}\`
- Schema version: \`${version}\`
- Description: ${entry.schema.description ?? '—'}

## Fields

| Path | Type | Required | Enum | Default | Description |
| --- | --- | --- | --- | --- | --- |
${rows}

## Minimal valid example

\`\`\`json
${JSON.stringify(entry.minimalFixture.data, null, 2)}
\`\`\`

## Fixtures

${fixtureLinks}

The card content schema and fixture files in this directory are the source of truth for Card-specific fields. Shared render options are defined in \`src/schema/render-options.json\` and composed into the complete contract during generation.
`;
}

function generateTypes(entries, renderOptionsSchema) {
  const themeType = schemaType(renderOptionsSchema.properties.theme);
  const renderOptionsRequired = new Set(renderOptionsSchema.required ?? []);
  const renderOptionsFields = Object.entries(renderOptionsSchema.properties ?? {})
    .map(
      ([name, schema]) =>
        `  ${propertyName(name)}${renderOptionsRequired.has(name) ? '' : '?'}: ${name === 'theme' ? 'CardTheme' : schemaType(schema)};`,
    )
    .join('\n');
  const interfaces = entries
    .map((entry) => {
      const interfaceName = `${pascalCase(entry.type)}CardData`;
      const contentInterfaceName = `${pascalCase(entry.type)}CardContent`;
      const fullProperties = entry.composedSchema.properties ?? {};
      const contentProperties = entry.schema.properties ?? {};
      const fullRequired = new Set(entry.composedSchema.required ?? []);
      const contentRequired = new Set(entry.schema.required ?? []);
      const fullFields = Object.entries(fullProperties)
        .map(
          ([name, schema]) =>
            `  ${propertyName(name)}${fullRequired.has(name) ? '' : '?'}: ${name === 'options' ? 'RenderOptions' : schemaType(schema)};`,
        )
        .join('\n');
      const contentFields = Object.entries(contentProperties)
        .map(
          ([name, schema]) =>
            `  ${propertyName(name)}${contentRequired.has(name) ? '' : '?'}: ${schemaType(schema)};`,
        )
        .join('\n');
      return `export interface ${interfaceName} {\n${fullFields}\n}\n\nexport interface ${contentInterfaceName} {\n${contentFields}\n}`;
    })
    .join('\n\n');
  const mapFields = entries
    .map((entry) => `  ${propertyName(entry.type)}: ${pascalCase(entry.type)}CardData;`)
    .join('\n');
  const contentMapFields = entries
    .map((entry) => `  ${propertyName(entry.type)}: ${pascalCase(entry.type)}CardContent;`)
    .join('\n');

  return `/* AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. */

export type CardTheme = ${themeType};

export type RenderOptions = {
${renderOptionsFields}
};

${interfaces}

export interface CardTypeMap {
${mapFields}
}

export interface CardContentTypeMap {
${contentMapFields}
}

export type CardType = keyof CardTypeMap;
export type CardData = CardTypeMap[CardType];
export type CardContentData = CardContentTypeMap[CardType];
export type CardProps<TCardType extends CardType = CardType> = {
  data: CardContentTypeMap[TCardType];
};
`;
}

function generateRegistry(entries) {
  const imports = entries
    .flatMap((entry) => {
      const variable = identifier(entry.type);
      const componentName = `${pascalCase(entry.type)}Card`;
      return [
        `import ${componentName} from '../../cards/${entry.directory}/Card';`,
        `import ${variable}Schema from '../../cards/${entry.directory}/schema.json';`,
        ...entry.fixtures.map(
          (fixture) =>
            `import ${variable}${pascalCase(fixture.id)}Fixture from '../../cards/${entry.directory}/fixtures/${fixture.id}.json';`,
        ),
      ];
    })
    .join('\n');
  const composedSchemaConstants = entries
    .map((entry) => {
      const variable = identifier(entry.type);
      return `const ${variable}ComposedSchema = {
  ...${variable}Schema,
  properties: {
    ...${variable}Schema.properties,
    options: renderOptionsSchema,
  },
};`;
    })
    .join('\n\n');
  const fixtureConstants = entries
    .map((entry) => {
      const variable = identifier(entry.type);
      const typeName = `CardTypeMap['${entry.type}']`;
      const fixtures = entry.fixtures
        .map(
          (fixture) => `  {
    id: ${JSON.stringify(fixture.id)},
    label: ${JSON.stringify(fixtureLabel(fixture.id))},
    description: ${JSON.stringify(fixtureDescription(fixture.id))},
    data: ${variable}${pascalCase(fixture.id)}Fixture as unknown as ${typeName},
  }`,
        )
        .join(',\n');
      return `const ${variable}Fixtures: FixtureDefinition<${typeName}>[] = [\n${fixtures}\n];`;
    })
    .join('\n\n');
  const registry = entries
    .map((entry) => {
      const variable = identifier(entry.type);
      const componentName = `${pascalCase(entry.type)}Card`;
      const typeName = `CardTypeMap['${entry.type}']`;
      return `  ${propertyName(entry.type)}: {
    id: ${JSON.stringify(entry.type)},
    title: ${JSON.stringify(entry.schema.title)},
    description: ${JSON.stringify(entry.schema.description ?? '')},
    jsonSchema: ${variable}ComposedSchema as CardJsonSchema,
    contentSchema: ${variable}Schema as CardJsonSchema,
    defaultData: ${variable}DefaultFixture as unknown as ${typeName},
    fixtures: ${variable}Fixtures,
    component: ${componentName} as unknown as CardComponent,
  }`;
    })
    .join(',\n');

  return `/* AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. */

import type { CardComponent, CardJsonSchema, CardRegistryEntry, FixtureDefinition } from '../schema/types';
import type { CardType, CardTypeMap } from './types';
import renderOptionsSchema from '../../src/schema/render-options.json';
${imports}

export const RENDER_OPTIONS_SCHEMA = renderOptionsSchema as CardJsonSchema;

${composedSchemaConstants}

${fixtureConstants}

export const CARD_REGISTRY = {
${registry}
} satisfies Record<CardType, CardRegistryEntry>;

export const CARD_TYPES: CardType[] = Object.keys(CARD_REGISTRY) as CardType[];
export const DEFAULT_CARD_DATA = CARD_REGISTRY[CARD_TYPES[0]].defaultData;
`;
}

function generateContract(entries, renderOptionsSchema) {
  const version = entries[0]?.schema.properties?.schemaVersion?.const ?? '1';
  const optionRows = collectFields(renderOptionsSchema, 'options')
    .map((field) => {
      const fieldSchema = field.schema;
      const type = fieldSchema.const !== undefined ? 'const' : (fieldSchema.type ?? 'unknown');
      const enumText = Array.isArray(fieldSchema.enum)
        ? fieldSchema.enum.map((value) => `\`${value}\``).join(', ')
        : '—';
      const defaultText =
        fieldSchema.default === undefined ? '—' : `\`${JSON.stringify(fieldSchema.default)}\``;
      return `| \`${tableCell(field.path)}\` | ${tableCell(type)} | ${field.required ? 'Required' : 'Optional'} | ${enumText} | ${defaultText} | ${tableCell(fieldSchema.description)} |`;
    })
    .join('\n');
  const cards = entries
    .map((entry) => `- [${entry.schema.title}](./cards/${entry.directory}/README.md)`)
    .join('\n');
  return `<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->
# Forma Contract

Schema Version: \`${version}\`

## Shared Render Options

All Cards accept the optional \`options\` object. The omitted theme defaults to \`light\`; a missing, empty, or whitespace-only watermark is not rendered; \`assetBaseUrl\` resolves relative image and media URLs.

| Path | Type | Required | Enum | Default | Description |
| --- | --- | --- | --- | --- | --- |
${optionRows}

## Cards

${cards}
`;
}

function inspectCards(renderOptionsSchema) {
  if (!existsSync(cardsRoot)) {
    throw new Error('The cards/ directory does not exist.');
  }
  const directories = readdirSync(cardsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((left, right) => compareNames(left.name, right.name));
  if (!directories.length) {
    throw new Error('At least one Card directory is required.');
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const types = new Set();
  const entries = [];

  for (const directory of directories) {
    const directoryPath = path.join(cardsRoot, directory.name);
    const schemaPath = path.join(directoryPath, 'schema.json');
    const componentPath = path.join(directoryPath, 'Card.tsx');
    const fixturesPath = path.join(directoryPath, 'fixtures');
    if (!existsSync(schemaPath) || !existsSync(componentPath) || !existsSync(fixturesPath)) {
      throw new Error(`${directory.name} must contain schema.json, Card.tsx, and fixtures/.`);
    }

    const schema = readJson(schemaPath);
    const type = schema.properties?.type?.const;
    if (directory.name !== type) {
      throw new Error(
        `Card directory ${directory.name} must match schema type ${type ?? '(missing)'}.`,
      );
    }
    if (types.has(type)) {
      throw new Error(`Card type ${type} is duplicated.`);
    }
    types.add(type);
    if (schema.$id !== `forma:card:${type}`) {
      throw new Error(`${type} schema $id must be forma:card:${type}.`);
    }
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      throw new Error(`${type} must use JSON Schema Draft 2020-12.`);
    }
    if (schema.properties?.schemaVersion?.const !== '1') {
      throw new Error(`${type} must define schemaVersion const "1".`);
    }
    for (const reservedProperty of ['options', 'theme', 'watermark']) {
      if (Object.prototype.hasOwnProperty.call(schema.properties ?? {}, reservedProperty)) {
        throw new Error(`${type} must not define reserved public property ${reservedProperty}.`);
      }
    }
    if (
      !(schema.required ?? []).includes('schemaVersion') ||
      !(schema.required ?? []).includes('type')
    ) {
      throw new Error(`${type} must require schemaVersion and type.`);
    }
    if (
      !existsSync(componentPath) ||
      !/export\s+default\s+(?:function|class|const)/u.test(readFileSync(componentPath, 'utf8'))
    ) {
      throw new Error(`${type}/Card.tsx must provide a default export.`);
    }

    const composedSchema = composeCardSchema(schema, renderOptionsSchema);
    const validate = ajv.compile(composedSchema);
    const fixtureFiles = readdirSync(fixturesPath)
      .filter((fileName) => fileName.endsWith('.json'))
      .sort(compareFixtureNames);
    const fixtureIds = new Set(fixtureFiles.map((fileName) => path.basename(fileName, '.json')));
    for (const requiredFixture of ['default', 'minimal']) {
      if (!fixtureIds.has(requiredFixture)) {
        throw new Error(`${type} must provide fixtures/${requiredFixture}.json.`);
      }
    }
    const fixtures = fixtureFiles.map((fileName) => {
      const id = path.basename(fileName, '.json');
      const data = readJson(path.join(fixturesPath, fileName));
      if (!validate(data)) {
        throw new Error(
          `${type}/fixtures/${fileName} is invalid: ${formatValidationErrors(validate.errors)}`,
        );
      }
      return { id, data };
    });
    const minimalFixture = fixtures.find((fixture) => fixture.id === 'minimal');
    entries.push({
      directory: directory.name,
      type,
      schema,
      composedSchema,
      fixtures,
      minimalFixture,
    });
  }
  return entries;
}

async function main() {
  const renderOptionsSchema = readJson(renderOptionsSchemaPath);
  validateRenderOptionsSchema(renderOptionsSchema);
  const entries = inspectCards(renderOptionsSchema);
  const checkOnly = process.argv.includes('--check');
  await writeOrCheck(
    path.join(generatedRoot, 'types.ts'),
    generateTypes(entries, renderOptionsSchema),
    checkOnly,
  );
  await writeOrCheck(path.join(generatedRoot, 'registry.ts'), generateRegistry(entries), checkOnly);
  for (const entry of entries) {
    await writeOrCheck(
      path.join(cardsRoot, entry.directory, 'README.md'),
      generateCardReadme(entry),
      checkOnly,
    );
  }
  await writeOrCheck(
    path.join(projectRoot, 'CONTRACT.md'),
    generateContract(entries, renderOptionsSchema),
    checkOnly,
  );
  console.log(
    `${checkOnly ? 'Checked' : 'Generated'} Forma contract for ${entries.length} Card(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
