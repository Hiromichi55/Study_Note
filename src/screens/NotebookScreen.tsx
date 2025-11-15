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
import ScreenBackground from './ScreenBackground';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const isTest = true; // 開発環境なら true、リリースは false
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



  // デバッグ用の背景色を返す関数
  const getDebugStyle = (color: string) =>
    isTest ? { backgroundColor: color } : {};

  const [pages, setPages] = useState<string[]>(
    Array.isArray(book?.content) ? book?.content : [book?.content ?? '']
  );

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
          <ScreenBackground>
              {/* ノート全体をタップで切り替え */}
              <TouchableOpacity
                disabled={editing}
                style={[styles.container, { backgroundColor: 'transparent', flex: 1 }, getDebugStyle('rgba(0, 0, 255, 0.15)')]}
                activeOpacity={1}
                onPress={() => setIsVisible(!isVisible)} // ← ここで表示切り替え！
              >
                <Text style={styles.title}>{book.title}</Text>
              </TouchableOpacity>
                            {/* 👇 Animated.View でフェード */}
                <Animated.View
                  style={[
                    {
                    opacity: showSearch ? 1: fadeAnim, // ← アニメーション制御
                    // position: 'absolute',
                    position: 'relative',
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
                            onValueChange={(v) => {
                              setCurrentPage(v);
                              pagerRef.current?.setPage(v);
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
                        setEditing(true);             // ← 編集モード ON
                        setTimeout(() => {
                          editInputRef.current?.focus(); // ← キーボード
                        }, 100);
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
                            onPress={() => setCurrentAttribute(attr)}
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
                        {/* 2. その他属性の TextInput（Always mounted） */}
                        <View style={{ display: 'flex' }}>
                          <TextInput
                            ref={editInputRef}
                            value={editableText}
                            onChangeText={setEditableText}
                            placeholder={`${currentAttribute}を入力`}
                            style={[styles.inputSmallStyle, { height: 40 }]}
                            multiline
                          />
                        </View>

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
                  onPress={() => {
                    if (editing) {
                      // ✅ 編集中なら保存動作
                      const updatedPages = [...pages];
                      console.log('保存内容:', editableText);
                      updatedPages[currentPage] = editableText;

                      setPages(updatedPages);
                      setEditing(false);
                      Keyboard.dismiss();

                          // Context（useLibrary）側も更新
                      // dispatch({
                      //   type: 'UPDATE_BOOK_CONTENT',
                      //   bookId: book.id,
                      //   content: updatedPages,
                      // });
                    } else {
                      // ✅ 編集開始：現在ページ内容をロード
                      const currentContent = pages[currentPage] ?? '';
                      setEditableText(currentContent);
                      setPageContent(currentContent);
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
          </ScreenBackground>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default NotebookScreen;
