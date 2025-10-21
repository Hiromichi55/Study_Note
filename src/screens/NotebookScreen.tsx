import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  Text,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  const [content, setContent] = useState(book?.content ?? '');
  const [editing, setEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity onPress={() => console.log('目次を開く')}>
          <Text style={{ fontFamily: 'dartsfont', fontSize: 25, fontWeight: 'bold', color: 'black' }}>目次</Text>
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
            marginTop: 40, // ← メニューを下にずらす
          }}
        >
          <Menu.Item
            onPress={() => {
              closeMenu();
              console.log('追加処理');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backgroundWrapper}>
        <ImageBackground
          source={require('../../assets/images/title.png')}
          style={styles.background}
          resizeMode="contain"
        >
          <View style={styles.container}>
            <Text style={styles.title}>{book.title}</Text>

            <View style={styles.buttonRow}>
              <View style={editing ? styles.editButtonWrapper : undefined}>
                <Button
                  title={editing ? '編集終了' : '編集する'}
                  onPress={() => setEditing(!editing)}
                />
              </View>
              {editing && (
                <Button
                  title="保存"
                  onPress={() => {
                    dispatch({ type: 'UPDATE_CONTENT', bookId: book.id, content });
                    setEditing(false);
                  }}
                />
              )}
            </View>

            <ScrollView style={styles.scroll}>
              {editing ? (
                <TextInput
                  style={styles.textInput}
                  multiline
                  value={content}
                  onChangeText={setContent}
                />
              ) : (
                <Text style={styles.contentText}>
                  {book.content || MESSAGES.NEW_BOOK_CONTENT}
                </Text>
              )}
            </ScrollView>
          </View>
        </ImageBackground>

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
          onPress={() => console.log('虫眼鏡タップ - 検索機能')}
        >
          <Ionicons name="search" size={35} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default NotebookScreen;
