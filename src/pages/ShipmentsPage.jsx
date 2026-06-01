import { useMemo, useState, useRef, useCallback } from "react";
import { apiRequest } from "../lib/api";
import { formatNumber, formatDate } from "../lib/utils";
import DeleteConfirmationDialog from "./shipments/DeleteConfirmationDialog";
import ShipmentEditor from "./shipments/ShipmentEditor";
import {
  buildShipmentCsv,
  buildShipmentTableModel,
  EMPTY_SHIPMENT_FORM,
  normalizeShipmentPayload,
  nextSortState,
  ROWS_PER_PAGE_OPTIONS,
  rowToShipmentForm,
  SHIPMENT_COLUMNS,
} from "./shipments/shipmentTableModel";

export default function ShipmentsPage({ filteredRows, currentUser, onDataRefresh }) {
  const [tableSearch, setTableSearch] = useState("");
  const [sortState, setSortState] = useState({ key: "date", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(SHIPMENT_COLUMNS.map((col) => col.key)),
  );
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [formMode, setFormMode] = useState("");
  const [activeRow, setActiveRow] = useState(null);
  const [form, setForm] = useState(EMPTY_SHIPMENT_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const colToggleRef = useRef(null);
  const canCrud = Boolean(currentUser?.role);
  const canViewAll = currentUser?.role === "admin" || currentUser?.role === "moderator";

  const tableModel = useMemo(() => buildShipmentTableModel({
    rows: filteredRows,
    canViewAll,
    ownerFilter,
    tableSearch,
    sortState,
    currentPage,
    rowsPerPage,
    visibleColumns,
  }), [canViewAll, currentPage, filteredRows, ownerFilter, rowsPerPage, sortState, tableSearch, visibleColumns]);

  const {
    ownerOptions,
    searchedRows,
    sortedRows,
    totalPages,
    safePage,
    pageStart,
    pageEnd,
    pageRows,
    totals,
    visibleColumnList,
    visibleColSpan,
  } = tableModel;

  function toggleSort(key) {
    setSortState((current) => nextSortState(current, key));
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
    setForm(EMPTY_SHIPMENT_FORM);
    setActiveRow(null);
    setFormMode("create");
    setDeleteConfirmOpen(false);
    setMessage("");
  }

  function openDetail(row) {
    setActiveRow(row);
    setForm(rowToShipmentForm(row));
    setFormMode("detail");
    setDeleteConfirmOpen(false);
    setMessage("");
  }

  function closeForm() {
    setFormMode("");
    setActiveRow(null);
    setForm(EMPTY_SHIPMENT_FORM);
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
        body: JSON.stringify(normalizeShipmentPayload(form, canViewAll)),
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
        body: JSON.stringify(normalizeShipmentPayload(form, canViewAll)),
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
    const csv = buildShipmentCsv(sortedRows, visibleColumns);
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
    return buildPageNumbers(totalPages, safePage);
  }, [totalPages, safePage]);

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
                {SHIPMENT_COLUMNS.map((col) => (
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
        <table className="shipment-detail-table">
          <colgroup>
            {canCrud ? <col className="shipment-col-actions" /> : null}
            {visibleColumnList.map((col) => (
              <col className={`shipment-col-${col.key}`} key={col.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {canCrud ? <th>Actions</th> : null}
              {visibleColumnList.map((col) => (
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

function buildPageNumbers(totalPages, safePage) {
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
}
