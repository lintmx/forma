import type { CardTranslation } from '../../../src/types/card';

interface TranslationProps {
  translation: CardTranslation;
}

export function Translation({ translation }: TranslationProps) {
  const sourceLanguage = translation.sourceLanguage;
  const directionLabel = sourceLanguage ? '翻译自' : '翻译';
  const language = sourceLanguage;

  return (
    <aside className="card-translation">
      <div className="card-translation__label">
        {translation.model && (
          <>
            使用 <span className="translation-model">{translation.model}</span>{' '}
          </>
        )}
        {directionLabel}
        {language && (
          <>
            {' '}
            <span className="translation-language">{language}</span>
          </>
        )}
      </div>
      <div className="card-translation__text">{translation.text}</div>
    </aside>
  );
}
