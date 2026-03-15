# Study Note – サービス仕様書

> **この文書はAIへのコンテキスト提供を目的とした仕様書です。**
> コードを編集・追加する際は必ずこの文書を最初に読み込んでください。

---

## 1. アプリ概要

| 項目 | 内容 |
|------|------|
| アプリ名 | Study Note |
| プラットフォーム | iOS / Android（Expo managed workflow） |
| 言語 | TypeScript + React Native |
| DBエンジン | expo-sqlite（端末ローカル） |
| ナビゲーション | @react-navigation/native-stack |
| 状態管理 | React Context + useReducer |

**コンセプト**: 学習用ノートアプリ。複数の「本（Book）」を棚に並べ、各本の中に複数ページのページノートを記録する。ページには「章・節・項・単語・文章・画像」の要素を積み上げて構成する。

---

## 2. 画面構成・ナビゲーション

```
HomeScreen (ホーム)
  └─ NotebookScreen (ノートブック)
       └─ EditorScreen (エディタ, NotebookScreenのサブレイヤー)
```

### 2.1 HomeScreen（`src/screens/HomeScreen.tsx`）

**役割**: 本棚画面。登録した Book の一覧を表示する。

| 機能 | 実装状況 |
|------|---------|
| Book一覧の表示 | ✅ 実装済み |
| Book のドラッグ＆ドロップ並び替え | ✅ 実装済み（react-native-draggable-flatlist） |
| カラー選択で新規 Book 追加 | ✅ 実装済み |
| Book をタップして NotebookScreen へ遷移 | ✅ 実装済み |

**Book のカラー選択肢**: `red` / `pink` / `yellow` / `green` / `cyan` / `blue` / `black`

---

### 2.2 NotebookScreen（`src/screens/NotebookScreen.tsx`）

**役割**: 1冊の本の中のノートページを表示・編集する画面。

| 機能 | 実装状況 |
|------|---------|
| ページの表示（NoteElement レンダリング） | ✅ 実装済み |
| スライダーによるページ切り替え | ✅ 実装済み |
| DBからのページ読み込み（loadPageFromDB） | ✅ 実装済み |
| DBへのページ保存（savePageToDB） | ✅ 実装済み |
| ページ上で直接テキストをタップして編集 | ✅ 実装済み（NoteContent内でTextInputに切り替え）※非編集中に行をタップすると編集モードに自動遷移 | 
| 編集中の保存（チェックボタン） | ✅ 実装済み（編集中はミートボールメニュー→ ✓ ボタンに変化し、タップでDB保存+サムネイル保存+編集終了） | 
| 要素の削除（編集中に×ボタン） | ✅ 実装済み |
| 空行タップで要素追加 | ✅ 実装済み（デフォルトは文章） |
| 編集中キーボード上の属性ツールバー | ✅ 実装済み（文章/章/節/項/単語/画像） |
| 改行で次要素へ移動 | ✅ 実装済み |
| ページ追加（右下+ボタン） | ✅ 実装済み |
| ページ編集（メニュー） | ✅ 実装済み（editing=trueに切り替え） |
| スライダー（ページ一覧ボタン・+ボタン間、常時表示） | ✅ 実装済み |
| 検索ロジック（全ページの texts/words/outlines を絞り込み） | ✅ 実装済み（useMemo で計算） |
| 検索結果表示（タップでページ移動） | ✅ 実装済み |
| ページ削除（メニュー） | ✅ 実装済み（cascade削除 + 確認Alert） |
| 本の削除（メニュー） | ✅ 実装済み（cascade削除 + 確認Alert + 画面戻り） |
| 目次ボタン（見出し一覧モーダル） | ✅ 実装済み |
| ページ一覧ボタン（ページ一覧モーダル） | ✅ 実装済み（2列グリッドでサムネイル表示） |
| ノート背景画像の生成・表示 | ✅ 実装済み（expo-file-system でキャッシュ管理） |

---

### 2.3 EditorScreen（`src/screens/EditorScreen.tsx`）

**役割**: 旧エディタ画面（現在はNotebookScreenのインプレース編集に置き換え済み。ファイルは保持）。

> **注意**: インプレース編集への移行により、NotebookScreenからの使用は廃止された。
> NoteContent が直接 `isEditing` モードでTextInputを表示する方式に変更。

---

## 3. データモデル（SQLiteテーブル定義）

### 3.1 books テーブル

```sql
CREATE TABLE books (
  id          TEXT PRIMARY KEY NOT NULL,  -- book_id として使用
  title       TEXT NOT NULL,
  color       TEXT NOT NULL,              -- 'red'|'pink'|'yellow'|'green'|'cyan'|'blue'|'black'
  order_index INTEGER NOT NULL            -- 表示順（0始まり）
);
```

