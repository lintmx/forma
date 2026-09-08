import type { CardProps } from '../../src/generated/types';
import { CardContainer } from './components/CardContainer';
import { ComparisonModuleView } from './components/ComparisonModule';
import type { ComparisonModule } from './components/types';
import styles from './Card.module.css';

function ComparisonHeader({
  title,
  subtitle,
  time,
}: {
  title: string;
  subtitle?: string;
  time?: string;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.titleBox}>
        <div className={styles.title} title={title.trim() || '数据对比'}>
          {title.trim() || '数据对比'}
        </div>
        {subtitle?.trim() && (
          <div className={styles.subtitle} title={subtitle.trim()}>
            {subtitle.trim()}
          </div>
        )}
      </div>
      {time?.trim() && (
        <div className={styles.time} title="更新时间">
          <svg className={styles.timeIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{time.trim()}</span>
        </div>
      )}
    </header>
  );
}

export default function ComparisonCard({ data }: CardProps<'comparison'>) {
  const modules = (data.modules ?? []) as ComparisonModule[];

  return (
    <CardContainer type="comparison" className={styles.root}>
      <ComparisonHeader title={data.title} subtitle={data.subtitle} time={data.time} />
      <div className={styles.modules}>
        {modules.map((module, index) => (
          <ComparisonModuleView key={`${module.type}-${index}`} module={module} />
        ))}
      </div>
    </CardContainer>
  );
}
