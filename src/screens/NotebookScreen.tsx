import React, { useState, useLayoutEffect } from 'react';
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

  const book = state.books.find((b) => b.id === bookId);
  const [editing, setEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const [pages, setPages] = useState<string[]>(
    Array.isArray(book?.content) ? book?.content : [book?.content ?? '']
  );

  // 🔍 追加部分：検索用ステート
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
            <View style={[styles.container, { backgroundColor: 'transparent'}]}>
              <Text style={styles.title}>{book.title}</Text>

              {/* スライダー部分 */}
              <View style={{ flex: 1, height: 400, marginBottom: 100 }}>
                <PagerView
                  style={{ flex: 1 }}
                  initialPage={currentPage}
                  onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
                >
                  {pages.map((page, index) => (
                    <View key={index} style={{ padding: 16 }}>
                      {editing ? (
                        <TextInput
                          style={[styles.textInput, { minHeight: 200 }]}
                          multiline
                          value={pages[index]}
                          onChangeText={(text) => {
                            const updatedPages = [...pages];
                            updatedPages[index] = text;
                            setPages(updatedPages);
                          }}
                        />
                      ) : (
                        <Text style={styles.contentText}>
                          {page || MESSAGES.NEW_BOOK_CONTENT}
                        </Text>
                      )}
                    </View>
                  ))}
                </PagerView>
              </View>
            </View>
          </ImageBackground>

          {/* 🔍 検索バー（虫眼鏡押下時に表示） */}
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
                // 👇 日本語IMEを出しやすくする設定
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
            onPress={() => setEditing(!editing)}
          >
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
