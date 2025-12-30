import { Dimensions, StyleSheet, Image } from 'react-native';
import bookImages from '../constants/bookImage';
import * as commonStyle from './commonStyle';
export const homeStyles = StyleSheet.create({
  // HomeScreen
  titleHome: { 
    position: 'absolute',
    top: commonStyle.screenHeight*0.2,
    width: '100%',
    alignContent: 'center',
    height: 'auto',       // 高さを文字サイズに合わせる
  },
  titleText: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    fontSize: commonStyle.screenHeight/12,
    fontFamily: 'dartsfont',
    textAlign: 'center'
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    flex: 1,
  },
  horizontalScrollContainer: {
    paddingHorizontal: 50,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookItem: {
    width: commonStyle.IMAGE_WIDTH,
    height: commonStyle.IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -(commonStyle.IMAGE_WIDTH * 0.03),
  },
  bookImage: {
    width: '100%',
    height: '100%',
  },
  bookTitleOverlay: {
    position: 'absolute',
    top: '30%',
    left: '16%',
    width: commonStyle.FONT_SIZE,
    fontSize: commonStyle.FONT_SIZE,
    lineHeight: commonStyle.LINE_HEIGHT,
    color: 'black',
    fontFamily: 'dartsfont',
  },
  addBookSection: {
    padding: 10,
    position: 'absolute',
    top: commonStyle.screenHeight / 2 + commonStyle.IMAGE_HEIGHT * 0.5,
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 20,
  },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  addButtonText: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    color: 'black',
    // fontSize: 40,
    fontSize: commonStyle.screenHeight/20,
    fontFamily: 'dartsfont',
  },
  colorButton: {
    width: commonStyle.COLOR_ICON_WIDTH,
    height: commonStyle.COLOR_ICON_HEIGHT,
    marginHorizontal: 6,
  },
  colorImage: {
    width: '100%',
    height: '100%',
  },
  bookListWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
