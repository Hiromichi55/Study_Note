import { Dimensions, StyleSheet, Image } from 'react-native';
import bookImages from '../constants/bookImage';

// 画面の縦横
export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;
// 元画像の縦横
export const imgWidth = Image.resolveAssetSource(bookImages.blue).width;
export const imgHeight = Image.resolveAssetSource(bookImages.blue).height;
export const imageAspectRatio = imgHeight / imgWidth;
// 適応する本の画像
export const IMAGE_HEIGHT = screenHeight / 3.7;
export const IMAGE_WIDTH = IMAGE_HEIGHT * ( imgWidth / imgHeight );
// 本の追加をするときの画像
export const COLOR_ICON_WIDTH = IMAGE_WIDTH / 1.7;
export const COLOR_ICON_HEIGHT = IMAGE_HEIGHT / 1.7;
export const FONT_SIZE = IMAGE_HEIGHT * 0.1;
export const LINE_HEIGHT = FONT_SIZE * 1;