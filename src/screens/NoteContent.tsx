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
const TITLE_RULE_COLOR = 'rgba(152, 173, 211, 1)';
export const NOTE_OUTER_MARGIN = width * 0.01;
const ACTIVE_BORDER = '#8A6F56';
const ACTIVE_TINT = 'rgba(138, 111, 86, 0.10)';
const TOOLBAR_BG = '#FCFAF6';
const TOOLBAR_BORDER = '#DED2C3';
const RESERVED_TOP_LINES = 1;

export type NoteElement =
  | { type: 'chapter'; text: string }
  | { type: 'section'; text: string }
  | { type: 'subsection'; text: string }
  | { type: 'text'; text: string }
  | { type: 'word'; word: string; meaning: string }
  | { type: 'image'; uri: string };

const isValidElement = (el: NoteElement | undefined | null): el is NoteElement => {
  return Boolean(el && (el as any).type);
};

type NoteElementType = NoteElement['type'];

const BODY_FONT = { size: 20, lineHeight: interval, family: 'sanari' } as const;

const FONT_MAP: Record<NoteElementType, { size: number; lineHeight: number; family: string }> = {
  chapter: { size: 30, lineHeight: interval, family: 'sanari-bold' },
  section: { size: 26, lineHeight: interval, family: 'sanari-bold' },
  subsection: { size: 22, lineHeight: interval, family: 'sanari-bold' },
  text: BODY_FONT,
  word: BODY_FONT,
  image: { size: 0, lineHeight: interval, family: 'sanari' },
};

const COLOR_MAP = {
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
  black: '#333333',
} as const;

