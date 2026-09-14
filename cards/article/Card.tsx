import type { CardProps } from '../../src/generated/types';
import { CardFooter } from '../../src/renderer/frame/CardFooter';
import { ArticleHeader } from './components/ArticleHeader';
import { CardContainer } from './components/CardContainer';
import { ArticleContent } from './components/Content';
import { Translation } from './components/Translation';
import styles from './Card.module.css';

export default function ArticleCard({ data }: CardProps<'article'>) {
  return (
    <CardContainer type="article" className={styles.root}>
      <ArticleHeader title={data.title} time={data.time} authorName={data.author?.name} />
      <ArticleContent text={data.content} contentType={data.contentType} />
      {data.translation && <Translation translation={data.translation} />}
      <CardFooter source={data.source} url={data.url} />
    </CardContainer>
  );
}
