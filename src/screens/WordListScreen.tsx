import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useLibrary } from '../context/LibraryContext';
import { Content, useEditor, Word } from '../context/EditorContext';

type WordRow = {
  key: string;
  wordId: string;
  bookId: string;
  bookTitle: string;
  page: number;
  order: number;
  word: string;
  meaning: string;
  isSaved: boolean;
};

const WordListScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { state: libraryState } = useLibrary();
  const { select } = useEditor();

  const [rows, setRows] = useState<WordRow[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '単語リスト',
      headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#342C24' },
      headerStyle: { backgroundColor: '#E9DCCD' },
      headerShadowVisible: false,
      headerTintColor: '#342C24',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 100, paddingHorizontal: 6, marginLeft: 4 }}
        >
          <Ionicons name="chevron-back" size={24} color="#342C24" />
        </TouchableOpacity>
      ),
      headerRightContainerStyle: { paddingRight: 10 },
    });
  }, [navigation, showHelpOverlay]);

  const loadRows = useCallback(async () => {
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

    const merged: WordRow[] = words
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
          isSaved: (w.review_flag ?? 0) === 1,
        };
      })
      .filter((v): v is WordRow => Boolean(v))
      .sort((a, b) => {
        const bookCmp = (bookOrder.get(a.bookId) ?? 0) - (bookOrder.get(b.bookId) ?? 0);
        if (bookCmp !== 0) return bookCmp;
        if (a.page !== b.page) return a.page - b.page;
        return a.order - b.order;
      });

    setRows(merged);
  }, [libraryState.books, select]);

  useFocusEffect(
    useCallback(() => {
      void loadRows();
      return () => {
        setShowHelpOverlay(false);
      };
    }, [loadRows])
  );

  const filteredRows = useMemo(() => {
    let next = rows;
    if (selectedBookId !== 'all') {
      next = next.filter((r) => r.bookId === selectedBookId);
    }
    if (savedOnly) {
      next = next.filter((r) => r.isSaved);
    }
    return next;
  }, [rows, selectedBookId, savedOnly]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5EFE6', paddingHorizontal: 16, paddingTop: 10 }}>
      {showHelpOverlay && (
        <TouchableWithoutFeedback onPress={() => setShowHelpOverlay(false)}>
          <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(39, 30, 22, 0.14)' }}>
            <View style={{ position: 'absolute', top: 18, right: 16, maxWidth: '52%', backgroundColor: 'rgba(255, 253, 249, 0.99)', borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCAB4', paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: '#3E3125', fontWeight: '700', marginBottom: 4 }}>表示条件</Text>
              <Text style={{ fontSize: 12, color: '#4E4034', lineHeight: 17 }}>すべて/保存のみを切り替えできます。</Text>
            </View>
            <View style={{ position: 'absolute', top: 96, left: 16, maxWidth: '56%', backgroundColor: 'rgba(255, 253, 249, 0.99)', borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCAB4', paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: '#3E3125', fontWeight: '700', marginBottom: 4 }}>本の選択</Text>
              <Text style={{ fontSize: 12, color: '#4E4034', lineHeight: 17 }}>一問一答と同じように対象の本を選べます。</Text>
            </View>
            <View style={{ position: 'absolute', top: 220, right: 16, maxWidth: '62%', backgroundColor: 'rgba(255, 253, 249, 0.99)', borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCAB4', paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: '#3E3125', fontWeight: '700', marginBottom: 4 }}>単語リスト</Text>
              <Text style={{ fontSize: 12, color: '#4E4034', lineHeight: 17 }}>行をタップすると該当ページへ移動します。</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      <View style={{ height: 40, justifyContent: 'center', marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 10, alignItems: 'center', paddingRight: 8 }}
        >
          <TouchableOpacity
            onPress={() => setSelectedBookId('all')}
            style={{
              borderRadius: 999,
              height: 30,
              paddingHorizontal: 10,
              justifyContent: 'center',
              backgroundColor: selectedBookId === 'all' ? '#6A523B' : '#E5D7C7',
            }}
          >
            <Text style={{ fontSize: 14, color: selectedBookId === 'all' ? '#FFFFFF' : '#4C4138', fontWeight: '700' }} numberOfLines={1}>
              すべてのノート
            </Text>
          </TouchableOpacity>
          {libraryState.books.map((b) => (
            <TouchableOpacity
              key={b.book_id}
              onPress={() => setSelectedBookId(b.book_id)}
              style={{
                borderRadius: 999,
                height: 30,
                maxWidth: 180,
                paddingHorizontal: 10,
                justifyContent: 'center',
                backgroundColor: selectedBookId === b.book_id ? '#6A523B' : '#E5D7C7',
              }}
            >
              <Text style={{ fontSize: 14, color: selectedBookId === b.book_id ? '#FFFFFF' : '#4C4138', fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
                {b.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
        <Text style={{ color: '#5A4D42', fontWeight: '700' }}>全 {filteredRows.length} 件</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 999,
            backgroundColor: '#F4D4B8',
            padding: 3,
            gap: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => setSavedOnly(false)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: !savedOnly ? '#A15A2E' : 'transparent',
            }}
          >
            <Text style={{ color: !savedOnly ? '#FFFFFF' : '#6E4423', fontWeight: '700', fontSize: 12 }}>すべて</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSavedOnly(true)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: savedOnly ? '#A15A2E' : 'transparent',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons
                name={savedOnly ? 'bookmark' : 'bookmark-outline'}
                size={13}
                color={savedOnly ? '#FFFFFF' : '#6E4423'}
              />
              <Text style={{ color: savedOnly ? '#FFFFFF' : '#6E4423', fontWeight: '700', fontSize: 12 }}>保存のみ</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {filteredRows.length === 0 ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#D6C5B2',
            backgroundColor: '#FFF9F2',
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, color: '#55493F', fontWeight: '700' }}>表示できる単語がありません</Text>
          <Text style={{ marginTop: 6, color: '#7A6C60' }}>ノートに単語を追加すると、ここに表示されます。</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#EADCCB',
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderWidth: 1,
                borderColor: '#D4C3AF',
              }}
            >
              <Text style={{ flex: 1, padding: 10, fontWeight: '700', color: '#3E332A' }}>単語</Text>
              <Text style={{ flex: 3, padding: 10, fontWeight: '700', color: '#3E332A' }}>意味</Text>
            </View>

            {filteredRows.map((row, index) => (
              <TouchableOpacity
                key={row.key}
                activeOpacity={0.78}
                onPress={() => navigation.navigate('Notebook', { bookId: row.bookId, initialPage: row.page, source: 'wordbook' })}
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderTopWidth: 0,
                  borderColor: '#E1D2C3',
                  backgroundColor: index % 2 === 0 ? '#FFFCF8' : '#FCF6EE',
                }}
              >
                <Text style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 10, color: '#3E332A', lineHeight: 20, flexWrap: 'wrap' }}>
                  {row.word || '---'}
                </Text>
                <Text style={{ flex: 3, paddingHorizontal: 10, paddingVertical: 10, color: '#3E332A', lineHeight: 20, flexWrap: 'wrap' }}>
                  {row.meaning || '---'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default WordListScreen;
