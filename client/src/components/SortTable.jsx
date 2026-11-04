import { memo, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

// Sıralanabilir tablo. columns: [{ key, label, align?, sort?: (row)=>değer | false, render?: (row)=>node, className? }]
function SortTable({ columns, rows, rowKey, defaultSort, empty = 'Kayıt yok.', dense = false, rowClass }) {
  const [sort, setSort] = useState(defaultSort ?? null); // { key, dir: 1 | -1 }
  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort?.key);
    if (!col || col.sort === false) return rows;
    const val = col.sort ?? (r => r[col.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; // boşlar hep sonda
      return (typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y) * sort.dir;
    });
  }, [rows, sort, columns]);

  const click = (c) => c.sort !== false && setSort(s => s?.key === c.key ? { key: c.key, dir: -s.dir } : { key: c.key, dir: c.firstDir ?? 1 });
  const pad = dense ? 'py-2' : 'py-3';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>{columns.map(c => {
            const active = sort?.key === c.key; const Icon = !active ? ChevronsUpDown : sort.dir > 0 ? ArrowUp : ArrowDown;
            return (
              <th key={c.key} scope="col" aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
                className={clsx('th whitespace-nowrap px-3 first:pl-1 last:pr-1', c.align === 'right' ? 'text-right' : 'text-left', c.className)}>
                {c.sort === false || !c.label ? c.label : (
                  <button onClick={() => click(c)} className={clsx('inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-slate-200', active && 'text-slate-200', c.align === 'right' && 'flex-row-reverse')}>
                    {c.label}<Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
                  </button>)}
              </th>);
          })}</tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={rowKey(r)} className={clsx('row transition-colors hover:bg-white/[0.04]', rowClass?.(r))}>
              {columns.map(c => (
                <td key={c.key} className={clsx(pad, 'px-3 first:pl-1 last:pr-1', c.align === 'right' && 'num text-right', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>))}
            </tr>))}
          {!sorted.length && <tr><td colSpan={columns.length} className="py-10 text-center text-slate-500">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default memo(SortTable);
