import clsx from "clsx";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyText = "No records found.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
          <thead className="bg-ink-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={clsx("whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-500", column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-ink-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="bg-white transition hover:bg-emerald-50/40">
                  {columns.map((column) => (
                    <td key={column.key} className={clsx("max-w-[18rem] whitespace-normal break-words px-4 py-3 align-top text-ink-700", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
