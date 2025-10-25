import React, { useState, useLayoutEffect, useRef } from 'react';
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
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();
  const [isVisible, setIsVisible] = useState(true); // ← 表示／非表示の状態

  const book = state.books.find((b) => b.id === bookId);
  const [editing, setEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null); // ← ページ移動用参照を追加

  const [pages, setPages] = useState<string[]>(
    Array.isArray(book?.content) ? book?.content : [book?.content ?? '']
  );

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity onPress={() => console.log('目次を開く')}>
          <Text
            style={{
              fontFamily: 'dartsfont',
              fontSize: 25,
              fontWeight: 'bold',
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
          />
          <Menu.Item
            onPress={() => {
              closeMenu();
              setEditing(true);
            }}
            title="ページ編集"
          />
          <Menu.Item
            onPress={() => {
              closeMenu();
              dispatch({ type: 'DELETE_BOOK', bookId: book!.id });
            }}
            title="ページ削除"
          />
        </Menu>
      ),
    });
  }, [navigation, menuVisible]);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backgroundWrapper}>
          <ImageBackground
            source={require('../../assets/images/note.png')}
            style={styles.background}
            resizeMode="contain"
          >
            <TouchableOpacity
              style={[styles.container, { backgroundColor: 'transparent', flex: 1 }]}
              activeOpacity={1}
              onPress={() => setIsVisible(!isVisible)} // ← ここで表示切り替え！
            >
              <Text style={styles.title}>{book.title}</Text>
            </TouchableOpacity>

            {/* スライダー付きページビュー */}
            {isVisible && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 150,
                  left: 20,
                  right: 20,
                  height: 400,
                  flexDirection: 'row', // ← 横並び
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
                }}
              >

                {/* 📚 ページ一覧ボタン */}
                <TouchableOpacity
                  onPress={() => console.log('ページ一覧を表示')}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                    marginLeft: 10,
                  }}
                >
                      <Ionicons name="albums-outline" size={30} color="white" />
                </TouchableOpacity>


                {/* 丸いつまみのスライダー（右70%） */}
                <View style={{ width: '80%', marginLeft: 10 }}>
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
          </ImageBackground>

          {/* 🔍 検索バー */}
          {showSearch && (
            <View
              style={{
                position: 'absolute',
                bottom: 100,
                left: 20,
                right: 20,
                backgroundColor: 'white',
                borderRadius: 10,
                paddingHorizontal: 15,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowOffset: { width: 0, height: 2 },
                elevation: 5,
              }}
            >
              <Ionicons name="search" size={20} color="gray" />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 16,
                }}
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
          <TouchableOpacity style={styles.floatingEditButton} onPress={() => {}}>
            <Ionicons name={editing ? 'checkmark' : 'create'} size={35} color="white" />
          </TouchableOpacity>

          {/* 虫眼鏡ボタン（左下） */}
          <TouchableOpacity
            style={styles.floatingSearchButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name="search" size={35} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default NotebookScreen;
