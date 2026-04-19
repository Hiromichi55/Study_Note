import React, { useState, useLayoutEffect, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Modal,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { notebookColors, notebookStyles } from '../styles/notebookStyle';
import * as commonStyle from '../styles/commonStyle';
import NoteContent, { NOTE_OUTER_MARGIN } from './NoteContent';
import { logTable } from 'src/utils/logTable';
import { useEditor, Content } from '../context/EditorContext';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ENV } from '@config';
import { NoteElement } from './NoteContent';
import { captureRef } from 'react-native-view-shot';
import { useHeaderHeight } from '@react-navigation/elements';
import { Dimensions, PixelRatio } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  buildContentDataFromMarkup,
  buildMarkupFromContentData,
  extractImagePayloads,
  extractWordPayloads,
  parseEditorMarkup,
  parseStoredContentData,
  nodesToNoteElements,
  noteElementsToMarkup,
  TAG_TEMPLATES,
  detectPreferredSelectionOffset,
} from '../utils/noteDocument';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props {
  route: NotebookScreenRouteProp;
}

type PageListItem = {
  key: string;
  originalPage: number;
  elements: NoteElement[];
  thumbUri?: string;
};

type TocItem = {
  pageNum: number;
  text: string;
  indentLevel: number;
  itemType: 'chapter' | 'section' | 'subsection';
};

type TocChapterGroup = {
  key: string;
  chapter: TocItem;
  children: TocItem[];
};

const NOTE_BG_COLOR_MAP: Record<string, string> = {
  red: '#B6504A',
  pink: '#B98196',
  orange: '#DB8A3E',
  yellow: '#D2BA39',
  green: '#5D9C6A',
  cyan: '#2499A7',
  blue: '#4A78AC',
  purple: '#8A6EA8',
  brown: '#886B57',
  gray: '#7A7A7A',
  olive: '#768830',
  black: '#1F1F1F',
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#4E4034',
  fontWeight: '600' as const,
};

const getLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
};

const OUTLINE_PREFIX_RE = /^\s*\d+(?:\.\d+)*\.\s*/;
const NOTE_LINE_HEIGHT = 30;
const NOTE_RESERVED_TOP_LINES = 1;
const NOTE_HORIZONTAL_SPACE = 0.03;

const stripOutlinePrefix = (text: string): string => text.replace(OUTLINE_PREFIX_RE, '').trimStart();

const applyOutlineNumbering = (elements: NoteElement[], withNumbering: boolean = true): NoteElement[] => {
  let chapter = 0;
  let section = 0;
  let subsection = 0;

  if (!withNumbering) {
    return elements
      .filter((el): el is NoteElement => Boolean(el && (el as any).type))
      .map((el) => {
        if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
          const body = stripOutlinePrefix(el.text || '');
          return { ...el, text: body, autoNumberingDisabled: true };
        }
        return el;
      });
  }

  return elements
    .filter((el): el is NoteElement => Boolean(el && (el as any).type))
    .map((el) => {
      if (el.type === 'chapter') {
        chapter += 1;
        section = 0;
        subsection = 0;
        const body = stripOutlinePrefix(el.text || '');
        if (el.autoNumberingDisabled) {
          return { ...el, text: body, autoNumberingDisabled: true };
        }
        return { ...el, text: `${chapter}.${body}`, autoNumberingDisabled: false };
      }

      if (el.type === 'section') {
        if (chapter === 0) chapter = 1;
        section += 1;
        subsection = 0;
        const body = stripOutlinePrefix(el.text || '');
        if (el.autoNumberingDisabled) {
          return { ...el, text: body, autoNumberingDisabled: true };
        }
        return { ...el, text: `${chapter}.${section}.${body}`, autoNumberingDisabled: false };
      }

      if (el.type === 'subsection') {
        if (chapter === 0) chapter = 1;
        if (section === 0) section = 1;
        subsection += 1;
        const body = stripOutlinePrefix(el.text || '');
        if (el.autoNumberingDisabled) {
          return { ...el, text: body, autoNumberingDisabled: true };
        }
        return { ...el, text: `${chapter}.${section}.${subsection}.${body}`, autoNumberingDisabled: false };
      }

      return el;
    });
};

// 全ページをまたいで章番号を連番で付与する（ページをまたぐと番号がリセットされる問題の解決）
const applyOutlineNumberingAllPages = (pages: NoteElement[][], withNumbering: boolean = true): NoteElement[][] => {
  if (!withNumbering) {
    return pages.map(page => applyOutlineNumbering(page, false));
  }
  let chapter = 0;
  let section = 0;
  let subsection = 0;
  return pages.map(page =>
    page
      .filter((el): el is NoteElement => Boolean(el && (el as any).type))
      .map(el => {
        if (el.type === 'chapter') {
          chapter += 1;
          section = 0;
          subsection = 0;
          const body = stripOutlinePrefix(el.text || '');
          if (el.autoNumberingDisabled) return { ...el, text: body, autoNumberingDisabled: true };
          return { ...el, text: `${chapter}.${body}`, autoNumberingDisabled: false };
        }
        if (el.type === 'section') {
          if (chapter === 0) chapter = 1;
          section += 1;
          subsection = 0;
          const body = stripOutlinePrefix(el.text || '');
          if (el.autoNumberingDisabled) return { ...el, text: body, autoNumberingDisabled: true };
          return { ...el, text: `${chapter}.${section}.${body}`, autoNumberingDisabled: false };
        }
        if (el.type === 'subsection') {
          if (chapter === 0) chapter = 1;
          if (section === 0) section = 1;
          subsection += 1;
          const body = stripOutlinePrefix(el.text || '');
          if (el.autoNumberingDisabled) return { ...el, text: body, autoNumberingDisabled: true };
          return { ...el, text: `${chapter}.${section}.${subsection}.${body}`, autoNumberingDisabled: false };
        }
        return el;
      })
  );
};

const getNoteElementHeight = (el: NoteElement, screenWidth: number): number => {
  if (el.type === 'image') {
    return Math.round(screenWidth * 0.98 * (1 - 2 * NOTE_HORIZONTAL_SPACE));
  }

  const contentWidth = screenWidth * 0.98 * (1 - 2 * NOTE_HORIZONTAL_SPACE);
  const text =
    el.type === 'word'
      ? `${el.word || ''} ${el.meaning || ''}`
      : 'text' in el
      ? el.text || ''
      : '';

  const fontSize = el.type === 'chapter' ? 22 : el.type === 'section' ? 18 : 15;
  const availableWidth = Math.max(1, contentWidth - 12);
  const charsPerLine = Math.max(8, Math.floor(availableWidth / Math.max(1, fontSize)) - 1);
  const lines = Math.max(
    1,
    text
      .split('\n')
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  );

  return Math.max(NOTE_LINE_HEIGHT, lines * NOTE_LINE_HEIGHT);
};

const splitPageByCapacity = (elements: NoteElement[], maxRows: number, screenWidth: number): [NoteElement[], NoteElement[]] => {
  const maxHeight = Math.max(1, maxRows - NOTE_RESERVED_TOP_LINES) * NOTE_LINE_HEIGHT;
  const fit: NoteElement[] = [];
  const overflow: NoteElement[] = [];
  let used = 0;

  for (const el of elements) {
    const h = getNoteElementHeight(el, screenWidth);
    if (overflow.length > 0) {
      overflow.push(el);
      continue;
    }
    if (used > 0 && used + h > maxHeight) {
      overflow.push(el);
      continue;
    }
    fit.push(el);
    used += h;
  }

  return [fit, overflow];
};

