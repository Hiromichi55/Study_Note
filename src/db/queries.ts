// src/db/queries.ts
// データベース操作のクエリ関数群
import { db } from './db';
import { MemoBlock } from '../types/memo';

export type Contents = {
  id: string;
  bookId: string;
  attribute: 'title' | 'text' | 'image' | 'list';
  content: string;
}

// メモブロックを取得
export function getMemoBlocks(memoId: number): Promise<MemoBlock[]> {
  return new Promise((resolve, reject) => {
    const blocks: MemoBlock[] = [];
    (db as any).transaction((tx: any) => {
      tx.executeSql(
        `SELECT * FROM memoBlocks WHERE memoId = ? ORDER BY "order" ASC`,
        [memoId],
        (_: any, resultSet: any) => {
          for (let i = 0; i < resultSet.rows.length; i++) {
            const row = resultSet.rows.item(i);
            blocks.push({
              id: Number(row.id),
              memoId: Number(row.memoId),
              type: row.type as MemoBlock["type"],
              content: String(row.content),
              order: Number(row.order),
            });
          }
          resolve(blocks);
        },
        (_: any, error: any) => {
          reject(error);
          return true;
        }
      );
    });
  });
}

// メモ追加
export function addMemo(): Promise<number> {
  return new Promise((resolve, reject) => {
    (db as any).transaction((tx: any) => {
      tx.executeSql(
        `INSERT INTO memos (createdAt) VALUES (?)`,
        [new Date().toISOString()],
        (_: any, resultSet: any) => resolve(resultSet.insertId),
        (_: any, error: any) => { reject(error); return true; }
      );
    });
  });
}

// メモブロック追加
export function addMemoBlock(memoId: number, type: MemoBlock["type"], content: string, order: number): Promise<void> {
  return new Promise((resolve, reject) => {
    (db as any).transaction((tx: any) => {
      tx.executeSql(
        `INSERT INTO memoBlocks (memoId, type, content, "order") VALUES (?, ?, ?, ?)`,
        [memoId, type, content, order],
        () => resolve(),
        (_: any, error: any) => { reject(error); return true; }
      );
    });
  });
}

// メモブロック更新
export function updateMemoBlockContent(id: number, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    (db as any).transaction((tx: any) => {
      tx.executeSql(
        `UPDATE memoBlocks SET content = ? WHERE id = ?`,
        [content, id],
        () => resolve(),
        (_: any, error: any) => { reject(error); return true; }
      );
    });
  });
}
