// ==========================================
// NoteContent.tsx
// ==========================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Dimensions, StyleSheet, TextInput, TouchableOpacity, Keyboard, Platform, Animated, ScrollView } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { useHeaderHeight } from '@react-navigation/elements';
import { ENV } from '@config';

const IS_DEV = ENV.SCREEN_DEV;

const { width, height } = Dimensions.get('window');

// ノート罫線パラメータ
const space = 0.03;
const interval = 30;
const upperSpace = 2;
const RULE_COLOR = 'rgba(196, 204, 218, 1)';

export type NoteElement =
  | { type: 'chapter'; text: string }
  | { type: 'section'; text: string }
  | { type: 'subsection'; text: string }
  | { type: 'text'; text: string }
  | { type: 'word'; word: string; meaning: string }
  | { type: 'image'; uri: string };

type NoteElementType = NoteElement['type'];

const FONT_MAP: Record<NoteElementType, { size: number; lineHeight: number }> = {
  chapter: { size: 24, lineHeight: interval },
  section: { size: 20, lineHeight: interval },
  subsection: { size: 16, lineHeight: interval },
  text: { size: 14, lineHeight: interval },
  word: { size: 14, lineHeight: interval },
  image: { size: 0, lineHeight: interval },
};

const COLOR_MAP = {
  red: '#B26260',
  pink: '#B25F87',
  yellow: '#BBA859',
  green: '#6DA055',
  blue: '#4B8ABA',
  cyan: '#55A99F',
  black: '#333333',
} as const;

type Props = {
  onPress?: () => void;
  children?: React.ReactNode;
  backgroundColor?: keyof typeof COLOR_MAP;
  elements?: NoteElement[];
  onNoteLayout?: (bounds: { x: number; y: number; width: number; height: number }) => void;
  /** called when a background image file is generated and saved; receives the file URI */
  onBackgroundGenerated?: (uri: string) => void | Promise<void>;
  /** 編集モード */
  isEditing?: boolean;
  /** 要素の内容変更コールバック */
  onElementChange?: (index: number, newElement: NoteElement) => void;
  /** 要素の削除コールバック */
  onDeleteElement?: (index: number) => void;
  /** 空行タップ時のコールバック（要素追加トリガー） */
  onTapEmpty?: (afterIndex: number) => void;
  /** 非編集モードで行をタップして編集開始するコールバック */
  onEditStart?: (index: number) => void;
  /** 編集開始時にフォーカスする要素インデックス */
  initialFocusIndex?: number;
};

