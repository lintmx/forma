import { DOMParser, type Element, XMLSerializer } from '@xmldom/xmldom';
import { imageSize } from 'image-size';
import type { Config } from '../config.js';

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const tags = new Set(
  'svg g defs path rect circle ellipse line polyline polygon image clipPath mask pattern linearGradient radialGradient stop title desc'.split(
    ' ',
  ),
);
const attributes = new Set(
  (
    'id x y width height viewBox preserveAspectRatio transform d points cx cy r rx ry x1 x2 y1 y2 fx fy ' +
    'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset ' +
    'opacity clip-path clip-rule mask maskUnits maskContentUnits clipPathUnits patternUnits patternContentUnits patternTransform ' +
    'gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity color visibility display overflow href'
  ).split(' '),
);
const references = new Set(['fill', 'stroke', 'clip-path', 'mask']);
const geometry = new Set(['x', 'y', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'href']);

type Limits = Pick<Config, 'maxOutputBytes' | 'imageMaxBytes' | 'imageMaxPixels'>;
function fail(message: string): never {
  throw new Error('Unsupported internal SVG: ' + message);
}

function number(value: string | null, fallback?: number): number {
  if (value === null || value === '') return fallback ?? fail('missing length');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) fail('non-numeric length');
  const n = Number(value);
  if (!Number.isFinite(n)) fail('non-finite length');
  return n;
}

