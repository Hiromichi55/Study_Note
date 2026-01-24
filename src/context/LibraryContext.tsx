// src/context/LibraryContext.tsx
import React, { createContext, useReducer, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';
import { ENV } from '@config';

const isDelete = ENV.INIT_DB; // trueにすると毎回初期化される

export type Book = {
  id: string;
  title: string;
  color: 'blue' | 'cyan' | 'green' | 'pink' | 'red' | 'yellow'| 'black'; // 本の色
  order_index: number; // 並び順を管理するためのフィールド
};


type State = {
  books: Book[];
  isLoading: boolean;
};

type Action =
  | { type: 'SET_BOOKS'; books: Book[] }
  | { type: 'ADD_BOOK'; book: Book }
  | { type: 'SET_LOADING'; isLoading: boolean };
  // | { type: 'UPDATE_BOOK_CONTENT'; bookId: string; content: string[] };

const initialBooks: Book[] = [
  { id: '1', title: '国語', color: 'red', order_index: 0 },
  { id: '2', title: '英語', color: 'yellow', order_index: 1 },
  { id: '3', title: '理科', color: 'green', order_index: 2 },
  { id: '4', title: '数学', color: 'blue', order_index: 3 },
  // { id: '5', title: '社会', color: 'cyan', order_index: 4 },
];

const initialState: State = { 
  books: initialBooks,
  isLoading: true 
};

const LibraryContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  addBook: (book: Book) => Promise<void>;
  reorderBooks: (newBooks: Book[]) => Promise<void>; 
}>({
  state: initialState,
  dispatch: () => null,
  addBook: async () => {},
  reorderBooks: async () => {},
});

function libraryReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BOOKS':
      return { ...state, books: action.books };
    case 'ADD_BOOK':
      return { ...state, books: [...state.books, action.book] };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    // case 'UPDATE_BOOK_CONTENT':
    //   return {
    //     ...state,
    //     books: state.books.map((b) =>
    //       b.id === action.bookId ? { ...b, content: action.content } : b
    //     ),
    //   };
    default:
      return state;
  }
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(libraryReducer, initialState);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  // データベース初期化とデータ読み込み
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        dispatch({ type: 'SET_LOADING', isLoading: true });

        // データベース初期化
        const database = await initDB();
        setDb(database);
        
        // ✅ テーブルが存在するか確認（非同期版）
        const tableCheckResult = await database.getAllAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='books';"
        );
        const tableExists = tableCheckResult.length > 0;

        if (isDelete) {
          // ✅ 一時的に DB を初期化して、正しいデータを挿入
          await database.execAsync(`DROP TABLE IF EXISTS books;`);
        }

        if (!tableExists || isDelete) {
          // テーブル作成
          await database.execAsync(`
            CREATE TABLE books (
              id TEXT PRIMARY KEY NOT NULL, 
              title TEXT NOT NULL, 
              color TEXT NOT NULL,
              order_index INTEGER DEFAULT 0
            );
          `);

          // 初期データ挿入
          for (const book of initialBooks) {
            await database.runAsync(
              'INSERT INTO books (id, title, color, order_index) VALUES (?, ?, ?, ?)',
              [book.id, book.title, book.color, book.order_index]
            );
          }
        }

        // データ読み込み
        const result = await database.getAllAsync('SELECT * FROM books;');
        console.log('📘 現在のbooksテーブル:', result);

        let books: Book[] = result.map((row: any) => ({
          id: String(row.id),
          title: String(row.title),
          color: (row.color || 'blue') as Book['color'],  // ✅ 明示的に型を指定
          order_index: Number(row.order_index || 0), // order_index フィールドを追加
        }));

        // ✅ データベースが空なら初期データを挿入
        if (books.length === 0) {
          for (const book of initialBooks) {
            await database.runAsync(
              'INSERT INTO books (id, title, color, order_index) VALUES (?, ?, ?, ?)',
              [book.id, book.title, book.color, book.order_index]
            );
          }
          books = initialBooks; // 上書き
        }

        dispatch({ type: 'SET_BOOKS', books });
        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        console.error('DB初期化エラー:', error);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    };

    setupDatabase();
  }, []);

  // 本を追加する関数
  const addBook = async (book: Book) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO books (id, title, color, order_index) VALUES (?, ?, ?, ?)',
        [book.id, book.title || '', book.color, book.order_index]
      );
      dispatch({ type: 'ADD_BOOK', book });
    } catch (error) {
      console.error('本の追加エラー:', error);
    }
  };

  const reorderBooks = async (newBooks: Book[]) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    try {
      await db.execAsync('BEGIN TRANSACTION;');

      // order_indexを0から連番で振り直して順番更新
      for (let i = 0; i < newBooks.length; i++) {
        const book = newBooks[i];
        await db.runAsync(
          'UPDATE books SET order_index = ? WHERE id = ?',
          [i, book.id]
        );
      }

      await db.execAsync('COMMIT;');

      // 更新後のDB内容を取得してログ出力
      const result = await db.getAllAsync('SELECT * FROM books ORDER BY order_index ASC;');
      console.log('🔄 並び替え後のbooksテーブル:', JSON.stringify(result, null, 2)); // テーブルチェック

      // state側も更新。order_indexを修正した状態でセット
      const updatedBooks = newBooks.map((book, index) => ({
        ...book,
        order_index: index,
      }));

      dispatch({ type: 'SET_BOOKS', books: updatedBooks });
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      console.error('並び替えの保存エラー:', error);
    }
  };

  return (
    <LibraryContext.Provider value={{ state, dispatch, addBook, reorderBooks }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
