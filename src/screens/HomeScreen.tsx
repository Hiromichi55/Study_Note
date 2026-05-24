import React, { useState, useRef, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  Modal,
  PanResponder,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ListRenderItemInfo,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { PDFDocument } from 'pdf-lib';
import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';
import { ENV } from '@config';
import { BOOK_BTN_HEIGHT, homeStyles } from '../styles/homeStyles';
import * as commonStyle from '../styles/commonStyle';
import { logTable } from '../utils/logTable';
import { initDB } from '../db/db';



type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;
type TextExportFormat = 'txt' | 'md';
type PdfExportSize = 'a4' | 'b5' | 'mobile';

type PdfRenderedBlockKind = 'chapter' | 'section' | 'subsection' | 'text' | 'word' | 'image';

type PdfRenderedBlock = {
  kind: PdfRenderedBlockKind;
  text?: string;
  imageUri?: string;
  rows: number;
};

type PdfPreviewPage =
  | {
      mode: 'image';
      imageUri: string;
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
      imageWidth: number;
      imageHeight: number;
      base64?: string;
    }
  | {
      mode: 'rendered';
      blocks: PdfRenderedBlock[];
    };

type PdfPageSpec = {
  pageSize: string;
  width: string;
  height: string;
  label: string;
  widthPx: number;
  heightPx: number;
  contentPaddingPx: number;
};

const NOTE_LINE_HEIGHT = 30;
const NOTE_RESERVED_TOP_LINES = 1;
const NOTE_HORIZONTAL_SPACE = 0.03;
const NOTE_IMAGE_DEFAULT_ROWS = 3;

type ImportedItem =
  | { kind: 'chapter'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'subsection'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'word'; word: string; explanation: string };

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#4E4034',
  fontWeight: '600' as const,
};

const DELETE_MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#B45145',
  fontWeight: '600' as const,
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeFileName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return 'note';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
};

const normalizeLocalFileUri = (value: string): string => {
  if (!value) return '';
  if (value.startsWith('file://') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `file://${value}`;
  }
  return value;
};

const guessImageMimeType = (path: string): 'image/jpeg' | 'image/png' | 'image/webp' => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const getImageSize = (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
};

const formatUpdatedAtLabel = (value?: string): string => {
  if (!value) return '更新日時なし';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更新日時なし';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth() + 1;
  const dateDate = date.getDate();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDate = today.getDate();
  const yesterdayYear = yesterday.getFullYear();
  const yesterdayMonth = yesterday.getMonth() + 1;
  const yesterdayDate = yesterday.getDate();
  
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  
  if (dateYear === todayYear && dateMonth === todayMonth && dateDate === todayDate) {
    return `今日 ${hh}:${mi}`;
  }
  if (dateYear === yesterdayYear && dateMonth === yesterdayMonth && dateDate === yesterdayDate) {
    return `昨日 ${hh}:${mi}`;
  }
  
  const yyyy = String(dateYear);
  const mm = String(dateMonth).padStart(2, '0');
  const dd = String(dateDate).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
};

type SortMode =
  | 'manual'
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc';

const parseDateOrZero = (value?: string): number => {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pinnedFirstSort = (books: Book[]): Book[] => {
  return [...books].sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)));
};

const sortLabelByMode: Record<SortMode, string> = {
  manual: '手動順',
  updated_desc: '更新日時(新しい順)',
  updated_asc: '更新日時(古い順)',
  created_desc: '作成日時(新しい順)',
  created_asc: '作成日時(古い順)',
  title_asc: 'タイトル(A-Z)',
  title_desc: 'タイトル(Z-A)',
};

const sortBooks = (books: Book[], sortMode: SortMode): Book[] => {
  const copied = [...books];
  switch (sortMode) {
    case 'manual':
      return pinnedFirstSort(copied.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    case 'updated_desc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(b.updated_at) - parseDateOrZero(a.updated_at)));
    case 'updated_asc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(a.updated_at) - parseDateOrZero(b.updated_at)));
    case 'created_desc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(b.created_at) - parseDateOrZero(a.created_at)));
    case 'created_asc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(a.created_at) - parseDateOrZero(b.created_at)));
    case 'title_asc':
      return pinnedFirstSort(copied.sort((a, b) => a.title.localeCompare(b.title, 'ja')));
    case 'title_desc':
      return pinnedFirstSort(copied.sort((a, b) => b.title.localeCompare(a.title, 'ja')));
    default:
      return pinnedFirstSort(copied);
  }
};

const getBookBadgeStyle = (color: Book['color'], baseColor: string) => {
  if (color === 'black') {
    return {
      backgroundColor: '#1F1F1F',
      iconColor: '#FFFFFF',
    };
  }
  return {
    backgroundColor: `${baseColor}22`,
    iconColor: baseColor,
  };
};

const askTextExportFormat = (): Promise<TextExportFormat | null> => {
  return new Promise((resolve) => {
    Alert.alert(
      '形式を選択',
      '保存形式を選んでください。',
      [
        { text: '.txt', onPress: () => resolve('txt') },
        { text: '.md', onPress: () => resolve('md') },
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(null) },
      ]
    );
  });
};

const askPdfExportSize = (): Promise<PdfExportSize | null> => {
  return new Promise((resolve) => {
    Alert.alert(
      'PDFサイズを選択',
      '出力サイズを選んでください。',
      [
        { text: 'A4', onPress: () => resolve('a4') },
        { text: 'B5', onPress: () => resolve('b5') },
        { text: 'スマホ用', onPress: () => resolve('mobile') },
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(null) },
      ]
    );
  });
};

const getPdfPageSpec = (size: PdfExportSize, pages?: PdfPreviewPage[]): PdfPageSpec => {
  if (size === 'a4') {
    return { pageSize: '210mm 297mm', width: '210mm', height: '297mm', label: 'A4', widthPx: 1240, heightPx: 1754, contentPaddingPx: 34 };
  }
  if (size === 'b5') {
    return { pageSize: '182mm 257mm', width: '182mm', height: '257mm', label: 'B5', widthPx: 1075, heightPx: 1518, contentPaddingPx: 30 };
  }
  const firstImagePage = pages?.find((p) => p.mode === 'image') as Extract<PdfPreviewPage, { mode: 'image' }> | undefined;
  const widthPx = firstImagePage?.imageWidth && firstImagePage.imageWidth > 0 ? firstImagePage.imageWidth : 780;
  const heightPx = firstImagePage?.imageHeight && firstImagePage.imageHeight > 0 ? firstImagePage.imageHeight : 1688;
  const widthPt = Math.max(1, Math.round((widthPx * 72) / 96));
  const heightPt = Math.max(1, Math.round((heightPx * 72) / 96));
  return {
    pageSize: `${widthPt}pt ${heightPt}pt`,
    width: `${widthPt}pt`,
    height: `${heightPt}pt`,
    label: 'スマホ用',
    widthPx,
    heightPx,
    contentPaddingPx: 0,
  };
};

const TABLE_HEADER_RE = /^\|\s*単語\s*\|\s*意味\s*\|\s*$/;
const TABLE_ALIGN_RE = /^\|\s*:?-+\s*\|\s*:?-+\s*\|\s*$/;

const parseStoredImagePayload = (raw: unknown): { uri: string; rows?: number; aspectRatio?: number } => {
  const asText = typeof raw === 'string' ? raw : '';
  if (!asText) return { uri: '' };

  try {
    const parsed = JSON.parse(asText);
    if (parsed && typeof parsed === 'object') {
      const uri = typeof (parsed as any).uri === 'string' ? (parsed as any).uri : '';
      const rowsRaw = (parsed as any).rows;
      const ratioRaw = (parsed as any).aspectRatio;
      const rows = Number.isFinite(rowsRaw) ? Number(rowsRaw) : undefined;
      const aspectRatio = Number.isFinite(ratioRaw) && Number(ratioRaw) > 0 ? Number(ratioRaw) : undefined;
      if (uri) {
        return { uri, rows, aspectRatio };
      }
    }
  } catch {
    // Legacy plain URI format.
  }

  return { uri: asText };
};

