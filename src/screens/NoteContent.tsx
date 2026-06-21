// ==========================================
// NoteContent.tsx
// ==========================================

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Image, Dimensions, StyleSheet, TextInput, TouchableOpacity, Keyboard, Platform, Animated, ScrollView, Alert, ActionSheetIOS, PixelRatio, Modal } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { ENV } from '@config';
import ImageCropModal from '../components/ImageCropModal';

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
const MARKER_COLORS: { label: string; color: string }[] = [
  { label: '黄', color: 'rgba(255, 235, 59, 0.55)' },
  { label: '緑', color: 'rgba(102, 187, 106, 0.45)' },
  { label: '青', color: 'rgba(66, 165, 245, 0.40)' },
  { label: '赤', color: 'rgba(239, 83, 80, 0.40)' },
  { label: '紫', color: 'rgba(171, 71, 188, 0.40)' },
];
const snapToLineGrid = (height: number, lineHeight: number): number => {
  const safeHeight = Math.max(lineHeight, height);
  return Math.ceil(safeHeight / lineHeight) * lineHeight;
};

const measureLinesFromHeight = (height: number, lineHeight: number): number => {
  // 端数を最も近い整数行数に丸める（0.5行以上なら切り上げ、未満なら切り捨て）
  return Math.max(1, Math.round(height / lineHeight));
};

const OUTLINE_PREFIX_RE = /^\s*\d+(?:\.\d+)*\.\s*/;
const stripOutlinePrefix = (text: string) => text.replace(OUTLINE_PREFIX_RE, '').trimStart();

export type ImageCropRect = { originX: number; originY: number; width: number; height: number };

/** テキスト内のマーカー(ハイライト)範囲。start/end は文字インデックス(end は含まない) */
export type TextMark = { start: number; end: number; color: string };

export type NoteElement =
  | { type: 'chapter'; text: string; autoNumberingDisabled?: boolean; marks?: TextMark[] }
  | { type: 'section'; text: string; autoNumberingDisabled?: boolean; marks?: TextMark[] }
  | { type: 'subsection'; text: string; autoNumberingDisabled?: boolean; marks?: TextMark[] }
  | { type: 'text'; text: string; marks?: TextMark[] }
  | { type: 'word'; word: string; meaning: string }
  | { type: 'image'; uri: string; rows?: number; aspectRatio?: number; originalUri?: string; cropRect?: ImageCropRect };

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
  /** 赤枠（超過）表示状態の通知 */
  onOverflowStateChange?: (hasOverflow: boolean) => void;
};

/** 画像要素がアクティブな間、右端に表示する点滅カーソル(画像はテキストキャレットを持たないため) */
const ImageActiveCursor: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 6,
        top: '50%',
        marginTop: -11,
        width: 2,
        height: 22,
        backgroundColor: ACTIVE_BORDER,
        opacity,
      }}
    />
  );
};

type MarkerHighlightLayerProps = {
  text: string;
  marks: TextMark[] | undefined;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
};

type MarkerLineRange = { start: number; end: number };
type MarkerSegment = { lineIndex: number; markIdx: number; lineStart: number; segStart: number; segEnd: number; color: string };

/**
 * マーカー(ハイライト)を、本物の TextInput の文字とは別レイヤーの色付き矩形として
 * TextInput の背後に描画するコンポーネント。<Text> を文字表示に使わないことで、
 * TextInput と Text の描画位置の微妙なズレ(RNの既知の挙動)を回避する。
 * 矩形の座標は、行分割と各セグメント幅を非表示の計測用 Text (opacity:0) で測って求める。
 */
