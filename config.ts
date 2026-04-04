// config.ts
// アプリ全体で使う設定・起動モードをまとめる

export type AppMode = 'development' | 'showcase' | 'production';

// 切り替えはここだけ変更する
const APP_MODE: AppMode = 'showcase'; // 'development' | 'showcase' | 'production'
// 'development': 開発用モード。DBは毎回初期化され、レイアウトのガイドやテーブルログなども表示される。開発者向け。
// 'showcase': デモ用モード。DBは毎回初期化されるが、レイアウトのガイドやテーブルログは表示されない。デモやレビュー用。
// 'production': 本番用モード。DBは初回のみ初期化され、その後はデータが保持される。レイアウトのガイドやテーブルログも表示されない。ユーザー向け。

const createEnv = (mode: AppMode) => ({
  APP_MODE: mode,
  IS_DEVELOPMENT: mode === 'development',
  IS_SHOWCASE: mode === 'showcase',
  IS_PRODUCTION: mode === 'production',

  // development / showcase は毎回初期化、production は保持
  INIT_DB: mode !== 'production',

  // レイアウトの縁などを表示するのは development のみ
  SCREEN_DEV: mode === 'development',

  // 画像の再生成は development のみ強制
  IMAGE_REGENERATE: mode === 'development',

  // テーブルログは development のみ
  LOG_TABLES: mode === 'development',

  // 起動時のDBダンプも development のみ
  ENABLE_DB_LOGGER: mode === 'development',
});

export const ENV = createEnv(APP_MODE);
