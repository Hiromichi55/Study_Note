import { ENV } from '@config';

type Column<T> = {
  key: keyof T;
  label?: string;
};

export function logTable<T extends Record<string, any>>(
  title: string,
  rows: T[],
  columns?: Column<T>[]
) {
  // 🔑 開発時以外は何もしない
  if (!ENV.LOG_TABLES) return;

  if (!rows || rows.length === 0) {
    console.log(`📘 ${title} (empty)`);
    return;
  }

  const cols: Column<T>[] =
    columns && columns.length > 0
      ? columns
      : Object.keys(rows[0]).map(key => ({ key: key as keyof T }));

  const headers = ['#', ...cols.map(c => c.label ?? String(c.key))];
  const data = rows.map((row, i) => [
    String(i),
    ...cols.map(c => String(row[c.key] ?? '')),
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...data.map(row => row[i].length))
  );

  const formatRow = (row: string[]) =>
    row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');

  const lines: string[] = [];

  lines.unshift('='.repeat(40));
  lines.push(`📘 ${title}`);
  lines.push(formatRow(headers));
  lines.push(colWidths.map(w => '-'.repeat(w)).join('-+-'));
  data.forEach(row => lines.push(formatRow(row)));
  lines.push('='.repeat(40));

  // 1回だけ出力（LOG を1つに）
  console.log('\n' + lines.join('\n'));
}