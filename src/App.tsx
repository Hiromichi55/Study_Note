// App.tsx
import React, { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LibraryProvider } from './context/LibraryContext';
import { EditorProvider, useEditor, Content } from './context/EditorContext';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Font from 'expo-font';
import AppLoading from 'expo-app-loading';
import * as SplashScreen from 'expo-splash-screen';
import { MESSAGES } from './constants/messages';
import HomeScreenProduction from './screens/HomeScreen';
import NotebookScreen from './screens/NotebookScreen';
import { ENV } from '@config';

// ===== 開発フラグ =====
const IS_DEV = ENV.IS_DEV; // true: テスト用, false: 本番用

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
  });

  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  if (!fontsLoaded && !IS_DEV) return <AppLoading />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <EditorProvider>
        {IS_DEV ? <TestApp /> : <ProductionApp />}
      </EditorProvider>
    </GestureHandlerRootView>
  );
}

// ==================== 本番用コンポーネント ====================
function ProductionApp() {
  return (
    <LibraryProvider>
      <PaperProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerTitleStyle: { fontFamily: 'MyFont' },
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
              component={NotebookScreen}
              options={{ title: MESSAGES.NOTE_TITLE }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </LibraryProvider>
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
            content_order: 1,
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
        <Text key={c.content_id}>{`${c.content_order}: ${c.content_id} (Book: ${c.book_id})`}</Text>
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
  Notebook: { bookId: string };
  Edit: { bookId: string }; 
};
