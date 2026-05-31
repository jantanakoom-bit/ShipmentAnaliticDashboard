import { useMemo, useState, useRef, useCallback } from "react";
import { formatNumber, formatDate } from "../lib/utils";

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "bookingNo", label: "Booking No" },
  { key: "jobNo", label: "Job No" },
  { key: "shipper", label: "Shipper" },
  { key: "port", label: "Port" },
  { key: "country", label: "Country" },
  { key: "trade", label: "Trade" },
  { key: "carrier", label: "Carrier" },
  { key: "saleName", label: "Sale Name" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "teu", label: "TEU" },
];

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

export default function ShipmentsPage({ filteredRows }) {
  const [tableSearch, setTableSearch] = useState("");
  const [sortState, setSortState] = useState({ key: "date", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(COLUMNS.map((col) => col.key)),
  );
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const colToggleRef = useRef(null);

  const searchedRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    if (!search) {
      return filteredRows;
    }
    return filteredRows.filter((row) =>
      [
        row.bookingNo,
        row.jobNo,
        row.shipper,
        row.port,
        row.country,
        row.trade,
        row.carrier,
        row.saleName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [filteredRows, tableSearch]);

  const sortedRows = useMemo(() => {
    return [...searchedRows].sort((left, right) => {
      const { key, direction } = sortState;
      const modifier = direction === "asc" ? 1 : -1;
      let leftValue = left[key];
      let rightValue = right[key];

      if (key === "date") {
        leftValue = left.date ? left.date.getTime() : 0;
        rightValue = right.date ? right.date.getTime() : 0;
      }

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * modifier;
      }

      return `${leftValue ?? ""}`.localeCompare(`${rightValue ?? ""}`) * modifier;
    });
  }, [searchedRows, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const pageEnd = Math.min(pageStart + rowsPerPage, sortedRows.length);
  const pageRows = sortedRows.slice(pageStart, pageEnd);

  const totals = useMemo(() => {
    let qty = 0;
    let teu = 0;
    for (const row of searchedRows) {
      qty += row.qty;
      teu += row.teu;
    }
    return { qty, teu };
  }, [searchedRows]);

  function toggleSort(key) {
    setSortState((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "date" ? "asc" : "desc" };
    });
    setCurrentPage(1);
  }

  function handleSearchChange(event) {
    setTableSearch(event.target.value);
    setCurrentPage(1);
  }

  function handleRowsPerPageChange(event) {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);
  }

  function toggleColumn(key) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const exportCsv = useCallback(() => {
    const visibleCols = COLUMNS.filter((col) => visibleColumns.has(col.key));
    const header = visibleCols.map((col) => col.label).join(",");
    const rows = sortedRows.map((row) =>
      visibleCols
        .map((col) => {
          let value;
          if (col.key === "date") {
            value = formatDate(row.date);
          } else {
            value = row[col.key] ?? "";
          }
          const str = String(value);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shipments.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedRows, visibleColumns]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return { numbers: pages, lastPage: null };
    }
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    for (let i = adjustedStart; i <= end; i++) {
      pages.push(i);
    }
    return {
      numbers: pages,
      lastPage: pages[pages.length - 1] < totalPages ? totalPages : null,
    };
  }, [totalPages, safePage]);

  const visibleColSpan = useMemo(() => {
    let count = 0;
    for (const col of COLUMNS) {
      if (visibleColumns.has(col.key)) {
        count++;
      }
    }
    return count;
  }, [visibleColumns]);

  return (
    <section className="table-section">
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <div className="table-title">Shipment Detail</div>
          <div className="table-sub">
            {formatNumber(searchedRows.length)} records — sortable, searchable, exportable
          </div>
        </div>
        <div className="table-toolbar-right">
          <input
            className="search-input"
            placeholder="Search booking, job, shipper, port..."
            type="text"
            value={tableSearch}
            onChange={handleSearchChange}
          />
          <button className="btn" type="button" onClick={exportCsv}>
            <span aria-hidden="true">↓</span>
            Export CSV
          </button>
          <div className="col-toggle" ref={colToggleRef}>
            <button
              className="btn"
              type="button"
              onClick={() => setColDropdownOpen((prev) => !prev)}
            >
              Columns ▾
            </button>
            {colDropdownOpen && (
              <div className="col-dropdown open">
                {COLUMNS.map((col) => (
                  <label className="col-opt" key={col.key}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <select
            className="rows-select"
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
          >
            {ROWS_PER_PAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) => (
                <th
                  key={col.key}
                  className={sortState.key === col.key ? sortState.direction : ""}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  <span className="sort-icon" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={`${row.bookingNo}-${row.jobNo}-${row.date?.getTime() ?? row.route}`}>
                {visibleColumns.has("date") && (
                  <td className="td-date">{formatDate(row.date)}</td>
                )}
                {visibleColumns.has("bookingNo") && <td>{row.bookingNo || "-"}</td>}
                {visibleColumns.has("jobNo") && <td>{row.jobNo || "-"}</td>}
                {visibleColumns.has("shipper") && <td>{row.shipper}</td>}
                {visibleColumns.has("port") && <td>{row.port}</td>}
                {visibleColumns.has("country") && <td>{row.country}</td>}
                {visibleColumns.has("trade") && <td>{row.trade}</td>}
                {visibleColumns.has("carrier") && <td>{row.carrier}</td>}
                {visibleColumns.has("saleName") && <td>{row.saleName}</td>}
                {visibleColumns.has("qty") && (
                  <td className="td-num">{formatNumber(row.qty)}</td>
                )}
                {visibleColumns.has("unit") && (
                  <td>
                    <span
                      className={`unit-badge ${
                        row.unit.startsWith("20")
                          ? "unit-20"
                          : row.unit.startsWith("40")
                            ? "unit-40"
                            : "unit-other"
                      }`}
                    >
                      {row.unit}
                    </span>
                  </td>
                )}
                {visibleColumns.has("teu") && (
                  <td className="td-num">{formatNumber(row.teu)}</td>
                )}
              </tr>
            ))}
            <tr className="tfoot-row">
              <td>Total</td>
              <td colSpan={visibleColSpan - 3} />
              {visibleColumns.has("qty") && (
                <td className="td-num">{formatNumber(totals.qty)}</td>
              )}
              {visibleColumns.has("unit") && <td />}
              {visibleColumns.has("teu") && (
                <td className="td-num">{formatNumber(totals.teu)}</td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="page-info">
          Showing <b>{sortedRows.length === 0 ? 0 : pageStart + 1}–{pageEnd}</b> of{" "}
          <b>{formatNumber(sortedRows.length)}</b> records
        </div>
        <div className="page-btns">
          <button
            className="page-btn"
            disabled={safePage <= 1}
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &#8249;
          </button>
          {pageNumbers.numbers.map((num) => (
            <button
              key={num}
              className={`page-btn${num === safePage ? " active" : ""}`}
              type="button"
              onClick={() => setCurrentPage(num)}
            >
              {num}
            </button>
          ))}
          {pageNumbers.lastPage !== null && (
            <>
              <button className="page-btn" disabled type="button">
                …
              </button>
              <button
                className={`page-btn${safePage === pageNumbers.lastPage ? " active" : ""}`}
                type="button"
                onClick={() => setCurrentPage(pageNumbers.lastPage)}
              >
                {pageNumbers.lastPage}
              </button>
            </>
          )}
          <button
            className="page-btn"
            disabled={safePage >= totalPages}
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            &#8250;
          </button>
        </div>
      </div>
    </section>
  );
}
