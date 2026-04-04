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
  PanResponder,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
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

const BOOK_SUBTITLE = 'タップで開く / 長押しで並び替え';
const MENU_ITEM_TITLE_STYLE = {
  fontSize: 14,
  color: '#4E4034',
  fontWeight: '600' as const,
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
  const { state, addBook, reorderBooks, deleteBook, renameBook, recolorBook } = useLibrary();
  const [bookData, setBookData] = useState<Book[]>([]);
  const flatListRef = useRef<any>(null);
  const isDraggingRef = useRef(false);

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
  const [newBookTitle, setNewBookTitle] = useState('NEW');
  const [menuVisibleBookId, setMenuVisibleBookId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [recolorModalVisible, setRecolorModalVisible] = useState(false);
  const [recoloringBookId, setRecoloringBookId] = useState<string | null>(null);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  const settingsIconWrapRef = useRef<View>(null);
  const [settingsAnchor, setSettingsAnchor] = useState({ x: commonStyle.screenWidth - 44, y: 92, width: 32, height: 32 });
  const swipeHandledRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showBookOptions || renameModalVisible || menuVisibleBookId !== null || settingsMenuVisible) return false;
        return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (showBookOptions || renameModalVisible || menuVisibleBookId !== null || settingsMenuVisible) return false;
        return Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onPanResponderGrant: () => {
        swipeHandledRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('Wordbook');
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dx < -56 && Math.abs(gestureState.dy) < 28) {
          swipeHandledRef.current = true;
          navigation.navigate('Wordbook');
        }
      },
      onPanResponderTerminate: () => {
        swipeHandledRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    // ドラッグ中は useEffect をスキップ
    // ドラッグ中は onDragEnd で setBookData が呼ばれているため、
    // state.books の変更による setBookData は不要
    if (isDraggingRef.current) return;
    
    setBookData(state.books);
  }, [state.books]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setSettingsMenuVisible(false);
        setShowHelpOverlay(false);
      };
    }, [])
  );

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
    setNewBookTitle('NEW');
  };

  const handleAddBookWithTitle = async () => {
    if (!selectedColorForNewBook) return;
    
    const newId = Date.now().toString();
    const newBook: Book = {
      book_id: newId,
      title: newBookTitle.trim() || 'NEW',
      color: selectedColorForNewBook,
      order_index: state.books.length,
    };
    await addBook(newBook);
    const database = await initDB();
    const updatedBooks = [...state.books, newBook];
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

  const openSettingsMenu = () => {
    settingsIconWrapRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setSettingsAnchor({ x, y, width, height });
      }
      setSettingsMenuVisible(true);
    });
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

  const BookItem = React.memo(({ item, drag, isActive }: RenderItemParams<Book>) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.book_id, item.title)}
      overshootRight={false}
      rightThreshold={40}
      containerStyle={{ overflow: 'hidden', borderRadius: 24 }}
    >
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
              onPress={() => setMenuVisibleBookId(menuVisibleBookId === item.book_id ? null : item.book_id)}
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
            onPress={() => {
              setMenuVisibleBookId(null);
              handleDeleteBook(item.book_id, item.title);
            }}
            title="本を削除"
            leadingIcon="trash-can"
            titleStyle={MENU_ITEM_TITLE_STYLE}
          />
        </Menu>
      </View>
    </Animated.View>
  </Swipeable>
  ));

  const renderItem = (params: RenderItemParams<Book>) => (
    <BookItem {...params} />
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
          <Text style={homeStyles.screenCaption}>ノート一覧</Text>
          <View ref={settingsIconWrapRef} collapsable={false}>
            <TouchableOpacity
              onPress={() => {
                if (settingsMenuVisible) {
                  setSettingsMenuVisible(false);
                  return;
                }
                openSettingsMenu();
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="settings-outline" size={commonStyle.screenWidth / 13} color="#6B6258" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={homeStyles.listHeaderDescription}>
            全 {bookData.length} 冊 ・ 追加 / 並び替え / 管理
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Wordbook')}
            style={[homeStyles.wordbookQuickBtn, showHelpOverlay && localStyles.wordbookQuickBtnHelpMode]}
          >
            <Ionicons name="albums-outline" size={16} color={showHelpOverlay ? '#4E4034' : '#FFFFFF'} />
            <Text style={[homeStyles.wordbookQuickBtnText, showHelpOverlay && localStyles.wordbookQuickBtnTextHelpMode]}>単語帳へ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DraggableFlatList
        ref={flatListRef}
        data={bookData}
        keyExtractor={(item) => item.book_id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          isDraggingRef.current = true;
          // data の order_index を先に正しく修正してから setBookData に渡す
          // これにより、useEffect で state.books と完全に同じ内容になり、
          // 不要な setBookData が呼ばれるのを防ぐ
          const correctedData = data.map((book, index) => ({
            ...book,
            order_index: index,
          }));
          // UI を即座に更新
          setBookData(correctedData);
          // DB を非同期で更新
          reorderBooks(data).finally(() => {
            // reorderBooks が完了したら、useEffect を再度有効化
            isDraggingRef.current = false;
          });
        }}
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

      <TouchableOpacity
        onPress={() => setShowHelpOverlay((prev) => !prev)}
        style={homeStyles.manualBtn}
      >
        <Ionicons
          name={showHelpOverlay ? 'help-circle' : 'help-circle-outline'}
          size={commonStyle.screenWidth / 15}
          color="white"
        />
      </TouchableOpacity>

      {showHelpOverlay && (
        <TouchableWithoutFeedback onPress={() => setShowHelpOverlay(false)}>
          <View style={localStyles.helpOverlay} pointerEvents="auto">

          <View style={[localStyles.helpBubble, { top: 94, right: 12, maxWidth: commonStyle.screenWidth * 0.45 }]}> 
            <Text style={localStyles.helpTitle}>設定アイコン</Text>
            <Text style={localStyles.helpText}>ライセンス情報確認</Text>
          </View>

          <View style={[localStyles.helpBubble, { top: 164, right: 12, maxWidth: commonStyle.screenWidth * 0.45 }]}> 
            <Text style={localStyles.helpTitle}>単語帳へ</Text>
            <Text style={localStyles.helpText}>ノートに追加した単語帳</Text>
          </View>

          <View style={[localStyles.helpBubble, { top: 248, right: 12, maxWidth: commonStyle.screenWidth * 0.56 }]}> 
            <Text style={localStyles.helpTitle}>本のメニュー</Text>
            <Text style={localStyles.helpText}>名前を変更/削除</Text>
          </View>

          <View style={[localStyles.helpBubble, { bottom: commonStyle.screenHeight * 0.13, left: 18, maxWidth: commonStyle.screenWidth * 0.5 }]}> 
            <Text style={localStyles.helpTitle}>はてなボタン</Text>
            <Text style={localStyles.helpText}>説明表示の切り替え。</Text>
          </View>

          <View style={[localStyles.helpBubble, { bottom: commonStyle.screenHeight * 0.11, right: 18, maxWidth: commonStyle.screenWidth * 0.48 }]}> 
            <Text style={localStyles.helpTitle}>追加ボタン</Text>
            <Text style={localStyles.helpText}>新しい本を作成。</Text>
          </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      <TouchableOpacity
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

      {settingsMenuVisible && (() => {
        const SETTINGS_CARD_WIDTH = 180;
        const left = Math.min(
          Math.max(8, settingsAnchor.x + settingsAnchor.width - SETTINGS_CARD_WIDTH),
          commonStyle.screenWidth - SETTINGS_CARD_WIDTH - 8
        );
        const top = settingsAnchor.y + settingsAnchor.height + 6;

        return (
          <View style={localStyles.settingsOverlay} pointerEvents="box-none">
            <TouchableWithoutFeedback onPress={() => setSettingsMenuVisible(false)}>
              <View style={localStyles.settingsBackdrop} />
            </TouchableWithoutFeedback>
            <View style={[localStyles.settingsCard, { width: SETTINGS_CARD_WIDTH, left, top }]}> 
              <TouchableOpacity
                style={localStyles.settingsItem}
                onPress={() => {
                  navigation.navigate('License');
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color="#6B6258" />
                <Text style={localStyles.settingsItemText}>ライセンス情報</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

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
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  settingsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  settingsCard: {
    position: 'absolute',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingsItemText: {
    fontSize: 14,
    color: '#4E4034',
    fontWeight: '600',
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
  swipeDeleteButton: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
