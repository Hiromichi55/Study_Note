import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, PanResponder } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { useEditor, Content, Word } from '../context/EditorContext';
import { RootStackParamList } from '../App';
import { StackNavigationProp } from '@react-navigation/stack';


type QuizMode = 'hideWord' | 'hideMeaning';
type OrderMode = 'sequential' | 'random';
type FilterMode = 'all' | 'flagged' | 'unflagged';

type WordCard = {
  key: string;
  wordId: string;
  bookId: string;
  bookTitle: string;
  page: number;
  order: number;
  word: string;
  meaning: string;
};

const WordbookScreen: React.FC = () => {
  const { state: libraryState } = useLibrary();
  const { select, updateWord } = useEditor();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '単語帳',
      headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#342C24' },
      headerStyle: { backgroundColor: '#E9DCCD' },
      headerShadowVisible: false,
      headerTintColor: '#342C24',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 }}
        >
          <Ionicons name="chevron-back" size={24} color="#342C24" />
          <Text style={{ fontSize: 17, color: '#342C24' }}>ノート一覧</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const [allCards, setAllCards] = useState<WordCard[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState<QuizMode>('hideWord');
  const [orderMode, setOrderMode] = useState<OrderMode>('sequential');
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [flaggedCards, setFlaggedCards] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const loadCards = useCallback(async () => {
    const [contents, words] = await Promise.all([
      select<Content>('contents'),
      select<Word>('words'),
    ]);

    const contentMap = new Map<string, Content>();
    contents.forEach((c) => contentMap.set(c.content_id, c));

    const bookOrder = new Map<string, number>();
    const bookTitle = new Map<string, string>();
    libraryState.books.forEach((b) => {
      bookOrder.set(b.book_id, b.order_index ?? 0);
      bookTitle.set(b.book_id, b.title);
    });

    const merged: WordCard[] = words
      .map((w) => {
        const content = contentMap.get(w.content_id);
        if (!content) return null;
        return {
          key: `${content.book_id}-${content.page}-${w.word_order}-${w.word_id}`,
          wordId: w.word_id,
          bookId: content.book_id,
          bookTitle: bookTitle.get(content.book_id) ?? '無題ノート',
          page: content.page,
          order: w.word_order,
          word: w.word,
          meaning: w.explanation,
        };
      })
      .filter((v): v is WordCard => Boolean(v))
      .sort((a, b) => {
        const bookCmp = (bookOrder.get(a.bookId) ?? 0) - (bookOrder.get(b.bookId) ?? 0);
        if (bookCmp !== 0) return bookCmp;
        if (a.page !== b.page) return a.page - b.page;
        return a.order - b.order;
      });

    setAllCards(merged);
    setFlaggedCards(new Set(words.filter((w) => (w.review_flag ?? 0) === 1).map((w) => w.word_id)));
    setRevealed(false);
  }, [libraryState.books, select]);

  useFocusEffect(
    useCallback(() => {
      void loadCards();
    }, [loadCards])
  );

  const cards = useMemo(() => {
    let filtered = allCards;
    if (selectedBookId !== 'all') {
      filtered = filtered.filter((c) => c.bookId === selectedBookId);
    }
    if (filterMode === 'flagged') {
      filtered = filtered.filter((c) => flaggedCards.has(c.wordId));
    } else if (filterMode === 'unflagged') {
      filtered = filtered.filter((c) => !flaggedCards.has(c.wordId));
    }
    return filtered;
  }, [allCards, selectedBookId, filterMode, flaggedCards]);

  const displayCards = useMemo(() => {
    if (orderMode === 'sequential') return cards;
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [cards, orderMode, shuffleNonce]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dy) >= 32 || displayCards.length === 0) return;
          if (gestureState.dx > 56) {
            setCurrent((prev) => Math.max(0, prev - 1));
            setRevealed(false);
          } else if (gestureState.dx < -56) {
            setCurrent((prev) => Math.min(displayCards.length - 1, prev + 1));
            setRevealed(false);
          }
        },
      }),
    [displayCards.length]
  );

  const safeCurrent = displayCards.length === 0 ? 0 : Math.min(current, displayCards.length - 1);
  const currentCard = displayCards[safeCurrent] ?? null;

  const selectedBook = useMemo(() => {
    if (selectedBookId === 'all') return null;
    return libraryState.books.find((b) => b.book_id === selectedBookId) ?? null;
  }, [libraryState.books, selectedBookId]);

  React.useEffect(() => {
    setCurrent(0);
    setRevealed(false);
  }, [selectedBookId]);

  React.useEffect(() => {
    setCurrent(0);
    setRevealed(false);
  }, [orderMode, shuffleNonce]);

  React.useEffect(() => {
    setCurrent((prev) => {
      if (displayCards.length === 0) return 0;
      return Math.min(prev, displayCards.length - 1);
    });
  }, [displayCards.length]);

  const promptText = useMemo(() => {
    if (!currentCard) return '';
    return mode === 'hideWord' ? (currentCard.meaning || '---') : (currentCard.word || 'ー');
  }, [currentCard, mode]);

  const answerText = useMemo(() => {
    if (!currentCard) return '';
    return mode === 'hideWord' ? (currentCard.word || '---') : (currentCard.meaning || 'ー');
  }, [currentCard, mode]);

  const move = (delta: number) => {
    if (displayCards.length === 0) return;
    const next = Math.max(0, Math.min(displayCards.length - 1, current + delta));
    setCurrent(next);
    setRevealed(false);
  };

  const toggleFlag = async () => {
    if (!currentCard) return;
    const newFlagged = new Set(flaggedCards);
    const isFlagged = newFlagged.has(currentCard.wordId);
    if (isFlagged) {
      newFlagged.delete(currentCard.wordId);
    } else {
      newFlagged.add(currentCard.wordId);
    }
    try {
      await updateWord(currentCard.wordId, { review_flag: isFlagged ? 0 : 1 });
    } catch (err) {
      // Keep UI stable if DB update fails
      console.warn('Failed to update review_flag:', err);
      return;
    }
    setFlaggedCards(newFlagged);
    setRevealed(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5EFE6', padding: 16 }} {...panResponder.panHandlers}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 50, marginBottom: 6 }}
        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
      >
        <TouchableOpacity
          onPress={() => setSelectedBookId('all')}
          style={{
            borderRadius: 999,
            height: 34,
            paddingHorizontal: 12,
            justifyContent: 'center',
            backgroundColor: selectedBookId === 'all' ? '#6A523B' : '#E5D7C7',
          }}
        >
          <Text style={{ color: selectedBookId === 'all' ? '#FFFFFF' : '#4C4138', fontWeight: '700' }} numberOfLines={1}>
            すべての本
          </Text>
        </TouchableOpacity>
        {libraryState.books.map((b) => (
          <TouchableOpacity
            key={b.book_id}
            onPress={() => setSelectedBookId(b.book_id)}
            style={{
              borderRadius: 999,
              height: 34,
              maxWidth: 160,
              paddingHorizontal: 12,
              justifyContent: 'center',
              backgroundColor: selectedBookId === b.book_id ? '#6A523B' : '#E5D7C7',
            }}
          >
            <Text style={{ color: selectedBookId === b.book_id ? '#FFFFFF' : '#4C4138', fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
              {b.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {displayCards.length === 0 ? (
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#D6C5B2',
            backgroundColor: '#FFF9F2',
            padding: 16,
            minHeight: 260,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: '#55493F' }}>単語がありません</Text>
          <Text style={{ marginTop: 8, color: '#7A6C60' }}>対象の本に単語要素を追加すると、ここに反映されます。</Text>
        </View>
      ) : (
        <>
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#D6C5B2',
              backgroundColor: '#FFF9F2',
              padding: 16,
              minHeight: 260,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#7D7064' }}>問題</Text>
              <TouchableOpacity
                onPress={toggleFlag}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: currentCard && flaggedCards.has(currentCard.wordId) ? '#D4A574' : '#D9CEC2',
                  backgroundColor: currentCard && flaggedCards.has(currentCard.wordId) ? '#F5E6D3' : '#EFEBE8',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Ionicons
                  name={currentCard && flaggedCards.has(currentCard.wordId) ? 'flag' : 'flag-outline'}
                  size={14}
                  color={currentCard && flaggedCards.has(currentCard.wordId) ? '#C17B3B' : '#8B7355'}
                />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 24, color: '#3E332A', marginTop: 0, marginBottom: 20 }}>{promptText}</Text>

            <Text style={{ fontSize: 14, color: '#7D7064' }}>答え</Text>
            <TouchableOpacity
              onPress={() => setRevealed((v) => !v)}
              activeOpacity={0.85}
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E1D2C3',
                backgroundColor: '#FCF6EE',
                padding: 12,
                minHeight: 72,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, color: '#3E332A' }}>{revealed ? answerText : 'タップして表示'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Notebook', { bookId: currentCard.bookId, initialPage: currentCard.page, source: 'wordbook' })}
              style={{
                marginTop: 10,
                alignSelf: 'flex-end',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#D2C1AE',
                backgroundColor: '#F7EDE2',
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Ionicons name="open-outline" size={14} color="#6E6258" />
              <Text style={{ color: '#6E6258', fontSize: 12 }}>
                {currentCard.bookTitle} / {currentCard.page + 1}ページ / {currentCard.order + 1}行目
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => move(-1)}
          disabled={displayCards.length === 0 || current === 0}
          style={{
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: displayCards.length === 0 || current === 0 ? '#D9CEC2' : '#8A6A52',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>前へ</Text>
        </TouchableOpacity>

        <Text style={{ color: '#5A4D42', fontWeight: '700' }}>
          {displayCards.length === 0 ? '0 / 0' : `${safeCurrent + 1} / ${displayCards.length}`}
        </Text>

        <TouchableOpacity
          onPress={() => move(1)}
          disabled={displayCards.length === 0 || safeCurrent === displayCards.length - 1}
          style={{
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: displayCards.length === 0 || safeCurrent === displayCards.length - 1 ? '#D9CEC2' : '#8A6A52',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>次へ</Text>
        </TouchableOpacity>
      </View>

      {/* セパレーター */}
      <View style={{ height: 1, backgroundColor: '#E0D5CB', marginTop: 16, marginBottom: 12 }} />

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#D8C4B3',
          backgroundColor: '#F9EDE0',
          padding: 10,
          marginTop: 0,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5A3C', marginBottom: 6 }}>復習フィルター</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setFilterMode('all')}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: filterMode === 'all' ? '#A15A2E' : '#F4D4B8',
            }}
          >
            <Text style={{ color: filterMode === 'all' ? '#FFFFFF' : '#6E4423', fontWeight: '700' }}>すべて</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterMode('flagged')}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: filterMode === 'flagged' ? '#A15A2E' : '#F4D4B8',
            }}
          >
            <Text style={{ color: filterMode === 'flagged' ? '#FFFFFF' : '#6E4423', fontWeight: '700' }}>フラグのみ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterMode('unflagged')}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: filterMode === 'unflagged' ? '#A15A2E' : '#F4D4B8',
            }}
          >
            <Text style={{ color: filterMode === 'unflagged' ? '#FFFFFF' : '#6E4423', fontWeight: '700' }}>未フラグ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#C4D9E8',
          backgroundColor: '#EEF5FF',
          padding: 10,
          marginTop: 0,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#4A6B92', marginBottom: 6 }}>出題形式</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setMode('hideWord');
              setRevealed(false);
            }}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: mode === 'hideWord' ? '#4A6B92' : '#E2ECF7',
            }}
          >
            <Text style={{ color: mode === 'hideWord' ? '#FFFFFF' : '#2C4563', fontWeight: '700' }}>単語を答える</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setMode('hideMeaning');
              setRevealed(false);
            }}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: mode === 'hideMeaning' ? '#4A6B92' : '#E2ECF7',
            }}
          >
            <Text style={{ color: mode === 'hideMeaning' ? '#FFFFFF' : '#2C4563', fontWeight: '700' }}>意味を答える</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#C7D7C3',
          backgroundColor: '#EDF4EA',
          padding: 10,
          marginTop: 0,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#587055', marginBottom: 6 }}>出題順</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setOrderMode('sequential')}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: orderMode === 'sequential' ? '#4F6A4D' : '#D9E8D4',
            }}
          >
            <Text style={{ color: orderMode === 'sequential' ? '#FFFFFF' : '#355033', fontWeight: '700' }}>順番</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOrderMode('random')}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: orderMode === 'random' ? '#4F6A4D' : '#D9E8D4',
            }}
          >
            <Text style={{ color: orderMode === 'random' ? '#FFFFFF' : '#355033', fontWeight: '700' }}>ランダム</Text>
          </TouchableOpacity>
        </View>
      </View>

      {orderMode === 'random' && (
        <TouchableOpacity
          onPress={() => setShuffleNonce((v) => v + 1)}
          style={{
            alignSelf: 'flex-end',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: '#EADCCB',
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#4C4138', fontWeight: '700' }}>再シャッフル</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default WordbookScreen;
