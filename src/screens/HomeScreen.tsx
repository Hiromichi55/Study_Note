// src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, TextInput, Image, TouchableOpacity } from 'react-native'; // TouchableOpacity 押せる領域を作るコンポーネント。ここに onPress で遷移処理を書く
import { useLibrary } from '../context/LibraryContext'; // 独自の状態管理フック（本の一覧を管理する）
import { StackNavigationProp } from '@react-navigation/stack'; // React Navigation の「Stack ナビゲーション用型定義」
import { RootStackParamList } from '../App'; // 画面とパラメータの一覧型（App.tsx などで定義しているはず）
import { MESSAGES } from '../constants/messages'; // 定数メッセージ（タイトルやプレースホルダーなど）


// RootStackParamList で定義した 'Home' 画面に対応する navigation オブジェクトの型になる
type HomeScreenNavProp = StackNavigationProp<RootStackParamList, 'Home'>;// Home 画面用の navigation の型

// HomeScreen コンポーネントが受け取る props の型定義
// → navigation というプロパティを持っていることを明示している
interface Props {
  navigation: HomeScreenNavProp;
}

// HomeScreen コンポーネント本体
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useLibrary();// useLibrary から状態と dispatch 関数を取得（本の追加・削除などに使う）
  const [newTitle, setNewTitle] = useState('');// 新しい本のタイトルを入力するための state

  return (
    /* 本追加用の入力欄とボタン */
    <View style={{ flex: 1, padding: 20 }}>
    <Text style={{ fontSize: 24, marginBottom: 20}}>{MESSAGES.SHELF_TITLE}</Text>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TextInput
          style={{ borderWidth: 1, padding: 8, flex: 1, marginRight: 8 }}
          placeholder={MESSAGES.ADD_BOOK_PLACEHOLDER} // プレースホルダー文字
          value={newTitle} // 入力中の値
          onChangeText={setNewTitle} // 入力が変わったときに state 更新
        />
        <Button
          title="追加"
          onPress={() => { 
            if (newTitle.trim()) { // 入力が空でなければ本を追加
              dispatch({ 
                type: 'ADD_BOOK', 
                id: Date.now().toString(), // 一意なIDとして現在時刻を文字列に
                title: newTitle.trim() // 入力値（余白削除）
              });
              setNewTitle(''); // 入力欄をクリア
            }
          }}
        />
      </View>
      {/* 追加された本の一覧をボタンとして表示 */}
      {state.books.map((book) => (
      <TouchableOpacity
          onPress={() => navigation.navigate('Notebook', { bookId: book.id })}
          style={{ 
            position: 'relative', 
            width: 80 * 1.5, // 画像の実際のサイズに合わせる（150%）
            height: 80 * 1.5,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center' // 親ビューの中央に配置
          }}
      >
        {/* 画像と文字を重ねるための親ビュー */}
        <View style={{ position: 'relative', width: 80, height: 80 }}>
          {/* 画像部分 */}
          <Image
            source={require('../../assets/images/blue_book.png')} // 本のアイコン画像
            style={{ 
              width: '100%', 
              height: '100%',
              position: 'absolute'
            }}
            resizeMode="contain"
          />

          {/* タイトルテキストを画像の上に重ねる */}
          <Text
            style={{
              fontSize: 12,
              color: 'black',
              textAlign: 'center',
              lineHeight: 14,
              // iOSならこれで縦書き
              // writingDirection: 'vertical-rl',
            }}
          >
            {/* Android/iOS両対応の縦書き風：1文字ずつ改行 */}
            {book.title.split('').join('\n')}
          </Text>
        </View>
      </TouchableOpacity>
))}
    </View>
  );
};

export default HomeScreen;
