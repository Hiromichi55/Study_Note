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
import { MESSAGES } from '../constants/messages';

import bookImages from '../constants/bookImage';
import { styles, theme } from '../styles/theme';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary();
  const [isSelectingColor, setIsSelectingColor] = useState(false);
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

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
    setIsSelectingColor(false);
    const updatedBooks = [...state.books, newBook];
    setBookData(updatedBooks);
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
        <Image source={bookImages[item.color]} style={styles.bookImage} resizeMode="contain" />
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
                {(['red', 'pink', 'yellow', 'green', 'cyan', 'blue'] as Book['color'][]).map(
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
