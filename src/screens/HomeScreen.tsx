import React, { useState, useRef, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  Modal,
  PanResponder,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Menu } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useLibrary } from '../context/LibraryContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Book } from '../context/LibraryContext';
import { ENV } from '@config';
import { BOOK_BTN_HEIGHT, homeStyles } from '../styles/homeStyles';
import * as commonStyle from '../styles/commonStyle';
import { logTable } from '../utils/logTable';
import { initDB } from '../db/db';



type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavProp;
}

// ✅ 開発用フラグ
const DEBUG_LAYOUT = ENV.SCREEN_DEV; // true: レイアウトデバッグ用枠線表示

const MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#4E4034',
  fontWeight: '600' as const,
};

const DELETE_MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#B45145',
  fontWeight: '600' as const,
};

const formatUpdatedAtLabel = (value?: string): string => {
  if (!value) return '更新日時なし';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更新日時なし';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth() + 1;
  const dateDate = date.getDate();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDate = today.getDate();
  const yesterdayYear = yesterday.getFullYear();
  const yesterdayMonth = yesterday.getMonth() + 1;
  const yesterdayDate = yesterday.getDate();
  
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  
  if (dateYear === todayYear && dateMonth === todayMonth && dateDate === todayDate) {
    return `今日 ${hh}:${mi}`;
  }
  if (dateYear === yesterdayYear && dateMonth === yesterdayMonth && dateDate === yesterdayDate) {
    return `昨日 ${hh}:${mi}`;
  }
  
  const yyyy = String(dateYear);
  const mm = String(dateMonth).padStart(2, '0');
  const dd = String(dateDate).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
};

type SortMode =
  | 'manual'
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc';

const parseDateOrZero = (value?: string): number => {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pinnedFirstSort = (books: Book[]): Book[] => {
  return [...books].sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)));
};

const sortLabelByMode: Record<SortMode, string> = {
  manual: '手動順',
  updated_desc: '更新日時(新しい順)',
  updated_asc: '更新日時(古い順)',
  created_desc: '作成日時(新しい順)',
  created_asc: '作成日時(古い順)',
  title_asc: 'タイトル(A-Z)',
  title_desc: 'タイトル(Z-A)',
};

