// src/types/navigation.ts
export type RootStackParamList = {
  Home: undefined; // 本棚画面
  Notebook: { bookId: string }; // 選択した本のIDを渡す
  NoteDetail: { bookId: string; noteId: string }; // 特定のノートIDを渡す
};
