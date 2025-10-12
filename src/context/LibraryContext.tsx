import React, { createContext, useReducer, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';

export type Book = {
  id: string;
  title: string;
  content: string;
  color: 'blue' | 'cyan' | 'green' | 'pink' | 'red' | 'yellow'; // 本の色
};


type State = {
  books: Book[];
  isLoading: boolean;
};

type Action =
  | { type: 'SET_BOOKS'; books: Book[] }
  | { type: 'ADD_BOOK'; book: Book }
  | { type: 'UPDATE_CONTENT'; bookId: string; content: string }
  | { type: 'SET_LOADING'; isLoading: boolean };

const initialBooks: Book[] = [
  { id: '1', title: '国語', content: '', color: 'red' },
  { id: '2', title: '英語', content: '', color: 'yellow' },
  { id: '3', title: '理科', content: '', color: 'green' },
  { id: '4', title: '数学', content: '', color: 'blue' },
  // { id: '5', title: '社会', content: '', color: 'cyan' },
];

const initialState: State = { 
  books: initialBooks,
  isLoading: true 
};

const LibraryContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  addBook: (book: Book) => Promise<void>;
  updateContent: (bookId: string, content: string) => Promise<void>;
}>({
  state: initialState,
  dispatch: () => null,
  addBook: async () => {},
  updateContent: async () => {},
});

function libraryReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BOOKS':
      return { ...state, books: action.books };
    case 'ADD_BOOK':
      return { ...state, books: [...state.books, action.book] };
    case 'UPDATE_CONTENT':
      return {
        ...state,
        books: state.books.map(b =>
          b.id === action.bookId ? { ...b, content: action.content } : b
        ),
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
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

        // ✅ 一時的に DB を初期化して、正しいデータを挿入
        await database.execAsync(`DROP TABLE IF EXISTS books;`);

        // テーブル作成
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY NOT NULL, 
            title TEXT NOT NULL, 
            content TEXT,
            color TEXT NOT NULL
          );
        `);

        // 🔁 初期データ挿入
        for (const book of initialBooks) {
          await database.runAsync(
            'INSERT INTO books (id, title, content, color) VALUES (?, ?, ?, ?)',
            [book.id, book.title, book.content, book.color]
          );
        }

        // データ読み込み
        const result = await database.getAllAsync('SELECT * FROM books;');
        console.log('📘 現在のbooksテーブル:', result);

        let books: Book[] = result.map((row: any) => ({
          id: String(row.id),
          title: String(row.title),
          content: String(row.content || ''),
          color: (row.color || 'blue') as Book['color'],  // ✅ 明示的に型を指定
        }));

        // ✅ データベースが空なら初期データを挿入
        if (books.length === 0) {
          for (const book of initialBooks) {
            await database.runAsync(
              'INSERT INTO books (id, title, content, color) VALUES (?, ?, ?, ?)',
              [book.id, book.title, book.content, book.color]
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
        'INSERT OR REPLACE INTO books (id, title, content, color) VALUES (?, ?, ?, ?)',
        [book.id, book.title, book.content || '', book.color] // ← color を渡す
      );
      dispatch({ type: 'ADD_BOOK', book });
    } catch (error) {
      console.error('本の追加エラー:', error);
    }
  };

  // コンテンツを更新する関数
  const updateContent = async (bookId: string, content: string) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    try {
      await db.runAsync(
        'UPDATE books SET content = ? WHERE id = ?',
        [content, bookId]
      );
      dispatch({ type: 'UPDATE_CONTENT', bookId, content });
    } catch (error) {
      console.error('コンテンツ更新エラー:', error);
    }
  };

  return (
    <LibraryContext.Provider value={{ state, dispatch, addBook, updateContent }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
