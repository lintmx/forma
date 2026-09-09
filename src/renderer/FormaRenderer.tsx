import { CARD_REGISTRY } from '../generated/registry';
import type { CardContentData, CardData } from '../types/card';
import { RendererFrame } from './frame/RendererFrame';
import { resolveCardAssetUrls } from './assetUrls';

interface FormaRendererProps {
  data: CardData;
}

export function FormaRenderer({ data }: FormaRendererProps) {
  const resolvedData = resolveCardAssetUrls(data);
  const Card = CARD_REGISTRY[resolvedData.type].component;
  const { options, ...content } = resolvedData;

  return (
    <RendererFrame options={options}>
      <Card data={content as CardContentData} />
    </RendererFrame>
  );
}
