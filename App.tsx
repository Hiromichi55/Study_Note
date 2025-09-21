// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import NotebookScreen from './src/screens/NotebookScreen';

export type RootStackParamList = {
  Home: undefined;
  Notebook: { bookId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '本棚' }} />
        <Stack.Screen name="Notebook" component={NotebookScreen} options={{ title: 'ノート' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
