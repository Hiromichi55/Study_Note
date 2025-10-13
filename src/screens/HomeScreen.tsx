import React, { useState, useRef, useEffect } from 'react';
import DraggableFlatList, { RenderItemParams }  from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';


import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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

const COLOR_ICON_WIDTH = IMAGE_WIDTH / 1.5;
const COLOR_ICON_HEIGHT = IMAGE_HEIGHT / 1.5;


const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary(); // ✅ addBook を使う
  const [newTitle, setNewTitle] = useState('');
  // 追加：useStateで画像サイズを追跡
  const [isSelectingColor, setIsSelectingColor] = useState(false);
  const flatListRef = useRef<any>(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [bookData, setBookData] = useState<Book[]>([]);

  useEffect(() => {
    setBookData(state.books); // 状態が変わるたび更新
  }, [state.books]);


  const handleAddBookWithColor = async (color: Book['color']) => {
    const newId = Date.now().toString(); // ユニークなIDを生成
    await addBook({
      id: newId,
      title: '新しい本', // ←固定でも、空文字でも、ランダムでもOK
      content: '',
      color,
    });
    setIsSelectingColor(false); // 色選択モードを終了
    setShouldScrollToEnd(true);  // スクロールすべきフラグを立てる
  };

  // state.booksが変化したらスクロールする
  useEffect(() => {
    if (shouldScrollToEnd && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false); // スクロール済みとしてリセット
    }
  }, [state.books, shouldScrollToEnd]);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Book>) => {
    return (
      <Animated.View style={{ opacity: isActive ? 0.8 : 1 }}>
        <TouchableOpacity
          onLongPress={drag} // ✅ 長押しでドラッグ
          disabled={isActive} // ✅ ドラッグ中はタッチ無効
          onPress={() => navigation.navigate('Notebook', { bookId: item.id })}
          style={styles.bookItem}
        >
          <Image
            source={bookImages[item.color]}
            style={styles.bookImage}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.bookTitleOverlay,
              {
                transform: [
                  { translateX: -IMAGE_WIDTH * 0.5 },
                  { translateY: -IMAGE_HEIGHT * 0.4 },
                ],
              },
            ]}
          >
            {item.title.split('').join('\n')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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
        <View style={styles.bookListWrapper}>
          <DraggableFlatList
            ref={flatListRef}
            data={bookData}
            keyExtractor={(item) => item.id}
            horizontal
            renderItem={renderItem}
            onDragEnd={({ data }) => {
              setBookData(data);       // 見た目用
              reorderBooks(data);      // データ保存＆反映
            }}
            contentContainerStyle={styles.horizontalScrollContainer}
          />
        </View>
        <View style={styles.addBookSection}>
          <TouchableOpacity
            onPress={() => setIsSelectingColor(!isSelectingColor)}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>・本を追加</Text>
          </TouchableOpacity>
          {isSelectingColor && (
            <View style={styles.colorPicker}>
              {(['blue', 'cyan', 'green', 'pink', 'red', 'yellow'] as Book['color'][]).map(
                (color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => handleAddBookWithColor(color)}
                    style={styles.colorButton}
                  >
                    <Image
                      source={bookImages[color]}
                      style={styles.colorImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
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
  horizontalScrollContainer: {
  paddingHorizontal: 50,
  paddingVertical: 20,
  alignItems: 'center',
  justifyContent: 'center',   // ✅ 縦方向中央揃え
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
  addBookSection: {
  padding: 10,
  position: 'absolute',
  top: (screenHeight * 2) / 3,
  left: 0,
  right: 0,
  alignItems: 'center',
},

addButton: {
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 5,
},

addButtonText: {
  backgroundColor: 'rgba(255, 255, 255, 0)', // ← 透明度 60% に変更
  color: 'black',
  fontSize: 35,
  fontFamily: 'dartsfont',
},

colorPicker: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 10,
},

colorButton: {
  width: COLOR_ICON_WIDTH,
  height: COLOR_ICON_HEIGHT,
  marginHorizontal: 6,
},

colorImage: {
  width: '100%',
  height: '100%',
},
bookListWrapper: {
  height: screenHeight , // 高さを確保
  justifyContent: 'center',  // ✅ 縦方向中央に
  alignItems: 'center',      // ✅ 横方向中央に
},

});
