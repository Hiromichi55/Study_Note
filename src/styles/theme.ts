import { Dimensions, StyleSheet, Image } from 'react-native';
import bookImages from '../constants/bookImage';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const { width: imgWidth, height: imgHeight } = Image.resolveAssetSource(bookImages.blue);
const imageAspectRatio = imgHeight / imgWidth;
const IMAGE_WIDTH = screenWidth / 5.5;
const IMAGE_HEIGHT = (IMAGE_WIDTH * imgHeight) / imgWidth;
const FONT_SIZE = IMAGE_HEIGHT * 0.1;
const LINE_HEIGHT = FONT_SIZE * 1;
const COLOR_ICON_WIDTH = IMAGE_WIDTH / 1.7;
const COLOR_ICON_HEIGHT = IMAGE_HEIGHT / 1.7;

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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backgroundWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    width: screenWidth,
    height: screenWidth * imageAspectRatio,
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
    width: IMAGE_WIDTH,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: 'black',
    fontFamily: 'dartsfont',
  },
  addBookSection: {
    padding: 10,
    position: 'absolute',
    top: screenHeight / 2 + IMAGE_HEIGHT * 1.3,
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
    fontSize: 40,
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
  textInput: {
    borderWidth: 1,
    padding: 10,
    minHeight: 400,
    textAlignVertical: 'top',  // Androidでテキスト入力の縦方向の位置をトップに固定
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'MyFont',
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
  bottom: 30,
  right: 20,
  backgroundColor: 'black', // 好きな色に
  borderRadius: 30,
  width: 60,
  height: 60,
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
  bottom: 30,
  left: 20,
  backgroundColor: "black",
  borderRadius: 30,
  width: 60,
  height: 60,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
});
