// import React from 'react';
// import NotePage from './components/NotePage';
// import { NotesProvider } from './context/NotesContext';

// const App: React.FC = () => {
//   return (
//     <NotesProvider>
//       <NotePage noteId="1" />
//     </NotesProvider>
//   );
// };

// export default App;


// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import NotebookScreen from './screens/NotebookScreen';
import { LibraryProvider } from './context/LibraryContext';

export type RootStackParamList = {
  Home: undefined;
  Notebook: { bookId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <LibraryProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '本棚' }} />
          <Stack.Screen name="Notebook" component={NotebookScreen} options={{ title: 'ノート' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </LibraryProvider>
  );
};

export default App;
