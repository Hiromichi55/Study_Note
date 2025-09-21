// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const books = [
    { id: '1', title: '基本情報技術者' },
    { id: '2', title: '応用情報技術者' },
  ];

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>本棚</Text>
      {books.map((book) => (
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
