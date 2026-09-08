import {
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import type { CardJsonSchema, JsonSchemaType, JsonValue } from '../schema/types';

type PathPart = string | number;
type Path = PathPart[];
type ComparisonModuleType = 'metric' | 'text' | 'diff' | 'image' | 'entity';

interface SchemaFormProps {
  schema: CardJsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

interface SchemaFieldProps {
  name: string;
  schema: CardJsonSchema;
  value: unknown;
  path: Path;
  required: boolean;
  rootValue: JsonValue;
  onChange: (value: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasSchemaType(schema: CardJsonSchema, type: JsonSchemaType) {
  return Array.isArray(schema.type) ? schema.type.includes(type) : schema.type === type;
}

function valueAtPath(rootValue: JsonValue, path: Path): JsonValue | undefined {
  let current: JsonValue | undefined = rootValue;
  for (const part of path) {
    if (typeof part === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
    } else {
      if (!isRecord(current)) {
        return undefined;
      }
      current = current[part];
    }
  }
  return current;
}

function isComparisonModuleType(value: unknown): value is ComparisonModuleType {
  return (
    value === 'metric' ||
    value === 'text' ||
    value === 'diff' ||
    value === 'image' ||
    value === 'entity'
  );
}

function comparisonModuleTypeAtPath(
  rootValue: JsonValue,
  path: Path,
): ComparisonModuleType | undefined {
  for (let index = path.length; index >= 0; index -= 1) {
    const candidate = valueAtPath(rootValue, path.slice(0, index));
    if (isRecord(candidate) && isComparisonModuleType(candidate.type)) {
      return candidate.type;
    }
  }
  return undefined;
}

function visibleObjectProperties(
  schema: CardJsonSchema,
  value: unknown,
  path: Path,
  rootValue: JsonValue,
) {
  const properties = Object.entries(schema.properties ?? {});
  const objectType = isRecord(value) && isComparisonModuleType(value.type) ? value.type : undefined;
  if (objectType) {
    const moduleFields: Record<ComparisonModuleType, string[]> = {
      metric: ['type', 'name', 'items'],
      text: ['type', 'name', 'before', 'after'],
      diff: ['type', 'name', 'before', 'after'],
      image: ['type', 'name', 'before', 'after'],
      entity: ['type', 'name', 'items'],
    };
    const fields = new Set(moduleFields[objectType]);
    return properties.filter(([name]) => fields.has(name));
  }

  const moduleType = comparisonModuleTypeAtPath(rootValue, path);
  const isModuleItem = path[path.length - 2] === 'items';
  if (isModuleItem && moduleType === 'metric') {
    return properties.filter(([name]) => ['label', 'before', 'after'].includes(name));
  }
  if (isModuleItem && moduleType === 'entity') {
    return properties.filter(([name]) =>
      ['name', 'handle', 'bio', 'action', 'color'].includes(name),
    );
  }
  return properties;
}

function resolveSchemaForValue(
  schema: CardJsonSchema,
  value: unknown,
  rootValue: JsonValue,
  path: Path,
): CardJsonSchema {
  if (
    !Array.isArray(schema.type) ||
    !schema.type.includes('object') ||
    !schema.type.includes('string')
  ) {
    return schema;
  }

  const parent = valueAtPath(rootValue, path.slice(0, -1));
  const parentType = isRecord(parent) && typeof parent.type === 'string' ? parent.type : undefined;
  const useArrayEditor = Array.isArray(value);
  const useObjectEditor =
    !useArrayEditor &&
    (parentType === 'image' ||
      (typeof value === 'object' && value !== null && !Array.isArray(value)));
  return {
    ...schema,
    type: useArrayEditor ? 'array' : useObjectEditor ? 'object' : 'string',
  };
}

function createDefaultValue(schema: CardJsonSchema): JsonValue {
  if (schema.const !== undefined) {
    return cloneJson(schema.const);
  }

  if (schema.default !== undefined) {
    return cloneJson(schema.default);
  }

  if (hasSchemaType(schema, 'object')) {
    const object: Record<string, JsonValue> = {};
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (schema.required?.includes(key)) {
        object[key] = createDefaultValue(propertySchema);
      }
    }
    return object;
  }
  if (hasSchemaType(schema, 'array')) {
    return [];
  }
  if (hasSchemaType(schema, 'boolean')) {
    return false;
  }
  if (hasSchemaType(schema, 'number') || hasSchemaType(schema, 'integer')) {
    return 0;
  }
  if (hasSchemaType(schema, 'string')) {
    return schema.enum?.[0] ?? '';
  }
  return '';
}

function setValueAtPath(root: JsonValue, path: Path, value: JsonValue): JsonValue {
  const next = cloneJson(root);
  if (path.length === 0) {
    return next;
  }

  let cursor: JsonValue = next;
  path.slice(0, -1).forEach((part) => {
    if (typeof part === 'number') {
      if (!Array.isArray(cursor)) {
        throw new Error('Cannot set a numeric path segment on a non-array value.');
      }
      cursor = cursor[part] ?? {};
      return;
    }

    if (!isRecord(cursor)) {
      throw new Error('Cannot set a property path segment on a non-object value.');
    }
    cursor[part] ??= {};
    cursor = cursor[part];
  });

  const last = path[path.length - 1];
  if (typeof last === 'number') {
    if (!Array.isArray(cursor)) {
      throw new Error('Cannot set an array item on a non-array value.');
    }
    cursor[last] = value;
  } else {
    if (!isRecord(cursor)) {
      throw new Error('Cannot set an object property on a non-object value.');
    }
    cursor[last] = value;
  }
  return next;
}

function deleteValueAtPath(root: JsonValue, path: Path): JsonValue {
  const next = cloneJson(root);
  if (path.length === 0) {
    return next;
  }

  let cursor: JsonValue = next;
  for (const part of path.slice(0, -1)) {
    if (typeof part === 'number') {
      if (!Array.isArray(cursor) || cursor[part] === undefined) {
        return next;
      }
      cursor = cursor[part];
    } else {
      if (!isRecord(cursor) || cursor[part] === undefined) {
        return next;
      }
      cursor = cursor[part];
    }
  }

  const last = path[path.length - 1];
  if (typeof last === 'number' && Array.isArray(cursor)) {
    cursor.splice(last, 1);
  } else if (typeof last === 'string' && isRecord(cursor)) {
    delete cursor[last];
  }
  return next;
}

function updateField(
  rootValue: JsonValue,
  path: Path,
  nextValue: JsonValue,
  onChange: (value: unknown) => void,
) {
  onChange(setValueAtPath(rootValue, path, nextValue));
}

function removeField(rootValue: JsonValue, path: Path, onChange: (value: unknown) => void) {
  onChange(deleteValueAtPath(rootValue, path));
}

function moveArrayItem(
  rootValue: JsonValue,
  path: Path,
  index: number,
  offset: number,
  onChange: (value: unknown) => void,
) {
  let current: JsonValue = rootValue;
  for (const part of path) {
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return;
      current = current[part];
    } else {
      if (!isRecord(current)) return;
      current = current[part];
    }
    if (current === undefined) return;
  }
  if (!Array.isArray(current)) return;

  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= current.length) return;
  const nextItems = cloneJson(current);
  [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
  updateField(rootValue, path, nextItems, onChange);
}

function FieldHeading({
  label,
  required,
  onRemove,
}: {
  label: string;
  required: boolean;
  onRemove?: () => void;
}) {
  return (
    <Group justify="space-between" align="center" gap="xs">
      <Text size="sm" fw={600}>
        {label}
        {!required && (
          <Text span c="dimmed" fw={400}>
            {' '}
            (可选)
          </Text>
        )}
      </Text>
      {!required && onRemove && (
        <Button type="button" size="compact-xs" variant="subtle" color="gray" onClick={onRemove}>
          移除
        </Button>
      )}
    </Group>
  );
}

function PrimitiveField({
  name,
  schema,
  value,
  path,
  required,
  rootValue,
  onChange,
}: SchemaFieldProps) {
  const label = schema.title ?? name;
  const remove = required ? undefined : () => removeField(rootValue, path, onChange);
  const update = (nextValue: JsonValue) => updateField(rootValue, path, nextValue, onChange);

  if (schema.const !== undefined) {
    return (
      <Stack gap={4}>
        <FieldHeading label={label} required={required} onRemove={remove} />
        <TextInput value={String(schema.const)} readOnly disabled />
      </Stack>
    );
  }

  if (schema.enum) {
    const options = schema.enum.map((option) => ({ value: String(option), label: String(option) }));
    return (
      <Stack gap={4}>
        <FieldHeading label={label} required={required} onRemove={remove} />
        <Select
          value={value === undefined ? null : String(value)}
          data={options}
          onChange={(nextValue) => update(nextValue ?? '')}
          allowDeselect={false}
        />
      </Stack>
    );
  }

  if (hasSchemaType(schema, 'boolean')) {
    return (
      <Group justify="space-between" align="center">
        <FieldHeading label={label} required={required} onRemove={remove} />
        <Switch
          checked={value === true}
          onChange={(event) => update(event.currentTarget.checked)}
        />
      </Group>
    );
  }

  if (
    (hasSchemaType(schema, 'number') || hasSchemaType(schema, 'integer')) &&
    !hasSchemaType(schema, 'string')
  ) {
    return (
      <Stack gap={4}>
        <FieldHeading label={label} required={required} onRemove={remove} />
        <NumberInput
          value={typeof value === 'number' ? value : ''}
          min={schema.minimum}
          onChange={(nextValue) => {
            if (nextValue === '') {
              if (!required) {
                removeField(rootValue, path, onChange);
              }
              return;
            }
            update(Number(nextValue));
          }}
        />
      </Stack>
    );
  }

  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return (
    <Stack gap={4}>
      <FieldHeading label={label} required={required} onRemove={remove} />
      {schema['x-forma-widget'] === 'textarea' ? (
        <Textarea
          value={stringValue}
          minRows={3}
          onChange={(event) => update(event.currentTarget.value)}
        />
      ) : (
        <TextInput value={stringValue} onChange={(event) => update(event.currentTarget.value)} />
      )}
    </Stack>
  );
}

function ObjectField({
  name,
  schema,
  value,
  path,
  required,
  rootValue,
  onChange,
}: SchemaFieldProps) {
  const label = schema.title ?? name;
  if (!required && (value === undefined || value === null)) {
    return (
      <Button
        type="button"
        variant="light"
        size="compact-sm"
        onClick={() => updateField(rootValue, path, createDefaultValue(schema), onChange)}
      >
        启用 {label}
      </Button>
    );
  }

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="sm">
        <FieldHeading
          label={label}
          required={required}
          onRemove={required ? undefined : () => removeField(rootValue, path, onChange)}
        />
        {schema.description && (
          <Text size="xs" c="dimmed">
            {schema.description}
          </Text>
        )}
        <ObjectFields
          schema={schema}
          value={value}
          path={path}
          rootValue={rootValue}
          onChange={onChange}
        />
      </Stack>
    </Paper>
  );
}

function ArrayField({
  name,
  schema,
  value,
  path,
  required,
  rootValue,
  onChange,
}: SchemaFieldProps) {
  const label = schema.title ?? name;
  if (!required && (value === undefined || value === null)) {
    return (
      <Button
        type="button"
        variant="light"
        size="compact-sm"
        onClick={() => updateField(rootValue, path, createDefaultValue(schema), onChange)}
      >
        启用 {label}
      </Button>
    );
  }

  const items = Array.isArray(value) ? value : [];
  const itemSchema = schema.items ?? { type: 'string', title: '项目' };
  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="sm">
        <FieldHeading
          label={label}
          required={required}
          onRemove={required ? undefined : () => removeField(rootValue, path, onChange)}
        />
        {items.map((item, index) => (
          <Paper key={`${path.join('.')}-${index}`} withBorder p="sm" radius="sm" bg="gray.0">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="xs" fw={600} c="dimmed">
                  项目 {index + 1}
                </Text>
                <Group gap={4}>
                  <Button
                    type="button"
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    disabled={index === 0}
                    onClick={() => moveArrayItem(rootValue, path, index, -1, onChange)}
                  >
                    上移
                  </Button>
                  <Button
                    type="button"
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    disabled={index === items.length - 1}
                    onClick={() => moveArrayItem(rootValue, path, index, 1, onChange)}
                  >
                    下移
                  </Button>
                  <Button
                    type="button"
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => removeField(rootValue, [...path, index], onChange)}
                  >
                    删除
                  </Button>
                </Group>
              </Group>
              <SchemaField
                name={`项目 ${index + 1}`}
                schema={itemSchema}
                value={item}
                path={[...path, index]}
                required
                rootValue={rootValue}
                onChange={onChange}
              />
            </Stack>
          </Paper>
        ))}
        <Button
          type="button"
          variant="default"
          size="compact-sm"
          onClick={() =>
            updateField(rootValue, path, [...items, createDefaultValue(itemSchema)], onChange)
          }
        >
          添加项目
        </Button>
      </Stack>
    </Paper>
  );
}

