import { Dimensions, StyleSheet, Image } from 'react-native';
import * as commonStyle from './commonStyle';
import Slider from '@react-native-community/slider';

// NotebookScreen用スタイル
export const notebookStyles = StyleSheet.create({
  
  /* 目次ボタン */
  outlineBtn: {
    fontSize: 20,
    color: 'black',
  },

  /* ミートボールメニュー */
  menuBtn: {
    paddingRight: 0,
    alignItems: 'center'
  },
  menuBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionsContainer: {
    backgroundColor: 'white',
    marginTop: 40,
  },

  /* ノート全体（スライダー出し入れ） */
  notebookScreenWrapper: {
    flex: 1,
  },

  /* ノートコンテンツ部分 */
  notebookContentsContainer: {
    flex: 1,
  },

  inputSmallStyle: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'white',
  },

  container:{
    flex:1,
    backgroundColor:'white',
  },

  /* スライダー, ページ一覧部分 */
  sliderContainer: {
    position: 'absolute',
    height: commonStyle.screenHeight/15,
    width: commonStyle.screenWidth*0.8,
    flexDirection: 'row', // ← 横並び
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slider: {
    width: '100%',
    height: 50,
    alignSelf: 'flex-end',
    marginRight: 20,
    marginLeft: 20,
  },
  allPagesBtn: {
    width: commonStyle.screenWidth/10,
    height: commonStyle.screenWidth/10,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginLeft: 10,
  },

  /* 検索ボックス */
  searchBoxContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white', // ← 半透明赤
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  searchBoxInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },

  /* 編集ボタン（右下） */
  editButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'black', // 好きな色に
    borderRadius: commonStyle.screenHeight,
    width: commonStyle.screenWidth/6,
    height: commonStyle.screenWidth/6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  /* 虫眼鏡ボタン（左下） */
  searchBtn: {
    position: 'absolute',
    bottom: commonStyle.screenHeight*0.02,
    left: 20,
    backgroundColor: "black",
    borderRadius: commonStyle.screenHeight,
    width: commonStyle.screenWidth/6,
    height: commonStyle.screenWidth/6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
