import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  Text,
  ImageBackground,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
  ScrollView
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { styles } from '../styles/notebookTheme';
import * as commonTheme from '../styles/commonTheme';
import NoteContent from './NoteContent';
import { useEditor, Content } from '../context/EditorContext';
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
  select
} = useEditor();

  const isTest = ENV.SCREEN_DEV; // 開発環境なら true、リリースは false
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.id === bookId);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null); // ← ページ移動用参照を追加
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

  const [pages, setPages] = useState<string[]>([]);
  // elements ベースのページデータ（文字列ではなく NoteElement の配列を保持）
  const [pagesElements, setPagesElements] = useState<NoteElement[][]>([]);

  const [pageContent, setPageContent] = useState(pages[currentPage] ?? '');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 👇 表示状態とアニメーション用の値
  const [isVisible, setIsVisible] = useState(true); // ← 表示／非表示の状態
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
    // { type: 'word', word: 'props', meaning: '親コンポーネントから渡される値' },
    //{ type: 'image', uri: 'https://example.com/sample.png' },
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
      const page = currentPage;

      // ⭐ 1) 既存 content を削除
      const oldContents = await getContentsByBookId(bookId);
      const oldPageContent = oldContents.find(c => c.page === page);
      // ⭐ 2) 新しい content を追加して保存
      const contentId = await Crypto.randomUUID();
      
      const newContent: Content = {
        content_id: contentId,
        content_order: page,
        type: 'text',
        book_id: bookId,
        page,
        height: 0
      };
      
      await addContent(newContent);
      const Contents = await select<Content>('contents');
      console.log(pageContent);
      // console.log('Contents from DBTestComponent:', Contents);

      // NoteElement 配列があればそれを使って保存（文字列パースに依存しない）
      const elems = pagesElements[page];
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

      console.log("ページを DB に保存しました（上書き完了）");
      const allContents = await select<Content>('contents');
      // console.log('Contents from DBTestComponent:', allContents);
    } catch (e) {
      console.error("保存エラー:", e);
    }
  };

  const loadPageFromDB = async (pageIndex: number, options?: { returnText?: boolean }) => {
    try {
      const contents = await getContentsByBookId(bookId);
      const pageContentRow = contents.find(c => c.page === pageIndex);

      if (!pageContentRow) {
        if (!options?.returnText) setPageContent('');
        return '';
      }

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
      images.forEach(img => elements.push({ type: 'image', uri: img.image }));

      const finalText = elements
        .map(el => {
          if (el.type === 'chapter') return `【章】${el.text}`;
          if (el.type === 'section') return `【節】${el.text}`;
          if (el.type === 'subsection') return `【項】${el.text}`;
          if (el.type === 'word') return `【単語】${el.word}\n${el.meaning}`;
          if (el.type === 'image') return `【画像】${el.uri}`;
          return el.type === 'text' ? el.text : '';
        })
        .join('\n');

      // pagesElements を更新して UI が NoteElement を使えるようにする
      setPagesElements(prev => {
        const next = [...prev];
        next[pageIndex] = elements;
        return next;
      });

      if (!options?.returnText) {
        setPageContent(finalText);
        setPages(prev => {
          const updated = [...prev];
          updated[pageIndex] = finalText;
          return updated;
        });
      }

      return finalText;

    } catch (e) {
      console.error('DB 読み込みエラー: ', e);
      return '';
    }
  };

  useEffect(() => {
    const loadAllPages = async () => {
      let contents = await getContentsByBookId(bookId);

      // DB が空なら、noteData をシードして最初のページを作成
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

      const loadedPages: string[] = [];

      for (let p = 0; p <= maxPage; p++) {
        const result = await loadPageFromDB(p, { returnText: true });
        loadedPages[p] = result || '';
      }

      setPages(loadedPages);

      // 最初のページのテキストをセット
      setPageContent(loadedPages[currentPage] ?? '');
    };

    loadAllPages();
  }, [bookId]);


  useEffect(() => {
    const loadContents = async () => {
      if (!state.isLoading) {
        const contents = await getContentsByBookId(bookId);
        console.log(contents);
      }
    };
    loadContents();
  }, [bookId]);


  // useEffect(() => {
  //   loadPageFromDB(currentPage);
  // }, []);


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
      toValue: isVisible ? 1 : 0,
      duration: 300, // ← アニメーションの速度（ms）
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

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
        <TouchableOpacity onPress={() => console.log('目次を開く')}>
          <Text
            style={{
              fontSize: 20,
              color: 'black',
            }}
          >
            目次
          </Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <Menu
          key={menuVisible ? 'open' : 'closed'}
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <TouchableOpacity onPress={openMenu} 
              style={[
                styles.menuIconWrapper,
                getDebugStyle('rgba(0, 255, 0, 0.15)')]}>
              <View style={styles.menuButton}>
                <Ionicons name="ellipsis-horizontal" size={20} color="black" />
              </View>
            </TouchableOpacity>
          }
          contentStyle={{
            backgroundColor: 'white',
            marginTop: 40,
          }}
        >
          <Menu.Item
            onPress={() => {
              closeMenu();
              setPages((prev) => [...prev, '']);
            }}
            title="ページ追加"
            rippleColor="rgba(0, 122, 255, 0.3)"
            leadingIcon="plus"
          />
          <Menu.Item
            onPress={() => {
                  closeMenu();
                  navigation.navigate('Edit', { bookId: book.id }); // ← 編集画面へ遷移
                }}
            title="ページ編集"
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={() => {
              closeMenu();
              dispatch({ type: 'DELETE_BOOK', bookId: book!.id });
            }}
            title="ページ削除"
            leadingIcon="trash-can"
          />
          <Menu.Item
            onPress={() => {
              closeMenu();
              dispatch({ type: 'DELETE_BOOK', bookId: book!.id });
            }}
            title="本削除"
            titleStyle={{ color: 'red'}}
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
        if (showSearch) {
          // 検索中は検索バー閉じてスライダー表示
          setShowSearch(false);
          setIsVisible(true);

          // フォーカス解除してキーボードを確実に閉じる
          if (searchInputRef.current) {
            searchInputRef.current.blur();
            Keyboard.dismiss();
          } else {
            Keyboard.dismiss();
          }
        } else {
          // 検索バー非表示時はスライダー切替
          setIsVisible((prev) => !prev);
        }
      }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={[
            styles.container,
            getDebugStyle('rgba(0, 255, 0, 0.15)'),
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* <View style={styles.backgroundWrapper}> */}
          {/* currentElems: pagesElements があればそれを優先、なければ pageContent をパースしてフォールバック */}
          <NoteContent 
            backgroundColor={book.color}
            elements={pagesElements[currentPage]}
            onNoteLayout={setNoteBounds}
          >
            <View style={{ 
              position: 'absolute', 
              top: noteBounds ? noteBounds.y : 0,
              left: noteBounds ? noteBounds.x : 0,
              width: noteBounds ? noteBounds.width : commonTheme.screenWidth,
              height: noteBounds ? noteBounds.height : commonTheme.screenHeight,
              padding: noteBounds ? 0 : 16,
              justifyContent: 'center',  // 中央揃え
              alignItems: 'center'       // 横中央
            }}>
            </View>
              {/* ノート全体をタップで切り替え */}
              <TouchableOpacity
                disabled={editing}
                style={[styles.container, { backgroundColor: 'transparent', flex: 1 }, getDebugStyle('rgba(0, 0, 255, 0.15)')]}
                activeOpacity={1}
                onPress={() => setIsVisible(!isVisible)} // ← ここで表示切り替え！
              >
              </TouchableOpacity>
                {/* 👇 Animated.View でフェード */}
                <Animated.View
                  style={[
                    {
                    opacity: showSearch ? 1: fadeAnim, // ← アニメーション制御
                    // position: 'absolute',
                    position: 'absolute',
                    // bottom: showSearch ? keyboardHeight : 150, // ← 検索バーがあるときは上に
                    width: commonTheme.screenWidth,
                    height: commonTheme.screenHeight,
                    justifyContent: 'center',
                    alignContent: 'center',
                    flexDirection: 'row',
                    backgroundColor: 'transparent',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: !isVisible ? 'blue' : 'transparent',
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 5,
                    alignItems: 'center',
                  },
                  getDebugStyle('rgba(255, 255, 0, 0.15)'),
                  ]}
                  pointerEvents={isVisible ? 'auto' : 'none'} // ← 非表示中はタップ無効
                >
                  {/* スライダー付きページビュー */}
                  {isVisible && !editing && (
                    <View
                      style={[
                        {
                          position: 'absolute',
                          height: commonTheme.screenHeight/15,
                          width: commonTheme.screenWidth*0.8,
                          bottom: !showSearch ? commonTheme.screenHeight*0.25 : commonTheme.screenHeight*0.3,
                          flexDirection: 'row', // ← 横並び
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: 'transparent',
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOpacity: 0.2,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: 5,
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          // marginBottom: showSearch ? 0 : theme.screenHeight*0.4, // ← 検索バーがあるときは上に
                      },
                      getDebugStyle('rgba(0, 0, 255, 0.2)'), // スライダー：薄い青
                    ]}
                    >
                    <View style={{ width: '20%', alignItems:'center'}}>
                        {/* 📚 ページ一覧ボタン */}
                        <TouchableOpacity
                          disabled={editing}
                          onPress={() => console.log('ページ一覧を表示')}
                          style={[
                            {
                              width: commonTheme.screenWidth/10,
                              height: commonTheme.screenWidth/10,
                              borderRadius: 15,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              alignItems: 'center',
                              alignContent: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                              marginLeft: 10,
                            },
                            getDebugStyle('rgba(0, 0, 0, 0.4)'), // ボタン：グレー
                          ]}
                        >
                              <Ionicons name="albums-outline" size={commonTheme.screenWidth/15} color="white" />
                        </TouchableOpacity>
                    </View>

                        {/* 丸いつまみのスライダー（右70%） */}
                        <View style={{ width: '70%', alignItems: 'center'}}>
                          <Slider
                            style={{
                              width: '100%',
                              height: 50,
                              alignSelf: 'flex-end',
                              marginRight: 20,
                              marginLeft: 20,
                            }}
                            minimumValue={0}
                            maximumValue={pages.length - 1}
                            step={1}
                            value={currentPage}
                            minimumTrackTintColor="#000"
                            maximumTrackTintColor="#ccc"
                            thumbTintColor="#000"
                            onValueChange={ async(v) => {
                              setCurrentPage(v);
                              pagerRef.current?.setPage(v);
                              // ★ ページ切り替え時に読み込み
                              await loadPageFromDB(v);
                            }}
                          />
                        </View>
                      </View>
                    )}

                </Animated.View>

                {/* 編集モード中のテキスト入力フィールド */}
                {editing && (
                  <View 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0, // 画面全体を覆う
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                    }}>
                    {/* 📘 メモの反映部分（大きめ） */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setEditableText(pageContent); // ← 現在の内容を編集欄へ
                        if (currentAttribute === '単語') {
                          setTimeout(() => wordInputRef.current?.focus(), 150);
                        } else {
                          setTimeout(() => editInputRef.current?.focus(), 150);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: noteBounds ? noteBounds.y + 10 : 10,
                        left: noteBounds ? noteBounds.x + noteBounds.width * 0.05 : commonTheme.screenWidth * 0.05,
                        width: noteBounds ? noteBounds.width * 0.9 : commonTheme.screenWidth * 0.9,
                        height: (noteBounds ? noteBounds.height - keyboardHeight : commonTheme.screenHeight - keyboardHeight) * 0.5,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: '#ccc',
                      }}
                    >
                      <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>メモ内容：</Text>

                      {/* 要素タイプボタン（メモ内容の上部に表示） */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
                        {ATTRIBUTES.map((attr) => (
                          <TouchableOpacity
                            key={attr}
                            onPress={() => {
                              setCurrentAttribute(attr as any);
                              const type = attr === '章' ? 'chapter' : attr === '節' ? 'section' : attr === '項' ? 'subsection' : attr === '単語' ? 'word' : attr === '画像' ? 'image' : 'text';
                              const idx = currentPage;

                              setPagesElements(prev => {
                                const next = [...prev];
                                if (!next[idx]) next[idx] = [];

                                if (editingLineIndex !== null && next[idx][editingLineIndex]) {
                                  // 既存選択要素のタイプを変更（既存の内容は可能な限り保持）
                                  const old = next[idx][editingLineIndex];
                                  let converted: any = { ...old };
                                  if (type === 'word') {
                                    converted = { type: 'word', word: (old as any).text || (old as any).word || '', meaning: (old as any).meaning || '' };
                                  } else if (type === 'image') {
                                    converted = { type: 'image', uri: (old as any).text || (old as any).uri || '' };
                                  } else {
                                    converted = { type: type as any, text: (old as any).text || (old as any).word || (old as any).uri || '' };
                                  }
                                  next[idx][editingLineIndex] = converted;
                                } else {
                                  // 新規要素を先頭に追加し、その要素を編集中にする
                                  const newEl: any = type === 'word' ? { type: 'word', word: '', meaning: '' } : type === 'image' ? { type: 'image', uri: '' } : { type, text: '' };
                                  next[idx] = [newEl, ...(next[idx] || [])];
                                  // set selected index to 0 after state update below
                                }
                                return next;
                              });

                              // 選択状態を設定（新規追加の場合は 0）
                              setEditingLineIndex(prev => (prev !== null ? prev : 0));
                              setEditing(true);
                              setCurrentAttribute(attr as any);
                              // フォーカスは次のレンダリングで setTimeout して行う
                              setTimeout(() => {
                                // フォーカス先は単語かどうかで変える
                                if (attr === '単語') {
                                  wordInputRef.current?.focus();
                                } else {
                                  editInputRef.current?.focus();
                                }
                              }, 120);
                            }}
                            style={{
                              backgroundColor: currentAttribute === attr ? '#007AFF' : 'rgba(0,0,0,0.06)',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: currentAttribute === attr ? 'white' : 'black', fontWeight: 'bold' }}>{attr}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <ScrollView>
                        {(() => {
                          const elems = pagesElements[currentPage] ?? [];
                          console.log('NotebookScreen: render elems', { currentPage, elemsLength: elems.length, sample: elems[0] });
                          return elems.map((el, i) => {
                            const isSelected = editingLineIndex === i;
                            return (
                              <TouchableOpacity
                                key={i}
                                onPress={() => {
                                  // 選択してインライン編集に切替
                                  if (el.type === 'word') {
                                    setWord((el as any).word || '');
                                    setDefinition((el as any).meaning || '');
                                  } else if (el.type === 'image') {
                                    setEditableText((el as any).uri || '');
                                  } else {
                                    setEditableText((el as any).text || '');
                                  }
                                  setEditing(true);
                                  setEditingLineIndex(i);
                                  setTimeout(() => {
                                    if (el.type === 'word') wordInputRef.current?.focus();
                                    else editInputRef.current?.focus();
                                  }, 100);
                                }}
                                style={{
                                  backgroundColor: getBgColorForType(el.type),
                                  paddingHorizontal: 8,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                  marginBottom: 6,
                                }}
                              >
                                {isSelected ? (
                                  el.type === 'word' ? (
                                    <View>
                                      <TextInput
                                        ref={wordInputRef}
                                        value={(el as any).word}
                                        onChangeText={(t) => {
                                          setPagesElements(prev => {
                                            const next = [...prev];
                                            const arr = next[currentPage] || [];
                                            if (arr[i]) (arr[i] as any).word = t;
                                            next[currentPage] = arr;
                                            return next;
                                          });
                                        }}
                                        placeholder="単語"
                                        style={[styles.inputSmallStyle, { height: 40, marginBottom: 6 }]}
                                      />
                                      <TextInput
                                        ref={definitionInputRef}
                                        value={(el as any).meaning}
                                        onChangeText={(t) => {
                                          setPagesElements(prev => {
                                            const next = [...prev];
                                            const arr = next[currentPage] || [];
                                            if (arr[i]) (arr[i] as any).meaning = t;
                                            next[currentPage] = arr;
                                            return next;
                                          });
                                        }}
                                        placeholder="説明"
                                        style={[styles.inputSmallStyle, { height: 40 }]}
                                        multiline
                                      />
                                    </View>
                                  ) : (
                                    <TextInput
                                      ref={editInputRef}
                                      value={el.type === 'image' ? (el as any).uri : (el as any).text}
                                      onChangeText={(t) => {
                                        setPagesElements(prev => {
                                          const next = [...prev];
                                          const arr = next[currentPage] || [];
                                          if (arr[i]) {
                                            if ((arr[i] as any).type === 'image') (arr[i] as any).uri = t;
                                            else (arr[i] as any).text = t;
                                          }
                                          next[currentPage] = arr;
                                          return next;
                                        });
                                      }}
                                      placeholder="内容を入力"
                                      style={[styles.inputSmallStyle, { height: 40 }]}
                                      multiline
                                    />
                                  )
                                ) : (
                                  <Text>
                                    {el.type === 'word' ? `${(el as any).word} — ${(el as any).meaning}` : el.type === 'image' ? `［画像］ ${(el as any).uri}` : 'text' in el ? (el as any).text : ''}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          });
                        })()}
                      </ScrollView>
                    </TouchableOpacity>

                    {/* ✏️ 入力エリア（小さめ） */}
                    <View
                      style={{
                        // 非表示：入力欄はメモ内容に統合したためここは隠す
                        display: 'none',
                        position: 'absolute',
                        bottom: 100,
                        left: noteBounds ? noteBounds.x + noteBounds.width * 0.05 : commonTheme.screenWidth * 0.05,
                        width: noteBounds ? noteBounds.width * 0.9 : commonTheme.screenWidth * 0.9,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: '#ddd',
                      }}
                    >
                      {/* 属性ボタン */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                        {ATTRIBUTES.map((attr) => (
                          <TouchableOpacity
                            key={attr}
                              onPress={() => {
                                setCurrentAttribute(attr);

                                // 単語は2つの入力欄なので、word の欄にフォーカスさせる
                                if (attr === '単語') {
                                  setTimeout(() => {
                                    wordInputRef.current?.focus();
                                  }, 50);
                                } else {
                                  // それ以外は通常編集欄へ
                                  setTimeout(() => {
                                    editInputRef.current?.focus();
                                  }, 50);
                                }
                              }}
                            style={{
                              backgroundColor:
                                currentAttribute === attr ? '#007AFF' : 'rgba(0,0,0,0.1)',
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: currentAttribute === attr ? 'white' : 'black',
                                fontWeight: 'bold',
                              }}
                            >
                              {attr}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* 入力欄 */}
                      <View style={{ marginTop: 10 }}>

                        {/* 単語入力欄（2つの TextInput） */}
                        {currentAttribute === '単語' ? (
                          <View>
                            <TextInput
                              ref={wordInputRef}
                              value={word}
                              onChangeText={setWord}
                              placeholder="単語を入力"
                              style={[styles.inputSmallStyle, { height: 40, marginBottom: 6 }]}
                            />

                            <TextInput
                              ref={definitionInputRef}
                              value={definition}
                              onChangeText={setDefinition}
                              placeholder="説明を入力"
                              style={[styles.inputSmallStyle, { height: 40 }]}
                              multiline
                            />
                          </View>
                        ) : (
                          /* その他属性 */
                          <View>
                            <TextInput
                              ref={editInputRef}
                              value={editableText}
                              onChangeText={setEditableText}
                              placeholder={`${currentAttribute}を入力`}
                              style={[styles.inputSmallStyle, { height: 40 }]}
                              multiline
                            />
                          </View>
                        )}
                        {/* 追加ボタン */}
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#007AFF',
                            paddingVertical: 5,
                            width: '70%',
                            marginTop: 10,
                            borderRadius: 8,
                            justifyContent: 'center',
                            alignItems: 'center',
                            alignSelf: 'center'
                          }}
                          onPress={() => {
                            // NoteElement ベースで追加／更新する
                            let newEl: NoteElement | null = null;
                            if (currentAttribute === '単語') {
                              newEl = { type: 'word', word: word, meaning: definition };
                              setWord('');
                              setDefinition('');
                            } else if (currentAttribute === '画像') {
                              newEl = { type: 'image', uri: editableText } as NoteElement;
                              if (editingLineIndex === null) setEditableText('');
                            } else if (currentAttribute === '章') {
                              newEl = { type: 'chapter', text: editableText };
                              if (editingLineIndex === null) setEditableText('');
                            } else if (currentAttribute === '節') {
                              newEl = { type: 'section', text: editableText };
                              if (editingLineIndex === null) setEditableText('');
                            } else if (currentAttribute === '項') {
                              newEl = { type: 'subsection', text: editableText };
                              if (editingLineIndex === null) setEditableText('');
                            } else {
                              // 文章
                              newEl = { type: 'text', text: editableText };
                              if (editingLineIndex === null) setEditableText('');
                            }

                            setPagesElements(prev => {
                              const next = [...prev];
                              const idx = currentPage;
                              if (!next[idx]) next[idx] = [];
                              if (editingLineIndex !== null) {
                                next[idx][editingLineIndex] = newEl!;
                              } else {
                                next[idx].push(newEl!);
                              }
                              return next;
                            });

                            // pageContent を pagesElements から再生成して同期
                            setPagesElements(prev => {
                              const elems = prev[currentPage] || [];
                              const final = elems
                                .map(el => {
                                  if (el.type === 'chapter') return `【章】${el.text}`;
                                  if (el.type === 'section') return `【節】${el.text}`;
                                  if (el.type === 'subsection') return `【項】${el.text}`;
                                  if (el.type === 'word') return `【単語】${el.word}\n${el.meaning}`;
                                  if (el.type === 'image') return `【画像】${el.uri}`;
                                  return el.type === 'text' ? el.text : '';
                                })
                                .join('\n');

                              setPageContent(final);
                              setPages(prev => {
                                const p = [...prev];
                                p[currentPage] = final;
                                return p;
                              });

                              return prev;
                            });
                          }}
                        >
                          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                            {editingLineIndex !== null ? '更新する' : '追加する'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}


            {/* 🔍 検索バー */}
            {showSearch && (
              <View
                style={[
                  {
                    position: 'absolute',
                    bottom: 100,
                    left: 20,
                    right: 20,
                    backgroundColor: 'white', // ← 半透明赤
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 5,
                  },
                  getDebugStyle('rgba(255, 0, 0, 0.2)'), // 検索バー：薄い赤
                ]}
              >
                <Ionicons name="search" size={commonTheme.screenWidth/12} color="gray" />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    fontSize: 16,
                  }}
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
                <TouchableOpacity onPress={() => setShowSearch(false)}>
                  <Ionicons name="close" size={commonTheme.screenWidth/12} color="gray" />
                </TouchableOpacity>
              </View>
            )}

              {/* 編集ボタン（右下） */}
              <TouchableOpacity
                style={[
                  styles.floatingEditButton,
                  {bottom: !editing ? commonTheme.screenHeight*0.02 : commonTheme.screenHeight*0.15}
                ]}
                  onPress={ async () => {
                    if (editing) {
                      // ✅ 編集中なら保存動作
                      console.log('編集→保存！！！！！！！！！');
                      const updatedPages = [...pages];

                      // pagesElements があればそれを優先して pageContent を再生成
                      const elemsForSave = pagesElements[currentPage];
                      const finalText = elemsForSave
                        .map(el => {
                          if (el.type === 'chapter') return `【章】${(el as any).text}`;
                          if (el.type === 'section') return `【節】${(el as any).text}`;
                          if (el.type === 'subsection') return `【項】${(el as any).text}`;
                          if (el.type === 'word') return `【単語】${(el as any).word}\n${(el as any).meaning}`;
                          if (el.type === 'image') return `【画像】${(el as any).uri}`;
                          return el.type === 'text' ? (el as any).text : '';
                        })
                        .join('\n');

                      updatedPages[currentPage] = finalText;
                      console.log('updatePages:', { updatedPages });
                      console.log('updatePages[currentPage]:', updatedPages[currentPage] );
                      console.log('finalText:', finalText);
                      console.log('currentPage:', { currentPage });
                      console.log('aiueo', updatedPages["updatePages"])
            

                      // state を更新して画面に反映
                      setPages(updatedPages);
                      setPageContent(finalText);
                      setEditing(false);
                      Keyboard.dismiss();

                      // DBへ保存
                      await savePageToDB();

                    } else {
                      // ✅ 編集開始：現在ページ内容をロード
                      const currentContent = pages[currentPage] ?? '';
                      console.log('Pages!!!!!!!!!!', { pages });
                      setPageContent(currentContent);

                      // 入力欄は空にする
                      setEditableText('');
                      setWord('');
                      setDefinition('');
                      setEditingLineIndex(null);

                      setEditing(true);
                    }
                  }}
              >
              <Ionicons name={editing ? 'checkmark' : 'create'} size={commonTheme.screenWidth/12} color="white" />
            </TouchableOpacity>

            {/* 虫眼鏡ボタン（左下） */}
            {!editing && (
              <TouchableOpacity
                style={styles.floatingSearchButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Ionicons name="search" size={commonTheme.screenWidth/12} color="white" />
              </TouchableOpacity>
            )}
          </NoteContent>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default NotebookScreen;
