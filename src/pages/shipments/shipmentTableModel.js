import { formatDate } from "../../lib/utils";

export const SHIPMENT_COLUMNS = [
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

export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
export const STATUS_OPTIONS = ["Booked", "Pending", "Loaded", "In Transit", "Completed", "Cancelled", "Unspecified"];

export const EMPTY_SHIPMENT_FORM = {
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

export function buildShipmentTableModel({
  rows,
  canViewAll,
  ownerFilter,
  tableSearch,
  sortState,
  currentPage,
  rowsPerPage,
  visibleColumns,
}) {
  const ownerOptions = buildOwnerOptions(rows);
  const ownerFilteredRows = filterRowsByOwner(rows, canViewAll, ownerFilter);
  const searchedRows = searchRows(ownerFilteredRows, tableSearch);
  const sortedRows = sortRows(searchedRows, sortState);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const pageEnd = Math.min(pageStart + rowsPerPage, sortedRows.length);
  const pageRows = sortedRows.slice(pageStart, pageEnd);
  const totals = totalRows(searchedRows);
  const visibleColumnList = SHIPMENT_COLUMNS.filter((col) => visibleColumns.has(col.key));

  return {
    ownerOptions,
    ownerFilteredRows,
    searchedRows,
    sortedRows,
    totalPages,
    safePage,
    pageStart,
    pageEnd,
    pageRows,
    totals,
    visibleColumnList,
    visibleColSpan: visibleColumnList.length,
  };
}

export function buildShipmentCsv(rows, visibleColumns) {
  const visibleCols = SHIPMENT_COLUMNS.filter((col) => visibleColumns.has(col.key));
  const header = visibleCols.map((col) => col.label).join(",");
  const csvRows = rows.map((row) =>
    visibleCols
      .map((col) => escapeCsvValue(col.key === "date" ? formatDate(row.date) : row[col.key] ?? ""))
      .join(","),
  );
  return [header, ...csvRows].join("\n");
}

export function rowToShipmentForm(row) {
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

export function normalizeShipmentPayload(form, includeOwner) {
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

export function nextSortState(current, key) {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "date" ? "asc" : "desc" };
}

function buildOwnerOptions(rows) {
  return [...new Set(rows.map((row) => row.ownerUsername || row.saleName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function filterRowsByOwner(rows, canViewAll, ownerFilter) {
  if (!canViewAll || ownerFilter === "All") {
    return rows;
  }
  return rows.filter((row) => (row.ownerUsername || row.saleName) === ownerFilter);
}

function searchRows(rows, tableSearch) {
  const search = tableSearch.trim().toLowerCase();
  if (!search) {
    return rows;
  }
  return rows.filter((row) =>
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
}

function sortRows(rows, sortState) {
  return [...rows].sort((left, right) => {
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
}

function totalRows(rows) {
  let qty = 0;
  let teu = 0;
  for (const row of rows) {
    qty += row.qty;
    teu += row.teu;
  }
  return { qty, teu };
}

function escapeCsvValue(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
