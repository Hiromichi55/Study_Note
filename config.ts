// config.ts
// アプリ全体で使う設定・開発用フラグをまとめる

export const ENV = {
  INIT_DB: false,      // trueにすると毎回DBを初期化
  IS_DEV: true,         // true: テストモード、false: 本番
};
