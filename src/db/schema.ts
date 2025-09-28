// src/db/schema.ts
// データベースのスキーマ定義（テーブル作成用SQLなど）
export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memo_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER INTEGER NOT NULL,
  type TEXT NOT NULL, -- title, text, image, etc.
  content TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id),
  UNIQUE(memo_id, "order")
);
`;