import React, { useState, useRef, useEffect } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';
import { ENV } from '@config';
import { homeStyles } from '../styles/homeStyle';
import * as homeStyle from '../styles/homeStyle';
import * as commonStyle from '../styles/commonStyle';
import { logTable } from '../utils/logTable';
import { initDB } from '../db/db';



type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const BOOK_SUBTITLE = 'タップで開く / 長押しで並び替え';

const getBookBadgeStyle = (color: Book['color'], baseColor: string) => {
  if (color === 'black') {
    return {
      backgroundColor: '#1F1F1F',
      iconColor: '#FFFFFF',
    };
  }
  return {
    backgroundColor: `${baseColor}22`,
    iconColor: baseColor,
  };
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, addBook, reorderBooks, deleteBook, renameBook } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'pink', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'brown', 'gray', 'black'];

  const bookIconColors: Record<string, string> = {
    red: '#B26260',
    pink: '#B25F87',
    orange: '#B47B4F',
    yellow: '#BBA859',
    green: '#6DA055',
    blue: '#4B8ABA',
    cyan: '#55A99F',
    purple: '#7A68B2',
    brown: '#8A6A52',
    gray: '#6F7A86',
    black: 'black'
  };
  const [showBookOptions, setShowBookOptions] = useState(false);
  const [menuVisibleBookId, setMenuVisibleBookId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    setBookData(state.books);
  }, [state.books]);

  const handleDeleteBook = (bookId: string, title: string) => {
    Alert.alert(
      '本を削除',
      `「${title}」を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteBook(bookId);
          },
        },
      ]
    );
  };

  const handleAddBookWithColor = async (color: Book['color']) => {
    const newId = Date.now().toString();
    const newBook: Book = {
      book_id: newId,
      title: 'NEW',
      color,
      order_index: state.books.length,
    };
    await addBook(newBook);
    const database = await initDB();
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
    const result = await database.getAllAsync('SELECT * FROM books;');
    logTable('Booksテーブル読込', result as Record<string, any>[]);
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setRenamingBookId(null);
    setRenameText('');
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Book>) => (
    <Animated.View
      style={[
        homeStyles.bookCardWrap,
        { opacity: isActive ? 0.82 : 1, transform: [{ scale: isActive ? 0.985 : 1 }] },
      ]}
    >
      <View style={homeStyles.bookBtn}>
        <View style={[homeStyles.bookSpine, { backgroundColor: bookIconColors[item.color] }]} />
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          onPress={() => {
            console.log(`本を選択:bookId = ${item.book_id}`);
            navigation.navigate('Notebook', { bookId: item.book_id });
          }}
          style={homeStyles.bookMainArea}
        >
          <View
            style={[
              homeStyles.bookIconBadge,
              { backgroundColor: getBookBadgeStyle(item.color, bookIconColors[item.color]).backgroundColor },
            ]}
          >
            <View style={homeStyles.bookIconGlyphWrap}>
              <Ionicons
                name="book-outline"
                size={commonStyle.screenWidth / 16}
                color={getBookBadgeStyle(item.color, bookIconColors[item.color]).iconColor}
                style={homeStyles.bookIconGlyph}
              />
            </View>
          </View>
          <View style={homeStyles.bookTextBlock}>
            <Text numberOfLines={1} style={homeStyles.bookTitle}>{item.title}</Text>
            <Text style={homeStyles.bookSubtitle}>{BOOK_SUBTITLE}</Text>
          </View>
        </TouchableOpacity>
        <Menu
          visible={menuVisibleBookId === item.book_id}
          onDismiss={() => setMenuVisibleBookId(null)}
          anchor={
            <TouchableOpacity
              style={homeStyles.bookMenuButton}
              onPress={() => setMenuVisibleBookId(item.book_id)}
            >
              <Ionicons name="ellipsis-horizontal" size={commonStyle.screenWidth / 19} color="#6B6258" />
            </TouchableOpacity>
          }
          contentStyle={homeStyles.bookMenuContent}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              setRenamingBookId(item.book_id);
              setRenameText(item.title);
              setRenameModalVisible(true);
            }}
            title="タイトルを変更"
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              handleDeleteBook(item.book_id, item.title);
            }}
            title="本を削除"
            leadingIcon="trash-can"
            titleStyle={{ color: 'red' }}
          />
        </Menu>
      </View>
    </Animated.View>
  );

  return (
    <View style={homeStyles.background}>
      <View style={homeStyles.backgroundGlowTop} />
      <View style={homeStyles.backgroundGlowBottom} />

      <View style={[
        homeStyles.topSpacer,
        DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' },
      ]}>
        <Text style={homeStyles.eyebrow}>NOTE STYLE MEMO</Text>
        <Text style={homeStyles.screenCaption}>ノート風メモ帳</Text>
      </View>

      <DraggableFlatList
        ref={flatListRef}
        data={bookData}
        keyExtractor={(item) => item.book_id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          setBookData(data);
          reorderBooks(data);
        }}
        extraData={bookData}
        contentContainerStyle={homeStyles.verticalScrollContainer}
        getItemLayout={(data, index) => ({
          length: homeStyle.BOOK_BTN_HEIGHT,
          offset: homeStyle.BOOK_BTN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        ListHeaderComponent={
          <View style={homeStyles.listHeaderStrip}>
            <View style={homeStyles.listHeaderAccentBar} />
            <View style={homeStyles.listHeaderTextWrap}>
              <Text style={homeStyles.listHeaderTitle}>ノート本棚</Text>
              <Text style={homeStyles.listHeaderDescription}>全 {bookData.length} 冊 ・ 追加 / 並び替え / 管理</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={homeStyles.emptyCard}>
            <Text style={homeStyles.emptyTitle}>まだ本がありません</Text>
            <Text style={homeStyles.emptyDescription}>右下のボタンから最初の1冊を追加できます。</Text>
          </View>
        }
      />

      <TouchableOpacity
        onPress={() => console.log('使い方')}
        style={homeStyles.manualBtn}
      >
        <Ionicons
          name="help-circle-outline"
          size={commonStyle.screenWidth / 15}
          color="white"
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
          size={commonStyle.screenWidth / 12}
          color="white"
        />
      </TouchableOpacity>

      {showBookOptions && (
        <Modal transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowBookOptions(false)}>
            <View style={homeStyles.modalBackdrop}>
              <View style={homeStyles.newBookOptionsOverlay}>
                <Text style={homeStyles.paletteTitle}>本の色を選択</Text>
                <View style={homeStyles.paletteGrid}>
                  {colorOptions.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => {
                        console.log(`本を追加:color = ${color}`);
                        handleAddBookWithColor(color);
                      }}
                      style={homeStyles.newBookBtn}
                    >
                      <View
                        style={[
                          homeStyles.paletteSwatch,
                          { backgroundColor: getBookBadgeStyle(color, bookIconColors[color]).backgroundColor },
                        ]}
                      >
                        <View style={homeStyles.paletteIconGlyphWrap}>
                          <Ionicons
                            name="book-outline"
                            size={commonStyle.screenWidth / 10}
                            style={[
                              homeStyles.newBookBtnIcon,
                              homeStyles.bookIconGlyph,
                              { color: getBookBadgeStyle(color, bookIconColors[color]).iconColor },
                            ]}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}
      >
        <TouchableWithoutFeedback onPress={closeRenameModal}>
          <View style={homeStyles.modalBackdropCenter}>
            <TouchableWithoutFeedback>
              <View style={homeStyles.renameModalCard}>
                <Text style={homeStyles.renameModalTitle}>タイトルを変更</Text>
                <TextInput
                  style={homeStyles.renameInput}
                  value={renameText}
                  onChangeText={setRenameText}
                  autoFocus
                  selectTextOnFocus
                  placeholder="本のタイトル"
                  placeholderTextColor="#A09588"
                />
                <View style={homeStyles.renameActionRow}>
                  <TouchableOpacity
                    onPress={closeRenameModal}
                    style={homeStyles.renameGhostButton}
                  >
                    <Text style={homeStyles.renameGhostButtonText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      if (renamingBookId && renameText.trim()) {
                        await renameBook(renamingBookId, renameText.trim());
                      }
                      closeRenameModal();
                    }}
                    style={homeStyles.renamePrimaryButton}
                  >
                    <Text style={homeStyles.renamePrimaryButtonText}>変更</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default HomeScreen;
