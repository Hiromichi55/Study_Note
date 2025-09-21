// src/context/LibraryContext.tsx
import React, { createContext, useReducer, useContext } from 'react';
import { Book } from '../types/types';

type State = {
  books: Book[];
};

type Action =
  | { type: 'UPDATE_CONTENT'; bookId: string; content: string }
  | { type: 'ADD_BOOK'; id: string; title: string };

const initialState: State = {
  books: [
    { id: '1', title: '基本情報技術者ノート', content: 'これは基本情報技術者ノートです。' },
    { id: '2', title: '応用情報技術者ノート', content: 'これは応用情報技術者ノートです。' },
  ],
};

function libraryReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UPDATE_CONTENT':
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === action.bookId ? { ...b, content: action.content } : b
        ),
      };
    case 'ADD_BOOK':
      return {
        ...state,
        books: [
          ...state.books,
          { id: action.id, title: action.title, content: 'ここにテキストを入力してください' },
        ],
      };
    default:
      return state;
  }
}

const LibraryContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => null });

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(libraryReducer, initialState);
  return (
    <LibraryContext.Provider value={{ state, dispatch }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
