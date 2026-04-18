// src/context/LibraryContext.tsx
import React, { createContext, useReducer, useContext, useEffect, useRef, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';
import { ENV } from '@config';
import { logTable } from '../utils/logTable';

const isDelete = ENV.INIT_DB; // trueにすると毎回初期化される

export type Book = {
  book_id: string;
  title: string;
  color: 'blue' | 'cyan' | 'green' | 'red' | 'yellow' | 'black' | 'orange' | 'purple' | 'brown' | 'gray' | 'pink' | 'olive'; // 本の色
  order_index: number; // 並び順を管理するためのフィールド
  created_at?: string;
  updated_at?: string;
  is_pinned?: boolean;
};

const parseBookUpdatedAt = (value?: string): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortBooksByUpdatedAt = (books: Book[]): Book[] => {
  return [...books].sort((a, b) => {
    const diff = parseBookUpdatedAt(b.updated_at) - parseBookUpdatedAt(a.updated_at);
    if (diff !== 0) return diff;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });
};

const SHOWCASE_BOOKS: Book[] = [
  { book_id: '1', title: '国語', color: 'red', order_index: 0 },
  { book_id: '2', title: '算数', color: 'blue', order_index: 1 },
  { book_id: '3', title: '理科', color: 'green', order_index: 2 },
  { book_id: '4', title: '社会', color: 'orange', order_index: 3 },
  { book_id: '5', title: '英語', color: 'yellow', order_index: 4 },
];

const PRODUCTION_BOOKS: Book[] = [
  { book_id: '1', title: '使い方', color: 'brown', order_index: 0 },
  { book_id: '2', title: 'サンプルノート', color: 'blue', order_index: 1 },
];

const initialBooks: Book[] = ENV.IS_PRODUCTION ? PRODUCTION_BOOKS : SHOWCASE_BOOKS;
const BOOKS_MODE_META_KEY = 'books_seed_mode';


type State = {
  books: Book[];
  isLoading: boolean;
};

type Action =
  | { type: 'SET_BOOKS'; books: Book[] }
  | { type: 'ADD_BOOK'; book: Book }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'DELETE_BOOK'; bookId: string }
  | { type: 'RENAME_BOOK'; bookId: string; title: string }
  | { type: 'RECOLOR_BOOK'; bookId: string; color: Book['color'] }
  | { type: 'TOGGLE_PIN_BOOK'; bookId: string; isPinned: boolean }
  | { type: 'TOUCH_BOOK'; bookId: string; updatedAt: string };

const initialState: State = { 
  books: initialBooks,
  isLoading: true 
};

const LibraryContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  addBook: (book: Book) => Promise<void>;
  reorderBooks: (newBooks: Book[]) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  renameBook: (bookId: string, title: string) => Promise<void>;
  recolorBook: (bookId: string, color: Book['color']) => Promise<void>;
  toggleBookPin: (bookId: string, isPinned: boolean) => Promise<void>;
  touchBook: (bookId: string) => Promise<void>;
}>({
  state: initialState,
  dispatch: () => null,
  addBook: async () => {},
  reorderBooks: async () => {},
  deleteBook: async () => {},
  renameBook: async () => {},
  recolorBook: async () => {},
  toggleBookPin: async () => {},
  touchBook: async () => {},
});

function libraryReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BOOKS':
      return { ...state, books: sortBooksByUpdatedAt(action.books) };
    case 'ADD_BOOK':
      return { ...state, books: sortBooksByUpdatedAt([...state.books, action.book]) };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'DELETE_BOOK':
      return { ...state, books: state.books.filter(b => b.book_id !== action.bookId) };
    case 'RENAME_BOOK':
      return {
        ...state,
        books: sortBooksByUpdatedAt(
          state.books.map(b =>
            b.book_id === action.bookId ? { ...b, title: action.title, updated_at: new Date().toISOString() } : b
          )
        ),
      };
    case 'RECOLOR_BOOK':
      return {
        ...state,
        books: sortBooksByUpdatedAt(
          state.books.map(b =>
            b.book_id === action.bookId ? { ...b, color: action.color, updated_at: new Date().toISOString() } : b
          )
        ),
      };
    case 'TOGGLE_PIN_BOOK':
      return {
        ...state,
        books: sortBooksByUpdatedAt(
          state.books.map(b =>
            b.book_id === action.bookId ? { ...b, is_pinned: action.isPinned } : b
          )
        ),
      };
    case 'TOUCH_BOOK':
      return {
        ...state,
        books: sortBooksByUpdatedAt(
          state.books.map(b =>
            b.book_id === action.bookId ? { ...b, updated_at: action.updatedAt } : b
          )
        ),
      };
    default:
      return state;
  }
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(libraryReducer, initialState);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const isReorderingRef = useRef(false);
  const pendingReorderRef = useRef<Book[] | null>(null);

  // データベース初期化とデータ読み込み
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        dispatch({ type: 'SET_LOADING', isLoading: true });

        // データベース初期化
        const database = await initDB();
        setDb(database);

        await database.runAsync(`
          CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT
          );
        `);

        const modeRows = await database.getAllAsync(
          'SELECT value FROM app_meta WHERE key = ?;',
          [BOOKS_MODE_META_KEY]
        );
        const storedMode = String((modeRows[0] as any)?.value ?? '');
        
        // ✅ テーブルが存在するか確認（非同期版）
        const tableCheckResult = await database.getAllAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='books';"
        );
        const tableExists = tableCheckResult.length > 0;

        if (!tableExists || isDelete || storedMode !== ENV.APP_MODE) {
          // LibraryContext は books テーブルのみ管理する
          // コンテンツ系テーブルは EditorContext が責任を持つ
          await database.runAsync('DROP TABLE IF EXISTS books;');

          // books テーブルを再作成
          await database.runAsync(`
            CREATE TABLE books (
              id TEXT PRIMARY KEY NOT NULL,
              title TEXT NOT NULL,
              color TEXT NOT NULL,
              order_index INTEGER DEFAULT 0,
              is_pinned INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `);

          const nowIso = new Date().toISOString();
          // 初期データを挿入
          for (const b of initialBooks) {
            await database.runAsync(
              'INSERT INTO books (id, title, color, order_index, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [b.book_id, b.title, b.color, b.order_index, 0, nowIso, nowIso]
            );
          }

          await database.runAsync(
            'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
            [BOOKS_MODE_META_KEY, ENV.APP_MODE]
          );
        }
        const bookTableInfo = await database.getAllAsync('PRAGMA table_info(books);');
        const hasUpdatedAt = (bookTableInfo as any[]).some((col) => String(col?.name) === 'updated_at');
        const hasCreatedAt = (bookTableInfo as any[]).some((col) => String(col?.name) === 'created_at');
        const hasPinned = (bookTableInfo as any[]).some((col) => String(col?.name) === 'is_pinned');
        if (!hasUpdatedAt) {
          await database.runAsync('ALTER TABLE books ADD COLUMN updated_at TEXT;');
          await database.runAsync("UPDATE books SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);");
        }
        if (!hasCreatedAt) {
          await database.runAsync('ALTER TABLE books ADD COLUMN created_at TEXT;');
          await database.runAsync('UPDATE books SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP);');
        }
        if (!hasPinned) {
          await database.runAsync('ALTER TABLE books ADD COLUMN is_pinned INTEGER DEFAULT 0;');
          await database.runAsync('UPDATE books SET is_pinned = COALESCE(is_pinned, 0);');
        }

        // データ読み込み
        const result = await database.getAllAsync('SELECT * FROM books ORDER BY datetime(updated_at) DESC, order_index ASC;');
        logTable('Booksテーブル読込', result as Record<string, any>[]);

        let books: Book[] = result.map((row: any) => ({
          book_id: String(row.id),
          title: String(row.title),
          color: (row.color || 'blue') as Book['color'],  // ✅ 明示的に型を指定
          order_index: Number(row.order_index || 0),
          created_at: row.created_at ? String(row.created_at) : undefined,
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
          is_pinned: Number(row.is_pinned || 0) === 1,
        }));

        // ✅ データベースが空なら初期データを挿入
        if (books.length === 0) {
          const nowIso = new Date().toISOString();
          for (const book of initialBooks) {
            await database.runAsync(
              'INSERT INTO books (id, title, color, order_index, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [book.book_id, book.title, book.color, book.order_index, 0, nowIso, nowIso]
            );
          }
          await database.runAsync(
            'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
            [BOOKS_MODE_META_KEY, ENV.APP_MODE]
          );
          books = initialBooks.map((book) => {
            const nowIso = new Date().toISOString();
            return { ...book, created_at: nowIso, updated_at: nowIso };
          }); // 上書き
        }

        dispatch({ type: 'SET_BOOKS', books });
        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        console.error('DB初期化エラー(LibraryContext):', error);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    };

    setupDatabase();
  }, []);

  // 本を追加する関数 Bookテーブル
  const addBook = async (book: Book) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    try {
      const updatedAt = new Date().toISOString();
      const createdAt = book.created_at ?? updatedAt;
      await db.runAsync(
        'INSERT OR REPLACE INTO books (id, title, color, order_index, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [book.book_id, book.title || '', book.color, book.order_index, book.is_pinned ? 1 : 0, createdAt, book.updated_at ?? updatedAt]
      );
      dispatch({ type: 'ADD_BOOK', book: { ...book, created_at: createdAt, updated_at: book.updated_at ?? updatedAt } });
    } catch (error) {
      console.error('本の追加エラー:', error);
    }
  };

  const reorderBooks = async (newBooks: Book[]) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    // 最新の並び替え要求のみを保持し、保存処理は常に1つずつ実行する
    pendingReorderRef.current = newBooks.map((book) => ({ ...book }));
    if (isReorderingRef.current) return;

    isReorderingRef.current = true;
    try {
      while (pendingReorderRef.current) {
        const booksToApply = pendingReorderRef.current;
        pendingReorderRef.current = null;

        // order_indexを0から連番で振り直して順番更新
        for (let i = 0; i < booksToApply.length; i++) {
          const book = booksToApply[i];
          await db.runAsync(
            'UPDATE books SET order_index = ? WHERE id = ?',
            [i, book.book_id]
          );
        }

        // 更新後のDB内容を取得してログ出力
        const result = await db.getAllAsync('SELECT * FROM books ORDER BY order_index ASC;');
        logTable('Booksテーブル読込(並び替え後):', result as Record<string, any>[]);

        // state側も更新。order_indexを修正した状態でセット
        const updatedBooks = booksToApply.map((book, index) => ({
          ...book,
          order_index: index,
        }));
        dispatch({ type: 'SET_BOOKS', books: updatedBooks });
      }
    } catch (error) {
      console.error('並び替えの保存エラー:', error);
    } finally {
      isReorderingRef.current = false;
    }
  };

  // 本を削除する関数
  const deleteBook = async (bookId: string) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      await db.runAsync('DELETE FROM books WHERE id = ?', [bookId]);
      dispatch({ type: 'DELETE_BOOK', bookId });
    } catch (error) {
      console.error('本の削除エラー:', error);
    }
  };

  // 本のタイトルを変更する関数
  const renameBook = async (bookId: string, title: string) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      await db.runAsync('UPDATE books SET title = ?, updated_at = ? WHERE id = ?', [title, new Date().toISOString(), bookId]);
      dispatch({ type: 'RENAME_BOOK', bookId, title });
    } catch (error) {
      console.error('本のタイトル変更エラー:', error);
    }
  };

  // 本の色を変更する関数
  const recolorBook = async (bookId: string, color: Book['color']) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      await db.runAsync('UPDATE books SET color = ?, updated_at = ? WHERE id = ?', [color, new Date().toISOString(), bookId]);
      dispatch({ type: 'RECOLOR_BOOK', bookId, color });
    } catch (error) {
      console.error('本の色変更エラー:', error);
    }
  };

  const toggleBookPin = async (bookId: string, isPinned: boolean) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      await db.runAsync('UPDATE books SET is_pinned = ? WHERE id = ?', [isPinned ? 1 : 0, bookId]);
      dispatch({ type: 'TOGGLE_PIN_BOOK', bookId, isPinned });
    } catch (error) {
      console.error('本のピン留め変更エラー:', error);
    }
  };

  const touchBook = async (bookId: string) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      const updatedAt = new Date().toISOString();
      await db.runAsync('UPDATE books SET updated_at = ? WHERE id = ?', [updatedAt, bookId]);
      dispatch({ type: 'TOUCH_BOOK', bookId, updatedAt });
    } catch (error) {
      console.error('本の更新日時変更エラー:', error);
    }
  };

  return (
    <LibraryContext.Provider value={{ state, dispatch, addBook, reorderBooks, deleteBook, renameBook, recolorBook, toggleBookPin, touchBook }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
