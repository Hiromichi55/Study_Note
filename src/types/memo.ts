// src/types/memo.ts
// メモに関する型定義

export interface Memo {
  id: number;
  createdAt: Date;
}

export interface MemoBlock {
  id: number;
  memoId: number;
  type: 'title' | 'text' | 'image' | 'list';
  content: string;
  order: number;
}