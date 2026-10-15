import { DOMParser, type Element, XMLSerializer } from '@xmldom/xmldom';

const presentation = new Set(
  'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray opacity clip-path clip-rule stop-color stop-opacity display overflow'.split(
    ' ',
  ),
);

// Only for the pinned Noto artwork, before installation. Keep the runtime SVG
// adapter's boundary unchanged; fail on new upstream constructs when upgrading.
export function normalizeNotoSvg(data: Uint8Array): Uint8Array {
  const doc = new DOMParser({
    onError: message => {
      throw new Error(message);
    },
  }).parseFromString(new TextDecoder().decode(data), 'image/svg+xml');
  const root = doc.documentElement!;
  if (doc.doctype || root.localName !== 'svg') throw new Error('Invalid Noto SVG');
  const elements = Array.from(doc.getElementsByTagName('*'));
  for (const element of elements) {
    for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
      if (!declaration.trim()) continue;
      const [name, ...parts] = declaration.split(':');
      const property = name!.trim();
      if (property === 'enable-background') continue; // No filters use a background buffer.
      if (!presentation.has(property)) throw new Error('Unsupported Noto style: ' + property);
      element.setAttribute(property, parts.join(':').trim());
    }
    element.removeAttribute('style');
    element.removeAttribute('enable-background');
  }
  const ids = new Map(
    elements.filter(element => element.hasAttribute('id')).map(element => [element.getAttribute('id')!, element]),
  );
  for (const element of elements.filter(element => element.localName === 'use')) {
    const href = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
    const target = href.startsWith('#') ? ids.get(href.slice(1)) : undefined;
    if (
      element.parentNode?.nodeName !== 'clipPath' ||
      !target ||
      !['path', 'rect', 'polygon', 'circle'].includes(target.localName!) ||
      Array.from(element.attributes).some(attribute => !['href', 'overflow'].includes(attribute.localName!)) ||
      (element.hasAttribute('overflow') && element.getAttribute('overflow') !== 'visible')
    )
      throw new Error('Unsupported Noto use');
    const copy = target.cloneNode(true) as Element;
    copy.removeAttribute('id');
    element.parentNode.replaceChild(copy, element);
  }
  root.removeAttribute('version');
  // Illustrator layer names can contain non-ASCII IDs. Drop only unreferenced
  // labels; preserve all gradient/clip references and let compatibility tests check them.
  const referenced = new Set<string>();
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      for (const match of attribute.value.matchAll(/url\(#([^)]+)\)/g)) referenced.add(match[1]!);
      if (attribute.localName === 'href' && attribute.value.startsWith('#')) referenced.add(attribute.value.slice(1));
    }
  }
  for (const element of elements) {
    if (!referenced.has(element.getAttribute('id') ?? '')) element.removeAttribute('id');
  }
  // Illustrator exports zero offsets with px units; the standalone viewport is unchanged.
  for (const axis of ['x', 'y']) {
    const value = root.getAttribute(axis);
    if (value && !/^0(?:px)?$/.test(value)) throw new Error('Unsupported Noto viewport offset');
    root.removeAttribute(axis);
  }
  return Buffer.from(new XMLSerializer().serializeToString(root));
}
