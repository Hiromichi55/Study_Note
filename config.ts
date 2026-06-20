// config.ts
// アプリ全体で使う設定・起動モードをまとめる

export type AppMode = 'development' | 'showcase' | 'production' | 'db-purge-only';

// 切り替えはここだけ変更する
const APP_MODE: AppMode = 'production'; // 'development' | 'showcase' | 'production' | 'db-purge-only'
// 'development': 開発用モード。DBは毎回初期化され、レイアウトのガイドやテーブルログなども表示される。開発者向け。
// 'showcase': デモ用モード。DBは毎回初期化されるが、レイアウトのガイドやテーブルログは表示されない。デモやレビュー用。
// 'production': 本番用モード。DBは初回のみ初期化され、その後はデータが保持される。レイアウトのガイドやテーブルログも表示されない。ユーザー向け。
// 'db-purge-only': DB削除専用モード。起動時にテーブルを削除・再作成するが、初期データの投入は行わない。

const createEnv = (mode: AppMode) => ({
  APP_MODE: mode,
  IS_DEVELOPMENT: mode === 'development',
  IS_SHOWCASE: mode === 'showcase',
  IS_PRODUCTION: mode === 'production',
  PURGE_DB_ONLY: mode === 'db-purge-only',

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

// ==========================================
// AdMob（広告）設定
// ==========================================
// アプリID（AdMob 管理画面で発行されるアプリ単位のID。"~" を含む）
// iOS と Android で別IDになる。Android 用が発行できたら ANDROID_APP_ID を差し替える。
export const ADMOB = {
  // ▼ Android 用アプリID（未発行のため暫定で iOS 用を流用）。
  //   Google Play 用に AdMob でアプリを登録したら、正しい Android 用IDへ差し替える。
  ANDROID_APP_ID: 'ca-app-pub-3019459894605015~7482724561',
  // ▼ iOS 用アプリID（確定）。
  IOS_APP_ID: 'ca-app-pub-3019459894605015~7482724561',

  // 画面（配置）ごとのバナー広告ユニットID（"/" を含む）。
  // 空のままなら AdBanner 側で Google 公式のテストIDが使われる。
  BANNER_UNIT_IDS: {
    HOME: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/5870525929',
    },
    WORD_LIST: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/6768674626',
    },
    WORDBOOK: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/9203266272',
    },
  },

  // 画面（機能）ごとのリワード広告ユニットID（"/" を含む）。
  // 空のままなら showRewardedAd 側で Google 公式のテストIDが使われる。
  REWARDED_UNIT_IDS: {
    ADD_BOOK: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/3329112744',
    },
    ADD_PAGE: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/3868168790',
    },
    EXPORT_TEXT: {
      ANDROID: '',
      IOS: 'ca-app-pub-3019459894605015/3616887352',
    },
  },
} as const;

