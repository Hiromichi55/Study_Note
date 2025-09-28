// src/db/queries.ts
// データベース操作用の関数群

import { Database } from 'sql.js';
import { MemoBlock } from '../types/memo';

export function getBlocksForMemo(db: Database, memoId: number): MemoBlock[] {
  const stmt = db.prepare(`
    SELECT *
    FROM memo_blocks
    WHERE memo_id = ?
    ORDER BY "order" ASC
  `, [memoId]);

  const blocks: MemoBlock[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject(); // ParamsObject

    // 自分で型を作り直す
    const block: MemoBlock = {
      id: Number(row.id),
      memoId: Number(row.memo_id), // snake_case→camelCase
      type: row.type as MemoBlock["type"],
      content: String(row.content),
      order: Number(row.order),
    };

    blocks.push(block);
  }

  stmt.free();
  return blocks;
}
