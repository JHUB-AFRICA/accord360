import EmptyState from "./EmptyState";

export default function DataTable({ columns, rows, keyField = "id", onRowClick, emptyTitle, emptyText }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]} className={onRowClick ? "clickable-row" : ""} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)} onKeyDown={(event) => { if (onRowClick && (event.key === "Enter" || event.key === " ")) onRowClick(row); }}>
              {columns.map((column) => <td key={column.key} data-label={column.label}>{column.render ? column.render(row) : row[column.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