### 3.2 contents テーブル

1ページに1レコード対応（ページの識別子）。

```sql
CREATE TABLE contents (
  content_id TEXT PRIMARY KEY NOT NULL,
  type       TEXT,              -- 現状 'text' 固定（将来拡張用）
  book_id    TEXT,              -- 紐づく books.id
  page       INTEGER,           -- ページ番号（0始まり、ページ順序の唯一の正規フィールド）
  height     REAL               -- ページ高さ（将来用）
);
```

### 3.3 outlines テーブル

見出し要素（章・節・項）を格納。

```sql
CREATE TABLE outlines (
  outline_id TEXT PRIMARY KEY NOT NULL,
  outline    TEXT,                 -- 見出しテキスト
  type       TEXT,                 -- 'chapter'|'section'|'subsection'|'title'
  content_id TEXT                  -- 紐づく contents.content_id
);
```

### 3.4 texts テーブル

文章要素を格納。

```sql
CREATE TABLE texts (
  text_id    TEXT PRIMARY KEY NOT NULL,
  text       TEXT,                 -- 本文テキスト
  content_id TEXT                  -- 紐づく contents.content_id
);
```

### 3.5 words テーブル

単語と説明のペアを格納。

```sql
CREATE TABLE words (
  word_id    TEXT PRIMARY KEY NOT NULL,
  word       TEXT,                 -- 単語
  explanation TEXT,                -- 説明・定義
  word_order INTEGER,              -- ページ内での表示順
  content_id TEXT                  -- 紐づく contents.content_id
);
```

### 3.6 images テーブル

画像要素を格納。

```sql
CREATE TABLE images (
  image_id   TEXT PRIMARY KEY NOT NULL,
  image      TEXT,                 -- 画像URI（ローカルパス or base64）
  content_id TEXT                  -- 紐づく contents.content_id
);
```

### 3.7 page_images テーブル

各ページのサムネイル画像（編集完了時にキャプチャ）を格納。

```sql
CREATE TABLE page_images (
  page_image_id TEXT PRIMARY KEY NOT NULL,
  image_path    TEXT,              -- キャプチャ画像のローカルURI（Documentsディレクトリに保存）
  page_order    INTEGER,           -- ページ番号（0始まり、ページ番号と対応）
  book_id       TEXT               -- 紐づく books.id
);
```

**保存タイミング**: 編集完了（✓ボタン）時に現在ページのサムネイルを `react-native-view-shot` でキャプチャして保存。
`page_order` はページ番号と対応（ページ、0 → `page_order=0`）。未保存のページはアイコンと「未保存」表示。

---

## 4. エンティティ関係図

```
books
  │  id (PK)
  │
  ├── contents (book_id → books.id)
  │     │  content_id (PK), page
  │     │
  │     ├── outlines   (content_id → contents.content_id)  ← 章・節・項
  │     ├── texts      (content_id → contents.content_id)  ← 文章
  │     ├── words      (content_id → contents.content_id)  ← 単語帳
  │     └── images     (content_id → contents.content_id)  ← 画像
  │
  └── page_images (book_id → books.id)                      ← ページ背景
```

---

## 5. NoteElement 型（画面表示用の型）

DBから復元した際に組み立てる画面表示用の Union 型。`src/screens/NoteContent.tsx` で定義。

```typescript
type NoteElement =
  | { type: 'chapter';    text: string }
  | { type: 'section';    text: string }
  | { type: 'subsection'; text: string }
  | { type: 'text';       text: string }
  | { type: 'word';       word: string; meaning: string }
  | { type: 'image';      uri: string }
```

### 編集開始・保存フロー

- **編集開始**: 非編集中にノートの行をタップすると自動的に `editing=true` に遷移し、タップした行にフォーカスが当たる。
  メニューの「ページ編集」からも引き続き遷移可能。
- **保存**: 編集中はヘッダー右のミートボールアイコンが ✓ ボタンに変化する。
  タップ時の処理:
  1. `Keyboard.dismiss()` でキーボードを閉じる
  2. `savePageToDB()` で現在ページの全要素をDBに保存
  3. `captureRef` でノート領域をキャプチャ → `manipulateAsync` でクロップ
  4. Documentsディレクトリの `thumbnails/` に保存し `page_images` テーブルを upsert
  5. `editing=false` に戻す

### インプレース編集時の挙動

| 要素タイプ | 表示モード | 編集モード（`isEditing=true`） |
|-----------|-----------|------------------------------|
| chapter / section / subsection | Text | TextInput（フォントサイズ同一） |
| text | Text | TextInput（フォントサイズ同一） |
| word | 2列 Text | 2列 TextInput（単語・説明を個別編集） |
| image | Image | Image（削除ボタンのみ表示） |

