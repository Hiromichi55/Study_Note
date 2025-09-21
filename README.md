# 📚 Study Notes – プロジェクト構成

## 🚀 アプリの起動

    npx start

- package.jsonの"scripts"で"start"が定義されており、npm expo startが実行される。
- Expoの開発サーバー(Metro Bundler)が起動される。
- App.tsxが実行される。
- QRコードをExpoアプリを入れたiphoneで読み取ると画面が表示される。

## フォルダ構成
```bash
project-root/
├─ package.json
└─ src/
   ├─ App.tsx               // アプリのエントリポイント
   │
   ├─ screens/              // 画面単位のコンポーネント
   │   ├─ HomeScreen.tsx    // タイトル画面
   │   ├─ NotebookScreen.tsx // ノートの画面
   │   └─ NoteDetailScreen.tsx // 編集画面
   │
   ├─ components/           // 小さいUI部品（カード、リストアイテム、エディタなど）
   │   ├─ BookCard.tsx
   │   ├─ NoteItem.tsx
   │   └─ NoteEditor.tsx
   │
   ├─ context/              // Context APIやReducer（グローバル状態管理）
   │   └─ LibraryContext.tsx
   │
   ├─ hooks/                // カスタムフック（useNoteなど）
   │   └─ useNote.ts
   │
   ├─ navigation/           // ナビゲーション関連（型、Stack定義など）
   │   └─ RootStackParamList.ts
   │
   ├─ types/                // 共通の型定義（Note, Bookなど）
   │   └─ index.ts
   │
   ├─ styles/               // 共通スタイル（Themeなど）
   │   └─ theme.ts
   │
   └─ utils/                // 汎用関数、フォーマッタなど
       └─ formatDate.ts
```
## 詳細
| フォルダ            | 役割                                                                     |
| --------------- | ---------------------------------------------------------------------- |
| **App.tsx**     | アプリ全体のエントリポイント。`<NavigationContainer>` や `<LibraryProvider>` をここにまとめる。 |
| **screens/**    | 画面単位のコンポーネント。React Navigation から呼び出される。                                |
| **components/** | 複数画面で使い回す小さいUI部品（カード・リスト・エディタなど）。                                      |
| **context/**    | React Context＋Reducerでアプリ全体の状態管理を行う。                                   |
| **hooks/**      | よく使う処理をカスタムフックとして切り出し。                                                 |
| **navigation/** | 画面遷移の型定義やStack設定をまとめる。                                                 |
| **types/**      | Book, Noteなどのデータモデルを定義する。                                              |
| **styles/**     | カラーテーマや共通スタイルなど。                                                       |
| **utils/**      | 日付フォーマットなどの共通処理。                                                       |
