import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data",
  className = "",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className={`rounded-xl border py-10 text-center text-sm ${className}`}
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--surface-muted)",
          color: "var(--text-muted)",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto rounded-xl border ${className}`}
      style={{
        borderColor: "var(--border-soft)",
        boxShadow: "var(--shadow-soft)",
        background: "var(--surface)",
      }}
    >
      <table className="min-w-full text-left text-sm" style={{ color: "var(--text-primary)" }}>
        <thead style={{ background: "var(--surface-muted)" }}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                style={{
                  borderColor: "var(--border-soft)",
                  color: "var(--text-muted)",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className="transition-colors duration-150 hover:bg-[var(--nav-hover)]"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3.5 align-middle">
                  {col.render
                    ? col.render(row)
                    : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
