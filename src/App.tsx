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

// ===== 開発フラグ =====
const IS_DEV = false; // true: テスト用, false: 本番用

// ===== スタックナビ =====
const Stack = createNativeStackNavigator<any>();

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    'MyFont': require('../assets/fonts/dartsfont.ttf'),
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
      {IS_DEV ? <TestApp /> : <ProductionApp />}
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
            <Stack.Screen name="Home" component={HomeScreenProduction} options={{ headerShown: false }} />
            <Stack.Screen name="Notebook" component={NotebookScreen} options={{ title: MESSAGES.NOTE_TITLE }} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </LibraryProvider>
  );
}

// ==================== テスト用コンポーネント ====================
function TestApp() {
  return (
    <EditorProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreenTest} />
          <Stack.Screen name="DBTest" component={DBTestComponent} />
        </Stack.Navigator>
      </NavigationContainer>
    </EditorProvider>
  );
}

// ===== DB動作確認用コンポーネント =====
const DBTestComponent = () => {
  const { state, addContent, select } = useEditor();

  useEffect(() => {
    const testDB = async () => {
      try {
        const existing = await select<Content>('contents', 'content = ?', ['テストコンテンツ']);
        if (existing.length === 0) {
          const newContent: Content = {
            content: 'テストコンテンツ',
            order_index: 1,
            type: 'note',
            book_Id: 'book1',
            page: 1,
            height: 100,
          };
          await addContent(newContent);
        }
        const allContents = await select<Content>('contents');
        console.log('Contents from DBTestComponent:', allContents);
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
      {state.contents.map((c, idx) => (
        <Text key={idx}>{`${c.order_index}: ${c.content} (Book: ${c.book_Id})`}</Text>
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
  DBTest: undefined;
};
