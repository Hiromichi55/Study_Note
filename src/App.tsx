// App.tsx
import React from 'react';
import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
// import { createStackNavigator } from '@react-navigation/stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import NotebookScreen from './screens/NotebookScreen';
import EditScreen from './screens/EditScreen';
import { LibraryProvider } from './context/LibraryContext';
import { Text, StyleSheet } from 'react-native';
import * as Font from 'expo-font';
import AppLoading from 'expo-app-loading';
import * as SplashScreen from 'expo-splash-screen';
import { MESSAGES } from './constants/messages';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator<RootStackParamList>();

// アプリの起動時にスプラッシュスクリーンを保持
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    'MyFont': require('../assets/fonts/dartsfont.ttf'),
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LibraryProvider>
        <PaperProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Home"
              screenOptions={{
                headerTitleStyle: { fontFamily: 'MyFont' },
                gestureEnabled: true,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }}  />
              <Stack.Screen name="Notebook" component={NotebookScreen} options={{ title: MESSAGES.NOTE_TITLE }} />
              <Stack.Screen name="Edit" component={EditScreen}/>
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </LibraryProvider>
    </GestureHandlerRootView>
  );
}


// 画面遷移時のパラメータの型定義（Home画面はパラメータなし、Notebook画面は本のID(bookId)を受け取る）
export type RootStackParamList = {
  Home: undefined;
  Notebook: { bookId: string };
  Edit: { bookId: string };
};
