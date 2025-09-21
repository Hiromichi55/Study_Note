# Study Notes
aaaa
# 仕様
npx expo start

''' shell
project-root/
├─ App.tsx               // アプリのエントリポイント（NavigationContainerをセット）
├─ package.json
└─ src/
   ├─ screens/           // 画面単位のコンポーネント
   │   ├─ HomeScreen.tsx
   │   ├─ NotebookScreen.tsx
   │   └─ NoteDetailScreen.tsx
   │
   ├─ components/        // 小さいUI部品（カード、リストアイテム、エディタなど）
   │   ├─ BookCard.tsx
   │   ├─ NoteItem.tsx
   │   └─ NoteEditor.tsx
   │
   ├─ context/           // Context APIやReducer（グローバル状態管理）
   │   └─ LibraryContext.tsx
   │
   ├─ hooks/             // カスタムフック（useNoteなど）
   │   └─ useNote.ts
   │
   ├─ navigation/        // ナビゲーション関連（型、Stack定義など）
   │   └─ RootStackParamList.ts
   │
   ├─ types/             // 共通の型定義（Note, Bookなど）
   │   └─ index.ts
   │
   ├─ styles/            // 共通スタイル（Themeなど）
   │   └─ theme.ts
   │
   └─ utils/             // 汎用関数、フォーマッタなど
       └─ formatDate.ts
'''