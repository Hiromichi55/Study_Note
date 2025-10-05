// src/types/memo.ts
// メモに関する型定義

// 本(MAX20個)のidを格納したテーブルの型
export interface Memo {
  id: number;
  createdAt: Date;
}

// メモの各ブロック（タイトル、テキスト、画像、リストなど）を表す型
export interface MemoBlock {
  id: number; // テーブル内全てで被らない識別子
  memoId: number; // どのメモに属するか
  type: 'title' | 'text' | 'image' | 'list';
  content: string;
  order: number; // ブロックの順序
}