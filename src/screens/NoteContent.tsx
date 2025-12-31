// ==========================================
// NoteContent.tsx
// ==========================================

import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, Dimensions, StyleSheet, ImageBackground } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import * as commonStyle from '../styles/commonStyle';
import { useHeaderHeight } from '@react-navigation/elements';
import { ENV } from '@config';

const IS_DEV = ENV.SCREEN_DEV;

const CACHE_FILE = FileSystem.cacheDirectory + 'background.png';
const DEV_FORCE_REGENERATE = true;
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
} as const;

type Props = {
  children?: React.ReactNode;
  backgroundColor?: keyof typeof COLOR_MAP;
  elements?: NoteElement[];
  onNoteLayout?: (bounds: { x: number; y: number; width: number; height: number }) => void;
};

const NoteContent: React.FC<Props> = ({ children, backgroundColor, elements, onNoteLayout }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const headerHeight = useHeaderHeight();

  // ノートのレイアウト基準（Skia と要素描画で共有する）
  const noteX = width * 0.01;
  // const noteY = height * 0.063;
  const noteY = height * 0;
  const noteWidth = width * 0.98;
  const noteHeight = (height - headerHeight) * 0.87;

  const uint8ToBase64 = (u8Arr: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < u8Arr.length; i++) {
      binary += String.fromCharCode(u8Arr[i]);
    }
    return global.btoa(binary);
  };

  // ===============================================
  // 💛 背景生成（ここに枠線＆影＆白ノートを追加）
  // ===============================================
  const generateAndSaveBackground = async (): Promise<string> => {
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) throw new Error('Skia.Surface.MakeOffscreen が null');

    const canvas = surface.getCanvas();
    const basePaint = Skia.Paint();
    basePaint.setColor(Skia.Color(bgColor));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), basePaint);

    // ========= 白いノート部分 & 影 ==========
  // noteX/noteY/noteWidth/noteHeight は上で計算したものを使う
  const radius = 0;

    // 💛 影用（薄い影）
    const shadowPaint = Skia.Paint();
    shadowPaint.setColor(Skia.Color('rgba(0,0,0,0.12)'));
    shadowPaint.setStyle(PaintStyle.Fill);
    const shadowRect = Skia.RRectXY(Skia.XYWHRect(noteX + 6, noteY + 6, noteWidth, noteHeight), radius, radius);
    canvas.drawRRect(shadowRect, shadowPaint);

    // 💛 白いノート本体
    const whitePaint = Skia.Paint();
    whitePaint.setColor(Skia.Color('white'));
    whitePaint.setStyle(PaintStyle.Fill);
    const whiteRect = Skia.RRectXY(Skia.XYWHRect(noteX, noteY, noteWidth, noteHeight), radius, radius);
    canvas.drawRRect(whiteRect, whitePaint);

    // ========= 罫線 ==========
    const linePaint = Skia.Paint();
    linePaint.setStrokeWidth(1.5);
    linePaint.setColor(Skia.Color('rgba(152, 173, 211, 1)'));
    linePaint.setStrokeWidth(1.5);

  const left = noteX + noteWidth * space;
  const right = noteX + noteWidth * (1 - space);

    // タイトル線
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

  // 罫線
  linePaint.setColor(Skia.Color(RULE_COLOR));
    linePaint.setStrokeWidth(1);
    const limit_y = height - commonStyle.screenHeight * 0.02
    const row = Math.trunc(noteHeight / interval) + 2;
    for (let i = upperSpace + 1; i < row - 1; i++) {
      const x1 = width * space;
      const y1 = i * interval;
      const x2 = width * (1 - space);
      const y2 = y1;
      canvas.drawLine(x1, y1, x2, y2, linePaint);
    }

    // ========= PNG保存 ==========
    const image = surface.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();
    const base64 = uint8ToBase64(pngBytes);

    await FileSystem.writeAsStringAsync(CACHE_FILE, base64, { encoding: FileSystem.EncodingType.Base64 });
    return CACHE_FILE;
  };

  const loadBackground = async () => {
    try {
      if (DEV_FORCE_REGENERATE) await FileSystem.deleteAsync(CACHE_FILE).catch(() => {});
      const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);
      if (fileInfo.exists) {
        setBgUri(fileInfo.uri);
        // notify parent of the note bounds
        onNoteLayout?.({ x: noteX, y: noteY, width: noteWidth, height: noteHeight });
      } else {
        const uri = await generateAndSaveBackground();
        setBgUri(uri);
        onNoteLayout?.({ x: noteX, y: noteY, width: noteWidth, height: noteHeight });
      }
    } catch (err) {
      console.error('背景ロードエラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackground();
  }, []);
  
  // 要素描画の開始 Y はノートの上端（noteY）を基準にする
  const startY = noteY + upperSpace * interval;

  const renderElements = () => {
    if (!elements) return null;

    const elLeft = noteX + noteWidth * space;
    const elRight = noteX + noteWidth * (1 - space);

  let currentY = startY;

    return elements.map((el, idx) => {
      const font = FONT_MAP[el.type];
      // estimate raw height in pixels
      let rawHeight = font.lineHeight;
      if (el.type === 'image') {
        rawHeight = 200;
      } else if ('text' in el) {
        // estimate based on full note width
        const approxCharsPerLine = Math.max(10, Math.floor((noteWidth * 0.8) / Math.max(1, font.size)));
        const lines = Math.ceil(el.text.length / approxCharsPerLine);
        rawHeight = lines * font.lineHeight;
      } else if ('word' in el) {
        // for word elements estimate per-column wrap using actual column widths
        const colLeftRatio = 0.25; // keep in sync with rendering
        const leftWidth = (elRight - elLeft) * colLeftRatio - 12; // subtract paddingHorizontal*2
        const rightWidth = (elRight - elLeft) - (elRight - elLeft) * colLeftRatio - 12;
        const approxCharsPerLineLeft = Math.max(6, Math.floor(leftWidth / Math.max(1, font.size)));
        const approxCharsPerLineRight = Math.max(6, Math.floor(rightWidth / Math.max(1, font.size)));

        const leftLines = Math.ceil((el.word || '').length / approxCharsPerLineLeft);
        const meaningText = (el as any).meaning || '';
        const rightLines = Math.ceil(meaningText.length / approxCharsPerLineRight);

        rawHeight = Math.max(leftLines, rightLines) * font.lineHeight + 8; // add small vertical padding
      }

  // round height up to nearest multiple of font.lineHeight so height matches actual text lines
  const estHeight = Math.max(font.lineHeight, Math.ceil(rawHeight / font.lineHeight) * font.lineHeight);

      const top = currentY;
  // 次の要素位置はこの要素の高さ分だけ進める
  const step = estHeight;
  currentY += step;

      // ======== デバッグ用背景 ============
      const debugStyle = IS_DEV
        ? {
            backgroundColor: 'rgba(255,0,0,0.15)',
            borderWidth: 1,
            borderColor: 'red',
          }
        : {};

      if (el.type === 'image') {
        return (
          <View
            key={idx}
            style={{
              position: 'absolute',
              top,
              left: elLeft,
              width: elRight - elLeft,
              height: 200,
              ...debugStyle,
            }}
          >
            <Image
              source={{ uri: el.uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
        );
      }
      // render word as two-column table aligned to ruled lines
      if (el.type === 'word') {
        const colLeftRatio = 0.25; // 左列幅比率
        const leftWidth = (elRight - elLeft) * colLeftRatio;
        const rightWidth = (elRight - elLeft) - leftWidth;

        return (
          <View
            key={idx}
            style={{
              position: 'absolute',
              top,
              left: elLeft,
              width: elRight - elLeft,
              height: estHeight,
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderColor: RULE_COLOR,
              alignItems: 'stretch',
              ...debugStyle,
            }}
          >
            <View style={{ width: leftWidth, height: '100%', paddingHorizontal: 6, paddingVertical: 4, borderRightWidth: 1, borderRightColor: RULE_COLOR }}>
              <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{el.word}</Text>
            </View>
            <View style={{ width: rightWidth, height: '100%', paddingHorizontal: 6, paddingVertical: 4, justifyContent: 'flex-start' }}>
              <Text style={{ fontSize: font.size, lineHeight: font.lineHeight, flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>{(el as any).meaning}</Text>
            </View>
          </View>
        );
      }

      // default: text-like element; ensure container height aligns to lines
      return (
        <View
          key={idx}
          style={{
            position: 'absolute',
            top,
            left: elLeft,
            width: elRight - elLeft,
            height: estHeight,
            justifyContent: 'center',
            ...debugStyle,
          }}
        >
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
        </View>
      );
    });
  };


  if (loading || !bgUri) {
    return (
      <View style={style.loadingContainer}>
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return (
    <ImageBackground source={{ uri: bgUri }} style={[style.background, { width, height }]} resizeMode="stretch">
      <View
        style={{ flex: 1, position: 'relative', padding: 0, margin: 0 }}
        onLayout={(e) => {
          const parentY = e.nativeEvent.layout.y;

          // React Native 要素の絶対座標 = parentY + top
          // estimate each element top using same logic as renderElements
          let accY = startY;
          elements?.forEach((el, idx) => {
            const font = FONT_MAP[el.type];
            let estHeight = font.lineHeight;
            if (el.type === 'image') estHeight = 200;
            else if ('text' in el)
              estHeight = Math.ceil(el.text.length * font.size / (noteWidth * 0.8)) * font.lineHeight;
            else if ('word' in el)
              estHeight = Math.ceil(el.word.length * font.size / (noteWidth * 0.8)) * font.lineHeight;

            const top = accY;
            accY += Math.max(estHeight, interval);
          });
        }}
      >
        {renderElements()}
        {children}
      </View>
    </ImageBackground>
  );

};

export default NoteContent;

const style = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  background: { flex: 1 },
});
