import React, { useState } from 'react';
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
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';

import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { MESSAGES } from '../constants/messages';
import { Book } from '../context/LibraryContext';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// 色に応じた画像マッピング
const bookImages: { [key in Book['color']]: ImageSourcePropType } = {
  blue: require('../../assets/images/blue_book.png'),
  cyan: require('../../assets/images/cyan_book.png'),
  green: require('../../assets/images/green_book.png'),
  pink: require('../../assets/images/pink_book.png'),
  red: require('../../assets/images/red_book.png'),
  yellow: require('../../assets/images/yellow_book.png'),
};

// 任意の色をランダムに返す関数
const getRandomColor = (): Book['color'] => {
  const colors: Book['color'][] = ['blue', 'cyan', 'green', 'pink', 'red', 'yellow'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 幅と高さの取得
const { width: imgWidth, height: imgHeight } = Image.resolveAssetSource(bookImages.blue);
const IMAGE_WIDTH = screenWidth / 5.5;
const IMAGE_HEIGHT = (IMAGE_WIDTH * imgHeight) / imgWidth;

const FONT_SIZE = IMAGE_HEIGHT * 0.1; // 画像高さの12%
const LINE_HEIGHT = FONT_SIZE * 1;   // 文字の間隔

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook } = useLibrary(); // ✅ addBook を使う
  const [newTitle, setNewTitle] = useState('');
  // 追加：useStateで画像サイズを追跡
  const [imageLayout, setImageLayout] = useState({ width: IMAGE_WIDTH, height: IMAGE_HEIGHT });


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
          renderItem={({ item }) => (
          <View style={styles.bookItem}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notebook', { bookId: item.id })}
              style={styles.bookImageWrapper}
            >
              <Image
                source={bookImages[item.color]}
                style={styles.bookImage}
                resizeMode="contain"
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setImageLayout({ width, height });
                }}
              />
              {/* ✅ タイトルを画像の上に絶対配置 */}
              <Text 
              style={[
                styles.bookTitleOverlay,
                {
                  transform: [
                    { translateX: -imageLayout.width * 0.5 },
                    { translateY: -imageLayout.height * 0.4 }, // 少し上に寄せる
                  ]
                }]}>
                {item.title.split('').join('\n')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        />

        {/* 📘 本の追加フォーム */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder={MESSAGES.ADD_BOOK_PLACEHOLDER}
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <Button
            title="追加"
            onPress={async () => {
              const trimmed = newTitle.trim();
              if (!trimmed) return;

              const color = getRandomColor();
              await addBook({
                id: Date.now().toString(),
                title: trimmed,
                content: '',
                color, // ✅ 色を指定して保存
              });

              setNewTitle('');
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
  gridContainer: {
    flex: 1,
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
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -(IMAGE_WIDTH * 0.03),
  },
  bookImageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
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
    top: (screenHeight * 2) / 3,
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
  bookTitleOverlay: {
    position: 'absolute',
    top: '70%',
    left: '32%',
    width: IMAGE_WIDTH,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: 'black',
    textAlign: 'center',
    fontFamily: 'dartsfont',
  },
});
