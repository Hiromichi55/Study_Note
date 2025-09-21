import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView, ImageBackground } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { useLibrary } from '../context/LibraryContext';
import { MESSAGES } from '../constants/messages';
import {
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';

import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type NotebookScreenRouteProp = RouteProp<RootStackParamList, 'Notebook'>;

interface Props {
  route: NotebookScreenRouteProp;
}

const NotebookScreen: React.FC<Props> = ({ route }) => {
  const scale = useSharedValue(1);

  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onActive: (event) => {
      scale.value = event.scale;
    },
    onEnd: () => {
      scale.value = withTiming(1, { duration: 200 });
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { bookId } = route.params;
  const { state, dispatch } = useLibrary();

  const book = state.books.find((b) => b.id === bookId);
  const [content, setContent] = useState(book?.content ?? '');
  const [editing, setEditing] = useState(false);

  if (!book) return <Text>{MESSAGES.NOT_FOUND_BOOK}</Text>;

  return (
    <ImageBackground
      source={require('../../assets/images/note.png')}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      imageStyle={{ width: '100%', height: '100%' }}
      resizeMode="contain"
    >
      <View style={{ flex: 1, padding: 20, backgroundColor: 'rgba(255,255,255,0.7)', width: '100%' }}>
        <Text style={{ fontSize: 20, marginBottom: 10 }}>{book.title}</Text>

        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <View style={{ marginRight: editing ? 10 : 0 }}>
            <Button
              title={editing ? '編集終了' : '編集する'}
              onPress={() => setEditing(!editing)}
            />
          </View>
          {editing && (
            <View>
              <Button
                title="保存"
                onPress={() => {
                  dispatch({ type: 'UPDATE_CONTENT', bookId: book.id, content });
                  setEditing(false);
                }}
              />
            </View>
          )}
        </View>

        <ScrollView style={{ marginTop: 20 }}>
          <PinchGestureHandler onGestureEvent={pinchHandler}>
            <Animated.View style={animatedStyle}>
              {editing ? (
                <TextInput
                  style={{
                    borderWidth: 1,
                    padding: 10,
                    minHeight: 400,
                    textAlignVertical: 'top',
                    fontFamily: 'MyFont',
                  }}
                  multiline
                  value={content}
                  onChangeText={setContent}
                />
              ) : (
                <Text style={{ fontSize: 16, lineHeight: 24, fontFamily: 'MyFont' }}>
                  {book.content || MESSAGES.NEW_BOOK_CONTENT}
                </Text>
              )}
            </Animated.View>
          </PinchGestureHandler>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

export default NotebookScreen;
