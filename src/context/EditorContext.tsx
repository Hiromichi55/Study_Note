import React, { createContext, useReducer, useContext, useEffect, useRef, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { initDB } from '../db/db';
import { ENV } from '@config';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const isDelete = ENV.INIT_DB; // trueのとき: コンテンツ系テーブルを全削除して再作成
const isPurgeOnly = ENV.PURGE_DB_ONLY; // trueのとき: 削除のみ実行し初期データは投入しない

type SeedElement =
  | { type: 'chapter' | 'section' | 'subsection' | 'text'; text: string }
  | { type: 'word'; word: string; explanation: string };

type SeedPage = SeedElement[];

const SHOWCASE_BOOK_PAGES: Record<string, SeedPage[]> = {
  国語: [
    [
      { type: 'chapter', text: '説明文の読み取り' },
      { type: 'section', text: '要旨の捉え方' },
      { type: 'subsection', text: '段落ごとの役割' },
      { type: 'text', text: '説明文では、各段落が何を説明しているかを短くまとめると、筆者の主張が見えやすくなる。接続語に注目すると話の流れを追いやすい。' },
      { type: 'word', word: '要旨', explanation: '文章全体でいちばん伝えたい中心内容。' },
    ],
    [
      { type: 'chapter', text: '古文入門' },
      { type: 'section', text: '歴史的仮名遣い' },
      { type: 'subsection', text: '現代仮名遣いとの違い' },
      { type: 'text', text: '古文は現代語と発音や表記が異なるため、声に出して読む練習が大切である。意味の切れ目を意識すると内容理解が進む。' },
      { type: 'word', word: '歴史的仮名遣い', explanation: '昔の日本語の書き方で、現在の仮名遣いと異なる表記。' },
    ],
    [
      { type: 'chapter', text: '作文の技法' },
      { type: 'section', text: '意見文の構成' },
      { type: 'subsection', text: '根拠の示し方' },
      { type: 'text', text: '意見文では、主張・理由・具体例・結論の順に書くと説得力が高まる。具体例は数字や体験を入れると読み手に伝わりやすい。' },
      { type: 'word', word: '根拠', explanation: '主張を支える理由や事実。' },
    ],
  ],
  算数: [
    [
      { type: 'chapter', text: '方程式' },
      { type: 'section', text: '一次方程式' },
      { type: 'subsection', text: '移項の考え方' },
      { type: 'text', text: '等式は左右のつり合いが成り立っているので、同じ数を足したり引いたりしても関係は変わらない。移項はこの性質を使った計算である。' },
      { type: 'word', word: '移項', explanation: '等式の一方の辺の項を、符号を変えて他方に移す計算。' },
    ],
    [
      { type: 'chapter', text: '比例と反比例' },
      { type: 'section', text: 'グラフの特徴' },
      { type: 'subsection', text: '変化の割合' },
      { type: 'text', text: '比例のグラフは原点を通る直線になり、反比例のグラフは双曲線になる。表と式とグラフを対応させて考えることが重要である。' },
      { type: 'word', word: '比例定数', explanation: '比例の式 y=ax における a の値。' },
    ],
    [
      { type: 'chapter', text: '図形' },
      { type: 'section', text: '三角形の合同' },
      { type: 'subsection', text: '合同条件の活用' },
      { type: 'text', text: '合同な図形では対応する辺の長さと角の大きさが等しい。証明では、どの合同条件を使うかを先に決めると書きやすい。' },
      { type: 'word', word: '合同', explanation: '形も大きさも同じで、ぴったり重なる関係。' },
    ],
  ],
  数学: [
    [
      { type: 'chapter', text: '方程式' },
      { type: 'section', text: '一次方程式' },
      { type: 'subsection', text: '移項の考え方' },
      { type: 'text', text: '等式は左右のつり合いが成り立っているので、同じ数を足したり引いたりしても関係は変わらない。移項はこの性質を使った計算である。' },
      { type: 'word', word: '移項', explanation: '等式の一方の辺の項を、符号を変えて他方に移す計算。' },
    ],
    [
      { type: 'chapter', text: '比例と反比例' },
      { type: 'section', text: 'グラフの特徴' },
      { type: 'subsection', text: '変化の割合' },
      { type: 'text', text: '比例のグラフは原点を通る直線になり、反比例のグラフは双曲線になる。表と式とグラフを対応させて考えることが重要である。' },
      { type: 'word', word: '比例定数', explanation: '比例の式 y=ax における a の値。' },
    ],
    [
      { type: 'chapter', text: '図形' },
      { type: 'section', text: '三角形の合同' },
      { type: 'subsection', text: '合同条件の活用' },
      { type: 'text', text: '合同な図形では対応する辺の長さと角の大きさが等しい。証明では、どの合同条件を使うかを先に決めると書きやすい。' },
      { type: 'word', word: '合同', explanation: '形も大きさも同じで、ぴったり重なる関係。' },
    ],
  ],
  理科: [
    [
      { type: 'chapter', text: '化学変化' },
      { type: 'section', text: '物質の分解' },
      { type: 'subsection', text: '加熱による変化' },
      { type: 'text', text: '物質は化学変化によって別の物質に変わる。実験では、加熱前後の質量や発生した気体を調べることで反応の特徴を確かめられる。' },
      { type: 'word', word: '化学変化', explanation: '物質が別の物質に変わる変化。' },
    ],
    [
      { type: 'chapter', text: '生物' },
      { type: 'section', text: '植物のつくり' },
      { type: 'subsection', text: '光合成' },
      { type: 'text', text: '植物は光エネルギーを使って二酸化炭素と水から養分をつくる。葉の気孔は気体の出入りに関わり、蒸散にも関係している。' },
      { type: 'word', word: '光合成', explanation: '植物が光を利用して養分をつくるはたらき。' },
    ],
    [
      { type: 'chapter', text: '地学' },
      { type: 'section', text: '天気の変化' },
      { type: 'subsection', text: '前線と気団' },
      { type: 'text', text: '前線は性質の異なる気団の境目であり、雲や降水が起こりやすい。天気図を読むと、低気圧の移動と天気の変化を予測できる。' },
      { type: 'word', word: '前線', explanation: '性質の異なる気団の境目。' },
    ],
  ],
  社会: [
    [
      { type: 'chapter', text: '地理' },
      { type: 'section', text: '日本の地形' },
      { type: 'subsection', text: '平野と盆地' },
      { type: 'text', text: '日本は山地が多く、平野は海沿いに広がることが多い。地形は産業や交通に影響し、都市の発展のしかたにも関係する。' },
      { type: 'word', word: '沖積平野', explanation: '川が運んだ土砂でできた平らな土地。' },
    ],
    [
      { type: 'chapter', text: '歴史' },
      { type: 'section', text: '近代国家への歩み' },
      { type: 'subsection', text: '明治維新' },
      { type: 'text', text: '明治維新では政治や社会の仕組みが大きく変わった。近代化を進めるため、教育制度や産業の整備が進められた。' },
      { type: 'word', word: '廃藩置県', explanation: '藩を廃止して県を置き、中央集権を進めた政策。' },
    ],
    [
      { type: 'chapter', text: '公民' },
      { type: 'section', text: '日本国憲法' },
      { type: 'subsection', text: '三つの基本原理' },
      { type: 'text', text: '日本国憲法は国民主権・基本的人権の尊重・平和主義を基本原理とする。生活の中で権利と責任のバランスを考えることが大切である。' },
      { type: 'word', word: '国民主権', explanation: '国の政治の最終的な決定権が国民にあるという考え。' },
    ],
  ],
  英語: [
    [
      { type: 'chapter', text: '基本文法' },
      { type: 'section', text: 'be動詞と一般動詞' },
      { type: 'subsection', text: '肯定文・否定文・疑問文' },
      { type: 'text', text: '英語の文は動詞が中心になる。be動詞と一般動詞では疑問文や否定文の作り方が異なるため、主語と動詞の組み合わせを意識する。' },
      { type: 'word', word: 'subject', explanation: '文の主語。だれが・なにがを表す。' },
    ],
    [
      { type: 'chapter', text: '時制' },
      { type: 'section', text: '現在形と過去形' },
      { type: 'subsection', text: '動詞の変化' },
      { type: 'text', text: '現在形は習慣や事実を表し、過去形は過去の出来事を表す。規則動詞は語尾に-edをつけ、不規則動詞は形を覚える必要がある。' },
      { type: 'word', word: 'tense', explanation: '時制。動作や状態の時間的な位置を示す文法事項。' },
    ],
    [
      { type: 'chapter', text: '表現' },
      { type: 'section', text: '依頼と提案' },
      { type: 'subsection', text: '丁寧な言い方' },
      { type: 'text', text: '依頼には Could you ... ?、提案には Why don\'t we ... ? などを使う。場面に応じて丁寧さを調整すると自然な会話になる。' },
      { type: 'word', word: 'polite', explanation: '丁寧な、礼儀正しい。' },
    ],
  ],
};

const PRODUCTION_BOOK_PAGES: Record<string, SeedPage[]> = {
  使い方: [
    [
      { type: 'chapter', text: '美ノートの使い方' },
      { type: 'section', text: '概要' },
      { type: 'text', text: '美ノートは、スマホのメモ帳のように気軽に書きながら、本物のノートのようにめくって見返せるアプリです。' },
      { type: 'section', text: '単語/意味の追加' },
      { type: 'text', text: '以下のように「単語/意味」を作成すると、「単語リスト」と「一問一答」にも反映されます。' },
      { type: 'word', word: '単語登録', explanation: '単語リストと一問一答に自動で追加される(このノートの単語は対象外)。' },
    ],
    [
      { type: 'chapter', text: '英単語' },
      { type: 'section', text: '日常で使う単語' },
      { type: 'text', text: '英語で予定を伝えるときは appointment や schedule がよく使われる。\n例）「I have an appointment at 3 pm.」' },
      { type: 'subsection', text: '単語リスト' },
      { type: 'word', word: 'appointment', explanation: '人と会う約束、予約のこと。' },
      { type: 'word', word: 'schedule', explanation: '予定、スケジュール。' },
      { type: 'word', word: 'postpone', explanation: '(予定を)延期する。' },
      { type: 'word', word: 'reminder', explanation: '思い出させるためのメモや通知。' },
      { type: 'word', word: 'deadline', explanation: '提出期限、締め切り。' },
    ],
    [
      { type: 'chapter', text: '数学' },
      { type: 'section', text: '図形の性質' },
      { type: 'subsection', text: '三平方の定理' },
      { type: 'text', text: '直角三角形では、直角をはさむ2辺の長さをそれぞれ2乗して足すと、斜辺の長さの2乗と等しくなる。この関係を三平方の定理(ピタゴラスの定理)という。' },
      { type: 'word', word: '三平方の定理', explanation: '直角三角形で、直角をはさむ2辺の長さをそれぞれ2乗して足すと斜辺の長さの2乗に等しくなるという定理(ピタゴラスの定理)。' },
    ],
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
      const elements = pages[page];
      const contentId = makeSeedId('content', bookId, page);

      await database.runAsync(
        'INSERT OR IGNORE INTO contents (content_id, type, book_id, page, height) VALUES (?, ?, ?, ?, ?)',
        [contentId, 'text', bookId, page, 0]
      );

      let wordOrder = 0;
      for (let index = 0; index < elements.length; index++) {
        const el = elements[index];
        const orderPrefix = String(index).padStart(4, '0');

        if (el.type === 'chapter' || el.type === 'section' || el.type === 'subsection') {
          await database.runAsync(
            'INSERT OR IGNORE INTO outlines (outline_id, outline, type, content_id) VALUES (?, ?, ?, ?)',
            [`${orderPrefix}_${makeSeedId(el.type, bookId, page)}_${index}`, el.text, el.type, contentId]
          );
        } else if (el.type === 'text') {
          await database.runAsync(
            'INSERT OR IGNORE INTO texts (text_id, text, content_id) VALUES (?, ?, ?)',
            [`${orderPrefix}_${makeSeedId('text', bookId, page)}_${index}`, el.text, contentId]
          );
        } else if (el.type === 'word') {
          await database.runAsync(
            'INSERT OR IGNORE INTO words (word_id, word, explanation, word_order, content_id, review_flag) VALUES (?, ?, ?, ?, ?, ?)',
            [`${orderPrefix}_${makeSeedId('word', bookId, page)}_${index}`, el.word, el.explanation, wordOrder, contentId, 0]
          );
          wordOrder += 1;
        }
      }

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
  type: 'image' | 'outline' | 'text' | 'word';
  book_id: string;
  page: number;
  height: number;
};

export type Image = {
  image_id: string;
  image: string;
  content_id: string;
};

export type Outline = {
  outline_id: string;
  outline: string;
  type: 'chapter' | 'section' | 'subsection' | 'title';
  content_id: string;
};

export type Text = {
  text_id: string;
  text: string;
  content_id: string;
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
  outlines: Outline[];
  texts: Text[];
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
  outlines: [],
  texts: [],
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
  // Outlinesテーブル
  addOutline: (data: Outline) => Promise<void>;
  updateOutline: (id: string, data: Partial<Outline>) => Promise<void>;
  deleteOutline: (id: string) => Promise<void>;
  getOutlinesByContentId: (contentId: string) => Promise<Outline[]>;
  // Textテーブル
  addText: (data: Text) => Promise<void>;
  updateText: (id: string, data: Partial<Text>) => Promise<void>;
  deleteText: (id: string) => Promise<void>;
  getTextsByContentId: (contentId: string) => Promise<Text[]>;
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
  // トランザクション：まとめての書き込みに使う（refreshAllは1回のみ）
  withTransaction: (fn: (db: SQLite.SQLiteDatabase) => Promise<void>) => Promise<void>;
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
  addOutline: async () => {},
  updateOutline: async () => {},
  deleteOutline: async () => {},
  addText: async () => {},
  updateText: async () => {},
  deleteText: async () => {},
  addWord: async () => {},
  updateWord: async () => {},
  deleteWord: async () => {},
  getContentsByBookId: async () => [],
  getTextsByContentId: async () => [],
  getOutlinesByContentId: async () => [],
  getWordsByContentId: async () => [],
  getImagesByContentId: async () => [],
  addPageImage: async () => {},
  updatePageImage: async () => {},
  deletePageImage: async () => {},
  getPageImagesByBookId: async () => [],
  deleteAllContentsByBookId: async () => {},
  withTransaction: async () => {},
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
        const contentTables = ['page_images', 'images', 'words', 'texts', 'outlines', 'contents'];
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
          height REAL
        );
      `);

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS images (
          image_id TEXT PRIMARY KEY NOT NULL,
          image TEXT,
          content_id TEXT
        );
      `);

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS outlines (
          outline_id TEXT PRIMARY KEY NOT NULL,
          outline TEXT,
          type TEXT,
          content_id TEXT
        );
      `);

      await database.runAsync(`
        CREATE TABLE IF NOT EXISTS texts (
          text_id TEXT PRIMARY KEY NOT NULL,
          text TEXT,
          content_id TEXT
        );
      `);

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

      if (!isPurgeOnly) {
        // コンテンツが空の場合のみ、起動モードに応じた初期ページを投入する
        await seedInitialPages(database);
        const defaultThumbPath = await getOrCreateDefaultSeedThumbnailPath();
        await ensurePageImagesForAllPages(database, defaultThumbPath);
      }

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

    const [contents, images, outlines, texts, words, pageImages] = await Promise.all([
        dbRef.getAllAsync('SELECT * FROM contents;'),
        dbRef.getAllAsync('SELECT * FROM images;'),
        dbRef.getAllAsync('SELECT * FROM outlines;'),
        dbRef.getAllAsync('SELECT * FROM texts;'),
        dbRef.getAllAsync('SELECT * FROM words;'),
        dbRef.getAllAsync('SELECT * FROM page_images;'),
      ]);

      dispatch({
        type: 'SET_ALL',
        payload: {
          contents: contents as Content[],
          images: images as Image[],
          outlines: outlines as Outline[],
          texts: texts as Text[],
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
    await db.runAsync('DELETE FROM outlines WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM texts WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM words WHERE content_id = ?', [id]);
    await db.runAsync('DELETE FROM images WHERE content_id = ?', [id]);
    await remove('contents', 'content_id', id);
  };
  const getContents = () => select<Content>('contents');

  const addImage = (data: Image) => insert('images', data);
  const updateImage = (id: string, data: Partial<Image>) => update('images', 'image_id', id, data);
  const deleteImage = (id: string) => remove('images', 'image_id', id);
  const getImages = () => select<Image>('images');

  const addOutline = (data: Outline) => insert('outlines', data);
  const updateOutline = (id: string, data: Partial<Outline>) => update('outlines', 'outline_id', id, data);
  const deleteOutline = (id: string) => remove('outlines', 'outline_id', id);
  const getOutlines = () => select<Outline>('outlines');

  const addText = (data: Text) => insert('texts', data);
  const updateText = (id: string, data: Partial<Text>) => update('texts', 'text_id', id, data);
  const deleteText = (id: string) => remove('texts', 'text_id', id);
  const getTexts = () => select<Text>('texts');

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


  // content_id に紐づく texts
  const getTextsByContentId = async (contentId: string) => {
    return await select<Text>('texts', 'content_id = ?', [contentId]);
  };

  // content_id に紐づく outlines
  const getOutlinesByContentId = async (contentId: string) => {
    return await select<Outline>('outlines', 'content_id = ?', [contentId]);
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
      await db.runAsync('DELETE FROM outlines WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM texts WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM words WHERE content_id = ?', [c.content_id]);
      await db.runAsync('DELETE FROM images WHERE content_id = ?', [c.content_id]);
    }
    await db.runAsync('DELETE FROM contents WHERE book_id = ?', [bookId]);
    await db.runAsync('DELETE FROM page_images WHERE book_id = ?', [bookId]);
    await refreshAll();
  };


  const withTransaction = async (fn: (database: SQLite.SQLiteDatabase) => Promise<void>) => {
    if (!db) return;
    await db.withTransactionAsync(async () => {
      await fn(db);
    });
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
        addOutline,
        updateOutline,
        deleteOutline,
        addText,
        updateText,
        deleteText,
        addWord,
        updateWord,
        deleteWord,
        getContentsByBookId,
        getTextsByContentId,
        getOutlinesByContentId,
        getWordsByContentId,
  getImagesByContentId,
  // page images
  addPageImage,
  updatePageImage,
  deletePageImage,
  getPageImagesByBookId,
  deleteAllContentsByBookId,
        withTransaction,
        }}
    >
      {children}
    </EditorContext.Provider>
  );
};

// ===== Hook =====
export const useEditor = () => useContext(EditorContext);
