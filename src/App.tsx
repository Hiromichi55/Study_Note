// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';// アプリの画面遷移を管理するコンポーネント
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';// 本棚画面コンポーネント
import NotebookScreen from './screens/NotebookScreen';// ノート画面コンポーネント
import { LibraryProvider } from './context/LibraryContext';// データ管理のためのコンテキスト

// 画面遷移時のパラメータの型定義（Home画面はパラメータなし、Notebook画面は本のID(bookId)を受け取る）
export type RootStackParamList = {
  Home: undefined;
  Notebook: { bookId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <LibraryProvider>
      <NavigationContainer>
        {/* ここでアプリ起動時はHomeを指定している */}
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '本棚' }} />
          <Stack.Screen name="Notebook" component={NotebookScreen} options={{ title: 'ノート' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </LibraryProvider>
  );
};

export default App;
