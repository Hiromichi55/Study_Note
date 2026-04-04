import { ImageSourcePropType } from 'react-native';
import { Book } from '../context/LibraryContext';

const bookImages: { [key in Book['color']]: ImageSourcePropType } = {
  blue: require('../../assets/images/blue_book.png'),
  cyan: require('../../assets/images/cyan_book.png'),
  green: require('../../assets/images/green_book.png'),
  red: require('../../assets/images/red_book.png'),
  yellow: require('../../assets/images/yellow_book.png'),
  orange: require('../../assets/images/orange_book.png'),
  pink: require('../../assets/images/pink_book.png'),
  purple: require('../../assets/images/purple_book.png'),
  brown: require('../../assets/images/brown_book.png'),
  gray: require('../../assets/images/gray_book.png'),
  black: require('../../assets/images/black_book.png'),
  olive: require('../../assets/images/green_book.png'),
};

export default bookImages;
