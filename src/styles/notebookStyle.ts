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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  menuBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionsContainer: {
    backgroundColor: 'white',
    marginTop: 40,
  },
  deleteOption: {
    color: 'red',
  },

  /* ノート全体（スライダー出し入れ） */
  notebookScreenWrapper: {
    flex: 1,
    backgroundColor: 'black',
  },

  /* ノートコンテンツ部分 */
  notebookContentsContainer: {
    flex: 1,
    alignItems: 'center',
    // justifyContent: 'center',
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
  pageListBtnAndSliderContainer: {
    // 自身の座標
    position: 'absolute', // 親要素の基準を基準に
    top: '75%',
    // 自身の形
    height: commonStyle.screenHeight/15,
    width: commonStyle.screenWidth*0.8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    // 子の座標
    flexDirection: 'row', // ← 横並び
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageListBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 15,
    width: commonStyle.screenWidth/7,
    height: commonStyle.screenWidth/7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  slider: {
    width: '70%',
    // alignSelf: 'flex-end',
    marginRight: 20,
  },

  /* 検索ボックス */
  searchBoxContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 1)',
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
