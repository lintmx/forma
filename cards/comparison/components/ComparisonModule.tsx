import { Fragment, useState } from 'react';
import { diffWords } from 'diff';
import styles from '../Card.module.css';
import { calculateMetricDelta, diffLines, displayValue, type DiffLine } from './comparison';
import type {
  ComparisonEntity,
  ComparisonImageValue,
  ComparisonMetricItem,
  ComparisonModule as ComparisonModuleData,
} from './types';

function ModuleShell({
  type,
  name,
  children,
}: {
  type: ComparisonModuleData['type'];
  name?: string;
  children: React.ReactNode;
}) {
  const moduleName = name?.trim();

  return (
    <section className={styles.module} data-module-type={type}>
      {moduleName && (
        <header className={styles.moduleHeader}>
          <div className={styles.moduleTitle}>
            <span>{moduleName}</span>
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

function EmptyState({ children = '暂无可展示数据' }: { children?: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

function MetricItem({ item, index }: { item: ComparisonMetricItem; index: number }) {
  const delta = calculateMetricDelta(item.before, item.after);
  return (
    <div className={styles.metricItem}>
      <div className={styles.metricName}>{item.label?.trim() || `指标 ${index + 1}`}</div>
      <div className={styles.metricValues}>
        <span className={styles.metricOld}>{displayValue(item.before)}</span>
        <span className={styles.metricArrow} aria-hidden="true">
          →
        </span>
        <span className={styles.metricNew}>{displayValue(item.after)}</span>
        {delta.label && (
          <span className={styles.metricDelta} data-trend={delta.trend}>
            {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricModule({ module }: { module: Extract<ComparisonModuleData, { type: 'metric' }> }) {
  const items = module.items ?? [];
  return (
    <ModuleShell type="metric" name={module.name}>
      <div className={styles.metricBody}>
        {items.length > 0 ? (
          items.map((item, index) => <MetricItem key={index} item={item} index={index} />)
        ) : (
          <EmptyState />
        )}
      </div>
    </ModuleShell>
  );
}

function TextPane({
  label,
  code,
  text,
  after = false,
}: {
  label: string;
  code: string;
  text?: string;
  after?: boolean;
}) {
  return (
    <div className={styles.textPane}>
      <div className={`${styles.textPaneLabel} ${after ? styles.textPaneLabelAfter : ''}`}>
        <span>{label}</span>
        <span className={styles.textPaneCode}>{code}</span>
      </div>
      <div className={styles.textContent}>{text || '—'}</div>
    </div>
  );
}

function TextModule({ module }: { module: Extract<ComparisonModuleData, { type: 'text' }> }) {
  return (
    <ModuleShell type="text" name={module.name}>
      <div className={styles.textBody}>
        <TextPane label="更新前" code="BEFORE" text={module.before} />
        <TextPane label="更新后" code="AFTER" text={module.after} after />
      </div>
    </ModuleShell>
  );
}

function renderDiffText(line: DiffLine) {
  const { counterpart } = line;
  if (counterpart === undefined) {
    return line.text || ' ';
  }

  const before = line.kind === 'del' ? line.text : counterpart;
  const after = line.kind === 'add' ? line.text : counterpart;

  return diffWords(before, after).flatMap((change, index) => {
    const isHidden = line.kind === 'del' ? change.added : change.removed;
    if (isHidden) {
      return [];
    }

    if (change.added || change.removed) {
      return [
        <mark
          key={`${change.value}-${index}`}
          className={line.kind === 'del' ? styles.diffMarkDeleted : styles.diffMarkAdded}
        >
          {change.value}
        </mark>,
      ];
    }

    return [<Fragment key={`${change.value}-${index}`}>{change.value}</Fragment>];
  });
}

function DiffLineView({ line }: { line: DiffLine }) {
  const sign = line.kind === 'del' ? '-' : line.kind === 'add' ? '+' : ' ';
  return (
    <div className={styles.diffLine} data-kind={line.kind}>
      <div className={styles.diffSign} aria-hidden="true">
        {sign}
      </div>
      <div className={styles.diffText}>{renderDiffText(line)}</div>
    </div>
  );
}

function DiffModule({ module }: { module: Extract<ComparisonModuleData, { type: 'diff' }> }) {
  const lines = diffLines(module.before ?? '', module.after ?? '');
  return (
    <ModuleShell type="diff" name={module.name}>
      <div className={styles.diffBody}>
        {lines.length === 0 ? (
          <EmptyState>前后均无内容</EmptyState>
        ) : (
          lines.map((line, index) => <DiffLineView key={`${line.kind}-${index}`} line={line} />)
        )}
      </div>
    </ModuleShell>
  );
}

function asImageValue(value: ComparisonImageValue | undefined): ComparisonImageValue | undefined {
  if (!value || typeof value.url !== 'string') {
    return undefined;
  }
  return value;
}

function isSafeImageUrl(value: string): boolean {
  return /^(?:https?:|data:image\/|blob:|\/|\.\.?(?:\/|$))/iu.test(value.trim());
}

function ImagePane({ image, after }: { image?: ComparisonImageValue; after: boolean }) {
  const [hasError, setHasError] = useState(false);
  const url = image?.url.trim();
  const canLoad = Boolean(url && isSafeImageUrl(url));
  const frameClassName = [styles.imageFrame, after ? styles.imageFrameAfter : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.imagePane}>
      <div className={`${styles.imageMeta} ${after ? styles.imageMetaAfter : ''}`}>
        {image?.label?.trim() || (after ? '更新后' : '更新前')}
      </div>
      <div className={frameClassName}>
        {canLoad && !hasError ? (
          <img
            src={url}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
          />
        ) : (
          <span>{url ? '图片加载失败' : '暂无图片'}</span>
        )}
      </div>
    </div>
  );
}

function ImageModule({ module }: { module: Extract<ComparisonModuleData, { type: 'image' }> }) {
  return (
    <ModuleShell type="image" name={module.name}>
      <div className={styles.imageBody}>
        <ImagePane image={asImageValue(module.before)} after={false} />
        <ImagePane image={asImageValue(module.after)} after />
      </div>
    </ModuleShell>
  );
}

const entityActionColorClasses = {
  green: styles.entityActionGreen,
  red: styles.entityActionRed,
  gray: styles.entityActionGray,
} as const;

function EntityItem({ entity }: { entity: ComparisonEntity }) {
  const entityName = entity.name.trim() || '未命名实体';
  const handle = entity.handle?.trim();
  const bio = entity.bio?.trim();
  const action = entity.action.trim();
  const actionColor = entity.color ?? 'gray';

  return (
    <div className={styles.entityItem}>
      <div className={styles.entityContent}>
        <div className={styles.entityHeader}>
          <div className={styles.entityUserInfo}>
            <span className={styles.entityName}>{entityName}</span>
            {handle && <span className={styles.entityHandle}>{handle}</span>}
          </div>
          <span
            className={`${styles.entityAction} ${entityActionColorClasses[actionColor] ?? styles.entityActionGray}`}
          >
            {action || '—'}
          </span>
        </div>
        {bio && (
          <div className={styles.entityBio}>
            <div className={styles.entityBioText}>{bio}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EntityModule({ module }: { module: Extract<ComparisonModuleData, { type: 'entity' }> }) {
  const entities = module.items ?? [];

  return (
    <ModuleShell type="entity" name={module.name}>
      <div className={styles.entityBody}>
        {entities.length > 0 ? (
          entities.map((entity, index) => (
            <EntityItem key={`${entity.name}-${entity.handle ?? ''}-${index}`} entity={entity} />
          ))
        ) : (
          <EmptyState>暂无实体变更</EmptyState>
        )}
      </div>
    </ModuleShell>
  );
}

export function ComparisonModuleView({ module }: { module: ComparisonModuleData }) {
  switch (module.type) {
    case 'metric':
      return <MetricModule module={module} />;
    case 'text':
      return <TextModule module={module} />;
    case 'diff':
      return <DiffModule module={module} />;
    case 'image':
      return <ImageModule module={module} />;
    case 'entity':
      return <EntityModule module={module} />;
  }
}
