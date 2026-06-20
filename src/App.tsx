// App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { EditorProvider, useEditor, Content } from './context/EditorContext';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { MESSAGES } from './constants/messages';
import HomeScreenProduction from './screens/HomeScreen';
import NotebookScreen from './screens/NotebookScreen';
import WordbookScreen from './screens/WordbookScreen';
import WordListScreen from './screens/WordListScreen';
import LicensesScreen from './screens/LicensesScreen';
import { ENV } from '@config';

// ===== DB 全テーブル出力関数 =====
async function dumpDatabase(editor: ReturnType<typeof useEditor>) {
  const { select } = editor;
  const tables = ['books', 'contents', 'texts', 'outlines', 'words', 'images'];

  for (const table of tables) {
    try {
      const rows = await select(table);
      console.log(`\n===== TABLE: ${table} =====`);
      console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
      console.error(`Error reading table ${table}:`, err);
    }
  }
}

// ===== スタックナビ =====
const Stack = createNativeStackNavigator<any>();

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    'dartsfont': require('../assets/fonts/dartsfont.ttf'),
    'HiraMinProN-W3': require('../assets/fonts/HiraMinProN-W3-AlphaNum-01.otf'),
    'HiraMinProN-W6': require('../assets/fonts/HiraMinProN-W6-AlphaNum-03.otf'),
    'piroji': require('../assets/fonts/piroji.ttf'),
    'pencil': require('../assets/fonts/pencil_free.ttf'),
    'sanari': require('../assets/fonts/SanariFontB002.ttf'),
    'sanari-bold': require('../assets/fonts/SanariFontH002.ttf'),
  });

  useEffect(() => {
    const hideSplash = async () => {
      if (fontsLoaded) {
        await SplashScreen.hideAsync();
      }
    };
    hideSplash();
  }, [fontsLoaded]);

  // フォント読み込みまで待機
  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <EditorProvider>
        <ProductionApp />
      </EditorProvider>
    </GestureHandlerRootView>
  );
}

// ==================== ローディング画面 ====================
function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // アイコン＋タイトルのフェードインとスケール
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    // ドットのウェーブアニメーション
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 380, useNativeDriver: true }),
          Animated.delay(760 - delay),
        ])
      );

    const d1 = pulse(dotAnim1, 0);
    const d2 = pulse(dotAnim2, 200);
    const d3 = pulse(dotAnim3, 400);
    d1.start(); d2.start(); d3.start();
    return () => { d1.stop(); d2.stop(); d3.stop(); };
  }, []);

  return (
    <View style={loadingStyles.container}>
      <Animated.View style={[loadingStyles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('../assets/images/loading.png')}
          style={loadingStyles.icon}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[loadingStyles.dotsRow, { opacity: fadeAnim }]}>
        {([dotAnim1, dotAnim2, dotAnim3] as Animated.Value[]).map((anim, i) => (
          <Animated.View key={i} style={[loadingStyles.dot, { opacity: anim }]} />
        ))}
      </Animated.View>
    </View>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
  },
  dotsRow: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: SCREEN_H * 0.14,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B6F52',
  },
});

// ==================== 本番用コンポーネント ====================
function ProductionApp() {
  return (
    <LibraryProvider>
      <PaperProvider>
        {ENV.ENABLE_DB_LOGGER && <StartupDBLogger />}
        <ProductionAppContent />
      </PaperProvider>
    </LibraryProvider>
  );
}

// DB初期化(state.isLoading)が終わるまではローディング画面を表示する
function ProductionAppContent() {
  const { state } = useLibrary();

  if (state.isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          // headerTitleStyle: { fontFamily: 'piroji' },
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreenProduction}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notebook"
          component={NotebookScreen as any}
          options={{ title: MESSAGES.NOTE_TITLE }}
        />
        <Stack.Screen
          name="Wordbook"
          component={WordbookScreen as any}
          options={{ title: '一問一答', animation: 'slide_from_left', gestureEnabled: false, headerBackTitle: '' }}
        />
        <Stack.Screen
          name="WordList"
          component={WordListScreen as any}
          options={{ title: '単語リスト', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="License"
          component={LicensesScreen as any}
          options={{ title: '詳細情報' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ==================== テスト用コンポーネント ====================
function TestApp() {
  return (
    <>
      <StartupDBLogger />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreenTest} />
          <Stack.Screen name="DBTest" component={DBTestComponent} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

// ===== DB ロガー（テスト時のみ起動） =====
function StartupDBLogger() {
  const editor = useEditor();

  useEffect(() => {
    if (!editor.state.isLoading) {
      dumpDatabase(editor);
    }
  }, [editor.state.isLoading]);

  return null;
}

// ===== DB動作確認用コンポーネント =====
const DBTestComponent = () => {
  const { state, addContent, select } = useEditor();

  useEffect(() => {
    const testDB = async () => {
      try {
        const existing = await select<Content>('contents', 'content_id = ?', [1]);
        if (existing.length === 0) {
          const newContent: Content = {
            content_id: '1',
            type: 'image',
            book_id: 'book1',
            page: 1,
            height: 100,
          };
          //console.log(newContent);
          console.log('before add content');
          await addContent(newContent);
        }
        const allContents = await select<Content>('contents');
        // console.log('Contents from DBTestComponent:', allContents);
      } catch (err) {
        console.error('DBTestComponent error:', err);
      }
    };

    if (!state.isLoading) {
      testDB();
    }
  }, [state.isLoading]);

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>EditorContext + DB Test</Text>
      <Text>Hello from EditorContext!</Text>
      <Text>isLoading: {state.isLoading ? 'true' : 'false'}</Text>
      {state.contents.map((c) => (
        <Text key={c.content_id}>{`page${c.page}: ${c.content_id} (Book: ${c.book_id})`}</Text>
      ))}
    </ScrollView>
  );
};

// ===== テスト用 HomeScreen =====
const HomeScreenTest = ({ navigation }: any) => (
  <ScrollView style={{ padding: 20 }}>
    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Home Screen</Text>
    <Text
      onPress={() => navigation.navigate('DBTest')}
      style={{ marginTop: 20, color: 'blue' }}
    >
      Go to DBTest
    </Text>
  </ScrollView>
);

// ===== 画面遷移パラメータ型 =====
export type RootStackParamList = {
  Home: undefined;
  Notebook: { bookId: string; initialPage?: number; source?: 'home' | 'wordbook' };
  Wordbook: undefined;
  WordList: undefined;
  License: undefined;
  Edit: { bookId: string };
};
