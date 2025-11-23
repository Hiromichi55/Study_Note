// ==========================================
// NoteContent.tsx
// ==========================================

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Dimensions, StyleSheet, ImageBackground } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { theme, styles, screenWidth, screenHeight } from '../styles/theme';
import { useHeaderHeight } from '@react-navigation/elements';

type Props = {
  children?: React.ReactNode;
  backgroundColor?: keyof typeof COLOR_MAP;
};

const COLOR_MAP = {
  "red":    '#B26260',
  "pink":   '#B25F87',
  "yellow": '#BBA859',
  "green":  '#6DA055',
  "blue":   '#4B8ABA',
  "cyan":   '#55A99F',
} as const;

const CACHE_FILE = FileSystem.cacheDirectory + 'background.png';
const DEV_FORCE_REGENERATE = true;
const { width, height } = Dimensions.get('window');

// ノート罫線パラメータ
const space = 0.03;
const interval = 30;
const upperSpace = 4;

const ScreenBackground: React.FC<Props> = ({ children, backgroundColor }) => {
  const bgColor = COLOR_MAP[backgroundColor ?? 'red'];
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const headerHeight = useHeaderHeight();
  const row = Math.trunc((height-screenHeight*0.02) / interval);

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
    console.log('背景生成開始');

    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) throw new Error('Skia.Surface.MakeOffscreen が null');

    const canvas = surface.getCanvas();

    // 💛 一番下の背景（#B26260）
    const basePaint = Skia.Paint();
    basePaint.setColor(Skia.Color(bgColor));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), basePaint);

    // ========= 白いノート部分 & 影 ==========
    const noteX = width * 0.01;
    const noteY = height * 0.063;
    const noteWidth = width * 0.98;
    const noteHeight = (height-headerHeight) * 0.87;
    const radius = 0;

    // 💛 影用（薄い影）
    const shadowPaint = Skia.Paint();
    shadowPaint.setColor(Skia.Color('rgba(0,0,0,0.12)'));
    shadowPaint.setStyle(PaintStyle.Fill);

    const shadowRect = Skia.RRectXY(
      Skia.XYWHRect(noteX + 6, noteY + 6, noteWidth, noteHeight),
      radius,
      radius
    );
    canvas.drawRRect(shadowRect, shadowPaint);

    // 💛 白いノート本体
    const whitePaint = Skia.Paint();
    whitePaint.setColor(Skia.Color('white'));
    whitePaint.setStyle(PaintStyle.Fill);

    const whiteRect = Skia.RRectXY(
      Skia.XYWHRect(noteX, noteY, noteWidth, noteHeight),
      radius,
      radius
    );
    canvas.drawRRect(whiteRect, whitePaint);

    // ========= 罫線 ==========
    const linePaint = Skia.Paint();
    linePaint.setStrokeWidth(1);
    linePaint.setColor(Skia.Color('rgba(152, 173, 211, 1)'));
    linePaint.setStrokeWidth(1.5);

    const left = noteX + noteWidth * space;
    const right = noteX + noteWidth * (1 - space);

    // タイトル線
    const x1_title = width * space;
    const y1_title = (upperSpace - 1) / row * height - interval * 0.2;
    const x2_title = width * (1 - space);
    const y2_title = y1_title;
    canvas.drawLine(x1_title, y1_title, x2_title, y2_title, linePaint);

    const x1 = width * space;
    const y1 = upperSpace / row * height;
    const x2 = width * (1 - space);
    const y2 = y1;
    canvas.drawLine(x1, y1, x2, y2, linePaint);

    // その下の罫線
    linePaint.setColor(Skia.Color('rgba(196, 204, 218, 1)'));
    linePaint.setStrokeWidth(1);
    const limit_y = noteY + noteHeight;
    for (let i = upperSpace + 1; i / row * height < limit_y; i++) {
      const x1 = width * space;
      const y1 = i / row * height;
      const x2 = width * (1 - space);
      const y2 = y1;
      canvas.drawLine(x1, y1, x2, y2, linePaint);
    }


    // ========= PNG保存 ==========
    const image = surface.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();
    const base64 = uint8ToBase64(pngBytes);

    await FileSystem.writeAsStringAsync(CACHE_FILE, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('背景生成完了');
    return CACHE_FILE;
  };

  // ===========================
  // 背景ロード
  // ===========================
  const loadBackground = async () => {
    try {
      if (DEV_FORCE_REGENERATE) {
        await FileSystem.deleteAsync(CACHE_FILE).catch(() => {});
      }

      const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);

      if (fileInfo.exists) {
        setBgUri(fileInfo.uri);
      } else {
        const uri = await generateAndSaveBackground();
        setBgUri(uri);
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

  if (loading || !bgUri) {
    return (
      <View style={style.loadingContainer}>
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return (
    <ImageBackground source={{ uri: bgUri }} style={style.background} resizeMode="cover">
      {children}
    </ImageBackground>
  );
};

export default ScreenBackground;

const style = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  background: { flex: 1 },
});
