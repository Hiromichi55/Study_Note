// src/db/db.ts
import * as SQLite from 'expo-sqlite';
import { Memo, MemoBlock } from '../types/memo';

export let db: SQLite.SQLiteDatabase | null = null;

export async function initDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('memos.db');
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt TEXT NOT NULL
    );
  `);
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS memoBlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memoId INTEGER NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY(memoId) REFERENCES memos(id)
    );
  `);
  
  return db;
}

// Dateオブジェクトを受け取って文字列に変換
export async function insertMemo(memo: { createdAt: Date }): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.runAsync(
    'INSERT INTO memos (createdAt) VALUES (?)',
    [memo.createdAt.toISOString()] // Date を文字列に変換
  );
  
  return result.lastInsertRowId;
}

export async function insertMemoBlock(block: Omit<MemoBlock, 'id'>): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.runAsync(
    'INSERT INTO memoBlocks (memoId, type, content, "order") VALUES (?, ?, ?, ?)',
    [block.memoId, block.type, block.content, block.order]
  );
  
  return result.lastInsertRowId;
}

// 取得時に文字列をDateオブジェクトに変換
export async function getMemos(): Promise<Memo[]> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.getAllAsync('SELECT * FROM memos ORDER BY createdAt DESC');
  
  // 文字列をDateオブジェクトに変換
  return (result as any[]).map(row => ({
    ...row,
    createdAt: new Date(row.createdAt)
  })) as Memo[];
}

export async function getMemoBlocks(memoId: number): Promise<MemoBlock[]> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.getAllAsync(
    'SELECT * FROM memoBlocks WHERE memoId = ? ORDER BY "order"',
    [memoId]
  );
  return result as MemoBlock[];
}