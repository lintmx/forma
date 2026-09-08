import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardType = process.argv[2];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function pascalCase(value) {
  return value
    .split('_')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');
}

if (!cardType || !/^[a-z][a-z0-9_]*$/u.test(cardType)) {
  fail('Usage: pnpm card:create <type> (type must match ^[a-z][a-z0-9_]*$).');
} else {
  const cardDirectory = path.join(projectRoot, 'cards', cardType);
  if (existsSync(cardDirectory)) {
    fail(`Card directory already exists: cards/${cardType}`);
  } else {
    const componentName = `${pascalCase(cardType)}Card`;
    mkdirSync(path.join(cardDirectory, 'components'), { recursive: true });
    mkdirSync(path.join(cardDirectory, 'fixtures'), { recursive: true });
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `forma:card:${cardType}`,
      title: `${cardType[0].toUpperCase()}${cardType.slice(1)}`,
      description: 'Describe this Card.',
      type: 'object',
      additionalProperties: false,
      properties: {
        schemaVersion: { const: '1', default: '1', title: 'Schema 版本' },
        type: { const: cardType, default: cardType, title: 'Card 类型' },
      },
      required: ['schemaVersion', 'type'],
    };
    const fixture = { schemaVersion: '1', type: cardType };
    writeFileSync(path.join(cardDirectory, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`);
    writeFileSync(
      path.join(cardDirectory, 'Card.tsx'),
      `import type { CardProps } from '../../src/generated/types';
import { CardContainer } from './components/CardContainer';

export default function ${componentName}({
  data,
}: CardProps<'${cardType}'>) {
  return <CardContainer type={data.type}>{data.type}</CardContainer>;
}
`,
    );
    writeFileSync(
      path.join(cardDirectory, 'components', 'CardContainer.tsx'),
      `import type { ReactNode } from 'react';
import type { CardType } from '../../../src/types/card';

interface CardContainerProps {
  type: CardType;
  className?: string;
  children: ReactNode;
}

export function CardContainer({ type, className, children }: CardContainerProps) {
  return (
    <article
      className={['card-container', className].filter(Boolean).join(' ')}
      data-card-type={type}
    >
      <div className="card-surface">{children}</div>
    </article>
  );
}
`,
    );
    writeFileSync(
      path.join(cardDirectory, 'fixtures', 'default.json'),
      `${JSON.stringify(fixture, null, 2)}\n`,
    );
    writeFileSync(
      path.join(cardDirectory, 'fixtures', 'minimal.json'),
      `${JSON.stringify(fixture, null, 2)}\n`,
    );
    execFileSync(process.execPath, [path.join(projectRoot, 'scripts', 'generate.ts')], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log(`Created cards/${cardType}/. Customize schema.json, Card.tsx, and fixtures/.`);
  }
}
