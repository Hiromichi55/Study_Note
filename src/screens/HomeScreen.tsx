import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { MESSAGES } from '../constants/messages';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useLibrary();
  const [newTitle, setNewTitle] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('../../assets/images/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* 📚 本リスト */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{MESSAGES.SHELF_TITLE}</Text>

          {state.books.map((book) => (
            <TouchableOpacity
              key={book.id}
              onPress={() => navigation.navigate('Notebook', { bookId: book.id })}
              style={styles.bookItem}
            >
              <View style={styles.bookImageWrapper}>
                <Image
                  source={require('../../assets/images/blue_book.png')}
                  style={styles.bookImage}
                  resizeMode="contain"
                />
                <Text style={styles.bookTitle}>
                  {book.title.split('').join('\n')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ⬇️ 画面下部に固定された追加フォーム */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder={MESSAGES.ADD_BOOK_PLACEHOLDER}
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <Button
            title="追加"
            onPress={() => {
              if (newTitle.trim()) {
                dispatch({
                  type: 'ADD_BOOK',
                  book: {
                    id: Date.now().toString(),
                    title: newTitle.trim(),
                    content: '',
                  },
                });
                setNewTitle('');
              }
            }}
          />
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: screenWidth,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // 下に余白確保
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    color: 'white',
  },
  bookItem: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bookImageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  bookImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bookTitle: {
    fontSize: 12,
    color: 'black',
    textAlign: 'center',
    lineHeight: 14,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    position: 'absolute',
    top: (screenHeight * 2) / 3, // 上から2/3の位置に固定
    left: 0,
    right: 0,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    padding: 8,
    marginRight: 8,
    backgroundColor: 'white',
  },
});
