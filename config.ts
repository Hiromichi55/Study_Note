// config.ts
// アプリ全体で使う設定・開発用フラグをまとめる

export const ENV = {
  INIT_DB: true,      // trueにすると毎回DBを初期化
  IS_DEV: false,         // true: テストモード、false: 本番
  SCREEN_DEV: true,   // trueにすると画面レイアウトのデバッグ枠線を表示
  IMAGE_REGENERATE: true, // trueにすると背景画像を毎回再生成
  LOG_TABLES: true, // trueにするとDBテーブル内容をログ出力
};
