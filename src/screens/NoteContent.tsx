// ==========================================
// NoteContent.tsx
// ==========================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Dimensions, StyleSheet, TextInput, TouchableOpacity, Keyboard, Platform, Animated, ScrollView, Alert, ActionSheetIOS } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
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
const WORD_ACCENT_COLOR = '#D13A3A';
const RESERVED_TOP_LINES = 1;

const OUTLINE_PREFIX_RE = /^\s*\d+(?:\.\d+)*\.\s*/;
const stripOutlinePrefix = (text: string) => text.replace(OUTLINE_PREFIX_RE, '').trimStart();

export type NoteElement =
  | { type: 'chapter'; text: string; autoNumberingDisabled?: boolean }
  | { type: 'section'; text: string; autoNumberingDisabled?: boolean }
  | { type: 'subsection'; text: string; autoNumberingDisabled?: boolean }
  | { type: 'text'; text: string }
  | { type: 'word'; word: string; meaning: string }
  | { type: 'image'; uri: string };

const isValidElement = (el: NoteElement | undefined | null): el is NoteElement => {
  return Boolean(el && (el as any).type);
};

type NoteElementType = NoteElement['type'];

const BODY_FONT = { size: 15, lineHeight: interval, family: 'sanari' } as const;

// ノート要素タイプごとのフォントスタイル・文字の大きさ
const FONT_MAP: Record<NoteElementType, { size: number; lineHeight: number; family: string }> = {
  chapter: { size: 22, lineHeight: interval, family: 'sanari-bold' },
  section: { size: 18, lineHeight: interval, family: 'sanari-bold' },
  subsection: { size: 15, lineHeight: interval, family: 'sanari-bold' },
  text: BODY_FONT,
  word: BODY_FONT,
  image: { size: 0, lineHeight: interval, family: 'sanari' },
};

const COLOR_MAP = {
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
  black: '#1F1F1F',
  olive: '#768830',
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
  onTapEmpty?: (afterIndex: number) => boolean | void;
  /** 現在 block を分割して次 text block を挿入するコールバック */
  onSplitToNextTextBlock?: (index: number, before: string, after: string) => boolean | void;
  /** block 先頭 Backspace 時に前 block へ結合するコールバック */
  onMergeWithPrevious?: (index: number) => void;
  /** 非編集モードで行をタップして編集開始するコールバック */
  onEditStart?: (index: number) => void;
  /** 編集開始時にフォーカスする要素インデックス */
  initialFocusIndex?: number;
};