const sortBooks = (books: Book[], sortMode: SortMode): Book[] => {
  const copied = [...books];
  switch (sortMode) {
    case 'manual':
      return pinnedFirstSort(copied.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    case 'updated_desc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(b.updated_at) - parseDateOrZero(a.updated_at)));
    case 'updated_asc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(a.updated_at) - parseDateOrZero(b.updated_at)));
    case 'created_desc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(b.created_at) - parseDateOrZero(a.created_at)));
    case 'created_asc':
      return pinnedFirstSort(copied.sort((a, b) => parseDateOrZero(a.created_at) - parseDateOrZero(b.created_at)));
    case 'title_asc':
      return pinnedFirstSort(copied.sort((a, b) => a.title.localeCompare(b.title, 'ja')));
    case 'title_desc':
      return pinnedFirstSort(copied.sort((a, b) => b.title.localeCompare(a.title, 'ja')));
    default:
      return pinnedFirstSort(copied);
  }
};

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
  const { state, addBook, deleteBook, renameBook, recolorBook, toggleBookPin } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);

  const colorOptions: Book['color'][] = ['red', 'orange', 'pink', 'yellow', 'green', 'olive', 'cyan', 'blue', 'purple', 'brown', 'gray', 'black'];

  const bookIconColors: Record<string, string> = {
    red: '#B6504A',
    pink: '#B98196',
    orange: '#DB8A3E',
    yellow: '#D2BA39',
    green: '#5D9C6A',
    cyan: '#2499A7',
    blue: '#4A78AC',
    purple: '#8A6EA8',
    brown: '#886B57',
    gray: '#7A7A7A',
    olive: '#768830',
    black: '#1F1F1F',
  };
  const [showBookOptions, setShowBookOptions] = useState(false);
  const [showTitleInputModal, setShowTitleInputModal] = useState(false);
  const [selectedColorForNewBook, setSelectedColorForNewBook] = useState<Book['color'] | null>(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [menuVisibleBookId, setMenuVisibleBookId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [recolorModalVisible, setRecolorModalVisible] = useState(false);
  const [recoloringBookId, setRecoloringBookId] = useState<string | null>(null);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('updated_desc');
  const helpIconWrapRef = useRef<View>(null);
  const settingsIconWrapRef = useRef<View>(null);
  const wordbookQuickBtnWrapRef = useRef<View>(null);
  const firstBookMenuWrapRef = useRef<View>(null);
  const addBookBtnWrapRef = useRef<View>(null);
  const settingsAnchor = { x: commonStyle.screenWidth - 44, y: 92, width: 32, height: 32 };
  const [helpAnchors, setHelpAnchors] = useState({
    settings: settingsAnchor,
    wordbook: { x: commonStyle.screenWidth - 120, y: 130, width: 100, height: 32 },
    bookMenu: { x: commonStyle.screenWidth - 64, y: 240, width: 44, height: 44 },
    help: { x: commonStyle.screenWidth - 88, y: 92, width: 32, height: 32 },
    addBook: { x: commonStyle.screenWidth - 84, y: commonStyle.screenHeight - 122, width: commonStyle.screenWidth / 6, height: commonStyle.screenWidth / 6 },
  });
  const swipeHandledRef = useRef(false);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const measureView = (ref: React.RefObject<View | null>, key: keyof typeof helpAnchors) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setHelpAnchors((prev) => ({ ...prev, [key]: { x, y, width, height } }));
    });
  };

  const refreshHelpAnchors = () => {
    measureView(helpIconWrapRef, 'help');
    measureView(settingsIconWrapRef, 'settings');
    measureView(wordbookQuickBtnWrapRef, 'wordbook');
    measureView(firstBookMenuWrapRef, 'bookMenu');
    measureView(addBookBtnWrapRef, 'addBook');
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showBookOptions || renameModalVisible || menuVisibleBookId !== null) return false;
        return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (showBookOptions || renameModalVisible || menuVisibleBookId !== null) return false;
        return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onPanResponderGrant: () => {
        swipeHandledRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dx > 56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('Wordbook');
          return;
        }
        if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('WordList');
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dx > 56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('Wordbook');
          return;
        }
        if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('WordList');
        }
      },
      onPanResponderTerminate: () => {
        swipeHandledRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    setBookData(sortBooks(state.books, sortMode));
  }, [state.books, sortMode]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowHelpOverlay(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!showHelpOverlay) return;
    const timer = setTimeout(() => {
      refreshHelpAnchors();
    }, 0);
    return () => clearTimeout(timer);
  }, [showHelpOverlay, bookData.length]);

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

  const handleColorSelection = (color: Book['color']) => {
    setSelectedColorForNewBook(color);
    setShowBookOptions(false);
    setShowTitleInputModal(true);
  };

  const closeTitleInputModal = () => {
    setShowTitleInputModal(false);
    setSelectedColorForNewBook(null);
    setNewBookTitle('');
  };

  const handleAddBookWithTitle = async () => {
    if (!selectedColorForNewBook) return;
    
    const newId = Date.now().toString();
    const newBook: Book = {
      book_id: newId,
      title: newBookTitle.trim(),
      color: selectedColorForNewBook,
      order_index: state.books.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await addBook(newBook);
    const database = await initDB();
    const updatedBooks = sortBooks([...state.books, newBook], sortMode);
    setBookData(updatedBooks);

    closeTitleInputModal();

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

  const renderRightActions = (bookId: string, title: string) => (
    <View style={localStyles.rightActionContainer}>
      <TouchableOpacity
        style={localStyles.swipeDeleteButton}
        onPress={() => {
        Alert.alert('本の削除', `「${title}」を削除しますか？`, [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除',
            style: 'destructive',
            onPress: async () => {
              await deleteBook(bookId);
            },
          },
        ]);
      }}
    >
      <Ionicons name="trash-outline" size={24} color="#fff" />
    </TouchableOpacity>
  </View>
  );

  const renderLeftActions = (item: Book) => (
    <View style={localStyles.leftActionContainer}>
      <TouchableOpacity
        style={localStyles.swipePinButton}
        onPress={async () => {
          await toggleBookPin(item.book_id, !Boolean(item.is_pinned));
        }}
      >
        <MaterialCommunityIcons
          name={item.is_pinned ? 'pin-off' : 'pin'}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );

  const BookItem = React.memo(({ item }: { item: Book }) => (
    <Swipeable
      renderLeftActions={() => renderLeftActions(item)}
      renderRightActions={() => renderRightActions(item.book_id, item.title)}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={40}
      rightThreshold={40}
      containerStyle={{ overflow: 'hidden', borderRadius: 24 }}
    >
      <Animated.View
        style={[
          homeStyles.bookCardWrap,
          { opacity: 1, transform: [{ scale: 1 }] },
        ]}
      >
        <View style={homeStyles.bookBtn}>
        <View style={[homeStyles.bookSpine, { backgroundColor: bookIconColors[item.color] }]} />
        <TouchableOpacity
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
            <Text style={homeStyles.bookSubtitle}>{`${formatUpdatedAtLabel(item.updated_at)}`}</Text>
          </View>
        </TouchableOpacity>
        {item.is_pinned && (
          <View pointerEvents="none" style={localStyles.pinnedBadge}>
            <MaterialCommunityIcons name="pin" size={16} color="#A5672A" />
          </View>
        )}
        <Menu
          visible={menuVisibleBookId === item.book_id}
          onDismiss={() => setMenuVisibleBookId(null)}
          anchor={
            <View
              ref={item.order_index === 0 ? firstBookMenuWrapRef : undefined}
              collapsable={false}
            >
              <TouchableOpacity
                style={homeStyles.bookMenuButton}
                onPress={() => setMenuVisibleBookId(menuVisibleBookId === item.book_id ? null : item.book_id)}
              >
                <Ionicons name="ellipsis-horizontal" size={commonStyle.screenWidth / 19} color="#6B6258" />
              </TouchableOpacity>
            </View>
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
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              setRecoloringBookId(item.book_id);
              setRecolorModalVisible(true);
            }}
            title="色を変更"
            leadingIcon="palette"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={async () => {
              setMenuVisibleBookId(null);
              await toggleBookPin(item.book_id, !Boolean(item.is_pinned));
            }}
            title={item.is_pinned ? 'ピン留めを解除' : 'ピン留め'}
            leadingIcon={item.is_pinned ? 'pin-off' : 'pin'}
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
          <Menu.Item
            onPress={() => {
              setMenuVisibleBookId(null);
              handleDeleteBook(item.book_id, item.title);
            }}
            title="本を削除"
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name="trash-can" size={size} color="#B45145" />
            )}
            titleStyle={DELETE_MENU_ITEM_TITLE_STYLE}
          />
        </Menu>
      </View>
    </Animated.View>
  </Swipeable>
  ));

  const renderItem = ({ item }: ListRenderItemInfo<Book>) => (
    <BookItem item={item} />
  );

  return (
    <View style={homeStyles.background} {...panResponder.panHandlers}>
      <View style={homeStyles.backgroundGlowTop} />
      <View style={homeStyles.backgroundGlowBottom} />

      <View style={[
        homeStyles.topSpacer,
        DEBUG_LAYOUT && { borderWidth: 0.5, borderColor: 'black' },
      ]}>
        <View style={[homeStyles.titleRow, { marginBottom: 10 }]}>
          <Text style={[homeStyles.screenCaption, { flex: 1 }]}>ノート一覧</Text>
          <View ref={settingsIconWrapRef} collapsable={false}>
            <TouchableOpacity
              onPress={() => navigation.navigate('License')}
              style={{ padding: 4 }}
            >
              <Ionicons name="information-circle-outline" size={commonStyle.screenWidth / 13} color="#6B6258" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={homeStyles.listHeaderDescription}>
            全 {bookData.length} 冊
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View ref={wordbookQuickBtnWrapRef} collapsable={false}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Wordbook')}
                style={[homeStyles.wordbookQuickBtn, showHelpOverlay && localStyles.wordbookQuickBtnHelpMode]}
              >
                <Ionicons name="albums-outline" size={16} color={showHelpOverlay ? '#4E4034' : '#FFFFFF'} />
                <Text style={[homeStyles.wordbookQuickBtnText, showHelpOverlay && localStyles.wordbookQuickBtnTextHelpMode]}>一問一答</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('WordList')}
              style={[homeStyles.wordbookQuickBtn, showHelpOverlay && localStyles.wordbookQuickBtnHelpMode]}
            >
              <Ionicons name="list-outline" size={16} color={showHelpOverlay ? '#4E4034' : '#FFFFFF'} />
              <Text style={[homeStyles.wordbookQuickBtnText, showHelpOverlay && localStyles.wordbookQuickBtnTextHelpMode]}>単語リスト</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={bookData}
        keyExtractor={(item) => item.book_id}
        renderItem={renderItem}
        extraData={bookData}
        contentContainerStyle={homeStyles.verticalScrollContainer}
        getItemLayout={(data, index) => ({
          length: BOOK_BTN_HEIGHT,
          offset: BOOK_BTN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        ListHeaderComponent={null}
        ListEmptyComponent={
          <View style={homeStyles.emptyCard}>
            <Text style={homeStyles.emptyTitle}>まだ本がありません</Text>
            <Text style={homeStyles.emptyDescription}>右下のボタンから最初の1冊を追加できます。</Text>
          </View>
        }
      />

      {showHelpOverlay && (
        <TouchableWithoutFeedback onPress={() => setShowHelpOverlay(false)}>
          <View style={localStyles.helpOverlay} pointerEvents="auto">

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.settings.y + helpAnchors.settings.height + 8,
                left: clamp(helpAnchors.settings.x + helpAnchors.settings.width - commonStyle.screenWidth * 0.45, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.45 - 12),
                maxWidth: commonStyle.screenWidth * 0.45,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>設定アイコン</Text>
            <Text style={localStyles.helpText}>詳細情報確認</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.wordbook.y + helpAnchors.wordbook.height + 8,
                left: clamp(helpAnchors.wordbook.x + helpAnchors.wordbook.width - commonStyle.screenWidth * 0.45, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.45 - 12),
                maxWidth: commonStyle.screenWidth * 0.45,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>一問一答</Text>
            <Text style={localStyles.helpText}>ノートに追加した一問一答</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.bookMenu.y + helpAnchors.bookMenu.height + 8,
                left: clamp(helpAnchors.bookMenu.x + helpAnchors.bookMenu.width - commonStyle.screenWidth * 0.56, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.56 - 12),
                maxWidth: commonStyle.screenWidth * 0.56,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>本のメニュー</Text>
            <Text style={localStyles.helpText}>名前を変更/削除</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.help.y + helpAnchors.help.height + 8,
                left: clamp(helpAnchors.help.x + helpAnchors.help.width - commonStyle.screenWidth * 0.5, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.5 - 12),
                maxWidth: commonStyle.screenWidth * 0.5,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>はてなボタン</Text>
            <Text style={localStyles.helpText}>説明表示の切り替え。</Text>
          </View>

          <View
            style={[
              localStyles.helpBubble,
              {
                top: helpAnchors.addBook.y - 74,
                left: clamp(helpAnchors.addBook.x + helpAnchors.addBook.width - commonStyle.screenWidth * 0.48, 12, commonStyle.screenWidth - commonStyle.screenWidth * 0.48 - 12),
                maxWidth: commonStyle.screenWidth * 0.48,
              },
            ]}
          >
            <Text style={localStyles.helpTitle}>追加ボタン</Text>
            <Text style={localStyles.helpText}>新しい本を作成。</Text>
          </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      <TouchableOpacity
        ref={addBookBtnWrapRef}
        onPress={() => {
          console.log('本を追加ボタン押下');
          setShowBookOptions(prev => !prev);
        }}
        style={homeStyles.addBookBtn}
      >
        <Ionicons
          name="add"
          size={commonStyle.screenWidth / 10}
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
                        handleColorSelection(color);
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
        visible={showTitleInputModal}
        transparent
        animationType="fade"
        onRequestClose={closeTitleInputModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <TouchableWithoutFeedback onPress={closeTitleInputModal}>
            <View style={homeStyles.modalBackdropCenter}>
              <TouchableWithoutFeedback>
                <View style={homeStyles.renameModalCard}>
                  <Text style={homeStyles.renameModalTitle}>本のタイトルを入力</Text>
                  <TextInput
                    style={homeStyles.renameInput}
                    value={newBookTitle}
                    onChangeText={setNewBookTitle}
                    autoFocus
                    selectTextOnFocus
                    placeholder="本のタイトル"
                    placeholderTextColor="#A09588"
                  />
                  <View style={homeStyles.renameActionRow}>
                    <TouchableOpacity
                      onPress={closeTitleInputModal}
                      style={homeStyles.renameGhostButton}
                    >
                      <Text style={homeStyles.renameGhostButtonText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddBookWithTitle}
                      style={homeStyles.renamePrimaryButton}
                    >
                      <Text style={homeStyles.renamePrimaryButtonText}>作成</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={recolorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setRecolorModalVisible(false); setRecoloringBookId(null); }}
      >
        <TouchableWithoutFeedback onPress={() => { setRecolorModalVisible(false); setRecoloringBookId(null); }}>
          <View style={homeStyles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={homeStyles.newBookOptionsOverlay}>
                <Text style={homeStyles.paletteTitle}>本の色を選択</Text>
                <View style={homeStyles.paletteGrid}>
                  {colorOptions.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={async () => {
                        if (recoloringBookId) {
                          await recolorBook(recoloringBookId, color);
                        }
                        setRecolorModalVisible(false);
                        setRecoloringBookId(null);
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}
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
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const localStyles = StyleSheet.create({
  helpOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    backgroundColor: 'rgba(39, 30, 22, 0.14)',
  },
  helpBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 253, 249, 0.99)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DCCAB4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  helpTitle: {
    fontSize: 13,
    color: '#3E3125',
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#4E4034',
    lineHeight: 17,
  },
  wordbookQuickBtnHelpMode: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  wordbookQuickBtnTextHelpMode: {
    color: '#4E4034',
  },
  rightActionContainer: {
    width: 80,
    marginBottom: 14,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    backgroundColor: '#6E5844',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  leftActionContainer: {
    width: 80,
    marginBottom: 14,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    backgroundColor: '#6E5844',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  swipeDeleteButton: {
    flex: 1,
    backgroundColor: '#B45145',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipePinButton: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedBadge: {
    position: 'absolute',
    top: 12,
    right: 74,
    zIndex: 2,
  },
});

export default HomeScreen;
