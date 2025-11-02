import React, { useEffect, useRef, useState } from 'react';
import { View, ImageBackground, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import Canvas from 'react-native-canvas';
import * as FileSystem from 'expo-file-system/legacy';

const CACHE_FILE = FileSystem.cacheDirectory + 'background.png';

// 開発用フラグ：true の場合、キャッシュ無視して毎回生成
const DEV_FORCE_REGENERATE = true;

const ScreenBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const canvasRef = useRef<Canvas | null>(null);
    const [bgUri, setBgUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const generateBackground = async (canvas: Canvas): Promise<string> => {
    console.log('背景生成開始');
    const { width, height } = Dimensions.get('window');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }

    const dataUrl = await canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    await FileSystem.writeAsStringAsync(CACHE_FILE, base64, { encoding: 'base64' });
    console.log('背景生成完了');

    // キャッシュしたファイルの URI を返す
    return CACHE_FILE;
    };


    const loadBackground = async () => {
    console.log('キャッシュ確認');
    const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);

    if (fileInfo.exists && !DEV_FORCE_REGENERATE) {
        console.log('キャッシュあり');
        setBgUri(fileInfo.uri);
        setLoading(false);
    } else {
        console.log('キャッシュなし、新規生成します');
        if (canvasRef.current) {
        const fileUri = await generateBackground(canvasRef.current);
        setBgUri(fileUri); // ここは dataUrl ではなく file:// URI
        setLoading(false);
        }
    }
    };


    useEffect(() => {
        loadBackground();
    }, []);

    if (loading || !bgUri) {
        return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#666" />
            {/* 画面外に Canvas を置く */}
            <Canvas ref={canvasRef} style={{ position: 'absolute', width: 0, height: 0, top: 0, left: 0 }} />
        </View>
        );
    }

    return (
        <ImageBackground source={{ uri: bgUri }} style={styles.background}>
        {children}
        </ImageBackground>
    );
};

export default ScreenBackground;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    flex: 1,
  },
});
