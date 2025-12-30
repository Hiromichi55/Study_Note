import ScreenBackground from './TitleBackground';
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
import { ENV } from '@config';
import bookImages from '../constants/bookImage';
import { homeStyles } from '../styles/homeStyle';
import * as commonStyle from '../styles/commonStyle';

type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false); // 画像ロード完了フラグ
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
        style={[
          homeStyles.bookItem,
          DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'red' }, // デバッグ用枠線
        ]}
      >
        <Image
          source={bookImages[item.color]}
          style={homeStyles.bookImage}
          resizeMode="contain"
          onLoadEnd={() => setImageLoaded(true)}
        />
        {imageLoaded && (
          <Text
            style={[
              homeStyles.bookTitleOverlay,
              {
                transform: [
                  { translateX: -commonStyle.IMAGE_WIDTH * 0.5 },
                  { translateY: -commonStyle.IMAGE_HEIGHT * 0.4 },
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
    <KeyboardAvoidingView
      style={homeStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenBackground>
        <View style={[
          homeStyles.titleHome,
          DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'green' }, // タイトル全体の枠
          ]}>
          <Text style={homeStyles.titleText}>美ノート</Text>
        </View>
        <View style={[
          homeStyles.bookListWrapper,
          DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'orange' },
        ]}>
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
            contentContainerStyle={homeStyles.horizontalScrollContainer}
            getItemLayout={(data, index) => ({
              length: commonStyle.IMAGE_WIDTH,           // アイテムの幅
              offset: commonStyle.IMAGE_WIDTH * index,   // オフセット計算
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
          homeStyles.addBookSection,
          DEBUG_LAYOUT && { borderWidth: 1, borderColor: 'purple' },
          ]}>
          <TouchableOpacity
            onPress={() => setShowBookOptions(prev => !prev)}
            style={homeStyles.addButton}
          >
            <Text style={homeStyles.addButtonText}>・本を追加</Text>
          </TouchableOpacity>

          {/* 常にマウントしておく。表示／非表示はスタイルで制御 */}
          <View style={{
            backgroundColor: 'white',
            borderWidth: 1,               // 枠の太さ
            borderRadius: 8,              // 角丸
            padding: 8,                   // 内側の余白
            flexDirection: 'row',         // 横並び
            opacity: showBookOptions ? 1 : 0,
            height: showBookOptions ? 'auto' : 0,
            overflow: 'hidden',
            ...(DEBUG_LAYOUT && { borderColor: 'brown' }),
          }}>
            {colorOptions.map(color => (
              <TouchableOpacity
                key={color}
                onPress={() => handleAddBookWithColor(color)}
                style={homeStyles.colorButton}
              >
                <Image source={bookImages[color]} style={homeStyles.colorImage} resizeMode="contain" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => console.log('使い方')}
            style={homeStyles.addButton}
          >
            <Text style={homeStyles.addButtonText}>・使い方　</Text>
          </TouchableOpacity>
        </View>
      {/* </ImageBackground> */}
      </ScreenBackground>
      {/* </View> */}
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;
