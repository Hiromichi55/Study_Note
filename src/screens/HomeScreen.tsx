import React, { useState, useRef, useEffect } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';

import bookImages from '../constants/bookImage';
import { styles, theme } from '../styles/theme';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'pink', 'yellow', 'green', 'cyan', 'blue'];

  const [showBookOptions, setShowBookOptions] = useState(false);

  useEffect(() => {
    setBookData(state.books);
  }, [state.books]);

  const handleAddBookWithColor = async (color: Book['color']) => {
    const newId = Date.now().toString();
    const newBook: Book = {
      id: newId,
      title: 'NEW',
      color,
      order_index: state.books.length,
    };
    await addBook(newBook);

    const updatedBooks = [...state.books, newBook];
    setBookData(updatedBooks);

    // ここで選択肢を非表示に
    setShowBookOptions(false);

    setTimeout(() => {
      const newIndex = updatedBooks.findIndex((b) => b.id === newId);
      if (flatListRef.current && newIndex >= 0) {
        flatListRef.current.scrollToIndex({ index: newIndex, animated: true });
      }
    }, 100);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Book>) => (
    <Animated.View style={{ opacity: isActive ? 0.8 : 1 }}>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
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
                { translateX: -theme.IMAGE_WIDTH * 0.5 },
                { translateY: -theme.IMAGE_HEIGHT * 0.4 },
              ],
            },
          ]}
        >
          {item.title.split('').join('\n')}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backgroundWrapper}>
        <ImageBackground
          source={require('../../assets/images/title.png')}
          style={styles.background}
          resizeMode="contain"
        >
          <View style={styles.bookListWrapper}>
            <DraggableFlatList
              ref={flatListRef}
              data={bookData}
              keyExtractor={(item) => item.id}
              horizontal
              renderItem={renderItem}
              onDragEnd={({ data }) => {
                setBookData(data);
                reorderBooks(data);
              }}
              extraData={bookData} // ← 状態更新に合わせて再レンダリング
              contentContainerStyle={styles.horizontalScrollContainer}
            />
          </View>

          <View style={styles.addBookSection}>
            <TouchableOpacity
              onPress={() => setShowBookOptions(prev => !prev)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>・本を追加</Text>
            </TouchableOpacity>

            {/* 常にマウントしておく。表示／非表示はスタイルで制御 */}
            <View style={{
              backgroundColor: 'white',
              borderWidth: 1,               // 枠の太さ
              borderColor: '#ccc',          // 枠の色
              borderRadius: 8,              // 角丸
              padding: 8,                   // 内側の余白
              // marginVertical: 8,            // 上下の余白
              flexDirection: 'row',         // 横並び
              opacity: showBookOptions ? 1 : 0,
              height: showBookOptions ? 'auto' : 0,
              overflow: 'hidden'
            }}>
              {colorOptions.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleAddBookWithColor(color)}
                  style={styles.colorButton}
                >
                  <Image source={bookImages[color]} style={styles.colorImage} resizeMode="contain" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => console.log('使い方')}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>・使い方　</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;