function SchemaField(props: SchemaFieldProps) {
  const schema = resolveSchemaForValue(props.schema, props.value, props.rootValue, props.path);
  const resolvedProps = { ...props, schema };

  if (hasSchemaType(schema, 'object')) {
    return <ObjectField {...resolvedProps} />;
  }
  if (hasSchemaType(schema, 'array')) {
    return <ArrayField {...resolvedProps} />;
  }

  if (!props.required && (props.value === undefined || props.value === null)) {
    const label = schema.title ?? props.name;
    return (
      <Button
        type="button"
        variant="light"
        size="compact-sm"
        onClick={() =>
          updateField(props.rootValue, props.path, createDefaultValue(schema), props.onChange)
        }
      >
        添加 {label}
      </Button>
    );
  }

  return <PrimitiveField {...resolvedProps} />;
}

function ObjectFields({
  schema,
  value,
  path,
  rootValue,
  onChange,
}: {
  schema: CardJsonSchema;
  value: unknown;
  path: Path;
  rootValue: JsonValue;
  onChange: (value: unknown) => void;
}) {
  const objectValue = isRecord(value) ? value : {};
  const properties = visibleObjectProperties(schema, value, path, rootValue);
  return (
    <Stack gap="sm">
      {properties.map(([name, childSchema]) => (
        <SchemaField
          key={[...path, name].join('.')}
          name={name}
          schema={childSchema}
          value={objectValue[name]}
          path={[...path, name]}
          required={schema.required?.includes(name) ?? false}
          rootValue={rootValue}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
}

export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  if (schema.type !== 'object') {
    return null;
  }

  const rootValue = (isRecord(value) ? value : {}) as JsonValue;
  return (
    <ObjectFields
      schema={schema}
      value={rootValue}
      path={[]}
      rootValue={rootValue}
      onChange={onChange}
    />
  );
}
