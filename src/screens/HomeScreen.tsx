import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
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
// 画像のソースを取得
const bookImageSource: ImageSourcePropType = require('../../assets/images/blue_book.png');

// 画像の幅と高さを同期的に取得
const { width: imgWidth, height: imgHeight } = Image.resolveAssetSource(bookImageSource);

// IMAGE_WIDTHは画面幅の1/4
const IMAGE_WIDTH = screenWidth / 6;

// IMAGE_HEIGHTは縦横比維持で計算
const IMAGE_HEIGHT = (IMAGE_WIDTH * imgHeight) / imgWidth;


console.log('Screen Width:', screenWidth);
console.log('Screen Height:', screenHeight);
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useLibrary();
  const [newTitle, setNewTitle] = useState('');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('../../assets/images/title.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* 📚 本リスト */}
        <FlatList
          data={state.books}
          keyExtractor={(item) => item.id}
          numColumns={5}
          contentContainerStyle={styles.gridContainer}
          ListHeaderComponent={
            <Text style={styles.title}>{MESSAGES.SHELF_TITLE}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.bookItem}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notebook', { bookId: item.id })}
                style={styles.bookImageWrapper}
                //style={[styles.bookImageWrapper, { backgroundColor: 'rgba(255,0,0,0.3)' }]} // デバッグ用背景色（透過赤）
              >
                <Image
                  source={require('../../assets/images/blue_book.png')}
                  style={styles.bookImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <Text style={styles.bookTitle}>
                {item.title.split('').join('\n')}
              </Text>
            </View>
          )}
        />

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
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',  // 縦中央
    alignItems: 'center',      // 横中央
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    color: 'white',
  },
  bookItem: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,  // 画像サイズ + タイトル表示用の余白
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 0,
  },
  touchable: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookImageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    position: 'relative',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  bookImage: {
    width: '100%',
    height: '100%',
  },
  bookTitle: {
    fontSize: 12,
    color: 'black',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 5,
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
