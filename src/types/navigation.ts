// src/types/navigation.ts
export type RootStackParamList = {
  Home: undefined; // 本棚画面
  Notebook: { bookId: string; initialPage?: number; source?: 'home' | 'wordbook' }; // 選択した本のIDと初期ページを渡す
  Wordbook: undefined; // 単語帳画面
  License: undefined; // ライセンス情報画面
  NoteDetail: { bookId: string; noteId: string }; // 特定のノートIDを渡す
};