// Only a single local fragment reference is accepted, never CSS or external URLs.
function fragment(value: string): string {
  const match = /^url\(\s*(['"]?)#([\w.:-]+)\1\s*\)$/.exec(value);
  return match?.[2] ?? fail('non-local reference');
}

function viewportMatrix(box: number[], width: number, height: number, aspect: string | null) {
  const [x, y, w, h] = box as [number, number, number, number];
  const parts = (aspect || 'xMidYMid meet').trim().split(/\s+/);
  const align = parts[0]!;
  if (align !== 'none' && !/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(align)) fail('aspect alignment');
  if (parts.length > 2 || (parts[1] && !['meet', 'slice'].includes(parts[1]))) fail('aspect mode');
  let sx = width / w,
    sy = height / h;
  if (align !== 'none') sx = sy = parts[1] === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
  const ax = align.includes('xMax') ? 1 : align.includes('xMid') ? 0.5 : 0;
  const ay = align.includes('YMax') ? 1 : align.includes('YMid') ? 0.5 : 0;
  return [sx, 0, 0, sy, (width - w * sx) * ax - x * sx, (height - h * sy) * ay - y * sy];
}

/** PNG-only adapter for Satori paths, embedded PNG/JPEG/WebP and bundled SVG icons.
 * No CSS, text, filters, use, external resources or general-purpose SVG input.
 * Image documents have isolated IDs and presentation defaults. Nested images are
 * rejected to preserve the existing resource boundary.
 */
export function svgForSkia(source: string, limits: Limits): Buffer {
  let bytes = 0,
    nodes = 0,
    serial = 0;
  const usedIds = new Set<string>();
  const freshId = () => {
    let id: string;
    do {
      id = `forma-inline-${serial++}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  function parse(text: string) {
    bytes += Buffer.byteLength(text);
    if (bytes > limits.maxOutputBytes * 2) fail('decoded byte budget');
    const doc = new DOMParser({ onError: () => fail('malformed XML') }).parseFromString(text, 'image/svg+xml');
    if (doc.doctype || doc.documentElement?.localName !== 'svg') fail('document type');
    for (const child of Array.from(doc.childNodes)) {
      if (child.nodeType === 7 && child.nodeName !== 'xml') fail('processing instruction');
    }
    const elements: Element[] = [];
    const queue = [{ node: doc.documentElement!, depth: 0 }];
    while (queue.length) {
      const { node, depth } = queue.pop()!;
      if (++nodes > 100000 || depth > 64) fail('node/depth budget');
      if (node.namespaceURI !== SVG || !tags.has(node.localName!)) fail('element ' + node.tagName);
      if (node.localName === 'svg' && node !== doc.documentElement) fail('nested SVG viewport');
      if (
        node.getAttribute('clipPathUnits') === 'objectBoundingBox' ||
        node.getAttribute('maskContentUnits') === 'objectBoundingBox'
      )
        fail('object bounding box clipping');
      if (node.hasAttribute('overflow') && node.getAttribute('overflow') !== 'visible')
        fail('implicit viewport overflow');
      elements.push(node);
      for (const attr of Array.from(node.attributes)) {
        if (
          attr.namespaceURI === XMLNS ||
          (attr.namespaceURI === 'http://www.w3.org/XML/1998/namespace' && attr.localName === 'space')
        )
          continue;
        if (attr.namespaceURI && !(attr.namespaceURI === XLINK && attr.localName === 'href'))
          fail('attribute namespace');
        if (!attributes.has(attr.localName!)) fail('attribute ' + attr.name);
        if (references.has(attr.name) && attr.value.toLowerCase().includes('url')) fragment(attr.value);
      }
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 1) queue.push({ node: child as Element, depth: depth + 1 });
        else if (child.nodeType !== 3 && child.nodeType !== 8) fail('node type');
        else if (child.nodeType === 3 && child.textContent?.trim() && !['title', 'desc'].includes(node.localName!))
          fail('text');
      }
    }
    const ids = new Map<string, Element>();
    for (const node of elements) {
      if (!node.hasAttribute('id')) continue;
      const id = node.getAttribute('id')!;
      if (!/^[\w.:-]+$/.test(id) || ids.has(id)) fail('duplicate/invalid ID');
      ids.set(id, node);
    }
    for (const node of elements) {
      for (const attr of Array.from(node.attributes)) {
        if (references.has(attr.name) && attr.value.toLowerCase().includes('url') && !ids.has(fragment(attr.value)))
          fail('missing ID');
        if (attr.localName === 'href' && node.localName !== 'image') {
          if (
            !['linearGradient', 'radialGradient', 'pattern'].includes(node.localName!) ||
            !attr.value.startsWith('#') ||
            !ids.has(attr.value.slice(1))
          )
            fail('href');
        }
      }
    }
    const edges = new Map<string, Set<string>>([...ids.keys()].map(id => [id, new Set<string>()]));
    for (const node of elements) {
      const targets = Array.from(node.attributes).flatMap(attr => {
        if (references.has(attr.name) && attr.value.toLowerCase().includes('url')) return [fragment(attr.value)];
        if (attr.localName === 'href' && node.localName !== 'image') return [attr.value.slice(1)];
        return [];
      });
      for (
        let parent: Element | null = node;
        parent;
        parent = parent.parentNode?.nodeType === 1 ? (parent.parentNode as Element) : null
      ) {
        const id = parent.getAttribute('id');
        if (id) for (const target of targets) edges.get(id)!.add(target);
      }
    }
    const visited = new Set<string>(),
      active = new Set<string>();
    function visit(id: string, depth = 0) {
      if (active.has(id) || depth > 64) fail('cyclic/deep reference');
      if (visited.has(id)) return;
      active.add(id);
      for (const next of edges.get(id)!) visit(next, depth + 1);
      active.delete(id);
      visited.add(id);
    }
    for (const id of ids.keys()) visit(id);
    return { doc, elements, ids };
  }
  const { doc, elements, ids } = parse(source);
  for (const node of elements) {
    if (node.localName !== 'image' && node.hasAttribute('href')) {
      node.setAttributeNS(XLINK, 'xlink:href', node.getAttribute('href')!);
      node.removeAttribute('href');
    }
  }
  for (const id of ids.keys()) usedIds.add(id);
  const make = (tag: string, attrs: Record<string, string | number> = {}) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  for (const image of elements.filter(node => node.localName === 'image')) {
    const href = image.hasAttribute('href') ? image.getAttribute('href')! : image.getAttributeNS(XLINK, 'href');
    if (!href?.startsWith('data:')) fail('image must be embedded');
    const comma = href.indexOf(',');
    const header = href.slice(5, comma).split(';');
    const mime = header.shift();
    if (comma < 0 || header.some(part => !['base64', 'utf8', 'charset=utf-8'].includes(part))) fail('data URI');
    const payload = href.slice(comma + 1);
    const base64 = header.includes('base64');
    if (base64 && (payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload))) fail('base64');
    const data = base64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
    if (data.length > limits.imageMaxBytes) fail('image byte budget');
    if (mime !== 'image/svg+xml') {
      if (!base64 || !['image/png', 'image/jpeg', 'image/webp'].includes(mime!)) fail('image MIME');
      const size = imageSize(data);
      if (
        !size.width ||
        !size.height ||
        size.width > 16384 ||
        size.height > 16384 ||
        size.width * size.height > limits.imageMaxPixels ||
        !['png', 'jpg', 'webp'].includes(size.type!)
      )
        fail('bitmap dimensions/type');
      image.setAttributeNS(XLINK, 'xlink:href', href);
      image.removeAttribute('href');
      continue;
    }
    const inner = parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    const root = inner.doc.documentElement!;
    if (inner.elements.some(node => node.localName === 'image' || (node.localName === 'svg' && node !== root)))
      fail('nested SVG viewport/image');
    for (const node of inner.elements) {
      if (node.hasAttribute('href')) {
        node.setAttributeNS(XLINK, 'xlink:href', node.getAttribute('href')!);
        node.removeAttribute('href');
      }
    }
    const renamed = new Map([...inner.ids.keys()].map(id => [id, freshId()]));
    for (const node of inner.elements) {
      for (const attr of Array.from(node.attributes)) {
        if (attr.name === 'id') node.setAttribute('id', renamed.get(attr.value)!);
        else if (references.has(attr.name) && attr.value.toLowerCase().includes('url'))
          node.setAttribute(attr.name, `url(#${renamed.get(fragment(attr.value))!})`);
        else if (attr.localName === 'href')
          node.setAttributeNS(attr.namespaceURI, attr.name, '#' + renamed.get(attr.value.slice(1))!);
      }
    }
    const vb = root
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(value => number(value));
    if (vb && (vb.length !== 4 || vb[2]! <= 0 || vb[3]! <= 0)) fail('viewBox');
    const iw = number(root.getAttribute('width'), vb?.[2]);
    const ih = number(root.getAttribute('height'), vb?.[3]);
    const x = number(image.getAttribute('x'), 0),
      y = number(image.getAttribute('y'), 0);
    const w = number(image.getAttribute('width'), iw),
      h = number(image.getAttribute('height'), ih);
    if (Math.min(iw, ih, w, h) <= 0) fail('viewport size');
    const outer = make('g');
    for (const attr of Array.from(image.attributes))
      if (!geometry.has(attr.localName!) && attr.namespaceURI !== XMLNS)
        outer.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    // Image painting does not inherit the surrounding text's fill/stroke.
    const isolated = make('g', {
      fill: 'black',
      stroke: 'none',
      'fill-opacity': 1,
      'stroke-opacity': 1,
      'stroke-width': 1,
      'fill-rule': 'nonzero',
      'clip-rule': 'nonzero',
      color: 'black',
    });
    const outerMatrix = viewportMatrix([0, 0, iw, ih], w, h, image.getAttribute('preserveAspectRatio'));
    outerMatrix[4]! += x;
    outerMatrix[5]! += y;
    const positioned = make('g', { transform: `matrix(${outerMatrix.join(' ')})` });
    // Do not add the nested <svg> default viewport clip: it double-antialiases
    // paths touching the boundary. The established image semantics clip only slice;
    // explicit clipPath/mask references remain on their original coordinate level.
    const content = make('g', {
      transform: `matrix(${viewportMatrix(vb ?? [0, 0, iw, ih], iw, ih, root.getAttribute('preserveAspectRatio')).join(' ')})`,
    });
    const presentation = make('g');
    for (const attr of Array.from(root.attributes))
      if (!geometry.has(attr.localName!) && attr.namespaceURI !== XMLNS)
        presentation.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    for (const child of Array.from(root.childNodes)) presentation.appendChild(doc.importNode(child, true));
    content.appendChild(presentation);
    positioned.appendChild(content);
    isolated.appendChild(positioned);
    // slice clips to the image viewport in its parent's coordinate system.
    if (image.getAttribute('preserveAspectRatio')?.trim().endsWith('slice')) {
      const id = freshId();
      const boundary = make('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      boundary.appendChild(make('rect', { x, y, width: w, height: h }));
      const clipped = make('g', { 'clip-path': `url(#${id})` });
      clipped.appendChild(isolated);
      outer.appendChild(boundary);
      outer.appendChild(clipped);
    } else outer.appendChild(isolated);
    image.parentNode!.replaceChild(outer, image);
  }
  doc.documentElement!.setAttribute('xmlns:xlink', XLINK);
  const result = Buffer.from(new XMLSerializer().serializeToString(doc));
  if (result.length > limits.maxOutputBytes * 2) fail('adapted byte budget');
  return result;
}
