import React, { useState, useRef, useEffect } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';
import { ENV } from '@config';
import { homeStyles } from '../styles/homeStyle';
import * as homeStyle from '../styles/homeStyle';
import * as commonStyle from '../styles/commonStyle';
import { ImageBackground,Modal } from 'react-native';



type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'pink', 'yellow', 'green', 'cyan', 'blue', 'black'];

  const bookIconColors: Record<string, string> = {
    blue: '#3498DB',
    cyan: 'cyan',
    green: '#2ECC71',
    pink: 'pink',
    red: '#E74C3C',
    yellow: '#F1C40F',
    black: 'black'
  };
  const [showBookOptions, setShowBookOptions] = useState(false);

  useEffect(() => {
    setBookData(state.books);
  }, [state.books]);

  const handleAddBookWithColor = async (color: Book['color']) => {
    const newId = Date.now().toString();
    const newBook: Book = {
      book_id: newId,
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
      const newIndex = updatedBooks.findIndex((b) => b.book_id === newId);
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
        onPress={() => {
          console.log(`本を選択:bookId = ${item.book_id}`);
          navigation.navigate('Notebook', { bookId: item.book_id })
        }}
        style={[
          homeStyles.bookBtn,
          //DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' }, // デバッグ用枠線
        ]}
      >
        <View style={homeStyles.bookBtnBottomLine} />
        <Ionicons 
          name="chevron-forward-outline" 
          size={commonStyle.screenWidth/18}
          style={homeStyles.forwardNotebookIcon}
        />
        <Ionicons 
          name="book-outline" 
          size={commonStyle.screenWidth/14}
          style={[
            homeStyles.bookBtnIcon,
            { color: bookIconColors[item.color] }
          ]}
        />
        <Text
          style={[
            homeStyles.bookTitle,
           // DEBUG_LAYOUT && { backgroundColor: 'rgba(255,0,0,0.2)' } // 見やすくする
          ]}
        >
          {item.title}
        </Text> 
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={homeStyles.background}>
      <View style={[
        homeStyles.topMenuContainer,
        DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' }, 
      ]}>
        <Text style={homeStyles.titleText}>美ノート</Text>
      </View>
      <DraggableFlatList
        ref={flatListRef}
        data={bookData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          setBookData(data);
          reorderBooks(data);
        }}
        extraData={bookData} // ← 状態更新に合わせて再レンダリング
        contentContainerStyle={[
          homeStyles.verticalScrollContainer,
          //DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'black' },
        ]}
        getItemLayout={(data, index) => ({
          length: homeStyle.BOOK_BTN_WIDTH,           // アイテムの幅
          offset: homeStyle.BOOK_BTN_WIDTH * index,   // オフセット計算
          index,
        })}
        onScrollToIndexFailed={(info) => {
          // 失敗した場合に少し待って再スクロール
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
      />
      <View style={[
        homeStyles.bottomMenuContainer,
        DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' },
      ]}>
        <TouchableOpacity
          onPress={() => console.log('使い方')}
          style={homeStyles.manualBtn}
        >
          <Ionicons 
            name="help-circle-outline" 
            size={commonStyle.screenWidth/11}
            style={homeStyles.manualBtnIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            console.log('本を追加ボタン押下');
            setShowBookOptions(prev => !prev);
          }}
          style={homeStyles.addBookBtn}
        >
          <Ionicons 
            name="book" 
            size={commonStyle.screenWidth/12}
            style={homeStyles.addBookBtnIcon}
          />
        </TouchableOpacity>
      </View>
      {showBookOptions && (
        <Modal transparent animationType="fade">
          <View 
          style={[
            homeStyles.newBookOptionsOverlay,
            //DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'red' },
          ]}>
            {colorOptions.map(color => (
              <TouchableOpacity
                key={color}
                onPress={() => {
                  console.log(`本を追加:color = ${color}`);
                  handleAddBookWithColor(color);
                }}
                style={[
                  homeStyles.newBookBtn,
                  //{...(DEBUG_LAYOUT && {borderWidth: 1,  borderColor: 'blue' })}
                ]}
              >
                <Ionicons 
                  name="book-outline" 
                  size={commonStyle.screenWidth/10}
                  style={[
                    homeStyles.newBookBtnIcon,
                    { color: bookIconColors[color] }
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}
    </View>
  );
};

export default HomeScreen;