const MarkerHighlightLayer: React.FC<MarkerHighlightLayerProps> = ({ text, marks, fontSize, lineHeight, fontFamily }) => {
  const [committed, setCommitted] = useState<{ text: string; lineRanges: MarkerLineRange[]; widths: Record<string, number> } | null>(null);
  const [pendingLineRanges, setPendingLineRanges] = useState<MarkerLineRange[] | null>(null);
  const [pendingWidths, setPendingWidths] = useState<Record<string, number>>({});
  // 初回マウント時、親のレイアウトが確定する前に幅0で計測してしまうと行分割がずれて
  // ハイライトが出ないことがあるため、確定した幅(>0)が分かってから計測を始める。
  const [containerWidth, setContainerWidth] = useState(0);
  const measuringKeyRef = useRef<string | null>(null);

  const hasMarks = Boolean(marks && marks.length > 0);

  useEffect(() => {
    if (!hasMarks || containerWidth <= 0) return;
    const key = `${text}@${containerWidth}`;
    if (measuringKeyRef.current === key) return;
    // 新しいテキスト/幅の計測を開始する(完了するまで前回の committed をそのまま表示し続け、ちらつきを防ぐ)
    measuringKeyRef.current = key;
    setPendingLineRanges(null);
    setPendingWidths({});
  }, [text, hasMarks, containerWidth]);

  if (!hasMarks || !text) return null;

  const segments: MarkerSegment[] = [];
  if (pendingLineRanges) {
    pendingLineRanges.forEach((line, lineIndex) => {
      (marks ?? []).forEach((m, markIdx) => {
        const segStart = Math.max(m.start, line.start);
        const segEnd = Math.min(m.end, line.end);
        if (segEnd > segStart) {
          segments.push({ lineIndex, markIdx, lineStart: line.start, segStart, segEnd, color: m.color });
        }
      });
    });
  }

  const widthKey = (seg: MarkerSegment, kind: 'p' | 'm') => `${kind}:${seg.lineIndex}:${seg.markIdx}`;
  const needsPrefixMeasure = (seg: MarkerSegment) => seg.segStart > seg.lineStart && pendingWidths[widthKey(seg, 'p')] === undefined;
  const needsMarkMeasure = (seg: MarkerSegment) => pendingWidths[widthKey(seg, 'm')] === undefined;

  const allMeasured = pendingLineRanges !== null && segments.every((seg) => !needsPrefixMeasure(seg) && !needsMarkMeasure(seg));

  useEffect(() => {
    if (allMeasured && measuringKeyRef.current === `${text}@${containerWidth}`) {
      setCommitted({ text, lineRanges: pendingLineRanges as MarkerLineRange[], widths: pendingWidths });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMeasured, text, containerWidth]);

  const display = committed && committed.text === text ? committed : null;

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== containerWidth) setContainerWidth(w);
      }}
    >
      {/* 表示用: 直前に確定した(古くても良い)計測結果でハイライト矩形を描く */}
      {display && (marks ?? []).map((m, markIdx) => {
        const rects: React.ReactNode[] = [];
        display.lineRanges.forEach((line, lineIndex) => {
          const segStart = Math.max(m.start, line.start);
          const segEnd = Math.min(m.end, line.end);
          if (segEnd <= segStart) return;
          const pKey = `p:${lineIndex}:${markIdx}`;
          const mKey = `m:${lineIndex}:${markIdx}`;
          const x = segStart > line.start ? (display.widths[pKey] ?? 0) : 0;
          const w = display.widths[mKey] ?? 0;
          // 行間(lineHeight)いっぱいではなく、文字の上下(ascender/descender)を含む高さにして
          // 行内で下寄せにする(テキストは textAlignVertical:'top' だが、文字の実際の描画は
          // 行下側に寄っているため、下寄せの方が文字とハイライトの縦位置が揃う)
          const highlightHeight = fontSize * 1.2;
          rects.push(
            <View
              key={`${pKey}-${mKey}`}
              style={{
                position: 'absolute',
                left: x,
                top: lineIndex * lineHeight + (lineHeight - highlightHeight),
                width: w,
                height: highlightHeight,
              }}
            >
              <View style={{ flex: 1, backgroundColor: m.color }} />
            </View>
          );
        });
        return rects;
      })}

      {/* 計測用: 行分割を得るための非表示テキスト(親の幅が確定してから計測する) */}
      {pendingLineRanges === null && containerWidth > 0 && (
        <Text
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
          style={{ position: 'absolute', opacity: 0, fontSize, lineHeight, fontFamily, width: containerWidth }}
          onTextLayout={(e) => {
            const lines = e.nativeEvent.lines;
            let searchFrom = 0;
            const ranges: MarkerLineRange[] = lines.map((line) => {
              let idx = text.indexOf(line.text, searchFrom);
              if (idx === -1) idx = searchFrom;
              const start = idx;
              const end = idx + line.text.length;
              searchFrom = end;
              return { start, end };
            });
            setPendingLineRanges(ranges);
          }}
        >
          {text}
        </Text>
      )}

      {/* 計測用: 各セグメントの前置き幅・マーク幅を測る非表示テキスト */}
      {pendingLineRanges && segments.map((seg) => {
        const needPrefix = needsPrefixMeasure(seg);
        const needMark = needsMarkMeasure(seg);
        if (!needPrefix && !needMark) return null;
        return (
          <React.Fragment key={`measure:${seg.lineIndex}:${seg.markIdx}`}>
            {needPrefix && (
              <Text
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
                numberOfLines={1}
                style={{ position: 'absolute', opacity: 0, fontSize, fontFamily }}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  const key = widthKey(seg, 'p');
                  setPendingWidths((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: w }));
                }}
              >
                {text.slice(seg.lineStart, seg.segStart)}
              </Text>
            )}
            {needMark && (
              <Text
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
                numberOfLines={1}
                style={{ position: 'absolute', opacity: 0, fontSize, fontFamily }}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  const key = widthKey(seg, 'm');
                  setPendingWidths((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: w }));
                }}
              >
                {text.slice(seg.segStart, seg.segEnd)}
              </Text>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const NoteContent: React.FC<Props> = ({ children, backgroundColor, fillBackground = true, elements, onNoteLayout, onSwipePage, onBackgroundGenerated, isEditing, onElementChange, onDeleteElement, onTapEmpty, onSplitToNextTextBlock, onMergeWithPrevious, onEditStart, initialFocusIndex, onOverflowStateChange }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [displayWordLines, setDisplayWordLines] = useState<Record<number, number>>({});
  const [displayTextLines, setDisplayTextLines] = useState<Record<number, number>>({});
  const [measuredTextLines, setMeasuredTextLines] = useState<Record<number, number>>({});
  const [imageRowsEditor, setImageRowsEditor] = useState<{ visible: boolean; idx: number | null; selectedRows: number; dropdownOpen: boolean }>({
    visible: false,
    idx: null,
    selectedRows: 3,
    dropdownOpen: false,
  });

  // 画像選択後、ネイティブの正方形固定トリミングではなく自作の自由トリミングUIで処理するための状態。
  // existingOriginalUri が設定されている場合は「再トリミング」(元画像は保存済みなので再コピー不要)。
  const [cropPickerState, setCropPickerState] = useState<{
    idx: number;
    uri: string;
    width: number;
    height: number;
    initialCropRect?: ImageCropRect;
    existingOriginalUri?: string;
  } | null>(null);

  // 文章系入力の現在の選択範囲(start===endなら選択なし)。ツールバーの「画像」⇔「マーカー」切替に使う
  const [activeMainSelection, setActiveMainSelection] = useState<{ start: number; end: number } | null>(null);
  const [markerColorPickerVisible, setMarkerColorPickerVisible] = useState(false);
  // 「見出し」ボタンをタップすると大/中/小の選択ポップアップを表示する(ツールバーが横にはみ出ないようにするため)
  const [headingPickerVisible, setHeadingPickerVisible] = useState(false);
  // ツールバーのボタンをタップするとTextInputがblurして選択範囲が消えてしまうため、
  // 直近の「空でない」選択範囲をここに保持しておき、マーカー適用時はこちらを使う。
  const lastNonEmptySelectionRef = useRef<{ idx: number; start: number; end: number } | null>(null);

  const measuredWordLinesRef = useRef<Record<number, number>>({});
  const measuredWordTermLinesRef = useRef<Record<number, number>>({});
  const measuredTextLinesRef = useRef<Record<number, number>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const toolbarKeyboardKeeperRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const noteSheetRef = useRef<View | null>(null);
  // word行を押し下げた後のフォーカス先インデックスを保持する ref
  const pendingWordRefocusRef = useRef<number | null>(null);
  // 改行分割後にフォーカスを移す新行インデックス。useLayoutEffect で
  // 描画前に同期フォーカスし、カーソルが一瞬消える（チカっとする）のを防ぐ。
  const pendingSplitFocusRef = useRef<number | null>(null);
  // 要素削除後にフォーカスを移す先のインデックス。useLayoutEffect で
  // elements が縮んだ直後・描画前に同期フォーカスし、削除中のチラつきとフォーカス位置のズレを防ぐ。
  const pendingDeleteFocusRef = useRef<number | null>(null);
  const noteBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
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
  const deleteGuardRef = useRef<{ key: string; ts: number } | null>(null);
  // 改行分割中、ネイティブ TextInput が一瞬 "\n" 入り（2行）を描画した高さを
  // onContentSizeChange が拾って行が伸び→縮みする「高さスラッシング」を抑制するためのガード。
  // until までの間、対象 idx の行数「増加」更新を無視する。
  const splitHeightSuppressRef = useRef<{ idx: number; until: number } | null>(null);
  // mergeWithPrevious の setTimeout をキャンセルするための ref
  const mergeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastElementsLengthRef = useRef<number>(0);
  const effectiveActiveIndex = isEditing && activeIndex === null && initialFocusIndex !== undefined && initialFocusIndex !== null
    ? initialFocusIndex
    : activeIndex;
  activeIndexRef.current = effectiveActiveIndex;
  elementsRef.current = elements;

  // アクティブ行が切り替わったら選択範囲の表示状態をリセットする(別の行に古い選択が残らないように)
  useEffect(() => {
    setActiveMainSelection(null);
    setMarkerColorPickerVisible(false);
    setHeadingPickerVisible(false);
    lastNonEmptySelectionRef.current = null;
  }, [effectiveActiveIndex]);

  useEffect(() => {
    if (isEditing) {
      setDisplayWordLines({});
      setDisplayTextLines({});
      const currentLen = elements?.length ?? 0;
      const prevLen = lastElementsLengthRef.current;
        // 要素が削除される場合、すべての測定値をクリアして再計算させる
        // (インデックスシフトで不正な参照を防ぐ)
        if (currentLen < prevLen) {
          measuredWordLinesRef.current = {};
          measuredWordTermLinesRef.current = {};
          measuredTextLinesRef.current = {};
          setMeasuredTextLines({});
        }
      lastElementsLengthRef.current = currentLen;
      return;
    }
    const currentLen = elements?.length ?? 0;
    lastElementsLengthRef.current = currentLen;
    setDisplayWordLines({ ...measuredWordLinesRef.current });
    setDisplayTextLines({ ...measuredTextLinesRef.current });
  }, [isEditing, elements]);





  const TOOLBAR_TYPES: { label: string; type: NoteElement['type']; iconName?: keyof typeof Ionicons.glyphMap }[] = [
    { label: '文章', type: 'text', iconName: 'text-outline' },
    { label: '大', type: 'chapter' },
    { label: '中', type: 'section' },
    { label: '小', type: 'subsection' },
    { label: '単語/意味', type: 'word', iconName: 'list-outline' },
    { label: '画像', type: 'image', iconName: 'image-outline' },
  ];

  const noteX = PixelRatio.roundToNearestPixel((width - width * 0.98) / 2);
  const noteY = PixelRatio.roundToNearestPixel(NOTE_OUTER_MARGIN);
  const noteWidth = PixelRatio.roundToNearestPixel(width * 0.98);
  const noteHeight = PixelRatio.roundToNearestPixel((height - headerHeight) * 0.87 - noteY);
  const bottomMargin = Math.round((height - headerHeight) * 0.13);

  // 1画面に収まる最大行数（先頭行も入力可能にする）
  // 1画面に収まる最大行数（最上段1行は非編集として予約）
  const maxRows = Math.max(1, Math.floor((noteHeight - RESERVED_TOP_LINES * interval) / interval));
  const totalRuleRows = maxRows + RESERVED_TOP_LINES;
  const IMAGE_MIN_ROWS = 1;
  const IMAGE_MAX_ROWS = 10;
  const IMAGE_DEFAULT_ROWS = 3;
  const IMAGE_CONTENT_WIDTH = noteWidth * (1 - 2 * space);

  const resolveImageRows = (rows?: number) => {
    const safeRows = Number.isFinite(rows) ? Math.round(rows as number) : IMAGE_DEFAULT_ROWS;
    return Math.max(IMAGE_MIN_ROWS, Math.min(IMAGE_MAX_ROWS, safeRows));
  };

  const resolveImageAspectRatio = (aspectRatio?: number) => {
    if (!Number.isFinite(aspectRatio)) return undefined;
    const safe = Number(aspectRatio);
    return safe > 0 ? safe : undefined;
  };

  const getImageHeight = (el: Extract<NoteElement, { type: 'image' }>) => {
    const ratio = resolveImageAspectRatio(el.aspectRatio);
    if (ratio) {
      const naturalHeight = IMAGE_CONTENT_WIDTH / ratio;
      return snapToLineGrid(naturalHeight, interval);
    }
    return interval * resolveImageRows(el.rows);
  };

  const getDisplayedImageRows = (el: Extract<NoteElement, { type: 'image' }>) => {
    return resolveImageRows(Math.round(getImageHeight(el) / interval));
  };

  // 要素1つの表示高さを返す
  const getElementHeight = (el: NoteElement): number => {
    const font = FONT_MAP[el.type];
    if (el.type === 'image') return snapToLineGrid(getImageHeight(el), interval);
    const contentWidth = noteWidth * (1 - 2 * space);
    if (el.type === 'word') {
      const usable = Math.max(1, contentWidth - 12); // paddingHorizontal: 6 * 2
      const meaning = ((el as any).meaning || '') as string;
      const word = (el.word || '') as string;
      // 実際のレイアウト: flex: 0.5（単語）と flex: 0.6（意味）
      // 単語列には先頭の「.」と末尾の「...」の両方が同じ行に並ぶため、その分を引く
      const termWidth = Math.max(1, usable * 0.5 / 1.1 - 44);
      const meaningWidth = Math.max(1, usable * 0.6 / 1.1 - 4); // paddingLeft: 4
      const termFontSize = font.size + 2;
      const termCharsPerLine = Math.max(4, Math.floor(termWidth / Math.max(1, termFontSize)));
      const meaningCharsPerLine = Math.max(6, Math.floor(meaningWidth / Math.max(1, font.size)));
      const termLines = word.trim().length === 0 ? 1 : word
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / termCharsPerLine)), 0);
      const meaningLines = meaning.trim().length === 0 ? 1 : meaning
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / meaningCharsPerLine)), 0);
      return snapToLineGrid(Math.max(termLines, meaningLines) * font.lineHeight, font.lineHeight);
    }

    const text = 'text' in el ? el.text : '';
    const linesByNewLine = Math.max(1, text.split('\n').length);
    return snapToLineGrid(linesByNewLine * font.lineHeight, font.lineHeight);
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
    if (el.type === 'image') return getElementHeight(el);
    if (el.type === 'word') {
      // onContentSizeChange のフィードバックに依存せず、
      // getElementHeight（文字数ベースの計算）で高さを決定する
      return getElementHeight(el);
    }
    // テキスト系：実測値があれば優先して使う（自動改行による高さズレを防ぐ）
    const textValue = 'text' in el ? el.text : ((el as any).text || '');
    if (textValue.trim().length === 0) {
      return font.lineHeight;
    }
    // 実測値（onContentSizeChange で更新）があれば常に優先する
    const measuredFromRef = measuredTextLinesRef.current[idx];
    if (measuredFromRef) {
      return snapToLineGrid(measuredFromRef * font.lineHeight, font.lineHeight);
    }
    if (isEditing) {
      // 実測値未到着時のフォールバック：文字数ベースの推定
      const lineCount = textValue === '' ? 1 : textValue.split('\n').reduce((sum: number, line: string) => {
        return sum + Math.max(1, Math.ceil(line.length / Math.max(8, Math.floor((noteWidth * (1 - 2 * space) - 12) / Math.max(1, font.size)) - 1)));
      }, 0);
      return snapToLineGrid(Math.max(1, lineCount) * font.lineHeight, font.lineHeight);
    }
    // 非編集中：測定値を使う
    const measuredLines = measuredTextLines[idx] ?? 0;
    const fallbackLines = Math.max(1, textValue.split('\n').length);
    return snapToLineGrid((measuredLines || fallbackLines) * font.lineHeight, font.lineHeight);
  };

  const getConsumedRows = (items: NoteElement[] | undefined): number => {
    if (!items || items.length === 0) return 0;
    let usedHeight = 0;
    items.forEach((el, idx) => {
      if (!isValidElement(el)) return;
      usedHeight += getRowHeight(el, idx);
    });
    return Math.ceil(usedHeight / interval);
  };

  useEffect(() => {
    if (!onOverflowStateChange) return;
    const capacityHeight = maxRows * interval;
    let consumedHeight = 0;
    let hasOverflow = false;

    (elements ?? []).forEach((el, idx) => {
      if (!isValidElement(el)) return;
      const h = getRowHeight(el, idx);
      // 空白・改行のみのテキスト行は超過判定に含めない
      const isBlankOnly = el.type === 'text' && (el.text || '').trim().length === 0;
      if (!hasOverflow && !isBlankOnly && consumedHeight + h > capacityHeight) {
        hasOverflow = true;
      }
      if (!hasOverflow) {
        consumedHeight += h;
      }
    });

    onOverflowStateChange(hasOverflow);
  }, [elements, isEditing, measuredTextLines, displayWordLines, maxRows, noteWidth, onOverflowStateChange]);

  const updateMeasuredTextLines = (idx: number, nextLines: number) => {
    const lines = Math.max(1, nextLines);
    setMeasuredTextLines((prev) => {
      if (prev[idx] === lines) return prev;
      return { ...prev, [idx]: lines };
    });
  };

  // 配列インデックスをキーにしている数値レコードを、insertAt 位置に1要素挿入された
  // 前提でシフトする（k >= insertAt の値を k+1 へ移し、insertAt は空にする）。
  // 改行などで要素を挿入すると以降のインデックスが1つずれるため、行高キャッシュを
  // シフトしないと「前にそこにあった要素の高さ」で1フレーム描画されてチラつく。
  const shiftIndexRecordForInsert = (
    rec: Record<number, number>,
    insertAt: number
  ): Record<number, number> => {
    const next: Record<number, number> = {};
    Object.keys(rec).forEach((k) => {
      const ki = Number(k);
      if (ki >= insertAt) next[ki + 1] = rec[ki];
      else next[ki] = rec[ki];
    });
    return next;
  };

  // 改行で insertAt（= 新しい行のインデックス）に空要素が挿入される直前に、
  // インデックスキーの各種行高キャッシュを同期的にシフトしておく。
  const shiftLineCachesForInsert = (insertAt: number) => {
    measuredTextLinesRef.current = shiftIndexRecordForInsert(measuredTextLinesRef.current, insertAt);
    measuredWordLinesRef.current = shiftIndexRecordForInsert(measuredWordLinesRef.current, insertAt);
    measuredWordTermLinesRef.current = shiftIndexRecordForInsert(measuredWordTermLinesRef.current, insertAt);
    setMeasuredTextLines((prev) => shiftIndexRecordForInsert(prev, insertAt));
    setDisplayTextLines((prev) => shiftIndexRecordForInsert(prev, insertAt));
    setDisplayWordLines((prev) => shiftIndexRecordForInsert(prev, insertAt));
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
      // アニメーションなしで即リセットし、サムネイルキャプチャ時にスクロールがずれないようにする
      scrollToPosition(0, false);
    }
  }, [isEditing]);

  // 編集モード開始時に initialFocusIndex の要素にフォーカス
  useEffect(() => {
    if (isEditing && initialFocusIndex !== undefined && initialFocusIndex !== null) {
      console.log(`[initialFocusIndex useEffect] フォーカス先: ${initialFocusIndex}`);
      setActiveIndex(initialFocusIndex);
      shouldDisableNextScrollAnimationRef.current = true;
      // 要素のマウント完了を待ってからフォーカス
      requestAnimationFrame(() => {
        focusElementInput(initialFocusIndex);
      });
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

  // 文字入力による自動改行でアクティブ行の高さが変わったときにスクロールを追従させる
  const activeRowMeasuredLines =
    effectiveActiveIndex !== null ? (measuredTextLines[effectiveActiveIndex] ?? null) : null;
  useEffect(() => {
    if (effectiveActiveIndex === null || !keyboardVisible || !isEditing || !elements) return;
    const activeElement = elements[effectiveActiveIndex];
    if (!isValidElement(activeElement)) return;
    if (activeElement.type !== 'text' && activeElement.type !== 'chapter' &&
        activeElement.type !== 'section' && activeElement.type !== 'subsection') return;
    const coveredByKb = Math.max(0, keyboardHeight - bottomMargin);
    const visibleHeight = noteHeight - coveredByKb;
    const measuredLines = measuredTextLinesRef.current[effectiveActiveIndex] ?? 1;
    const font = FONT_MAP[activeElement.type];
    let elementTop = RESERVED_TOP_LINES * interval;
    for (let i = 0; i < effectiveActiveIndex && i < elements.length; i++) {
      const el = elements[i];
      if (!isValidElement(el)) continue;
      if ((el.type === 'text' || el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') && measuredTextLinesRef.current[i]) {
        const elFont = FONT_MAP[el.type];
        elementTop += snapToLineGrid(measuredTextLinesRef.current[i] * elFont.lineHeight, elFont.lineHeight);
      } else {
        elementTop += getRowHeight(el, i);
      }
    }
    const elementBottom = elementTop + snapToLineGrid(measuredLines * font.lineHeight, font.lineHeight);
    const currentScrollY = scrollOffsetRef.current;
    const visibleBottom = currentScrollY + visibleHeight;
    if (elementBottom > visibleBottom - interval) {
      scrollToPosition(elementBottom - visibleHeight + interval, true);
    }
  }, [activeRowMeasuredLines]);

  // word行の押し下げ後に word フィールドへフォーカスを戻す
  useEffect(() => {
    const pending = pendingWordRefocusRef.current;
    if (pending === null) return;
    if (!elements || elements.length <= pending) return;
    const targetEl = elements[pending];
    if (targetEl?.type !== 'word') return;
    pendingWordRefocusRef.current = null;
    setActiveIndex(pending);
    // mount 完了を待たずに即時フォーカス
    const ref = inputRefs.current[getInputKey(pending, 'word')];
    if (ref) {
      try { ref.focus(); } catch (_) {}
    } else {
      requestAnimationFrame(() => focusElementInput(pending, 'word'));
    }
  }, [elements?.length]);

  // 改行分割後のフォーカス移動を「描画前」に同期実行する。
  // setTimeout + requestAnimationFrame だと現在行のフォーカスが外れてから新行へ
  // フォーカスが当たるまでに空白フレームが生じ、カーソルが一瞬消えて（チカっと）見える。
  // useLayoutEffect は新要素マウント後・描画前に走るため、ここで focus すれば
  // カーソルが現在行→新行へ途切れずに移り、消える瞬間がなくなる。
  useLayoutEffect(() => {
    const pending = pendingSplitFocusRef.current;
    if (pending === null) return;
    if (!elements || elements.length <= pending) return;
    pendingSplitFocusRef.current = null;
    const ref = inputRefs.current[getInputKey(pending, 'main')];
    if (ref) {
      try { ref.focus(); } catch (_) {}
    } else {
      // 万一未マウントなら次フレームで再試行（通常は到達しない）
      requestAnimationFrame(() => focusElementInput(pending));
    }
  }, [elements?.length]);

  // 要素削除後のフォーカス移動も「描画前」に同期実行する。setTimeout だと
  // 親の state 更新タイミングによっては inputRefs が未更新のままで前の要素に
  // フォールバックしてしまうため、elements が縮んだ直後・描画前に確実に処理する。
  useLayoutEffect(() => {
    const pending = pendingDeleteFocusRef.current;
    if (pending === null) return;
    pendingDeleteFocusRef.current = null;
    focusElementOrPrev(pending);
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

  const handleRowResponderRelease = (e: any, onTap: () => void) => {
    if (swipeStateRef.current.swiped) {
      swipeStateRef.current.swiped = false;
      return;
    }

    const x = e?.nativeEvent?.pageX;
    const y = e?.nativeEvent?.pageY;
    if (typeof x === 'number' && typeof y === 'number') {
      const bounds = noteBoundsRef.current;
      const isInsideNote = bounds
        ? x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height
        : x >= noteX && x <= noteX + noteWidth && y >= noteY && y <= noteY + noteHeight;
      if (!isInsideNote) {
        return;
      }
    }

    onTap();
  };

  const focusElementInput = (index: number, wordField: 'word' | 'meaning' = 'word') => {
    const target = elements?.[index];
    if (!isValidElement(target)) return;

    const key = target.type === 'word' ? getInputKey(index, wordField) : getInputKey(index, 'main');
    const ref = inputRefs.current[key];
    if (!ref) {
      // マーカー付き行は非アクティブ時 Text 表示のため main の ref が無く、
      // アクティブ化の再描画でTextInputが生成された直後はrefがまだ無い場合がある→少し待って再試行
      setTimeout(() => {
        try { inputRefs.current[key]?.focus(); } catch (_) {}
      }, 30);
      return;
    }

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
      setActiveIndex(i);
      const targetField = prevEl.type === 'word' ? 'meaning' : 'word';
      setTimeout(() => focusElementInput(i, targetField), 30);
      return;
    }
  };

  // 要素削除後、削除した行の位置に詰めて入ってくる要素へフォーカスする。
  // 削除した行が最後の行だった場合(詰めてくる要素がない場合)は、前の要素に戻るのではなく
  // その位置に空の文章行を残してそこにフォーカスし、カーソル位置が後退しないようにする。
  const focusElementOrPrev = (index: number) => {
    const mainRef = inputRefs.current[getInputKey(index, 'main')];
    if (mainRef) {
      setActiveIndex(index);
      try { mainRef.focus(); } catch (_) {}
      return;
    }
    const wordRef = inputRefs.current[getInputKey(index, 'word')];
    if (wordRef) {
      setActiveIndex(index);
      try { wordRef.focus(); } catch (_) {}
      return;
    }
    if (elements && getConsumedRows(elements) < maxRows) {
      setActiveIndex(index);
      onTapEmpty?.(index);
      return;
    }
    focusPrevElement(index);
  };

  const focusNextElement = (index: number) => {
    if (!elements) return;
    for (let i = index + 1; i < elements.length; i++) {
      const nextEl = elements[i];
      if (!isValidElement(nextEl)) continue;
      // キーボード追従のスクロール調整をアニメ無しにする。
      // アニメ付きだと、行が変わった瞬間にノート全体がスーッと上にずれるのが
      // 「内容がブレる」ように見えてしまう。
      shouldDisableNextScrollAnimationRef.current = true;
      setActiveIndex(i);
      // 既存の要素は ref がすでにマウント済みなので即座にフォーカスする。
      // setTimeout/requestAnimationFrame を挟むと、ハイライト(枠線)だけ先に移動して
      // 実際のフォーカスが遅れて追従するため、一瞬内容がズレて見える(ブレる)。
      const field = nextEl.type === 'word' ? 'word' : 'main';
      const ref = inputRefs.current[getInputKey(i, field)];
      if (ref) {
        try { ref.focus(); } catch (_) {}
      } else {
        setTimeout(() => focusElementInput(i), 30);
      }
      return;
    }
    // 末尾でも、実際の消費行数が maxRows 未満なら新しい行を追加
    if (getConsumedRows(elements) < maxRows) {
      const nextIndex = index + 1;
      pendingFocusAfterAddRef.current = nextIndex;
      setActiveIndex(nextIndex);
      onTapEmpty?.(nextIndex);
    }
    // maxRows を超える場合は何もしない（上限に達しているため）
  };

  const convertElementType = (el: NoteElement, type: NoteElement['type']): NoteElement => {
    if (type === 'image') {
      return {
        type: 'image',
        uri: el.type === 'image' ? el.uri : '',
        rows: el.type === 'image' ? el.rows : IMAGE_DEFAULT_ROWS,
        aspectRatio: el.type === 'image' ? el.aspectRatio : undefined,
      };
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

  // 変換後の要素タイプに応じた入力欄へフォーカスする。
  // focusElementInput は elements(変換前のスナップショットがクロージャに残る)から
  // 要素タイプを再判定するため、変換直後はまだ古いタイプで判定してしまい、
  // 単語要素の 'word' フィールドではなく存在しない 'main' キーを探してフォーカスが
  // 当たらないことがある。ここでは変換後に確定している type を直接使ってフォーカスする。
  const focusConvertedField = (index: number, type: NoteElement['type']) => {
    if (type === 'image') return;
    const field = type === 'word' ? 'word' : 'main';
    const key = getInputKey(index, field);
    const ref = inputRefs.current[key];
    if (ref) {
      try { ref.focus(); } catch (_) {}
    } else {
      setTimeout(() => {
        try { inputRefs.current[key]?.focus(); } catch (_) {}
      }, 30);
    }
  };

  const handleTypeChange = (type: NoteElement['type']) => {
    setHeadingPickerVisible(false);
    if (activeIndex === null || !elements?.[activeIndex]) return;
    const current = elements[activeIndex];
    const hasAnyTextInput = current.type === 'word'
      ? Boolean((current.word || '').trim().length > 0 || (current.meaning || '').trim().length > 0)
      : current.type === 'image'
      ? false
      : Boolean((current.text || '').trim().length > 0);

    // 画像以外の要素で1文字以上入力済みなら、画像への変換は不可
    if (type === 'image' && current.type !== 'image' && hasAnyTextInput) return;

    // タイプ変換で現在の Input がアンマウントされる前に keeper へフォーカスしてキーボードを維持する
    // (画像への変換時も、変換先のhidden InputがautoFocusで取得するまでのキーボードのチラつきを防ぐため必須)
    try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}

    if (current.type === type) {
      // 同じボタンをもう一度押すと、その属性を取り消して文章に戻す(文章自体は取り消し対象なし)
      if (type === 'text') return;
      const reverted = convertElementType(current, 'text');
      onElementChange?.(activeIndex, reverted);
      setTimeout(() => focusConvertedField(activeIndex, 'text'), 50);
      return;
    }

    const converted = convertElementType(current, type);
    onElementChange?.(activeIndex, converted);
    setTimeout(() => focusConvertedField(activeIndex, type), 50);
  };

  // テキスト編集(挿入/削除)に合わせてマーカー範囲の文字位置を補正する。
  // 編集範囲より前のマーカーはそのまま、後ろのマーカーは差分だけシフトし、
  // 編集範囲の内側にかかる境界は編集後の範囲の端にスナップする。
  const rebaseMarks = (marks: TextMark[] | undefined, oldText: string, newText: string): TextMark[] | undefined => {
    if (!marks || marks.length === 0) return marks;
    if (oldText === newText) return marks;
    const minLen = Math.min(oldText.length, newText.length);
    let prefix = 0;
    while (prefix < minLen && oldText[prefix] === newText[prefix]) prefix++;
    let suffix = 0;
    while (suffix < minLen - prefix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
    const oldEditEnd = oldText.length - suffix;
    const newEditEnd = newText.length - suffix;
    const editStart = prefix;
    const delta = newEditEnd - oldEditEnd;

    const mapPos = (p: number, isEnd: boolean): number => {
      if (p <= editStart) return p;
      if (p >= oldEditEnd) return p + delta;
      return isEnd ? newEditEnd : editStart;
    };

    const rebased = marks
      .map((m) => {
        const start = mapPos(m.start, false);
        const end = mapPos(m.end, true);
        return { start: Math.min(start, end), end: Math.max(start, end), color: m.color };
      })
      .filter((m) => m.end > m.start);
    return rebased.length > 0 ? rebased : undefined;
  };

  // 範囲[eraseStart, eraseEnd)を既存マーカーから取り除く(部分的に被る場合は分割する)
  const subtractMarkRange = (marks: TextMark[], eraseStart: number, eraseEnd: number): TextMark[] => {
    const result: TextMark[] = [];
    for (const m of marks) {
      if (m.end <= eraseStart || m.start >= eraseEnd) {
        result.push(m);
        continue;
      }
      if (m.start < eraseStart) result.push({ start: m.start, end: eraseStart, color: m.color });
      if (m.end > eraseEnd) result.push({ start: eraseEnd, end: m.end, color: m.color });
    }
    return result;
  };

  // 選択中の文字範囲にマーカー(ハイライト)を付ける/消す。選択は表示モードに戻った時に反映される。
  // color が null の場合は「消す(無色)」として選択範囲のマーカーを取り除く。
  // ツールバーのボタンタップでTextInputがblurし選択が消えることがあるため、
  // 直近の「空でない」選択を保持した lastNonEmptySelectionRef を使う(selectionRef の最新値だと消えている場合がある)。
  const applyMarkerToSelection = (color: string | null) => {
    setMarkerColorPickerVisible(false);
    const frozen = lastNonEmptySelectionRef.current;
    if (!frozen || !elements?.[frozen.idx]) return;
    const current = elements[frozen.idx];
    if (current.type === 'word' || current.type === 'image') return;
    const start = Math.min(frozen.start, frozen.end);
    const end = Math.max(frozen.start, frozen.end);
    if (start === end) return;
    const cleared = subtractMarkRange(current.marks ?? [], start, end);
    const nextMarks = color === null ? cleared : [...cleared, { start, end, color }];
    onElementChange?.(frozen.idx, { ...current, marks: nextMarks.length > 0 ? nextMarks : undefined } as NoteElement);
    lastNonEmptySelectionRef.current = null;
  };

  const applyCroppedImage = (
    payload: { uri: string; width?: number; height?: number; originalUri: string; cropRect: ImageCropRect },
    idx: number
  ) => {
    const pickedAspect = payload.width && payload.height && payload.height > 0
      ? payload.width / payload.height
      : undefined;
    const current = elements?.[idx];
    if (current?.type === 'image') {
      const nextAspectRatio = resolveImageAspectRatio(pickedAspect) ?? current.aspectRatio;
      const nextRows = current.uri
        ? (current.rows ?? IMAGE_DEFAULT_ROWS)
        : getDisplayedImageRows({
            type: 'image',
            uri: payload.uri,
            rows: current.rows ?? IMAGE_DEFAULT_ROWS,
            aspectRatio: nextAspectRatio,
          });
      onElementChange?.(idx, {
        type: 'image',
        uri: payload.uri,
        rows: nextRows,
        aspectRatio: nextAspectRatio,
        originalUri: payload.originalUri,
        cropRect: payload.cropRect,
      });
    }
  };

  const setImageRows = (idx: number, rows: number) => {
    const current = elements?.[idx];
    if (current?.type !== 'image') return;
    onElementChange?.(idx, { ...current, rows: resolveImageRows(rows), aspectRatio: undefined });
  };

  const openImageRowsEditor = (idx: number) => {
    const current = elements?.[idx];
    const currentRows = current?.type === 'image' ? getDisplayedImageRows(current) : IMAGE_DEFAULT_ROWS;
    setImageRowsEditor({
      visible: true,
      idx,
      selectedRows: currentRows,
      dropdownOpen: false,
    });
  };

  const closeImageRowsEditor = () => {
    setImageRowsEditor((prev) => ({ ...prev, visible: false }));
  };

  const applyImageRowsEditor = () => {
    if (imageRowsEditor.idx === null) {
      closeImageRowsEditor();
      return;
    }
    setImageRows(imageRowsEditor.idx, imageRowsEditor.selectedRows);
    closeImageRowsEditor();
  };

  const launchImagePicker = async (useCamera: boolean, idx: number) => {
    // allowsEditing(ネイティブの編集UI)はiOSだと正方形固定になるため使わず、
    // 元画像をそのまま受け取って自作の自由トリミングUI(ImageCropModal)に渡す
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setCropPickerState({ idx, uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 });
  };

  const handleCropCancel = () => setCropPickerState(null);

  const handleCropConfirm = async (cropped: { uri: string; width: number; height: number; cropRect: ImageCropRect }) => {
    const state = cropPickerState;
    setCropPickerState(null);
    if (!state) return;

    const destCropped = `${FileSystem.documentDirectory}note_img_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: cropped.uri, to: destCropped });

    // 新規追加時は元画像も保存しておき、後から「トリミングを修正」できるようにする。
    // 再トリミング時は既に保存済みの元画像をそのまま使う。
    let originalUri = state.existingOriginalUri;
    if (!originalUri) {
      const destOriginal = `${FileSystem.documentDirectory}note_img_orig_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: state.uri, to: destOriginal });
      originalUri = destOriginal;
    }

    applyCroppedImage(
      { uri: destCropped, width: cropped.width, height: cropped.height, originalUri, cropRect: cropped.cropRect },
      state.idx
    );
  };

  // 既にトリミング済みの画像要素について、元画像を読み込んで再トリミングUIを開く
  const reopenCropEditor = async (idx: number) => {
    const current = elements?.[idx];
    if (current?.type !== 'image' || !current.uri) return;
    const originalUri = current.originalUri || current.uri;
    try {
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(originalUri, (w, h) => resolve({ width: w, height: h }), reject);
      });
      setCropPickerState({
        idx,
        uri: originalUri,
        width,
        height,
        initialCropRect: current.cropRect,
        existingOriginalUri: originalUri,
      });
    } catch (e) {
      console.error('元画像の取得に失敗:', e);
      Alert.alert('エラー', '元画像を読み込めませんでした。');
    }
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
        ? ['キャンセル', '写真ライブラリ', 'カメラで撮影', '行数を変更', 'トリミングを修正', '画像を削除']
        : ['キャンセル', '写真ライブラリ', 'カメラで撮影', '要素を削除'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: hasImage ? 5 : 3 },
        async (buttonIndex) => {
          if (buttonIndex === 1) await launchImagePicker(false, idx);
          if (buttonIndex === 2) await launchImagePicker(true, idx);
          if (hasImage && buttonIndex === 3) openImageRowsEditor(idx);
          if (hasImage && buttonIndex === 4) await reopenCropEditor(idx);
          if (buttonIndex === (hasImage ? 5 : 3)) {
            // 要素削除でInputがアンマウントされる前にkeeperへフォーカスしてキーボードを維持
            try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
            pendingDeleteFocusRef.current = idx;
            onDeleteElement?.(idx);
          }
        }
      );
    } else {
      const menuButtons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [
        { text: 'キャンセル', style: 'cancel' },
        { text: '写真ライブラリ', onPress: () => launchImagePicker(false, idx) },
        { text: 'カメラで撮影', onPress: () => launchImagePicker(true, idx) },
      ];
      if (hasImage) {
        menuButtons.push({ text: '行数を変更', onPress: () => openImageRowsEditor(idx) });
        menuButtons.push({ text: 'トリミングを修正', onPress: () => reopenCropEditor(idx) });
      }
      menuButtons.push({
        text: hasImage ? '画像を削除' : '要素を削除',
        style: 'destructive',
        onPress: () => {
          try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
          pendingDeleteFocusRef.current = idx;
          onDeleteElement?.(idx);
        },
      });
      Alert.alert(hasImage ? '画像の操作' : '画像を追加', '', menuButtons);
    }
  };

  const splitToNextTextBlock = (index: number, currentText: string, splitAt: number) => {
    console.log(`[splitToNextTextBlock] START idx=${index}, splitAt=${splitAt}, text.length=${currentText.length}`);
    const safeSplitAt = Math.max(0, Math.min(splitAt, currentText.length));
    const before = currentText.slice(0, safeSplitAt);
    const after = currentText.slice(safeSplitAt);
    console.log(`[splitToNextTextBlock] before="${before}", after="${after}"`);

    // 次の行のインデックス
    const nextIdx = index + 1;

    // ここではキーパーへフォーカスを逃がさない。
    // キーパー経由だと「現行→（画面外でカーソルが一旦消える）→新行」と
    // カーソルが点滅して見える。現行(index)は新行へフォーカスを移すまで
    // マウント・フォーカスを保持したままなのでキーボードは閉じず、
    // カーソルは index 末尾→nextIdx 先頭へ一回だけ滑らかに移動する。

    const inserted = onSplitToNextTextBlock?.(index, before, after);
    if (inserted !== undefined) {
      if (inserted === false) {
        console.log(`[splitToNextTextBlock] 親が false を返したため中断`);
        return;
      }
      console.log(`[splitToNextTextBlock] 親で処理完了、次の行(${nextIdx})にフォーカス移動を準備`);

      // 親が nextIdx に空要素を挿入したことで、それ以降のインデックスが1つずれる。
      // 行高キャッシュ（インデックスキー）を同じバッチで同期シフトしておかないと、
      // 挿入位置以降の行が「前にそこにあった要素の高さ」で1フレーム描画され、
      // 行の高さがガクッと揺れてチラついて見える。
      shiftLineCachesForInsert(nextIdx);

      // アクティブ行（ハイライト）の移動は状態更新と同じバッチで同期的に行う。
      // setTimeout に入れると現在行がハイライトされたまま1フレーム残り、遅れて
      // 移動する段差が見えてチラつくため、ここで即座に nextIdx へ移す。
      setActiveIndex(nextIdx);
      activeIndexRef.current = nextIdx;

      // フォーカス移動は useLayoutEffect（描画前・新要素マウント後）で同期実行する。
      // ここで予約だけしておく。setTimeout/rAF を使わないことで、現在行→新行への
      // フォーカス移動に空白フレームが入らず、カーソルが一瞬消える（チカっと）のを防ぐ。
      pendingSplitFocusRef.current = nextIdx;

      return;
    }

    console.log(`[splitToNextTextBlock] フォールバック処理開始`);
    const current = elements?.[index];
    if (!isValidElement(current) || !('text' in current)) {
      console.log(`[splitToNextTextBlock] 無効な要素、中断`);
      return;
    }
    
    onElementChange?.(index, { ...current, text: before } as any);
    const fallbackInserted = onTapEmpty?.(index + 1);
    if (fallbackInserted === false) {
      console.log(`[splitToNextTextBlock] onTapEmptyがfalseを返したため中断`);
      return;
    }

    console.log(`[splitToNextTextBlock] フォールバック: 次の行に要素追加`);
    
    setTimeout(() => {
      onElementChange?.(index + 1, { type: 'text', text: after });
      console.log(`[splitToNextTextBlock] フォールバック: after設定完了`);
      
      // 状態更新とフォーカスを次のフレームで実行
      requestAnimationFrame(() => {
        setActiveIndex(nextIdx);
        activeIndexRef.current = nextIdx;
        focusElementInput(nextIdx);
      });
    }, 0);
  };

  const splitByEnter = (index: number, currentText: string) => {
    console.log(`[splitByEnter] idx=${index}, currentText.length=${currentText.length}`);
    
    const key = getInputKey(index, 'main');
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
      const isTitleLine = row <= 2 || row === totalRuleRows;
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
      const h = getRowHeight(el, idx);
      const isBlankOnly = el.type === 'text' && (el.text || '').trim().length === 0;
      if (overflowStartIndex === null && !isBlankOnly && consumedHeight + h > capacityHeight) {
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
      const estHeight = getRowHeight(el, idx);
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
            onResponderRelease={(e) =>
              handleRowResponderRelease(e, () => {
                if (!isEditing) {
                  onEditStart?.(idx);
                  return;
                }
                setActiveIndex(idx);
                Keyboard.dismiss();
                showImageEditMenu(idx, Boolean(el.uri));
              })
            }
            style={{
              height: getImageHeight(el),
              borderWidth: isEditing && effectiveActiveIndex === idx ? 2 : 1,
              borderColor: ACTIVE_BORDER,
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              ...debugStyle,
            }}
          >
            {isEditing && effectiveActiveIndex === idx && <ImageActiveCursor />}
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
                  else {
                    setActiveIndex(idx);
                    Keyboard.dismiss();
                    showImageEditMenu(idx, false);
                  }
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
            {isEditing && (
              <TextInput
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
                ref={(ref) => { inputRefs.current[getInputKey(idx, 'main')] = ref; }}
                autoFocus={effectiveActiveIndex === idx}
                onFocus={() => setActiveIndex(idx)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace') {
                    // 要素削除でInputがアンマウントされる前にkeeperへフォーカスしてキーボードを維持
                    try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
                    pendingDeleteFocusRef.current = idx;
                    onDeleteElement?.(idx);
                  }
                }}
                onSubmitEditing={() => focusNextElement(idx)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 1,
                  height: 1,
                  opacity: 0,
                  padding: 0,
                  includeFontPadding: false,
                }}
                multiline={false}
                blurOnSubmit={false}
                showSoftInputOnFocus={true}
              />
            )}
          </View>
        );
        return;
      }

      if (el.type === 'word') {
        const isOverflow = overflowStartIndex !== null && idx >= overflowStartIndex;
        const WORD_ELLIPSIS_COLOR = 'rgba(52, 52, 52, 0.5)';
        const WORD_TERM_FONT_SIZE = font.size + 2;
        rendered.push(
          <View
            key={idx}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleRowResponderGrant}
            onResponderMove={handleRowResponderMove}
            onResponderRelease={(e) =>
              handleRowResponderRelease(e, () => {
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
              backgroundColor: isEditing && effectiveActiveIndex === idx
                ? ACTIVE_TINT
                : 'transparent',
              alignItems: 'stretch',
              borderWidth: 0,
              borderColor: 'transparent',
              overflow: 'hidden',
              ...debugStyle,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 6, paddingVertical: 0 }}>
              <View style={{ flex: 0.5, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: interval }}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1}
                  style={{
                    fontSize: font.size + 10,
                    lineHeight: interval,
                    fontFamily: font.family,
                    fontWeight: '700',
                    color: WORD_ELLIPSIS_COLOR,
                    marginRight: 2,
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  }}
                >
                  .
                </Text>
                {isEditing ? (
                  <TextInput
                    allowFontScaling={false}
                    maxFontSizeMultiplier={1}
                    value={el.word}
                    onChangeText={(t) => {
                      // Enter キーで \n が混入するのを防ぐ
                      if (t.includes('\n')) return;
                      onElementChange?.(idx, { ...el, word: t });
                    }}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace') {
                        const isWordEmpty = !(el.word || '').trim();
                        const isMeaningEmpty = !(((el as any).meaning || '') as string).trim();
                        if (isWordEmpty && isMeaningEmpty) {
                          // 両方空のとき → 文章ツールに変換（行は残す）
                          console.log(`[単語/意味 両方空削除] idx=${idx} を文章ツールに変換`);
                          // 型変換でInputがアンマウントされる前にkeeperへフォーカスしてキーボードを維持
                          try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
                          onElementChange?.(idx, { type: 'text', text: '' });
                          // フォーカスを維持
                          setTimeout(() => {
                            const textKey = getInputKey(idx, 'main');
                            const textRef = inputRefs.current[textKey];
                            if (textRef) {
                              try { textRef.focus(); } catch (_) {}
                            } else {
                              setActiveIndex(idx);
                              focusElementInput(idx, 'main');
                            }
                          }, 0);
                          return;
                        }
                        // 単語が空 → 意味フィールドへ移動
                        if (isWordEmpty) {
                          setActiveIndex(idx);
                          setTimeout(() => focusElementInput(idx, 'meaning'), 0);
                          return;
                        }
                      }
                      if (nativeEvent.key === 'Enter') {
                        const wordKey = getInputKey(idx, 'word');
                        const selection = selectionRef.current[wordKey];
                        // selectionRef がない場合は el.word の長さで判定
                        const wordLen = (el.word || '').length;
                        const cursorPos = selection ? selection.start : wordLen;
                        const isCursorAtStart = cursorPos === 0;
                        const isCursorAtEnd = cursorPos === wordLen;
                        
                        // 単語先頭でEnter → この行ごと下に下げる（現在位置に空text行を挿入）
                        if (isCursorAtStart) {
                          try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
                          pendingWordRefocusRef.current = idx + 1;
                          onTapEmpty?.(idx);
                          return;
                        }
                        
                        // 単語末尾でEnter → 常に意味フィールドの末尾に移動（単語や意味が入力済みでも）
                        if (isCursorAtEnd) {
                          setActiveIndex(idx);
                          setTimeout(() => {
                            const meaningKey = getInputKey(idx, 'meaning');
                            const meaningRef = inputRefs.current[meaningKey];
                            if (meaningRef) {
                              try {
                                meaningRef.focus();
                                // 意味の末尾にカーソルを移動
                                const meaningLen = (((el as any).meaning || '') as string).length;
                                meaningRef.setNativeProps?.({
                                  selection: { start: meaningLen, end: meaningLen }
                                });
                              } catch (_) {}
                            } else {
                              focusElementInput(idx, 'meaning');
                            }
                          }, 0);
                          return;
                        }
                        
                        // それ以外の位置 → 意味フィールドの末尾に移動
                        setActiveIndex(idx);
                        setTimeout(() => {
                          const meaningKey = getInputKey(idx, 'meaning');
                          const meaningRef = inputRefs.current[meaningKey];
                          if (meaningRef) {
                            try {
                              meaningRef.focus();
                              // 意味の末尾にカーソルを移動
                              const meaningLen = (((el as any).meaning || '') as string).length;
                              meaningRef.setNativeProps?.({
                                selection: { start: meaningLen, end: meaningLen }
                              });
                            } catch (_) {}
                          } else {
                            focusElementInput(idx, 'meaning');
                          }
                        }, 0);
                      }
                    }}
                    ref={(ref) => { inputRefs.current[getInputKey(idx, 'word')] = ref; }}
                    autoFocus={effectiveActiveIndex === idx}
                    onFocus={() => setActiveIndex(idx)}
                    onSelectionChange={({ nativeEvent }) => {
                      selectionRef.current[getInputKey(idx, 'word')] = nativeEvent.selection;
                    }}
                    style={{
                      fontSize: WORD_TERM_FONT_SIZE,
                      lineHeight: interval,
                      fontFamily: font.family,
                      color: WORD_ACCENT_COLOR,
                      flex: 1,
                      minHeight: interval,
                      padding: 0,
                      textAlignVertical: 'top',
                      includeFontPadding: false,
                    }}
                    multiline
                    blurOnSubmit={false}
                    submitBehavior="newline"
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
                  <TextInput
                    allowFontScaling={false}
                    maxFontSizeMultiplier={1}
                    editable={false}
                    pointerEvents="none"
                    value={el.word}
                    multiline
                    scrollEnabled={false}
                    style={{ fontSize: WORD_TERM_FONT_SIZE, lineHeight: font.lineHeight, fontFamily: font.family, color: WORD_ACCENT_COLOR, flex: 1, flexShrink: 1, flexWrap: 'wrap', minHeight: interval, padding: 0, textAlignVertical: 'center', includeFontPadding: false }}
                  />
                )}
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1}
                  style={{
                    fontSize: font.size,
                    lineHeight: interval,
                    fontFamily: font.family,
                    color: WORD_ELLIPSIS_COLOR,
                    marginLeft: 2,
                    alignSelf: 'flex-start',
                    marginTop: 2,
                    includeFontPadding: false,
                  }}
                >
                  ...
                </Text>
              </View>
              <View style={{ flex: 0.6, justifyContent: 'flex-start', paddingLeft: 4 }}>
              {isEditing ? (
                <TextInput
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1}
                  value={(el as any).meaning}
                  onChangeText={(t) => {
                    // Enter キーで \n が混入するのを防ぐ
                    if (t.includes('\n')) return;
                    // 意味更新時にキャッシュをクリアして基税を変更させる
                    const cleaned = { ...measuredWordLinesRef.current };
                    delete cleaned[idx];
                    measuredWordLinesRef.current = cleaned;
                    setDisplayWordLines((prev) => {
                      const next = { ...prev };
                      delete next[idx];
                      return next;
                    });
                    onElementChange?.(idx, { ...el, meaning: t } as any);
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace') {
                      const isMeaningEmpty = !(((el as any).meaning || '') as string).trim();
                      const isWordEmpty = !(el.word || '').trim();
                      if (isMeaningEmpty && isWordEmpty) {
                        // 両方空のとき → 文章ツールに変換（行は残す）
                        console.log(`[単語/意味 両方空削除（意味側）] idx=${idx} を文章ツールに変換`);
                        // 型変換でInputがアンマウントされる前にkeeperへフォーカスしてキーボードを維持
                        try { toolbarKeyboardKeeperRef.current?.focus(); } catch (_) {}
                        onElementChange?.(idx, { type: 'text', text: '' });
                        // フォーカスを維持
                        setTimeout(() => {
                          const textKey = getInputKey(idx, 'main');
                          const textRef = inputRefs.current[textKey];
                          if (textRef) {
                            try { textRef.focus(); } catch (_) {}
                          } else {
                            setActiveIndex(idx);
                            focusElementInput(idx, 'main');
                          }
                        }, 0);
                        return;
                      }
                      if (isMeaningEmpty) {
                        setActiveIndex(idx);
                        setTimeout(() => {
                          focusElementInput(idx, 'word');
                        }, 0);
                        return;
                      }
                    }
                    if (nativeEvent.key === 'Enter') {
                      focusNextElement(idx);
                    }
                  }}
                  ref={(ref) => { inputRefs.current[getInputKey(idx, 'meaning')] = ref; }}
                  onFocus={() => setActiveIndex(idx)}
                  style={{
                    fontSize: font.size,
                    lineHeight: interval,
                    fontFamily: font.family,
                    width: '100%',
                    minHeight: interval,
                    padding: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                  }}
                  multiline
                  blurOnSubmit={false}
                  submitBehavior="newline"
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
                <TextInput
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1}
                  editable={false}
                  pointerEvents="none"
                  value={(el as any).meaning}
                  multiline
                  scrollEnabled={false}
                  style={{ fontSize: font.size, lineHeight: font.lineHeight, fontFamily: font.family, flexShrink: 1, flexWrap: 'wrap', width: '100%', minHeight: interval, padding: 0, textAlignVertical: 'top', includeFontPadding: false }}
                />
              )}
            </View>
            </View>
          </View>
        );
        return;
      }

      // text / chapter / section / subsection
      const isOutlineType = el.type === 'chapter' || el.type === 'section' || el.type === 'subsection';
      const isOverflow = overflowStartIndex !== null && idx >= overflowStartIndex;
      const textRowHeightStyle = { minHeight: estHeight };
      const headingUnderlineStyle = isOutlineType ? { textDecorationLine: 'underline' as const } : null;
      const mainText = 'text' in el ? el.text : (el as any).text || '';
      const elementMarks: TextMark[] | undefined = (el as any).marks;
      const hasMarks = Boolean(elementMarks && elementMarks.length > 0);
      rendered.push(
        <View
          key={idx}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleRowResponderGrant}
          onResponderMove={handleRowResponderMove}
          onResponderRelease={(e) =>
            handleRowResponderRelease(e, () => {
              if (!isEditing) {
                onEditStart?.(idx);
                return;
              }
              // 見出し（大中小）が既にアクティブな場合、2回目のタップで文章に変換
              const isOutline = el.type === 'chapter' || el.type === 'section' || el.type === 'subsection';
              if (isOutline && effectiveActiveIndex === idx) {
                handleTypeChange('text');
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
            backgroundColor: isEditing && effectiveActiveIndex === idx
              ? ACTIVE_TINT
              : 'transparent',
            position: 'relative',
            borderWidth: 0,
            borderColor: 'transparent',
            ...debugStyle,
          }}
        >
          <View style={{ flex: 1, paddingHorizontal: 6, paddingTop: 0, paddingBottom: 0, justifyContent: 'flex-start' }}>
            {isEditing ? (
            <View style={{ position: 'relative' }}>
              {hasMarks && (
                <MarkerHighlightLayer
                  text={mainText}
                  marks={elementMarks}
                  fontSize={font.size}
                  lineHeight={font.lineHeight}
                  fontFamily={font.family}
                />
              )}
              <TextInput
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
                value={mainText}
                scrollEnabled={false}
                onChangeText={(t) => {
                  // 改行文字が含まれている場合は改行処理を実行
                  const newlineIndex = t.indexOf('\n');
                  if (newlineIndex >= 0) {
                    console.log(`[onChangeText] 改行検出: idx=${idx}, newlineIndex=${newlineIndex}`);

                    // 改行文字を除去したテキストで分割
                    const merged = `${t.slice(0, newlineIndex)}${t.slice(newlineIndex + 1)}`;
                    const before = merged.slice(0, newlineIndex);
                    console.log(`[onChangeText] 改行処理実行: before="${before}", after="${merged.slice(newlineIndex)}"`);

                    // ネイティブ TextInput が一瞬 "\n" 入りテキスト（2行）を描画して
                    // カーソルが下行へ降り、行の高さも伸びるのがチラつきの原因。
                    // 改行を検出した瞬間にネイティブテキストを before に戻し、改行が
                    // 描画されること自体を防ぐ（カーソルの「下→戻る」を消す）。
                    // selection を before 末尾に揃えるのでカーソルはそのまま、
                    // その後 nextIdx へ一回だけ移動する（余計なキーパー経由はしない）。
                    //
                    // さらに、改行検出と同時に高さスラッシング抑制ガードを張る。
                    // ネイティブが一瞬描画した "\n"（2行）の高さを onContentSizeChange が
                    // 拾って行が伸び→縮みするのを防ぐため、一定時間 idx の行数「増加」を無視する。
                    splitHeightSuppressRef.current = { idx, until: Date.now() + 350 };
                    const curRef = inputRefs.current[getInputKey(idx, 'main')];
                    try {
                      curRef?.setNativeProps?.({
                        text: before,
                        selection: { start: before.length, end: before.length },
                      });
                    } catch (_) {}

                    splitToNextTextBlock(idx, merged, newlineIndex);
                    return;
                  }

                  onElementChange?.(idx, { ...el, text: t, marks: rebaseMarks(elementMarks, mainText, t) } as any);
                }}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Enter' || nativeEvent.key === 'Return' || nativeEvent.key === '\n') {
                    console.log(`[onKeyPress Enter] idx=${idx} - onChangeTextで処理される`);
                    // onChangeTextで処理されるため、ここでは何もしない
                    return;
                  }
                  if (nativeEvent.key === 'Backspace') {
                    console.log(`[onKeyPress Backspace] idx=${idx}`);
                    const current = 'text' in el ? el.text : (el as any).text || '';
                    const isBlankOrNewlineOnly = !current.trim();
                    const inputKey = getInputKey(idx, 'main');
                    const selection = selectionRef.current[inputKey];
                    const outlinePrefixMatch = current.match(OUTLINE_PREFIX_RE);
                    const outlinePrefix = outlinePrefixMatch?.[0] ?? '';
                    const outlineBody = stripOutlinePrefix(current);

                    const isCursorRightOfOutlinePrefix = isOutlineType
                      && outlinePrefix.length > 0
                      && selection
                      && selection.start === selection.end
                      && selection.start === outlinePrefix.length;

                    if (isCursorRightOfOutlinePrefix) {
                      onElementChange?.(idx, { type: 'text', text: outlineBody });
                      return;
                    }

                    const mergeWithPreviousKeepingKeyboard = () => {
                      console.log(`[mergeWithPreviousKeepingKeyboard] idx=${idx}`);
                      if (idx <= 0) {
                        focusPrevElement(idx);
                        return;
                      }
                      
                      const prevEl = elements?.[idx - 1];
                      
                      // キーボードを維持するために、先にkeeperにフォーカス（全てのケースで実行）
                      try { 
                        toolbarKeyboardKeeperRef.current?.focus(); 
                        console.log(`[mergeWithPreviousKeepingKeyboard] keeperにフォーカスしてキーボード維持`);
                      } catch (_) {}
                      
                      // 先に前要素へ即時フォーカスを移してから次tickで結合し、キーボードのチラつきを抑える
                      setActiveIndex(idx - 1);
                      // word 型は 'main' キーを持たないので 'meaning' フィールドへフォーカスする
                      const prevField = prevEl?.type === 'word' ? 'meaning' : 'main';
                      const prevKey = getInputKey(idx - 1, prevField);
                      const prevRef = inputRefs.current[prevKey];
                      
                      // 30ms待ってから前要素にフォーカス（keeperからの切り替えを滑らかにする）
                      setTimeout(() => {
                        if (prevRef) {
                          try {
                            prevRef.focus();
                            console.log(`[mergeWithPreviousKeepingKeyboard] 前要素(${idx-1})の${prevField}フィールドにフォーカス`);
                            // word型の場合、meaningフィールドの末尾にカーソルを移動
                            if (prevEl?.type === 'word') {
                              const meaningLen = (((prevEl as any).meaning || '') as string).length;
                              setTimeout(() => {
                                prevRef.setNativeProps?.({
                                  selection: { start: meaningLen, end: meaningLen }
                                });
                              }, 0);
                            } else if (prevEl?.type === 'text' || prevEl?.type === 'chapter' || 
                                      prevEl?.type === 'section' || prevEl?.type === 'subsection') {
                              // text系の場合も末尾にカーソルを移動
                              const textLen = ((prevEl as any).text || '').length;
                              setTimeout(() => {
                                prevRef.setNativeProps?.({
                                  selection: { start: textLen, end: textLen }
                                });
                              }, 0);
                            }
                          } catch (error) {
                            console.log(`[mergeWithPreviousKeepingKeyboard] フォーカスエラー:`, error);
                            // ignore focus errors
                          }
                        } else {
                          console.log(`[mergeWithPreviousKeepingKeyboard] prevRef が見つからない、focusPrevElement呼び出し`);
                          focusPrevElement(idx);
                        }
                      }, 30);
                      
                      if (mergeTimeoutRef.current) clearTimeout(mergeTimeoutRef.current);
                      mergeTimeoutRef.current = setTimeout(() => {
                        mergeTimeoutRef.current = null;
                        console.log(`[mergeTimeout実行] onMergeWithPrevious(${idx}) を呼び出し`);
                        onMergeWithPrevious?.(idx);
                      }, 60);
                    };

                    // 空要素の先頭でBackspace → 前の要素と統合（merge）
                    if (el.type === 'text' && current.length === 0) {
                      console.log(`[空行削除] idx=${idx} を merge で処理`);
                      // 進行中の merge をキャンセルして干渉を防ぐ
                      if (mergeTimeoutRef.current) {
                        clearTimeout(mergeTimeoutRef.current);
                        mergeTimeoutRef.current = null;
                      }
                      
                      // idx=0 の場合は削除のみ（キーボードを維持しながら）
                      if (idx === 0) {
                        console.log(`[空行削除] idx=0 なので削除のみ`);
                        // キーボードを維持するためにkeeperにフォーカス
                        try { 
                          toolbarKeyboardKeeperRef.current?.focus(); 
                        } catch (_) {}
                        setTimeout(() => {
                          onDeleteElement?.(idx);
                        }, 30);
                        return;
                      }
                      
                      // mergeWithPreviousKeepingKeyboard を使って前の要素にフォーカスを移しながら統合
                      // これによりキーボードが維持される
                      console.log(`[空行削除] mergeWithPreviousKeepingKeyboard を呼び出し`);
                      mergeWithPreviousKeepingKeyboard();
                      return;
                    }

                    // 改行だけの状態でバックスペース → 改行を1つ削除して赤枠を消す
                    if (isBlankOrNewlineOnly && current.length > 0) {
                      const newText = current.slice(0, -1);
                      const cleaned = { ...measuredTextLinesRef.current };
                      delete cleaned[idx];
                      measuredTextLinesRef.current = cleaned;
                      setMeasuredTextLines((prev) => {
                        const next = { ...prev };
                        delete next[idx];
                        return next;
                      });
                      onElementChange?.(idx, { ...el, text: newText } as any);
                      return;
                    }

                    if (el.type === 'text' && selection && selection.start === 0 && selection.end === 0) {
                      console.log(`[先頭Backspace] idx=${idx} で mergeWithPrevious を呼び出し`);
                      // カーソルが先頭で内容あり → 前要素と結合
                      mergeWithPreviousKeepingKeyboard();
                      return;
                    }
                    if (!isOutlineType && current.length === 0) {
                      focusPrevElement(idx);
                    }
                  }
                }}
                onSelectionChange={({ nativeEvent }) => {
                  selectionRef.current[getInputKey(idx, 'main')] = nativeEvent.selection;
                  if (effectiveActiveIndex === idx) {
                    setActiveMainSelection(nativeEvent.selection);
                    if (nativeEvent.selection.start !== nativeEvent.selection.end) {
                      lastNonEmptySelectionRef.current = { idx, start: nativeEvent.selection.start, end: nativeEvent.selection.end };
                    }
                  }
                }}
                onContentSizeChange={(e) => {
                  const h = Math.round(e.nativeEvent.contentSize.height);
                  const measuredLines = measureLinesFromHeight(h, font.lineHeight);
                  // 改行分割中は、ネイティブが一瞬描画した "\n"（2行）由来の高さ増加を無視する。
                  // これをしないと行が伸び→縮みし、カーソルが「下→戻る」と見える。
                  const suppress = splitHeightSuppressRef.current;
                  if (
                    suppress &&
                    suppress.idx === idx &&
                    Date.now() < suppress.until &&
                    measuredLines > (measuredTextLinesRef.current[idx] ?? 1)
                  ) {
                    return;
                  }
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
                textContainerInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
                style={{
                  fontSize: font.size,
                  lineHeight: font.lineHeight,
                  fontFamily: font.family,
                  backgroundColor: 'transparent',
                  width: '100%',
                  color: '#2D251D',
                  minHeight: font.lineHeight,
                  padding: 0,
                  textAlignVertical: 'top',
                  includeFontPadding: false,
                  ...(headingUnderlineStyle ?? {}),
                }}
                selectionColor="#8A6F56"
                multiline
                returnKeyType="default"
                // カーソル（caret）は「アクティブな行」にだけ描画する。
                // 分割直後の1フレーム、フォーカスは旧行(idx)に残ったままハイライト
                // (activeIndex)だけ新行へ移ることがあり、カーソルとハイライトが別の行に
                // 見える＝ちらつきの原因になる。caretHidden を activeIndex に完全連動させると
                // カーソルは常にアクティブ行にのみ表示され、このズレが原理的に消える。
                caretHidden={effectiveActiveIndex !== idx}
                // submitBehavior="submit" にすると Enter で改行（"\n"）を挿入せず
                // onSubmitEditing が発火する。これが根本修正の要：
                // 従来は Enter でネイティブが一瞬 "text\n"（2行）を描画し、改行行が
                // 2行分の高さになって新行が元の「次の次の行」位置へ押し下げられ、
                // そこにカーソルが乗って見えていた。\n を挿入させないことで、その
                // 一時的な2行描画そのものが起きなくなり、カーソルの瞬間移動が消える。
                submitBehavior="submit"
                onSubmitEditing={() => {
                  // Enter は \n を挿入しないため、selection を使って論理的に分割する。
                  const current = 'text' in el ? el.text : (el as any).text || '';
                  splitByEnter(idx, current);
                }}
              />
            </View>
            ) : (
              <View style={{ position: 'relative' }}>
                {hasMarks && (
                  <MarkerHighlightLayer
                    text={mainText}
                    marks={elementMarks}
                    fontSize={font.size}
                    lineHeight={font.lineHeight}
                    fontFamily={font.family}
                  />
                )}
                <TextInput
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1}
                  editable={false}
                  pointerEvents="none"
                  value={mainText}
                  multiline
                  scrollEnabled={false}
                  textContainerInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
                  onContentSizeChange={(e) => {
                    const h = Math.round(e.nativeEvent.contentSize.height);
                    const lines = Math.max(1, Math.ceil(h / font.lineHeight));
                    updateMeasuredTextLines(idx, lines);
                  }}
                  style={{
                    fontSize: font.size,
                    lineHeight: font.lineHeight,
                    fontFamily: font.family,
                    backgroundColor: 'transparent',
                    flexWrap: 'wrap',
                    width: '100%',
                    color: '#2D251D',
                    minHeight: font.lineHeight,
                    padding: 0,
                    textAlignVertical: 'top',
                    includeFontPadding: false,
                    ...(headingUnderlineStyle ?? {}),
                  }}
                />
              </View>
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
          onResponderRelease={(e) =>
            handleRowResponderRelease(e, () => {
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

  const updateNoteBounds = () => {
    noteSheetRef.current?.measureInWindow((x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      noteBoundsRef.current = { x, y, width: w, height: h };
      onNoteLayout?.({ x, y, width: w, height: h });
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: fillBackground ? bgColor : 'transparent' }}>
      {/* 白いノート用紙。Animated.View の translateY でキーボード出現時に全体がスライドアップ */}
      <Animated.View
        ref={(ref) => {
          noteSheetRef.current = ref as unknown as View;
        }}
        onLayout={() => {
          requestAnimationFrame(() => {
            updateNoteBounds();
          });
        }}
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
          {markerColorPickerVisible && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
              {MARKER_COLORS.map(({ label, color }) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => applyMarkerToSelection(color)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: color,
                    marginHorizontal: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel={`${label}のマーカー`}
                />
              ))}
              <TouchableOpacity
                key="marker-erase"
                onPress={() => applyMarkerToSelection(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#fff',
                  marginHorizontal: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel="マーカーを消す"
              >
                <Ionicons name="close" size={16} color="rgba(0,0,0,0.45)" />
              </TouchableOpacity>
            </View>
          )}
          {(() => {
            const current = effectiveActiveIndex !== null && effectiveActiveIndex !== undefined ? elements?.[effectiveActiveIndex] : undefined;
            const currentType: NoteElement['type'] = isValidElement(current) ? current.type : 'text';
            const isTextBearingType = currentType === 'text' || currentType === 'chapter' || currentType === 'section' || currentType === 'subsection';
            const showMarkerButton = isTextBearingType
              && Boolean(activeMainSelection && activeMainSelection.start !== activeMainSelection.end);

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
              // マーカーの色選択中は、誤操作で他の要素タイプに変更されないよう全ボタンを非活性にする
              const isButtonDisabled = (isImageType && currentType !== 'image' && hasAnyTextInput) || markerColorPickerVisible || headingPickerVisible;

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
                ? 20
                : type === 'section'
                ? 18
                : type === 'subsection'
                ? 16
                : 16;

              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    style.toolbarButton,
                    baseButtonStyle,
                    isActive && activeButtonStyle,
                    isButtonDisabled && style.toolbarButtonDisabled,
                  ]}
                  onPress={() => handleTypeChange(type)}
                  disabled={isButtonDisabled}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {iconName ? <Ionicons name={iconName} size={iconSize} color={iconColor} style={{ marginRight: 6 }} /> : null}
                    <Text
                      allowFontScaling={false}
                      maxFontSizeMultiplier={1}
                      numberOfLines={1}
                      ellipsizeMode="clip"
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
            const isHeadingActive = currentType === 'chapter' || currentType === 'section' || currentType === 'subsection';

            return (
              <>
                {headingPickerVisible && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
                    {[chapterBtn, sectionBtn, subsectionBtn].map((btn) => {
                      if (!btn) return null;
                      const isActive = currentType === btn.type;
                      return (
                        <TouchableOpacity
                          key={btn.type}
                          onPress={() => handleTypeChange(btn.type)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            marginHorizontal: 6,
                            borderWidth: 1,
                            borderColor: isActive ? '#3A5F47' : '#9FC4A8',
                            backgroundColor: isActive ? '#4D7A5B' : '#EEF7F0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            maxFontSizeMultiplier={1}
                            style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : '#2F4D3A' }}
                          >
                            {btn.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={style.toolbarButtonList}>
                  {textBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(textBtn)}</View> : null}

                  <View style={style.toolbarStandaloneButton}>
                    <TouchableOpacity
                      style={[
                        style.toolbarButton,
                        style.toolbarButtonOutline,
                        (isHeadingActive || headingPickerVisible) && style.toolbarButtonOutlineActive,
                        (markerColorPickerVisible || currentType === 'word') && style.toolbarButtonDisabled,
                      ]}
                      onPress={() => setHeadingPickerVisible((v) => !v)}
                      disabled={markerColorPickerVisible || currentType === 'word'}
                    >
                      <Text
                        allowFontScaling={false}
                        maxFontSizeMultiplier={1}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                          style.toolbarButtonLabel,
                          style.toolbarButtonOutlineText,
                          (isHeadingActive || headingPickerVisible) && style.toolbarButtonTextActive,
                        ]}
                      >
                        見出し
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {wordBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(wordBtn)}</View> : null}
                {showMarkerButton ? (
                  <View style={style.toolbarStandaloneButton}>
                    <TouchableOpacity
                      style={[
                        style.toolbarButton,
                        style.toolbarButtonMarker,
                        markerColorPickerVisible && style.toolbarButtonMarkerActive,
                        headingPickerVisible && style.toolbarButtonDisabled,
                      ]}
                      onPress={() => setMarkerColorPickerVisible((v) => !v)}
                      disabled={headingPickerVisible}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons
                          name="color-fill-outline"
                          size={16}
                          color={markerColorPickerVisible ? '#fff' : '#6B5400'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          allowFontScaling={false}
                          maxFontSizeMultiplier={1}
                          numberOfLines={1}
                          ellipsizeMode="clip"
                          style={[
                            style.toolbarButtonLabel,
                            style.toolbarButtonMarkerText,
                            markerColorPickerVisible && style.toolbarButtonTextActive,
                          ]}
                        >
                          マーカー
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  imageBtn ? <View style={style.toolbarStandaloneButton}>{renderButton(imageBtn)}</View> : null
                )}
                </View>
              </>
            );
          })()}
        </View>
      )}

      <Modal visible={imageRowsEditor.visible} transparent animationType="fade" onRequestClose={closeImageRowsEditor}>
        <View style={style.imageRowsModalBackdrop}>
          <View style={style.imageRowsModalCard}>
            <Text style={style.imageRowsModalTitle}>画像の行数</Text>
            <Text style={style.imageRowsModalHint}>1〜{IMAGE_MAX_ROWS} から選択</Text>
            <TouchableOpacity
              onPress={() => setImageRowsEditor((prev) => ({ ...prev, dropdownOpen: !prev.dropdownOpen }))}
              style={style.imageRowsDropdownTrigger}
              activeOpacity={0.8}
            >
              <Text style={style.imageRowsDropdownValue}>{imageRowsEditor.selectedRows}行</Text>
              <Ionicons name={imageRowsEditor.dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6F6357" />
            </TouchableOpacity>
            {imageRowsEditor.dropdownOpen && (
              <View style={style.imageRowsDropdownPanel}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={style.imageRowsDropdownScroll}>
                  {Array.from({ length: IMAGE_MAX_ROWS }, (_, i) => i + 1).map((rows) => {
                    const selected = rows === imageRowsEditor.selectedRows;
                    return (
                      <TouchableOpacity
                        key={`rows-option-${rows}`}
                        onPress={() => setImageRowsEditor((prev) => ({ ...prev, selectedRows: rows, dropdownOpen: false }))}
                        style={[style.imageRowsDropdownItem, selected && style.imageRowsDropdownItemSelected]}
                        activeOpacity={0.8}
                      >
                        <Text style={[style.imageRowsDropdownItemText, selected && style.imageRowsDropdownItemTextSelected]}>{rows}行</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <View style={style.imageRowsModalButtons}>
              <TouchableOpacity onPress={closeImageRowsEditor} style={[style.imageRowsModalButton, style.imageRowsModalButtonCancel]}>
                <Text style={style.imageRowsModalButtonCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyImageRowsEditor} style={[style.imageRowsModalButton, style.imageRowsModalButtonApply]}>
                <Text style={style.imageRowsModalButtonApplyText}>適用</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ImageCropModal
        visible={cropPickerState !== null}
        imageUri={cropPickerState?.uri ?? null}
        imageWidth={cropPickerState?.width ?? 0}
        imageHeight={cropPickerState?.height ?? 0}
        initialCropRect={cropPickerState?.initialCropRect}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
      {isEditing && (
        <TextInput
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
          ref={toolbarKeyboardKeeperRef}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -1000, top: -1000, padding: 0 }}
          multiline={false}
          blurOnSubmit={false}
          showSoftInputOnFocus={true}
        />
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'column',
    flexShrink: 0,
    alignItems: 'center',
  },
  toolbarButtonList: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  toolbarStandaloneButton: {
    alignSelf: 'flex-end',
  },
  toolbarButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
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
  toolbarButtonMarker: {
    backgroundColor: '#FFF3C0',
    borderColor: '#E8C94A',
  },
  toolbarButtonMarkerActive: {
    backgroundColor: '#E8B400',
    borderColor: '#B98E00',
  },
  toolbarButtonMarkerText: {
    color: '#6B5400',
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
    fontSize: 14,
    lineHeight: 18,
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
  imageRowsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imageRowsModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    backgroundColor: '#FCFAF6',
    borderWidth: 1,
    borderColor: '#DED2C3',
    padding: 16,
  },
  imageRowsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3E3228',
  },
  imageRowsModalHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#6F6357',
  },
  imageRowsDropdownTrigger: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CDBEAE',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageRowsDropdownValue: {
    fontSize: 17,
    color: '#2B241E',
    fontWeight: '600',
  },
  imageRowsDropdownPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D7CABC',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  imageRowsDropdownScroll: {
    maxHeight: 180,
  },
  imageRowsDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  imageRowsDropdownItemSelected: {
    backgroundColor: '#EFE7DD',
  },
  imageRowsDropdownItemText: {
    fontSize: 15,
    color: '#3B322B',
  },
  imageRowsDropdownItemTextSelected: {
    color: '#6E5744',
    fontWeight: '700',
  },
  imageRowsModalButtons: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  imageRowsModalButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  imageRowsModalButtonCancel: {
    backgroundColor: '#EEE5DA',
  },
  imageRowsModalButtonApply: {
    backgroundColor: '#8A6F56',
  },
  imageRowsModalButtonCancelText: {
    color: '#5A4A3B',
    fontWeight: '600',
  },
  imageRowsModalButtonApplyText: {
    color: '#fff',
    fontWeight: '700',
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
