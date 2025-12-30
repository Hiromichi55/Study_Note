import { Dimensions, StyleSheet, Image } from 'react-native';
import bookImages from '../constants/bookImage';
import * as commonStyle from './commonStyle';

// NotebookScreen用スタイル
export const styles = StyleSheet.create({
  menuIconWrapper: {
    paddingRight: 0,
    alignItems: 'center'
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
  inputSmallStyle: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  floatingEditButton: {
  position: 'absolute',
  right: 20,
  backgroundColor: 'black', // 好きな色に
  borderRadius: screenHeight,
  width: screenWidth/6,
  height: screenWidth/6,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
floatingSearchButton: {
  position: 'absolute',
  bottom: screenHeight*0.02,
  left: 20,
  backgroundColor: "black",
  borderRadius: screenHeight,
  width: screenWidth/6,
  height: screenWidth/6,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
});
