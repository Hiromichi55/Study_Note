import React, { createContext, useReducer, useContext, useEffect, ReactNode } from 'react';
import { MemoBlock } from '../types/memo';
import { initDB } from '../db/db';
import { getMemoBlocks } from '../db/queries';

type State = {
  memoBlocks: MemoBlock[];
};

type Action =
  | { type: 'SET_BLOCKS'; blocks: MemoBlock[] }
  | { type: 'ADD_BLOCK'; block: MemoBlock }
  | { type: 'UPDATE_BLOCK'; id: number; content: string };

const initialState: State = { memoBlocks: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BLOCKS':
      return { ...state, memoBlocks: action.blocks };
    case 'ADD_BLOCK':
      return { ...state, memoBlocks: [...state.memoBlocks, action.block] };
    case 'UPDATE_BLOCK':
      return {
        ...state,
        memoBlocks: state.memoBlocks.map(b => b.id === action.id ? { ...b, content: action.content } : b),
      };
    default:
      return state;
  }
}

type MemoContextType = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const MemoContext = createContext<MemoContextType | undefined>(undefined);

type MemoProviderProps = {
  children: ReactNode;
};

export const MemoProvider = ({ children }: MemoProviderProps) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    initDB();
  }, []);

  const loadMemoBlocks = async (memoId: number) => {
    const blocks = await getMemoBlocks(memoId);
    dispatch({ type: 'SET_BLOCKS', blocks });
  };

  return (
    <MemoContext.Provider value={{ state, dispatch }}>
      {children}
    </MemoContext.Provider>
  );
};

export const useMemoContext = () => {
  const context = useContext(MemoContext);
  if (!context) throw new Error('useMemoContext must be used within MemoProvider');
  return context;
};
