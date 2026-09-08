export type ComparisonScalar = string | number;

export interface ComparisonMetricItem {
  label?: string;
  before: ComparisonScalar;
  after: ComparisonScalar;
}

export interface ComparisonImageValue {
  url: string;
  label?: string;
}

export type ComparisonEntityColor = 'green' | 'red' | 'gray';

export interface ComparisonEntity {
  name: string;
  handle?: string;
  bio?: string;
  action: string;
  color?: ComparisonEntityColor;
}

export type ComparisonModule =
  | {
      type: 'metric';
      name?: string;
      items?: ComparisonMetricItem[];
    }
  | {
      type: 'text';
      name?: string;
      before?: string;
      after?: string;
    }
  | {
      type: 'diff';
      name?: string;
      before?: string;
      after?: string;
    }
  | {
      type: 'image';
      name?: string;
      before?: ComparisonImageValue;
      after?: ComparisonImageValue;
    }
  | {
      type: 'entity';
      name?: string;
      items?: ComparisonEntity[];
    };
