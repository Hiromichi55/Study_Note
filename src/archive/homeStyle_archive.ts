import { Dimensions, StyleSheet, Image } from 'react-native';
import bookIMGs from '../constants/bookImage';
import * as commonStyle from './commonStyle';

// 元画像の縦横
const ORIGIN_IMG_WIDTH = Image.resolveAssetSource(bookIMGs.blue).width;
const ORIGIN_IMG_HEIGHT = Image.resolveAssetSource(bookIMGs.blue).height;
// 適応する本の画像
export const BOOK_IMG_HEIGHT = commonStyle.screenHeight / 3.7;
export const BOOK_IMG_WIDTH = BOOK_IMG_HEIGHT * ( ORIGIN_IMG_WIDTH / ORIGIN_IMG_HEIGHT );
// 本の追加をするときの画像
const NEW_BOOK_IMG_WIDTH = BOOK_IMG_WIDTH / 1.7;
const NEW_BOOK_IMG_HEIGHT = BOOK_IMG_HEIGHT / 1.7;
const FONT_SIZE = BOOK_IMG_HEIGHT * 0.1;
const LINE_HEIGHT = FONT_SIZE * 1;

export const homeStyles = StyleSheet.create({
  /* ホームスクリーン全体 */
  homeScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  /* 本のスクロール範囲 */
  horizontalScrollContainer: {
    paddingHorizontal: 50,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* タイトル */
  titleContainer: { 
    position: 'absolute',
    top: commonStyle.screenHeight*0.2,
    width: '100%',
    alignContent: 'center',
    height: 'auto', 
  },
  titleText: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    fontSize: commonStyle.screenHeight/12,
    fontFamily: 'dartsfont',
    textAlign: 'center'
  },

  /* 本 */
  bookBtn: { 
    width: BOOK_IMG_WIDTH,
    height: BOOK_IMG_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -(BOOK_IMG_WIDTH * 0.03),
  },
  bookBtnImg: {
    width: '100%',
    height: '100%',
  },
  bookTitle: {
    position: 'absolute',
    top: '30%',
    left: '16%',
    width: FONT_SIZE,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: 'black',
    fontFamily: 'dartsfont',
  },

  /* メニュー */
  menuBtnContainer: {
    padding: 10,
    position: 'absolute',
    top: commonStyle.screenHeight / 2 + BOOK_IMG_HEIGHT * 0.5,
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 20,
  },
  menuBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  menuBtnText: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    color: 'black',
    fontSize: commonStyle.screenHeight/20,
    fontFamily: 'dartsfont',
  },

  /* 新規ノート追加ボタン */
  newBooksContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    padding : 8,               
    borderRadius: 8,                                
    flexDirection: 'row',         
    overflow: 'hidden',
  },
  newBookBtn: {
    width: NEW_BOOK_IMG_WIDTH,
    height: NEW_BOOK_IMG_HEIGHT,
    marginHorizontal: 6,
  },
  newBookBtnImg: {
    width: '100%',
    height: '100%',
  },
});