const parseWordTableRow = (line: string): { word: string; explanation: string } | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = trimmed
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 2) return null;
  return { word: cells[0], explanation: cells[1] };
};

const parseImportedTextContent = (raw: string): ImportedItem[] => {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const items: ImportedItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^###\s+/.test(line)) {
      items.push({ kind: 'subsection', text: line.replace(/^###\s+/, '').trim() });
      continue;
    }
    if (/^##\s+/.test(line)) {
      items.push({ kind: 'section', text: line.replace(/^##\s+/, '').trim() });
      continue;
    }
    if (/^#\s+/.test(line)) {
      items.push({ kind: 'chapter', text: line.replace(/^#\s+/, '').trim() });
      continue;
    }

    if (TABLE_HEADER_RE.test(line) && i + 1 < lines.length && TABLE_ALIGN_RE.test(lines[i + 1].trim())) {
      i += 2;
      while (i < lines.length) {
        const row = parseWordTableRow(lines[i]);
        if (!row) {
          i -= 1;
          break;
        }
        if (row.word || row.explanation) {
          items.push({ kind: 'word', word: row.word, explanation: row.explanation });
        }
        i += 1;
      }
      continue;
    }

    items.push({ kind: 'text', text: line });
  }

  return items;
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, deleteBook, renameBook, recolorBook, toggleBookPin } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'orange', 'pink', 'yellow', 'green', 'olive', 'cyan', 'blue', 'purple', 'brown', 'gray', 'black'];

  const bookIconColors: Record<string, string> = {
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
  const [showBookOptions, setShowBookOptions] = useState(false);
  const [showTitleInputModal, setShowTitleInputModal] = useState(false);
  const [selectedColorForNewBook, setSelectedColorForNewBook] = useState<Book['color'] | null>(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [menuVisibleBookId, setMenuVisibleBookId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [recolorModalVisible, setRecolorModalVisible] = useState(false);
  const [recoloringBookId, setRecoloringBookId] = useState<string | null>(null);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingText, setIsExportingText] = useState(false);
  const [isImportingBook, setIsImportingBook] = useState(false);
  const [isPreparingPdfPreview, setIsPreparingPdfPreview] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfPreviewPages, setPdfPreviewPages] = useState<PdfPreviewPage[]>([]);
  const [pdfPreviewBook, setPdfPreviewBook] = useState<Book | null>(null);
  const [pdfPreviewSize, setPdfPreviewSize] = useState<PdfExportSize | null>(null);
  const [pdfProgressVisible, setPdfProgressVisible] = useState(false);
  const [pdfProgressLabel, setPdfProgressLabel] = useState('PDFを準備中...');
  const [pdfProgressCurrent, setPdfProgressCurrent] = useState(0);
  const [pdfProgressTotal, setPdfProgressTotal] = useState(0);
  const [pdfPreviewViewportWidth, setPdfPreviewViewportWidth] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('updated_desc');
  const helpIconWrapRef = useRef<View>(null);
  const settingsIconWrapRef = useRef<View>(null);
  const wordbookQuickBtnWrapRef = useRef<View>(null);
  const firstBookMenuWrapRef = useRef<View>(null);
  const addBookBtnWrapRef = useRef<View>(null);
  const settingsAnchor = { x: commonStyle.screenWidth - 44, y: 92, width: 32, height: 32 };
  const imageSizeCacheRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const [helpAnchors, setHelpAnchors] = useState({
    settings: settingsAnchor,
    wordbook: { x: commonStyle.screenWidth - 120, y: 130, width: 100, height: 32 },
    bookMenu: { x: commonStyle.screenWidth - 64, y: 240, width: 44, height: 44 },
    help: { x: commonStyle.screenWidth - 88, y: 92, width: 32, height: 32 },
    addBook: { x: commonStyle.screenWidth - 84, y: commonStyle.screenHeight - 122, width: commonStyle.screenWidth / 6, height: commonStyle.screenWidth / 6 },
  });
  const swipeHandledRef = useRef(false);
  const pdfPreviewFlowLockRef = useRef(false);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const measureView = (ref: React.RefObject<View | null>, key: keyof typeof helpAnchors) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setHelpAnchors((prev) => ({ ...prev, [key]: { x, y, width, height } }));
    });
  };

  const refreshHelpAnchors = () => {
    measureView(helpIconWrapRef, 'help');
    measureView(settingsIconWrapRef, 'settings');
    measureView(wordbookQuickBtnWrapRef, 'wordbook');
    measureView(firstBookMenuWrapRef, 'bookMenu');
    measureView(addBookBtnWrapRef, 'addBook');
  };

  const pdfModalVisible = pdfProgressVisible || pdfPreviewVisible;

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (pdfModalVisible || showBookOptions || renameModalVisible || menuVisibleBookId !== null) return false;
          return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (pdfModalVisible || showBookOptions || renameModalVisible || menuVisibleBookId !== null) return false;
          return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        },
        onPanResponderGrant: () => {
          swipeHandledRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          if (pdfModalVisible || swipeHandledRef.current) return;
          if (gestureState.dx > 56 && Math.abs(gestureState.dy) < 28) {
            swipeHandledRef.current = true;
            navigation.navigate('Wordbook');
            return;
          }
          if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
            swipeHandledRef.current = true;
            navigation.navigate('WordList');
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (pdfModalVisible || swipeHandledRef.current) return;
          if (gestureState.dx > 56 && Math.abs(gestureState.dy) < 28) {
            swipeHandledRef.current = true;
            navigation.navigate('Wordbook');
            return;
          }
          if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
            swipeHandledRef.current = true;
            navigation.navigate('WordList');
          }
        },
        onPanResponderTerminate: () => {
          swipeHandledRef.current = false;
        },
      }),
    [pdfModalVisible, showBookOptions, renameModalVisible, menuVisibleBookId, navigation]
  );

  useEffect(() => {
    setBookData(sortBooks(state.books, sortMode));
  }, [state.books, sortMode]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowHelpOverlay(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!showHelpOverlay) return;
    const timer = setTimeout(() => {
      refreshHelpAnchors();
    }, 0);
    return () => clearTimeout(timer);
  }, [showHelpOverlay, bookData.length]);

  const handleDeleteBook = (bookId: string, title: string, isSample: boolean = false) => {
    if (isSample) {
      Alert.alert('削除できません', 'サンプルノートは削除できません。');
      return;
    }
    Alert.alert(
      '本を削除',
      `「${title}」を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteBook(bookId);
          },
        },
      ]
    );
  };

  const handleColorSelection = (color: Book['color']) => {
    setSelectedColorForNewBook(color);
    setShowBookOptions(false);
    setShowTitleInputModal(true);
  };

  const closeTitleInputModal = () => {
    setShowTitleInputModal(false);
    setSelectedColorForNewBook(null);
    setNewBookTitle('');
  };

  const handleAddBookWithTitle = async () => {
    if (!selectedColorForNewBook) return;
    
    const newId = Date.now().toString();
    const newBook: Book = {
      book_id: newId,
      title: newBookTitle.trim(),
      color: selectedColorForNewBook,
      order_index: state.books.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await addBook(newBook);
    const database = await initDB();
    const updatedBooks = sortBooks([...state.books, newBook], sortMode);
    setBookData(updatedBooks);

    closeTitleInputModal();

    setTimeout(() => {
      const newIndex = updatedBooks.findIndex((b) => b.book_id === newId);
      if (flatListRef.current && newIndex >= 0) {
        flatListRef.current.scrollToIndex({ index: newIndex, animated: true });
      }
    }, 100);
    const result = await database.getAllAsync('SELECT * FROM books;');
    logTable('Booksテーブル読込', result as Record<string, any>[]);
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setRenamingBookId(null);
    setRenameText('');
  };

  const handleImportBookFromFile = async () => {
    if (isImportingBook) return;
    setIsImportingBook(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.[0]) return;

      const file = picked.assets[0];
      const name = file.name || 'imported_note.txt';
      const lowerName = name.toLowerCase();
      const ext = lowerName.endsWith('.md') ? 'md' : lowerName.endsWith('.txt') ? 'txt' : '';
      if (!ext) {
        Alert.alert('インポートできません', '.md または .txt ファイルのみ読み込めます。');
        return;
      }

      const textContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsedItems = parseImportedTextContent(textContent);
      if (parsedItems.length === 0) {
        Alert.alert('インポートできません', '読み込める内容が見つかりませんでした。');
        return;
      }

      const firstChapter = parsedItems.find((item) => item.kind === 'chapter') as { kind: 'chapter'; text: string } | undefined;
      const fallbackTitle = name.replace(/\.(md|txt)$/i, '').trim();
      const importedTitle = (firstChapter?.text || fallbackTitle || 'インポートノート').trim();
      const nowIso = new Date().toISOString();
      const newId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

      const newBook: Book = {
        book_id: newId,
        title: importedTitle,
        color: 'blue',
        order_index: state.books.length,
        created_at: nowIso,
        updated_at: nowIso,
      };

      await addBook(newBook);
      const updatedBooks = sortBooks([...state.books, newBook], sortMode);
      setBookData(updatedBooks);

      const database = await initDB();
      const contentId = `content_${newId}_0`;
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          'INSERT OR IGNORE INTO contents (content_id, type, book_id, page, height) VALUES (?, ?, ?, ?, ?)',
          [contentId, 'text', newId, 0, 0]
        );
        await database.runAsync(
          'INSERT OR IGNORE INTO page_images (page_image_id, image_path, page_order, book_id) VALUES (?, ?, ?, ?)',
          [`pageimg_${newId}_0`, '', 0, newId]
        );

        let order = 0;
        for (const item of parsedItems) {
          const orderPrefix = String(order).padStart(4, '0');
          const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
          if (item.kind === 'chapter' || item.kind === 'section' || item.kind === 'subsection') {
            await database.runAsync(
              'INSERT OR IGNORE INTO outlines (outline_id, outline, type, content_id) VALUES (?, ?, ?, ?)',
              [`${orderPrefix}_outline_${suffix}`, item.text, item.kind, contentId]
            );
          } else if (item.kind === 'text') {
            await database.runAsync(
              'INSERT OR IGNORE INTO texts (text_id, text, content_id) VALUES (?, ?, ?)',
              [`${orderPrefix}_text_${suffix}`, item.text, contentId]
            );
          } else if (item.kind === 'word') {
            await database.runAsync(
              'INSERT OR IGNORE INTO words (word_id, word, explanation, word_order, content_id, review_flag) VALUES (?, ?, ?, ?, ?, ?)',
              [`${orderPrefix}_word_${suffix}`, item.word, item.explanation, order, contentId, 0]
            );
          }
          order += 1;
        }
      });

      setShowBookOptions(false);
      Alert.alert('インポート完了', '本を作成しました。');
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('インポートに失敗しました', 'しばらくしてからもう一度お試しください。');
    } finally {
      setIsImportingBook(false);
    }
  };

  const buildPdfImagePages = async (
    book: Book,
    onProgress?: (current: number, total: number) => void
  ): Promise<Extract<PdfPreviewPage, { mode: 'image' }>[]> => {
    const database = await initDB();
    const pageImages = await database.getAllAsync(
      'SELECT image_path, page_order FROM page_images WHERE book_id = ? ORDER BY page_order ASC;',
      [book.book_id]
    ) as Array<{ image_path: string; page_order: number }>;

    if (!pageImages || pageImages.length === 0) return [];

    // 未保存の白紙ページを除外するため、実データがあるページ番号だけを対象にする
    const pagesWithContentRows = await database.getAllAsync(
      `
      SELECT DISTINCT c.page AS page
      FROM contents c
      WHERE c.book_id = ?
        AND (
          EXISTS (
            SELECT 1 FROM outlines o
            WHERE o.content_id = c.content_id
              AND TRIM(COALESCE(o.outline, '')) <> ''
          )
          OR EXISTS (
            SELECT 1 FROM texts t
            WHERE t.content_id = c.content_id
              AND TRIM(COALESCE(t.text, '')) <> ''
          )
          OR EXISTS (
            SELECT 1 FROM words w
            WHERE w.content_id = c.content_id
              AND (
                TRIM(COALESCE(w.word, '')) <> ''
                OR TRIM(COALESCE(w.explanation, '')) <> ''
              )
          )
          OR EXISTS (
            SELECT 1 FROM images i
            WHERE i.content_id = c.content_id
              AND TRIM(COALESCE(i.image, '')) <> ''
          )
        )
      ORDER BY c.page ASC;
      `,
      [book.book_id]
    ) as Array<{ page: number }>;

    const pagesWithContent = new Set(
      pagesWithContentRows
        .map((row) => Number(row.page))
        .filter((page) => Number.isFinite(page))
    );

    const filteredPageImages = pageImages.filter((img) => pagesWithContent.has(Number(img.page_order)));
    if (filteredPageImages.length === 0) return [];

    const pages: Extract<PdfPreviewPage, { mode: 'image' }>[] = [];
    const total = filteredPageImages.length;
    for (let i = 0; i < filteredPageImages.length; i += 1) {
      const item = filteredPageImages[i];
      onProgress?.(i + 1, total);
      const imageUri = normalizeLocalFileUri(item.image_path || '');
      if (!imageUri || imageUri.startsWith('http://') || imageUri.startsWith('https://')) continue;

      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) continue;

      let size = imageSizeCacheRef.current.get(imageUri);
      if (!size) {
        try {
          size = await getImageSize(imageUri);
          if (size?.width && size?.height) {
            imageSizeCacheRef.current.set(imageUri, size);
          }
        } catch {
          continue;
        }
      }
      if (!size?.width || !size?.height) continue;

      pages.push({
        mode: 'image',
        imageUri,
        mimeType: guessImageMimeType(imageUri),
        imageWidth: size.width,
        imageHeight: size.height,
      });
    }

    return pages;
  };

  const buildPdfRenderedPages = async (book: Book, size: Exclude<PdfExportSize, 'mobile'>): Promise<Extract<PdfPreviewPage, { mode: 'rendered' }>[]> => {
    type PdfElement =
      | { type: 'chapter'; text: string }
      | { type: 'section'; text: string }
      | { type: 'subsection'; text: string }
      | { type: 'text'; text: string }
      | { type: 'word'; word: string; meaning: string }
      | { type: 'image'; uri: string; rows?: number; aspectRatio?: number };

    const database = await initDB();
    const contents = await database.getAllAsync(
      'SELECT content_id, page FROM contents WHERE book_id = ? ORDER BY page ASC;',
      [book.book_id]
    ) as Array<{ content_id: string; page: number }>;

    if (!contents || contents.length === 0) return [];

    const pageSpec = getPdfPageSpec(size);
    const maxRows = Math.max(1, Math.floor((pageSpec.heightPx - pageSpec.contentPaddingPx * 2) / NOTE_LINE_HEIGHT));
    const availableWidth = Math.max(1, pageSpec.widthPx * 0.98 * (1 - 2 * NOTE_HORIZONTAL_SPACE) - 12);
    const maxContentRows = Math.max(1, maxRows - NOTE_RESERVED_TOP_LINES);

    const calcTextRows = (text: string, fontSize: number) => {
      const charsPerLine = Math.max(8, Math.floor(availableWidth / Math.max(1, fontSize)) - 1);
      const lines = Math.max(
        1,
        String(text || '')
          .split('\n')
          .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
      );
      return Math.max(1, lines);
    };

    const measureRows = (el: PdfElement): number => {
      if (el.type === 'image') {
        const contentWidth = pageSpec.widthPx * 0.98 * (1 - 2 * NOTE_HORIZONTAL_SPACE);
        if (el.aspectRatio && Number(el.aspectRatio) > 0) {
          const naturalHeight = contentWidth / Number(el.aspectRatio);
          return Math.max(1, Math.ceil(naturalHeight / NOTE_LINE_HEIGHT));
        }
        const rowsRaw = Number(el.rows);
        const rows = Number.isFinite(rowsRaw) && rowsRaw > 0 ? Math.round(rowsRaw) : NOTE_IMAGE_DEFAULT_ROWS;
        return Math.max(1, rows);
      }

      if (el.type === 'chapter') return calcTextRows(el.text, 22);
      if (el.type === 'section') return calcTextRows(el.text, 18);
      if (el.type === 'subsection') return calcTextRows(el.text, 15);
      if (el.type === 'word') return calcTextRows(`${el.word || ''} ${el.meaning || ''}`, 15);
      return calcTextRows(el.text, 15);
    };

    const blocks: PdfRenderedBlock[] = [];

    for (const content of contents) {
      const [outlines, texts, words, images] = await Promise.all([
        database.getAllAsync(
          'SELECT outline_id, outline, type FROM outlines WHERE content_id = ?;',
          [content.content_id]
        ) as Promise<Array<{ outline_id: string; outline: string; type: 'chapter' | 'section' | 'subsection' | 'title' }>>,
        database.getAllAsync(
          'SELECT text_id, text FROM texts WHERE content_id = ?;',
          [content.content_id]
        ) as Promise<Array<{ text_id: string; text: string }>>,
        database.getAllAsync(
          'SELECT word_id, word, explanation FROM words WHERE content_id = ?;',
          [content.content_id]
        ) as Promise<Array<{ word_id: string; word: string; explanation: string }>>,
        database.getAllAsync(
          'SELECT image_id, image FROM images WHERE content_id = ?;',
          [content.content_id]
        ) as Promise<Array<{ image_id: string; image: string }>>,
      ]);

      type RawItem =
        | { id: string; kind: 'outline'; data: { text: string; type: 'chapter' | 'section' | 'subsection' | 'title' } }
        | { id: string; kind: 'text'; data: { text: string } }
        | { id: string; kind: 'word'; data: { word: string; explanation: string } }
        | { id: string; kind: 'image'; data: { image: string } };

      const merged: RawItem[] = [
        ...outlines.map((o) => ({ id: o.outline_id, kind: 'outline' as const, data: { text: o.outline || '', type: o.type } })),
        ...texts.map((t) => ({ id: t.text_id, kind: 'text' as const, data: { text: t.text || '' } })),
        ...words.map((w) => ({ id: w.word_id, kind: 'word' as const, data: { word: w.word || '', explanation: w.explanation || '' } })),
        ...images.map((img) => ({ id: img.image_id, kind: 'image' as const, data: { image: img.image || '' } })),
      ].sort((a, b) => a.id.localeCompare(b.id));

      merged.forEach((item) => {
        if (item.kind === 'outline') {
          const type = item.data.type === 'title' ? 'text' : item.data.type;
          const text = item.data.text || '';
          if (!text.trim()) return;
          const rows = measureRows({ type: type as 'chapter' | 'section' | 'subsection' | 'text', text } as any);
          blocks.push({ kind: type as PdfRenderedBlockKind, text, rows });
          return;
        }

        if (item.kind === 'text') {
          const text = item.data.text || '';
          if (!text.trim()) return;
          const rows = measureRows({ type: 'text', text });
          blocks.push({ kind: 'text', text, rows });
          return;
        }

        if (item.kind === 'word') {
          const word = item.data.word || '';
          const meaning = item.data.explanation || '';
          const text = `${word} ... ${meaning}`.trim();
          if (!word.trim() && !meaning.trim()) return;
          const rows = measureRows({ type: 'word', word, meaning });
          blocks.push({ kind: 'word', text, rows });
          return;
        }

        const restored = parseStoredImagePayload(item.data.image || '');
        const imageUri = normalizeLocalFileUri(restored.uri || '');
        if (!imageUri) return;
        const rows = measureRows({ type: 'image', uri: imageUri, rows: restored.rows, aspectRatio: restored.aspectRatio });
        blocks.push({ kind: 'image', imageUri, rows });
      });
    }

    if (blocks.length === 0) return [];

    const pages: Extract<PdfPreviewPage, { mode: 'rendered' }>[] = [];
    let currentBlocks: PdfRenderedBlock[] = [];
    let usedRows = 0;

    blocks.forEach((block) => {
      const blockRows = Math.max(1, block.rows);
      if (currentBlocks.length > 0 && usedRows + blockRows > maxContentRows) {
        pages.push({ mode: 'rendered', blocks: currentBlocks });
        currentBlocks = [];
        usedRows = 0;
      }
      currentBlocks.push({ ...block, rows: blockRows });
      usedRows += blockRows;
    });

    if (currentBlocks.length > 0) {
      pages.push({ mode: 'rendered', blocks: currentBlocks });
    }

    return pages;
  };

  const buildPdfPreviewPages = async (book: Book, _size: PdfExportSize): Promise<PdfPreviewPage[]> => {
    return buildPdfImagePages(book, (current, total) => {
      setPdfProgressLabel('プレビューを準備中...');
      setPdfProgressCurrent(current);
      setPdfProgressTotal(total);
    });
  };

  const buildPdfHtmlFromPreview = (pages: PdfPreviewPage[], size: PdfExportSize): string => {
    const pageSpec = getPdfPageSpec(size, pages);
    const isMobile = size === 'mobile';

    const pageHtml = pages
      .map((page) => {
        if (page.mode === 'image') {
          const imageSrc = encodeURI(page.imageUri || '');
          return `
            <section class="page mobile-page">
              <div class="content">
                <img class="page-image" src="${escapeHtml(imageSrc)}" />
              </div>
            </section>
          `;
        }

        const blocksHtml = page.blocks
          .map((block) => {
            if (block.kind === 'image') {
              const src = block.imageUri || '';
              if (!src) {
                return `<div class="block image" style="height:${block.rows * NOTE_LINE_HEIGHT}px;"></div>`;
              }
              return `<div class="block image" style="height:${block.rows * NOTE_LINE_HEIGHT}px;"><img class="inner-image" src="${escapeHtml(src)}" /></div>`;
            }
            return `<div class="block ${block.kind}" style="height:${block.rows * NOTE_LINE_HEIGHT}px;">${escapeHtml(block.kind === 'word' ? `・ ${block.text || ''}` : block.text || '')}</div>`;
          })
          .join('');

        return `
          <section class="page rendered">
            <div class="rules"></div>
            <div class="content rendered-content">${blocksHtml}</div>
          </section>
        `;
      })
      .join('');

    return `
      <!doctype html>
      <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: ${pageSpec.pageSize}; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; font-family: 'Hiragino Mincho ProN', serif; }
          .page {
            width: ${pageSpec.width};
            height: ${pageSpec.height};
            position: relative;
            box-sizing: border-box;
            padding: ${isMobile ? '0' : '12mm 10mm'};
            page-break-after: always;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
            background: #fff;
          }
          .page:last-child { page-break-after: auto; }
          .page.rendered {
            padding: 12mm 10mm;
          }
          .rules {
            position: absolute;
            inset: 12mm 10mm;
            background-image:
              linear-gradient(to bottom, rgba(152, 173, 211, 1), rgba(152, 173, 211, 1)),
              linear-gradient(to bottom, rgba(152, 173, 211, 1), rgba(152, 173, 211, 1)),
              repeating-linear-gradient(
                to bottom,
                transparent 0,
                transparent 29px,
                rgba(196, 204, 218, 1) 29px,
                rgba(196, 204, 218, 1) 30px
              );
            background-repeat: no-repeat, no-repeat, repeat;
            background-size: 100% 1px, 100% 1px, 100% 30px;
            background-position: 0 30px, 0 60px, 0 0;
            pointer-events: none;
          }
          .content {
            position: relative;
            z-index: 1;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .rendered-content {
            align-items: stretch;
            justify-content: flex-start;
          }
          .block {
            line-height: 30px;
            white-space: pre-wrap;
            color: #2D251D;
            overflow: hidden;
          }
          .chapter { font-size: 22px; font-weight: 700; }
          .section { font-size: 18px; font-weight: 700; }
          .subsection { font-size: 15px; font-weight: 700; }
          .text { font-size: 15px; }
          .word { font-size: 15px; color: #A03A3A; }
          .image {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .inner-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
          .page-image {
            width: 100%;
            height: 100%;
            object-fit: ${isMobile ? 'fill' : 'contain'};
            display: block;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${pageHtml}
      </body>
      </html>
    `;
  };

  const handleExportBookPdf = async (book: Book) => {
    if (isExportingPdf || isPreparingPdfPreview || pdfPreviewFlowLockRef.current) return;
    pdfPreviewFlowLockRef.current = true;

    try {
      const exportSize: PdfExportSize = 'a4';

      setPdfPreviewVisible(false);
      setIsPreparingPdfPreview(true);
      setPdfProgressVisible(true);
      setPdfProgressLabel('プレビューを準備中...');
      setPdfProgressCurrent(0);
      setPdfProgressTotal(0);

      let preparedPages: PdfPreviewPage[] | null = null;
      try {
        const pages = await buildPdfPreviewPages(book, exportSize);
        if (pages.length === 0) {
          Alert.alert('PDF化', 'このノートには出力できる内容がありません。');
          return;
        }
        preparedPages = pages;
      } catch (error) {
        console.error('PDF preview prepare error:', error);
        Alert.alert('PDFプレビューの準備に失敗しました', 'しばらくしてからもう一度お試しください。');
        return;
      } finally {
        setIsPreparingPdfPreview(false);
      }

      if (!preparedPages) return;

      setPdfPreviewBook(book);
      setPdfPreviewSize(exportSize);
      setPdfPreviewPages(preparedPages);
      setPdfPreviewVisible(true);
      setPdfProgressVisible(false);
    } finally {
      pdfPreviewFlowLockRef.current = false;
    }
  };

  const handleSavePdfFromPreview = async () => {
    if (!pdfPreviewBook || !pdfPreviewSize || pdfPreviewPages.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfPreviewVisible(false);
    setPdfProgressVisible(true);
    setPdfProgressLabel('PDFを作成中...');
    setPdfProgressCurrent(0);
    setPdfProgressTotal(0);
    try {
      const pageSpec = getPdfPageSpec(pdfPreviewSize, pdfPreviewPages);
      const exportDir = `${FileSystem.documentDirectory}exports/`;
      await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

      const filename = `${sanitizeFileName(pdfPreviewBook.title || 'note')}_${pageSpec.label}_${Date.now()}.pdf`;
      const destination = `${exportDir}${filename}`;

      if (pdfPreviewSize === 'mobile') {
        const imagePages = pdfPreviewPages.filter((p): p is Extract<PdfPreviewPage, { mode: 'image' }> => p.mode === 'image');
        if (imagePages.length === 0) {
          Alert.alert('PDF化', 'このノートには出力できる内容がありません。');
          return;
        }

        const pdfDoc = await PDFDocument.create();
        const total = imagePages.length;
        setPdfProgressTotal(total);
        for (let i = 0; i < imagePages.length; i += 1) {
          const page = imagePages[i];
          setPdfProgressCurrent(i + 1);
          let embeddedImage;
          const base64 = page.base64 || (await FileSystem.readAsStringAsync(page.imageUri, { encoding: FileSystem.EncodingType.Base64 }));
          if (page.mimeType === 'image/png') {
            embeddedImage = await pdfDoc.embedPng(base64);
          } else {
            embeddedImage = await pdfDoc.embedJpg(base64);
          }

          const width = Math.max(1, page.imageWidth);
          const height = Math.max(1, page.imageHeight);
          const pdfPage = pdfDoc.addPage([width, height]);
          pdfPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width,
            height,
          });
        }

        const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
        setPdfProgressLabel('PDFを書き出し中...');
        await FileSystem.writeAsStringAsync(destination, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        setPdfProgressLabel('PDFを書き出し中...');
        const html = buildPdfHtmlFromPreview(pdfPreviewPages, pdfPreviewSize);
        const printFile = await Print.printToFileAsync({ html });
        await FileSystem.copyAsync({ from: printFile.uri, to: destination });
      }

      console.log('[PDF Export] saved:', destination);

      setPdfPreviewVisible(false);
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('PDF化に失敗しました', 'しばらくしてからもう一度お試しください。');
    } finally {
      setIsExportingPdf(false);
      setPdfProgressVisible(false);
    }
  };

  const handleExportBookText = async (book: Book, format: TextExportFormat) => {
    if (isExportingText) return;
    setIsExportingText(true);
    try {
      const database = await initDB();
      const contents = await database.getAllAsync(
        'SELECT content_id, page FROM contents WHERE book_id = ? ORDER BY page ASC;',
        [book.book_id]
      ) as Array<{ content_id: string; page: number }>;

      if (!contents || contents.length === 0) {
        Alert.alert('テキストファイル化', 'このノートには出力できる内容がありません。');
        return;
      }

      const lines: string[] = [];
      let hasAnyContent = false;

      const flushWordTable = (pendingWords: Array<{ word: string; explanation: string }>) => {
        if (pendingWords.length === 0) return;
        lines.push('|単語|意味|');
        lines.push('|---|---|');
        pendingWords.forEach((w) => {
          lines.push(`|${w.word}|${w.explanation}|`);
        });
        lines.push('');
      };

      for (const content of contents) {
        const [outlines, texts, words] = await Promise.all([
          database.getAllAsync(
            'SELECT outline_id, outline, type FROM outlines WHERE content_id = ?;',
            [content.content_id]
          ) as Promise<Array<{ outline_id: string; outline: string; type: 'chapter' | 'section' | 'subsection' | 'title' }>>,
          database.getAllAsync(
            'SELECT text_id, text FROM texts WHERE content_id = ?;',
            [content.content_id]
          ) as Promise<Array<{ text_id: string; text: string }>>,
          database.getAllAsync(
            'SELECT word_id, word, explanation FROM words WHERE content_id = ?;',
            [content.content_id]
          ) as Promise<Array<{ word_id: string; word: string; explanation: string }>>,
        ]);

        type RawItem =
          | { id: string; kind: 'outline'; data: { text: string; type: 'chapter' | 'section' | 'subsection' | 'title' } }
          | { id: string; kind: 'text'; data: { text: string } }
          | { id: string; kind: 'word'; data: { word: string; explanation: string } };

        const items: RawItem[] = [
          ...outlines.map((o) => ({ id: o.outline_id, kind: 'outline' as const, data: { text: o.outline || '', type: o.type } })),
          ...texts.map((t) => ({ id: t.text_id, kind: 'text' as const, data: { text: t.text || '' } })),
          ...words.map((w) => ({ id: w.word_id, kind: 'word' as const, data: { word: w.word || '', explanation: w.explanation || '' } })),
        ].sort((a, b) => a.id.localeCompare(b.id));

        let pendingWords: Array<{ word: string; explanation: string }> = [];

        for (const item of items) {
          if (item.kind === 'word') {
            const word = item.data.word.trim();
            const explanation = item.data.explanation.trim();
            if (!word && !explanation) continue;
            pendingWords.push({ word, explanation });
            hasAnyContent = true;
            continue;
          }

          flushWordTable(pendingWords);
          pendingWords = [];

          if (item.kind === 'outline') {
            const text = item.data.text.trim();
            if (!text) continue;
            if (item.data.type === 'chapter') lines.push(`# ${text}`);
            else if (item.data.type === 'section') lines.push(`## ${text}`);
            else if (item.data.type === 'subsection') lines.push(`### ${text}`);
            else lines.push(text);
            hasAnyContent = true;
            continue;
          }

          const text = item.data.text.trim();
          if (text) {
            lines.push(text);
            hasAnyContent = true;
          }
        }

        flushWordTable(pendingWords);
      }

      if (!hasAnyContent) {
        Alert.alert('テキストファイル化', 'このノートには出力できる内容がありません。');
        return;
      }

      const textOutput = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
      const exportDir = `${FileSystem.documentDirectory}exports/`;
      await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
      const filename = `${sanitizeFileName(book.title || 'note')}_${Date.now()}.${format}`;
      const destination = `${exportDir}${filename}`;

      await FileSystem.writeAsStringAsync(destination, textOutput, { encoding: FileSystem.EncodingType.UTF8 });

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(destination, {
          mimeType: format === 'md' ? 'text/markdown' : 'text/plain',
          UTI: format === 'md' ? 'net.daringfireball.markdown' : 'public.plain-text',
          dialogTitle: format === 'md' ? 'Markdownファイルを共有（ファイルに保存）' : 'テキストファイルを共有（ファイルに保存）',
        });
      }
    } catch (error) {
      console.error('Text export error:', error);
      Alert.alert('テキストファイル化に失敗しました', 'しばらくしてからもう一度お試しください。');
    } finally {
      setIsExportingText(false);
    }
  };

  const renderRightActions = (bookId: string, title: string, isSample: boolean = false) => (
    <View style={localStyles.rightActionContainer}>
      <TouchableOpacity
        style={localStyles.swipeDeleteButton}
        disabled={isSample}
        onPress={() => {
        handleDeleteBook(bookId, title, isSample);
      }}
    >
      <Ionicons name={isSample ? 'lock-closed-outline' : 'trash-outline'} size={24} color="#fff" />
    </TouchableOpacity>
  </View>
  );

  const renderLeftActions = (item: Book) => (
    <View style={localStyles.leftActionContainer}>
      <TouchableOpacity
        style={localStyles.swipePinButton}
        onPress={async () => {
          await toggleBookPin(item.book_id, !Boolean(item.is_pinned));
        }}
      >
        <MaterialCommunityIcons
          name={item.is_pinned ? 'pin-off' : 'pin'}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );

  const BookItem = React.memo(({ item }: { item: Book }) => (
    <Swipeable
      renderLeftActions={() => renderLeftActions(item)}
      renderRightActions={() => renderRightActions(item.book_id, item.title, Boolean(item.is_sample))}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={40}
      rightThreshold={40}
      containerStyle={{ overflow: 'hidden', borderRadius: 24 }}
    >
      <Animated.View
        style={[
          homeStyles.bookCardWrap,
          { opacity: 1, transform: [{ scale: 1 }] },
        ]}
      >
        <View style={homeStyles.bookBtn}>
        <View style={[homeStyles.bookSpine, { backgroundColor: bookIconColors[item.color] }]} />
        <TouchableOpacity
          disabled={isExportingPdf || isExportingText || menuVisibleBookId !== null}
          onPress={() => {
            if (isExportingPdf || isExportingText || menuVisibleBookId !== null) return;
            console.log(`本を選択:bookId = ${item.book_id}`);
            navigation.navigate('Notebook', { bookId: item.book_id });
          }}
          style={homeStyles.bookMainArea}
        >
          <View
            style={[
              homeStyles.bookIconBadge,
              { backgroundColor: getBookBadgeStyle(item.color, bookIconColors[item.color]).backgroundColor },
            ]}
          >
            <View style={homeStyles.bookIconGlyphWrap}>
              <Ionicons
                name="book-outline"
                size={commonStyle.screenWidth / 16}
                color={getBookBadgeStyle(item.color, bookIconColors[item.color]).iconColor}
                style={homeStyles.bookIconGlyph}
              />
            </View>
          </View>
          <View style={homeStyles.bookTextBlock}>
            <Text numberOfLines={1} style={homeStyles.bookTitle}>{item.title}</Text>
            <Text style={homeStyles.bookSubtitle}>{`${formatUpdatedAtLabel(item.updated_at)}`}</Text>
          </View>
        </TouchableOpacity>
        {item.is_pinned && (
          <View pointerEvents="none" style={localStyles.pinnedBadge}>
            <MaterialCommunityIcons name="pin" size={16} color="#A5672A" />
          </View>
        )}
        <Menu
          visible={menuVisibleBookId === item.book_id}
          onDismiss={() => setMenuVisibleBookId(null)}
          anchor={
            <View
              ref={item.order_index === 0 ? firstBookMenuWrapRef : undefined}
              collapsable={false}
            >
              <TouchableOpacity
                style={homeStyles.bookMenuButton}
                onPress={() => setMenuVisibleBookId(menuVisibleBookId === item.book_id ? null : item.book_id)}
              >
                <Ionicons name="ellipsis-horizontal" size={commonStyle.screenWidth / 19} color="#6B6258" />
              </TouchableOpacity>
            </View>
          }
          contentStyle={homeStyles.bookMenuContent}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              setRenamingBookId(item.book_id);
              setRenameText(item.title);
              setRenameModalVisible(true);
            }}
            title="タイトルを変更"
            leadingIcon="pencil"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              setRecoloringBookId(item.book_id);
              setRecolorModalVisible(true);
            }}
            title="色を変更"
            leadingIcon="palette"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={async () => {
              setMenuVisibleBookId(null);
              await toggleBookPin(item.book_id, !Boolean(item.is_pinned));
            }}
            title={item.is_pinned ? 'ピン留めを解除' : 'ピン留め'}
            leadingIcon={item.is_pinned ? 'pin-off' : 'pin'}
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={async () => {
              setMenuVisibleBookId(null);
              await handleExportBookPdf(item);
            }}
            title="PDF化"
            leadingIcon="file-pdf-box"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={async () => {
              setMenuVisibleBookId(null);
              const format = await askTextExportFormat();
              if (!format) return;
              await handleExportBookText(item, format);
            }}
            title="テキストファイル化"
            leadingIcon="file-document-outline"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              handleDeleteBook(item.book_id, item.title, Boolean(item.is_sample));
            }}
            title="本を削除"
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name={item.is_sample ? 'lock-outline' : 'trash-can'} size={size} color={item.is_sample ? '#B8ADA0' : '#B45145'} />
            )}
            titleStyle={item.is_sample ? { ...DELETE_MENU_ITEM_TITLE_STYLE, color: '#B8ADA0' } : DELETE_MENU_ITEM_TITLE_STYLE}
            disabled={Boolean(item.is_sample)}
          />
        </Menu>
      </View>
    </Animated.View>
  </Swipeable>
  ));

  const renderItem = ({ item }: ListRenderItemInfo<Book>) => (
    <BookItem item={item} />
  );

  return (
    <View style={homeStyles.background} pointerEvents={pdfModalVisible ? 'none' : 'auto'} {...panResponder.panHandlers}>
      <View style={homeStyles.backgroundGlowTop} />
      <View style={homeStyles.backgroundGlowBottom} />

      <View style={[
        homeStyles.topSpacer,
        DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' },
      ]}>
        <View style={[homeStyles.titleRow, { marginBottom: 10 }]}>
          <Text style={[homeStyles.screenCaption, { flex: 1 }]}>ノート一覧</Text>
          <View ref={settingsIconWrapRef} collapsable={false}>
            <TouchableOpacity
              onPress={() => navigation.navigate('License')}
              style={{ padding: 4 }}
            >
              <Ionicons name="information-circle-outline" size={commonStyle.screenWidth / 13} color="#6B6258" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={homeStyles.listHeaderDescription}>
            全 {bookData.length} 冊
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View ref={wordbookQuickBtnWrapRef} collapsable={false}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Wordbook')}
                style={[homeStyles.wordbookQuickBtn, showHelpOverlay && localStyles.wordbookQuickBtnHelpMode]}
              >
                <Ionicons name="albums-outline" size={16} color={showHelpOverlay ? '#4E4034' : '#FFFFFF'} />
                <Text style={[homeStyles.wordbookQuickBtnText, showHelpOverlay && localStyles.wordbookQuickBtnTextHelpMode]}>一問一答</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('WordList')}
              style={[homeStyles.wordbookQuickBtn, showHelpOverlay && localStyles.wordbookQuickBtnHelpMode]}
            >
              <Ionicons name="list-outline" size={16} color={showHelpOverlay ? '#4E4034' : '#FFFFFF'} />
              <Text style={[homeStyles.wordbookQuickBtnText, showHelpOverlay && localStyles.wordbookQuickBtnTextHelpMode]}>単語リスト</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={bookData}
        keyExtractor={(item) => item.book_id}
        renderItem={renderItem}
        extraData={bookData}
        contentContainerStyle={homeStyles.verticalScrollContainer}
        getItemLayout={(data, index) => ({
          length: BOOK_BTN_HEIGHT,
          offset: BOOK_BTN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        ListHeaderComponent={null}
        ListEmptyComponent={
          <View style={homeStyles.emptyCard}>
            <Text style={homeStyles.emptyTitle}>まだ本がありません</Text>
            <Text style={homeStyles.emptyDescription}>右下のボタンから最初の1冊を追加できます。</Text>
          </View>
        }
      />

      <Modal
        visible={pdfModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pdfPreviewVisible && !isExportingPdf) setPdfPreviewVisible(false);
        }}
      >
        <View style={homeStyles.modalBackdropCenter}>
          {pdfPreviewVisible ? (
            <View style={{ width: '94%', maxHeight: '90%', backgroundColor: '#FFFDF9', borderRadius: 16, borderWidth: 1, borderColor: '#D7C7B6', padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#3E332A', flex: 1 }} numberOfLines={2}>
                  PDFプレビュー {pdfPreviewBook ? `(${pdfPreviewBook.title})` : ''}
                </Text>
                <Text style={{ fontSize: 12, color: '#6E6258', marginLeft: 8 }}>
                  {pdfPreviewSize ? getPdfPageSpec(pdfPreviewSize).label : ''}
                </Text>
              </View>

              <View
                onLayout={(e) => {
                  const measured = Math.max(0, Math.floor(e.nativeEvent.layout.width));
                  if (measured > 0 && measured !== pdfPreviewViewportWidth) {
                    setPdfPreviewViewportWidth(measured);
                  }
                }}
                style={{ width: '100%', paddingBottom: 8 }}
              >
              <ScrollView
                horizontal
                pagingEnabled
                decelerationRate="fast"
                snapToInterval={pdfPreviewViewportWidth > 0 ? pdfPreviewViewportWidth : undefined}
                snapToAlignment="start"
                disableIntervalMomentum
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ alignItems: 'stretch' }}
              >
                {pdfPreviewPages.map((page, index) => {
                  const size = pdfPreviewSize ? getPdfPageSpec(pdfPreviewSize, pdfPreviewPages) : getPdfPageSpec('a4', pdfPreviewPages);
                  const isMobile = pdfPreviewSize === 'mobile';
                  const pageViewportWidth = pdfPreviewViewportWidth > 0 ? pdfPreviewViewportWidth : Math.round(commonStyle.screenWidth * 0.86);
                  // ページ枠が隣ページへはみ出さないよう、表示領域内で幅を決定する
                  const previewWidth = Math.max(220, Math.min(Math.round(commonStyle.screenWidth * 0.82), pageViewportWidth - 16));
                  const scale = previewWidth / size.widthPx;
                  const mobileRatio = page.mode === 'image' && page.imageWidth > 0 ? page.imageHeight / page.imageWidth : (size.heightPx / Math.max(1, size.widthPx));
                  const previewHeight = Math.round(isMobile ? previewWidth * mobileRatio : size.heightPx * scale);
                  const contentPadding = isMobile ? 0 : Math.max(8, Math.round(size.contentPaddingPx * scale));
                  const rowHeight = Math.max(14, Math.round(NOTE_LINE_HEIGHT * scale));

                  return (
                    <View key={`pdf-preview-page-${index}`} style={{ width: pageViewportWidth, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, overflow: 'hidden' }}>
                      <View style={{ width: previewWidth, height: previewHeight, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED2C3', borderRadius: 8, paddingHorizontal: contentPadding, paddingVertical: contentPadding, overflow: 'hidden' }}>
                        {page.mode === 'image' ? (
                          <Image
                            source={{ uri: page.imageUri }}
                            resizeMode={isMobile ? 'stretch' : 'contain'}
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : (
                          <>
                            {Array.from({ length: Math.max(1, Math.floor((previewHeight - contentPadding * 2) / rowHeight)) }).map((_, rowIndex) => {
                              const y = contentPadding + rowHeight * (rowIndex + 1) - 1;
                              const isTitleRule = rowIndex === 0 || rowIndex === 1;
                              return (
                                <View
                                  key={`pdf-rule-${index}-${rowIndex}`}
                                  pointerEvents="none"
                                  style={{
                                    position: 'absolute',
                                    left: contentPadding,
                                    right: contentPadding,
                                    top: y,
                                    height: isTitleRule ? 1.5 : 1,
                                    backgroundColor: isTitleRule ? 'rgba(152, 173, 211, 1)' : 'rgba(196, 204, 218, 1)',
                                  }}
                                />
                              );
                            })}
                            <View style={{ flex: 1 }}>
                              {page.blocks.map((block, blockIndex) => {
                                const blockHeight = Math.max(rowHeight, Math.round(block.rows * rowHeight));
                                if (block.kind === 'image') {
                                  return (
                                    <View key={`pdf-block-${index}-${blockIndex}`} style={{ height: blockHeight, justifyContent: 'center' }}>
                                      {block.imageUri ? (
                                        <Image source={{ uri: block.imageUri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                                      ) : null}
                                    </View>
                                  );
                                }

                                const fontSize =
                                  block.kind === 'chapter' ? Math.max(12, Math.round(22 * scale)) :
                                  block.kind === 'section' ? Math.max(11, Math.round(18 * scale)) :
                                  Math.max(10, Math.round(15 * scale));
                                const fontWeight = (block.kind === 'chapter' || block.kind === 'section' || block.kind === 'subsection') ? '700' : '400';
                                const color = block.kind === 'word' ? '#A03A3A' : '#2D251D';

                                return (
                                  <Text
                                    key={`pdf-block-${index}-${blockIndex}`}
                                    style={{
                                      height: blockHeight,
                                      lineHeight: rowHeight,
                                      fontSize,
                                      fontWeight,
                                      color,
                                    }}
                                  >
                                    {block.kind === 'word' ? `・ ${block.text || ''}` : (block.text || '')}
                                  </Text>
                                );
                              })}
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPdfPreviewVisible(false)}
                  disabled={isExportingPdf}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D2C4B4', backgroundColor: '#F7EFE4', opacity: isExportingPdf ? 0.6 : 1 }}
                >
                  <Text style={{ color: '#5A4A3B', fontWeight: '700' }}>閉じる</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSavePdfFromPreview}
                  disabled={isExportingPdf}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: isExportingPdf ? '#CDBEAE' : '#8A6A52', opacity: isExportingPdf ? 0.7 : 1 }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{isExportingPdf ? '作成中...' : '保存先を選択'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ width: '78%', backgroundColor: '#FFFDF9', borderRadius: 14, borderWidth: 1, borderColor: '#D7C7B6', paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#8A6A52" />
              <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '700', color: '#3E332A' }}>{pdfProgressLabel}</Text>
              {pdfProgressTotal > 0 ? (
                <Text style={{ marginTop: 6, fontSize: 12, color: '#6E6258' }}>
                  {pdfProgressCurrent} / {pdfProgressTotal} ページ
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Modal>

      {showHelpOverlay && (
        <TouchableWithoutFeedback onPress={() => setShowHelpOverlay(false)}>
          <View style={localStyles.helpOverlay} pointerEvents="auto">

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.settings.y + helpAnchors.settings.height + 8,
                left: clamp(helpAnchors.settings.x + helpAnchors.settings.width - commonStyle.screenWidth * 0.45, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.45 - 12),
                maxWidth: commonStyle.screenWidth * 0.45,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>設定アイコン</Text>
            <Text style={localStyles.helpText}>詳細情報確認</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.wordbook.y + helpAnchors.wordbook.height + 8,
                left: clamp(helpAnchors.wordbook.x + helpAnchors.wordbook.width - commonStyle.screenWidth * 0.45, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.45 - 12),
                maxWidth: commonStyle.screenWidth * 0.45,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>一問一答</Text>
            <Text style={localStyles.helpText}>ノートに追加した一問一答</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.bookMenu.y + helpAnchors.bookMenu.height + 8,
                left: clamp(helpAnchors.bookMenu.x + helpAnchors.bookMenu.width - commonStyle.screenWidth * 0.56, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.56 - 12),
                maxWidth: commonStyle.screenWidth * 0.56,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>本のメニュー</Text>
            <Text style={localStyles.helpText}>名前を変更/削除</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.help.y + helpAnchors.help.height + 8,
                left: clamp(helpAnchors.help.x + helpAnchors.help.width - commonStyle.screenWidth * 0.5, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.5 - 12),
                maxWidth: commonStyle.screenWidth * 0.5,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>はてなボタン</Text>
            <Text style={localStyles.helpText}>説明表示の切り替え。</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.addBook.y - 74,
                left: clamp(helpAnchors.addBook.x + helpAnchors.addBook.width - commonStyle.screenWidth * 0.48, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.48 - 12),
                maxWidth: commonStyle.screenWidth * 0.48,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>追加ボタン</Text>
            <Text style={localStyles.helpText}>新しい本を作成。</Text>
          </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      <TouchableOpacity
        ref={addBookBtnWrapRef}
        onPress={() => {
          console.log('本を追加ボタン押下');
          setShowBookOptions(prev => !prev);
        }}
        style={homeStyles.addBookBtn}
      >
        <Ionicons
          name="add"
          size={commonStyle.screenWidth / 10}
          color="white"
        />
      </TouchableOpacity>

      {showBookOptions && (
        <Modal transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowBookOptions(false)}>
            <View style={homeStyles.modalBackdrop}>
              <View style={homeStyles.newBookOptionsOverlay}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={[homeStyles.paletteTitle, { marginBottom: 0, paddingHorizontal: 0 }]}>本の色を選択</Text>
                  <TouchableOpacity
                    onPress={handleImportBookFromFile}
                    disabled={isImportingBook}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#CDBEAE',
                      backgroundColor: isImportingBook ? '#E9E0D3' : '#F7EFE4',
                      opacity: isImportingBook ? 0.6 : 1,
                    }}
                  >
                    <Ionicons name="download-outline" size={14} color="#5A4A3B" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#5A4A3B' }}>
                      インポート
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={homeStyles.paletteGrid}>
                  {colorOptions.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => {
                        console.log(`本を追加:color = ${color}`);
                        handleColorSelection(color);
                      }}
                      style={homeStyles.newBookBtn}
                    >
                      <View
                        style={[
                          homeStyles.paletteSwatch,
                          { backgroundColor: getBookBadgeStyle(color, bookIconColors[color]).backgroundColor },
                        ]}
                      >
                        <View style={homeStyles.paletteIconGlyphWrap}>
                          <Ionicons
                            name="book-outline"
                            size={commonStyle.screenWidth / 10}
                            style={[
                              homeStyles.newBookBtnIcon,
                              homeStyles.bookIconGlyph,
                              { color: getBookBadgeStyle(color, bookIconColors[color]).iconColor },
                            ]}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      <Modal
        visible={showTitleInputModal}
        transparent
        animationType="fade"
        onRequestClose={closeTitleInputModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <TouchableWithoutFeedback onPress={closeTitleInputModal}>
            <View style={homeStyles.modalBackdropCenter}>
              <TouchableWithoutFeedback>
                <View style={homeStyles.renameModalCard}>
                  <Text style={homeStyles.renameModalTitle}>本のタイトルを入力</Text>
                  <TextInput
                    style={homeStyles.renameInput}
                    value={newBookTitle}
                    onChangeText={setNewBookTitle}
                    autoFocus
                    selectTextOnFocus
                    placeholder="本のタイトル"
                    placeholderTextColor="#A09588"
                  />
                  <View style={homeStyles.renameActionRow}>
                    <TouchableOpacity
                      onPress={closeTitleInputModal}
                      style={homeStyles.renameGhostButton}
                    >
                      <Text style={homeStyles.renameGhostButtonText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddBookWithTitle}
                      style={homeStyles.renamePrimaryButton}
                    >
                      <Text style={homeStyles.renamePrimaryButtonText}>作成</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={recolorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setRecolorModalVisible(false); setRecoloringBookId(null); }}
      >
        <TouchableWithoutFeedback onPress={() => { setRecolorModalVisible(false); setRecoloringBookId(null); }}>
          <View style={homeStyles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={homeStyles.newBookOptionsOverlay}>
                <Text style={homeStyles.paletteTitle}>本の色を選択</Text>
                <View style={homeStyles.paletteGrid}>
                  {colorOptions.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={async () => {
                        if (recoloringBookId) {
                          await recolorBook(recoloringBookId, color);
                        }
                        setRecolorModalVisible(false);
                        setRecoloringBookId(null);
                      }}
                      style={homeStyles.newBookBtn}
                    >
                      <View
                        style={[
                          homeStyles.paletteSwatch,
                          { backgroundColor: getBookBadgeStyle(color, bookIconColors[color]).backgroundColor },
                        ]}
                      >
                        <View style={homeStyles.paletteIconGlyphWrap}>
                          <Ionicons
                            name="book-outline"
                            size={commonStyle.screenWidth / 10}
                            style={[
                              homeStyles.newBookBtnIcon,
                              homeStyles.bookIconGlyph,
                              { color: getBookBadgeStyle(color, bookIconColors[color]).iconColor },
                            ]}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <TouchableWithoutFeedback onPress={closeRenameModal}>
            <View style={homeStyles.modalBackdropCenter}>
              <TouchableWithoutFeedback>
                <View style={homeStyles.renameModalCard}>
                  <Text style={homeStyles.renameModalTitle}>タイトルを変更</Text>
                  <TextInput
                    style={homeStyles.renameInput}
                    value={renameText}
                    onChangeText={setRenameText}
                    autoFocus
                    selectTextOnFocus
                    placeholder="本のタイトル"
                    placeholderTextColor="#A09588"
                  />
                  <View style={homeStyles.renameActionRow}>
                    <TouchableOpacity
                      onPress={closeRenameModal}
                      style={homeStyles.renameGhostButton}
                    >
                      <Text style={homeStyles.renameGhostButtonText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (renamingBookId && renameText.trim()) {
                          await renameBook(renamingBookId, renameText.trim());
                        }
                        closeRenameModal();
                      }}
                      style={homeStyles.renamePrimaryButton}
                    >
                      <Text style={homeStyles.renamePrimaryButtonText}>変更</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const localStyles = StyleSheet.create({
  helpOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    backgroundColor: 'rgba(39, 30, 22, 0.14)',
  },
  helpBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 253, 249, 0.99)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DCCAB4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  helpTitle: {
    fontSize: 13,
    color: '#3E3125',
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#4E4034',
    lineHeight: 17,
  },
  wordbookQuickBtnHelpMode: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  wordbookQuickBtnTextHelpMode: {
    color: '#4E4034',
  },
  rightActionContainer: {
    width: 80,
    marginBottom: 14,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    backgroundColor: '#6E5844',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  leftActionContainer: {
    width: 80,
    marginBottom: 14,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    backgroundColor: '#6E5844',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  swipeDeleteButton: {
    flex: 1,
    backgroundColor: '#B45145',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipePinButton: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedBadge: {
    position: 'absolute',
    top: 12,
    right: 74,
    zIndex: 2,
  },
});

export default HomeScreen;