各要素の右上に赤い**×ボタン**が表示され、タップで削除。
編集時はキーボード上に**属性ツールバー**（文章/章/節/項/単語/画像）を表示。
フォーカス中の行に対応する属性ボタンが活性化され、ボタンタップで属性を即時変更できる。
要素の下の空行をタップすると新しい要素を追加（デフォルトは**文章**）。
改行（Return）で次の要素へフォーカス移動し、末尾では次の文章要素を自動追加する。

### DBテーブルとNoteElementのマッピング

| NoteElement.type | DBテーブル     | 補足 |
|-----------------|---------------|------|
| `chapter`       | outlines      | type='chapter' |
| `section`       | outlines      | type='section' |
| `subsection`    | outlines      | type='subsection' |
| `text`          | texts         | |
| `word`          | words         | word + explanation |
| `image`         | images        | image（URI） |

---

## 6. 状態管理（Context）

### 6.1 LibraryContext（`src/context/LibraryContext.tsx`）

**管理対象**: `books` テーブルのみ

**DB初期化責任**: `ENV.INIT_DB=true` のとき、`books` テーブルのみをDROP→再作成する。コンテンツ系テーブルには一切触れない。

| 提供する値 | 型 | 説明 |
|------------|-----|------|
| `state.books` | `Book[]` | 全Bookリスト |
| `state.isLoading` | `boolean` | DB読み込み中フラグ |
| `addBook` | `(book: Book) => Promise<void>` | Book追加 |
| `reorderBooks` | `(newBooks: Book[]) => Promise<void>` | 並び替えを保存 |
| `dispatch` | `React.Dispatch<Action>` | Reducer dispatch |

**Reducer Action**:

```typescript
type Action =
  | { type: 'SET_BOOKS';   books: Book[] }
  | { type: 'ADD_BOOK';    book: Book }
  | { type: 'SET_LOADING'; isLoading: boolean }
```

---

### 6.2 EditorContext（`src/context/EditorContext.tsx`）

**管理対象**: ノートコンテンツ（contents / outlines / texts / words / images / page_images）

**DB初期化責任**: `ENV.INIT_DB=true` のとき、コンテンツ系テーブル（page_images→images→words→texts→outlines→contents の順）をDROP→再作成する。`books` テーブルには一切触れない。

| 提供する値 | 型 | 説明 |
|------------|-----|------|
| `state.contents` | `Content[]` | 全コンテンツ |
| `state.outlines` | `Outline[]` | 全アウトライン |
| `state.texts` | `Text[]` | 全テキスト |
| `state.words` | `Word[]` | 全単語 |
| `state.images` | `Image[]` | 全画像 |
| `state.pageImages` | `PageImage[]` | 全ページ背景 |
| `addContent` / `updateContent` / `deleteContent` | CRUD | contentsテーブル操作 |
| `addOutline` / `updateOutline` / `deleteOutline` | CRUD | outlinesテーブル操作 |
| `addText` / `updateText` / `deleteText` | CRUD | textsテーブル操作 |
| `addWord` / `updateWord` / `deleteWord` | CRUD | wordsテーブル操作 |
| `addImage` / `updateImage` / `deleteImage` | CRUD | imagesテーブル操作 |
| `addPageImage` / `updatePageImage` / `deletePageImage` | CRUD | page_imagesテーブル操作 |
| `getContentsByBookId` | `(bookId: string) => Promise<Content[]>` | Book単位でcontentsを取得 |
| `getTextsByContentId` | `(contentId: string) => Promise<Text[]>` | |
| `getOutlinesByContentId` | `(contentId: string) => Promise<Outline[]>` | |
| `getWordsByContentId` | `(contentId: string) => Promise<Word[]>` | |
| `getImagesByContentId` | `(contentId: string) => Promise<Image[]>` | |
| `getPageImagesByBookId` | `(bookId: string) => Promise<PageImage[]>` | |
| `select` | `(table, where?, params?) => Promise<T[]>` | 汎用SELECT |
| `refreshAll` | `() => Promise<void>` | 全テーブルを再読み込み |

---

## 7. 技術スタック

| ライブラリ | 用途 |
|-----------|------|
| expo | Managed Workflowランタイム |
| react-native | UIフレームワーク |
| typescript | 型付け |
| expo-sqlite | ローカルSQLiteデータベース |
| @react-navigation/native-stack | 画面遷移 |
| react-native-draggable-flatlist | Bookの並び替え（ドラッグ&ドロップ） |
| react-native-paper | UIコンポーネント（Menuなど） |
| react-native-gesture-handler | ジェスチャー処理 |
| react-native-reanimated | アニメーション |
| react-native-view-shot | ページサムネイルのキャプチャ |
| expo-image-manipulator | サムネイルのノート領域クロップ |
| expo-file-system | ファイルI/O（背景画像キャッシュ・サムネイル保存） |
| expo-crypto | UUID生成 |
| @react-native-community/slider | ページ切り替えスライダー |
| expo-font | カスタムフォント |
| expo-splash-screen | スプラッシュ画面 |

