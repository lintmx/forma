import '@mantine/core/styles.css';
import '../styles/dev.css';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  MantineProvider,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { CARD_SCHEMAS, CARD_TYPES, RENDER_OPTIONS_SCHEMA } from '../schema/definitions';
import { formatValidationErrors, validateCardData } from '../schema/validation';
import type { CardData, CardType } from '../types/card';
import { cloneCardData } from '../fixtures';
import { FormaRenderer } from '../renderer/FormaRenderer';
import { SchemaForm } from './SchemaForm';

type EditorMode = 'form' | 'json';

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const initialCardType = CARD_TYPES[0];

export function DevPage() {
  const [schemaId, setSchemaId] = useState<CardType>(initialCardType);
  const [fixtureId, setFixtureId] = useState('default');
  const [data, setData] = useState(() => cloneCardData(CARD_SCHEMAS[initialCardType].defaultData));
  const [jsonText, setJsonText] = useState(() => formatJson(data));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('form');
  const [copied, setCopied] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  const schema = CARD_SCHEMAS[schemaId];
  const fixtureOptions = useMemo(
    () => schema.fixtures.map((fixture) => ({ value: fixture.id, label: fixture.label })),
    [schema],
  );

  useEffect(() => {
    if (!isPreviewFullscreen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPreviewFullscreen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewFullscreen]);

  function updateData(nextData: unknown) {
    const nextCardData = cloneCardData(nextData as Parameters<typeof cloneCardData>[0]);
    setData(nextCardData);
    setJsonText(formatJson(nextCardData));
    setJsonError(null);
  }

  function updateRenderOptions(nextOptions: unknown) {
    const nextData = { ...data } as CardData;
    if (
      typeof nextOptions === 'object' &&
      nextOptions !== null &&
      !Array.isArray(nextOptions) &&
      Object.keys(nextOptions).length > 0
    ) {
      nextData.options = nextOptions as CardData['options'];
    } else {
      delete nextData.options;
    }
    updateData(nextData);
  }

  function handleSchemaChange(nextSchemaId: string | null) {
    if (!nextSchemaId || !(nextSchemaId in CARD_SCHEMAS)) {
      return;
    }
    const nextId = nextSchemaId as CardType;
    const nextSchema = CARD_SCHEMAS[nextId];
    setSchemaId(nextId);
    setFixtureId(nextSchema.fixtures[0]?.id ?? 'default');
    updateData(nextSchema.defaultData);
  }

  function handleFixtureChange(nextFixtureId: string | null) {
    if (!nextFixtureId) {
      return;
    }
    const fixture = schema.fixtures.find((item) => item.id === nextFixtureId);
    if (!fixture) {
      return;
    }
    setFixtureId(nextFixtureId);
    updateData(fixture.data);
  }

  function handleJsonChange(nextText: string) {
    setJsonText(nextText);
    try {
      const parsed: unknown = JSON.parse(nextText);
      const validation = validateCardData(parsed);
      if (!validation.valid) {
        setJsonError(formatValidationErrors(validation.errors));
        return;
      }

      const nextSchemaId = validation.data.type;
      if (nextSchemaId !== schemaId) {
        const nextSchema = CARD_SCHEMAS[nextSchemaId];
        setSchemaId(nextSchemaId);
        setFixtureId(nextSchema.fixtures[0]?.id ?? 'default');
      }
      setData(cloneCardData(validation.data));
      setJsonError(null);
    } catch (error) {
      setJsonError(`JSON 解析失败：${error instanceof Error ? error.message : '格式无效'}`);
    }
  }

  function handleReset() {
    updateData(schema.defaultData);
    setFixtureId('default');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setJsonError('复制失败，请检查浏览器剪贴板权限。');
    }
  }

  return (
    <MantineProvider defaultColorScheme="light">
      <div
        className={`dev-page${isPreviewFullscreen ? ' dev-page--preview-fullscreen' : ''}`}
        data-preview-theme={data.options?.theme ?? 'light'}
      >
        <header className="dev-header">
          <div>
            <Group gap="sm" align="center">
              <Title order={2}>Forma Playground</Title>
              <Badge variant="light">开发调试</Badge>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Schema、Fixture 与正式 Renderer 使用同一份 CardData 和渲染组件。
            </Text>
          </div>
          <Group gap="xs">
            <Button variant="default" onClick={handleReset}>
              Reset
            </Button>
            <Button onClick={handleCopy}>{copied ? 'Copied' : 'Copy JSON'}</Button>
          </Group>
        </header>

        <main className="dev-layout">
          <Paper className="dev-editor" withBorder shadow="sm" p="md">
            <Stack gap="md">
              <Group grow align="end">
                <Select
                  label="Card Schema"
                  value={schemaId}
                  data={CARD_TYPES.map((type) => ({
                    value: type,
                    label: CARD_SCHEMAS[type].title,
                  }))}
                  onChange={handleSchemaChange}
                  allowDeselect={false}
                />
                <Select
                  label="Fixture / Preset"
                  value={fixtureId}
                  data={fixtureOptions}
                  onChange={handleFixtureChange}
                  allowDeselect={false}
                />
              </Group>
              <Text size="sm" c="dimmed">
                {schema.description}
              </Text>
              <Tabs value={mode} onChange={(value) => value && setMode(value as EditorMode)}>
                <Tabs.List>
                  <Tabs.Tab value="form">Form</Tabs.Tab>
                  <Tabs.Tab value="json">JSON</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="form" pt="md">
                  <SimpleGrid cols={1} spacing="md">
                    <Paper withBorder p="sm" radius="md">
                      <Stack gap="sm">
                        <div>
                          <Title order={4}>公共渲染设置</Title>
                          <Text size="xs" c="dimmed" mt={4}>
                            主题、水印和资源基础地址适用于所有 Card，仅影响右侧 Preview。
                          </Text>
                        </div>
                        <SchemaForm
                          schema={RENDER_OPTIONS_SCHEMA}
                          value={data.options ?? {}}
                          onChange={updateRenderOptions}
                        />
                      </Stack>
                    </Paper>
                    <Paper withBorder p="sm" radius="md">
                      <Stack gap="sm">
                        <div>
                          <Title order={4}>卡片内容</Title>
                          <Text size="xs" c="dimmed" mt={4}>
                            当前 Card 的字段由其内容 Schema 驱动。
                          </Text>
                        </div>
                        <SchemaForm
                          schema={schema.contentSchema}
                          value={data}
                          onChange={updateData}
                        />
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                </Tabs.Panel>
                <Tabs.Panel value="json" pt="md">
                  <Textarea
                    aria-label="CardData JSON"
                    value={jsonText}
                    onChange={(event) => handleJsonChange(event.currentTarget.value)}
                    minRows={28}
                    autosize
                    styles={{
                      input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
                    }}
                    error={jsonError}
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    JSON 校验通过后才会更新右侧 Preview；输入不完整时保留上一次有效数据。
                  </Text>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Paper>

          <section className="dev-preview-panel">
            <Group className="dev-preview-toolbar" justify="space-between" mb="sm">
              <div>
                <Title order={3}>Preview</Title>
                <Text size="sm" c="dimmed">
                  {schema.title} · {fixtureId}
                </Text>
              </div>
              <Group gap="xs">
                <Badge color={jsonError ? 'red' : 'green'} variant="light">
                  {jsonError ? '上次有效数据' : 'CardData valid'}
                </Badge>
                {!isPreviewFullscreen && (
                  <Button
                    variant="default"
                    onClick={() => setIsPreviewFullscreen(true)}
                    aria-label="进入全屏预览"
                  >
                    全屏预览
                  </Button>
                )}
              </Group>
            </Group>
            <div className="dev-preview">
              <FormaRenderer data={data} />
            </div>
            {isPreviewFullscreen && (
              <Button
                className="dev-preview-exit"
                variant="default"
                onClick={() => setIsPreviewFullscreen(false)}
                aria-label="退出全屏预览"
                title="退出全屏预览"
              >
                退出
              </Button>
            )}
          </section>
        </main>
      </div>
    </MantineProvider>
  );
}
