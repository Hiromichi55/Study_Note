
import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import csv
import os

INPUT_FILE = "input.csv"

class WordList:
    def __init__(self, filename):
        self.filename = filename
        self.words = {}  # {単語: [説明, ジャンル]}
        self.header = []
        self.load()

    def load(self):
        self.words = {}
        if not os.path.exists(self.filename):
            self.header = ["単語", "説明", "ジャンル"]
            return
        with open(self.filename, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)
            if rows:
                self.header = rows[0]
                for row in rows[1:]:
                    if len(row) >= 1 and row[0].strip():
                        self.words[row[0]] = row[1:]
            else:
                self.header = ["単語", "説明", "ジャンル"]

    def add(self, word, description, genre):
        if word.strip():
            self.words[word] = [description, genre]
            self.save()

    def save(self):
        with open(self.filename, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(self.header)
            for word, vals in self.words.items():
                writer.writerow([word] + vals)

    def to_text(self):
        lines = [", ".join(self.header)]
        for word, vals in self.words.items():
            lines.append(", ".join([word] + vals))
        return "\n".join(lines)

def update_display():
    # Treeviewの内容をクリア
    for row in tree.get_children():
        tree.delete(row)
    # データを追加
    for word, vals in word_list.words.items():
        tree.insert("", "end", values=[word] + vals)

def on_append():
    word = word_entry.get().strip()
    description = desc_entry.get().strip()
    genre = genre_entry.get().strip()
    if word and description and genre:
        word_list.add(word, description, genre)
        update_display()
        word_entry.delete(0, tk.END)
        desc_entry.delete(0, tk.END)
        genre_entry.delete(0, tk.END)
        messagebox.showinfo("追記", "追記しました！")
    else:
        messagebox.showwarning("警告", "すべての項目を入力してください。")


if __name__ == "__main__":
    word_list = WordList(INPUT_FILE)

    root = tk.Tk()
    root.title("input.csv 編集GUI")

    # Treeviewで表形式表示
    columns = word_list.header
    tree = ttk.Treeview(root, columns=columns, show="headings", height=15)
    for col in columns:
        tree.heading(col, text=col)
        tree.column(col, width=150)
    tree.pack(padx=10, pady=10)

    form_frame = tk.Frame(root)
    form_frame.pack(padx=10, pady=5)

    tk.Label(form_frame, text="単語", font=("Meiryo", 12)).grid(row=0, column=0, padx=5)
    word_entry = tk.Entry(form_frame, width=20, font=("Meiryo", 12))
    word_entry.grid(row=0, column=1, padx=5)

    tk.Label(form_frame, text="説明", font=("Meiryo", 12)).grid(row=0, column=2, padx=5)
    desc_entry = tk.Entry(form_frame, width=30, font=("Meiryo", 12))
    desc_entry.grid(row=0, column=3, padx=5)

    tk.Label(form_frame, text="ジャンル", font=("Meiryo", 12)).grid(row=0, column=4, padx=5)
    genre_entry = tk.Entry(form_frame, width=15, font=("Meiryo", 12))
    genre_entry.grid(row=0, column=5, padx=5)

    append_btn = tk.Button(root, text="追記", command=on_append, font=("Meiryo", 12))
    append_btn.pack(pady=5)

    update_display()
    root.mainloop()

    print(word_list.words)
    print(word_list.header)