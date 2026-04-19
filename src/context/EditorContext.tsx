import React, { createContext, useReducer, useContext, useEffect, useRef, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';
import { ENV } from '@config';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { createNoteDocumentFromSeed, serializeDocumentNodes } from '../utils/noteDocument';

const isDelete = ENV.INIT_DB; // trueのとき: コンテンツ系テーブルを全削除して再作成

type SeedPage = {
  chapter: string;
  section: string;
  subsection: string;
  text: string;
  word: string;
  explanation: string;
};

const SHOWCASE_BOOK_PAGES: Record<string, SeedPage[]> = {
  国語: [
    {
      chapter: '説明文の読み取り',
      section: '要旨の捉え方',
      subsection: '段落ごとの役割',
      text: '説明文では、各段落が何を説明しているかを短くまとめると、筆者の主張が見えやすくなる。接続語に注目すると話の流れを追いやすい。',
      word: '要旨',
      explanation: '文章全体でいちばん伝えたい中心内容。',
    },
    {
      chapter: '古文入門',
      section: '歴史的仮名遣い',
      subsection: '現代仮名遣いとの違い',
      text: '古文は現代語と発音や表記が異なるため、声に出して読む練習が大切である。意味の切れ目を意識すると内容理解が進む。',
      word: '歴史的仮名遣い',
      explanation: '昔の日本語の書き方で、現在の仮名遣いと異なる表記。',
    },
    {
      chapter: '作文の技法',
      section: '意見文の構成',
      subsection: '根拠の示し方',
      text: '意見文では、主張・理由・具体例・結論の順に書くと説得力が高まる。具体例は数字や体験を入れると読み手に伝わりやすい。',
      word: '根拠',
      explanation: '主張を支える理由や事実。',
    },
  ],
  算数: [
    {
      chapter: '方程式',
      section: '一次方程式',
      subsection: '移項の考え方',
      text: '等式は左右のつり合いが成り立っているので、同じ数を足したり引いたりしても関係は変わらない。移項はこの性質を使った計算である。',
      word: '移項',
      explanation: '等式の一方の辺の項を、符号を変えて他方に移す計算。',
    },
    {
      chapter: '比例と反比例',
      section: 'グラフの特徴',
      subsection: '変化の割合',
      text: '比例のグラフは原点を通る直線になり、反比例のグラフは双曲線になる。表と式とグラフを対応させて考えることが重要である。',
      word: '比例定数',
      explanation: '比例の式 y=ax における a の値。',
    },
    {
      chapter: '図形',
      section: '三角形の合同',
      subsection: '合同条件の活用',
      text: '合同な図形では対応する辺の長さと角の大きさが等しい。証明では、どの合同条件を使うかを先に決めると書きやすい。',
      word: '合同',
      explanation: '形も大きさも同じで、ぴったり重なる関係。',
    },
  ],
  数学: [
    {
      chapter: '方程式',
      section: '一次方程式',
      subsection: '移項の考え方',
      text: '等式は左右のつり合いが成り立っているので、同じ数を足したり引いたりしても関係は変わらない。移項はこの性質を使った計算である。',
      word: '移項',
      explanation: '等式の一方の辺の項を、符号を変えて他方に移す計算。',
    },
    {
      chapter: '比例と反比例',
      section: 'グラフの特徴',
      subsection: '変化の割合',
      text: '比例のグラフは原点を通る直線になり、反比例のグラフは双曲線になる。表と式とグラフを対応させて考えることが重要である。',
      word: '比例定数',
      explanation: '比例の式 y=ax における a の値。',
    },
    {
      chapter: '図形',
      section: '三角形の合同',
      subsection: '合同条件の活用',
      text: '合同な図形では対応する辺の長さと角の大きさが等しい。証明では、どの合同条件を使うかを先に決めると書きやすい。',
      word: '合同',
      explanation: '形も大きさも同じで、ぴったり重なる関係。',
    },
  ],
  理科: [
    {
      chapter: '化学変化',
      section: '物質の分解',
      subsection: '加熱による変化',
      text: '物質は化学変化によって別の物質に変わる。実験では、加熱前後の質量や発生した気体を調べることで反応の特徴を確かめられる。',
      word: '化学変化',
      explanation: '物質が別の物質に変わる変化。',
    },
    {
      chapter: '生物',
      section: '植物のつくり',
      subsection: '光合成',
      text: '植物は光エネルギーを使って二酸化炭素と水から養分をつくる。葉の気孔は気体の出入りに関わり、蒸散にも関係している。',
      word: '光合成',
      explanation: '植物が光を利用して養分をつくるはたらき。',
    },
    {
      chapter: '地学',
      section: '天気の変化',
      subsection: '前線と気団',
      text: '前線は性質の異なる気団の境目であり、雲や降水が起こりやすい。天気図を読むと、低気圧の移動と天気の変化を予測できる。',
      word: '前線',
      explanation: '性質の異なる気団の境目。',
    },
  ],
  社会: [
    {
      chapter: '地理',
      section: '日本の地形',
      subsection: '平野と盆地',
      text: '日本は山地が多く、平野は海沿いに広がることが多い。地形は産業や交通に影響し、都市の発展のしかたにも関係する。',
      word: '沖積平野',
      explanation: '川が運んだ土砂でできた平らな土地。',
    },
    {
      chapter: '歴史',
      section: '近代国家への歩み',
      subsection: '明治維新',
      text: '明治維新では政治や社会の仕組みが大きく変わった。近代化を進めるため、教育制度や産業の整備が進められた。',
      word: '廃藩置県',
      explanation: '藩を廃止して県を置き、中央集権を進めた政策。',
    },
    {
      chapter: '公民',
      section: '日本国憲法',
      subsection: '三つの基本原理',
      text: '日本国憲法は国民主権・基本的人権の尊重・平和主義を基本原理とする。生活の中で権利と責任のバランスを考えることが大切である。',
      word: '国民主権',
      explanation: '国の政治の最終的な決定権が国民にあるという考え。',
    },
  ],
  英語: [
    {
      chapter: '基本文法',
      section: 'be動詞と一般動詞',
      subsection: '肯定文・否定文・疑問文',
      text: '英語の文は動詞が中心になる。be動詞と一般動詞では疑問文や否定文の作り方が異なるため、主語と動詞の組み合わせを意識する。',
      word: 'subject',
      explanation: '文の主語。だれが・なにがを表す。',
    },
    {
      chapter: '時制',
      section: '現在形と過去形',
      subsection: '動詞の変化',
      text: '現在形は習慣や事実を表し、過去形は過去の出来事を表す。規則動詞は語尾に-edをつけ、不規則動詞は形を覚える必要がある。',
      word: 'tense',
      explanation: '時制。動作や状態の時間的な位置を示す文法事項。',
    },
    {
      chapter: '表現',
      section: '依頼と提案',
      subsection: '丁寧な言い方',
      text: '依頼には Could you ... ?、提案には Why don\'t we ... ? などを使う。場面に応じて丁寧さを調整すると自然な会話になる。',
      word: 'polite',
      explanation: '丁寧な、礼儀正しい。',
    },
  ],
};

const PRODUCTION_BOOK_PAGES: Record<string, SeedPage[]> = {
  使い方: [
    {
      chapter: 'このアプリでできること',
      section: 'ノートを本ごとに整理する',
      subsection: '学習内容をわかりやすく残す',
      text: 'このアプリでは、教科やテーマごとに本を作り、その中にページを追加しながら学習内容を整理できます。見出し・本文・単語を組み合わせて、授業ノート、暗記用まとめ、復習用ノートを1つの場所に残せます。まずは本を選んでページを開き、どのように書けるかを試してみてください。',
      word: '本',
      explanation: 'ノートを教科やテーマ単位でまとめるための入れ物。',
    },
    {
      chapter: '基本操作',
      section: 'ページを開いて編集する',
      subsection: '見出し・本文・単語を使い分ける',
      text: 'ページを開いたら編集ボタンから内容を書き換えられます。章・節・項を使うと情報のまとまりが見やすくなり、本文には授業内容や要点を書き込めます。単語を追加すると、語句と意味をセットで残せるので、あとから暗記しやすくなります。編集が終わったら保存して内容を確定してください。',
      word: '保存',
      explanation: '編集した内容を確定し、次回も同じ状態で開けるようにすること。',
    },
    {
      chapter: '便利な機能',
      section: '目次・検索・単語帳',
      subsection: '必要な情報にすばやく戻る',
      text: '見出しを付けておくと、目次から読みたい場所へすぐ移動できます。右上メニューの検索を使えば、本文や見出しに含まれる語句を探せます。単語として登録した内容は単語帳にまとまるため、授業ノートを書いたあとにそのまま復習へつなげられます。',
      word: '検索',
      explanation: 'ノート内の言葉を探して、目的のページや内容へすばやく移動する機能。',
    },
    {
      chapter: 'おすすめの使い方',
      section: '授業・復習・暗記をつなげる',
      subsection: '続けやすい書き方のコツ',
      text: '授業中は本文を中心に素早く記録し、あとから見出しを整理すると読み返しやすくなります。覚えたい語句だけを単語として登録しておくと、単語帳で短時間の復習ができます。1冊に情報を詰め込みすぎず、単元ごとに本を分けると、必要なノートをすぐ開けて学習が続けやすくなります。',
      word: '復習',
      explanation: '学んだ内容をあとで見返し、理解や記憶を定着させること。',
    },
  ],
  サンプルノート: [
    {
      chapter: 'サンプル',
      section: '理科のまとめ',
      subsection: '光合成の要点',
      text: '植物は光エネルギーを使って、二酸化炭素と水から養分をつくる。このはたらきを光合成という。葉の気孔は気体の出入りに関わる。',
      word: '光合成',
      explanation: '植物が光を利用して養分をつくるはたらき。',
    },
  ],
};

const INITIAL_BOOK_PAGES: Record<string, SeedPage[]> = ENV.IS_PRODUCTION
  ? PRODUCTION_BOOK_PAGES
  : SHOWCASE_BOOK_PAGES;
const CONTENT_MODE_META_KEY = 'content_seed_mode';

const makeSeedId = (prefix: string, bookId: string, page: number) => `${prefix}_${bookId}_${page}`;

const getOrCreateDefaultSeedThumbnailPath = async (): Promise<string> => {
  try {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return '';
    const thumbDir = `${baseDir}thumbnails/`;
    const destPath = `${thumbDir}default_note.png`;

    await FileSystem.makeDirectoryAsync(thumbDir, { intermediates: true });
    const info = await FileSystem.getInfoAsync(destPath);
    if (!info.exists) {
      const asset = Asset.fromModule(require('../../assets/images/note.png'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
      }
    }
    return destPath;
  } catch (e) {
    console.warn('default thumbnail creation failed', e);
    return '';
  }
};

const ensurePageImagesForAllPages = async (database: SQLite.SQLiteDatabase, defaultThumbPath: string) => {
  const pages = await database.getAllAsync('SELECT DISTINCT book_id, page FROM contents ORDER BY book_id ASC, page ASC;');
  for (const row of pages as any[]) {
    const bookId = String(row.book_id);
    const page = Number(row.page);
    const existing = await database.getAllAsync(
      'SELECT page_image_id, image_path FROM page_images WHERE book_id = ? AND page_order = ? LIMIT 1;',
      [bookId, page]
    );
    const existingRow = (existing[0] as any) ?? null;

    if (!existingRow) {
      await database.runAsync(
        'INSERT INTO page_images (page_image_id, image_path, page_order, book_id) VALUES (?, ?, ?, ?)',
        [makeSeedId('pageimg', bookId, page), defaultThumbPath, page, bookId]
      );
      continue;
    }

    const imagePath = String(existingRow.image_path ?? '');
    if (!imagePath && defaultThumbPath) {
      await database.runAsync(
        'UPDATE page_images SET image_path = ? WHERE page_image_id = ?',
        [defaultThumbPath, String(existingRow.page_image_id)]
      );
    }
  }
};

const seedInitialPages = async (database: SQLite.SQLiteDatabase) => {
  const countRows = await database.getAllAsync('SELECT COUNT(*) AS count FROM contents;');
  const contentCount = Number((countRows[0] as any)?.count ?? 0);
  if (contentCount > 0) return;

  const books = await database.getAllAsync('SELECT id, title FROM books;');
  if (!books || books.length === 0) return;

  const defaultThumbPath = await getOrCreateDefaultSeedThumbnailPath();

  for (const row of books as any[]) {
    const bookId = String(row.id);
    const title = String(row.title);
    const pages = INITIAL_BOOK_PAGES[title];
    if (!pages || pages.length === 0) continue;

    for (let page = 0; page < pages.length; page++) {
      const seed = pages[page];
      const contentId = makeSeedId('content', bookId, page);

      await database.runAsync(
        'INSERT OR IGNORE INTO contents (content_id, type, book_id, page, height, content_data) VALUES (?, ?, ?, ?, ?, ?)',
        [contentId, 'document', bookId, page, 0, serializeDocumentNodes(createNoteDocumentFromSeed(seed))]
      );
      await database.runAsync(
        'INSERT OR IGNORE INTO words (word_id, word, explanation, word_order, content_id, review_flag) VALUES (?, ?, ?, ?, ?, ?)',
        [`0004_${makeSeedId('word', bookId, page)}`, seed.word, seed.explanation, 4, contentId, 0]
      );
      await database.runAsync(
        'INSERT OR IGNORE INTO page_images (page_image_id, image_path, page_order, book_id) VALUES (?, ?, ?, ?)',
        [makeSeedId('pageimg', bookId, page), defaultThumbPath, page, bookId]
      );
    }
  }
};

// ===== 型定義 =====
export type Content = {
  content_id: string;
  type: 'document' | 'image' | 'text' | 'word';
  book_id: string;
  page: number;
  height: number;
  content_data: string;
};

export type Image = {
  image_id: string;
  image: string;
  content_id: string;
  image_order?: number;
};

export type Word = {
  word_id: string;
  word: string;
  explanation: string;
  word_order: number;
  content_id: string;
  review_flag?: number;
};

export type PageImage = {
  page_image_id: string;
  image_path: string;
  page_order: number;
  book_id: string;
};

// ===== 状態定義 =====
type State = {
  contents: Content[];
  images: Image[];
  words: Word[];
  pageImages: PageImage[];
  isLoading: boolean;
};

type Action =
  | { type: 'SET_ALL'; payload: Partial<State> }
  | { type: 'SET_LOADING'; isLoading: boolean };

// ===== 初期状態 =====
const initialState: State = {
  contents: [],
  images: [],
  words: [],
  pageImages: [],
  isLoading: true,
};

// ===== Context =====
const EditorContext = createContext<{
  state: State;
  refreshAll: () => Promise<void>;
  select: <T = any>(table: string, where?: string, params?: any[]) => Promise<T[]>;
  // Contentsテーブル
  addContent: (data: Content) => Promise<void>;
  updateContent: (id: string, data: Partial<Content>) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  getContentsByBookId: (bookId: string) => Promise<Content[]>;
  // Imagesテーブル
  addImage: (data: Image) => Promise<void>;
  updateImage: (id: string, data: Partial<Image>) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  getImagesByContentId: (contentId: string) => Promise<Image[]>;
  // Wordテーブル
  addWord: (data: Word) => Promise<void>;
  updateWord: (id: string, data: Partial<Word>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  getWordsByContentId: (contentId: string) => Promise<Word[]>;
  // PageImage
  addPageImage: (data: PageImage) => Promise<void>;
  updatePageImage: (id: string, data: Partial<PageImage>) => Promise<void>;
  deletePageImage: (id: string) => Promise<void>;
  getPageImagesByBookId: (bookId: string) => Promise<PageImage[]>;
  // 本㑓40てのコンテンツを削除（本削除時に使用）
  deleteAllContentsByBookId: (bookId: string) => Promise<void>;
}>({
  state: initialState,
  refreshAll: async () => {},
  select: async () => [],
  addContent: async () => {},
  updateContent: async () => {},
  deleteContent: async () => {},
  addImage: async () => {},
  updateImage: async () => {},
  deleteImage: async () => {},
  addWord: async () => {},
  updateWord: async () => {},
  deleteWord: async () => {},
  getContentsByBookId: async () => [],
  getWordsByContentId: async () => [],
  getImagesByContentId: async () => [],
  addPageImage: async () => {},
  updatePageImage: async () => {},
  deletePageImage: async () => {},
  getPageImagesByBookId: async () => [],
  deleteAllContentsByBookId: async () => {},
});

// ===== Reducer =====
function editorReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ALL':
      return { ...state, ...action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

// ===== Provider =====
export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
  if (hasInitializedRef.current) return;
  hasInitializedRef.current = true;

  const setupDatabase = async () => {
    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });

      const database = await initDB();
      setDb(database);

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);

      const modeRows = await database.getAllAsync(
        'SELECT value FROM app_meta WHERE key = ?;',
        [CONTENT_MODE_META_KEY]
      );
      const storedMode = String((modeRows[0] as any)?.value ?? '');

      // ===== isDelete=true のとき: コンテンツ系テーブルを全削除して再作成 =====
      // （books テーブルは LibraryContext が管理するため触らない）
      if (isDelete || storedMode !== ENV.APP_MODE) {
        const contentTables = ['page_images', 'images', 'words', 'contents'];
        for (const table of contentTables) {
          try {
            await database.runAsync(`DROP TABLE IF EXISTS ${table};`);
          } catch (err) {
            console.warn(`Failed to drop ${table}:`, err);
          }
        }
      }

      // ===== テーブル作成（個別のrunAsyncで確実に作成）=====
      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS contents (
          content_id TEXT PRIMARY KEY NOT NULL,
          type TEXT,
          book_id TEXT,
          page INTEGER,
          height REAL,
          content_data TEXT NOT NULL DEFAULT '[]'
        );
      `);

      try {
        const contentCols = await database.getAllAsync(`PRAGMA table_info(contents);`);
        const hasContentData = contentCols.some((c: any) => c.name === 'content_data');
        if (!hasContentData) {
          await database.runAsync(`ALTER TABLE contents ADD COLUMN content_data TEXT NOT NULL DEFAULT '[]';`);
        }
      } catch (merr) {
        console.warn('contents migration warning:', merr);
      }

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS images (
          image_id TEXT PRIMARY KEY NOT NULL,
          image TEXT,
          content_id TEXT,
          image_order INTEGER DEFAULT 0
        );
      `);

      try {
        const imageCols = await database.getAllAsync(`PRAGMA table_info(images);`);
        const hasImageOrder = imageCols.some((c: any) => c.name === 'image_order');
        if (!hasImageOrder) {
          await database.runAsync(`ALTER TABLE images ADD COLUMN image_order INTEGER DEFAULT 0;`);
        }
      } catch (merr) {
        console.warn('images migration warning:', merr);
      }

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS words (
          word_id TEXT PRIMARY KEY NOT NULL,
          word TEXT,
          explanation TEXT,
          word_order INTEGER,
          content_id TEXT,
          review_flag INTEGER DEFAULT 0
        );
      `);

      // === Migration: add review_flag column for older installs
      try {
        const wordCols = await database.getAllAsync(`PRAGMA table_info(words);`);
        const hasReviewFlag = wordCols.some((c: any) => c.name === 'review_flag');
        if (!hasReviewFlag) {
          await database.runAsync(`ALTER TABLE words ADD COLUMN review_flag INTEGER DEFAULT 0;`);
          await database.runAsync(`UPDATE words SET review_flag = 0 WHERE review_flag IS NULL;`);
          console.log('Migration: added words.review_flag column');
        }
      } catch (merr) {
        console.warn('words migration warning:', merr);
      }

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS page_images (
          page_image_id TEXT PRIMARY KEY NOT NULL,
          image_path TEXT,
          page_order INTEGER,
          book_id TEXT
        );
      `);

      // === Migration: older installs may have 'image' column instead of 'image_path'
      try {
        const cols = await database.getAllAsync(`PRAGMA table_info(page_images);`);
        const hasImagePath = cols.some((c: any) => c.name === 'image_path');
        const hasImage = cols.some((c: any) => c.name === 'image');
        if (!hasImagePath) {
          // Add the new column
          await database.runAsync(`ALTER TABLE page_images ADD COLUMN image_path TEXT;`);
          console.log('Migration: added page_images.image_path column');
          // If old 'image' column exists, copy values over
          if (hasImage) {
            await database.runAsync(`UPDATE page_images SET image_path = image WHERE image IS NOT NULL;`);
            console.log('Migration: copied image -> image_path for existing rows');
          }
        }
      } catch (merr) {
        console.warn('page_images migration warning:', merr);
      }

      // コンテンツが空の場合のみ、起動モードに応じた初期ページを投入する
      await seedInitialPages(database);
      const defaultThumbPath = await getOrCreateDefaultSeedThumbnailPath();
      await ensurePageImagesForAllPages(database, defaultThumbPath);

      await database.runAsync(
        'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
        [CONTENT_MODE_META_KEY, ENV.APP_MODE]
      );

      // ===== データ読み込み =====
      await refreshAll(database);
    } catch (e) {
      console.error('DB初期化エラー(EditorContext):', e);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  setupDatabase();
}, []);


  // ===== 全テーブル読み込み =====
  const refreshAll = async (database?: SQLite.SQLiteDatabase) => {
    const dbRef = database || db;
    if (!dbRef) return;

    const [contents, images, words, pageImages] = await Promise.all([
        dbRef.getAllAsync('SELECT * FROM contents;'),
        dbRef.getAllAsync('SELECT * FROM images;'),
        dbRef.getAllAsync('SELECT * FROM words;'),
        dbRef.getAllAsync('SELECT * FROM page_images;'),
      ]);

      dispatch({
        type: 'SET_ALL',
        payload: {
          contents: contents as Content[],
          images: images as Image[],
          words: words as Word[],
          pageImages: pageImages as PageImage[],
        },
      });
  };

  // ===== 共通CRUDヘルパー =====
  const insert = async (table: string, data: any) => {
    if (!db) {
      console.warn('DB is null - cannot insert');
      return;
    }
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(data);
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders});`;
    try {
      await db.runAsync(sql, values as SQLite.SQLiteBindParams);
      await refreshAll();
    } catch (err) {
      console.error('INSERT error:', err, { table, data, sql, values });
      throw err;
    }
  };

  const update = async (table: string, idField: string, id: string, data: any) => {
    if (!db) return;
    const keys = Object.keys(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];

    await db.runAsync(
      `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?;`,
      values as SQLite.SQLiteBindParams
    );
    await refreshAll();
  };

  const remove = async (table: string, idField: string, id: string) => {
    if (!db) return;
    await db.runAsync(`DELETE FROM ${table} WHERE ${idField} = ?;`, [id]);
    await refreshAll();
  };

  const select = async <T = any>(table: string, where?: string, params: any[] = []): Promise<T[]> => {
    if (!db) return [];
    const query = where ? `SELECT * FROM ${table} WHERE ${where};` : `SELECT * FROM ${table};`;
    try {
      const results = await db.getAllAsync(query, params);
      return results as T[];
    } catch (err) {
      console.error(`SELECT ${table} エラー:`, err);
      return [];
    }
  };


  // ===== CRUD =====
  const addContent = (data: Content) => insert('contents', data);
  const updateContent = (id: string, data: Partial<Content>) => update('contents', 'content_id', id, data);
  // 子テーブルもカスケード削除
  const deleteContent = async (id: string) => {
    if (!db) return;
    await db.runAsync('DELETE FROM words WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM images WHERE content_id = ?', [id]);
    await remove('contents', 'content_id', id);
  };
  const getContents = () => select<Content>('contents');

  const addImage = (data: Image) => insert('images', data);
  const updateImage = (id: string, data: Partial<Image>) => update('images', 'image_id', id, data);
  const deleteImage = (id: string) => remove('images', 'image_id', id);
  const getImages = () => select<Image>('images');

  const addWord = (data: Word) => insert('words', data);
  const updateWord = (id: string, data: Partial<Word>) => update('words', 'word_id', id, data);
  const deleteWord = (id: string) => remove('words', 'word_id', id);
  const getWords = () => select<Word>('words');

  // Page images
  const addPageImage = (data: PageImage) => insert('page_images', data);
  const updatePageImage = (id: string, data: Partial<PageImage>) => update('page_images', 'page_image_id', id, data);
  const deletePageImage = (id: string) => remove('page_images', 'page_image_id', id);
  const getPageImages = () => select<PageImage>('page_images');

  // ===== ページ復元用の読み込み関数 =====

  // bookId + page で contents を取得
  const getContentsByBookId = async (bookId: string) => {
    if (!db) {
      console.warn("DB がまだ初期化されていません");
      return [];
    }
    return await select<Content>('contents', 'book_id = ?', [bookId]);
  };

  // content_id に紐づく words
  const getWordsByContentId = async (contentId: string) => {
    return await select<Word>('words', 'content_id = ?', [contentId]);
  };

  // content_id に紐づく images
  const getImagesByContentId = async (contentId: string) => {
    return await select<Image>('images', 'content_id = ?', [contentId]);
  };

  // book_id に紐づく page_images
  const getPageImagesByBookId = async (bookId: string) => {
    return await select<PageImage>('page_images', 'book_id = ?', [bookId]);
  };

  // book_id に紐づく全コンテンツをカスケード削除（本削除時に使用）
  const deleteAllContentsByBookId = async (bookId: string) => {
    if (!db) return;
    const contents = await select<Content>('contents', 'book_id = ?', [bookId]);
    for (const c of contents) {
      await db.runAsync('DELETE FROM words WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM images WHERE content_id = ?', [c.content_id]);
    }
    await db.runAsync('DELETE FROM contents WHERE book_id = ?', [bookId]);
    await db.runAsync('DELETE FROM page_images WHERE book_id = ?', [bookId]);
    await refreshAll();
  };


  return (
    <EditorContext.Provider
      value={{
        state,
        refreshAll,
        select,
        addContent,
        updateContent,
        deleteContent,
        addImage,
        updateImage,
        deleteImage,
        addWord,
        updateWord,
        deleteWord,
        getContentsByBookId,
        getWordsByContentId,
          getImagesByContentId,
          addPageImage,
          updatePageImage,
          deletePageImage,
          getPageImagesByBookId,
          deleteAllContentsByBookId,
        }}
    >
      {children}
    </EditorContext.Provider>
  );
};

// ===== Hook =====
export const useEditor = () => useContext(EditorContext);