type Props = {
  onPress?: () => void;
  children?: React.ReactNode;
  backgroundColor?: keyof typeof COLOR_MAP;
  fillBackground?: boolean;
  elements?: NoteElement[];
  onNoteLayout?: (bounds: { x: number; y: number; width: number; height: number }) => void;
  /** ノート上で横スワイプした時のページ移動通知。1=次ページ, -1=前ページ */
  onSwipePage?: (direction: 1 | -1) => void;
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

const NoteContent: React.FC<Props> = ({ children, backgroundColor, fillBackground = true, elements, onNoteLayout, onSwipePage, onBackgroundGenerated, isEditing, onElementChange, onDeleteElement, onTapEmpty, onEditStart, initialFocusIndex }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const swipeStateRef = useRef<{ startX: number; startY: number; swiped: boolean }>({ startX: 0, startY: 0, swiped: false });
  const lastSwipeAtRef = useRef<number>(0);
  const shouldDisableNextScrollAnimationRef = useRef(false);
  const headerHeight = useHeaderHeight();
  // キーボードリスナー内で最新値を参照するためのref
  const activeIndexRef = useRef<number | null>(null);
  const elementsRef = useRef<NoteElement[] | undefined>(undefined);
  const effectiveActiveIndex = isEditing && activeIndex === null && initialFocusIndex !== undefined && initialFocusIndex !== null
    ? initialFocusIndex
    : activeIndex;
  activeIndexRef.current = effectiveActiveIndex;
  elementsRef.current = elements;

  const TOOLBAR_TYPES: { label: string; type: NoteElement['type'] }[] = [
    { label: '文章', type: 'text' },
    { label: '章', type: 'chapter' },
    { label: '節', type: 'section' },
    { label: '項', type: 'subsection' },
    { label: '単語', type: 'word' },
    { label: '画像', type: 'image' },
  ];

  const noteX = NOTE_OUTER_MARGIN;
  const noteY = NOTE_OUTER_MARGIN;
  const noteWidth = width * 0.98;
  const noteHeight = (height - headerHeight) * 0.87 - noteY;
  const bottomMargin = Math.round((height - headerHeight) * 0.13);

  // 1画面に収まる最大行数（先頭行も入力可能にする）
  // 1画面に収まる最大行数（最上段1行は非編集として予約）
  const maxRows = Math.max(1, Math.floor((noteHeight - RESERVED_TOP_LINES * interval) / interval));

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
    let y = RESERVED_TOP_LINES * interval;
    for (let i = 0; i < curIdx && i < curElements.length; i++) {
      const el = curElements[i];
      if (!isValidElement(el)) continue;
      y += getElementHeight(el);
    }
    return y;
  };

  const scrollToPosition = (y: number, animated: boolean) => {
    const nextY = Math.max(0, y);
    scrollOffsetRef.current = nextY;
    scrollViewRef.current?.scrollTo({ y: nextY, animated });
  };

  useEffect(() => {
    const onShow = (e: any) => {
      const kbH = e?.endCoordinates?.height ?? 0;
      setKeyboardVisible(true);
      setKeyboardHeight(kbH);
      // キーボードの高さ分だけ contentInset.bottom を設定し、スクロール領域を広げる
      setTimeout(() => {
        scrollViewRef.current?.setNativeProps({
          contentInset: { top: 0, left: 0, bottom: kbH, right: 0 },
          contentOffset: { x: 0, y: 0 },
        });
      }, 50);
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      // キーボード非表示時は contentInset をリセット
      setTimeout(() => {
        scrollViewRef.current?.setNativeProps({
          contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
        });
        scrollToPosition(0, true);
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
        scrollToPosition(0, false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  // 編集モード開始時に initialFocusIndex の要素にフォーカス
  useEffect(() => {
    if (isEditing && initialFocusIndex !== undefined && initialFocusIndex !== null) {
      setActiveIndex(initialFocusIndex);
      shouldDisableNextScrollAnimationRef.current = true;
      // Explicit focus is more reliable than relying on autoFocus during mode switch.
      setTimeout(() => {
        focusElementInput(initialFocusIndex);
      }, 0);
    }
  }, [isEditing, initialFocusIndex]);

  // フォーカス行が変わったときにスクロール調整（キーボード表示中のみ）
  useEffect(() => {
    if (effectiveActiveIndex === null || !keyboardVisible || !isEditing || !elements) return;
    const activeElement = elements[effectiveActiveIndex];
    if (!isValidElement(activeElement)) return;
    const coveredByKb = Math.max(0, keyboardHeight - bottomMargin);
    const visibleHeight = noteHeight - coveredByKb;
    const elementTop = getActiveElementY(effectiveActiveIndex, elements);
    const elementBottom = elementTop + getElementHeight(activeElement);
    const currentScrollY = scrollOffsetRef.current;
    const visibleTop = currentScrollY;
    const visibleBottom = currentScrollY + visibleHeight;
    let scrollY: number | null = null;

    if (elementBottom > visibleBottom - interval) {
      scrollY = elementBottom - visibleHeight + interval;
    } else if (elementTop < visibleTop + interval) {
      scrollY = elementTop - interval;
    }

    if (scrollY === null) {
      shouldDisableNextScrollAnimationRef.current = false;
      return;
    }

    setTimeout(() => {
      scrollToPosition(scrollY, !shouldDisableNextScrollAnimationRef.current);
      shouldDisableNextScrollAnimationRef.current = false;
    }, 100);
  }, [effectiveActiveIndex, keyboardVisible, keyboardHeight, isEditing, elements]);

  const getInputKey = (index: number, field: 'main' | 'word' | 'meaning' = 'main') => `${index}:${field}`;

  const handleRowResponderGrant = (e: any) => {
    const x = e?.nativeEvent?.pageX ?? 0;
    const y = e?.nativeEvent?.pageY ?? 0;
    swipeStateRef.current = { startX: x, startY: y, swiped: false };
  };

  const handleRowResponderMove = (e: any) => {
    if (!onSwipePage || isEditing) return; // 非編集モード中のみスワイプ検出を行う
    const now = Date.now();
    if (now - lastSwipeAtRef.current < 260) return;

    const x = e?.nativeEvent?.pageX ?? 0;
    const y = e?.nativeEvent?.pageY ?? 0;
    const dx = x - swipeStateRef.current.startX;
    const dy = y - swipeStateRef.current.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (swipeStateRef.current.swiped) return;

    if (absDx > 54 && absDx > absDy * 1.3) {
      swipeStateRef.current.swiped = true;
      lastSwipeAtRef.current = now;
      onSwipePage(dx < 0 ? 1 : -1);
    }
  };

  const handleRowResponderRelease = (onTap: () => void) => {
    if (swipeStateRef.current.swiped) {
      swipeStateRef.current.swiped = false;
      return;
    }
    onTap();
  };

  const focusElementInput = (index: number) => {
    const target = elements?.[index];
    if (!isValidElement(target)) return;

    const key = target.type === 'word' ? getInputKey(index, 'word') : getInputKey(index, 'main');
    const ref = inputRefs.current[key];
    if (!ref) return;
    ref.focus();
  };

  const focusNextElement = (index: number) => {
    if (!elements) return;
    for (let i = index + 1; i < elements.length; i++) {
      const nextEl = elements[i];
      if (!isValidElement(nextEl)) continue;
      if (nextEl.type === 'image') continue;
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
    const currentCount = elements?.length ?? 0;
    const remaining = Math.max(0, maxRows - currentCount);
    const getRuleStyle = (lineIndex: number, isBottomLine: boolean) => {
      if (lineIndex === 0 || isBottomLine) {
        return { borderBottomWidth: 1.5, borderBottomColor: TITLE_RULE_COLOR };
      }
      return { borderBottomWidth: 1, borderBottomColor: RULE_COLOR };
    };

    // ── エレメントが存在する行 ──
    (elements ?? []).forEach((el, idx) => {
      if (!isValidElement(el)) return;
      const font = FONT_MAP[el.type];
      const estHeight = getElementHeight(el);
      const isBottomElementBorder = remaining === 0 && idx === currentCount - 1;

      const debugStyle = IS_DEV
        ? { backgroundColor: 'rgba(255,0,0,0.15)', borderWidth: 1, borderColor: 'red' }
        : {};

      if (el.type === 'image') {
        const lineStyle = getRuleStyle(idx, isBottomElementBorder);
        rendered.push(
          <View
            key={idx}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleRowResponderGrant}
            onResponderMove={handleRowResponderMove}
            onResponderRelease={() =>
              handleRowResponderRelease(() => {
                if (!isEditing) {
                  onEditStart?.(idx);
                  return;
                }
                setActiveIndex(idx);
                setTimeout(() => {
                  focusElementInput(idx);
                }, 0);
              })
            }
            style={{
              height: 200,
              ...lineStyle,
              borderWidth: isEditing && effectiveActiveIndex === idx ? 2 : 0,
              borderColor: ACTIVE_BORDER,
              ...debugStyle,
            }}
          >
            {el.uri ? (
              <Image source={{ uri: el.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#8A7D6D', fontSize: 13 }}>画像が未設定です</Text>
              </View>
            )}
          </View>
        );
        return;
      }

      if (el.type === 'word') {
        const lineStyle = getRuleStyle(idx, isBottomElementBorder);
        const colLeftRatio = 0.25;
        const colLeftWidth = colLeftRatio * 100 + '%' as any;
        const colRightWidth = (1 - colLeftRatio) * 100 + '%' as any;
        rendered.push(
          <View
            key={idx}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleRowResponderGrant}
            onResponderMove={handleRowResponderMove}
            onResponderRelease={() =>
              handleRowResponderRelease(() => {
                if (!isEditing) {
                  onEditStart?.(idx);
                  return;
                }
                setActiveIndex(idx);
                setTimeout(() => {
                  focusElementInput(idx);
                }, 0);
              })
            }
            style={{
              height: estHeight,
              flexDirection: 'row',
              ...lineStyle,
              backgroundColor: isEditing && effectiveActiveIndex === idx ? ACTIVE_TINT : 'transparent',
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
                  autoFocus={effectiveActiveIndex === idx}
                  onFocus={() => setActiveIndex(idx)}
                  style={{
                    fontSize: font.size,
                    lineHeight: font.size + 4,
                    fontFamily: font.family,
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                  }}
                  multiline
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextElement(idx)}
                  placeholder="単語"
                />
              ) : (
                <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, fontFamily: font.family, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{el.word}</Text>
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
                  style={{
                    fontSize: font.size,
                    lineHeight: font.size + 4,
                    fontFamily: font.family,
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                  }}
                  multiline
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextElement(idx)}
                  placeholder="説明"
                />
              ) : (
                <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, fontFamily: font.family, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{(el as any).meaning}</Text>
              )}
            </View>
          </View>
        );
        return;
      }

      // text / chapter / section / subsection
      const lineStyle = getRuleStyle(idx, isBottomElementBorder);
      rendered.push(
        <View
          key={idx}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleRowResponderGrant}
          onResponderMove={handleRowResponderMove}
          onResponderRelease={() =>
            handleRowResponderRelease(() => {
              if (!isEditing) {
                onEditStart?.(idx);
                return;
              }
              setActiveIndex(idx);
              setTimeout(() => {
                focusElementInput(idx);
              }, 0);
            })
          }
          style={{
            height: estHeight,
            ...lineStyle,
              backgroundColor: isEditing && effectiveActiveIndex === idx ? ACTIVE_TINT : 'transparent',
            ...debugStyle,
          }}
        >
          <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 0, justifyContent: 'flex-start' }}>
            {isEditing ? (
              <TextInput
                value={'text' in el ? el.text : (el as any).text || ''}
                scrollEnabled={false}
                onChangeText={(t) =>
                  handleInputWithEnter(t, idx, (next) => onElementChange?.(idx, { ...el, text: next } as any))
                }
                ref={(ref) => { inputRefs.current[getInputKey(idx, 'main')] = ref; }}
                autoFocus={effectiveActiveIndex === idx}
                onFocus={() => setActiveIndex(idx)}
                style={{
                  fontSize: font.size,
                  lineHeight: font.lineHeight,
                  fontFamily: font.family,
                  width: '100%',
                  minHeight: font.lineHeight,
                  padding: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                  textAlignVertical: 'top',
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
                  fontFamily: font.family,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                {'text' in el ? el.text : (el as any).text || ''}
              </Text>
            )}
          </View>
        </View>
      );
      return;
    });

    // 末尾に残り行分の罫線を常に追加（maxRowsを超えない範囲で）
    for (let i = 0; i < remaining; i++) {
      const lineIndex = currentCount + i;
      const isBottomEmptyLine = i === remaining - 1;
      const lineStyle = getRuleStyle(lineIndex, isBottomEmptyLine);
      rendered.push(
        <View
          key={`empty-tap-${i}`}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleRowResponderGrant}
          onResponderMove={handleRowResponderMove}
          onResponderRelease={() =>
            handleRowResponderRelease(() => {
              if (!isEditing) {
                // 非編集モード：新要素追加 → 編集モード開始
                onTapEmpty?.(currentCount);
                onEditStart?.(currentCount);
              } else {
                // 編集モード：新要素追加のみ
                onTapEmpty?.(currentCount);
              }
            })
          }
          style={{
            height: interval,
            ...lineStyle,
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
    <View style={{ flex: 1, backgroundColor: fillBackground ? bgColor : 'transparent' }}>
      {/* 白いノート用紙。Animated.View の translateY でキーボード出現時に全体がスライドアップ */}
      <Animated.View
        style={{
          position: 'absolute',
          top: noteY,
          left: noteX,
          right: noteX,
          bottom: bottomMargin,
          backgroundColor: '#FCFAF6',
          shadowColor: '#4B3522',
          shadowOffset: { width: 6, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 0,
          elevation: 4,
          overflow: 'hidden',
          // translateY は使わない：スライドするとヘッダー上に内容が隠れるため
        }}
      >
        {/* スクロールは編集モード時のみ有効 */}
        <ScrollView
          ref={scrollViewRef}
          scrollEnabled={isEditing}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: noteWidth * space }}
        >
          {/* 最上段は非編集の罫線行として固定 */}
          <View style={{ height: interval, borderBottomWidth: 1.5, borderBottomColor: TITLE_RULE_COLOR }} />
          {renderElements()}
        </ScrollView>
      </Animated.View>

      {/* 属性ツールバー：キーボード直上に固定。Animated.View の外に出してスライドの影響を受けない */}
      {isEditing && keyboardVisible && (
        <View style={[style.keyboardToolbar, { position: 'absolute', bottom: keyboardHeight, left: 0, right: 0 }]}>
          {(() => {
            const current = activeIndex !== null ? elements?.[activeIndex] : undefined;
            const currentType: NoteElement['type'] = isValidElement(current) ? current.type : 'text';

            return TOOLBAR_TYPES.map(({ label, type }) => {
              const isOutlineType = type === 'chapter' || type === 'section' || type === 'subsection';
              const isWordType = type === 'word';
              const isImageType = type === 'image';
              const isActive = currentType === type;

              const baseButtonStyle = isOutlineType
                ? style.toolbarButtonOutline
                : isWordType
                ? style.toolbarButtonWord
                : isImageType
                ? style.toolbarButtonImage
                : style.toolbarButtonTextType;

              const activeButtonStyle = isOutlineType
                ? style.toolbarButtonOutlineActive
                : isWordType
                ? style.toolbarButtonWordActive
                : isImageType
                ? style.toolbarButtonImageActive
                : style.toolbarButtonTextActiveBg;

              const baseTextStyle = isOutlineType
                ? style.toolbarButtonOutlineText
                : isWordType
                ? style.toolbarButtonWordText
                : isImageType
                ? style.toolbarButtonImageText
                : style.toolbarButtonTextTypeText;

              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    style.toolbarButton,
                    baseButtonStyle,
                    isActive && activeButtonStyle,
                  ]}
                  onPress={() => handleTypeChange(type)}
                >
                  <Text
                    style={[
                      style.toolbarButtonLabel,
                      baseTextStyle,
                      isActive && style.toolbarButtonTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            });
          })()}
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
  const noteHeight = (height - headerHeight) * 0.87 - NOTE_OUTER_MARGIN;
  return Math.max(1, Math.floor((noteHeight - RESERVED_TOP_LINES * interval) / interval));
};

const style = StyleSheet.create({
  keyboardToolbar: {
    minHeight: 48,
    backgroundColor: TOOLBAR_BG,
    borderTopWidth: 1,
    borderTopColor: TOOLBAR_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarButtonOutline: {
    backgroundColor: '#EEF7F0',
    borderColor: '#9FC4A8',
  },
  toolbarButtonTextType: {
    backgroundColor: '#F7EFE8',
    borderColor: '#D0B9A5',
  },
  toolbarButtonWord: {
    backgroundColor: '#ECF4FF',
    borderColor: '#AFC7E8',
  },
  toolbarButtonImage: {
    backgroundColor: '#F2EEFF',
    borderColor: '#C5B7E8',
  },
  toolbarButtonOutlineActive: {
    backgroundColor: '#4D7A5B',
    borderColor: '#3A5F47',
  },
  toolbarButtonTextActiveBg: {
    backgroundColor: ACTIVE_BORDER,
    borderColor: '#6E5744',
  },
  toolbarButtonWordActive: {
    backgroundColor: '#4E79B8',
    borderColor: '#365B8F',
  },
  toolbarButtonImageActive: {
    backgroundColor: '#7560B1',
    borderColor: '#58498A',
  },
  toolbarButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarButtonOutlineText: {
    color: '#2F4D3A',
  },
  toolbarButtonTextTypeText: {
    color: '#513D2D',
  },
  toolbarButtonWordText: {
    color: '#2E4A72',
  },
  toolbarButtonImageText: {
    color: '#4D3D7A',
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

  const noteX_local = NOTE_OUTER_MARGIN;
  const noteY_local = NOTE_OUTER_MARGIN;
  const noteWidth_local = width * 0.98;
  const noteHeight_local = (height - headerH) * 0.87 - noteY_local;

  const radius = 0;

  const shadowPaint = Skia.Paint();
  shadowPaint.setColor(Skia.Color('rgba(0,0,0,0.12)'));
  shadowPaint.setStyle(PaintStyle.Fill);
  const shadowRect = Skia.RRectXY(Skia.XYWHRect(noteX_local + 6, noteY_local + 6, noteWidth_local, noteHeight_local), radius, radius);
  canvas.drawRRect(shadowRect, shadowPaint);

  const whitePaint = Skia.Paint();
  whitePaint.setColor(Skia.Color('#FCFAF6'));
  whitePaint.setStyle(PaintStyle.Fill);
  const whiteRect = Skia.RRectXY(Skia.XYWHRect(noteX_local, noteY_local, noteWidth_local, noteHeight_local), radius, radius);
  canvas.drawRRect(whiteRect, whitePaint);

  const linePaint = Skia.Paint();
  linePaint.setStrokeWidth(1.5);
  linePaint.setColor(Skia.Color(TITLE_RULE_COLOR));
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

  // 最下段の罫線はタイトル線と同じ太さ・色にする
  linePaint.setColor(Skia.Color(TITLE_RULE_COLOR));
  linePaint.setStrokeWidth(1.5);
  const x1_bottom = width * space;
  const y1_bottom = (row - 1) * interval;
  const x2_bottom = width * (1 - space);
  const y2_bottom = y1_bottom;
  canvas.drawLine(x1_bottom, y1_bottom, x2_bottom, y2_bottom, linePaint);

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
