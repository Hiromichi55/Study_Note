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
import { theme, styles, screenWidth, screenHeight } from '../styles/theme';
import NoteContent from './NoteContent';
import { useEditor } from '../context/EditorContext';
import * as Crypto from 'expo-crypto';
import { ENV } from '@config';
import { NoteElement } from './NoteContent';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const { 
    addContent, updateContent, deleteContent,
    addText, addWord, addImage, addOutline, getContentsByBookId, getTextsByContentId, getOutlinesByContentId, getWordsByContentId, getImagesByContentId,
  } = useEditor();

  const isTest = ENV.IS_DEV; // 開発環境なら true、リリースは false
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

  const wordInputRef = useRef<TextInput>(null);
  const definitionInputRef = useRef<TextInput>(null);


  // デバッグ用の背景色を返す関数
  const getDebugStyle = (color: string) =>
    isTest ? { backgroundColor: color } : {};

  const [pages, setPages] = useState<string[]>([]);

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
    { type: 'word', word: 'props', meaning: '親コンポーネントから渡される値' },
    //{ type: 'image', uri: 'https://example.com/sample.png' },
    { type: 'subsection', text: '1.1.1 関数コンポーネント' },
    { type: 'text', text: '関数コンポーネントはJavaScript関数で定義されます。' }
  ];

  // 📌 ページ保存ロジック
  const savePageToDB = async () => {
    try {
      const page = currentPage;

      // ⭐ 1) 既存 content を削除
      const oldContents = await getContentsByBookId(bookId);
      const oldPageContent = oldContents.find(c => c.page === page);

      if (oldPageContent) {
        // 子テーブルの削除
        await deleteContent(oldPageContent.content_id);
      }

      // ⭐ 2) 新しい content を追加して保存
      const contentId = await Crypto.randomUUID();

      await addContent({
        content_id: contentId,
        order_index: page,
        type: 'page',
        book_Id: bookId,
        page: page,
        height: 0
      });

      const lines = pageContent.split('\n').filter(l => l.trim() !== '');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('【章】')) {
          await addOutline({
            outline_id: await Crypto.randomUUID(),
            type: 'chapter',
            outline: line.replace('【章】', '').trim(),
            content_id: contentId
          });
          continue;
        }

        if (line.startsWith('【節】')) {
          await addOutline({
            outline_id: await Crypto.randomUUID(),
            type: 'section',
            outline: line.replace('【節】', '').trim(),
            content_id: contentId
          });
          continue;
        }

        if (line.startsWith('【項】')) {
          await addOutline({
            outline_id: await Crypto.randomUUID(),
            type: 'subsection',
            outline: line.replace('【項】', '').trim(),
            content_id: contentId
          });
          continue;
        }

        if (line.startsWith('【単語】')) {
          const word = line.replace('【単語】', '').trim();
          const explanation = lines[i + 1] ?? '';
          i++;

          await addWord({
            word_id: await Crypto.randomUUID(),
            word,
            explanation,
            word_order: i,
            content_id: contentId
          });
          continue;
        }

        if (line.startsWith('【画像】')) {
          const img = line.replace('【画像】', '').trim();
          await addImage({
            image_id: await Crypto.randomUUID(),
            image: img,
            content_id: contentId
          });
          continue;
        }

        await addText({
          text_id: await Crypto.randomUUID(),
          content: line,
          content_id: contentId
        });
      }

      console.log("ページを DB に保存しました（上書き完了）");

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

      const contentId = pageContentRow.content;

      const texts = await getTextsByContentId(contentId);
      const outlines = await getOutlinesByContentId(contentId);
      const words = await getWordsByContentId(contentId);
      const images = await getImagesByContentId(contentId);

      let resultLines: string[] = [];

      outlines.forEach(o => resultLines.push(`【${o.type}】${o.content}`));
      texts.forEach(t => resultLines.push(t.content));
      words.forEach(w => {
        resultLines.push(`【単語】${w.word}`);
        resultLines.push(w.explanation);
      });
      images.forEach(img => resultLines.push(`【画像】${img.image}`));

      const finalText = resultLines.join('\n');

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
      const contents = await getContentsByBookId(bookId);

      // ページ数を最大ページに合わせる
      const maxPage = Math.max(...contents.map(c => c.page), 0);

      const loadedPages = [];

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
  }, [state.isLoading, bookId]);


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
            <TouchableOpacity onPress={openMenu} style={styles.menuIconWrapper}>
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
          <NoteContent 
            backgroundColor={book.color}
            elements={noteData}>
            <View style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              padding: 16,
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
                    width: theme.screenWidth,
                    height: theme.screenHeight,
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
                          height: theme.screenHeight/15,
                          width: theme.screenWidth*0.8,
                          bottom: !showSearch ? theme.screenHeight*0.25 : theme.screenHeight*0.3,
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
                              width: screenWidth/10,
                              height: screenWidth/10,
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
                              <Ionicons name="albums-outline" size={screenWidth/15} color="white" />
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
                        top: 10,
                        left: screenWidth * 0.05,
                        width: screenWidth * 0.9,
                        height: (screenHeight - keyboardHeight)*0.5,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: '#ccc',
                      }}
                    >
                      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>メモ内容：</Text>
                      <ScrollView>
                        {pageContent.split('\n').map((line, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              setEditableText(line);       // タップした行を編集欄に反映
                              setEditing(true);
                              setEditingLineIndex(i);      // この行を編集中として記録
                              setTimeout(() => editInputRef.current?.focus(), 100);
                            }}
                          >
                            <Text>{line}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </TouchableOpacity>

                    {/* ✏️ 入力エリア（小さめ） */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 100,
                        left: screenWidth * 0.05,
                        width: screenWidth * 0.9,
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
                            let newItem = '';

                            if (currentAttribute === '単語') {
                              newItem = `【単語】${word}\n${definition}`;
                              setWord('');
                              setDefinition('');
                            } else {
                              // 編集中は属性名を追加せず、新規追加時のみ付与
                              if (editingLineIndex !== null) {
                                newItem = editableText; // ←更新時は属性なし
                              } else {
                                newItem = `【${currentAttribute}】${editableText}`; // ←新規追加時は属性付き
                                setEditableText('');
                              }
                            }

                            setPageContent(prev => {
                              const lines = prev.split('\n');

                              if (editingLineIndex !== null) {
                                // 編集中の行を置き換える
                                setEditableText('');
                                lines[editingLineIndex] = newItem;
                                setEditingLineIndex(null); // 編集終了
                              } else {
                                // 新規追加
                                lines.push(newItem);
                              }

                              return lines.join('\n');
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
                <Ionicons name="search" size={screenWidth/12} color="gray" />
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
                  <Ionicons name="close" size={screenWidth/12} color="gray" />
                </TouchableOpacity>
              </View>
            )}

              {/* 編集ボタン（右下） */}
              <TouchableOpacity
                style={[
                  styles.floatingEditButton,
                  {bottom: !editing ? screenHeight*0.02 : screenHeight*0.15}
                ]}
                  onPress={ async () => {
                    if (editing) {
                      // ✅ 編集中なら保存動作
                      const updatedPages = [...pages];
                      console.log('保存内容:', editableText);
                      updatedPages[currentPage] = pageContent;

                      setPages(updatedPages);
                      setPageContent(editableText);
                      setEditing(false);
                      Keyboard.dismiss();
                      // ★★★ DBへ保存 ★★★
                      await savePageToDB();

                      // Context（useLibrary）側も更新
                      // dispatch({
                      //   type: 'UPDATE_BOOK_CONTENT',
                      //   bookId: book.id,
                      //   content: updatedPages,
                      // });
                    } else {
                      // ✅ 編集開始：現在ページ内容をロード
                      const currentContent = pages[currentPage] ?? '';
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
              <Ionicons name={editing ? 'checkmark' : 'create'} size={screenWidth/12} color="white" />
            </TouchableOpacity>

            {/* 虫眼鏡ボタン（左下） */}
            {!editing && (
              <TouchableOpacity
                style={styles.floatingSearchButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Ionicons name="search" size={screenWidth/12} color="white" />
              </TouchableOpacity>
            )}
          </NoteContent>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default NotebookScreen;
