// src/screens/NotebookScreen.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;
type NotebookScreenNavProp = StackNavigationProp<RootStackParamList, 'Notebook'>;

interface Props {
  route: NotebookScreenRouteProp;
  navigation: NotebookScreenNavProp;
}

const NotebookScreen: React.FC<Props> = ({ route, navigation }) => {
  const { bookId } = route.params;

  const notes = [
    { id: 'n1', title: '1ページ目' },
    { id: 'n2', title: '2ページ目' },
  ];

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>ノート一覧（BookID: {bookId}）</Text>
      {notes.map((note) => (
        <Button
          key={note.id}
          title={note.title}
          onPress={() => navigation.navigate('NoteDetail', { bookId, noteId: note.id })}
        />
      ))}
    </View>
  );
};

export default NotebookScreen;
