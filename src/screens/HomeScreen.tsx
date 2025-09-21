// src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, TextInput } from 'react-native';
import { useLibrary } from '../context/LibraryContext'; // ライブラリの状態管理用フック
import { StackNavigationProp } from '@react-navigation/stack'; // スタックナビゲーションの型定義
import { RootStackParamList } from '../App'; // ルートスタックのパラメータ型定義
import { MESSAGES } from '../constants/messages'; // 定数メッセージ

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

// このコンポーネントが受けとるPropsの型定義
interface Props {
  navigation: HomeScreenNavProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useLibrary();
  const [newTitle, setNewTitle] = useState('');

  return (
    <View style={{ flex: 1, padding: 20 }}>
  <Text style={{ fontSize: 24, marginBottom: 20 }}>{MESSAGES.SHELF_TITLE}</Text>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TextInput
          style={{ borderWidth: 1, padding: 8, flex: 1, marginRight: 8 }}
          placeholder={MESSAGES.ADD_BOOK_PLACEHOLDER}
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <Button
          title="追加"
          onPress={() => {
            if (newTitle.trim()) {
              dispatch({ type: 'ADD_BOOK', id: Date.now().toString(), title: newTitle.trim() });
              setNewTitle('');
            }
          }}
        />
      </View>

      {state.books.map((book) => (
        <Button
          key={book.id}
          title={book.title}
          onPress={() => navigation.navigate('Notebook', { bookId: book.id })}
        />
      ))}
    </View>
  );
};

export default HomeScreen;
