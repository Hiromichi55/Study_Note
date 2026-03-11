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

export type PageImage = {
  page_image_id: string;
  image_path: string;
  page_order: number;
  book_id: string;
};

// ===== 状態定義 =====
type State = {
  contents: Content[];
  images: Image[];
  outlines: Outline[];
  texts: Text[];
  words: Word[];
  pageImages: PageImage[];
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
  pageImages: [],
  isLoading: true,
};

// ===== Context =====
const EditorContext = createContext<{
  state: State;
  refreshAll: () => Promise<void>;
  select: <T = any>(table: string, where?: string, params?: any[]) => Promise<T[]>;
  // Contentsテーブル
  addContent: (data: Content) => Promise<void>;
  updateContent: (id: string, data: Partial<Content>) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  getContentsByBookId: (bookId: string) => Promise<Content[]>;
  // Imagesテーブル
  addImage: (data: Image) => Promise<void>;
  updateImage: (id: string, data: Partial<Image>) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  getImagesByContentId: (contentId: string) => Promise<Image[]>;
  // Outlinesテーブル
  addOutline: (data: Outline) => Promise<void>;
  updateOutline: (id: string, data: Partial<Outline>) => Promise<void>;
  deleteOutline: (id: string) => Promise<void>;
  getOutlinesByContentId: (contentId: string) => Promise<Outline[]>;
  // Textテーブル
  addText: (data: Text) => Promise<void>;
  updateText: (id: string, data: Partial<Text>) => Promise<void>;
  deleteText: (id: string) => Promise<void>;
  getTextsByContentId: (contentId: string) => Promise<Text[]>;
  // Wordテーブル
  addWord: (data: Word) => Promise<void>;
  updateWord: (id: string, data: Partial<Word>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  getWordsByContentId: (contentId: string) => Promise<Word[]>;
  // PageImage
  addPageImage: (data: PageImage) => Promise<void>;
  updatePageImage: (id: string, data: Partial<PageImage>) => Promise<void>;
  deletePageImage: (id: string) => Promise<void>;
  getPageImagesByBookId: (bookId: string) => Promise<PageImage[]>;
  // 本㑓40てのコンテンツを削除（本削除時に使用）
  deleteAllContentsByBookId: (bookId: string) => Promise<void>;
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
  addPageImage: async () => {},
  updatePageImage: async () => {},
  deletePageImage: async () => {},
  getPageImagesByBookId: async () => [],
  deleteAllContentsByBookId: async () => {},
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

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS page_images (
          page_image_id TEXT PRIMARY KEY NOT NULL,
          image_path TEXT,
          page_order INTEGER,
          book_id TEXT
        );
      `);

      // === Migration: older installs may have 'image' column instead of 'image_path'
      try {
        const cols = await database.getAllAsync(`PRAGMA table_info(page_images);`);
        const hasImagePath = cols.some((c: any) => c.name === 'image_path');
        const hasImage = cols.some((c: any) => c.name === 'image');
        if (!hasImagePath) {
          // Add the new column
          await database.execAsync(`ALTER TABLE page_images ADD COLUMN image_path TEXT;`);
          console.log('Migration: added page_images.image_path column');
          // If old 'image' column exists, copy values over
          if (hasImage) {
            await database.execAsync(`UPDATE page_images SET image_path = image WHERE image IS NOT NULL;`);
            console.log('Migration: copied image -> image_path for existing rows');
          }
        }
      } catch (merr) {
        console.warn('page_images migration warning:', merr);
      }

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

    const [contents, images, outlines, texts, words, pageImages] = await Promise.all([
        dbRef.getAllAsync('SELECT * FROM contents;'),
        dbRef.getAllAsync('SELECT * FROM images;'),
        dbRef.getAllAsync('SELECT * FROM outlines;'),
        dbRef.getAllAsync('SELECT * FROM texts;'),
        dbRef.getAllAsync('SELECT * FROM words;'),
        dbRef.getAllAsync('SELECT * FROM page_images;'),
      ]);

      dispatch({
        type: 'SET_ALL',
        payload: {
          contents: contents as Content[],
          images: images as Image[],
          outlines: outlines as Outline[],
          texts: texts as Text[],
          words: words as Word[],
          pageImages: pageImages as PageImage[],
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
  // 子テーブルもカスケード削除
  const deleteContent = async (id: string) => {
    if (!db) return;
    await db.runAsync('DELETE FROM outlines WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM texts WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM words WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM images WHERE content_id = ?', [id]);
    await remove('contents', 'content_id', id);
  };
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

  // Page images
  const addPageImage = (data: PageImage) => insert('page_images', data);
  const updatePageImage = (id: string, data: Partial<PageImage>) => update('page_images', 'page_image_id', id, data);
  const deletePageImage = (id: string) => remove('page_images', 'page_image_id', id);
  const getPageImages = () => select<PageImage>('page_images');

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

  // book_id に紐づく page_images
  const getPageImagesByBookId = async (bookId: string) => {
    return await select<PageImage>('page_images', 'book_id = ?', [bookId]);
  };

  // book_id に紐づく全コンテンツをカスケード削除（本削除時に使用）
  const deleteAllContentsByBookId = async (bookId: string) => {
    if (!db) return;
    const contents = await select<Content>('contents', 'book_id = ?', [bookId]);
    for (const c of contents) {
      await db.runAsync('DELETE FROM outlines WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM texts WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM words WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM images WHERE content_id = ?', [c.content_id]);
    }
    await db.runAsync('DELETE FROM contents WHERE book_id = ?', [bookId]);
    await db.runAsync('DELETE FROM page_images WHERE book_id = ?', [bookId]);
    await refreshAll();
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
  getImagesByContentId,
  // page images
  addPageImage,
  updatePageImage,
  deletePageImage,
  getPageImagesByBookId,
  deleteAllContentsByBookId,
        }}
    >
      {children}
    </EditorContext.Provider>
  );
};

// ===== Hook =====
export const useEditor = () => useContext(EditorContext);
