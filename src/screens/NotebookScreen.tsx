// src/screens/NotebookScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;

interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const { bookId } = route.params;

  // 仮データ（本ごとの大きなノート）
  const initialContent =
    bookId === '1'
      ? 'これは基本情報技術者ノートの内容です。\nここに長いメモを書けます。'
      : 'これは応用情報技術者ノートの内容です。\nこちらも長い文章を書けます。';

  const [content, setContent] = useState(initialContent);
  const [editing, setEditing] = useState(false);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 10 }}>BookID: {bookId}</Text>

      <Button
        title={editing ? '編集終了' : '編集する'}
        onPress={() => setEditing(!editing)}
      />

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
          <Text style={{ fontSize: 16, lineHeight: 24 }}>{content}</Text>
        )}
      </ScrollView>

      {editing && (
        <Button
          title="保存"
          onPress={() => {
            console.log('保存した内容:', content);
            setEditing(false);
          }}
        />
      )}
    </View>
  );
};

export default NotebookScreen;
