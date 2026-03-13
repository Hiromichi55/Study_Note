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
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { notebookStyles } from '../styles/notebookStyle';
import * as commonStyle from '../styles/commonStyle';
import NoteContent, { generateDefaultBackground } from './NoteContent';
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
  select
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

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // スライダー表示状態とアニメーション
  const [isSliderVisible, setisSliderVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // ===== ページ一覧モーダルを開く（サムネイルをDBから読み込む） =====
  const openPageList = async () => {
    setPageListVisible(true);
    try {
      const imgs = await getPageImagesByBookId(bookId);
      const uriMap: Record<number, string> = {};
      // page_orderはSQLiteから文字列で返ってくる場合があるためNumber()で指定
      imgs.forEach(img => { uriMap[Number(img.page_order)] = img.image_path; });
      setPageImageUris(uriMap);
    } catch (e) {
      console.warn('ページ画像読み込みエラー:', e);
    }
  };

  // 編集状態
  const [editing, setEditing] = useState(false);

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
    setAddAfterIndex(afterIndex);
    setTypePickerVisible(true);
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

  // ===== ページ削除 =====
  const deleteCurrentPage = async () => {
    try {
      const contents = await getContentsByBookId(bookId);
      const pageContent = contents.find(c => c.page === currentPageNumber);
      if (pageContent) {
        await deleteContent(pageContent.content_id);
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
      const pageNumber = currentPageNumber;
      // ⭐ 1) 既存 content をカスケード削除
      const oldContents = await getContentsByBookId(bookId);
      const oldPageContent = oldContents.find(c => c.page === pageNumber);
      if (oldPageContent) {
        await deleteContent(oldPageContent.content_id);
      }

      // ⭐ 2) 新しい content を追加して保存
      const contentId = await Crypto.randomUUID();
      const newContent: Content = {
        content_id: contentId,
        content_order: pageNumber,
        type: 'text',
        book_id: bookId,
        page: pageNumber,
        height: 0
      };
      await addContent(newContent);

      const elems = pagesElements[pageNumber];
      if (Array.isArray(elems) && elems.length > 0) {
        for (let i = 0; i < elems.length; i++) {
          const el = elems[i];
          if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
            await addOutline({
              outline_id: await Crypto.randomUUID(),
              type: el.type === 'chapter' ? 'chapter' : el.type === 'section' ? 'section' : 'subsection',
              outline: (el as any).text,
              content_id: contentId,
            });
          } else if (el.type === 'word') {
            await addWord({
              word_id: await Crypto.randomUUID(),
              word: (el as any).word,
              explanation: (el as any).meaning || '',
              word_order: i,
              content_id: contentId,
            });
          } else if (el.type === 'image') {
            await addImage({
              image_id: await Crypto.randomUUID(),
              image: (el as any).uri,
              content_id: contentId,
            });
          } else if (el.type === 'text') {
            await addText({
              text_id: await Crypto.randomUUID(),
              text: (el as any).text,
              content_id: contentId,
            });
          }
        }
      }
    } catch (e) {
      console.error('保存エラー:', e);
    }
  };

  const loadPageFromDB = async (pageNumber: number, options?: { returnText?: boolean }) => {
    try {
      const contents = await getContentsByBookId(bookId);
      const pageContentRow = contents.find(c => c.page === pageNumber);

      if (!pageContentRow) return;

      const contentId = pageContentRow.content_id;

      const texts = await getTextsByContentId(contentId);
      const outlines = await getOutlinesByContentId(contentId);
      const words = await getWordsByContentId(contentId);
      const images = await getImagesByContentId(contentId);

      // DB から NoteElement[] を組み立てる（文字列マーカーに依存しない）
  const elements: NoteElement[] = [];
  outlines.forEach(o => {
        if (o.type === 'chapter') elements.push({ type: 'chapter', text: o.outline });
        else if (o.type === 'section') elements.push({ type: 'section', text: o.outline });
        else if (o.type === 'subsection') elements.push({ type: 'subsection', text: o.outline });
      });
      texts.forEach(t => elements.push({ type: 'text', text: t.text }));
      words.forEach(w => elements.push({ type: 'word', word: w.word, meaning: w.explanation }));
  images.forEach(img => elements.push({ type: 'image', uri: (img as any).image_path || (img as any).image || '' }));

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

    // DB が空なら空のページを1つ作成
    if (!contents || contents.length === 0) {
      const contentId = await Crypto.randomUUID();
      await addContent({
        content_id: contentId,
        content_order: 0,
        type: 'text',
        book_id: bookId,
        page: 0,
        height: 0,
      });
      contents = await getContentsByBookId(bookId);
    }

    // ページ数を最大ページに合わせる
    const maxPage = contents.length > 0 ? Math.max(...contents.map(c => c.page), 0) : 0;

    for (let p = 0; p <= maxPage; p++) {
      await loadPageFromDB(p);
    }
  };

  useEffect(() => { // 初回ロード時に DB からページデータを読み込む
    loadAllPages();
  }, [bookId]);


  useEffect(() => {
    const loadContents = async () => {
      if (!state.isLoading) {
        await getContentsByBookId(bookId);
      }
    };
    loadContents();
  }, [bookId]);

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

  // 👇 表示状態が変わったらアニメーションさせる
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isSliderVisible ? 1 : 0,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isSliderVisible]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity onPress={() => { setTocVisible(true); console.log('目次ボタン押下'); }}>
          <Text style={notebookStyles.outlineBtn}>目次</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
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
              console.log('メニュー/ページ追加ボタン押下');
              closeMenu();
              setPagesElements(prev => [...prev, []]);
            }}
            title="ページ追加"
            rippleColor="rgba(0, 122, 255, 0.3)"
            leadingIcon="plus"
          />
          <Menu.Item
            onPress={() => {
              console.log('メニュー/ページ編集ボタン押下');
              closeMenu();
              setEditing(true);
            }}
            title="ページ編集"
            leadingIcon="pencil"
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
          <Menu.Item
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
          />
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
        setisSliderVisible(!isSliderVisible);
        isSliderVisible ? console.log('スライダー非表示') : console.log('スライダー表示');
        if (showSearch) {
          // 検索中は検索バー閉じてスライダー表示
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
            backgroundColor={book.color}
            elements={pagesElements[currentPageNumber]}
            onNoteLayout={setNoteBounds}
            isEditing={editing}
            onElementChange={handleElementChange}
            onDeleteElement={handleDeleteElement}
            onTapEmpty={handleTapEmpty}
            onBackgroundGenerated={(uri: string) => {
              console.log('背景画像生成完了:', uri);
            }}
          />
          </View>
          {/* 編集ボタン
          虫眼鏡ボタン
          スライダー */}
        {/* </NoteBackground> */}

          {/* ページ一覧ボタンとスライダー */}
          {isSliderVisible && !editing && (
            <View
              style={[
                notebookStyles.pageListBtnAndSliderContainer,
                { bottom: !showSearch ? commonStyle.screenHeight*0.25 : commonStyle.screenHeight*0.3, },
                getDebugStyle('rgba(0, 0, 255, 0.2)'), // スライダー：薄い青
            ]}
            >
                {/*  📚 ページ一覧ボタン */}
                <TouchableOpacity
                  disabled={editing}
                  onPress={() => {
                    console.log('ページ一覧ボタン押下');
                    openPageList();
                  }}
                  style={[
                    notebookStyles.pageListBtn,
                    getDebugStyle('rgba(0, 0, 0, 0.4)'),
                  ]}
                >
                  <Ionicons name="albums-outline" size={commonStyle.screenWidth/15} color="white" />
                </TouchableOpacity>

              {/* 丸いつまみのスライダー（右70%） */}
                <Slider
                  style={notebookStyles.slider}
                  minimumValue={0}
                  maximumValue={Math.max(pagesElements.length - 1, 0)}
                  step={1}
                  value={currentPageNumber}
                  minimumTrackTintColor="#000"
                  maximumTrackTintColor="#ccc"
                  thumbTintColor="#000"
                  onValueChange={ async(v) => {
                    setcurrentPageNumber(v);
                    console.log('ページ数変更:', v);
                    // PagerView was removed; just update page state and load
                    // ★ ページ切り替え時に読み込み
                    await loadPageFromDB(v);
                    // await loadPageFromPDF(v); // PDFをDBから読み込むようにする
                  }}
                />
            </View>
          )}

          {/* 編集画面: EditorScreenは廃止。NoteContentが直接編集機能を提供 */}

          {/* 🔍 検索欄と検索結果 */}
          {showSearch && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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

          {/* 編集ボタン（右下） */}
          <TouchableOpacity
            style={[
              notebookStyles.editButton,
              { bottom: commonStyle.screenHeight * 0.02 }
            ]}
            onPress={async () => {
              console.log('編集ボタン押下:', { editing });
              if (editing) {
                setEditing(false);
                Keyboard.dismiss();
                await savePageToDB();
                // UIが isEditing=false で再描画された後にキャプチャ
                setTimeout(async () => {
                  try {
                    if (noteContentRef.current) {
                      const capturedUri = await captureRef(noteContentRef, { format: 'jpg', quality: 0.8 });
                      // captureRef は物理ピクセルで画像を生成するため PixelRatio で座標変換
                      const pr = PixelRatio.get();
                      const cropped = await manipulateAsync(
                        capturedUri,
                        [{ crop: {
                          originX: Math.round(noteCapRect.x * pr),
                          originY: Math.round(noteCapRect.y * pr),
                          width:   Math.round(noteCapRect.width * pr),
                          height:  Math.round(noteCapRect.height * pr),
                        }}],
                        { format: SaveFormat.JPEG, compress: 0.8 }
                      );
                      const ts = Date.now();
                      const thumbPath = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory!) +
                        `thumb_${bookId}_p${currentPageNumber}_${ts}.jpg`;
                      await FileSystem.copyAsync({ from: cropped.uri, to: thumbPath });

                      const imgs = await getPageImagesByBookId(bookId);
                      const existing = imgs.find(img => Number(img.page_order) === currentPageNumber);
                      if (existing) {
                        // 旧ファイルを削除（任意）
                        try { await FileSystem.deleteAsync(existing.image_path, { idempotent: true }); } catch {}
                        await updatePageImage(existing.page_image_id, { image_path: thumbPath });
                      } else {
                        await addPageImage({
                          page_image_id: await Crypto.randomUUID(),
                          image_path: thumbPath,
                          page_order: currentPageNumber,
                          book_id: bookId,
                        });
                      }
                      // ローカル状態も新ファイル名のまま更新（URI変化でRNが再読込する）
                      setPageImageUris(prev => ({ ...prev, [currentPageNumber]: thumbPath }));
                      console.log(`ページ${currentPageNumber + 1}のサムネイルを保存しました`);
                    }
                  } catch (e) {
                    console.warn('サムネイル保存エラー:', e);
                  }
                }, 500);
              } else {
                setEditing(true);
              }
            }}
          >
            <Ionicons name={editing ? 'checkmark' : 'create'} size={commonStyle.screenWidth / 12} color="white" />
          </TouchableOpacity>

          {/* 虫眼鏡ボタン（左下） */}
          {!editing && (
            <TouchableOpacity
              style={notebookStyles.searchBtn}
              onPress={() => {
                console.log('虫眼鏡ボタン押下');
                setShowSearch(!showSearch)}}
            >
              <Ionicons name="search" size={commonStyle.screenWidth/12} color="white" />
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
        onRequestClose={() => setPageListVisible(false)}
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

