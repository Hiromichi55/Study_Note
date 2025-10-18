// 必要な import
import React, { useState, useLayoutEffect } from 'react';
import { View, TextInput, Button, Text, ScrollView, ImageBackground, TouchableOpacity } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import { Ionicons } from '@expo/vector-icons';
import { Menu, Provider as PaperProvider } from 'react-native-paper';
import { RootStackParamList } from '../App';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
interface Props { route: NotebookScreenRouteProp; }

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.id === bookId);
  const [content, setContent] = useState(book?.content ?? '');
  const [editing, setEditing] = useState(false);

  // メニュー表示制御用
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <TouchableOpacity onPress={openMenu} style={{ paddingRight: 15 }}>
              <Ionicons name="ellipsis-horizontal" size={24} color="black" />
            </TouchableOpacity>
          }
        >
          <Menu.Item onPress={() => { 
            closeMenu();
            // 新規追加処理
            console.log('追加処理');
          }} title="ノートを追加" />
          <Menu.Item onPress={() => {
            closeMenu();
            setEditing(true);
          }} title="ノートを編集" />
          <Menu.Item onPress={() => {
            closeMenu();
            // 削除処理
            dispatch({ type: 'DELETE_BOOK', bookId: book!.id });
          }} title="ノートを削除" />
        </Menu>
      ),
    });
  }, [navigation, menuVisible]);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  return (
    <ImageBackground
      source={require('../../assets/images/note.png')}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      imageStyle={{ width: '100%', height: '100%' }}
      resizeMode="contain"
    >
      <View style={{ flex: 1, padding: 20, backgroundColor: 'rgba(255,255,255,0.7)', width: '100%' }}>
        <Text style={{ fontSize: 20, marginBottom: 10 }}>{book.title}</Text>
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <View style={{ marginRight: editing ? 10 : 0 }}>
            <Button
              title={editing ? '編集終了' : '編集する'}
              onPress={() => setEditing(!editing)}
            />
          </View>
          {editing && (
            <View>
              <Button
                title="保存"
                onPress={() => {
                  dispatch({ type: 'UPDATE_CONTENT', bookId: book.id, content });
                  setEditing(false);
                }}
              />
            </View>
          )}
        </View>
        <ScrollView style={{ marginTop: 20 }}>
          {editing ? (
            <TextInput
              style={{
                borderWidth: 1,
                padding: 10,
                minHeight: 400,
                textAlignVertical: 'top',
              }}
              multiline
              value={content}
              onChangeText={setContent}
            />
          ) : (
            <Text style={{ fontSize: 16, lineHeight: 24, fontFamily: 'MyFont' }}>
              {book.content || MESSAGES.NEW_BOOK_CONTENT}
            </Text>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

export default NotebookScreen;
