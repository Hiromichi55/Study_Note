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
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Slider from '@react-native-community/slider'; // ← 追加！
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { RootStackParamList } from '../App';
import { theme, styles } from '../styles/theme';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const isTest = false; // 開発環境なら true、リリースは false
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.id === bookId);
  const [editing, setEditing] = useState(false);
  const [editableText, setEditableText] = useState(''); // ← 編集中のテキスト内容
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null); // ← ページ移動用参照を追加
  const searchInputRef = useRef<TextInput>(null);
  // キーボードの表示状態を取得
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // デバッグ用の背景色を返す関数
  const getDebugStyle = (color: string) =>
    isTest ? { backgroundColor: color } : {};

  const [pages, setPages] = useState<string[]>(
    Array.isArray(book?.content) ? book?.content : [book?.content ?? '']
  );

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 👇 表示状態とアニメーション用の値
  const [isVisible, setIsVisible] = useState(true); // ← 表示／非表示の状態
  const fadeAnim = useRef(new Animated.Value(1)).current; // 1=表示, 0=非表示

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  useEffect(() => {
  const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
    setKeyboardHeight(e.endCoordinates.height);
  });
  const hideSub = Keyboard.addListener('keyboardDidHide', () => {
    setKeyboardHeight(0);
  });

  return () => {
    showSub.remove();
    hideSub.remove();
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
          <View style={styles.backgroundWrapper}>
            <ImageBackground
              source={require('../../assets/images/note.png')}
              style={[
                styles.background,
                getDebugStyle('rgba(255, 255, 0, 0.15)'),
              ]}
              resizeMode="contain"
            >
              {/* ノート全体をタップで切り替え */}
              <TouchableOpacity
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
                    position: 'absolute',
                    bottom: showSearch ? keyboardHeight : 150, // ← 検索バーがあるときは上に
                    left: 15,
                    right: 15,
                    height: 1000,
                    flexDirection: 'row',
                    backgroundColor: 'transparent',
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
                          bottom: 150,
                          left: 10,
                          right: 10,
                          height: 50,
                          flexDirection: 'row', // ← 横並び
                          backgroundColor: 'transparent', // ← 半透明青
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
                          marginBottom: showSearch ? 0 : 20, // ← 検索バーがあるときは上に
                      },
                      getDebugStyle('rgba(0, 0, 255, 0.2)'), // スライダー：薄い青
                    ]}
                    >

                        {/* 📚 ページ一覧ボタン */}
                        <TouchableOpacity
                          onPress={() => console.log('ページ一覧を表示')}
                          style={[
                            {
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                              marginLeft: 10,
                            },
                            getDebugStyle('rgba(0, 0, 0, 0.4)'), // ボタン：グレー
                          ]}
                        >
                              <Ionicons name="albums-outline" size={30} color="white" />
                        </TouchableOpacity>


                        {/* 丸いつまみのスライダー（右70%） */}
                        <View style={{ width: '75%', marginLeft: 10, marginRight: 10 }}>
                          <Slider
                            style={{
                              width: '100%',
                              height: 50,
                              alignSelf: 'flex-end',
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
                      top: 120,
                      left: 20,
                      right: 20,
                      bottom: keyboardHeight > 0 ? keyboardHeight + 40 : 150,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      borderRadius: 12,
                      padding: 12,
                      shadowColor: '#000',
                      shadowOpacity: 0.2,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 5,
                    }}
                  >
                    <TextInput
                      value={editableText}
                      onChangeText={setEditableText}
                      placeholder="ここに入力..."
                      multiline
                      style={{
                        flex: 1,
                        fontSize: 18,
                        textAlignVertical: 'top',
                      }}
                      autoFocus
                    />
                  </View>
                )}
            </ImageBackground>

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
                <Ionicons name="search" size={20} color="gray" />
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
                  <Ionicons name="close" size={24} color="gray" />
                </TouchableOpacity>
              </View>
            )}

              {/* 編集ボタン（右下） */}
              <TouchableOpacity
                style={styles.floatingEditButton}
                  onPress={() => {
                    if (editing) {
                      // ✅ 編集中なら保存動作
                      console.log('保存内容:', editableText);
                      setEditing(false);
                      Keyboard.dismiss();
                    } else {
                      // ✅ 編集開始：現在ページ内容をロード
                      const currentContent = pages[currentPage] ?? '';
                      setEditableText(currentContent);
                      setEditing(true);
                    }
                  }}
              >
              <Ionicons name={editing ? 'checkmark' : 'create'} size={35} color="white" />
            </TouchableOpacity>

            {/* 虫眼鏡ボタン（左下） */}
            {!editing && (
              <TouchableOpacity
                style={styles.floatingSearchButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Ionicons name="search" size={35} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default NotebookScreen;
