import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Text, TextInput } from 'react-native';
import { NoteElement } from './NoteContent';
import { notebookStyles } from '../styles/notebookStyle';
import * as commonStyle from '../styles/commonStyle';
import { editorStyles } from '../styles/editorStyle';

type Props = {
  /*currentAttribute: '章' | '節' | '項' | '単語' | '画像' | '文章';
  setCurrentAttribute: (a: any) => void;
  wordInputRef: React.RefObject<TextInput | null>;
  editInputRef: React.RefObject<TextInput | null>;
  definitionInputRef: React.RefObject<TextInput | null>;
  setPagesElements: React.Dispatch<React.SetStateAction<NoteElement[][]>>;*/
  currentPage: number;
  /*editingLineIndex: number | null;
  setEditingLineIndex: (n: number | null) => void;
  setEditing: (b: boolean) => void;
  word: string;
  setWord: (s: string) => void;
  definition: string;
  setDefinition: (s: string) => void;
  pagesElements: NoteElement[][];
  noteBounds: { x: number; y: number; width: number; height: number } | null;
  keyboardHeight: number;*/
};

const ATTRIBUTES = ['章', '節', '項', '単語', '画像', '文章'] as const;

const getBgColorForType = (type: any) => {
  switch (type) {
    case 'chapter':
      return 'rgba(255, 243, 205, 0.9)';
    case 'section':
      return 'rgba(210, 235, 255, 0.9)';
    case 'subsection':
      return 'rgba(224, 255, 224, 0.9)';
    case 'word':
      return 'rgba(255, 230, 240, 0.95)';
    case 'image':
      return 'rgba(240,240,240,0.95)';
    default:
      return 'transparent';
  }
};

export default function EditorScreen(props: Props) {
  const {
    /*currentAttribute,
    wordInputRef,
    editInputRef,
    definitionInputRef,
    currentPage,

    /*
    word,
    definition,
    pagesElements,
    */

    /* 

    */

    //いらん
    /*keyboardHeight,
    editingLineIndex,
    setEditingLineIndex,
    setEditing,*/
  } = props;



  // local state for generic text/image/chapter/section input
  const [textValue, setTextValue] = useState('');
  const currentAttribute = '単語';

  return (
    <View style={editorStyles.editorBackground}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          // open editor: reset local text input and focus appropriate field
          setTextValue('');
          if (currentAttribute === '単語') {
            setTimeout(() => wordInputRef.current?.focus(), 150);
          } else {
            setTimeout(() => editInputRef.current?.focus(), 150);
          }
        }}
        style={editorStyles.editorContainer}
      >
        <Text style={editorStyles.headerText}>ページ編集：</Text>
        <View style={editorStyles.attributeContainer}>
          {ATTRIBUTES.map((attr) => (
            <TouchableOpacity
              key={attr}
                      onPress={() => {
                        setCurrentAttribute(attr as any);
                const type = attr === '章' ? 'chapter' : attr === '節' ? 'section' : attr === '項' ? 'subsection' : attr === '単語' ? 'word' : attr === '画像' ? 'image' : 'text';
                const idx = currentPage;

                setPagesElements(prev => {
                  const next = [...prev];
                  if (!next[idx]) next[idx] = [];

                  if (editingLineIndex !== null && next[idx][editingLineIndex]) {
                    const old = next[idx][editingLineIndex];
                    let converted: any = { ...old };
                    if (type === 'word') {
                      converted = { type: 'word', word: (old as any).text || (old as any).word || '', meaning: (old as any).meaning || '' };
                    } else if (type === 'image') {
                      converted = { type: 'image', uri: (old as any).text || (old as any).uri || '' };
                    } else {
                      converted = { type: type as any, text: (old as any).text || (old as any).word || (old as any).uri || '' };
                    }
                    next[idx][editingLineIndex] = converted;
                  } else {
                    const newEl: any = type === 'word' ? { type: 'word', word: '', meaning: '' } : type === 'image' ? { type: 'image', uri: '' } : { type, text: '' };
                    next[idx] = [newEl, ...(next[idx] || [])];
                  }
                  return next;
                });

                setEditingLineIndex(editingLineIndex !== null ? editingLineIndex : 0);
                setEditing(true);
                setCurrentAttribute(attr as any);
                setTimeout(() => {
                  if (attr === '単語') {
                    wordInputRef.current?.focus();
                  } else {
                    editInputRef.current?.focus();
                  }
                }, 120);
              }}
              style={[
                editorStyles.attributeBtn,
                {backgroundColor: currentAttribute === attr ? '#007AFF' : 'rgba(0,0,0,0.06)'},
              ]}
            >
              <Text style={{ color: currentAttribute === attr ? 'white' : 'black'}}>{attr}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView>
          {(() => {
            const elems = pagesElements[currentPage] ?? [];
            return elems.map((el, i) => {
              const isSelected = editingLineIndex === i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    // populate inputs from selected element
                    if (el.type === 'word') {
                      setWord((el as any).word || '');
                      setDefinition((el as any).meaning || '');
                    } else if (el.type === 'image') {
                      setTextValue((el as any).uri || '');
                    } else {
                      setTextValue((el as any).text || '');
                    }
                    setEditing(true);
                    setEditingLineIndex(i);
                    setTimeout(() => {
                      if (el.type === 'word') wordInputRef.current?.focus();
                      else editInputRef.current?.focus();
                    }, 100);
                  }}
                  style={[
                    editorStyles.textBoxContainer, 
                    { backgroundColor: getBgColorForType(el.type) }
                  ]}
                >
                  {isSelected ? (
                        el.type === 'word' ? (
                      <View>
                        <TextInput
                          ref={wordInputRef}
                          value={(el as any).word}
                          onChangeText={(t) => {
                            setPagesElements(prev => {
                              const next = [...prev];
                              const arr = next[currentPage] || [];
                              if (arr[i]) (arr[i] as any).word = t;
                              next[currentPage] = arr;
                              return next;
                            });
                          }}
                          placeholder="単語"
                          style={editorStyles.wordBox}
                        />
                        <TextInput
                          ref={definitionInputRef}
                          value={(el as any).meaning}
                          onChangeText={(t) => {
                            setPagesElements(prev => {
                              const next = [...prev];
                              const arr = next[currentPage] || [];
                              if (arr[i]) (arr[i] as any).meaning = t;
                              next[currentPage] = arr;
                              return next;
                            });
                          }}
                          placeholder="説明"
                          style={editorStyles.explanationBox}
                          multiline
                        />
                      </View>
                    ) : (
                      <TextInput
                        ref={editInputRef}
                        value={el.type === 'image' ? (el as any).uri : (el as any).text}
                        onChangeText={(t) => {
                          setPagesElements(prev => {
                            const next = [...prev];
                            const arr = next[currentPage] || [];
                            if (arr[i]) {
                              if ((arr[i] as any).type === 'image') (arr[i] as any).uri = t;
                              else (arr[i] as any).text = t;
                            }
                            next[currentPage] = arr;
                            return next;
                          });
                          setTextValue(t);
                        }}
                        placeholder="内容を入力"
                        style={editorStyles.imgBox}
                        multiline
                      />
                    )
                  ) : (
                    <Text>
                      {el.type === 'word' ? `${(el as any).word} — ${(el as any).meaning}` : el.type === 'image' ? `［画像］ ${(el as any).uri}` : 'text' in el ? (el as any).text : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>
      </TouchableOpacity>
    </View>
  );
}
