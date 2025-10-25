import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { useLibrary } from '../context/LibraryContext';
import { Ionicons } from '@expo/vector-icons';

type EditScreenRouteProp = RouteProp<RootStackParamList, 'Edit'>;

interface Props {
  route: EditScreenRouteProp;
}

const EditScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const [title, setTitle] = useState(book?.title || '');

  // --- ヘッダーフォントの設定 ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '編集',
      headerTitleStyle: {
        fontSize: 20,
        color: 'black',
        fontWeight: '400', 
      },
    });
  }, [navigation]);

  if (!book) return <Text>本が見つかりません。</Text>;

  const handleSave = () => {
    dispatch({ 
        type: 'UPDATE_BOOK_TITLE', 
        bookId:book.id, 
        title,
     });
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 20, marginBottom: 10 }}>タイトルを編集</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 10,
          fontSize: 18,
        }}
      />
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 30,
          right: 20,
          backgroundColor: 'black',
          borderRadius: 30,
          width: 60,
          height: 60,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
        onPress={handleSave}
      >
        <Ionicons name="checkmark" size={35} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default EditScreen;
