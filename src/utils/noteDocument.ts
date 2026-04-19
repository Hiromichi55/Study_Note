import type { NoteElement } from '../screens/NoteContent';

export type NoteDocumentNode =
  | { type: 'chapter'; text: string }
  | { type: 'section'; text: string }
  | { type: 'subsection'; text: string }
  | { type: 'text'; text: string }
  | { type: 'word'; word: string; meaning: string }
  | { type: 'image'; uri: string };

const WORD_TAG_RE = /<word>([\s\S]*?)<meaning>([\s\S]*?)<\/meaning><\/word>/gi;
const BLOCK_TAG_RE = /<(chapter|section|subsection|text|image)>([\s\S]*?)<\/\1>/gi;
const COMBINED_RE = /<word>([\s\S]*?)<meaning>([\s\S]*?)<\/meaning><\/word>|<(chapter|section|subsection|text|image)>([\s\S]*?)<\/\3>/gi;
const WORD_INLINE_RE = /^([^\n]+?)\s*::\s*([^\n]+)$/;

const normalizeText = (value: string) => value.replace(/\r\n?/g, '\n').trim();

const pushPlainTextNodes = (bucket: NoteDocumentNode[], rawText: string) => {
  const normalized = rawText.replace(/\r\n?/g, '\n');
  const segments = normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  segments.forEach((segment) => {
    bucket.push({ type: 'text', text: segment });
  });
};

export const parseEditorMarkup = (markup: string): NoteDocumentNode[] => {
  const source = markup.replace(/\r\n?/g, '\n');
  if (!source.trim()) return [];

  // タグが無い通常編集テキストは、先頭記号ベースで構造化する。
  if (!containsStructuredMarkup(source)) {
    const segments = source
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.map((segment) => {
      if (segment.startsWith('### ')) {
        return { type: 'subsection', text: segment.replace(/^###\s+/, '') } as NoteDocumentNode;
      }
      if (segment.startsWith('## ')) {
        return { type: 'section', text: segment.replace(/^##\s+/, '') } as NoteDocumentNode;
      }
      if (segment.startsWith('# ')) {
        return { type: 'chapter', text: segment.replace(/^#\s+/, '') } as NoteDocumentNode;
      }
      if (segment === '[画像]') {
        return { type: 'image', uri: '' } as NoteDocumentNode;
      }
      const wordMatch = segment.match(WORD_INLINE_RE);
      if (wordMatch) {
        return {
          type: 'word',
          word: normalizeText(wordMatch[1]),
          meaning: normalizeText(wordMatch[2]),
        } as NoteDocumentNode;
      }
      return { type: 'text', text: segment } as NoteDocumentNode;
    });
  }

  const nodes: NoteDocumentNode[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(COMBINED_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      pushPlainTextNodes(nodes, source.slice(lastIndex, index));
    }

    if (match[1] !== undefined) {
      const word = normalizeText(match[1]);
      const meaning = normalizeText(match[2] ?? '');
      nodes.push({ type: 'word', word, meaning });
    } else {
      const type = (match[3] ?? 'text') as NoteDocumentNode['type'];
      const body = normalizeText(match[4] ?? '');
      if (type === 'image') {
        nodes.push({ type: 'image', uri: body });
      } else if (type === 'chapter' || type === 'section' || type === 'subsection' || type === 'text') {
        nodes.push({ type, text: body });
      }
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    pushPlainTextNodes(nodes, source.slice(lastIndex));
  }

  return nodes;
};

export const documentNodesToMarkup = (nodes: NoteDocumentNode[]): string => {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'chapter':
          return `# ${node.text}`;
        case 'section':
          return `## ${node.text}`;
        case 'subsection':
          return `### ${node.text}`;
        case 'word':
          return `${node.word} :: ${node.meaning}`;
        case 'image':
          return '[画像]';
        case 'text':
        default:
          return node.text;
      }
    })
    .join('\n\n');
};

export const serializeDocumentNodes = (nodes: NoteDocumentNode[]): string => JSON.stringify(nodes);

export const parseStoredContentData = (contentData?: string | null): NoteDocumentNode[] => {
  if (!contentData) return [];

  try {
    const parsed = JSON.parse(contentData);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object' || typeof item.type !== 'string') return [];
      switch (item.type) {
        case 'chapter':
        case 'section':
        case 'subsection':
        case 'text':
          return [{ type: item.type, text: String(item.text ?? '') } as NoteDocumentNode];
        case 'word':
          return [{ type: 'word', word: String(item.word ?? ''), meaning: String(item.meaning ?? '') }];
        case 'image':
          return [{ type: 'image', uri: String(item.uri ?? '') }];
        default:
          return [];
      }
    });
  } catch {
    return parseEditorMarkup(contentData);
  }
};

export const nodesToNoteElements = (nodes: NoteDocumentNode[]): NoteElement[] => {
  return nodes.flatMap((node) => {
    switch (node.type) {
      case 'chapter':
      case 'section':
      case 'subsection':
      case 'text':
        return [{ type: node.type, text: node.text } as NoteElement];
      case 'word':
        return [{ type: 'word', word: node.word, meaning: node.meaning } as NoteElement];
      case 'image':
        return node.uri ? [{ type: 'image', uri: node.uri } as NoteElement] : [];
      default:
        return [];
    }
  });
};

export const createNoteDocumentFromSeed = (seed: {
  chapter: string;
  section: string;
  subsection: string;
  text: string;
  word: string;
  explanation: string;
}): NoteDocumentNode[] => {
  return [
    { type: 'chapter', text: seed.chapter },
    { type: 'section', text: seed.section },
    { type: 'subsection', text: seed.subsection },
    { type: 'text', text: seed.text },
    { type: 'word', word: seed.word, meaning: seed.explanation },
  ];
};

export const buildContentDataFromMarkup = (markup: string): string => {
  return serializeDocumentNodes(parseEditorMarkup(markup));
};

export const buildMarkupFromContentData = (contentData?: string | null): string => {
  return documentNodesToMarkup(parseStoredContentData(contentData));
};

export const extractWordPayloads = (nodes: NoteDocumentNode[]) => {
  return nodes
    .map((node, index) => ({ node, index }))
    .filter((entry): entry is { node: Extract<NoteDocumentNode, { type: 'word' }>; index: number } => entry.node.type === 'word');
};

export const extractImagePayloads = (nodes: NoteDocumentNode[]) => {
  return nodes
    .map((node, index) => ({ node, index }))
    .filter((entry): entry is { node: Extract<NoteDocumentNode, { type: 'image' }>; index: number } => entry.node.type === 'image' && Boolean(entry.node.uri));
};

export const TAG_TEMPLATES = {
  chapter: '# ',
  section: '## ',
  subsection: '### ',
  text: '',
  word: '用語 :: 意味',
  image: '[画像]',
} as const;

export const detectPreferredSelectionOffset = (template: string): number => {
  if (template === '用語 :: 意味') {
    return 0;
  }
  return template.length;
};

export const containsStructuredMarkup = (value: string): boolean => {
  WORD_TAG_RE.lastIndex = 0;
  BLOCK_TAG_RE.lastIndex = 0;
  return WORD_TAG_RE.test(value) || BLOCK_TAG_RE.test(value);
};

/** NoteElement[] をユーザー可読マークアップ文字列に変換する */
export const noteElementsToMarkup = (elements: NoteElement[]): string => {
  return documentNodesToMarkup(elements as unknown as NoteDocumentNode[]);
};