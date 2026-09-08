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
import type { CardJsonSchema, JsonValue } from '../schema/types';

type PathPart = string | number;
type Path = PathPart[];

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

function createDefaultValue(schema: CardJsonSchema): JsonValue {
  if (schema.const !== undefined) {
    return cloneJson(schema.const);
  }

  if (schema.default !== undefined) {
    return cloneJson(schema.default);
  }

  switch (schema.type) {
    case 'object': {
      const object: Record<string, JsonValue> = {};
      for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
        if (schema.required?.includes(key)) {
          object[key] = createDefaultValue(propertySchema);
        }
      }
      return object;
    }
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'number':
    case 'integer':
      return 0;
    case 'string':
      return schema.enum?.[0] ?? '';
    default:
      return '';
  }
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

  if (schema.type === 'boolean') {
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

  if (schema.type === 'number' || schema.type === 'integer') {
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

  const stringValue = typeof value === 'string' ? value : '';
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
  if (props.schema.type === 'object') {
    return <ObjectField {...props} />;
  }
  if (props.schema.type === 'array') {
    return <ArrayField {...props} />;
  }

  if (!props.required && (props.value === undefined || props.value === null)) {
    const label = props.schema.title ?? props.name;
    return (
      <Button
        type="button"
        variant="light"
        size="compact-sm"
        onClick={() =>
          updateField(props.rootValue, props.path, createDefaultValue(props.schema), props.onChange)
        }
      >
        添加 {label}
      </Button>
    );
  }

  return <PrimitiveField {...props} />;
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
  return (
    <Stack gap="sm">
      {Object.entries(schema.properties ?? {}).map(([name, childSchema]) => (
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
