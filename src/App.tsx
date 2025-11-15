// App.tsx
import React, { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EditorProvider, useEditor, Content } from './context/EditorContext';

// スタックナビゲーション
const Stack = createNativeStackNavigator<RootStackParamList>();

// ===== DBTestComponent: DB動作確認用 =====
const DBTestComponent = () => {
  const { state, addContent, select } = useEditor();

  useEffect(() => {
    const testDB = async () => {
      try {
        // 同じ内容を何度も追加しない
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

// ===== HomeScreen（仮の画面） =====
const HomeScreen = ({ navigation }: any) => {
  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Home Screen</Text>
      <Text onPress={() => navigation.navigate('DBTest')} style={{ marginTop: 20, color: 'blue' }}>
        Go to DBTest
      </Text>
    </ScrollView>
  );
};

// ===== メイン App =====
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <EditorProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="DBTest" component={DBTestComponent} />
          </Stack.Navigator>
        </NavigationContainer>
      </EditorProvider>
    </GestureHandlerRootView>
  );
}

// 画面遷移時のパラメータ型
export type RootStackParamList = {
  Home: undefined;
  DBTest: undefined;
};
