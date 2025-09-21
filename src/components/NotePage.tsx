import React, { useState } from 'react';
import { useNotes } from '../context/NotesContext';

interface Props {
  noteId: string;
}

const NotePage: React.FC<Props> = ({ noteId }) => {
  const { notes, updateNote } = useNotes();
  const note = notes.find((n) => n.id === noteId);

  const [value, setValue] = useState(note?.content || '');

  if (!note) return <div>ノートが見つかりません</div>;

  const handleBlur = () => {
    updateNote(noteId, value); // フォーカスが外れたタイミングで自動保存
  };

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">ノート</h1>
      <textarea
        className="w-full h-96 border p-2"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur} // フォーカスが外れたら保存
      />
    </div>
  );
};

export default NotePage;
