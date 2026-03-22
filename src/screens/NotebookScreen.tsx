import React, { useState, useLayoutEffect, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { notebookStyles } from '../styles/notebookStyle';
import * as commonStyle from '../styles/commonStyle';
import NoteContent, { computeMaxRows } from './NoteContent';
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

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const headerHeight = useHeaderHeight();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  // NoteContent と同じ計算式でノート領域を定義
  const noteCapRect = {
    x: Math.round(screenWidth * 0.01),
    y: 0,
    width: Math.round(screenWidth * 0.98),
    height: Math.round((screenHeight - headerHeight) * 0.87),
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
  const { bookId } = route.params;
  const { state, dispatch, deleteBook } = useLibrary();

  const book = state.books.find((b) => b.book_id === bookId);
  const [menuVisible, setMenuVisible] = useState(false);
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
  pagesElementsRef.current = pagesElements;
  currentPageNumberRef.current = currentPageNumber;

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // アニメーション
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // ===== ページ一覧モーダルを開く（サムネイルをDBから読み込む） =====
  const openPageList = async () => {
    try {
      // DB から現在の本のすべてのページをリロード（最新データを取得）
      await loadAllPages();
      
      // サムネイル画像を読み込む
      const imgs = await getPageImagesByBookId(bookId);
      const uriMap: Record<number, string> = {};
      imgs.forEach(img => { uriMap[Number(img.page_order)] = img.image_path; });
      setPageImageUris(uriMap);
      
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
  const [pageListVisible, setPageListVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [addAfterIndex, setAddAfterIndex] = useState<number>(0);

  // ページサムネイル（page_order → URI）
  const [pageImageUris, setPageImageUris] = useState<Record<number, string>>({});

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
        .filter(el => el.type === 'chapter' || el.type === 'section' || el.type === 'subsection')
        .map(el => ({
          pageNum,
          text: (el as any).text as string,
          indentLevel: el.type === 'chapter' ? 0 : el.type === 'section' ? 1 : 2,
        }))
    );
  }, [pagesElements]);

  // ===== 検索結果 =====
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { pageNum: number; type: string; text: string }[] = [];
    pagesElements.forEach((pageElems, pageNum) => {
      (pageElems || []).forEach(el => {
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
    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) next[currentPageNumber] = [];
      next[currentPageNumber] = next[currentPageNumber].map((el, i) => i === index ? newEl : el);
      return next;
    });
  };

  const handleDeleteElement = (index: number) => {
    setPagesElements(prev => {
      const next = [...prev];
      if (!next[currentPageNumber]) return next;
      next[currentPageNumber] = next[currentPageNumber].filter((_, i) => i !== index);
      return next;
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
      return next;
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
      return next;
    });
    setTypePickerVisible(false);
  };

  // ===== 行タップ → 編集モード開始 =====
  const handleEditStart = (index: number) => {
    setPendingFocusIndex(index);
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
    try {
      Keyboard.dismiss();
      const pageNumber = await savePageToDB(); // ref から最新ページ番号取得
      if (pageNumber !== undefined) {
        // 保存後は全ページを再読み込みして DB との整合性を確保
        await loadAllPages();
        setEditing(false);
        setPendingFocusIndex(undefined);
        setTimeout(() => saveThumbnailAsync(pageNumber), 400);
      }
    } catch (e) {
      console.error('保存エラー:', e);
      setEditing(false);
      setPendingFocusIndex(undefined);
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
          return { type: o.type as 'chapter' | 'section' | 'subsection', text: o.outline };
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
          return { type: o.type as 'chapter' | 'section' | 'subsection', text: o.outline };
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

    // 一括で State を更新（順序が確実に保証される）
    setPagesElements(newPagesElements);
  };

  useEffect(() => { // 初回ロード時に DB からページデータを読み込む
    loadAllPages();
  }, [bookId]);

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
      headerTitle: () => (
        <TouchableOpacity onPress={() => { setTocVisible(true); console.log('目次ボタン押下'); }}>
          <Text style={notebookStyles.outlineBtn}>目次</Text>
        </TouchableOpacity>
      ),
      headerRight: () =>
        editing ? (
          // 編集中: チェックボタン（保存）
          <TouchableOpacity
            onPress={() => { console.log('保存ボタン押下'); handleSave(); }}
            style={[notebookStyles.menuBtn, { paddingHorizontal: 12 }]} // color="#007AFF"
          >
            <Ionicons name="checkmark" size={35} color="#007AFF" />
          </TouchableOpacity>
        ) : (
          // 通常: ミートボールメニュー
          <Menu
            key={menuVisible ? 'open' : 'closed'}
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <TouchableOpacity
                onPress={() => { console.log('メニューボタン押下'); openMenu(); }}
                style={[notebookStyles.menuBtn, getDebugStyle('rgba(0, 255, 0, 0.15)')]}>
                <View style={notebookStyles.menuBtnIcon}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="black" />
                </View>
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
        ),
    });
  }, [navigation, menuVisible, editing, currentPageNumber]);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  return (
    <>
    <TouchableWithoutFeedback 
      disabled={editing}
      onPress={() => {
        if (showSearch) {
          // 検索中は検索バー閉じる
          setShowSearch(false);

          // フォーカス解除してキーボードを確実に閉じる
          if (searchInputRef.current) {
            searchInputRef.current.blur();
            Keyboard.dismiss();
          } else {
            Keyboard.dismiss();
          }
        }
      }}
      style={[
        notebookStyles.notebookScreenWrapper,
        getDebugStyle('rgba(255, 255, 0, 1)')]}
    >
      <View style={notebookStyles.notebookContentsContainer}>
        {/* <NoteBackground> */}
          <View
            ref={noteContentRef}
            collapsable={false}
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
          <NoteContent 
            key={noteContentKey}
            backgroundColor={book.color}
            elements={pagesElements[currentPageNumber]}
            onNoteLayout={setNoteBounds}
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
          </View>
          {/* 編集ボタン
          虫眼鏡ボタン
          スライダー */}
        {/* </NoteBackground> */}

          {/* ページ番号（右上） */}
          {!editing && (
            <Text
              style={{
                position: 'absolute',
                top: 10,
                right: 30,
                fontSize: 14,
                color: '#666',
                fontWeight: '500',
              }}
            >
              {currentPageNumber + 1}
            </Text>
          )}

          {/* ページ一覧ボタン（左下） */}
          {!editing && (
            <TouchableOpacity
              disabled={editing}
              onPress={() => {
                console.log('ページ一覧ボタン押下');
                openPageList();
              }}
              style={[
                notebookStyles.pageListBtn,
                { position: 'absolute', bottom: commonStyle.screenHeight * 0.02 + (commonStyle.screenWidth / 6 - commonStyle.screenWidth / 7) / 2, left: 20 },
                getDebugStyle('rgba(0, 0, 0, 0.4)'),
              ]}
            >
              <Ionicons name="albums-outline" size={commonStyle.screenWidth/15} color="white" />
            </TouchableOpacity>
          )}

          {/* スライダー（ページ一覧ボタンと+ボタンの間） */}
          {!editing && (
            <View
              style={{
                position: 'absolute',
                bottom: commonStyle.screenHeight * 0.02,
                left: commonStyle.screenWidth * 0.25,
                right: commonStyle.screenWidth * 0.25,
                height: commonStyle.screenWidth / 6,
                borderRadius: 12,
                justifyContent: 'center',
                paddingHorizontal: 10,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 2 },
                elevation: 5,
              }}
            >
              <Slider
                key={`slider-${pagesElements.length}`}
                style={{ flex: 1 }}
                minimumValue={0}
                maximumValue={Math.max(pagesElements.length - 1, 0)}
                step={1}
                value={currentPageNumber}
                minimumTrackTintColor="#fff"
                maximumTrackTintColor="#666"
                thumbTintColor="#fff"
                onValueChange={ async(v) => {
                  setcurrentPageNumber(v);
                  console.log('ページ数変更:', v+1);
                  await loadPageFromDB(v);
                }}
              />
            </View>
          )}

          {/* 編集画面: EditorScreenは廃止。NoteContentが直接編集機能を提供 */}

          {/* 🔍 検索欄と検索結果 */}
          {showSearch && (
            <View style={{ 
              position: 'absolute',
              bottom: isKeyboardVisible ? keyboardHeight : 0,
              left: 0,
              right: 0,
              flexDirection: 'column',
            }}>
              {/* 検索結果一覧 */}
              {searchResults.length > 0 && (
                <FlatList
                  data={searchResults}
                  keyExtractor={(_, i) => `result-${i}`}
                  style={{
                    maxHeight: commonStyle.screenHeight * 0.3,
                    backgroundColor: 'white',
                    marginHorizontal: 20,
                    marginBottom: 4,
                    borderRadius: 8,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 4,
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setcurrentPageNumber(item.pageNum);
                        setShowSearch(false);
                        setSearchQuery('');
                      }}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#eee' }}
                    >
                      <Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>ページ {item.pageNum + 1} ・ {item.type}</Text>
                      <Text numberOfLines={2} style={{ fontSize: 15 }}>{item.text}</Text>
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
                />
                <TouchableOpacity onPress={() => {
                  console.log('検索欄閉じるボタン押下');
                  setShowSearch(false);
                  setSearchQuery('');
                }}>
                  <Ionicons name="close" size={commonStyle.screenWidth / 12} color="gray" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ページ追加ボタン（右下）+ */}
          {!editing && (
            <TouchableOpacity
              style={[
                notebookStyles.editButton,
                { bottom: commonStyle.screenHeight * 0.02 }
              ]}
              onPress={async () => {
                console.log('ページ追加ボタン押下');
                closeMenu();
                
                try {
                  // 新ページを挿入する位置（現在ページの次）
                  const insertPosition = currentPageNumber + 1;
                  
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
                  // 番号が大きい順に処理して上書き衝突を防ぐ
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
                  
                  // ステップ1: スライダーの最大値を更新（新ページを現在ページの次に挿入）
                  setPagesElements(prev => {
                    const newPages = [...prev];
                    newPages.splice(insertPosition, 0, []); // 指定位置に空ページを挿入
                    return newPages;
                  });
                  
                  // ステップ2: 新ページへ遷移
                  setTimeout(() => {
                    setcurrentPageNumber(insertPosition);
                  }, 0);
                } catch (e) {
                  console.error('ページ追加エラー:', e);
                }
              }}
            >
              <Ionicons name="add" size={commonStyle.screenWidth / 12} color="white" />
            </TouchableOpacity>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', width: '85%', maxHeight: '70%', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>目次</Text>
            {tocItems.length === 0 ? (
              <Text style={{ color: '#888', textAlign: 'center', marginVertical: 24 }}>見出しがありません</Text>
            ) : (
              <FlatList
                data={tocItems}
                keyExtractor={(_, i) => `toc-${i}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setcurrentPageNumber(item.pageNum); setTocVisible(false); }}
                    style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#eee', paddingLeft: item.indentLevel * 16 }}
                  >
                    <Text style={{ fontSize: 15 - item.indentLevel, fontWeight: item.indentLevel === 0 ? 'bold' : 'normal' }}>{item.text}</Text>
                    <Text style={{ color: '#999', fontSize: 12 }}>ページ {item.pageNum + 1}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              onPress={() => setTocVisible(false)}
              style={{ marginTop: 12, alignSelf: 'flex-end' }}
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== ページ一覧モーダル ===== */}
      <Modal
        visible={pageListVisible}
        transparent
        animationType="slide"
        onRequestClose={async () => {
          // ページ一覧を閉じるときに、現在の pagesElements の順番をDB に書き込む
          try {
            const allContents = await getContentsByBookId(bookId);
            // 各ページのpage値を 0, 1, 2, ... に更新
            for (let i = 0; i < pagesElements.length; i++) {
              const content = allContents.find(c => c.page === i);
              if (content) {
                await updateContent(content.content_id, { page: i });
              }
            }
          } catch (e) {
            console.error('ページ順序保存エラー:', e);
          }
          setPageListVisible(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', width: '92%', maxHeight: '80%', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>ページ一覧</Text>
            <FlatList
              data={pagesElements}
              keyExtractor={(_, i) => `page-list-${i}`}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ index }) => {
                const thumbUri = pageImageUris[index];
                const isCurrentPage = index === currentPageNumber;
                return (
                  <TouchableOpacity
                    onPress={() => { setcurrentPageNumber(index); setPageListVisible(false); }}
                    style={{
                      width: '48%',
                      marginBottom: 12,
                      borderRadius: 8,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: isCurrentPage ? '#007AFF' : '#e0e0e0',
                    }}
                  >
                    {thumbUri ? (
                      <Image
                        source={{ uri: thumbUri }}
                        style={{ width: '100%', aspectRatio: 0.65 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{
                        width: '100%',
                        aspectRatio: 0.65,
                        backgroundColor: '#f5f5f5',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name="document-outline" size={32} color="#ccc" />
                        <Text style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>未保存</Text>
                      </View>
                    )}
                    <View style={{
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      backgroundColor: isCurrentPage ? '#007AFF' : 'white',
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: 'bold',
                        color: isCurrentPage ? 'white' : '#333',
                        textAlign: 'center',
                      }}>
                        ページ {index + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => setPageListVisible(false)}
              style={{ marginTop: 8, alignSelf: 'flex-end' }}
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== 要素タイプ選択モーダル（インプレース追加） ===== */}
      <Modal
        visible={typePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTypePickerVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: 'white', borderRadius: 14, padding: 20, width: '75%' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>追加する要素を選択</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                  {ELEMENT_LABELS.map(({ label, type }) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => handleAddElement(type)}
                      style={{
                        width: '42%',
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: '#007AFF',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => setTypePickerVisible(false)}
                  style={{ marginTop: 12, alignSelf: 'center' }}
                >
                  <Text style={{ color: '#888', fontSize: 15 }}>キャンセル</Text>
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

