import { ImageSourcePropType } from 'react-native';
import { Book } from '../context/LibraryContext';

const bookImages: { [key in Book['color']]: ImageSourcePropType } = {
  blue: require('../../assets/images/blue_book.png'),
  cyan: require('../../assets/images/cyan_book.png'),
  green: require('../../assets/images/green_book.png'),
  pink: require('../../assets/images/pink_book.png'),
  red: require('../../assets/images/red_book.png'),
  yellow: require('../../assets/images/yellow_book.png'),
};

export default bookImages;
