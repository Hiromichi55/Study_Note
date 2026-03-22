import { Dimensions, StyleSheet, Image } from 'react-native';
import * as commonStyle from './commonStyle';
import { center } from '@shopify/react-native-skia';

// 適応する本の画像
export const BOOK_BTN_HEIGHT = commonStyle.screenHeight / 3.7;
export const BOOK_BTN_WIDTH = commonStyle.screenWidth / 3.7;
export const font = commonStyle.screenHeight / 36;

export const homeStyles = StyleSheet.create({
  /* ホームスクリーンの背景 */
  background: {
    width: commonStyle.screenWidth,
    height: commonStyle.screenHeight,
    flex: 1,
    backgroundColor: 'rgba(101, 42, 2, 1)',
    alignItems: 'center',
  },
  /* ページ上部メニュー */
  topMenuContainer: { 
    position: 'absolute',
    marginTop: 0,
    width: '100%',
    alignContent: 'center',
    height: commonStyle.screenHeight/ 8.7,
    backgroundColor: 'rgba(235, 235, 235, 1)', 
  },
  titleText: {
    paddingTop: commonStyle.screenHeight/14,
    paddingHorizontal: 20,
    borderRadius: 5,
    fontSize: commonStyle.screenHeight/36,
    textAlign: 'center'
  },

  /* 本のスクロール範囲 */
  verticalScrollContainer: {
    width: commonStyle.screenWidth / 1.05,
    height: commonStyle.screenHeight / 1.1,
    marginTop: commonStyle.screenHeight / 7.7,
    marginBottom: commonStyle.screenHeight / 9.4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 16,
    color: 'black',
    backgroundColor: 'rgba(255, 255, 255, 0.88)', 
    //borderWidth: 0.5,        
    //borderColor: 'black', 
  },

  /* 本アイコン */
  bookBtn: { 
    width: commonStyle.screenWidth / 1.05,
    height: commonStyle.screenHeight / 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forwardNotebookIcon: { 
    position: 'absolute',
    right: commonStyle.screenWidth / 60,
  },
  bookBtnBottomLine: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '88%',          
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'black',
  },
  bookBtnIcon: {
    width: '100%',
    height: '100%',
    paddingTop: commonStyle.screenHeight / 65,
    paddingLeft: commonStyle.screenWidth / 35,
  },
  bookTitle: {
    position: 'absolute',
    left: commonStyle.screenWidth / 10,
    paddingHorizontal: 20,
    fontSize: commonStyle.screenHeight/36,
    textAlign: 'center'
  },

  /* ページ下部メニュー */
  bottomMenuContainer: {
    flexDirection: 'row', 
    position: 'absolute',
    height: commonStyle.screenHeight / 11,
    justifyContent: 'space-between',
    bottom: 0,
    left: 0,
    right: 0,            
    backgroundColor: 'rgba(235, 235, 235, 1)', 
  },
  addBookBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  addBookBtnIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    color: 'green',
  },
  manualBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  manualBtnIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    color: 'black',
  },

  /* 新規ノート追加ボタン */
  newBookOptionsOverlay: {
    position: 'absolute',
    width: commonStyle.screenWidth / 1.05,
    bottom: commonStyle.screenHeight / 10,
    backgroundColor: 'white',
    borderWidth: 1,               
    borderRadius: 8,                                
    flexDirection: 'row',        
    overflow: 'hidden',
  },
  newBookBtn: {
    marginHorizontal: 6,
  },
  newBookBtnIcon: {
    width: '100%',
    height: '100%',
  },
});
