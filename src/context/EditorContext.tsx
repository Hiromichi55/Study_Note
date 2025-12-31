import React, { createContext, useReducer, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';

// ===== 型定義 =====
export type Content = {
  content_id: string;
  content_order: number;
  type: 'image' | 'outline' | 'text' | 'word';
  book_id: string;
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
  outline: string;
  type: 'chapter' | 'section' | 'subsection' | 'title';
  content_id: string;
};

export type Text = {
  text_id: string;
  text: string;
  content_id: string;
};

export type Word = {
  word_id: string;
  word: string;
  explanation: string;
  word_order: number;
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
  select: <T = any>(table: string, where?: string, params?: any[]) => Promise<T[]>;

  addContent: (data: Content) => Promise<void>;
  updateContent: (id: string, data: Partial<Content>) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;

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

  getContentsByBookId: (bookId: string) => Promise<Content[]>;
  getTextsByContentId: (contentId: string) => Promise<Text[]>;
  getOutlinesByContentId: (contentId: string) => Promise<Outline[]>;
  getWordsByContentId: (contentId: string) => Promise<Word[]>;
  getImagesByContentId: (contentId: string) => Promise<Image[]>;
  
}>({
  state: initialState,
  refreshAll: async () => {},
  select: async () => [],
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
  getContentsByBookId: async () => [],
  getTextsByContentId: async () => [],
  getOutlinesByContentId: async () => [],
  getWordsByContentId: async () => [],
  getImagesByContentId: async () => [],
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

      // ===== テーブル作成 =====
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS contents (
          content_id TEXT PRIMARY KEY NOT NULL,
          content_order INTEGER,
          type TEXT,
          book_id TEXT,
          page INTEGER,
          height REAL
        );
      `);

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS images (
          image_id TEXT PRIMARY KEY NOT NULL,
          image TEXT,
          content_id TEXT
        );
      `);

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS outlines (
          outline_id TEXT PRIMARY KEY NOT NULL,
          outline TEXT,
          type TEXT,
          content_id TEXT
        );
      `);

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS texts (
          text_id TEXT PRIMARY KEY NOT NULL,
          text TEXT,
          content_id TEXT
        );
      `);

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS words (
          word_id TEXT PRIMARY KEY NOT NULL,
          word TEXT,
          explanation TEXT,
          word_order INTEGER,
          content_id TEXT
        );
      `);

      // ===== データ読み込み =====
      await refreshAll(database);
    } catch (e) {
      console.error('DB初期化エラー(EditorContext):', e);
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
      payload: {
        contents: contents as Content[],
        images: images as Image[],
        outlines: outlines as Outline[],
        texts: texts as Text[],
        words: words as Word[],
      },
    });
  };

  // ===== 共通CRUDヘルパー =====
  const insert = async (table: string, data: any) => {
    if (!db) {
      console.warn('DB is null - cannot insert');
      return;
    }
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(data);
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders});`;
    try {
      await db.runAsync(sql, values as SQLite.SQLiteBindParams);
      await refreshAll();
    } catch (err) {
      console.error('INSERT error:', err, { table, data, sql, values });
      throw err;
    }
  };

  const update = async (table: string, idField: string, id: string, data: any) => {
    if (!db) return;
    const keys = Object.keys(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];

    await db.runAsync(
      `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?;`,
      values as SQLite.SQLiteBindParams
    );
    await refreshAll();
  };

  const remove = async (table: string, idField: string, id: string) => {
    if (!db) return;
    await db.runAsync(`DELETE FROM ${table} WHERE ${idField} = ?;`, [id]);
    await refreshAll();
  };

  const select = async <T = any>(table: string, where?: string, params: any[] = []): Promise<T[]> => {
    if (!db) return [];
    const query = where ? `SELECT * FROM ${table} WHERE ${where};` : `SELECT * FROM ${table};`;
    try {
      const results = await db.getAllAsync(query, params);
      return results as T[];
    } catch (err) {
      console.error(`SELECT ${table} エラー:`, err);
      return [];
    }
  };


  // ===== CRUD =====
  const addContent = (data: Content) => insert('contents', data);
  const updateContent = (id: string, data: Partial<Content>) => update('contents', 'content_id', id, data);
  const deleteContent = (id: string) => remove('contents', 'content_id', id);
  const getContents = () => select<Content>('contents');

  const addImage = (data: Image) => insert('images', data);
  const updateImage = (id: string, data: Partial<Image>) => update('images', 'image_id', id, data);
  const deleteImage = (id: string) => remove('images', 'image_id', id);
  const getImages = () => select<Image>('images');

  const addOutline = (data: Outline) => insert('outlines', data);
  const updateOutline = (id: string, data: Partial<Outline>) => update('outlines', 'outline_id', id, data);
  const deleteOutline = (id: string) => remove('outlines', 'outline_id', id);
  const getOutlines = () => select<Outline>('outlines');

  const addText = (data: Text) => insert('texts', data);
  const updateText = (id: string, data: Partial<Text>) => update('texts', 'text_id', id, data);
  const deleteText = (id: string) => remove('texts', 'text_id', id);
  const getTexts = () => select<Text>('texts');

  const addWord = (data: Word) => insert('words', data);
  const updateWord = (id: string, data: Partial<Word>) => update('words', 'word_id', id, data);
  const deleteWord = (id: string) => remove('words', 'word_id', id);
  const getWords = () => select<Word>('words');

  // ===== ページ復元用の読み込み関数 =====

  // bookId + page で contents を取得
  const getContentsByBookId = async (bookId: string) => {
    if (!db) {
      console.warn("DB がまだ初期化されていません");
      return [];
    }
    return await select<Content>('contents', 'book_id = ?', [bookId]);
  };


  // content_id に紐づく texts
  const getTextsByContentId = async (contentId: string) => {
    return await select<Text>('texts', 'content_id = ?', [contentId]);
  };

  // content_id に紐づく outlines
  const getOutlinesByContentId = async (contentId: string) => {
    return await select<Outline>('outlines', 'content_id = ?', [contentId]);
  };

  // content_id に紐づく words
  const getWordsByContentId = async (contentId: string) => {
    return await select<Word>('words', 'content_id = ?', [contentId]);
  };

  // content_id に紐づく images
  const getImagesByContentId = async (contentId: string) => {
    return await select<Image>('images', 'content_id = ?', [contentId]);
  };


  return (
    <EditorContext.Provider
      value={{
        state,
        refreshAll,
        select,
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
        getContentsByBookId,
        getTextsByContentId,
        getOutlinesByContentId,
        getWordsByContentId,
        getImagesByContentId
        }}
    >
      {children}
    </EditorContext.Provider>
  );
};

// ===== Hook =====
export const useEditor = () => useContext(EditorContext);
