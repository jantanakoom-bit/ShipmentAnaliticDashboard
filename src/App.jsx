import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildFilterOptions } from "./lib/dashboard";
import { apiRequest } from "./lib/api";
import { loadWorkbookData, loadWorkbookFile } from "./lib/loadWorkbook";

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#dc2626",
  "#d97706",
  "#0891b2",
  "#be185d",
  "#65a30d",
  "#9333ea",
  "#0d9488",
  "#ea580c",
  "#1d4ed8",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FILTER_KEYS = ["port", "country", "trade", "carrier", "sales"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;
}

function getSelectionSummary(selected, total) {
  if (total === 0) {
    return "No options";
  }
  if (selected.length === total) {
    return "All selected";
  }
  if (selected.length === 0) {
    return "None selected";
  }
  return `${selected.length} of ${total}`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`));
}

function topGroup(rows, key, limit = 10) {
  const map = new Map();

  for (const row of rows) {
    const label = row[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + row.teu);
  }

  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function getUnitBreakdown(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.unit.startsWith("20")) {
        acc.unit20 += row.qty;
      } else if (row.unit.startsWith("40")) {
        acc.unit40 += row.qty;
      }
      return acc;
    },
    { unit20: 0, unit40: 0 },
  );
}

function buildMonthlySeries(rows) {
  const years = uniqueSorted(rows.map((row) => row.year));
  const series = MONTH_LABELS.map((month, index) => {
    const item = { month };
    for (const year of years) {
      item[year] = 0;
    }
    for (const row of rows) {
      if (row.monthNumber === index + 1 && row.year) {
        item[row.year] += row.teu;
      }
    }
    return item;
  });

  return { years, series };
}

function getDateRange(rows) {
  const timestamps = rows
    .map((row) => row.date?.getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!timestamps.length) {
    return "No active data range";
  }

  return `${formatDate(new Date(timestamps[0]))} -> ${formatDate(new Date(timestamps[timestamps.length - 1]))}`;
}

function getCounts(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function filterByDate(rows, dateFilters) {
  const anyYear = dateFilters.years.length === 0;
  const anyQuarter = dateFilters.quarters.length === 0;
  const anyMonth = dateFilters.months.length === 0;

  return rows.filter((row) => {
    if (!anyYear && !dateFilters.years.includes(String(row.year))) {
      return false;
    }
    if (!anyQuarter && !dateFilters.quarters.includes(row.quarter)) {
      return false;
    }
    if (!anyMonth && !dateFilters.months.includes(String(row.monthNumber))) {
      return false;
    }
    return true;
  });
}

function getFilterValue(row, key) {
  if (key === "port") {
    return row.port;
  }
  if (key === "country") {
    return row.country;
  }
  if (key === "trade") {
    return row.trade;
  }
  if (key === "carrier") {
    return row.carrier;
  }
  return row.saleName;
}

function filterByMultiSelect(rows, selected) {
  return rows.filter((row) => {
    for (const key of FILTER_KEYS) {
      if (selected[key].length && !selected[key].includes(getFilterValue(row, key))) {
        return false;
      }
      if (!selected[key].length) {
        return false;
      }
    }
    return true;
  });
}

function getAvailableValues(rows, selected, targetKey) {
  const available = new Set();

  rows
    .filter((row) => {
      for (const key of FILTER_KEYS) {
        if (key === targetKey) {
          continue;
        }
        if (selected[key].length && !selected[key].includes(getFilterValue(row, key))) {
          return false;
        }
        if (!selected[key].length) {
          return false;
        }
      }
      return true;
    })
    .forEach((row) => {
      const value = getFilterValue(row, targetKey);
      if (value) {
        available.add(value);
      }
    });

  return available;
}

function buildSaleCards(rows) {
  const saleTop = topGroup(rows, "saleName", 30);
  const stats = new Map();

  for (const row of rows) {
    if (!stats.has(row.saleName)) {
      stats.set(row.saleName, {
        unit20: 0,
        unit40: 0,
        bookings: new Set(),
        shippers: new Set(),
      });
    }
    const item = stats.get(row.saleName);
    if (row.unit.startsWith("20")) {
      item.unit20 += row.qty;
    } else if (row.unit.startsWith("40")) {
      item.unit40 += row.qty;
    }
    if (row.bookingNo) {
      item.bookings.add(row.bookingNo);
    }
    if (row.shipper) {
      item.shippers.add(row.shipper);
    }
  }

  const max = saleTop[0]?.value || 1;

  return saleTop.map((item, index) => {
    const stat = stats.get(item.name) || {
      unit20: 0,
      unit40: 0,
      bookings: new Set(),
      shippers: new Set(),
    };

    return {
      rank: index + 1,
      name: item.name,
      teu: item.value,
      unit20: stat.unit20,
      unit40: stat.unit40,
      totalUnits: stat.unit20 + stat.unit40,
      bookings: stat.bookings.size,
      shippers: stat.shippers.size,
      pct: (item.value / max) * 100,
    };
  });
}

function LoginScreen({ error, loading, onSubmit }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ username, password });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">
          <div className="brand-icon">ST</div>
          <div>
            <div className="brand-name">ShipTrack</div>
            <div className="brand-sub">Logistics Intelligence</div>
          </div>
        </div>
        <h1 className="auth-title">Access dashboard</h1>
        <p className="auth-copy">Sign in to review shipment movement and logistics analytics.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Username</span>
            <input className="auth-input" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input className="auth-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminUsers({ onClose }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "user" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/users");
      setUsers(data.users || []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ username: "", displayName: "", password: "", role: "user" });
      await loadUsers();
      setMessage("User created.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function patchUser(user, patch) {
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
      setMessage("User updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`New password for ${user.username}`);
    if (!password) return;
    await patchUser(user, { password });
  }

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <div>
          <div className="top-title">Admin Users</div>
          <div className="chart-sub">Manage Google Sheet users and access status.</div>
        </div>
        <button className="btn-filter btn-all" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="admin-form" onSubmit={handleCreate}>
        <input className="auth-input" placeholder="Username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
        <input className="auth-input" placeholder="Display name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
        <input className="auth-input" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        <select className="auth-input" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button className="primary-button" type="submit">
          Add user
        </button>
      </form>

      {message ? <div className="inline-error admin-message">{message}</div> : null}
      {loading ? <div className="status-state admin-state">Loading users...</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Display name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.displayName || "-"}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>{user.lastLoginAt || "-"}</td>
                <td>
                  <div className="admin-actions">
                    <button className="ms-btn-sa" type="button" onClick={() => patchUser(user, { role: user.role === "admin" ? "user" : "admin" })}>
                      Role
                    </button>
                    <button className="ms-btn-sa" type="button" onClick={() => resetPassword(user)}>
                      Reset
                    </button>
                    <button className="ms-btn-cl" type="button" onClick={() => patchUser(user, { status: user.status === "active" ? "disabled" : "active" })}>
                      {user.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChipMultiSelect({ options, selected, onToggle, onSelectAll, onClearAll }) {
  return (
    <>
      <div className="chip-actions">
        <button className="ms-btn-sa" type="button" onClick={onSelectAll}>
          All
        </button>
        <button className="ms-btn-cl" type="button" onClick={onClearAll}>
          Clear
        </button>
      </div>
      <div className="date-chip-group">
        {options.map((option) => (
          <button
            key={option.value}
            className={`date-chip ${selected.includes(option.value) ? "date-chip-active" : ""}`}
            type="button"
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function SearchableMultiSelect({
  label,
  items,
  available,
  selected,
  search,
  onSearch,
  onToggle,
  onSelectAll,
  onClearAll,
}) {
  return (
    <div className="filter-section">
      <div className="filter-label">
        {label}
        <span className="filter-actions-inline">
          <button className="ms-btn-sa" type="button" onClick={onSelectAll}>
            All
          </button>
          <button className="ms-btn-cl" type="button" onClick={onClearAll}>
            Clear
          </button>
        </span>
      </div>
      <div className="multi-select-wrap">
        <input
          className="multi-select-search"
          placeholder={`Search ${label.toLowerCase()}...`}
          type="text"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <div className="multi-select-list">
          {items
            .filter((item) => item.value.toLowerCase().includes(search.toLowerCase()))
            .map((item) => {
              const isActive = available.has(item.value);
              const isChecked = selected.includes(item.value);

              return (
                <label className="ms-item" key={item.value} style={{ opacity: isActive ? 1 : 0.35 }}>
                  <input type="checkbox" checked={isChecked} onChange={(event) => onToggle(item.value, event.target.checked)} />
                  <span className="ms-text" title={item.value}>
                    {item.value}
                  </span>
                  <span className="ms-item-count">{isActive ? item.count : "-"}</span>
                </label>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="kpi-card" style={{ "--kpi-color": color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function DetailKpi({ label, value, sub, tone }) {
  return (
    <div className="detail-kpi">
      <div className="lbl">{label}</div>
      <div className="val" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function InsightTile({ label, value, sub }) {
  return (
    <div className="insight-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function ChartCard({ title, sub, wide = false, children }) {
  return (
    <div className={`chart-card ${wide ? "chart-wide" : ""}`}>
      <div className="chart-title">{title}</div>
      <div className="chart-sub">{sub}</div>
      <div className="chart-wrap">{children}</div>
    </div>
  );
}

function TopListCard({ title, items, color }) {
  const max = items[0]?.value || 1;
  return (
    <div className="top-card">
      <div className="top-title">{title}</div>
      {items.map((item, index) => (
        <div className="top-row" key={item.name}>
          <div className={`top-rank ${index < 3 ? `r${index + 1}` : ""}`}>{index + 1}</div>
          <span className="top-name">{item.name}</span>
          <div className="top-bar-wrap">
            <div className="top-bar" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
          <span className="top-val">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    metadata: null,
    detailData: [],
    filterOptions: { years: [], quarters: [], months: [] },
    counts: { port: [], country: [], trade: [], carrier: [], sales: [] },
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dateFilters, setDateFilters] = useState({ years: [], quarters: [], months: [] });
  const [selected, setSelected] = useState({ port: [], country: [], trade: [], carrier: [], sales: [] });
  const [searches, setSearches] = useState({ port: "", country: "", trade: "", carrier: "", sales: "" });
  const [tableSearch, setTableSearch] = useState("");
  const [sortState, setSortState] = useState({ key: "date", direction: "asc" });

  useEffect(() => {
    let mounted = true;

    apiRequest("/api/auth/session")
      .then((data) => {
        if (!mounted) {
          return;
        }
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setCurrentUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    loadWorkbookData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        initializeFromData(data);
      })
      .catch((error) => {
        if (mounted) {
          setState({
            loading: false,
            error: error.message || "Unable to load workbook",
            metadata: null,
            detailData: [],
            filterOptions: { years: [], quarters: [], months: [] },
            counts: { port: [], country: [], trade: [], carrier: [], sales: [] },
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  function initializeFromData(data) {
    const filterOptions = buildFilterOptions(data.detailData);
    const monthSelection = [...new Set(data.detailData.map((row) => String(row.monthNumber)).filter(Boolean))].sort();
    const counts = {
      port: getCounts(data.detailData, "port"),
      country: getCounts(data.detailData, "country"),
      trade: getCounts(data.detailData, "trade"),
      carrier: getCounts(data.detailData, "carrier"),
      sales: getCounts(data.detailData, "saleName"),
    };

    setState({
      loading: false,
      error: "",
      metadata: data.metadata,
      detailData: data.detailData,
      filterOptions,
      counts,
    });
    setDateFilters({
      years: filterOptions.years.map(String),
      quarters: filterOptions.quarters,
      months: monthSelection,
    });
    setSelected({
      port: counts.port.map((item) => item.value),
      country: counts.country.map((item) => item.value),
      trade: counts.trade.map((item) => item.value),
      carrier: counts.carrier.map((item) => item.value),
      sales: counts.sales.map((item) => item.value),
    });
    setSearches({ port: "", country: "", trade: "", carrier: "", sales: "" });
    setTableSearch("");
  }

  async function handleFileImport(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      const data = await loadWorkbookFile(file);
      initializeFromData(data);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error.message || "Unable to read the selected file",
      }));
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  async function handleLogin({ username, password }) {
    setLoginLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setAuthError("");
    } catch (error) {
      setAuthError(error.message || "Invalid username or password");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear the local state even if the server session is already gone.
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowAdmin(false);
    setAuthError("");
  }

  function toggleDateFilter(type, value) {
    setDateFilters((current) => ({
      ...current,
      [type]: current[type].includes(value) ? current[type].filter((item) => item !== value) : [...current[type], value],
    }));
  }

  function setAllDate(type, values) {
    setDateFilters((current) => ({ ...current, [type]: values }));
  }

  function toggleSelect(key, value, checked) {
    setSelected((current) => ({
      ...current,
      [key]: checked ? [...current[key], value] : current[key].filter((item) => item !== value),
    }));
  }

  const overviewRows = useMemo(() => {
    if (!dateFilters.years.length) {
      return state.detailData;
    }
    return state.detailData.filter((row) => dateFilters.years.includes(String(row.year)));
  }, [dateFilters.years, state.detailData]);

  const dateFilteredRows = useMemo(() => filterByDate(state.detailData, dateFilters), [dateFilters, state.detailData]);
  const filteredRows = useMemo(() => filterByMultiSelect(dateFilteredRows, selected), [dateFilteredRows, selected]);

  const availableValues = useMemo(() => {
    return {
      port: getAvailableValues(dateFilteredRows, selected, "port"),
      country: getAvailableValues(dateFilteredRows, selected, "country"),
      trade: getAvailableValues(dateFilteredRows, selected, "trade"),
      carrier: getAvailableValues(dateFilteredRows, selected, "carrier"),
      sales: getAvailableValues(dateFilteredRows, selected, "sales"),
    };
  }, [dateFilteredRows, selected]);

  const overviewUnit = useMemo(() => getUnitBreakdown(overviewRows), [overviewRows]);
  const detailUnit = useMemo(() => getUnitBreakdown(filteredRows), [filteredRows]);
  const overviewMonthly = useMemo(() => buildMonthlySeries(overviewRows), [overviewRows]);
  const filteredMonthly = useMemo(() => buildMonthlySeries(filteredRows), [filteredRows]);
  const topPort = useMemo(() => topGroup(filteredRows, "port", 10), [filteredRows]);
  const topCarrier = useMemo(() => topGroup(filteredRows, "carrier", 10), [filteredRows]);
  const topCountry = useMemo(() => topGroup(filteredRows, "country", 10), [filteredRows]);
  const topTrade = useMemo(() => topGroup(filteredRows, "trade", 12), [filteredRows]);
  const topSales = useMemo(() => topGroup(filteredRows, "saleName", 15), [filteredRows]);
  const saleCards = useMemo(() => buildSaleCards(filteredRows), [filteredRows]);

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

  if (authLoading) {
    return <main className="shell-centered"><div className="status-state">Checking session...</div></main>;
  }

  if (!isAuthenticated) {
    return <LoginScreen error={authError} loading={loginLoading} onSubmit={handleLogin} />;
  }

  if (state.loading) {
    return <main className="shell-centered"><div className="status-state">Loading workbook data...</div></main>;
  }

  if (state.error && !state.metadata) {
    return <main className="shell-centered"><div className="status-state">{state.error}</div></main>;
  }

  const quarterOptions = state.filterOptions.quarters.map((item) => ({ label: item, value: item }));
  const monthOptions = [...new Set(state.detailData.map((row) => row.monthNumber))]
    .sort((a, b) => a - b)
    .map((monthNumber) => ({ label: MONTH_LABELS[monthNumber - 1], value: String(monthNumber) }));
  const yearOptions = state.filterOptions.years.map((item) => ({ label: `${item}`, value: `${item}` }));
  const totalQty = filteredRows.reduce((sum, row) => sum + row.qty, 0);
  const totalTeu = filteredRows.reduce((sum, row) => sum + row.teu, 0);
  const uniqueBookings = new Set(filteredRows.map((row) => row.bookingNo).filter(Boolean)).size;
  const activeCarriers = new Set(filteredRows.map((row) => row.carrier).filter(Boolean)).size;
  const topCarrierName = topCarrier[0]?.name || "N/A";
  const topCountryName = topCountry[0]?.name || "N/A";

  return (
    <>
      <div id="loading-overlay" className={isImporting ? "show" : ""}>
        <div className="spinner" />
        <span className="loading-label">Loading data...</span>
      </div>

      <div className="app-shell">
        <aside id="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <div className="brand-icon">ST</div>
              <div>
                <div className="brand-name">ShipTrack</div>
                <div className="brand-sub">Logistics Intelligence</div>
              </div>
            </div>

            <div className="upload-meta">
              <div className="upload-meta-title">Data Embedded</div>
              <div className="upload-meta-sub">{formatNumber(state.metadata?.shipments || 0)} shipment records</div>
            </div>

            <label className="file-import">
              <span>Import workbook</span>
              <input accept=".xlsx,.xls" type="file" onChange={handleFileImport} />
            </label>
          </div>

          <div className="filters-scroll">
            <div className="filter-summary-card">
              <div>
                <span>Current view</span>
                <strong>{formatNumber(filteredRows.length)} rows</strong>
              </div>
              <div>
                <span>TEU</span>
                <strong>{formatNumber(totalTeu)}</strong>
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-label">Quarter</div>
              <ChipMultiSelect
                options={quarterOptions}
                selected={dateFilters.quarters}
                onToggle={(value) => toggleDateFilter("quarters", value)}
                onSelectAll={() => setAllDate("quarters", quarterOptions.map((item) => item.value))}
                onClearAll={() => setAllDate("quarters", [])}
              />
            </div>

            <div className="filter-section">
              <div className="filter-label">Month</div>
              <ChipMultiSelect
                options={monthOptions}
                selected={dateFilters.months}
                onToggle={(value) => toggleDateFilter("months", value)}
                onSelectAll={() => setAllDate("months", monthOptions.map((item) => item.value))}
                onClearAll={() => setAllDate("months", [])}
              />
            </div>

            <div className="filter-section">
              <div className="filter-label">Year</div>
              <ChipMultiSelect
                options={yearOptions}
                selected={dateFilters.years}
                onToggle={(value) => toggleDateFilter("years", value)}
                onSelectAll={() => setAllDate("years", yearOptions.map((item) => item.value))}
                onClearAll={() => setAllDate("years", [])}
              />
            </div>

            <SearchableMultiSelect
              label="Port"
              items={state.counts.port}
              available={availableValues.port}
              selected={selected.port}
              search={searches.port}
              onSearch={(value) => setSearches((current) => ({ ...current, port: value }))}
              onToggle={(value, checked) => toggleSelect("port", value, checked)}
              onSelectAll={() => setSelected((current) => ({ ...current, port: state.counts.port.map((item) => item.value) }))}
              onClearAll={() => setSelected((current) => ({ ...current, port: [] }))}
            />

            <div className="filter-footnote">
              Port {getSelectionSummary(selected.port, state.counts.port.length)} · Country{" "}
              {getSelectionSummary(selected.country, state.counts.country.length)}
            </div>

            <SearchableMultiSelect
              label="Country"
              items={state.counts.country}
              available={availableValues.country}
              selected={selected.country}
              search={searches.country}
              onSearch={(value) => setSearches((current) => ({ ...current, country: value }))}
              onToggle={(value, checked) => toggleSelect("country", value, checked)}
              onSelectAll={() => setSelected((current) => ({ ...current, country: state.counts.country.map((item) => item.value) }))}
              onClearAll={() => setSelected((current) => ({ ...current, country: [] }))}
            />

            <SearchableMultiSelect
              label="Trade"
              items={state.counts.trade}
              available={availableValues.trade}
              selected={selected.trade}
              search={searches.trade}
              onSearch={(value) => setSearches((current) => ({ ...current, trade: value }))}
              onToggle={(value, checked) => toggleSelect("trade", value, checked)}
              onSelectAll={() => setSelected((current) => ({ ...current, trade: state.counts.trade.map((item) => item.value) }))}
              onClearAll={() => setSelected((current) => ({ ...current, trade: [] }))}
            />

            <SearchableMultiSelect
              label="Carrier"
              items={state.counts.carrier}
              available={availableValues.carrier}
              selected={selected.carrier}
              search={searches.carrier}
              onSearch={(value) => setSearches((current) => ({ ...current, carrier: value }))}
              onToggle={(value, checked) => toggleSelect("carrier", value, checked)}
              onSelectAll={() => setSelected((current) => ({ ...current, carrier: state.counts.carrier.map((item) => item.value) }))}
              onClearAll={() => setSelected((current) => ({ ...current, carrier: [] }))}
            />

            <SearchableMultiSelect
              label="Sale Name"
              items={state.counts.sales}
              available={availableValues.sales}
              selected={selected.sales}
              search={searches.sales}
              onSearch={(value) => setSearches((current) => ({ ...current, sales: value }))}
              onToggle={(value, checked) => toggleSelect("sales", value, checked)}
              onSelectAll={() => setSelected((current) => ({ ...current, sales: state.counts.sales.map((item) => item.value) }))}
              onClearAll={() => setSelected((current) => ({ ...current, sales: [] }))}
            />

            <div className="filter-actions">
              <button
                className="btn-filter btn-all"
                type="button"
                onClick={() => initializeFromData({ detailData: state.detailData, metadata: state.metadata })}
              >
                Select All
              </button>
              <button className="btn-filter btn-reset" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main id="main">
          <div id="topbar">
            <div>
              <div className="page-title">Shipment Analytics Dashboard</div>
              <div className="page-sub">{getDateRange(filteredRows)}</div>
            </div>
            <div id="record-count" className="active-badge">
              {formatNumber(filteredRows.length)} records
            </div>
          </div>

          <div id="content">
            {state.error ? <div className="inline-error">{state.error}</div> : null}

            <section className="hero-panel">
              <div>
                <p className="eyebrow">Operations snapshot</p>
                <h1>Container volume, carrier concentration, and sales contribution in one controlled view.</h1>
                <p>
                  Filters on the left drive every chart and table below. Use this page as a working review surface for
                  monthly TEU movement and customer-facing shipment detail.
                </p>
              </div>
              <div className="insight-grid">
                <InsightTile label="Top carrier" value={topCarrierName} sub={`${formatNumber(topCarrier[0]?.value || 0)} TEU`} />
                <InsightTile label="Top country" value={topCountryName} sub={`${formatNumber(topCountry[0]?.value || 0)} TEU`} />
                <InsightTile label="Bookings" value={formatNumber(uniqueBookings)} sub="Unique booking no." />
                <InsightTile label="Carriers" value={formatNumber(activeCarriers)} sub="Active in selection" />
              </div>
            </section>

            <div className="section-title">
              Overview KPIs <span className="section-title-note">(full year - based on year filter only)</span>
            </div>
            <div className="kpi-grid">
              <KpiCard label="Total Containers" value={formatNumber(overviewRows.reduce((sum, row) => sum + row.qty, 0))} sub="Full-year quantity" color="#0f766e" />
              <KpiCard label="20' Containers" value={formatNumber(overviewUnit.unit20)} sub="20DC, 20RF, 20FR..." color="#2563eb" />
              <KpiCard label="40' Containers" value={formatNumber(overviewUnit.unit40)} sub="40HC, 40DC, 40RF..." color="#059669" />
              <KpiCard label="Total TEU" value={formatNumber(overviewRows.reduce((sum, row) => sum + row.teu, 0))} sub="Twenty-Foot Equivalent Units" color="#334155" />
            </div>

            <ChartCard title="Monthly TEU Trend" sub="Jan - Dec (fixed axis)" wide>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overviewMonthly.series}>
                  <CartesianGrid stroke="#e2e6f0" />
                  <Legend />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  {overviewMonthly.years.map((year, index) => (
                    <Line
                      key={year}
                      type="monotone"
                      dataKey={String(year)}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="section-title">
              Detailed Analysis <span className="section-title-note">(all filters applied)</span>
            </div>
            <div className="detail-kpi-grid">
              <DetailKpi label="Containers" value={formatNumber(totalQty)} sub="Total Qty" />
              <DetailKpi label="20' Units" value={formatNumber(detailUnit.unit20)} sub="TEU Factor x1" tone="#2563eb" />
              <DetailKpi label="40' Units" value={formatNumber(detailUnit.unit40)} sub="TEU Factor x2" tone="#059669" />
              <DetailKpi label="TEU" value={formatNumber(totalTeu)} sub="Total TEU" tone="#0f766e" />
              <DetailKpi label="Bookings" value={formatNumber(uniqueBookings)} sub="Unique Booking No" />
              <DetailKpi label="Jobs" value={formatNumber(new Set(filteredRows.map((row) => row.jobNo)).size)} sub="Unique Job No" />
            </div>

            <ChartCard title="Monthly TEU Trend (filtered)" sub="Jan - Dec - responds to all filters" wide>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={filteredMonthly.series}>
                  <CartesianGrid stroke="#e2e6f0" />
                  <Legend />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  {filteredMonthly.years.map((year, index) => (
                    <Line
                      key={year}
                      type="monotone"
                      dataKey={String(year)}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="charts-grid">
              <ChartCard title="TEU by Carrier" sub="Top carriers by TEU">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topCarrier} layout="vertical">
                    <CartesianGrid stroke="#e2e6f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {topCarrier.map((item, index) => (
                        <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="TEU by Country" sub="Top destination countries">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topCountry} layout="vertical">
                    <CartesianGrid stroke="#e2e6f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {topCountry.map((item, index) => (
                        <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="TEU by Trade Route" sub="Top trade routes by volume">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topTrade}>
                    <CartesianGrid stroke="#e2e6f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Volume by Sale Name" sub="TEU contribution per salesperson">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topSales}>
                    <CartesianGrid stroke="#e2e6f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="section-title">Top 10 Rankings</div>
            <div className="tops-grid">
              <TopListCard title="Top 10 Ports by TEU" items={topPort} color="#2563eb" />
              <TopListCard title="Top 10 Carriers by TEU" items={topCarrier} color="#7c3aed" />
              <TopListCard title="Top 10 Countries by TEU" items={topCountry} color="#059669" />
              <TopListCard title="Top 10 Trade Routes by TEU" items={topTrade.slice(0, 10)} color="#d97706" />

              <div className="top-card top-card-wide">
                <div className="top-title">Volume by Sale Name</div>
                <div className="sale-chart-wrap">
                  {saleCards.map((item) => (
                    <div className="sale-card" key={item.name}>
                      <div className="sale-card-head">
                        <span className="sale-name">{item.name}</span>
                        <span className="sale-rank">#{item.rank}</span>
                      </div>
                      <div className="sale-row">
                        <span className="sale-label sale-label-purple">TEU</span>
                        <span className="sale-value">{formatNumber(item.teu)}</span>
                      </div>
                      <div className="sale-row">
                        <span className="sale-label sale-label-blue">Container</span>
                        <span className="sale-badges">
                          <span className="unit-badge unit-20">20': {formatNumber(item.unit20)}</span>
                          <span className="unit-badge unit-40">40': {formatNumber(item.unit40)}</span>
                          <span className="sale-value">{formatNumber(item.totalUnits)}</span>
                        </span>
                      </div>
                      <div className="sale-row">
                        <span className="sale-label sale-label-green">Bookings</span>
                        <span className="sale-value">{formatNumber(item.bookings)}</span>
                      </div>
                      <div className="sale-row">
                        <span className="sale-label sale-label-orange">Shippers</span>
                        <span className="sale-value">{formatNumber(item.shippers)}</span>
                      </div>
                      <div className="sale-progress">
                        <div className="sale-progress-bar" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
          </div>
        </main>
      </div>
    </>
  );
}