const NoteContent: React.FC<Props> = ({ children, backgroundColor, elements, onNoteLayout, onBackgroundGenerated, isEditing, onElementChange, onDeleteElement, onTapEmpty, onEditStart, initialFocusIndex }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const headerHeight = useHeaderHeight();
  // キーボードリスナー内で最新値を参照するためのref
  const activeIndexRef = useRef<number | null>(null);
  const elementsRef = useRef<NoteElement[] | undefined>(undefined);
  activeIndexRef.current = activeIndex;
  elementsRef.current = elements;

  const TOOLBAR_TYPES: { label: string; type: NoteElement['type'] }[] = [
    { label: '文章', type: 'text' },
    { label: '章', type: 'chapter' },
    { label: '節', type: 'section' },
    { label: '項', type: 'subsection' },
    { label: '単語', type: 'word' },
    { label: '画像', type: 'image' },
  ];

  const noteX = width * 0.01;
  const noteY = height * 0;
  const noteWidth = width * 0.98;
  const noteHeight = (height - headerHeight) * 0.87;
  const bottomMargin = Math.round((height - headerHeight) * 0.13);

  // 1画面に収まる最大行数（upperSpace 分のタイトル行を除く）
  const maxRows = Math.max(1, Math.floor((noteHeight - upperSpace * interval) / interval));

  // 要素1つの表示高さを返す
  const getElementHeight = (el: NoteElement): number => {
    const font = FONT_MAP[el.type];
    if (el.type === 'image') return 200;
    const contentWidth = noteWidth * (1 - 2 * space);
    if (el.type === 'word') {
      const lw = contentWidth * 0.25 - 12;
      const rw = contentWidth * 0.75 - 12;
      const ll = Math.ceil((el.word || '').length / Math.max(6, Math.floor(lw / Math.max(1, font.size))));
      const rl = Math.ceil(((el as any).meaning || '').length / Math.max(6, Math.floor(rw / Math.max(1, font.size))));
      const rawH = Math.max(ll, rl) * font.lineHeight + 8;
      return Math.max(font.lineHeight, Math.ceil(rawH / font.lineHeight) * font.lineHeight);
    }
    const text = 'text' in el ? el.text : '';
    const cpp = Math.max(10, Math.floor(contentWidth / Math.max(1, font.size)));
    return Math.max(font.lineHeight, Math.max(1, Math.ceil(text.length / cpp)) * font.lineHeight);
  };

  // アクティブ要素のY位置（ScrollView内）を計算するヘルパー
  const getActiveElementY = (curIdx: number | null, curElements: NoteElement[] | undefined): number => {
    if (curIdx === null || !curElements) return noteHeight; // 不明なら最下部扱い
    let y = upperSpace * interval;
    for (let i = 0; i < curIdx && i < curElements.length; i++) {
      y += getElementHeight(curElements[i]);
    }
    return y;
  };

  useEffect(() => {
    const onShow = (e: any) => {
      const kbH = e?.endCoordinates?.height ?? 0;
      setKeyboardVisible(true);
      setKeyboardHeight(kbH);

      // キーボードで隠れるノート下部の高さ（bottomMargin を超えた分）
      const coveredByKb = Math.max(0, kbH - bottomMargin);
      // キーボードが出ている状態でのノート可視高さ
      const visibleHeight = noteHeight - coveredByKb;

      // アクティブ要素のY位置（ScrollView 内座標）
      const elementY = getActiveElementY(activeIndexRef.current, elementsRef.current);

      // 要素がキーボードで隠れる場合だけスクロール
      // 要素がvisibleHeightの下端より下にある場合のみスクロールが必要
      const scrollY = Math.max(0, elementY - visibleHeight + 2 * interval);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
      }, 150);
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      // キーボード非表示時はスクロール位置をトップに戻す
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    };
    const showSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', onShow)
      : Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', onHide)
      : Keyboard.addListener('keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // isEditing が false になったときもスクロールリセット（キーボードが既に閉じている場合の保険）
  useEffect(() => {
    if (!isEditing) {
      setActiveIndex(null);
      // スライドアニメ完了を待ってからリセット（200ms＋余裕）
      const t = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  // 編集モード開始時に initialFocusIndex の要素にフォーカス
  useEffect(() => {
    if (isEditing && initialFocusIndex !== undefined && initialFocusIndex !== null) {
      setActiveIndex(initialFocusIndex);
      // レンダリング後にフォーカス
      setTimeout(() => focusElementInput(initialFocusIndex), 50);
    }
  }, [isEditing, initialFocusIndex]);

  // フォーカス行が変わったときにスクロール調整（キーボード表示中のみ）
  useEffect(() => {
    if (activeIndex === null || !keyboardVisible || !isEditing || !elements) return;
    const coveredByKb = Math.max(0, keyboardHeight - bottomMargin);
    const visibleHeight = noteHeight - coveredByKb;
    const yOffset = getActiveElementY(activeIndex, elements);
    const scrollY = Math.max(0, yOffset - visibleHeight + 2 * interval);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
    }, 100);
  }, [activeIndex, keyboardVisible]);

  const getInputKey = (index: number, field: 'main' | 'word' | 'meaning' = 'main') => `${index}:${field}`;

  const focusElementInput = (index: number) => {
    const target = elements?.[index];
    if (!target) return;

    const key = target.type === 'word' ? getInputKey(index, 'word') : getInputKey(index, 'main');
    const ref = inputRefs.current[key];
    if (!ref) return;

    setTimeout(() => ref.focus(), 0);
  };

  const focusNextElement = (index: number) => {
    if (!elements) return;
    for (let i = index + 1; i < elements.length; i++) {
      if (elements[i].type === 'image') continue;
      setActiveIndex(i);
      focusElementInput(i);
      return;
    }
    // 末尾でも maxRows に達していなければ新しい行を追加
    if (elements.length < maxRows) {
      onTapEmpty?.(index + 1);
      setTimeout(() => {
        const nextIndex = index + 1;
        setActiveIndex(nextIndex);
        focusElementInput(nextIndex);
      }, 0);
    }
    // maxRows を超える場合は何もしない（上限に達しているため）
  };

  const convertElementType = (el: NoteElement, type: NoteElement['type']): NoteElement => {
    if (type === 'image') {
      return { type: 'image', uri: el.type === 'image' ? el.uri : '' };
    }
    if (type === 'word') {
      if (el.type === 'word') return el;
      if (el.type === 'image') return { type: 'word', word: '', meaning: '' };
      return { type: 'word', word: el.text || '', meaning: '' };
    }
    if (el.type === 'image') {
      return { type, text: '' } as NoteElement;
    }
    if (el.type === 'word') {
      return { type, text: [el.word, el.meaning].filter(Boolean).join(' ') } as NoteElement;
    }
    return { type, text: el.text || '' } as NoteElement;
  };

  const handleTypeChange = (type: NoteElement['type']) => {
    if (activeIndex === null || !elements?.[activeIndex]) return;
    const current = elements[activeIndex];
    if (current.type === type) return;

    const converted = convertElementType(current, type);
    onElementChange?.(activeIndex, converted);
    setTimeout(() => {
      if (type !== 'image') focusElementInput(activeIndex);
    }, 0);
  };

  const handleInputWithEnter = (
    value: string,
    index: number,
    apply: (nextValue: string) => void
  ) => {
    if (!value.includes('\n')) {
      apply(value);
      return;
    }

    const cleaned = value.replace(/\n/g, '');
    apply(cleaned);
    focusNextElement(index);
  };

  // ===================================================
  //  要素レンダリング（通常フロー）
  // ===================================================
  const renderElements = () => {
    const rendered: React.ReactElement[] = [];

    // ── エレメントが存在する行 ──
    (elements ?? []).forEach((el, idx) => {
      const font = FONT_MAP[el.type];
      const estHeight = getElementHeight(el);

      const debugStyle = IS_DEV
        ? { backgroundColor: 'rgba(255,0,0,0.15)', borderWidth: 1, borderColor: 'red' }
        : {};

      if (el.type === 'image') {
        rendered.push(
          <View
            key={idx}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => {
              if (!isEditing) {
                onEditStart?.(idx);
                return;
              }
              setActiveIndex(idx);
            }}
            style={{
              height: 200,
              borderBottomWidth: 1,
              borderBottomColor: RULE_COLOR,
              borderWidth: isEditing && activeIndex === idx ? 2 : 0,
              borderColor: '#007AFF',
              ...debugStyle,
            }}
          >
            <Image source={{ uri: el.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        );
        return;
      }

      if (el.type === 'word') {
        const colLeftRatio = 0.25;
        const colLeftWidth = colLeftRatio * 100 + '%' as any;
        const colRightWidth = (1 - colLeftRatio) * 100 + '%' as any;
        rendered.push(
          <View
            key={idx}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => {
              if (!isEditing) {
                onEditStart?.(idx);
                return;
              }
              setActiveIndex(idx);
            }}
            style={{
              height: estHeight,
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: RULE_COLOR,
              backgroundColor: isEditing && activeIndex === idx ? 'rgba(0,122,255,0.08)' : 'transparent',
              alignItems: 'stretch',
              ...debugStyle,
            }}
          >
            <View style={{ width: colLeftWidth, height: '100%', paddingHorizontal: 6, paddingVertical: 4, borderRightWidth: 1, borderRightColor: RULE_COLOR }}>
              {isEditing ? (
                <TextInput
                  value={el.word}
                  onChangeText={(t) =>
                    handleInputWithEnter(t, idx, (next) => onElementChange?.(idx, { ...el, word: next }))
                  }
                  ref={(ref) => { inputRefs.current[getInputKey(idx, 'word')] = ref; }}
                  onFocus={() => setActiveIndex(idx)}
                  style={{ fontSize: font.size, lineHeight: font.lineHeight, width: '100%', padding: 0 }}
                  multiline
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextElement(idx)}
                  placeholder="単語"
                />
              ) : (
                <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{el.word}</Text>
              )}
            </View>
            <View style={{ flex: 1, height: '100%', paddingHorizontal: 6, paddingVertical: 4, justifyContent: 'flex-start' }}>
              {isEditing ? (
                <TextInput
                  value={(el as any).meaning}
                  onChangeText={(t) =>
                    handleInputWithEnter(t, idx, (next) => onElementChange?.(idx, { ...el, meaning: next } as any))
                  }
                  ref={(ref) => { inputRefs.current[getInputKey(idx, 'meaning')] = ref; }}
                  onFocus={() => setActiveIndex(idx)}
                  style={{ fontSize: font.size, lineHeight: font.lineHeight, width: '100%', padding: 0 }}
                  multiline
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextElement(idx)}
                  placeholder="説明"
                />
              ) : (
                <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{(el as any).meaning}</Text>
              )}
            </View>
          </View>
        );
        return;
      }

      // text / chapter / section / subsection
      rendered.push(
        <View
          key={idx}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => {
            if (!isEditing) {
              onEditStart?.(idx);
              return;
            }
            setActiveIndex(idx);
            focusElementInput(idx);
          }}
          style={{
            height: estHeight,
            justifyContent: 'center',
            borderBottomWidth: 1,
            borderBottomColor: RULE_COLOR,
            backgroundColor: isEditing && activeIndex === idx ? 'rgba(0,122,255,0.08)' : 'transparent',
            ...debugStyle,
          }}
        >
          {isEditing ? (
            <TextInput
              value={'text' in el ? el.text : (el as any).text || ''}
              onChangeText={(t) =>
                handleInputWithEnter(t, idx, (next) => onElementChange?.(idx, { ...el, text: next } as any))
              }
              ref={(ref) => { inputRefs.current[getInputKey(idx, 'main')] = ref; }}
              onFocus={() => setActiveIndex(idx)}
              style={{
                fontSize: font.size,
                lineHeight: font.lineHeight,
                fontFamily: 'piroji',
                width: '90%',
                padding: 0,
                includeFontPadding: false,
              }}
              multiline
              blurOnSubmit={false}
              submitBehavior="submit"
              returnKeyType="next"
              onSubmitEditing={() => focusNextElement(idx)}
            />
          ) : (
            <Text
              style={{
                fontSize: font.size,
                lineHeight: font.lineHeight,
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              {'text' in el ? el.text : (el as any).text || ''}
            </Text>
          )}
        </View>
      );
      return;
    });

    // 末尾に残り行分の罫線を常に追加（maxRowsを超えない範囲で）
    const currentCount = elements?.length ?? 0;
    const remaining = Math.max(0, maxRows - currentCount);
    for (let i = 0; i < remaining; i++) {
      rendered.push(
        <TouchableOpacity
          key={`empty-tap-${i}`}
          style={{ height: interval, borderBottomWidth: 1, borderBottomColor: RULE_COLOR }}
          onPress={() => {
            if (!isEditing) {
              // 非編集モード：新要素追加 → 編集モード開始
              onTapEmpty?.(currentCount);
              onEditStart?.(currentCount);
            } else {
              // 編集モード：新要素追加のみ
              onTapEmpty?.(currentCount);
            }
          }}
        />
      );
    }

    return rendered;
  };

  // ===================================================
  //  JSX レンダリング
  // ===================================================
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* 白いノート用紙。Animated.View の translateY でキーボード出現時に全体がスライドアップ */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: noteX,
          right: noteX,
          bottom: bottomMargin,
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 6, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 0,
          elevation: 4,
          overflow: 'hidden',
          // translateY は使わない：スライドするとヘッダー上に内容が隠れるため
        }}
      >
        {/* 常にスクロール可能にする。scrollEnabled=false だと scrollTo() が iOS で無視されるため
            キーボード非表示時はコンテンツが画面内に収まるので実質スクロールは起きない */}
        <ScrollView
          ref={scrollViewRef}
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: noteWidth * space }}
        >
          {/* タイトル線エリア（2行分） */}
          <View style={{ height: interval, borderBottomWidth: 1.5, borderBottomColor: 'rgba(152, 173, 211, 1)' }} />
          <View style={{ height: interval, borderBottomWidth: 1.5, borderBottomColor: 'rgba(152, 173, 211, 1)' }} />
          {renderElements()}
        </ScrollView>
      </Animated.View>

      {/* 属性ツールバー：キーボード直上に固定。Animated.View の外に出してスライドの影響を受けない */}
      {isEditing && keyboardVisible && (
        <View style={[style.keyboardToolbar, { position: 'absolute', bottom: keyboardHeight, left: 0, right: 0 }]}>
          {TOOLBAR_TYPES.map(({ label, type }) => {
            const currentType = activeIndex !== null && elements?.[activeIndex]
              ? elements[activeIndex].type
              : 'text';
            const isActive = currentType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[style.toolbarButton, isActive && style.toolbarButtonActive]}
                onPress={() => handleTypeChange(type)}
              >
                <Text style={[style.toolbarButtonText, isActive && style.toolbarButtonTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {children}
    </View>
  );

};

export default NoteContent;

// ----------------------------------------------------------------
// ヘルパー：ノート1画面あたりの最大行数を計算（外部から参照可能）
// ----------------------------------------------------------------
export const computeMaxRows = (headerHeight: number): number => {
  const noteHeight = (height - headerHeight) * 0.87;
  return Math.max(1, Math.floor((noteHeight - upperSpace * interval) / interval));
};

const style = StyleSheet.create({
  keyboardToolbar: {
    minHeight: 48,
    backgroundColor: '#f4f5f7',
    borderTopWidth: 1,
    borderTopColor: '#d7d7d7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  toolbarButtonActive: {
    backgroundColor: '#007AFF',
  },
  toolbarButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  toolbarButtonTextActive: {
    color: '#fff',
  },
});

// --- Module-level exported generator (placed after component)
export const generateDefaultBackground = async (
  outPath: string,
  headerH: number = 0,
  bgColorKey: keyof typeof COLOR_MAP = 'red'
): Promise<string> => {
  const uint8ToBase64_local = (u8Arr: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < u8Arr.length; i++) {
      binary += String.fromCharCode(u8Arr[i]);
    }
    return global.btoa(binary);
  };

  const bgColorLocal = COLOR_MAP[bgColorKey];
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Skia.Surface.MakeOffscreen が null');

  const canvas = surface.getCanvas();
  const basePaint = Skia.Paint();
  basePaint.setColor(Skia.Color(bgColorLocal));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), basePaint);

  const noteX_local = width * 0.01;
  const noteY_local = height * 0;
  const noteWidth_local = width * 0.98;
  const noteHeight_local = (height - headerH) * 0.87;

  const radius = 0;

  const shadowPaint = Skia.Paint();
  shadowPaint.setColor(Skia.Color('rgba(0,0,0,0.12)'));
  shadowPaint.setStyle(PaintStyle.Fill);
  const shadowRect = Skia.RRectXY(Skia.XYWHRect(noteX_local + 6, noteY_local + 6, noteWidth_local, noteHeight_local), radius, radius);
  canvas.drawRRect(shadowRect, shadowPaint);

  const whitePaint = Skia.Paint();
  whitePaint.setColor(Skia.Color('white'));
  whitePaint.setStyle(PaintStyle.Fill);
  const whiteRect = Skia.RRectXY(Skia.XYWHRect(noteX_local, noteY_local, noteWidth_local, noteHeight_local), radius, radius);
  canvas.drawRRect(whiteRect, whitePaint);

  const linePaint = Skia.Paint();
  linePaint.setStrokeWidth(1.5);
  linePaint.setColor(Skia.Color('rgba(152, 173, 211, 1)'));
  linePaint.setStrokeWidth(1.5);

  const x1_title = width * space;
  const y1_title = (upperSpace - 1) * interval;
  const x2_title = width * (1 - space);
  const y2_title = y1_title;
  canvas.drawLine(x1_title, y1_title, x2_title, y2_title, linePaint);

  const x1 = width * space;
  const y1 = upperSpace * interval;
  const x2 = width * (1 - space);
  const y2 = y1;
  canvas.drawLine(x1, y1, x2, y2, linePaint);

  linePaint.setColor(Skia.Color(RULE_COLOR));
  linePaint.setStrokeWidth(1);
  const row = Math.trunc(noteHeight_local / interval) + 2;
  for (let i = upperSpace + 1; i < row - 1; i++) {
    const x1 = width * space;
    const y1 = i * interval;
    const x2 = width * (1 - space);
    const y2 = y1;
    canvas.drawLine(x1, y1, x2, y2, linePaint);
  }

  const image = surface.makeImageSnapshot();
  let bytes: Uint8Array;
  try {
    // try webp
    // @ts-ignore
    bytes = image.encodeToBytes('webp');
  } catch (err) {
    bytes = image.encodeToBytes();
  }
  const base64 = uint8ToBase64_local(bytes);
  await FileSystem.writeAsStringAsync(outPath, base64, { encoding: FileSystem.EncodingType.Base64 });
  return outPath;
};
