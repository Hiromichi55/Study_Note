// src/db/db.ts
// データベースの初期化と接続管理

import initSqlJs, { Database } from 'sql.js';
import { createTablesSQL } from './schema'; // スキーマ定義（テーブル作成用SQLなど）

let db: Database | null = null;

// データベースの初期化関数
export async function initDB(): Promise<Database> {
  if (db) return db; // すでに初期化されていればそれを返す

  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}` // sql.js のファイルの場所を指定
  });

  db = new SQL.Database();
  db.exec(createTablesSQL); // テーブルを作成

  return db;
}