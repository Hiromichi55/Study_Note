import ScreenBackground from './TitleBackground';
import React, { useState, useRef, useEffect } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';

import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';
import { ENV } from '@config';
import bookImgs from '../constants/bookImage';
import { homeStyles } from '../styles/homeStyle';
import * as homeStyle from '../styles/homeStyle';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const [BOOK_ImgLoaded, setBOOK_ImgLoaded] = useState(false); // 画像ロード完了フラグ
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'pink', 'yellow', 'green', 'cyan', 'blue'];

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
          DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'red' }, // デバッグ用枠線
        ]}
      >
        <Image
          source={bookImgs[item.color]}
          style={homeStyles.bookBtnImg}
          resizeMode="contain"
          onLoadEnd={() => setBOOK_ImgLoaded(true)}
        />
        {BOOK_ImgLoaded && (
          <Text
            style={[
              homeStyles.bookTitle,
              {
                transform: [
                  { translateX: -homeStyle.BOOK_IMG_WIDTH * 0.5 },
                  { translateY: -homeStyle.BOOK_IMG_HEIGHT * 0.4 },
                ],
              },
              DEBUG_LAYOUT && { backgroundColor: 'rgba(255,0,0,0.2)' } // 見やすくする
            ]}
          >
            {item.title.split('').join('\n')}
          </Text>
        )}  
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ScreenBackground>
      <View style={[
        homeStyles.titleContainer,
        DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'green' }, // タイトル全体の枠
        ]}>
        <Text style={homeStyles.titleText}>美ノート</Text>
      </View>
      <View style={[
        homeStyles.homeScreenContainer,
        DEBUG_LAYOUT && { borderWidth: 3, borderColor: 'orange' },
      ]}>
        <DraggableFlatList
          ref={flatListRef}
          data={bookData}
          keyExtractor={(item) => item.book_id}
          horizontal
          renderItem={renderItem}
          onDragEnd={({ data }) => {
            setBookData(data);
            reorderBooks(data);
          }}
          extraData={bookData} // ← 状態更新に合わせて再レンダリング
          contentContainerStyle={homeStyles.horizontalScrollContainer}
          getItemLayout={(data, index) => ({
            length: homeStyle.BOOK_IMG_WIDTH,           // アイテムの幅
            offset: homeStyle.BOOK_IMG_WIDTH * index,   // オフセット計算
            index,
          })}
          onScrollToIndexFailed={(info) => {
            // 失敗した場合に少し待って再スクロール
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 100);
          }}
        />
      </View>

      <View style={[
        homeStyles.menuBtnContainer,
        DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'purple' },
        ]}>
        <TouchableOpacity
          onPress={() => {
            console.log('本を追加ボタン押下');
            setShowBookOptions(prev => !prev)
          }}
          style={homeStyles.menuBtn}
        >
          <Text style={homeStyles.menuBtnText}>・本を追加</Text>
        </TouchableOpacity>

        {/* 常にマウントしておく。表示／非表示はスタイルで制御 */}
        <View style={[
          homeStyles.newBooksContainer,
          {
            opacity: showBookOptions ? 1 : 0,
            height: showBookOptions ? 'auto' : 0,
            ...(DEBUG_LAYOUT && { borderColor: 'green' })
          }
        ]}>
          {colorOptions.map(color => (
            <TouchableOpacity
              key={color}
              onPress={() => {
                console.log(`本を追加:color = ${color}`);
                handleAddBookWithColor(color)
              }}
              style={[homeStyles.newBookBtn, {...(DEBUG_LAYOUT && {borderWidth: 1,  borderColor: 'blue' })}]}
            >
              <Image source={bookImgs[color]} style={homeStyles.newBookBtnImg} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => console.log('使い方ボタン押下')}
          style={homeStyles.menuBtn}
        >
          <Text style={homeStyles.menuBtnText}>・使い方　</Text>
        </TouchableOpacity>
      </View>
    </ScreenBackground>
  );
};

export default HomeScreen;
