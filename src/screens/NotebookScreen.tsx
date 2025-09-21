// src/screens/NotebookScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { useLibrary } from '../context/LibraryContext';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;

interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.id === bookId);
  const [content, setContent] = useState(book?.content ?? '');
  const [editing, setEditing] = useState(false);

  if (!book) return <Text>本が見つかりません</Text>;

  return (
    <View style={{ flex: 1, padding: 20 }}>
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
          <Text style={{ fontSize: 16, lineHeight: 24 }}>{book.content}</Text>
        )}
      </ScrollView>
    </View>
  );
};

export default NotebookScreen;