---

## 8. フォルダ構成と役割

```
src/
├── App.tsx               # エントリポイント。Stack定義、Provider包含
├── screens/
│   ├── HomeScreen.tsx    # 本棚画面
│   ├── NotebookScreen.tsx # ノートブック画面（ページ表示・編集）
│   ├── EditorScreen.tsx  # エディタUI（NotebookScreen上にオーバーレイ）
│   ├── NoteContent.tsx   # NoteElement[]のレンダリング + 背景画像生成
│   ├── NoteDetailScreen.tsx # (未使用 or 将来用)
│   └── TitleBackground.tsx  # タイトル背景コンポーネント
├── context/
│   ├── LibraryContext.tsx # Book一覧の状態管理
│   ├── EditorContext.tsx  # ノートコンテンツの状態管理・CRUD
│   └── NotesContext.tsx   # (未使用 or 旧実装)
├── components/
│   ├── BookCard.tsx       # Bookカードコンポーネント
│   ├── NoteEditor.tsx     # (旧実装)
│   ├── NoteItem.tsx       # (旧実装)
│   └── NotePage.tsx       # (旧実装)
├── db/
│   ├── db.ts              # SQLite初期化・旧スキーマ（memos/memoBlocks）
│   ├── schema.ts          # 旧スキーマ定義（現在はEditorContext内に移行）
│   └── queries.ts         # 旧クエリ関数
├── hooks/
│   └── useNote.ts         # カスタムフック（現状の使用状況は要確認）
├── constants/
│   ├── messages.ts        # 表示テキスト定数（MESSAGES）
│   └── bookImage.ts       # 本の画像マッピング
├── styles/
│   ├── commonStyle.ts     # 共通スタイル（screenWidth/Heightなど）
│   ├── homeStyle.ts       # HomeScreen用スタイル
│   └── notebookStyle.ts   # NotebookScreen用スタイル
├── types/
│   ├── index.ts           # Book型（旧）
│   ├── memo.ts            # Memo/MemoBlock型（旧）
│   ├── navigation.ts      # ナビゲーション型
│   └── types.ts           # その他型定義
└── utils/
    └── logTable.ts        # デバッグ用テーブルをコンソール出力するユーティリティ
```

---

## 9. 環境変数・フラグ（`config.ts`）

| フラグ名 | 型 | 説明 |
|---------|-----|------|
| `ENV.IS_DEV` | `boolean` | `true`: TestApp表示、`false`: ProductionApp表示 |
| `ENV.SCREEN_DEV` | `boolean` | `true`: デバッグ用背景色・レイアウト枠線を表示 |
| `ENV.INIT_DB` | `boolean` | `true`: 起動ごとにDBを初期化。**LibraryContext** が `books` を、**EditorContext** がコンテンツ系テーブル（contents/texts/outlines/words/images/page_images）を各自でDROP→再作成する |

---

## 10. ページ保存・読み込みフロー

### 保存フロー（`savePageToDB`）

```
1. crypto.randomUUID() で content_id を生成
2. contents テーブルに INSERT（book_id, page番号）
3. pagesElements[currentPageNumber] をループ
   - type='chapter'|'section'|'subsection' → outlines に INSERT
   - type='word'                            → words に INSERT
   - type='image'                           → images に INSERT
   - type='text'                            → texts に INSERT
```

### 読み込みフロー（`loadPageFromDB`）

```
1. getContentsByBookId(bookId) で contents 一覧を取得
2. page === pageNumber のレコードを特定
3. そのcontentIdで outlines / texts / words / images を並列取得
4. NoteElement[] に変換して pagesElements[pageNumber] にセット
5. UIが再レンダリングされてページ内容が表示される
```

---

## 11. 既知の課題・TODO

| 課題 | 優先度 | 詳細 |
|------|--------|------|
| 画像追加が未実装 | 高 | タイプ選択で「画像」を選べるが、イメージピッカー（expo-image-picker等）の統合が未実装 |
| db.ts の旧スキーマが残存 | 低 | `memos`/`memoBlocks` テーブルの定義が残っているが現在は未使用。EditorContext側で新スキーマを使用 |
| NoteContent のスクロール非対応 | 中 | 要素が多い場合に画面外にはみ出す（ページを分割して対処推奨） |
| ページ追加時のDB保存 | 中 | メニュー「ページ追加」はstateのみ更新。初回の編集&保存時にDBに書き込まれる |
