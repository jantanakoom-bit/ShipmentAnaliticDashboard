import { useMemo, useState, useRef, useCallback } from "react";
import { apiRequest } from "../lib/api";
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
const STATUS_OPTIONS = ["Booked", "Pending", "Loaded", "In Transit", "Completed", "Cancelled", "Unspecified"];

const EMPTY_FORM = {
  date: "",
  bookingNo: "",
  jobNo: "",
  shipper: "",
  port: "",
  country: "",
  trade: "",
  carrier: "",
  saleName: "",
  qty: "",
  unit: "",
  teu: "",
  status: "Booked",
  ownerUserId: "",
  ownerUsername: "",
};

export default function ShipmentsPage({ filteredRows, currentUser, onDataRefresh }) {
  const [tableSearch, setTableSearch] = useState("");
  const [sortState, setSortState] = useState({ key: "date", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(COLUMNS.map((col) => col.key)),
  );
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [formMode, setFormMode] = useState("");
  const [activeRow, setActiveRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const colToggleRef = useRef(null);
  const canCrud = Boolean(currentUser?.role);
  const canViewAll = currentUser?.role === "admin" || currentUser?.role === "moderator";

  const ownerOptions = useMemo(() => {
    return [...new Set(filteredRows.map((row) => row.ownerUsername || row.saleName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [filteredRows]);

  const ownerFilteredRows = useMemo(() => {
    if (!canViewAll || ownerFilter === "All") {
      return filteredRows;
    }
    return filteredRows.filter((row) => (row.ownerUsername || row.saleName) === ownerFilter);
  }, [canViewAll, filteredRows, ownerFilter]);

  const searchedRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    if (!search) {
      return ownerFilteredRows;
    }
    return ownerFilteredRows.filter((row) =>
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
  }, [ownerFilteredRows, tableSearch]);

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

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setActiveRow(null);
    setFormMode("create");
    setDeleteConfirmOpen(false);
    setMessage("");
  }

  function openDetail(row) {
    setActiveRow(row);
    setForm(rowToForm(row));
    setFormMode("detail");
    setDeleteConfirmOpen(false);
    setMessage("");
  }

  function closeForm() {
    setFormMode("");
    setActiveRow(null);
    setForm(EMPTY_FORM);
    setDeleteConfirmOpen(false);
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refreshAfterChange(successMessage) {
    if (onDataRefresh) {
      await onDataRefresh();
    }
    setMessage(successMessage);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await apiRequest("/api/shipments", {
        method: "POST",
        body: JSON.stringify(normalizePayload(form, canViewAll)),
      });
      closeForm();
      await refreshAfterChange("Shipment created successfully");
    } catch (error) {
      setMessage(error.message || "Unable to create shipment");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!activeRow?.recordId) return;
    setSaving(true);
    setMessage("");
    try {
      await apiRequest(`/api/shipments/${encodeURIComponent(activeRow.recordId)}`, {
        method: "PATCH",
        body: JSON.stringify(normalizePayload(form, canViewAll)),
      });
      await refreshAfterChange("Shipment updated successfully");
    } catch (error) {
      setMessage(error.message || "Unable to update shipment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeRow?.recordId) return;
    setSaving(true);
    setMessage("");
    try {
      await apiRequest(`/api/shipments/${encodeURIComponent(activeRow.recordId)}`, {
        method: "DELETE",
      });
      closeForm();
      await refreshAfterChange("Shipment deleted successfully");
    } catch (error) {
      setMessage(error.message || "Unable to delete shipment");
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteConfirmation() {
    if (!activeRow?.recordId) return;
    setMessage("");
    setDeleteConfirmOpen(true);
  }

  function cancelDeleteConfirmation() {
    setDeleteConfirmOpen(false);
    setMessage("");
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
          {canViewAll ? (
            <label className="owner-filter">
              <span>Sales Person</span>
              <select
                aria-label="Sales Person"
                className="rows-select"
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
              >
                <option value="All">All</option>
                {ownerOptions.map((owner) => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
            </label>
          ) : null}
          {canCrud ? (
            <button className="btn btn-primary" type="button" onClick={openCreateForm}>
              Add Shipment
            </button>
          ) : null}
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

      {message && formMode !== "detail" ? (
        <div className="inline-error shipment-message">{message}</div>
      ) : null}

      {formMode === "create" ? (
        <ShipmentEditor
          mode={formMode}
          form={form}
          row={activeRow}
          canViewAll={canViewAll}
          saving={saving}
          onChange={setField}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={closeForm}
        />
      ) : null}

      {formMode === "detail" ? (
        <div className="shipment-modal">
          <div className="shipment-modal-backdrop" aria-hidden="true" />
          <div
            className="shipment-modal-dialog"
            role="dialog"
            aria-modal={deleteConfirmOpen ? undefined : "true"}
            aria-labelledby="shipment-detail-title"
          >
            {message && !deleteConfirmOpen ? <div className="inline-error shipment-message">{message}</div> : null}
            <ShipmentEditor
              mode={formMode}
              form={form}
              row={activeRow}
              titleId="shipment-detail-title"
              canViewAll={canViewAll}
              saving={saving}
              onChange={setField}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={requestDeleteConfirmation}
              onClose={closeForm}
            />
          </div>
          {deleteConfirmOpen ? (
            <DeleteConfirmationDialog
              row={activeRow}
              saving={saving}
              message={message}
              onCancel={cancelDeleteConfirmation}
              onConfirm={handleDelete}
            />
          ) : null}
        </div>
      ) : null}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {canCrud ? <th>Actions</th> : null}
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
                {canCrud ? (
                  <td>
                    <button
                      className="btn-sm"
                      type="button"
                      onClick={() => openDetail(row)}
                      aria-label={`View ${row.bookingNo || row.recordId || "shipment"}`}
                    >
                      View
                    </button>
                  </td>
                ) : null}
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
              {canCrud ? <td /> : null}
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

function DeleteConfirmationDialog({ row, saving, message, onCancel, onConfirm }) {
  const title = `Delete shipment ${row?.bookingNo || row?.recordId}?`;
  return (
    <div className="shipment-confirm">
      <div className="shipment-confirm-backdrop" aria-hidden="true" />
      <div
        className="shipment-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-confirm-title"
      >
        <div className="top-title" id="shipment-confirm-title">{title}</div>
        <p className="shipment-confirm-copy">
          This action will remove the shipment from the active list.
        </p>
        {message ? <div className="inline-error shipment-confirm-message">{message}</div> : null}
        <div className="shipment-confirm-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={saving}>
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ShipmentEditor({
  mode,
  form,
  row,
  titleId,
  canViewAll,
  saving,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}) {
  const isCreate = mode === "create";
  return (
    <section className="shipment-editor" aria-label="Shipment editor">
      <div className="admin-head">
        <div>
          <div className="top-title" id={titleId}>{isCreate ? "Add Shipment" : `Shipment Detail: ${row?.bookingNo || row?.recordId}`}</div>
          <div className="chart-sub">{isCreate ? "Create a record owned by the current session" : "Review and update shipment fields"}</div>
        </div>
        <button className="btn" type="button" onClick={onClose}>Close</button>
      </div>
      <form className="shipment-form" onSubmit={isCreate ? onCreate : onUpdate}>
        <ShipmentInput label="Date" value={form.date} onChange={(value) => onChange("date", value)} type="date" />
        <ShipmentInput label="Booking No" value={form.bookingNo} onChange={(value) => onChange("bookingNo", value)} />
        <ShipmentInput label="Job No" value={form.jobNo} onChange={(value) => onChange("jobNo", value)} />
        <ShipmentInput label="Shipper" value={form.shipper} onChange={(value) => onChange("shipper", value)} />
        <ShipmentInput label="Port" value={form.port} onChange={(value) => onChange("port", value)} />
        <ShipmentInput label="Country" value={form.country} onChange={(value) => onChange("country", value)} />
        <ShipmentInput label="Trade" value={form.trade} onChange={(value) => onChange("trade", value)} />
        <ShipmentInput label="Carrier" value={form.carrier} onChange={(value) => onChange("carrier", value)} />
        <ShipmentInput label="Sale Name" value={form.saleName} onChange={(value) => onChange("saleName", value)} />
        <ShipmentInput label="Qty" value={form.qty} onChange={(value) => onChange("qty", value)} type="number" />
        <ShipmentInput label="Unit" value={form.unit} onChange={(value) => onChange("unit", value)} />
        <ShipmentInput label="TEU" value={form.teu} onChange={(value) => onChange("teu", value)} type="number" />
        <label className="form-group">
          <span className="form-label">Status</span>
          <select className="form-select" value={form.status} onChange={(event) => onChange("status", event.target.value)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        {canViewAll ? (
          <>
            <ShipmentInput label="Owner user id" value={form.ownerUserId} onChange={(value) => onChange("ownerUserId", value)} />
            <ShipmentInput label="Owner username" value={form.ownerUsername} onChange={(value) => onChange("ownerUsername", value)} />
          </>
        ) : null}
        <div className="shipment-form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || (!isCreate && !row?.recordId)}>
            {isCreate ? "Create Shipment" : "Save Changes"}
          </button>
          {!isCreate ? (
            <button className="btn btn-danger" type="button" disabled={saving || !row?.recordId} onClick={onDelete}>
              Delete Shipment
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ShipmentInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="form-group">
      <span className="form-label">{label}</span>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function rowToForm(row) {
  return {
    date: row.date ? formatDate(row.date) : "",
    bookingNo: row.bookingNo || "",
    jobNo: row.jobNo || "",
    shipper: row.shipper || "",
    port: row.port || "",
    country: row.country || "",
    trade: row.trade || "",
    carrier: row.carrier || "",
    saleName: row.saleName || "",
    qty: row.qty ?? "",
    unit: row.unit || "",
    teu: row.teu ?? "",
    status: row.status || "Booked",
    ownerUserId: row.ownerUserId || "",
    ownerUsername: row.ownerUsername || "",
  };
}

function normalizePayload(form, includeOwner) {
  const payload = {
    ...form,
    qty: Number(form.qty) || 0,
    teu: Number(form.teu) || 0,
  };
  if (!includeOwner) {
    delete payload.ownerUserId;
    delete payload.ownerUsername;
  }
  return payload;
}
