import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
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
import EditorScreen from './EditorScreen';
import { useEditor, Content } from '../context/EditorContext';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ENV } from '@config';
import { NoteElement } from './NoteContent';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const { 
  addContent, addText, addWord, addImage, addOutline, getContentsByBookId, 
  getTextsByContentId, getOutlinesByContentId, getWordsByContentId, getImagesByContentId,
  addPageImage, updatePageImage, getPageImagesByBookId,
  select
} = useEditor();

  const isTest = ENV.SCREEN_DEV; // 開発環境なら true、リリースは false
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.book_id === bookId);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPageNumber, setcurrentPageNumber] = useState(0);
  // pagerRef / PagerView removed — navigation between pages handled via state and DB
  const searchInputRef = useRef<TextInput>(null);
  // キーボードの表示状態を取得
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const editInputRef = useRef<TextInput>(null);

  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  // NoteContent から受け取るノート領域情報
  const [noteBounds, setNoteBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const wordInputRef = useRef<TextInput>(null);
  const definitionInputRef = useRef<TextInput>(null);


  // デバッグ用の背景色を返す関数
  const getDebugStyle = (color: string) =>
    isTest ? { backgroundColor: color } : {};

  // elements ベースのページデータ（文字列ではなく NoteElement の配列を保持）
  const [pagesElements, setPagesElements] = useState<NoteElement[][]>([]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 👇 表示状態とアニメーション用の値
  const [isSliderVisible, setisSliderVisible] = useState(true); // ← 表示／非表示の状態
  const fadeAnim = useRef(new Animated.Value(1)).current; // 1=表示, 0=非表示

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // 編集関連の状態
  const [editing, setEditing] = useState(false);
  const [editableText, setEditableText] = useState('');
  const [currentAttribute, setCurrentAttribute] = useState<'章' | '節' | '項' | '単語' | '画像' | '文章'>('文章');
  const ATTRIBUTES = ['章', '節', '項', '単語', '画像', '文章'] as const;
  // 単語用
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');

  const noteData: NoteElement[] = [
    { type: 'chapter', text: '第1章 React入門' },
    { type: 'section', text: '1.1 コンポーネントとは' },
    { type: 'text', text: 'ReactのコンポーネントはUIを構築するための部品です。' },
    { type: 'section', text: '1.2 コンポーネントとは' },
    { type: 'subsection', text: '1.1.1 関数コンポーネント' },
    { type: 'text', text: '関数コンポーネントはJavaScript関数で定義されます。' },
  ];

  // 編集画面で要素ごとの背景色を返すヘルパー
  const getBgColorForType = (type: NoteElement['type'] | string) => {
    switch (type) {
      case 'chapter':
        return 'rgba(255, 243, 205, 0.9)'; // light yellow
      case 'section':
        return 'rgba(210, 235, 255, 0.9)'; // light blue
      case 'subsection':
        return 'rgba(224, 255, 224, 0.9)'; // light green
      case 'word':
        return 'rgba(255, 230, 240, 0.95)'; // light pink
      case 'image':
        return 'rgba(240,240,240,0.95)'; // light gray
      default:
        return 'transparent';
    }
  };

  // 📌 ページ保存ロジック
  const savePageToDB = async () => {
    try {
      const contentId = await Crypto.randomUUID();

      const contentOrder = currentPageNumber;
      const pageNumber = currentPageNumber;
      // ⭐ 1) 既存 content を削除
      const oldContents = await getContentsByBookId(bookId);
      const oldPageContent = oldContents.find(c => c.page === pageNumber);
      // ⭐ 2) 新しい content を追加して保存
      
      const newContent: Content = {
        content_id: contentId,
        content_order: pageNumber,
        type: 'text',
        book_id: bookId,
        page: pageNumber,
        height: 0
      };
      
  await addContent(newContent);
      // NoteElement 配列があればそれを使って保存（文字列パースに依存しない）
      const elems = pagesElements[0];
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
            continue;
          }

          if (el.type === 'word') {
            await addWord({
              word_id: await Crypto.randomUUID(),
              word: (el as any).word,
              explanation: (el as any).meaning || '',
              word_order: i,
              content_id: contentId,
            });
            continue;
          }

          if (el.type === 'image') {
            await addImage({
              image_id: await Crypto.randomUUID(),
              image: (el as any).uri,
              content_id: contentId,
            });
            continue;
          }

          // default: text
          if (el.type === 'text') {
            await addText({
              text_id: await Crypto.randomUUID(),
              text: (el as any).text,
              content_id: contentId,
            });
          }
        }
      }

  // saved
    } catch (e) {
      console.error("保存エラー:", e);
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

    // DB が空なら、noteData をシードして最初のページを作成
    if (isTest && (!contents || contents.length === 0)) {
      const contentId = await Crypto.randomUUID();
      await addContent({
        content_id: contentId,
        content_order: 0,
        type: 'text',
        book_id: bookId,
        page: 0,
        height: 0,
      });

      // noteData を DB に書き込む
      for (let i = 0; i < noteData.length; i++) {
        const el = noteData[i];
        if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
          await addOutline({ outline_id: await Crypto.randomUUID(), type: el.type === 'chapter' ? 'chapter' : el.type === 'section' ? 'section' : 'subsection', outline: (el as any).text || '', content_id: contentId });
          continue;
        }
        if (el.type === 'word') {
          await addWord({ word_id: await Crypto.randomUUID(), word: (el as any).word || '', explanation: (el as any).meaning || '', word_order: i, content_id: contentId });
          continue;
        }
        if (el.type === 'image') {
          await addImage({ image_id: await Crypto.randomUUID(), image: (el as any).uri || '', content_id: contentId });
          continue;
        }
        // text
        if (el.type === 'text') {
          await addText({ text_id: await Crypto.randomUUID(), text: (el as any).text || '', content_id: contentId });
        }
      }

      // 再取得
      contents = await getContentsByBookId(bookId);
    }

    // ページ数を最大ページに合わせる
    const maxPage = contents.length > 0 ? Math.max(...contents.map(c => c.page), 0) : 0;

    for (let p = 0; p <= maxPage; p++) {
      await loadPageFromDB(p);
    }
    // seed page_images with the generated note background if none exist
    try {
      const imgs = await getPageImagesByBookId(bookId);
      // if page_image_id '0' exists, prefer DB value and do nothing
      const zero = (imgs || []).find((it) => it.page_image_id === '0');
      if (zero) {
        // nothing to seed; keep existing images
      } else {
        // need to generate or use cache
        const CACHE_FILE = FileSystem.cacheDirectory + 'background.webp';
        let imageUri = '';
        try {
          const info = await FileSystem.getInfoAsync(CACHE_FILE);
          if (info.exists) {
            imageUri = info.uri;
          } else {
            // generate background into cache
            try {
              await generateDefaultBackground(CACHE_FILE, 0, book?.color || 'red');
              const created = await FileSystem.getInfoAsync(CACHE_FILE);
              if (created.exists) imageUri = created.uri;
            } catch (genErr) {
              console.warn('generateDefaultBackground failed, falling back to asset', genErr);
            }
          }
        } catch (e) {
          console.warn('could not stat cache file for default note image', e);
        }

        if (!imageUri) {
          imageUri = Image.resolveAssetSource(require('../../assets/images/note.png')).uri;
        }

        // insert or update special id '0'
        try {
          await addPageImage({ page_image_id: '0', image_path: imageUri, page_order: 0, book_id: bookId });
        } catch (insertErr) {
          console.warn('insert page_image failed, attempting update', insertErr);
          try {
            await updatePageImage('0', { image_path: imageUri });
          } catch (uErr) {
            console.error('updatePageImage failed:', uErr);
          }
        }
      }
    } catch (e) {
      console.error('seed page_images error:', e);
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
      duration: 600, // ← アニメーションの速度（ms）
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isSliderVisible]);

  useEffect(() => {
    if (editing && currentAttribute !== '単語') {
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 100);
    }
  }, [editing, currentAttribute]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 150);
    }
  }, [editing]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity onPress={() => {console.log('目次ボタン押下')}}>
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
            onPress={() => {
              console.log('メニューボタン押下');
              openMenu();}}
              style={[
                notebookStyles.menuBtn,
                getDebugStyle('rgba(0, 255, 0, 0.15)')]}>
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
                  navigation.navigate('Edit', { bookId: book.book_id }); // ← 編集画面へ遷移
                }}
            title="ページ編集"
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={() => {
              console.log('メニュー/ページ削除ボタン押下');
              closeMenu();
              dispatch({ type: 'DELETE_BOOK', bookId: book!.book_id });
            }}
            title="ページ削除"
            leadingIcon="trash-can"
          />
          <Menu.Item
            onPress={() => {
              console.log('メニュー/本削除ボタン押下');
              closeMenu();
              dispatch({ type: 'DELETE_BOOK', bookId: book!.book_id });
            }}
            title="本削除"
            titleStyle={notebookStyles.deleteOption}
            leadingIcon="delete"
          />
        </Menu>
      ),
    });
  }, [navigation, menuVisible]);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  return (
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
          <NoteContent 
            backgroundColor={book.color}
            elements={pagesElements[currentPageNumber]}
            onNoteLayout={setNoteBounds}
            onBackgroundGenerated={async (uri: string) => {
              try {
                // try insert special id '0', fall back to update if insert fails
                await addPageImage({ page_image_id: '0', image_path: uri, page_order: 0, book_id: bookId });
              } catch (insErr) {
                console.warn('addPageImage failed on background generation, attempting update', insErr);
                try {
                  await updatePageImage('0', { image_path: uri });
                } catch (updErr) {
                  console.error('updatePageImage failed on background generation:', updErr);
                }
              }
              // after insert/update, fetch current page_images for this book and log to terminal
              try {
                const rows = await getPageImagesByBookId(bookId);
                logTable('page_images', rows as any[]);
              } catch (logErr) {
                console.warn('failed to log page_images after background generation:', logErr);
              }
            }}
          >
          </NoteContent>
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

          {/* 編集画面 */}
          {editing && (
            <EditorScreen
              currentAttribute={currentAttribute}
              setCurrentAttribute={setCurrentAttribute}
              wordInputRef={wordInputRef}
              editInputRef={editInputRef}
              definitionInputRef={definitionInputRef}
              setPagesElements={setPagesElements}
              currentPageNumber={currentPageNumber}
              editingLineIndex={editingLineIndex}
              setEditingLineIndex={setEditingLineIndex}
              setEditing={setEditing}
              word={word}
              setWord={setWord}
              definition={definition}
              setDefinition={setDefinition}
              pagesElements={pagesElements}
              noteBounds={noteBounds}
              keyboardHeight={keyboardHeight}
            />
          )}

          {/* 🔍 検索欄 */}
          {showSearch && (
            <View
              style={[
                notebookStyles.searchBoxContainer,
                getDebugStyle('rgba(255, 0, 0, 0.2)'), // 検索ボックス：薄い赤
              ]}
            >
              <Ionicons name="search" size={commonStyle.screenWidth/12} color="gray" />
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
                setShowSearch(false);}}>
                <Ionicons name="close" size={commonStyle.screenWidth/12} color="gray" />
              </TouchableOpacity>
            </View>
          )}

          {/* 編集ボタン（右下） */}
          <TouchableOpacity
            style={[
              notebookStyles.editButton,
              {bottom: !editing ? commonStyle.screenHeight*0.02 : commonStyle.screenHeight*0.15}
            ]}
              onPress={ async () => {
                console.log('編集ボタン押下:', { editing });
                if (editing) { // ✅ 編集中なら保存動作
                  // pagesElements があればそれを優先して pageContent を再生成
                  const elemsForSave = pagesElements[currentPageNumber];
                  setEditing(false);
                  Keyboard.dismiss();
                  // DBへ保存
                  await savePageToDB();
                } else { // ✅ 編集開始：現在ページ内容をロード
                  // 入力欄は空にする
                  setEditableText('');
                  setWord('');
                  setDefinition('');
                  setEditingLineIndex(null);
                  setEditing(true);
                }
              }}
          >
            <Ionicons name={editing ? 'checkmark' : 'create'} size={commonStyle.screenWidth/12} color="white" />
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
  );
};

export default NotebookScreen;
