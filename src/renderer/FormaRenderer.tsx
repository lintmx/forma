import { CARD_REGISTRY } from '../generated/registry';
import type { CardContentData, CardData } from '../types/card';
import { RendererFrame } from './frame/RendererFrame';

interface FormaRendererProps {
  data: CardData;
}

export function FormaRenderer({ data }: FormaRendererProps) {
  const Card = CARD_REGISTRY[data.type].component;
  const { options, ...content } = data;

  return (
    <RendererFrame options={options}>
      <Card data={content as CardContentData} />
    </RendererFrame>
  );
}
