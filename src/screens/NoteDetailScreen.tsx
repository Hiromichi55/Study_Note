// src/screens/NoteDetailScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

type NoteDetailRouteProp = RouteProp<RootStackParamList, 'NoteDetail'>;

interface Props {
  route: NoteDetailRouteProp;
}

const NoteDetailScreen: React.FC<Props> = ({ route }) => {
  const { bookId, noteId } = route.params;
  const [content, setContent] = useState('ここにノートの内容');

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>BookID: {bookId}, NoteID: {noteId}</Text>
      <TextInput
        style={{ borderWidth: 1, padding: 10, marginVertical: 10, minHeight: 200 }}
        multiline
        value={content}
        onChangeText={setContent}
      />
      <Button title="保存" onPress={() => console.log('保存', content)} />
    </View>
  );
};

export default NoteDetailScreen;
