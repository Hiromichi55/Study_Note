import { Dimensions, StyleSheet, Image } from 'react-native';
import bookImages from '../constants/bookImage';

export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

// 画面の縦横
const { width: imgWidth, height: imgHeight } = Image.resolveAssetSource(bookImages.blue);
const imageAspectRatio = imgHeight / imgWidth;
// 本
const IMAGE_HEIGHT = screenHeight / 3.7;
const IMAGE_WIDTH = IMAGE_HEIGHT * ( imgWidth / imgHeight );
// 選択本
const COLOR_ICON_WIDTH = IMAGE_WIDTH / 1.7;
const COLOR_ICON_HEIGHT = IMAGE_HEIGHT / 1.7;
const FONT_SIZE = IMAGE_HEIGHT * 0.1;
const LINE_HEIGHT = FONT_SIZE * 1;

export const theme = {
  screenWidth,
  screenHeight,
  imageAspectRatio,
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  FONT_SIZE,
  LINE_HEIGHT,
  COLOR_ICON_WIDTH,
  COLOR_ICON_HEIGHT,
};

export const styles = StyleSheet.create({
  // HomeScreen
  titleHome: {
    // paddingVertical: 20,
    // flex:1,
    // justifyContent: 'center',
    position: 'absolute',
    top: screenHeight*0.2,
    width: '100%',
    alignContent: 'center',
    borderWidth: 1, 
    height: 'auto',       // 高さを文字サイズに合わせる
  },
  titleText: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    // fontSize: 80,
    fontSize: screenHeight/10,
    fontFamily: 'dartsfont',
    textAlign: 'center'
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // width: screenWidth,
    // height: screenHeight,
  },
  backgroundWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    flex: 1,
    width: screenWidth,
    // height: screenWidth * imageAspectRatio,
    height: screenHeight,
  },
  horizontalScrollContainer: {
    paddingHorizontal: 50,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookItem: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -(IMAGE_WIDTH * 0.03),
  },
  bookImage: {
    width: '100%',
    height: '100%',
  },
  bookTitleOverlay: {
    position: 'absolute',
    top: '30%',
    left: '16%',
    width: FONT_SIZE,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: 'black',
    fontFamily: 'dartsfont',
  },
  addBookSection: {
    padding: 10,
    position: 'absolute',
    top: screenHeight / 2 + IMAGE_HEIGHT * 0.5,
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
    fontSize: screenHeight/20,
    fontFamily: 'dartsfont',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  colorButton: {
    width: COLOR_ICON_WIDTH,
    height: COLOR_ICON_HEIGHT,
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
    // NotebookScreen用スタイル

  sliderWrapper: { // スライダーの親要素
    display: 'flex',
    position: 'absolute',
    bottom: 150,
    left: 10,
    right: 10,
    height: 50,
    flexDirection: 'row', // ← 横並び
    backgroundColor: 'transparent', // ← 半透明青
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
    // marginBottom: showSearch ? 0 : 20, // ← 検索バーがあるときは上に
  },

  notebookBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookImageStyle: {
    width: '100%',
    height: '100%',
  },
  notebookContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    width: '100%',
  },
  notebookTitle: {
    fontSize: 20,
    marginBottom: 10,
  },
  notebookButtonRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  notebookEditButtonWrapper: {
    marginRight: 10,
  },
  notebookScroll: {
    marginTop: 20,
  },
  notebookTextInput: {
    borderWidth: 1,
    padding: 10,
    minHeight: 400,
    textAlignVertical: 'top',
  },
  notebookContentText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'MyFont',
  },
  menuIconWrapper: {
    paddingRight: 15,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
    scroll: {
    marginTop: 20,
  },
//   textInput: {
//     borderWidth: 1,
//     padding: 10,
//     minHeight: 400,
//     textAlignVertical: 'top',  // Androidでテキスト入力の縦方向の位置をトップに固定
//   },
//   contentText: {
//     fontSize: 16,
//     lineHeight: 24,
//     fontFamily: 'MyFont',
//   },
  textInput: {
  fontSize: 16,
  padding: 12,
  backgroundColor: 'black',
  borderRadius: 8,
  textAlignVertical: 'top',
  minHeight: 200,
  },

  contentText: {
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: 'black',
    padding: 12,
    borderRadius: 8,
  },
    title: {
    fontSize: 20,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  editButtonWrapper: {
    marginRight: 10,
  },
  floatingEditButton: {
  position: 'absolute',
  bottom: screenHeight*0.02,
  right: 20,
  backgroundColor: 'black', // 好きな色に
  borderRadius: screenHeight,
  width: screenWidth/7,
  height: screenWidth/7,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
floatingSearchButton: {
  position: 'absolute',
  bottom: screenHeight*0.02,
  left: 20,
  backgroundColor: "black",
  borderRadius: screenHeight,
  width: screenWidth/7,
  height: screenWidth/7,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
});
