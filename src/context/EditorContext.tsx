import React, { createContext, useReducer, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';

// ===== 型定義 =====
export type Content = {
  content: string;
  order: number;
  type: string;
  book_Id: string;
  page: number;
  height: number;
};

export type Image = {
  image_id: string;
  image: string;
  content_id: string;
};

export type Outline = {
  outline_id: string;
  content: string;
  type: string;
  content_id: string;
};

export type Text = {
  text_id: string;
  content: string;
  content_id: string;
};

export type Word = {
  word_id: string;
  word: string;
  explanation: string;
  order_index: number;
  content_id: string;
};

// ===== 状態定義 =====
type State = {
  contents: Content[];
  images: Image[];
  outlines: Outline[];
  texts: Text[];
  words: Word[];
  isLoading: boolean;
};

type Action =
  | { type: 'SET_ALL'; payload: Partial<State> }
  | { type: 'SET_LOADING'; isLoading: boolean };

// ===== 初期状態 =====
const initialState: State = {
  contents: [],
  images: [],
  outlines: [],
  texts: [],
  words: [],
  isLoading: true,
};

// ===== Context =====
const EditorContext = createContext<{
  state: State;
  refreshAll: () => Promise<void>;

  addContent: (data: Content) => Promise<void>;
  updateContent: (content: string, data: Partial<Content>) => Promise<void>;
  deleteContent: (content: string) => Promise<void>;

  addImage: (data: Image) => Promise<void>;
  updateImage: (id: string, data: Partial<Image>) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;

  addOutline: (data: Outline) => Promise<void>;
  updateOutline: (id: string, data: Partial<Outline>) => Promise<void>;
  deleteOutline: (id: string) => Promise<void>;

  addText: (data: Text) => Promise<void>;
  updateText: (id: string, data: Partial<Text>) => Promise<void>;
  deleteText: (id: string) => Promise<void>;

  addWord: (data: Word) => Promise<void>;
  updateWord: (id: string, data: Partial<Word>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
}>({
  state: initialState,
  refreshAll: async () => {},
  addContent: async () => {},
  updateContent: async () => {},
  deleteContent: async () => {},
  addImage: async () => {},
  updateImage: async () => {},
  deleteImage: async () => {},
  addOutline: async () => {},
  updateOutline: async () => {},
  deleteOutline: async () => {},
  addText: async () => {},
  updateText: async () => {},
  deleteText: async () => {},
  addWord: async () => {},
  updateWord: async () => {},
  deleteWord: async () => {},
});

// ===== Reducer =====
function editorReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ALL':
      return { ...state, ...action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

// ===== Provider =====
export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        const database = await initDB();
        setDb(database);

        // テーブル作成
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS contents (
            content TEXT PRIMARY KEY NOT NULL,
            "order" INTEGER,
            type TEXT,
            book_Id TEXT,
            page INTEGER,
            height REAL
          );
          CREATE TABLE IF NOT EXISTS images (
            image_id TEXT PRIMARY KEY NOT NULL,
            image TEXT,
            content_id TEXT
          );
          CREATE TABLE IF NOT EXISTS outlines (
            outline_id TEXT PRIMARY KEY NOT NULL,
            content TEXT,
            type TEXT,
            content_id TEXT
          );
          CREATE TABLE IF NOT EXISTS texts (
            text_id TEXT PRIMARY KEY NOT NULL,
            content TEXT,
            content_id TEXT
          );
          CREATE TABLE IF NOT EXISTS words (
            word_id TEXT PRIMARY KEY NOT NULL,
            word TEXT,
            explanation TEXT,
            order_index INTEGER,
            content_id TEXT
          );
        `);

        await refreshAll(database);
      } catch (e) {
        console.error('DB初期化エラー:', e);
      } finally {
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    };
    setupDatabase();
  }, []);

  // ===== 全テーブル読み込み =====
  const refreshAll = async (database?: SQLite.SQLiteDatabase) => {
    const dbRef = database || db;
    if (!dbRef) return;

    const [contents, images, outlines, texts, words] = await Promise.all([
      dbRef.getAllAsync('SELECT * FROM contents;'),
      dbRef.getAllAsync('SELECT * FROM images;'),
      dbRef.getAllAsync('SELECT * FROM outlines;'),
      dbRef.getAllAsync('SELECT * FROM texts;'),
      dbRef.getAllAsync('SELECT * FROM words;'),
    ]);

    dispatch({
      type: 'SET_ALL',
      payload: { contents, images, outlines, texts, words },
    });
  };

  // ===== 共通ヘルパー =====
  const insert = async (table: string, data: any) => {
    if (!db) return;
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(data);
    await db.runAsync(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders});`, values);
    await refreshAll();
  };

  const update = async (table: string, idField: string, id: string, data: any) => {
    if (!db) return;
    const keys = Object.keys(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE ${idField} = ?;`, values);
    await refreshAll();
  };

  const remove = async (table: string, idField: string, id: string) => {
    if (!db) return;
    await db.runAsync(`DELETE FROM ${table} WHERE ${idField} = ?;`, [id]);
    await refreshAll();
  };

  // ===== 各テーブル専用CRUD =====
  const addContent = (data: Content) => insert('contents', data);
  const updateContent = (id: string, data: Partial<Content>) =>
    update('contents', 'content', id, data);
  const deleteContent = (id: string) => remove('contents', 'content', id);

  const addImage = (data: Image) => insert('images', data);
  const updateImage = (id: string, data: Partial<Image>) =>
    update('images', 'image_id', id, data);
  const deleteImage = (id: string) => remove('images', 'image_id', id);

  const addOutline = (data: Outline) => insert('outlines', data);
  const updateOutline = (id: string, data: Partial<Outline>) =>
    update('outlines', 'outline_id', id, data);
  const deleteOutline = (id: string) => remove('outlines', 'outline_id', id);

  const addText = (data: Text) => insert('texts', data);
  const updateText = (id: string, data: Partial<Text>) =>
    update('texts', 'text_id', id, data);
  const deleteText = (id: string) => remove('texts', 'text_id', id);

  const addWord = (data: Word) => insert('words', data);
  const updateWord = (id: string, data: Partial<Word>) =>
    update('words', 'word_id', id, data);
  const deleteWord = (id: string) => remove('words', 'word_id', id);

  return (
    <EditorContext.Provider
      value={{
        state,
        refreshAll,
        addContent,
        updateContent,
        deleteContent,
        addImage,
        updateImage,
        deleteImage,
        addOutline,
        updateOutline,
        deleteOutline,
        addText,
        updateText,
        deleteText,
        addWord,
        updateWord,
        deleteWord,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

// ===== Hook =====
export const useEditor = () => useContext(EditorContext);
