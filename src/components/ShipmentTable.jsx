import { useMemo, useState } from "react";
import { formatNumber, formatDate } from "../lib/utils";

export default function ShipmentTable({ filteredRows }) {
  const [tableSearch, setTableSearch] = useState("");
  const [sortState, setSortState] = useState({ key: "date", direction: "asc" });

  const tableRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    const searched = filteredRows.filter((row) => {
      if (!search) {
        return true;
      }

      return [
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
        .includes(search);
    });

    return [...searched].sort((left, right) => {
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
  }, [filteredRows, sortState, tableSearch]);

  function toggleSort(key) {
    setSortState((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "date" ? "asc" : "desc" };
    });
  }

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div>
          <div className="top-title">Shipment Detail</div>
          <div className="chart-sub">Sortable row-level records, capped at 80 visible rows for review speed.</div>
        </div>
        <div className="table-tools">
          <input
            className="table-search"
            placeholder="Search booking, job, shipper, port..."
            type="text"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
          />
          <div className="table-info">{formatNumber(tableRows.length)} rows</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className={sortState.key === "date" ? sortState.direction : ""} onClick={() => toggleSort("date")}>Date <span className="sort-icon" /></th>
              <th className={sortState.key === "bookingNo" ? sortState.direction : ""} onClick={() => toggleSort("bookingNo")}>Booking No <span className="sort-icon" /></th>
              <th className={sortState.key === "jobNo" ? sortState.direction : ""} onClick={() => toggleSort("jobNo")}>Job No <span className="sort-icon" /></th>
              <th className={sortState.key === "shipper" ? sortState.direction : ""} onClick={() => toggleSort("shipper")}>Shipper <span className="sort-icon" /></th>
              <th className={sortState.key === "port" ? sortState.direction : ""} onClick={() => toggleSort("port")}>Port <span className="sort-icon" /></th>
              <th className={sortState.key === "country" ? sortState.direction : ""} onClick={() => toggleSort("country")}>Country <span className="sort-icon" /></th>
              <th className={sortState.key === "trade" ? sortState.direction : ""} onClick={() => toggleSort("trade")}>Trade <span className="sort-icon" /></th>
              <th className={sortState.key === "carrier" ? sortState.direction : ""} onClick={() => toggleSort("carrier")}>Carrier <span className="sort-icon" /></th>
              <th className={sortState.key === "saleName" ? sortState.direction : ""} onClick={() => toggleSort("saleName")}>Sale Name <span className="sort-icon" /></th>
              <th className={sortState.key === "qty" ? sortState.direction : ""} onClick={() => toggleSort("qty")}>Qty <span className="sort-icon" /></th>
              <th className={sortState.key === "unit" ? sortState.direction : ""} onClick={() => toggleSort("unit")}>Unit <span className="sort-icon" /></th>
              <th className={sortState.key === "teu" ? sortState.direction : ""} onClick={() => toggleSort("teu")}>TEU <span className="sort-icon" /></th>
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(0, 80).map((row) => (
              <tr key={`${row.bookingNo}-${row.jobNo}-${row.date?.getTime() ?? row.route}`}>
                <td className="td-date">{formatDate(row.date)}</td>
                <td>{row.bookingNo || "-"}</td>
                <td>{row.jobNo || "-"}</td>
                <td>{row.shipper}</td>
                <td>{row.port}</td>
                <td>{row.country}</td>
                <td>{row.trade}</td>
                <td>{row.carrier}</td>
                <td>{row.saleName}</td>
                <td className="td-num">{formatNumber(row.qty)}</td>
                <td>
                  <span className={`unit-badge ${row.unit.startsWith("20") ? "unit-20" : row.unit.startsWith("40") ? "unit-40" : "unit-other"}`}>
                    {row.unit}
                  </span>
                </td>
                <td className="td-num">{formatNumber(row.teu)}</td>
              </tr>
            ))}
            <tr className="tfoot-row">
              <td>Total</td>
              <td colSpan={8} />
              <td className="td-num">{formatNumber(tableRows.reduce((sum, row) => sum + row.qty, 0))}</td>
              <td />
              <td className="td-num">{formatNumber(tableRows.reduce((sum, row) => sum + row.teu, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