const rebalancePagesByCapacity = (pages: NoteElement[][], maxRows: number, screenWidth: number): NoteElement[][] => {
  const normalized = pages.map((page) => [...(page ?? [])]);
  const result: NoteElement[][] = [];
  let carry: NoteElement[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const merged = [...carry, ...normalized[i]];
    const [fit, overflow] = splitPageByCapacity(merged, maxRows, screenWidth);
    result.push(fit);
    carry = overflow;
  }

  while (carry.length > 0) {
    const [fit, overflow] = splitPageByCapacity(carry, maxRows, screenWidth);
    result.push(fit);
    if (overflow.length === carry.length) {
      break;
    }
    carry = overflow;
  }

  if (result.length === 0) {
    return [[], []];
  }
  if (result.length === 1) {
    return [result[0], []];
  }
  return result;
};

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const headerHeight = useHeaderHeight();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  // NoteContent と同じ計算式でノート領域を定義
  const noteCapRect = {
    x: Math.round(NOTE_OUTER_MARGIN),
    y: Math.round(NOTE_OUTER_MARGIN),
    width: Math.round(screenWidth * 0.98),
    height: Math.round((screenHeight - headerHeight) * 0.87 - NOTE_OUTER_MARGIN),
  };
  const { 
  addContent, addWord, addImage, getContentsByBookId,
  getWordsByContentId, getImagesByContentId,
  addPageImage, updatePageImage, deletePageImage, getPageImagesByBookId,
  deleteContent, deleteAllContentsByBookId,
  select, updateContent, updateWord, deleteWord, updateImage, deleteImage
} = useEditor();

  const isTest = ENV.SCREEN_DEV;
  const navigation = useNavigation<any>();
  const { bookId, initialPage } = route.params;
  const { state, dispatch, deleteBook, touchBook } = useLibrary();

  const book = state.books.find((b) => b.book_id === bookId);
  const noteBgHex = NOTE_BG_COLOR_MAP[book?.color ?? 'red'] ?? NOTE_BG_COLOR_MAP.red;
  const sliderThumbColor = book?.color === 'black' ? '#F4E6D8' : notebookColors.ink;
  const floatingButtonBg = 'rgba(252, 250, 246, 0.96)';
  const floatingButtonBorder = '#DED2C3';
  const floatingButtonIcon = notebookColors.ink;
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [outlineNumberingEnabled, setOutlineNumberingEnabled] = useState(true);
  const [currentPageNumber, setcurrentPageNumber] = useState(0);
  const searchInputRef = useRef<TextInput>(null);
  const noteContentRef = useRef<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // NoteContent から受け取るノート領域情報
  const [noteBounds, setNoteBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // デバッグ用の背景色を返す関数
  const getDebugStyle = (color: string) =>
    isTest ? { backgroundColor: color } : {};

  // elements ベースのページデータ
  const [pagesElements, setPagesElements] = useState<NoteElement[][]>([]);
  const [pagesMarkup, setPagesMarkup] = useState<string[]>([]);
  // useLayoutEffect クロージャで古い値を参照しないよう常に最新を保持する ref
  const pagesElementsRef = useRef<NoteElement[][]>([]);
  const pagesMarkupRef = useRef<string[]>([]);
  const currentPageNumberRef = useRef<number>(0);
  const didApplyInitialPageRef = useRef(false);
  const directEditorRef = useRef<TextInput | null>(null);
  pagesElementsRef.current = pagesElements;
  pagesMarkupRef.current = pagesMarkup;
  currentPageNumberRef.current = currentPageNumber;
  const [focusIndexForEdit, setFocusIndexForEdit] = useState<number>(0);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pendingThumbnailTaskRef = useRef<Promise<void> | null>(null);

  // アニメーション
  const isSwipeAnimatingRef = useRef(false);
  const isAddingPageRef = useRef(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const refreshPageImageUris = async () => {
    const imgs = await getPageImagesByBookId(bookId);
    const uriMap: Record<number, string> = {};
    imgs.forEach(img => { uriMap[Number(img.page_order)] = img.image_path; });
    setPageImageUris(uriMap);
  };

  const waitForNextFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const scheduleThumbnailSync = (pageNumber: number) => {
    const task = (async () => {
      // 編集状態解除後の描画を待ってからキャプチャし、アクティブ行ハイライトを含めない
      await waitForNextFrame();
      await waitForNextFrame();
      await saveThumbnailAsync(pageNumber);
      await refreshPageImageUris();
    })();
    pendingThumbnailTaskRef.current = task;
    task.finally(() => {
      if (pendingThumbnailTaskRef.current === task) {
        pendingThumbnailTaskRef.current = null;
      }
    });
  };

  // ===== ページ一覧モーダルを開く（サムネイルをDBから読み込む） =====
  const openPageList = async () => {
    if (isSavingPage) return;
    try {
      if (pendingThumbnailTaskRef.current) {
        await pendingThumbnailTaskRef.current;
      }
      // DB から現在の本のすべてのページをリロード（最新データを取得）
      await loadAllPages();
      
      // サムネイル画像を読み込む
      await refreshPageImageUris();
      
      setPageListVisible(true);
    } catch (e) {
      console.warn('ページ一覧読み込みエラー:', e);
      setPageListVisible(true);
    }
  };

  // 編集状態
  const [editing, setEditing] = useState(false);
  // 編集終了時に NoteContent を強制再マウントするためのキー
  const [noteContentKey, setNoteContentKey] = useState(0);

  // モーダル表示状態
  const [tocVisible, setTocVisible] = useState(false);
  const [isTocExpanded, setIsTocExpanded] = useState(false);
  const [tocOpenSections, setTocOpenSections] = useState<Record<string, boolean>>({});
  const [pageListVisible, setPageListVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [addAfterIndex, setAddAfterIndex] = useState<number>(0);

  // ページサムネイル（page_order → URI）
  const [pageImageUris, setPageImageUris] = useState<Record<number, string>>({});

  const [pageListItems, setPageListItems] = useState<PageListItem[]>([]);

  useEffect(() => {
    if (!pageListVisible) return;
    setPageListItems(
      pagesElements.map((elements, index) => ({
        key: `page-${index}`,
        originalPage: index,
        elements,
        thumbUri: pageImageUris[index],
      }))
    );
  }, [pageListVisible]);


  const runPageSwitchAnimation = (targetPage: number, direction: 1 | -1) => {
    if (isSwipeAnimatingRef.current) return;
    if (targetPage < 0 || targetPage >= pagesElements.length) return;

    isSwipeAnimatingRef.current = true;
    const shouldLoadTargetPage = !Array.isArray(pagesElementsRef.current[targetPage]);
    setcurrentPageNumber(targetPage);
    if (shouldLoadTargetPage) {
      void loadPageFromDB(targetPage);
    }
    requestAnimationFrame(() => {
      isSwipeAnimatingRef.current = false;
    });
  };

  const insertPageAfterCurrent = async () => {
    if (isAddingPageRef.current) return;
    isAddingPageRef.current = true;

    try {
      const insertPosition = currentPageNumberRef.current + 1;

      // DB: 挿入位置以降のページのpage番号を全て +1 する
      const allContents = await getContentsByBookId(bookId);
      logTable('ページ追加前 contentsテーブル', allContents as any[]);
      for (const content of allContents) {
        if (content.page >= insertPosition) {
          await updateContent(content.content_id, { page: content.page + 1 });
        }
      }

      // DB: 挿入位置以降の page_images の page_order も +1 する
      // ※ サムネイルファイルも新しいページ番号のファイル名にコピーする
      const allPageImages = await getPageImagesByBookId(bookId);
      const sortedImgs = [...allPageImages]
        .filter(img => Number(img.page_order) >= insertPosition)
        .sort((a, b) => Number(b.page_order) - Number(a.page_order));
      for (const img of sortedImgs) {
        const newOrder = Number(img.page_order) + 1;
        const thumbDir = FileSystem.documentDirectory + 'thumbnails/';
        const newPath = thumbDir + `book_${bookId}_page_${newOrder}.jpg`;
        let updatedPath = img.image_path;
        if (img.image_path) {
          try {
            await FileSystem.copyAsync({ from: img.image_path, to: newPath });
            updatedPath = newPath;
          } catch (_) { /* ファイルが存在しない場合はスキップ */ }
        }
        await updatePageImage(img.page_image_id, { page_order: newOrder, image_path: updatedPath });
      }

      // 新ページ用の page_images エントリを作成
      await addPageImage({
        page_image_id: await Crypto.randomUUID(),
        image_path: '',
        page_order: insertPosition,
        book_id: bookId,
      });

      // DB: 新ページの content を作成
      const newContentId = await Crypto.randomUUID();
      await addContent({
        content_id: newContentId,
        type: 'document',
        book_id: bookId,
        page: insertPosition,
        height: 0,
        content_data: '[]',
      } as Content);

      // 追加後のDB確認ログ
      const afterContents = await getContentsByBookId(bookId);
      logTable('ページ追加後 contentsテーブル', afterContents as any[]);

      // 新ページを現在ページの次に挿入
      setPagesElements(prev => {
        const newPages = [...prev];
        newPages.splice(insertPosition, 0, []);
        return newPages;
      });
      setPagesMarkup((prev) => {
        const next = [...prev];
        next.splice(insertPosition, 0, '');
        return next;
      });

      // +ボタン時と同じく、スライダー最大値更新後にページ遷移
      setTimeout(() => {
        setcurrentPageNumber(insertPosition);
      }, 0);
    } catch (e) {
      console.error('ページ追加エラー:', e);
    } finally {
      isAddingPageRef.current = false;
    }
  };

  const handleNoteSwipePage = (direction: 1 | -1) => {
    if (editing || showSearch || tocVisible || pageListVisible || typePickerVisible) return;
    const targetPage = currentPageNumber + direction;
    if (direction === 1 && targetPage >= pagesElements.length) {
      void insertPageAfterCurrent();
      return;
    }
    runPageSwitchAnimation(targetPage, direction);
  };

  const ELEMENT_LABELS: { label: string; type: NoteElement['type']; iconName?: keyof typeof Ionicons.glyphMap }[] = [
    { label: '大', type: 'chapter' },
    { label: '中', type: 'section' },
    { label: '小', type: 'subsection' },
    { label: '文章', type: 'text', iconName: 'text-outline' },
    { label: '単語/意味', type: 'word', iconName: 'list-outline' },
    { label: '画像', type: 'image', iconName: 'image-outline' },
  ];

  // ===== 目次アイテムを全ページから大謀期演算 =====
  const tocItems = useMemo(() => {
    return pagesElements.flatMap((pageElems, pageNum) =>
      (pageElems || [])
        .filter((el): el is NoteElement => Boolean(el && (el as any).type))
        .filter(el => el.type === 'chapter' || el.type === 'section' || el.type === 'subsection')
        .map(el => ({
          pageNum,
          text: (el as any).text as string,
          indentLevel: el.type === 'chapter' ? 0 : el.type === 'section' ? 1 : 2,
          itemType: el.type,
        }))
    );
  }, [pagesElements]);

  const tocChapterGroups = useMemo<TocChapterGroup[]>(() => {
    const groups: TocChapterGroup[] = [];
    let currentGroup: TocChapterGroup | null = null;

    tocItems.forEach((item, index) => {
      if (item.itemType === 'chapter') {
        currentGroup = {
          key: `chapter-${item.pageNum}-${index}`,
          chapter: item,
          children: [],
        };
        groups.push(currentGroup);
        return;
      }

      if (!currentGroup) {
        currentGroup = {
          key: `chapter-fallback-${item.pageNum}-${index}`,
          chapter: {
            pageNum: item.pageNum,
            text: '見出し',
            indentLevel: 0,
            itemType: 'chapter',
          },
          children: [],
        };
        groups.push(currentGroup);
      }

      currentGroup.children.push(item);
    });

    return groups;
  }, [tocItems]);

  // ===== 検索結果 =====
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { pageNum: number; type: string; text: string }[] = [];
    pagesElements.forEach((pageElems, pageNum) => {
      (pageElems || [])
        .filter((el): el is NoteElement => Boolean(el && (el as any).type))
        .forEach(el => {
        if (el.type === 'text' || el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
          const text = (el as any).text || '';
          if (text.toLowerCase().includes(query)) {
            results.push({ pageNum, type: el.type, text });
          }
        } else if (el.type === 'word') {
          const combined = `${(el as any).word} ${(el as any).meaning}`;
          if (combined.toLowerCase().includes(query)) {
            results.push({ pageNum, type: 'word', text: `${(el as any).word} — ${(el as any).meaning}` });
          }
        }
      });
    });
    return results;
  }, [searchQuery, pagesElements]);


  // ===== 要素単位の編集コールバック群 =====
  const syncPageState = (newPagesElements: NoteElement[][], page: number) => {
    const numbered = applyOutlineNumberingAllPages(newPagesElements, outlineNumberingEnabled);
    const markup = noteElementsToMarkup(numbered[page] ?? []);
    setPagesElements(numbered);
    setPagesMarkup((prev) => {
      const next = [...prev];
      next[page] = markup;
      return next;
    });
  };

  const handleEditorTextChange = (markup: string) => {
    const page = currentPageNumberRef.current;
    const nodes = parseEditorMarkup(markup);
    const rawElements = nodesToNoteElements(nodes);
    const next = [...pagesElementsRef.current];
    next[page] = rawElements;
    setPagesMarkup((prev) => {
      const nextMarkup = [...prev];
      nextMarkup[page] = markup;
      return nextMarkup;
    });
    setPagesElements(applyOutlineNumberingAllPages(next, outlineNumberingEnabled));
  };

  const handleInsertTemplate = (key: keyof typeof TAG_TEMPLATES) => {
    const page = currentPageNumberRef.current;
    const currentMarkup = pagesMarkupRef.current[page] ?? '';
    const start = editorSelection.start;
    const end = editorSelection.end;
    const template = key === 'text' ? '\n\n' : (TAG_TEMPLATES[key] ?? '');
    const nextMarkup = `${currentMarkup.slice(0, start)}${template}${currentMarkup.slice(end)}`;
    const cursorOffset = key === 'text' ? 2 : detectPreferredSelectionOffset(template);
    setEditorSelection({ start: start + cursorOffset, end: start + cursorOffset });
    handleEditorTextChange(nextMarkup);
    setTimeout(() => {
      directEditorRef.current?.focus();
    }, 0);
  };

  const handleElementChange = (index: number, newEl: NoteElement) => {
    const page = currentPageNumberRef.current;
    const newPage = [...(pagesElementsRef.current[page] ?? [])];
    newPage[index] = newEl;
    const next = [...pagesElementsRef.current];
    next[page] = newPage;
    syncPageState(next, page);
  };

  const handleDeleteElement = (index: number) => {
    const page = currentPageNumberRef.current;
    const newPage = [...(pagesElementsRef.current[page] ?? [])];
    newPage.splice(index, 1);
    const next = [...pagesElementsRef.current];
    next[page] = newPage;
    syncPageState(next, page);
  };

  const handleTapEmptyCallback = (afterIndex: number): boolean => {
    const page = currentPageNumberRef.current;
    const newPage = [...(pagesElementsRef.current[page] ?? [])];
    newPage.splice(afterIndex, 0, { type: 'text', text: '' } as NoteElement);
    const next = [...pagesElementsRef.current];
    next[page] = newPage;
    syncPageState(next, page);
    return true;
  };

  const handleSplitCallback = (index: number, before: string, after: string): boolean => {
    const page = currentPageNumberRef.current;
    const newPage = [...(pagesElementsRef.current[page] ?? [])];
    const el = newPage[index];
    if (!el) return false;
    newPage[index] = { ...el, text: before } as NoteElement;
    newPage.splice(index + 1, 0, { type: 'text', text: after } as NoteElement);
    const next = [...pagesElementsRef.current];
    next[page] = newPage;
    syncPageState(next, page);
    return true;
  };

  const handleMergeCallback = (index: number) => {
    const page = currentPageNumberRef.current;
    const newPage = [...(pagesElementsRef.current[page] ?? [])];
    if (index <= 0 || !newPage[index - 1] || !newPage[index]) return;
    const prevEl = newPage[index - 1];
    const curEl = newPage[index];
    const prevText = 'text' in prevEl ? prevEl.text : '';
    const curText = 'text' in curEl ? curEl.text : '';
    newPage[index - 1] = { ...prevEl, text: prevText + curText } as NoteElement;
    newPage.splice(index, 1);
    const next = [...pagesElementsRef.current];
    next[page] = newPage;
    syncPageState(next, page);
  };

  const syncWordsForContent = async (contentId: string, markup: string) => {
    const wordPayloads = extractWordPayloads(parseEditorMarkup(markup));
    const existingWords = (await getWordsByContentId(contentId)).sort((a, b) => a.word_order - b.word_order);

    for (let i = 0; i < wordPayloads.length; i += 1) {
      const payload = wordPayloads[i];
      const existing = existingWords[i];
      const data = {
        word: payload.node.word,
        explanation: payload.node.meaning,
        word_order: payload.index,
        content_id: contentId,
      };

      if (existing) {
        await updateWord(existing.word_id, data);
      } else {
        await addWord({
          word_id: await Crypto.randomUUID(),
          review_flag: 0,
          ...data,
        });
      }
    }

    for (let i = wordPayloads.length; i < existingWords.length; i += 1) {
      await deleteWord(existingWords[i].word_id);
    }
  };

  const syncImagesForContent = async (contentId: string, markup: string) => {
    const imagePayloads = extractImagePayloads(parseEditorMarkup(markup));
    const existingImages = await getImagesByContentId(contentId);

    for (let i = 0; i < imagePayloads.length; i += 1) {
      const payload = imagePayloads[i];
      const existing = existingImages[i];
      const data = {
        image: payload.node.uri,
        image_order: payload.index,
        content_id: contentId,
      };

      if (existing) {
        await updateImage(existing.image_id, data);
      } else {
        await addImage({
          image_id: await Crypto.randomUUID(),
          ...data,
        });
      }
    }

    for (let i = imagePayloads.length; i < existingImages.length; i += 1) {
      await deleteImage(existingImages[i].image_id);
    }
  };

  const saveAllPagesToDB = async (pagesToSave: string[]) => {
    const contents = await getContentsByBookId(bookId);
    const contentMap = new Map<number, Content>();
    contents.forEach((c) => contentMap.set(c.page, c));

    const pageImages = await getPageImagesByBookId(bookId);
    const imageMap = new Map<number, typeof pageImages[number]>();
    pageImages.forEach((img) => imageMap.set(Number(img.page_order), img));

    for (const c of contents) {
      if (c.page >= pagesToSave.length) {
        await deleteContent(c.content_id);
      }
    }

    for (const img of pageImages) {
      const order = Number(img.page_order);
      if (order >= pagesToSave.length) {
        await deletePageImage(img.page_image_id);
      }
    }

    for (let page = 0; page < pagesToSave.length; page += 1) {
      const existing = contentMap.get(page);
      const markup = pagesToSave[page] ?? '';
      const contentData = buildContentDataFromMarkup(markup);
      const contentId = existing?.content_id ?? (await Crypto.randomUUID());

      if (existing) {
        await updateContent(existing.content_id, {
          type: 'document',
          page,
          height: 0,
          content_data: contentData,
        });
      } else {
        await addContent({
          content_id: contentId,
          type: 'document',
          book_id: bookId,
          page,
          height: 0,
          content_data: contentData,
        } as Content);
      }

      await syncWordsForContent(contentId, markup);
      await syncImagesForContent(contentId, markup);

      const existingPageImage = imageMap.get(page);
      if (!existingPageImage) {
        await addPageImage({
          page_image_id: await Crypto.randomUUID(),
          image_path: '',
          page_order: page,
          book_id: bookId,
        });
      }
    }
  };

  const handleAddElement = (type: NoteElement['type']) => {
    const newEl: NoteElement =
      type === 'word'
        ? ({ type: 'word', word: '', meaning: '' } as any)
        : type === 'image'
        ? { type: 'image', uri: '' }
        : ({ type, text: '' } as any);

    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) next[currentPageNumber] = [];
      const arr = [...next[currentPageNumber]];
      arr.splice(addAfterIndex, 0, newEl);
      next[currentPageNumber] = arr;
      return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
    });
    setTypePickerVisible(false);
  };

  // ===== 行タップ → 編集モード開始 =====
  const handleEditStart = (index: number) => {
    if (showHelpOverlay) {
      setShowHelpOverlay(false);
      return;
    }
    setFocusIndexForEdit(index);
    const markup = pagesMarkupRef.current[currentPageNumberRef.current] ?? '';
    const end = markup.length;
    setEditorSelection({ start: end, end });
    setEditing(true);
  };

  // ===== サムネイル保存（バックグラウンド・UIをブロックしない） =====
  const saveThumbnailAsync = async (pageNumber: number) => {
    try {
      if (!noteContentRef.current) return;
      const uri = await captureRef(noteContentRef, { format: 'jpg', quality: 0.7, result: 'tmpfile' });
      const pr = PixelRatio.get();
      const cropped = await manipulateAsync(
        uri,
        [{ crop: {
          originX: noteCapRect.x * pr,
          originY: noteCapRect.y * pr,
          width: noteCapRect.width * pr,
          height: noteCapRect.height * pr,
        }}],
        { compress: 0.7, format: SaveFormat.JPEG }
      );
      const destDir = FileSystem.documentDirectory + 'thumbnails/';
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destPath = destDir + `book_${bookId}_page_${pageNumber}.jpg`;
      await FileSystem.copyAsync({ from: cropped.uri, to: destPath });
      const existing = await getPageImagesByBookId(bookId);
      const existingPage = existing.find(img => Number(img.page_order) === pageNumber);
      if (existingPage) {
        await updatePageImage(existingPage.page_image_id, { image_path: destPath });
      } else {
        await addPageImage({
          page_image_id: await Crypto.randomUUID(),
          image_path: destPath,
          page_order: pageNumber,
          book_id: bookId,
        });
      }
    } catch (e) {
      console.warn('サムネイル保存エラー:', e);
    }
  };

  // ===== 保存処理（DB保存 + 再読み込み + 編集終了） =====
  const handleSave = async (): Promise<boolean> => {
    if (isSavingPage) return false;
    setIsSavingPage(true);
    try {
      Keyboard.dismiss();
      const currentMarkupPages = [...pagesMarkupRef.current];
      const numbered = applyOutlineNumberingAllPages(
        currentMarkupPages.map((markup) => nodesToNoteElements(parseEditorMarkup(markup))),
        outlineNumberingEnabled
      );

      setPagesElements(numbered);
      await saveAllPagesToDB(currentMarkupPages);
      await touchBook(bookId);
      setEditing(false);
      // 体感遅延を減らすためサムネイル更新は非同期で実行
      scheduleThumbnailSync(Math.min(currentPageNumberRef.current, numbered.length - 1));
      return true;
    } catch (e) {
      console.error('保存エラー:', e);
      setEditing(false);
      return false;
    } finally {
      setIsSavingPage(false);
    }
  };

  // ===== ページ削除 =====
  const deleteCurrentPage = async () => {
    try {
      const contents = await getContentsByBookId(bookId);
      logTable('ページ削除前 contentsテーブル', contents as any[]);
      const pageContent = contents.find(c => c.page === currentPageNumber);
      if (pageContent) {
        await deleteContent(pageContent.content_id);
        
        // DB: 削除したページより後ろのページの page 値を全て -1 する（上詰め）
        for (const content of contents) {
          if (content.page > currentPageNumber) {
            await updateContent(content.content_id, { page: content.page - 1 });
          }
        }
        
        // DB: 削除したページより後ろの page_images の page_order も -1 する
        // ※ サムネイルファイルも新しいページ番号のファイル名にコピーする
        const allPageImages = await getPageImagesByBookId(bookId);
        // 番号が小さい順に処理して上書き衝突を防ぐ
        const sortedImgsAsc = [...allPageImages]
          .filter(img => Number(img.page_order) > currentPageNumber)
          .sort((a, b) => Number(a.page_order) - Number(b.page_order));
        for (const img of sortedImgsAsc) {
          const newOrder = Number(img.page_order) - 1;
          const thumbDir = FileSystem.documentDirectory + 'thumbnails/';
          const newPath = thumbDir + `book_${bookId}_page_${newOrder}.jpg`;
          let updatedPath = img.image_path;
          if (img.image_path) {
            try {
              await FileSystem.copyAsync({ from: img.image_path, to: newPath });
              updatedPath = newPath;
            } catch (_) { /* ファイルが存在しない場合はスキップ */ }
          }
          await updatePageImage(img.page_image_id, { page_order: newOrder, image_path: updatedPath });
        }
        
        // 削除後のDB確認ログ
        const afterContents = await getContentsByBookId(bookId);
        logTable('ページ削除後 contentsテーブル', afterContents as any[]);
      }
      
      setPagesElements(prev => {
        const next = [...prev];
        next.splice(currentPageNumber, 1);
        return next;
      });
      setPagesMarkup((prev) => {
        const next = [...prev];
        next.splice(currentPageNumber, 1);
        return next;
      });
      setcurrentPageNumber(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('ページ削除エラー:', e);
    }
  };

  // ===== 本削除 =====
  const deleteBookHandler = async () => {
    try {
      await deleteAllContentsByBookId(bookId);
      await deleteBook(bookId);
      navigation.goBack();
    } catch (e) {
      console.error('本の削除エラー:', e);
    }
  };

  const loadPageFromDB = async (pageNumber: number, options?: { returnText?: boolean }) => {
    try {
      const contents = await getContentsByBookId(bookId);
      const pageContentRow = contents.find(c => c.page === pageNumber);

      if (!pageContentRow) return;
      const markup = buildMarkupFromContentData(pageContentRow.content_data);
      const elements = nodesToNoteElements(parseStoredContentData(pageContentRow.content_data));

      setPagesElements(prev => {
        const next = [...prev];
        next[pageNumber] = elements;
        return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
      });
      setPagesMarkup((prev) => {
        const next = [...prev];
        next[pageNumber] = markup;
        return next;
      });

    } catch (e) {
      console.error('DB 読み込みエラー: ', e);
      return '';
    }
  };

  const loadAllPages = async () => {
    let contents = await getContentsByBookId(bookId);

    // DB が空なら空のページを2つ作成
    if (!contents || contents.length === 0) {
      for (let p = 0; p < 2; p++) {
        const contentId = await Crypto.randomUUID();
        await addContent({
          content_id: contentId,
          type: 'document',
          book_id: bookId,
          page: p,
          height: 0,
          content_data: '[]',
        });
        // page_images テーブルにもエントリを追加
        const pageImageId = await Crypto.randomUUID();
        await addPageImage({
          page_image_id: pageImageId,
          image_path: '',
          page_order: p,
          book_id: bookId,
        });
      }
      contents = await getContentsByBookId(bookId);
    }

    // page 値で昇順ソートして確実に順番を保証
    const sortedContents = [...contents].sort((a, b) => a.page - b.page);
    const maxPage = sortedContents.length > 0 ? sortedContents[sortedContents.length - 1].page : 0;

    // 全ページ分の空配列を先に確保
    const newPagesElements: NoteElement[][] = Array(maxPage + 1).fill(null).map(() => []);
    const newPagesMarkup: string[] = Array(maxPage + 1).fill('');

    // 各ページの要素を取得してまとめてセット（一括更新で順序ずれを防ぐ）
    for (const content of sortedContents) {
      const p = content.page;
      newPagesMarkup[p] = buildMarkupFromContentData(content.content_data);
      newPagesElements[p] = nodesToNoteElements(parseStoredContentData(content.content_data));
    }

    // 一括で State を更新（順序が確実に保証される）。全ページ通しで章番号を連番付与する。
    setPagesElements(applyOutlineNumberingAllPages(newPagesElements, outlineNumberingEnabled));
    setPagesMarkup(newPagesMarkup);
  };

  useEffect(() => { // 初回ロード時に DB からページデータを読み込む
    loadAllPages();
  }, [bookId]);

  useEffect(() => {
    didApplyInitialPageRef.current = false;
  }, [bookId, initialPage]);

  useEffect(() => {
    if (didApplyInitialPageRef.current) return;
    if (typeof initialPage !== 'number') {
      didApplyInitialPageRef.current = true;
      return;
    }
    if (pagesElements.length === 0) return;

    const target = Math.max(0, Math.min(initialPage, pagesElements.length - 1));
    setcurrentPageNumber(target);
    if (!Array.isArray(pagesElementsRef.current[target])) {
      void loadPageFromDB(target);
    }
    didApplyInitialPageRef.current = true;
  }, [initialPage, pagesElements.length]);

  useEffect(() => {
    setPagesElements(prev => {
      const normalizedPages = prev.map(page =>
        page.map(el => {
          if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
            return outlineNumberingEnabled
              ? { ...el, autoNumberingDisabled: false }
              : { ...el, autoNumberingDisabled: true };
          }
          return el;
        })
      );
      return applyOutlineNumberingAllPages(normalizedPages, outlineNumberingEnabled);
    });
  }, [outlineNumberingEnabled]);

  useEffect(() => {
    if (editing) setShowHelpOverlay(false);
  }, [editing]);

  useEffect(() => {
    if (!editing || !noteBounds) return;
    const timer = setTimeout(() => {
      directEditorRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [editing, noteBounds, currentPageNumber]);

  useEffect(() => {
    if (!editing) return;
    const max = (pagesMarkup[currentPageNumber] ?? '').length;
    setEditorSelection((prev) => ({
      start: Math.min(prev.start, max),
      end: Math.min(prev.end, max),
    }));
  }, [currentPageNumber, pagesMarkup, editing]);

  useEffect(() => {
    const loadContents = async () => {
      if (!state.isLoading) {
        await getContentsByBookId(bookId);
      }
    };
    loadContents();
  }, [bookId]);

  // 編集中は戻るをプリベント
  usePreventRemove(editing, ({ data }) => {
    Alert.alert(
      '確認',
      '編集中です。保存しますか？',
      [
        {
          text: '保存しない',
          onPress: () => {
            setEditing(false);
            navigation.dispatch(data.action);
          },
          style: 'destructive',
        },
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '保存',
          onPress: async () => {
            // 保存してから戻る
            try {
              const ok = await handleSave();
              if (!ok) return;
              setTimeout(() => {
                navigation.dispatch(data.action);
              }, 300);
            } catch (err) {
              console.error('保存エラー:', err);
            }
          },
        },
      ]
    );
  });

  useEffect(() => {
    // iOS: keyboardWillShow / WillHide を使うと表示前に高さ取得できる
    const showSubWill = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    // Android: keyboardDidShow / DidHide のみ発火
    const showSubDid = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const hideSubWill = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });
    const hideSubDid = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubWill.remove();
      showSubDid.remove();
      hideSubWill.remove();
      hideSubDid.remove();
    };
  }, []);



  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#E9DCCD',
      },
      headerShadowVisible: false,
      headerTintColor: notebookColors.ink,
      headerRightContainerStyle: { paddingRight: 2 },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[notebookStyles.menuBtn, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Ionicons name="chevron-back" size={24} color={notebookColors.ink} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <TouchableOpacity
          onPress={() => { setTocVisible(true); console.log('目次ボタン押下'); }}
          activeOpacity={0.75}
          style={notebookStyles.outlineBtnWrap}
        >
          <Text style={notebookStyles.outlineBtn}>目次 ▾</Text>
        </TouchableOpacity>
      ),
      headerRight: () =>
        editing ? (
          // 編集中: チェックボタン（保存）
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
            <TouchableOpacity
              onPress={() => { console.log('保存ボタン押下'); handleSave(); }}
              style={[notebookStyles.menuBtn, notebookStyles.menuBtnPlainIcon]}
            >
              <Ionicons name="checkmark" size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          // 通常: ミートボールメニュー
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
            <View>
              <Menu
                key={menuVisible ? 'open' : 'closed'}
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                  <TouchableOpacity
                    onPress={() => { console.log('メニューボタン押下'); openMenu(); }}
                    style={[notebookStyles.menuBtn, notebookStyles.menuBtnIcon, getDebugStyle('rgba(0, 255, 0, 0.15)')]}> 
                    <Ionicons name="ellipsis-horizontal" size={18} color="white" />
                  </TouchableOpacity>
                }
                contentStyle={notebookStyles.menuOptionsContainer}
              >
              <Menu.Item
                onPress={() => {
                  console.log('メニュー/検索ボタン押下');
                  closeMenu();
                  setShowSearch(!showSearch);
                }}
                title="検索"
                leadingIcon="magnify"
                titleStyle={MENU_ITEM_TITLE_STYLE}
              />
              <Menu.Item
                onPress={() => {
                  console.log('メニュー/章節番号トグル押下');
                  closeMenu();
                  setOutlineNumberingEnabled((prev) => !prev);
                }}
                title={outlineNumberingEnabled ? '見出し番号を非表示' : '見出し番号を表示'}
                leadingIcon={outlineNumberingEnabled ? 'eye-off' : 'eye'}
                titleStyle={MENU_ITEM_TITLE_STYLE}
              />
              <Menu.Item
                onPress={() => {
                  console.log('メニュー/ページ削除ボタン押下');
                  closeMenu();
                  Alert.alert('ページを削除', 'このページを削除しますか？', [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '削除', style: 'destructive', onPress: deleteCurrentPage },
                  ]);
                }}
                title="ページ削除"
                leadingIcon={({ size }) => (
                  <MaterialCommunityIcons name="trash-can" size={size} color="#B45145" />
                )}
                titleStyle={notebookStyles.deleteOption}
              />
              {/* <Menu.Item
                onPress={() => {
                  console.log('メニュー/本削除ボタン押下');
                  closeMenu();
                  Alert.alert('本を削除', 'この本とすべてのノートを削除しますか？', [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '削除', style: 'destructive', onPress: deleteBookHandler },
                  ]);
                }}
                title="本削除"
                titleStyle={notebookStyles.deleteOption}
                leadingIcon="delete"
              /> */}
            </Menu>
            </View>
          </View>
        ),
    });
  }, [navigation, menuVisible, editing, currentPageNumber, showHelpOverlay]);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  const closeSearchPanel = () => {
    if (!showSearch) return;
    setShowSearch(false);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    Keyboard.dismiss();
  };

  return (
    <>
    <TouchableWithoutFeedback 
      disabled={editing}
      onPress={() => {
        if (showSearch) {
          closeSearchPanel();
          return;
        }
        // 背景タップ→最終要素を対象に編集開始
        const lastIdx = Math.max(0, (pagesElementsRef.current[currentPageNumberRef.current] ?? []).length - 1);
        handleEditStart(lastIdx);
      }}
      style={[
        notebookStyles.notebookScreenWrapper,
        getDebugStyle('rgba(255, 255, 0, 1)')]}
    >
      <View style={[notebookStyles.notebookContentsContainer, { backgroundColor: noteBgHex }]}>
        {/* <NoteBackground> */}
          <Animated.View
            ref={noteContentRef}
            collapsable={false}
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backfaceVisibility: 'hidden',
              opacity: 1,
            }}
          >
          <NoteContent 
            key={noteContentKey}
            backgroundColor={book.color}
            elements={[]}
            onNoteLayout={setNoteBounds}
            isEditing={false}
            onSwipePage={handleNoteSwipePage}
            onEditStart={handleEditStart}
            onBackgroundGenerated={(uri: string) => {
              console.log('背景画像生成完了:', uri);
            }}
          />

          {noteBounds && (
            <View
              pointerEvents={editing ? 'auto' : 'none'}
              style={{
                position: 'absolute',
                left: noteBounds.x + noteBounds.width * NOTE_HORIZONTAL_SPACE,
                top: noteBounds.y + NOTE_LINE_HEIGHT,
                width: noteBounds.width * (1 - NOTE_HORIZONTAL_SPACE * 2),
                height: noteBounds.height - NOTE_LINE_HEIGHT,
                zIndex: 40,
              }}
            >
              <TextInput
                ref={directEditorRef}
                multiline
                editable={editing}
                value={pagesMarkup[currentPageNumber] ?? ''}
                onChangeText={handleEditorTextChange}
                style={{
                  flex: 1,
                  color: '#2F241A',
                  fontSize: 15,
                  lineHeight: 30,
                  fontFamily: 'sanari',
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                  textAlignVertical: 'top',
                }}
                selectionColor="#5F4430"
                selection={editorSelection}
                onSelectionChange={(e) => setEditorSelection(e.nativeEvent.selection)}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}

          {editing && (
            <View
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: (isKeyboardVisible ? keyboardHeight : 0) + 8,
                zIndex: 45,
                backgroundColor: 'rgba(252, 250, 246, 0.97)',
                borderWidth: 1,
                borderColor: '#DED2C3',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 6,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              {[
                { key: 'text', label: '文章' },
                { key: 'chapter', label: '大' },
                { key: 'section', label: '中' },
                { key: 'subsection', label: '小' },
                { key: 'word', label: '単語/意味' },
                { key: 'image', label: '画像' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => handleInsertTemplate(item.key as keyof typeof TAG_TEMPLATES)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#CFC0AF',
                    backgroundColor: '#F6EFE5',
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4A3A2C' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          </Animated.View>

          {showSearch && !editing && (
            <TouchableWithoutFeedback onPress={closeSearchPanel}>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 20,
                }}
              />
            </TouchableWithoutFeedback>
          )}
          {/* 編集ボタン
          虫眼鏡ボタン
          スライダー */}
        {/* </NoteBackground> */}

          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 30,
              elevation: 30,
            }}
          >
            {/* ページ番号（右上） */}
            <View style={notebookStyles.pageNumberBadge}>
              <Text style={notebookStyles.pageNumberText}>
                {`${Math.min(currentPageNumber + 1, Math.max(pagesElements.length, 1))}/${Math.max(pagesElements.length, 1)}`}
              </Text>
            </View>

            {/* ノートタイトル（左上） */}
            <Text style={notebookStyles.noteTitleText} numberOfLines={1} ellipsizeMode="tail">
              {book.title}
            </Text>

            {!editing && (
              <TouchableOpacity
                disabled={editing || isSavingPage}
                onPress={() => {
                  console.log('ページ一覧ボタン押下');
                  openPageList();
                }}
                style={[
                  notebookStyles.pageListBtn,
                  { backgroundColor: floatingButtonBg, borderColor: floatingButtonBorder },
                  isSavingPage ? { opacity: 0.6 } : null,
                  { position: 'absolute', bottom: commonStyle.screenHeight * 0.02 + (commonStyle.screenWidth / 6 - commonStyle.screenWidth / 7) / 2, left: 20 },
                  getDebugStyle('rgba(0, 0, 0, 0.4)'),
                ]}
              >
                <Ionicons name="copy-outline" size={commonStyle.screenWidth/15} color={floatingButtonIcon} />
              </TouchableOpacity>
            )}

            {/* スライダー（ページ一覧ボタンと+ボタンの間） */}
            {!editing && (
              <View style={notebookStyles.sliderShell}>
                <Slider
                  style={{ flex: 1 }}
                  minimumValue={0}
                  maximumValue={Math.max(pagesElements.length - 1, 0)}
                  step={1}
                  value={currentPageNumber}
                  minimumTrackTintColor={notebookColors.ink}
                  maximumTrackTintColor={notebookColors.paperLine}
                  thumbTintColor={sliderThumbColor}
                  onValueChange={ async(v) => {
                    setcurrentPageNumber(v);
                    console.log('ページ数変更:', v+1);
                    await loadPageFromDB(v);
                  }}
                />
              </View>
            )}

            {/* ページ追加ボタン（右下）+ */}
            {!editing && (
              <TouchableOpacity
                style={[
                  notebookStyles.editButton,
                  { backgroundColor: floatingButtonBg, borderColor: floatingButtonBorder },
                  { bottom: commonStyle.screenHeight * 0.02 }
                ]}
                onPress={async () => {
                  console.log('ページ追加ボタン押下');
                  closeMenu();
                  await insertPageAfterCurrent();
                }}
              >
                <Ionicons name="add" size={commonStyle.screenWidth / 12} color={floatingButtonIcon} />
              </TouchableOpacity>
            )}
          </View>

          {showHelpOverlay && (
            <TouchableWithoutFeedback onPress={() => setShowHelpOverlay(false)}>
              <View pointerEvents="auto" style={notebookStyles.helpOverlay}>
              <View style={[notebookStyles.helpBubble, { top: 12, right: 12, maxWidth: commonStyle.screenWidth * 0.42 }]}>
                <Text style={notebookStyles.helpTitle}>メニュー</Text>
                <Text style={notebookStyles.helpText}>検索、見出し番号表示、ページ削除</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { top: 14, left: 18, maxWidth: commonStyle.screenWidth * 0.45 }]}>
                <Text style={notebookStyles.helpTitle}>目次</Text>
                <Text style={notebookStyles.helpText}>大・中・小見出しの一覧</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { top: 62, right: 16, maxWidth: commonStyle.screenWidth * 0.35 }]}>
                <Text style={notebookStyles.helpTitle}>ページ番号</Text>
                <Text style={notebookStyles.helpText}>現在のページ数</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { bottom: commonStyle.screenHeight * 0.12, left: 18, maxWidth: commonStyle.screenWidth * 0.46 }]}>
                <Text style={notebookStyles.helpTitle}>ページ一覧</Text>
                <Text style={notebookStyles.helpText}>ページの移動や並び替え</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { bottom: commonStyle.screenHeight * 0.105, right: 18, maxWidth: commonStyle.screenWidth * 0.46 }]}>
                <Text style={notebookStyles.helpTitle}>ページ追加</Text>
                <Text style={notebookStyles.helpText}>開いているページの次に新しいページを追加</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { bottom: commonStyle.screenHeight * 0.19, left: commonStyle.screenWidth * 0.3, maxWidth: commonStyle.screenWidth * 0.4 }]}>
                <Text style={notebookStyles.helpTitle}>スライダー</Text>
                <Text style={notebookStyles.helpText}>ページの切り替え。</Text>
              </View>
              </View>
            </TouchableWithoutFeedback>
          )}

          {/* 編集画面: EditorScreenは廃止。NoteContentが直接編集機能を提供 */}

          {/* 🔍 検索欄と検索結果 */}
          {showSearch && (
            <View style={[notebookStyles.searchResultsContainer, { bottom: isKeyboardVisible ? keyboardHeight : 0 }]}>
              {/* 検索結果一覧 */}
              {searchResults.length > 0 && (
                <FlatList
                  data={searchResults}
                  keyExtractor={(_, i) => `result-${i}`}
                  style={notebookStyles.searchResultsList}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={async () => {
                        setcurrentPageNumber(item.pageNum);
                        if (!Array.isArray(pagesElementsRef.current[item.pageNum])) {
                          await loadPageFromDB(item.pageNum);
                        }
                        // 候補選択後もキーボードを維持して連続検索できるようにする
                        requestAnimationFrame(() => {
                          searchInputRef.current?.focus();
                        });
                      }}
                      style={notebookStyles.searchResultItem}
                    >
                      <Text style={notebookStyles.searchResultMeta}>ページ {item.pageNum + 1} ・ {item.type}</Text>
                      <Text numberOfLines={2} style={notebookStyles.searchResultText}>{item.text}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
              <View
                style={[
                  notebookStyles.searchBoxContainer,
                  getDebugStyle('rgba(255, 0, 0, 0.2)'),
                ]}
              >
                <Ionicons name="search" size={commonStyle.screenWidth / 12} color="gray" />
                <TextInput
                  style={notebookStyles.searchBoxInput}
                  ref={searchInputRef}
                  placeholder="検索キーワードを入力"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="none"
                  keyboardAppearance="default"
                  placeholderTextColor={notebookColors.inkSoft}
                />
                <TouchableOpacity style={notebookStyles.searchCloseButton} onPress={() => {
                  console.log('検索欄クリアボタン押下');
                  setSearchQuery('');
                  requestAnimationFrame(() => {
                    searchInputRef.current?.focus();
                  });
                }}>
                  <Ionicons name="close" size={commonStyle.screenWidth / 16} color={notebookColors.ink} />
                </TouchableOpacity>
              </View>
            </View>
          )}

      </View>
    </TouchableWithoutFeedback>

      {/* ===== 目次モーダル ===== */}
      <Modal
        visible={tocVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTocVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTocVisible(false)}>
          <View style={notebookStyles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[notebookStyles.modalCard, notebookStyles.tocCard]}>
            <View style={notebookStyles.modalHeaderRow}>
              <Text style={[notebookStyles.modalTitle, { marginBottom: 0 }]}>目次</Text>
              <TouchableOpacity
                onPress={() => setIsTocExpanded((prev) => !prev)}
                style={notebookStyles.tocModeToggleBtn}
              >
                <Ionicons
                  name={isTocExpanded ? 'chevron-up-outline' : 'expand-outline'}
                  size={16}
                  color={notebookColors.ink}
                />
                <Text style={notebookStyles.tocModeToggleText}>
                  {isTocExpanded ? 'プルダウン' : '全体表示'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, minHeight: 0 }}>
            {tocItems.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={notebookStyles.modalEmptyText}>見出しがありません</Text>
              </View>
            ) : (
              isTocExpanded ? (
                <FlatList
                  data={tocItems}
                  keyExtractor={(_, i) => `toc-${i}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => { setcurrentPageNumber(item.pageNum); setTocVisible(false); }}
                      style={[notebookStyles.tocItem, { paddingLeft: item.indentLevel * 16 }]}
                    >
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15 - item.indentLevel, fontWeight: item.indentLevel === 0 ? 'bold' : 'normal', color: notebookColors.ink }}>{item.text}</Text>
                      <Text style={notebookStyles.tocItemDots}>・・・</Text>
                      <Text style={notebookStyles.tocItemPage}>p{item.pageNum + 1}</Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <FlatList
                  data={tocChapterGroups}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => {
                    const isOpen = tocOpenSections[item.key] === true;
                    return (
                      <View style={notebookStyles.tocAccordionBlock}>
                        <TouchableOpacity
                          onPress={() => {
                            setTocOpenSections((prev) => ({
                              ...prev,
                              [item.key]: !isOpen,
                            }));
                          }}
                          style={notebookStyles.tocAccordionHeader}
                        >
                          <View style={notebookStyles.tocAccordionHeaderTextWrap}>
                            <Text numberOfLines={1} style={notebookStyles.tocAccordionTitle}>{item.chapter.text}</Text>
                            <Text style={notebookStyles.tocItemDots}>・・・</Text>
                            <Text style={notebookStyles.tocItemPage}>p{item.chapter.pageNum + 1}</Text>
                          </View>
                          <Ionicons
                            name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                            size={18}
                            color={notebookColors.inkSoft}
                          />
                        </TouchableOpacity>
                        {isOpen && item.children.length > 0 && (
                          <View style={notebookStyles.tocAccordionChildren}>
                            {item.children.map((child, childIndex) => (
                              <TouchableOpacity
                                key={`${item.key}-child-${childIndex}`}
                                onPress={() => {
                                  setcurrentPageNumber(child.pageNum);
                                  setTocVisible(false);
                                }}
                                style={[notebookStyles.tocItem, notebookStyles.tocAccordionChildItem, { paddingLeft: child.indentLevel * 16 }]}
                              >
                                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15 - child.indentLevel, color: notebookColors.ink }}>
                                  {child.text}
                                </Text>
                                <Text style={notebookStyles.tocItemDots}>・・・</Text>
                                <Text style={notebookStyles.tocItemPage}>p{child.pageNum + 1}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )
            )}
            </View>
            <TouchableOpacity
              onPress={() => setTocVisible(false)}
              style={{ marginTop: 12, alignSelf: 'flex-end' }}
            >
              <Text style={notebookStyles.modalCloseText}>閉じる</Text>
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ===== ページ一覧モーダル ===== */}
      <Modal
        visible={pageListVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPageListVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPageListVisible(false)}>
          <View style={notebookStyles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[notebookStyles.modalCard, notebookStyles.pageListCard]}>
                <Text style={notebookStyles.modalTitle}>ページ一覧</Text>
            <View style={notebookStyles.pageListGridWrap}>
              <ScrollView
                style={notebookStyles.pageListGridScroll}
                contentContainerStyle={notebookStyles.pageListGridScrollContent}
                showsVerticalScrollIndicator
              >
                <View style={[notebookStyles.pageListGrid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
                  {pageListItems.map((item, order) => {
                    const thumbUri = item.thumbUri;
                    const isCurrentPage = order === currentPageNumber;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={{ width: '50%' }}
                        onPress={() => {
                          setcurrentPageNumber(order);
                          setPageListVisible(false);
                        }}
                      >
                        <View style={[notebookStyles.pageListItem, isCurrentPage && notebookStyles.pageListItemActive]}>
                          <View style={{ width: '100%', aspectRatio: 0.65, backgroundColor: '#F3ECE2' }}>
                            {thumbUri ? (
                              <Image
                                source={{ uri: thumbUri }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Image
                                source={require('../../assets/images/note.png')}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            )}
                          </View>
                          <View style={[notebookStyles.pageListLabel, isCurrentPage && notebookStyles.pageListLabelActive]}>
                            <Text style={[notebookStyles.pageListLabelText, isCurrentPage && notebookStyles.pageListLabelTextActive]}>
                              {order + 1}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <TouchableOpacity
              onPress={() => setPageListVisible(false)}
              style={{ marginTop: 8, alignSelf: 'flex-end' }}
            >
              <Text style={notebookStyles.modalCloseText}>閉じる</Text>
            </TouchableOpacity>
          </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ===== 要素タイプ選択モーダル（インプレース追加） ===== */}
      <Modal
        visible={typePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTypePickerVisible(false)}>
          <View style={notebookStyles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[notebookStyles.modalCard, notebookStyles.typePickerCard]}>
                <Text style={[notebookStyles.modalTitle, { textAlign: 'center' }]}>追加する要素を選択</Text>
                <ScrollView
                  style={{ maxHeight: screenHeight * 0.56 }}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={notebookStyles.typePickerSection}>
                    <Text style={notebookStyles.typePickerSectionTitle}>見出し</Text>
                    <View style={notebookStyles.typePickerGridOutline}>
                      {ELEMENT_LABELS
                        .filter(({ type }) => type === 'chapter' || type === 'section' || type === 'subsection')
                        .map(({ label, type, iconName }) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => handleAddElement(type)}
                            style={[
                              notebookStyles.typePickerOption,
                              notebookStyles.typePickerOptionOutline,
                              notebookStyles.typePickerOptionOutlineCompact,
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[notebookStyles.typePickerOptionText, notebookStyles.typePickerOptionOutlineText]}>{label}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>

                  <View style={notebookStyles.typePickerSection}>
                    <Text style={[notebookStyles.typePickerSectionTitle, { marginBottom: 6 }]}>本文系</Text>
                    <View style={notebookStyles.typePickerGrid}>
                      {ELEMENT_LABELS
                        .filter(({ type }) => type === 'text' || type === 'word' || type === 'image')
                        .map(({ label, type, iconName }) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => handleAddElement(type)}
                            style={[notebookStyles.typePickerOption, notebookStyles.typePickerOptionContent]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {iconName ? <Ionicons name={iconName} size={16} color="#FFF8F0" style={{ marginRight: 6 }} /> : null}
                              <Text style={[notebookStyles.typePickerOptionText, notebookStyles.typePickerOptionContentText]}>{label}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>

                </ScrollView>
                <TouchableOpacity
                  onPress={() => setTypePickerVisible(false)}
                  style={notebookStyles.typePickerCancel}
                >
                  <Text style={notebookStyles.typePickerCancelText}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </>
  );
};

export default NotebookScreen;

