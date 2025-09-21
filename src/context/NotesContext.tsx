import React, { createContext, useState, useContext, ReactNode } from 'react';

interface Note {
  id: string;
  content: string;
}

interface NotesContextProps {
  notes: Note[];
  updateNote: (id: string, content: string) => void;
}

const NotesContext = createContext<NotesContextProps | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([
    { id: '1', content: '最初のメモです' },
  ]);

  const updateNote = (id: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content } : n))
    );
    // ここでローカルストレージ等に保存することもできる
    localStorage.setItem('notes', JSON.stringify(
      notes.map((n) => (n.id === id ? { ...n, content } : n))
    ));
  };

  return (
    <NotesContext.Provider value={{ notes, updateNote }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
};
