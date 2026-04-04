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
import { DraggableGrid } from 'react-native-draggable-grid';
import { RouteProp, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { notebookColors, notebookStyles } from '../styles/notebookStyle';
import * as commonStyle from '../styles/commonStyle';
import NoteContent, { computeMaxRows, NOTE_OUTER_MARGIN } from './NoteContent';
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

type PageListViewport = {
  y: number;
  height: number;
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
  addContent, addText, addWord, addImage, addOutline, getContentsByBookId, 
  getTextsByContentId, getOutlinesByContentId, getWordsByContentId, getImagesByContentId,
  addPageImage, updatePageImage, getPageImagesByBookId,
  deleteContent, deleteAllContentsByBookId,
  select, updateContent
} = useEditor();

  const isTest = ENV.SCREEN_DEV;
  const navigation = useNavigation<any>();
  const { bookId, initialPage } = route.params;
  const { state, dispatch, deleteBook } = useLibrary();

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
  // useLayoutEffect クロージャで古い値を参照しないよう常に最新を保持する ref
  const pagesElementsRef = useRef<NoteElement[][]>([]);
  const currentPageNumberRef = useRef<number>(0);
  const didApplyInitialPageRef = useRef(false);
  pagesElementsRef.current = pagesElements;
  currentPageNumberRef.current = currentPageNumber;

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
  // 行タップ時の編集開始フォーカス先インデックス
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | undefined>(undefined);
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
  const [isPageListDragging, setIsPageListDragging] = useState(false);
  const pageListGridWrapRef = useRef<View | null>(null);
  const pageListScrollRef = useRef<ScrollView | null>(null);
  const pageListScrollOffsetRef = useRef(0);
  const pageListContentHeightRef = useRef(0);
  const pageListViewportRef = useRef<PageListViewport | null>(null);
  const lastAutoScrollAtRef = useRef(0);

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

  const persistPageOrderToDB = async (reordered: PageListItem[]) => {
    const pageMoves = reordered
      .map((item, newPage) => ({ oldPage: item.originalPage, newPage }))
      .filter((m) => m.oldPage !== m.newPage);

    if (pageMoves.length === 0) return;

    const [contents, allPageImages] = await Promise.all([
      getContentsByBookId(bookId),
      getPageImagesByBookId(bookId),
    ]);

    const contentMoves = pageMoves
      .map((move) => {
        const row = contents.find((c) => c.page === move.oldPage);
        return row ? { contentId: row.content_id, newPage: move.newPage } : null;
      })
      .filter((m): m is { contentId: string; newPage: number } => Boolean(m));

    const imageMoves = pageMoves
      .map((move) => {
        const row = allPageImages.find((img) => Number(img.page_order) === move.oldPage);
        return row ? { pageImageId: row.page_image_id, newPage: move.newPage } : null;
      })
      .filter((m): m is { pageImageId: string; newPage: number } => Boolean(m));

    const TEMP_OFFSET = 10000;

    for (const move of contentMoves) {
      await updateContent(move.contentId, { page: move.newPage + TEMP_OFFSET });
    }
    for (const move of imageMoves) {
      await updatePageImage(move.pageImageId, { page_order: move.newPage + TEMP_OFFSET });
    }
    for (const move of contentMoves) {
      await updateContent(move.contentId, { page: move.newPage });
    }
    for (const move of imageMoves) {
      await updatePageImage(move.pageImageId, { page_order: move.newPage });
    }
  };

  const handlePageListDragEnd = async (reorderedItems: PageListItem[]) => {
    if (!Array.isArray(reorderedItems) || reorderedItems.length === 0) return;

    const prevCurrentPage = currentPageNumber;

    const reorderedPages = reorderedItems.map((item) => item.elements);
    const reorderedUris: Record<number, string> = {};

    reorderedItems.forEach((item, newIndex) => {
      if (item.thumbUri) {
        reorderedUris[newIndex] = item.thumbUri;
      }
    });

    const nextPageListItems = reorderedItems.map((item, index) => ({
      ...item,
      originalPage: index,
      elements: reorderedPages[index],
      thumbUri: reorderedUris[index],
    }));

    const movedCurrentIndex = reorderedItems.findIndex((item) => item.originalPage === prevCurrentPage);
    const nextCurrentPage = movedCurrentIndex >= 0 ? movedCurrentIndex : currentPageNumber;

    // 複数の state 更新を同時に行うため、setTimeout で次の microtask で一括実行
    // これにより React の自動バッチ処理が有効になり、レンダリングが1回に統合される
    setTimeout(() => {
      setPagesElements(reorderedPages);
      setPageImageUris(reorderedUris);
      setPageListItems(nextPageListItems);
      setcurrentPageNumber(nextCurrentPage);
    }, 0);

    try {
      await persistPageOrderToDB(reorderedItems);
    } catch (e) {
      console.error('ページ並び替え保存エラー:', e);
    }
  };

  const handlePageListDragging = (gestureState: { moveY: number }) => {
    const viewport = pageListViewportRef.current;
    if (!viewport) return;

    const EDGE_THRESHOLD = 70;
    const SCROLL_STEP = 18;
    const now = Date.now();
    if (now - lastAutoScrollAtRef.current < 16) return;

    const maxOffset = Math.max(0, pageListContentHeightRef.current - viewport.height);
    if (maxOffset <= 0) return;

    const topEdge = viewport.y + EDGE_THRESHOLD;
    const bottomEdge = viewport.y + viewport.height - EDGE_THRESHOLD;
    let nextOffset = pageListScrollOffsetRef.current;

    if (gestureState.moveY < topEdge) {
      nextOffset = Math.max(0, pageListScrollOffsetRef.current - SCROLL_STEP);
    } else if (gestureState.moveY > bottomEdge) {
      nextOffset = Math.min(maxOffset, pageListScrollOffsetRef.current + SCROLL_STEP);
    } else {
      return;
    }

    if (nextOffset !== pageListScrollOffsetRef.current) {
      pageListScrollOffsetRef.current = nextOffset;
      pageListScrollRef.current?.scrollTo({ y: nextOffset, animated: false });
      lastAutoScrollAtRef.current = now;
    }
  };

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
        type: 'text',
        book_id: bookId,
        page: insertPosition,
        height: 0,
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

  const ELEMENT_LABELS: { label: string; type: NoteElement['type'] }[] = [
    { label: '章', type: 'chapter' },
    { label: '節', type: 'section' },
    { label: '項', type: 'subsection' },
    { label: '文章', type: 'text' },
    { label: '単語', type: 'word' },
    { label: '画像', type: 'image' },
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


  // ===== インプレース編集ハンドラー =====
  const handleElementChange = (index: number, newEl: NoteElement) => {
    if (!outlineNumberingEnabled && (newEl.type === 'chapter' || newEl.type === 'section' || newEl.type === 'subsection')) {
      setOutlineNumberingEnabled(true);
    }

    const prevEl = pagesElementsRef.current[currentPageNumber]?.[index];
    const hasPrefixAfter = OUTLINE_PREFIX_RE.test((newEl as any).text || '');

    let nextEl: NoteElement = newEl;
    if (newEl.type === 'chapter' || newEl.type === 'section' || newEl.type === 'subsection') {
      const autoDisabledBefore = (prevEl as any)?.autoNumberingDisabled === true;
      if (hasPrefixAfter) {
        nextEl = { ...newEl, autoNumberingDisabled: false };
      } else {
        nextEl = { ...newEl, autoNumberingDisabled: true };
      }

      // preserve explicit disable when prefix was already removed and user continues editing without prefix
      if (!hasPrefixAfter && autoDisabledBefore) {
        nextEl.autoNumberingDisabled = true;
      }
    }

    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) next[currentPageNumber] = [];
      const updated = next[currentPageNumber].map((el, i) => (i === index ? nextEl : el));
      next[currentPageNumber] = updated;
      return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
    });
  };

  const handleDeleteElement = (index: number) => {
    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) return next;
      const updated = next[currentPageNumber].filter((_, i) => i !== index);
      next[currentPageNumber] = updated;
      return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
    });
  };

  const handleTapEmpty = (afterIndex: number) => {
    const maxRows = computeMaxRows(headerHeight);
    const currentElements = pagesElements[currentPageNumber] ?? [];
    if (currentElements.length >= maxRows) return; // 上限に達した場合は追加しない
    const newEl: NoteElement = { type: 'text', text: '' };
    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) next[currentPageNumber] = [];
      const arr = [...next[currentPageNumber]];
      arr.splice(afterIndex, 0, newEl);
      next[currentPageNumber] = arr;
      return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
    });
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
    setPendingFocusIndex(index);
    // Ensure NoteContent re-mounts so initialFocusIndex is applied deterministically.
    setNoteContentKey((prev) => prev + 1);
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
  const handleSave = async () => {
    if (isSavingPage) return;
    setIsSavingPage(true);
    try {
      Keyboard.dismiss();
      const pageNumber = await savePageToDB(); // ref から最新ページ番号取得
      if (pageNumber !== undefined) {
        // 保存後は全ページを再読み込みして DB との整合性を確保
        await loadAllPages();
        setEditing(false);
        setPendingFocusIndex(undefined);
        // 体感遅延を減らすためサムネイル更新は非同期で実行
        scheduleThumbnailSync(pageNumber);
      }
    } catch (e) {
      console.error('保存エラー:', e);
      setEditing(false);
      setPendingFocusIndex(undefined);
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

  // 📌 ページ保存ロジック
  const savePageToDB = async () => {
    try {
      // ref から最新の値を取得（useLayoutEffect のクロージャが古い state を掴む問題を回避）
      const pageNumber = currentPageNumberRef.current;
      const elems = pagesElementsRef.current[pageNumber];

      // ⭐ 1) 既存 content をカスケード削除
      const oldContents = await getContentsByBookId(bookId);
      const oldPageContent = oldContents.find(c => c.page === pageNumber);
      if (oldPageContent) {
        await deleteContent(oldPageContent.content_id);
      }

      // ⭐ 2) 新しい content を追加して保存
      const contentId = await Crypto.randomUUID();
      await addContent({
        content_id: contentId,
        type: 'text',
        book_id: bookId,
        page: pageNumber,
        height: 0,
      } as Content);

      if (Array.isArray(elems) && elems.length > 0) {
        for (let i = 0; i < elems.length; i++) {
          const el = elems[i];
          const orderPrefix = String(i).padStart(4, '0');
          const elemId = `${orderPrefix}_${await Crypto.randomUUID()}`;
          if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
            await addOutline({ outline_id: elemId, type: el.type, outline: (el as any).text, content_id: contentId });
          } else if (el.type === 'word') {
            await addWord({ word_id: elemId, word: (el as any).word, explanation: (el as any).meaning || '', word_order: i, content_id: contentId });
          } else if (el.type === 'image') {
            await addImage({ image_id: elemId, image: (el as any).uri, content_id: contentId });
          } else if (el.type === 'text') {
            await addText({ text_id: elemId, text: (el as any).text, content_id: contentId });
          }
        }
      }
      return pageNumber; // 保存したページ番号を返す
    } catch (e) {
      console.error('保存エラー:', e);
      throw e;
    }
  };

  const loadPageFromDB = async (pageNumber: number, options?: { returnText?: boolean }) => {
    try {
      const contents = await getContentsByBookId(bookId);
      const pageContentRow = contents.find(c => c.page === pageNumber);

      if (!pageContentRow) return;

      const contentId = pageContentRow.content_id;

      const [texts, outlines, words, images] = await Promise.all([
        getTextsByContentId(contentId),
        getOutlinesByContentId(contentId),
        getWordsByContentId(contentId),
        getImagesByContentId(contentId),
      ]);

      // 全要素をIDでまとめてソートし、保存時の順序を復元する
      // IDは "0000_uuid" 形式（savePageToDB で付与）→辞書順ソートで元の挿入順になる
      type RawItem =
        | { id: string; kind: 'outline'; data: typeof outlines[0] }
        | { id: string; kind: 'text';    data: typeof texts[0] }
        | { id: string; kind: 'word';    data: typeof words[0] }
        | { id: string; kind: 'image';   data: typeof images[0] };

      const all: RawItem[] = [
        ...outlines.map(o  => ({ id: o.outline_id,  kind: 'outline' as const, data: o })),
        ...texts.map(t    => ({ id: t.text_id,     kind: 'text'    as const, data: t })),
        ...words.map(w    => ({ id: w.word_id,     kind: 'word'    as const, data: w })),
        ...images.map(img => ({ id: (img as any).image_id, kind: 'image' as const, data: img })),
      ];

      // IDの先頭4桁が順序プレフィックス。古いデータ（プレフィックスなし）はそのまま末尾に
      all.sort((a, b) => a.id.localeCompare(b.id));

      const elements: NoteElement[] = all.map(item => {
        if (item.kind === 'outline') {
          const o = item.data as typeof outlines[0];
          const slimText = stripOutlinePrefix(o.outline || '');
          const hasPrefix = OUTLINE_PREFIX_RE.test(o.outline || '');
          return {
            type: o.type as 'chapter' | 'section' | 'subsection',
            text: slimText,
            autoNumberingDisabled: !hasPrefix && !outlineNumberingEnabled,
          };
        }
        if (item.kind === 'text') {
          return { type: 'text' as const, text: (item.data as typeof texts[0]).text };
        }
        if (item.kind === 'word') {
          const w = item.data as typeof words[0];
          return { type: 'word' as const, word: w.word, meaning: w.explanation };
        }
        // image
        const img = item.data as typeof images[0];
        return { type: 'image' as const, uri: (img as any).image_path || (img as any).image || '' };
      });

      // pagesElements を更新して UI が NoteElement を使えるようにする
      setPagesElements(prev => {
        const next = [...prev];
        next[pageNumber] = elements;
        return applyOutlineNumberingAllPages(next, outlineNumberingEnabled);
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
          type: 'text',
          book_id: bookId,
          page: p,
          height: 0,
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

    // 各ページの要素を取得してまとめてセット（一括更新で順序ずれを防ぐ）
    for (const content of sortedContents) {
      const p = content.page;
      const contentId = content.content_id;
      const [texts, outlines, words, images] = await Promise.all([
        getTextsByContentId(contentId),
        getOutlinesByContentId(contentId),
        getWordsByContentId(contentId),
        getImagesByContentId(contentId),
      ]);

      type RawItem =
        | { id: string; kind: 'outline'; data: typeof outlines[0] }
        | { id: string; kind: 'text';    data: typeof texts[0] }
        | { id: string; kind: 'word';    data: typeof words[0] }
        | { id: string; kind: 'image';   data: typeof images[0] };

      const all: RawItem[] = [
        ...outlines.map(o  => ({ id: o.outline_id,  kind: 'outline' as const, data: o })),
        ...texts.map(t    => ({ id: t.text_id,     kind: 'text'    as const, data: t })),
        ...words.map(w    => ({ id: w.word_id,     kind: 'word'    as const, data: w })),
        ...images.map(img => ({ id: (img as any).image_id, kind: 'image' as const, data: img })),
      ];
      all.sort((a, b) => a.id.localeCompare(b.id));

      newPagesElements[p] = all.map(item => {
        if (item.kind === 'outline') {
          const o = item.data as typeof outlines[0];
          const slimText = stripOutlinePrefix(o.outline || '');
          const hasPrefix = OUTLINE_PREFIX_RE.test(o.outline || '');
          return {
            type: o.type as 'chapter' | 'section' | 'subsection',
            text: slimText,
            autoNumberingDisabled: !hasPrefix && !outlineNumberingEnabled,
          };
        }
        if (item.kind === 'text') {
          return { type: 'text' as const, text: (item.data as typeof texts[0]).text };
        }
        if (item.kind === 'word') {
          const w = item.data as typeof words[0];
          return { type: 'word' as const, word: w.word, meaning: w.explanation };
        }
        const img = item.data as typeof images[0];
        return { type: 'image' as const, uri: (img as any).image_path || (img as any).image || '' };
      });
    }

    // 一括で State を更新（順序が確実に保証される）。全ページ通しで章番号を連番付与する。
    setPagesElements(applyOutlineNumberingAllPages(newPagesElements, outlineNumberingEnabled));
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

  // 初期2ページのサムネイルを自動生成（初回ロード時のみ）
  useEffect(() => {
    const saveThumbnails = async () => {
      try {
        if (pagesElements.length >= 2) {
          const pageImages = await getPageImagesByBookId(bookId);
          
          // 初回時はサムネイル生成をスキップ（page_images はすでに作成済み、image_pathは空）
          const isInitialLoad = pageImages.every(img => !img.image_path);
          if (isInitialLoad) {
            return; // UI更新なしでスキップ
          }
          
          // 2回目以降のみサムネイル生成処理を実行
          for (let p = 0; p < 2; p++) {
            const exists = pageImages.find(img => Number(img.page_order) === p && img.image_path);
            if (!exists) {
              setTimeout(() => {
                setcurrentPageNumber(p);
                setTimeout(() => saveThumbnailAsync(p), 300);
              }, 100);
            }
          }
        }
      } catch (e) {
        console.warn('初期サムネイル生成エラー:', e);
      }
    };
    saveThumbnails();
  }, [pagesElements.length]);

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
    if (editing) {
      setShowHelpOverlay(false);
    }
  }, [editing]);

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
              const pageNumber = currentPageNumberRef.current;
              await savePageToDB();
              await loadAllPages();
              setEditing(false);
              setTimeout(() => saveThumbnailAsync(pageNumber), 400);
              setTimeout(() => {
                navigation.dispatch(data.action);
              }, 500);
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
        backgroundColor: notebookColors.paper,
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
          // 編集中: はてな + チェックボタン（保存）
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowHelpOverlay((prev) => !prev)}
              style={[
                notebookStyles.menuBtn,
                notebookStyles.menuBtnIcon,
                showHelpOverlay && notebookStyles.menuBtnIconActive,
              ]}
            >
              <Ionicons
                name={showHelpOverlay ? 'help-circle' : 'help-circle-outline'}
                size={20}
                color={showHelpOverlay ? '#FFFFFF' : notebookColors.ink}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { console.log('保存ボタン押下'); handleSave(); }}
              style={notebookStyles.menuBtn}
            >
              <Ionicons name="checkmark" size={24} color={notebookColors.ink} />
            </TouchableOpacity>
          </View>
        ) : (
          // 通常: ミートボールメニュー
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
            <View>
              <TouchableOpacity
                onPress={() => setShowHelpOverlay((prev) => !prev)}
                style={[
                  notebookStyles.menuBtn,
                  notebookStyles.menuBtnIcon,
                  showHelpOverlay && notebookStyles.menuBtnIconActive,
                ]}
              >
                <Ionicons
                  name={showHelpOverlay ? 'help-circle' : 'help-circle-outline'}
                  size={20}
                  color={showHelpOverlay ? '#FFFFFF' : notebookColors.ink}
                />
              </TouchableOpacity>
            </View>
            <View>
              <Menu
                key={menuVisible ? 'open' : 'closed'}
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                  <TouchableOpacity
                    onPress={() => { console.log('メニューボタン押下'); openMenu(); }}
                    style={[notebookStyles.menuBtn, notebookStyles.menuBtnIcon, getDebugStyle('rgba(0, 255, 0, 0.15)')]}> 
                    <Ionicons name="ellipsis-horizontal" size={24} color={notebookColors.ink} />
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
                title={outlineNumberingEnabled ? '章・節番号を非表示' : '章・節番号を表示'}
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
                leadingIcon="trash-can"
                titleStyle={MENU_ITEM_TITLE_STYLE}
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
      disabled={editing || showSearch}
      onPress={() => {
        closeSearchPanel();
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
            elements={(pagesElements[currentPageNumber] || []).filter((el): el is NoteElement => Boolean(el && (el as any).type))}
            onNoteLayout={setNoteBounds}
            onSwipePage={handleNoteSwipePage}
            isEditing={editing}
            onElementChange={handleElementChange}
            onDeleteElement={handleDeleteElement}
            onTapEmpty={handleTapEmpty}
            onEditStart={handleEditStart}
            initialFocusIndex={pendingFocusIndex}
            onBackgroundGenerated={(uri: string) => {
              console.log('背景画像生成完了:', uri);
            }}
          />
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
              <Text style={notebookStyles.pageNumberText}>{currentPageNumber + 1}</Text>
            </View>

            {/* ノートタイトル（左上） */}
            <Text style={notebookStyles.noteTitleText} numberOfLines={1} ellipsizeMode="tail">
              {book.title}
            </Text>

            {/* ページ一覧ボタン（左下） */}
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
                <Text style={notebookStyles.helpText}>検索、章番号表示、ページ削除</Text>
              </View>

              <View style={[notebookStyles.helpBubble, { top: 14, left: 18, maxWidth: commonStyle.screenWidth * 0.45 }]}>
                <Text style={notebookStyles.helpTitle}>目次</Text>
                <Text style={notebookStyles.helpText}>章節項の見出し一覧</Text>
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
            {tocItems.length === 0 ? (
              <Text style={notebookStyles.modalEmptyText}>見出しがありません</Text>
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
            <View
              ref={pageListGridWrapRef}
              style={notebookStyles.pageListGridWrap}
              onLayout={() => {
                requestAnimationFrame(() => {
                  pageListGridWrapRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                    pageListViewportRef.current = { y, height };
                  });
                });
              }}
            >
              <ScrollView
                ref={pageListScrollRef}
                style={notebookStyles.pageListGridScroll}
                contentContainerStyle={notebookStyles.pageListGridScrollContent}
                showsVerticalScrollIndicator
                scrollEnabled={!isPageListDragging}
                onScroll={(e) => {
                  pageListScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                }}
                onContentSizeChange={(_w, h) => {
                  pageListContentHeightRef.current = h;
                }}
                scrollEventThrottle={16}
              >
                <DraggableGrid
                  numColumns={2}
                  data={pageListItems}
                  style={notebookStyles.pageListGrid}
                  itemHeight={commonStyle.screenWidth * 0.64}
                  delayLongPress={180}
                  onDragStart={() => {
                    setIsPageListDragging(true);
                  }}
                  onDragging={(gestureState) => {
                    handlePageListDragging(gestureState);
                  }}
                  onItemPress={(item) => {
                    const selectedIndex = pageListItems.findIndex((p) => String(p.key) === String(item.key));
                    if (selectedIndex >= 0) {
                      setcurrentPageNumber(selectedIndex);
                      setPageListVisible(false);
                    }
                  }}
                  onDragRelease={(data) => {
                    setIsPageListDragging(false);
                    void handlePageListDragEnd(data as PageListItem[]);
                  }}
                  renderItem={(item, order) => {
                    const thumbUri = item.thumbUri;
                    const isCurrentPage = order === currentPageNumber;
                    return (
                      <View style={[notebookStyles.pageListItem, isCurrentPage && notebookStyles.pageListItemActive]}>
                        {thumbUri ? (
                          <Image
                            source={{ uri: thumbUri }}
                            style={{ width: '100%', aspectRatio: 0.65 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={notebookStyles.pageListPlaceholder}>
                            <Ionicons name="document-outline" size={32} color="#ccc" />
                            <Text style={notebookStyles.pageListPlaceholderText}>未保存</Text>
                          </View>
                        )}
                        <View style={[notebookStyles.pageListLabel, isCurrentPage && notebookStyles.pageListLabelActive]}>
                          <Text style={[notebookStyles.pageListLabelText, isCurrentPage && notebookStyles.pageListLabelTextActive]}>
                            {order + 1}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
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
                <View style={notebookStyles.typePickerSection}>
                  <Text style={notebookStyles.typePickerSectionTitle}>見出し系</Text>
                  <View style={notebookStyles.typePickerGridOutline}>
                    {ELEMENT_LABELS
                      .filter(({ type }) => type === 'chapter' || type === 'section' || type === 'subsection')
                      .map(({ label, type }) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => handleAddElement(type)}
                          style={[
                            notebookStyles.typePickerOption,
                            notebookStyles.typePickerOptionOutline,
                            notebookStyles.typePickerOptionOutlineCompact,
                          ]}
                        >
                          <Text style={[notebookStyles.typePickerOptionText, notebookStyles.typePickerOptionOutlineText]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>

                <View style={notebookStyles.typePickerSection}>
                  <Text style={notebookStyles.typePickerSectionTitle}>本文系</Text>
                  <View style={notebookStyles.typePickerGrid}>
                    {ELEMENT_LABELS
                      .filter(({ type }) => type === 'text' || type === 'word' || type === 'image')
                      .map(({ label, type }) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => handleAddElement(type)}
                          style={[notebookStyles.typePickerOption, notebookStyles.typePickerOptionContent]}
                        >
                          <Text style={[notebookStyles.typePickerOptionText, notebookStyles.typePickerOptionContentText]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
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