const NoteContent: React.FC<Props> = ({ children, backgroundColor, fillBackground = true, elements, onNoteLayout, onSwipePage, onBackgroundGenerated, isEditing, onElementChange, onDeleteElement, onTapEmpty, onSplitToNextTextBlock, onMergeWithPrevious, onEditStart, initialFocusIndex }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [displayWordLines, setDisplayWordLines] = useState<Record<number, number>>({});
  const [displayTextLines, setDisplayTextLines] = useState<Record<number, number>>({});
  const [measuredTextLines, setMeasuredTextLines] = useState<Record<number, number>>({});
  const measuredWordLinesRef = useRef<Record<number, number>>({});
  const measuredTextLinesRef = useRef<Record<number, number>>({});
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
  const pendingFocusAfterAddRef = useRef<number | null>(null);
  const selectionRef = useRef<Record<string, { start: number; end: number }>>({});
  const splitGuardRef = useRef<{ key: string; ts: number } | null>(null);
  const effectiveActiveIndex = isEditing && activeIndex === null && initialFocusIndex !== undefined && initialFocusIndex !== null
    ? initialFocusIndex
    : activeIndex;
  activeIndexRef.current = effectiveActiveIndex;
  elementsRef.current = elements;

  useEffect(() => {
    if (isEditing) {
      setDisplayWordLines({});
      setDisplayTextLines({});
      return;
    }
    setDisplayWordLines({ ...measuredWordLinesRef.current });
    setDisplayTextLines({ ...measuredTextLinesRef.current });
  }, [isEditing, elements]);

  const TOOLBAR_TYPES: { label: string; type: NoteElement['type']; iconName?: keyof typeof Ionicons.glyphMap }[] = [
    { label: '文章', type: 'text', iconName: 'text-outline' },
    { label: '大', type: 'chapter' },
    { label: '中', type: 'section' },
    { label: '小', type: 'subsection' },
    { label: '単語リスト', type: 'word', iconName: 'list-outline' },
    { label: '画像', type: 'image', iconName: 'image-outline' },
  ];

  const noteX = NOTE_OUTER_MARGIN;
  const noteY = NOTE_OUTER_MARGIN;
  const noteWidth = width * 0.98;
  const noteHeight = (height - headerHeight) * 0.87 - noteY;
  const bottomMargin = Math.round((height - headerHeight) * 0.13);

  // 1画面に収まる最大行数（先頭行も入力可能にする）
  // 1画面に収まる最大行数（最上段1行は非編集として予約）
  const maxRows = Math.max(1, Math.floor((noteHeight - RESERVED_TOP_LINES * interval) / interval));
  const totalRuleRows = maxRows + RESERVED_TOP_LINES;

  // 要素1つの表示高さを返す
  const getElementHeight = (el: NoteElement): number => {
    const font = FONT_MAP[el.type];
    if (el.type === 'image') return IMAGE_SQUARE_SIZE;
    const contentWidth = noteWidth * (1 - 2 * space);
    if (el.type === 'word') {
      const rw = contentWidth * 0.75 - 12;
      const meaning = ((el as any).meaning || '') as string;
      const meaningCharsPerLine = Math.max(6, Math.floor(rw / Math.max(1, font.size)));
      const meaningLines = meaning
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / meaningCharsPerLine)), 0);
      return Math.max(font.lineHeight, meaningLines * font.lineHeight);
    }

    const text = 'text' in el ? el.text : '';
    const linesByNewLine = Math.max(1, text.split('\n').length);
    return Math.max(font.lineHeight, linesByNewLine * font.lineHeight);
  };

  const getCharsPerLine = (el: NoteElement) => {
    const font = FONT_MAP[el.type];
    if (el.type === 'image') return Infinity;
    const contentWidth = noteWidth * (1 - 2 * space);
    return Math.max(1, Math.floor(contentWidth / Math.max(1, font.size)));
  };

  const estimateLinesByChars = (type: NoteElementType, value: string) => {
    if (type === 'image' || type === 'word') return 1;
    const font = FONT_MAP[type];
    const contentWidth = noteWidth * (1 - 2 * space);
    const availableWidth = Math.max(1, contentWidth - 12);
    const cpp = Math.max(8, Math.floor(availableWidth / Math.max(1, font.size)) - 1);
    return value.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / cpp)), 0);
  };

  const getRowHeight = (el: NoteElement, idx: number): number => {
    const font = FONT_MAP[el.type];
    if (el.type === 'image') return 200;
    if (el.type === 'word') {
      const measuredLines = displayWordLines[idx] ?? 0;
      return Math.max(getElementHeight(el), Math.max(1, measuredLines) * font.lineHeight);
    }
    const measuredLines = measuredTextLines[idx] ?? 0;
    const fallbackLines = Math.max(1, ('text' in el ? el.text : ((el as any).text || '')).split('\n').length);
    const resolvedLines = measuredLines || fallbackLines;
    return Math.max(font.lineHeight, resolvedLines * font.lineHeight);
  };

  const updateMeasuredTextLines = (idx: number, nextLines: number) => {
    const lines = Math.max(1, nextLines);
    setMeasuredTextLines((prev) => {
      if (prev[idx] === lines) return prev;
      return { ...prev, [idx]: lines };
    });
  };
  // アクティブ要素のY位置（ScrollView内）を計算するヘルパー
  const getActiveElementY = (curIdx: number | null, curElements: NoteElement[] | undefined): number => {
    if (curIdx === null || !curElements) return noteHeight; // 不明なら最下部扱い
    let y = RESERVED_TOP_LINES * interval;
    for (let i = 0; i < curIdx && i < curElements.length; i++) {
      const el = curElements[i];
      if (!isValidElement(el)) continue;
      y += getRowHeight(el, i);
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
    const elementBottom = elementTop + getRowHeight(activeElement, effectiveActiveIndex);
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

  // 新しい要素が追加された直後にフォーカスを当てる（Enter で末尾行追加した場合）
  useEffect(() => {
    const pending = pendingFocusAfterAddRef.current;
    if (pending === null) return;
    if (!elements || elements.length <= pending) return;
    pendingFocusAfterAddRef.current = null;
    requestAnimationFrame(() => {
      focusElementInput(pending);
    });
  }, [elements?.length]);

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

    requestAnimationFrame(() => {
      try {
        ref.focus();
      } catch (error) {
        // ignore focus errors
      }
    });
  };

  const focusPrevElement = (index: number) => {
    if (!elements) return;
    for (let i = index - 1; i >= 0; i--) {
      const prevEl = elements[i];
      if (!isValidElement(prevEl)) continue;
      if (prevEl.type === 'image') continue;
      setActiveIndex(i);
      setTimeout(() => focusElementInput(i), 30);
      return;
    }
  };

  const focusNextElement = (index: number) => {
    if (!elements) return;
    for (let i = index + 1; i < elements.length; i++) {
      const nextEl = elements[i];
      if (!isValidElement(nextEl)) continue;
      if (nextEl.type === 'image') continue;
      setActiveIndex(i);
      setTimeout(() => focusElementInput(i), 30);
      return;
    }
    // 末尾でも maxRows に達していなければ新しい行を追加
    if (elements.length < maxRows) {
      const nextIndex = index + 1;
      pendingFocusAfterAddRef.current = nextIndex;
      setActiveIndex(nextIndex);
      onTapEmpty?.(nextIndex);
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
    if (type === 'chapter' || type === 'section' || type === 'subsection') {
      return { type, text: el.text || '', autoNumberingDisabled: false } as NoteElement;
    }
    return { type, text: el.text || '' } as NoteElement;
  };

  const handleTypeChange = (type: NoteElement['type']) => {
    if (activeIndex === null || !elements?.[activeIndex]) return;
    const current = elements[activeIndex];
    const hasAnyTextInput = current.type === 'word'
      ? Boolean((current.word || '').trim().length > 0 || (current.meaning || '').trim().length > 0)
      : current.type === 'image'
      ? false
      : Boolean((current.text || '').trim().length > 0);

    // 画像以外の要素で1文字以上入力済みなら、画像への変換は不可
    if (type === 'image' && current.type !== 'image' && hasAnyTextInput) return;
    if (current.type === type) return;

    const converted = convertElementType(current, type);
    onElementChange?.(activeIndex, converted);
    setTimeout(() => {
      if (type !== 'image') focusElementInput(activeIndex);
    }, 0);
  };

  // 画像は横いっぱいの正方形（iOS の allowsEditing が常に 1:1 のため正方形に統一）
  const IMAGE_SQUARE_SIZE = Math.round(noteWidth * (1 - 2 * space));

  const processPickedImage = async (src: string, idx: number) => {
    // 元画像の中央から 1:1 でクロップ
    const info = await manipulateAsync(src, [], { format: SaveFormat.JPEG });
    const origW = info.width;
    const origH = info.height;
    const cropSide = Math.min(origW, origH);
    const originX = Math.round((origW - cropSide) / 2);
    const originY = Math.round((origH - cropSide) / 2);
    const cropped = await manipulateAsync(
      src,
      [{ crop: { originX, originY, width: cropSide, height: cropSide } }],
      { compress: 0.85, format: SaveFormat.JPEG }
    );
    const dest = `${FileSystem.documentDirectory}note_img_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: cropped.uri, to: dest });
    const current = elements?.[idx];
    if (current?.type === 'image') {
      onElementChange?.(idx, { type: 'image', uri: dest });
    }
  };

  const launchImagePicker = async (useCamera: boolean, idx: number) => {
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await processPickedImage(result.assets[0].uri, idx);
  };

  const pickImageForElement = async (idx: number) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['キャンセル', '写真ライブラリ', 'カメラで撮影'], cancelButtonIndex: 0 },
        async (buttonIndex) => {
          if (buttonIndex === 1) await launchImagePicker(false, idx);
          if (buttonIndex === 2) await launchImagePicker(true, idx);
        }
      );
    } else {
      Alert.alert('画像を選択', '', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '写真ライブラリ', onPress: () => launchImagePicker(false, idx) },
        { text: 'カメラで撮影', onPress: () => launchImagePicker(true, idx) },
      ]);
    }
  };

  const showImageEditMenu = (idx: number, hasImage: boolean) => {
    if (Platform.OS === 'ios') {
      const options = hasImage
        ? ['キャンセル', '写真ライブラリ', 'カメラで撮影', '画像を削除']
        : ['キャンセル', '写真ライブラリ', 'カメラで撮影', '要素を削除'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: 3 },
        async (buttonIndex) => {
          if (buttonIndex === 1) await launchImagePicker(false, idx);
          if (buttonIndex === 2) await launchImagePicker(true, idx);
          if (buttonIndex === 3) onDeleteElement?.(idx);
        }
      );
    } else {
      Alert.alert(hasImage ? '画像の操作' : '画像を追加', '', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '写真ライブラリ', onPress: () => launchImagePicker(false, idx) },
        { text: 'カメラで撮影', onPress: () => launchImagePicker(true, idx) },
        { text: hasImage ? '画像を削除' : '要素を削除', style: 'destructive', onPress: () => onDeleteElement?.(idx) },
      ]);
    }
  };

  const splitToNextTextBlock = (index: number, currentText: string, splitAt: number) => {
    const safeSplitAt = Math.max(0, Math.min(splitAt, currentText.length));
    const before = currentText.slice(0, safeSplitAt);
    const after = currentText.slice(safeSplitAt);

    const inserted = onSplitToNextTextBlock?.(index, before, after);
    if (inserted !== undefined) {
      if (inserted === false) return;
      pendingFocusAfterAddRef.current = index + 1;
      setActiveIndex(index + 1);
      splitGuardRef.current = {
        key: getInputKey(index, 'main'),
        ts: Date.now(),
      };
      return;
    }

    const current = elements?.[index];
    if (!isValidElement(current) || !('text' in current)) return;
    onElementChange?.(index, { ...current, text: before } as any);
    const fallbackInserted = onTapEmpty?.(index + 1);
    if (fallbackInserted === false) return;

    pendingFocusAfterAddRef.current = index + 1;
    setTimeout(() => {
      onElementChange?.(index + 1, { type: 'text', text: after });
      setActiveIndex(index + 1);
      splitGuardRef.current = {
        key: getInputKey(index, 'main'),
        ts: Date.now(),
      };
    }, 0);
  };

  const splitByEnter = (index: number, currentText: string) => {
    const key = getInputKey(index, 'main');
    const guard = splitGuardRef.current;
    if (guard && guard.key === key && Date.now() - guard.ts < 120) {
      return;
    }

    const selection = selectionRef.current[key] ?? {
      start: currentText.length,
      end: currentText.length,
    };
    const splitAt = Math.max(0, Math.min(selection.start, currentText.length));
    const end = Math.max(splitAt, Math.min(selection.end, currentText.length));
    const normalized = `${currentText.slice(0, splitAt)}${currentText.slice(end)}`;
    splitToNextTextBlock(index, normalized, splitAt);
  };

  const renderPageRuleLines = () => {
    const lines: React.ReactElement[] = [];

    for (let row = 1; row <= totalRuleRows; row++) {
      const isTitleLine = row === 1 || row === totalRuleRows;
      lines.push(
        <View
          key={`page-rule-${row}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: row * interval - (isTitleLine ? 1.5 : 1),
            borderBottomWidth: isTitleLine ? 1.5 : 1,
            borderBottomColor: isTitleLine ? TITLE_RULE_COLOR : RULE_COLOR,
          }}
        />
      );
    }

    return lines;
  };

  // ===================================================
  //  要素レンダリング（通常フロー）
  // ===================================================
  const renderElements = () => {
    const rendered: React.ReactElement[] = [];
    const currentCount = elements?.length ?? 0;
    const capacityHeight = maxRows * interval;
    let consumedHeight = 0;
    let overflowStartIndex: number | null = null;
    (elements ?? []).forEach((el, idx) => {
      if (!isValidElement(el)) return;
      const h = getElementHeight(el);
      if (overflowStartIndex === null && consumedHeight > 0 && consumedHeight + h > capacityHeight) {
        overflowStartIndex = idx;
      }
      if (overflowStartIndex === null) {
        consumedHeight += h;
      }
    });
    const consumedRows = Math.ceil(consumedHeight / interval);
    const remaining = Math.max(0, maxRows - consumedRows);
    // ── エレメントが存在する行 ──
    (elements ?? []).forEach((el, idx) => {
      if (!isValidElement(el)) return;
      const font = FONT_MAP[el.type];
      let estHeight = getElementHeight(el);
      if (el.type === 'word') {
        const measuredLines = displayWordLines[idx] ?? 0;
        estHeight = Math.max(estHeight, Math.max(1, measuredLines) * font.lineHeight);
      } else if (el.type !== 'image' && (el.type === 'text' || el.type === 'chapter' || el.type === 'section' || el.type === 'subsection')) {
        const measuredLines = displayTextLines[idx] ?? 1;
        if (isEditing) {
          // 編集中は実測行数を優先し、右端折り返しを遅延なく反映する
          estHeight = Math.max(1, measuredLines) * font.lineHeight;
        } else {
          estHeight = Math.max(estHeight, Math.max(1, measuredLines) * font.lineHeight);
        }
      }
      const debugStyle = IS_DEV
        ? { backgroundColor: 'rgba(255,0,0,0.15)', borderWidth: 1, borderColor: 'red' }
        : {};

      if (el.type === 'image') {
        const isOverflow = overflowStartIndex !== null && idx >= overflowStartIndex;
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
              })
            }
            style={{
              height: IMAGE_SQUARE_SIZE,
              borderWidth: isEditing && effectiveActiveIndex === idx ? 2 : isOverflow ? 1.5 : 0,
              borderColor: isOverflow ? '#D13A3A' : ACTIVE_BORDER,
              backgroundColor: isOverflow ? 'rgba(209, 58, 58, 0.10)' : 'transparent',
              ...debugStyle,
            }}
          >
            {el.uri ? (
              <>
                <Image source={{ uri: el.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                {isEditing && (
                  <TouchableOpacity
                    onPress={() => showImageEditMenu(idx, true)}
                    style={{
                      position: 'absolute', bottom: 8, right: 8,
                      backgroundColor: 'rgba(0,0,0,0.45)',
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12 }}>変更 / 削除</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  if (!isEditing) { onEditStart?.(idx); }
                  else { showImageEditMenu(idx, false); }
                }}
                activeOpacity={0.7}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="image-outline" size={28} color={isEditing ? ACTIVE_BORDER : '#C0B4A8'} />
                <Text style={{ color: isEditing ? ACTIVE_BORDER : '#C0B4A8', fontSize: 12, fontFamily: 'sanari' }}>
                  {isEditing ? 'タップして画像を追加' : '画像が未設定です'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
        return;
      }

      if (el.type === 'word') {
        const isOverflow = overflowStartIndex !== null && idx >= overflowStartIndex;
        const colLeftRatio = 0.35;
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
              backgroundColor: isOverflow
                ? 'rgba(209, 58, 58, 0.10)'
                : isEditing && effectiveActiveIndex === idx
                ? ACTIVE_TINT
                : 'transparent',
              alignItems: 'stretch',
              borderWidth: isOverflow ? 1 : 0,
              borderColor: isOverflow ? '#D13A3A' : 'transparent',
              ...debugStyle,
            }}
          >
            <View style={{ width: colLeftWidth, height: '100%', paddingHorizontal: 6, paddingVertical: 0, borderRightWidth: 1, borderRightColor: RULE_COLOR }}>
              {isEditing ? (
                <TextInput
                  value={el.word}
                  onChangeText={(t) => onElementChange?.(idx, { ...el, word: t })}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Enter') {
                      focusNextElement(idx);
                    }
                  }}
                  ref={(ref) => { inputRefs.current[getInputKey(idx, 'word')] = ref; }}
                  autoFocus={effectiveActiveIndex === idx}
                  onFocus={() => setActiveIndex(idx)}
                  style={{
                    fontSize: font.size,
                    lineHeight: interval,
                    fontFamily: font.family,
                    color: WORD_ACCENT_COLOR,
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                  }}
                  multiline
                  blurOnSubmit={true}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    const currentValue = inputRefs.current[getInputKey(idx, 'word')]?.props?.value;
                    if (typeof currentValue === 'string') {
                      onElementChange?.(idx, { ...el, word: currentValue });
                    }
                    focusNextElement(idx);
                  }}
                  placeholder="単語"
                />
              ) : (
                <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, fontFamily: font.family, color: WORD_ACCENT_COLOR, flexShrink: 1, flexWrap: 'wrap', width: '100%', includeFontPadding: false }}>{el.word}</Text>
              )}
            </View>
            <View style={{ flex: 1, height: '100%', paddingHorizontal: 6, paddingVertical: 0, justifyContent: 'flex-start' }}>
              {isEditing ? (
                <TextInput
                  value={(el as any).meaning}
                  onChangeText={(t) => onElementChange?.(idx, { ...el, meaning: t } as any)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Enter') {
                      focusNextElement(idx);
                    }
                  }}
                  ref={(ref) => { inputRefs.current[getInputKey(idx, 'meaning')] = ref; }}
                  onFocus={() => setActiveIndex(idx)}
                  onContentSizeChange={(e) => {
                    const h = e.nativeEvent.contentSize.height;
                    // contentSize は端末差で端数が出るため、常に切り上げて過小計上を防ぐ。
                    const measuredLines = Math.max(1, Math.ceil((h - 0.5) / interval));
                    measuredWordLinesRef.current[idx] = measuredLines;
                  }}
                  style={{
                    fontSize: font.size,
                    lineHeight: interval,
                    fontFamily: font.family,
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                  }}
                  multiline
                  blurOnSubmit={true}
                  submitBehavior="submit"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    const currentValue = inputRefs.current[getInputKey(idx, 'meaning')]?.props?.value;
                    if (typeof currentValue === 'string') {
                      onElementChange?.(idx, { ...el, meaning: currentValue } as any);
                    }
                    focusNextElement(idx);
                  }}
                  placeholder="意味"
                />
              ) : (
                <Text
                  onTextLayout={(e) => {
                    if (isEditing) return;
                    const lines = Math.max(1, e.nativeEvent.lines?.length ?? 1);
                    setDisplayWordLines((prev) => {
                      if (prev[idx] === lines) return prev;
                      return { ...prev, [idx]: lines };
                    });
                  }}
                  style={{ fontSize: font.size, lineHeight: font.lineHeight, fontFamily: font.family, flexShrink: 1, flexWrap: 'wrap', width: '100%', includeFontPadding: false }}
                >
                  {(el as any).meaning}
                </Text>
              )}
            </View>
          </View>
        );
        return;
      }

      // text / chapter / section / subsection
      const isOutlineType = el.type === 'chapter' || el.type === 'section' || el.type === 'subsection';
      const isOverflow = overflowStartIndex !== null && idx >= overflowStartIndex;
      const textRowHeightStyle = { height: estHeight };
      const mainText = 'text' in el ? el.text : (el as any).text || '';
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
          onLayout={(e) => {
            if (!isEditing) return;
            const h = Math.round(e.nativeEvent.layout.height);
            const measuredLines = Math.max(1, Math.ceil(h / font.lineHeight));
            updateMeasuredTextLines(idx, measuredLines);
          }}
          style={{
            ...textRowHeightStyle,
            backgroundColor: isOverflow
              ? 'rgba(209, 58, 58, 0.10)'
              : isEditing && effectiveActiveIndex === idx
              ? ACTIVE_TINT
              : 'transparent',
            position: 'relative',
            borderWidth: isOverflow ? 1 : 0,
            borderColor: isOverflow ? '#D13A3A' : 'transparent',
            ...debugStyle,
          }}
        >
          <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 0, paddingBottom: 0, justifyContent: 'flex-start' }}>
            {isEditing ? (
              <TextInput
                value={mainText}
                scrollEnabled={false}
                onChangeText={(t) => {
                  const newlineIndex = t.indexOf('\n');
                  if (newlineIndex >= 0) {
                    const merged = `${t.slice(0, newlineIndex)}${t.slice(newlineIndex + 1)}`;
                    splitToNextTextBlock(idx, merged, newlineIndex);
                    return;
                  }

                  onElementChange?.(idx, { ...el, text: t } as any);
                }}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Enter' || nativeEvent.key === 'Return' || nativeEvent.key === '\n') {
                    const current = 'text' in el ? el.text : (el as any).text || '';
                    splitByEnter(idx, current);
                    return;
                  }
                  if (nativeEvent.key === 'Backspace') {
                    const selection = selectionRef.current[getInputKey(idx, 'main')];
                    if (el.type === 'text' && selection && selection.start === 0 && selection.end === 0) {
                      onMergeWithPrevious?.(idx);
                      return;
                    }
                    const current = 'text' in el ? el.text : (el as any).text || '';
                    if (!isOutlineType && current.length === 0) {
                      focusPrevElement(idx);
                    }
                  }
                }}
                onSelectionChange={({ nativeEvent }) => {
                  selectionRef.current[getInputKey(idx, 'main')] = nativeEvent.selection;
                }}
                onContentSizeChange={(e) => {
                  const h = Math.round(e.nativeEvent.contentSize.height);
                  const measuredLines = Math.max(1, Math.ceil(h / font.lineHeight));
                  measuredTextLinesRef.current[idx] = measuredLines;
                  updateMeasuredTextLines(idx, measuredLines);
                  if (isEditing) {
                    setDisplayTextLines((prev) => {
                      if (prev[idx] === measuredLines) return prev;
                      return { ...prev, [idx]: measuredLines };
                    });
                  }
                }}
                ref={(ref) => { inputRefs.current[getInputKey(idx, 'main')] = ref; }}
                autoFocus={effectiveActiveIndex === idx}
                onFocus={() => setActiveIndex(idx)}
                style={{
                  fontSize: font.size,
                  lineHeight: font.lineHeight,
                  fontFamily: font.family,
                  backgroundColor: 'transparent',
                  width: '100%',
                  minHeight: font.lineHeight,
                  padding: 0,
                  textAlignVertical: 'top',
                  includeFontPadding: false,
                }}
                multiline
                blurOnSubmit={true}
                submitBehavior="submit"
                returnKeyType="next"
                onSubmitEditing={() => {
                  const current = 'text' in el ? el.text : (el as any).text || '';
                  splitByEnter(idx, current);
                }}
              />
            ) : (
              <Text
                onTextLayout={(e) => {
                  const lines = Math.max(1, e.nativeEvent.lines?.length ?? 1);
                  updateMeasuredTextLines(idx, lines);
                }}
                style={{
                  fontSize: font.size,
                  lineHeight: font.lineHeight,
                  fontFamily: font.family,
                  flexWrap: 'wrap',
                  width: '100%',
                  includeFontPadding: false,
                }}
              >
                {mainText}
              </Text>
            )}
          </View>
        </View>
      );
      return;
    });

    // 末尾に残り行分の罫線を常に追加（maxRowsを超えない範囲で）
    for (let i = 0; i < remaining; i++) {
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
          width: noteWidth,
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
          contentContainerStyle={{ paddingHorizontal: noteWidth * space, minHeight: totalRuleRows * interval }}
        >
          <View style={{ position: 'relative', minHeight: totalRuleRows * interval }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {renderPageRuleLines()}
            </View>
            <View style={{ minHeight: totalRuleRows * interval }}>
              <View style={{ height: interval }} />
              {renderElements()}
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* 属性ツールバー：キーボード直上に固定。見出しラベル + 横一列ボタン */}
      {isEditing && keyboardVisible && (
        <View style={[style.keyboardToolbar, { position: 'absolute', bottom: keyboardHeight, left: 0, right: 0 }]}>
          {(() => {
            const current = activeIndex !== null ? elements?.[activeIndex] : undefined;
            const currentType: NoteElement['type'] = isValidElement(current) ? current.type : 'text';

            const renderButton = ({ label, type, iconName }: { label: string; type: NoteElement['type']; iconName?: keyof typeof Ionicons.glyphMap }) => {
              const isOutlineType = type === 'chapter' || type === 'section' || type === 'subsection';
              const isWordType = type === 'word';
              const isImageType = type === 'image';
              const isActive = currentType === type;
              const hasAnyTextInput = current && current.type !== 'image'
                ? current.type === 'word'
                  ? Boolean((current.word || '').trim().length > 0 || (current.meaning || '').trim().length > 0)
                  : Boolean((current.text || '').trim().length > 0)
                : false;
              const isImageButtonDisabled = isImageType && currentType !== 'image' && hasAnyTextInput;

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

              const iconColor = isActive
                ? '#fff'
                : isOutlineType
                ? '#2F4D3A'
                : isWordType
                ? '#2E4A72'
                : isImageType
                ? '#4D3D7A'
                : '#513D2D';

              const iconSize = type === 'chapter'
                ? 18
                : type === 'section'
                ? 16
                : type === 'subsection'
                ? 14
                : 14;

              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    style.toolbarButton,
                    baseButtonStyle,
                    isActive && activeButtonStyle,
                    isImageButtonDisabled && style.toolbarButtonDisabled,
                  ]}
                  onPress={() => handleTypeChange(type)}
                  disabled={isImageButtonDisabled}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {iconName ? <Ionicons name={iconName} size={iconSize} color={iconColor} style={{ marginRight: 4 }} /> : null}
                    <Text
                      style={[
                        style.toolbarButtonLabel,
                        baseTextStyle,
                        isActive && style.toolbarButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            };

            const textBtn = TOOLBAR_TYPES.find(({ type }) => type === 'text');
            const chapterBtn = TOOLBAR_TYPES.find(({ type }) => type === 'chapter');
            const sectionBtn = TOOLBAR_TYPES.find(({ type }) => type === 'section');
            const subsectionBtn = TOOLBAR_TYPES.find(({ type }) => type === 'subsection');
            const wordBtn = TOOLBAR_TYPES.find(({ type }) => type === 'word');
            const imageBtn = TOOLBAR_TYPES.find(({ type }) => type === 'image');

            return (
              <View style={style.toolbarButtonList}>
                {textBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(textBtn)}</View> : null}

                <View style={style.toolbarOutlineInlineGroup}>
                  <Text style={style.toolbarSectionLabel}>見出し</Text>
                  <View style={style.toolbarOutlineButtons}>
                    {chapterBtn ? renderButton(chapterBtn) : null}
                    {sectionBtn ? renderButton(sectionBtn) : null}
                    {subsectionBtn ? renderButton(subsectionBtn) : null}
                  </View>
                </View>

                {wordBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(wordBtn)}</View> : null}
                {imageBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(imageBtn)}</View> : null}
              </View>
            );
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
    backgroundColor: TOOLBAR_BG,
    borderTopWidth: 1,
    borderTopColor: TOOLBAR_BORDER,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'column',
    flexShrink: 0,
  },
  toolbarSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A6B5D',
    marginBottom: 3,
    alignSelf: 'flex-start',
  },
  toolbarButtonList: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },
  toolbarOutlineInlineGroup: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  toolbarOutlineButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarStandaloneButton: {
    alignSelf: 'flex-end',
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
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

  const ruleStartX = noteX_local + noteWidth_local * space;
  const ruleEndX = noteX_local + noteWidth_local * (1 - space);

  const x1_title = ruleStartX;
  const y1_title = noteY_local + (upperSpace - 1) * interval;
  const x2_title = ruleEndX;
  const y2_title = y1_title;
  canvas.drawLine(x1_title, y1_title, x2_title, y2_title, linePaint);

  const x1 = ruleStartX;
  const y1 = noteY_local + upperSpace * interval;
  const x2 = ruleEndX;
  const y2 = y1;
  canvas.drawLine(x1, y1, x2, y2, linePaint);

  linePaint.setColor(Skia.Color(RULE_COLOR));
  linePaint.setStrokeWidth(1);
  const row = Math.trunc(noteHeight_local / interval) + 2;
  for (let i = upperSpace + 1; i < row - 1; i++) {
    const x1 = ruleStartX;
    const y1 = noteY_local + i * interval;
    const x2 = ruleEndX;
    const y2 = y1;
    canvas.drawLine(x1, y1, x2, y2, linePaint);
  }

  // 最下段の罫線はタイトル線と同じ太さ・色にする
  linePaint.setColor(Skia.Color(TITLE_RULE_COLOR));
  linePaint.setStrokeWidth(1.5);
  const x1_bottom = ruleStartX;
  const y1_bottom = noteY_local + (row - 1) * interval;
  const x2_bottom = ruleEndX;
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
