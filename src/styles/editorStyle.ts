import * as commonStyle from './commonStyle';
import {StyleSheet} from 'react-native';

export const editorStyles = StyleSheet.create({
    editorBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    editorContainer: {
        position: 'absolute',
        top: 10,
        left: commonStyle.screenWidth * 0.05,
        width: commonStyle.screenWidth * 0.9,
        height: (commonStyle.screenHeight - 10) * 0.6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    headerText: {
        fontWeight: 'bold',
        marginBottom: 8 
    },
    attributesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8
    },
    attributeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    attributeBtnText: {
        fontWeight: 'bold' 
    },
    textBoxContainer: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        marginBottom: 6,
    },
    wordBox: {
        height: 40,
        marginBottom: 6, 
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'white',
    },
    explanationBox: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'white',
    },
    imgBox: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'black',
    }
})