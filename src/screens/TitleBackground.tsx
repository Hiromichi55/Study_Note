import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Dimensions, StyleSheet, ImageBackground,PixelRatio } from 'react-native';
import { Skia, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const CACHE_FILE = FileSystem.cacheDirectory + 'background.png';
const DEV_FORCE_REGENERATE = true;
const { width, height } = Dimensions.get('window');

// 背景のパラメータ
const space = 0.03; // 左右の隙間%
const interval = 30; // 罫線の間隔
const row = Math.trunc(height / interval); // 行数
const upperSpace = 4; // 描画しない初めの行数

const ScreenBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Uint8Array → Base64 */
  const uint8ToBase64 = (u8Arr: Uint8Array): string => {
    let binary = '';
    const len = u8Arr.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(u8Arr[i]);
    }
    return global.btoa(binary);
  };

  /** 背景を生成してファイルに保存 */
  const generateAndSaveBackground = async (): Promise<string> => {

    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) throw new Error('Skia.Surface.MakeOffscreen が null');
    const canvas = surface.getCanvas();

    // 背景塗り
    const bgPaint = Skia.Paint();
    bgPaint.setColor(Skia.Color('rgba(255, 255, 255, 1)'));
    canvas.drawRect({ x: 0, y: 0, width, height }, bgPaint);

    // タイトル横線
    const linePaint = Skia.Paint();
    linePaint.setColor(Skia.Color('rgba(152, 173, 211, 1)'));
    linePaint.setStrokeWidth(1.5);

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

    // その他横線
    linePaint.setColor(Skia.Color('rgba(196, 204, 218, 1)'));
    linePaint.setStrokeWidth(1);
    for (let i = upperSpace + 1; i < row + 1; i++) {
      const x1 = width * space;
      const y1 = i / row * height;
      const x2 = width * (1 - space);
      const y2 = y1;
      canvas.drawLine(x1, y1, x2, y2, linePaint);
    }

    // ======== 文字描画ここまで =========

    const image = surface.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();
    const base64 = uint8ToBase64(pngBytes);

    await FileSystem.writeAsStringAsync(CACHE_FILE, base64, { encoding: FileSystem.EncodingType.Base64 });

    console.log('TitileBackground生成完了');
    return CACHE_FILE;
  };

  /** 背景ロード */
  const loadBackground = async () => {
    try {
      if (DEV_FORCE_REGENERATE) {
        await FileSystem.deleteAsync(CACHE_FILE).catch(() => {});
      }

      const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);

      if (fileInfo.exists) {
        console.log('キャッシュあり → 使う');
        setBgUri(fileInfo.uri);
      } else {
        console.log('キャッシュなし → 新規生成');
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return (
    <ImageBackground
      key={bgUri}
      source={{ uri: bgUri }}
      style={styles.background}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
};

export default ScreenBackground;

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  background: { flex: 1 },
});