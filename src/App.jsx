import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation, Navigate, Link } from "react-router-dom";
import { buildFilterOptions } from "./lib/dashboard";
import { apiRequest } from "./lib/api";
import { loadWorkbookData } from "./lib/loadWorkbook";
import { MONTH_LABELS } from "./lib/constants";
import {
  formatNumber,
  getCounts,
  filterByDate,
  filterByMultiSelect,
  getAvailableValues,
  getUnitBreakdown,
  buildMonthlySeries,
  topGroup,
  buildSaleCards,
  getDateRange,
} from "./lib/utils";

import LoginScreen from "./components/LoginScreen";
import AiChatDrawer from "./components/AiChatDrawer";
import NavSidebar from "./components/NavSidebar";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

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

  const [dateFilters, setDateFilters] = useState({ years: [], quarters: [], months: [] });
  const [selected, setSelected] = useState({ port: [], country: [], trade: [], carrier: [], sales: [] });
  const [searches, setSearches] = useState({ port: "", country: "", trade: "", carrier: "", sales: "" });

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

  const totalQty = filteredRows.reduce((sum, row) => sum + row.qty, 0);
  const totalTeu = filteredRows.reduce((sum, row) => sum + row.teu, 0);
  const uniqueBookings = new Set(filteredRows.map((row) => row.bookingNo).filter(Boolean)).size;
  const activeCarriers = new Set(filteredRows.map((row) => row.carrier).filter(Boolean)).size;

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

  return (
    <AppShell
      currentUser={currentUser}
      onLogout={handleLogout}
      dateFilters={dateFilters}
      quarterOptions={quarterOptions}
      monthOptions={monthOptions}
      yearOptions={yearOptions}
      onToggleDateFilter={toggleDateFilter}
      onSetAllDate={setAllDate}
      counts={state.counts}
      selected={selected}
      availableValues={availableValues}
      searches={searches}
      onToggleSelect={toggleSelect}
      onSetSelected={setSelected}
      onSetSearches={setSearches}
      onSelectAll={() => initializeFromData({ detailData: state.detailData, metadata: state.metadata })}
      state={state}
      filteredRows={filteredRows}
      totalQty={totalQty}
      totalTeu={totalTeu}
      uniqueBookings={uniqueBookings}
      activeCarriers={activeCarriers}
      overviewRows={overviewRows}
      overviewUnit={overviewUnit}
      overviewMonthly={overviewMonthly}
      detailUnit={detailUnit}
      filteredMonthly={filteredMonthly}
      topPort={topPort}
      topCarrier={topCarrier}
      topCountry={topCountry}
      topTrade={topTrade}
      topSales={topSales}
      saleCards={saleCards}
      dateRange={getDateRange(filteredRows)}
    />
  );
}

function AppShell(props) {
  const location = useLocation();
  const pathname = location.pathname;

  const filterMode = pathname === "/admin" ? "nav" : pathname === "/" ? "compact" : "full";

  const pageName = pathname === "/analytics"
    ? "Analytics"
    : pathname === "/shipments"
      ? "Shipments"
      : pathname === "/admin"
        ? "Admin"
        : "Dashboard";
  const chatFilters = {
    years: props.dateFilters.years,
    quarters: props.dateFilters.quarters,
    months: props.dateFilters.months,
    port: props.selected.port,
    country: props.selected.country,
    trade: props.selected.trade,
    carrier: props.selected.carrier,
    sales: props.selected.sales,
  };
  const chatPageContext = {
    route: pathname,
    recordCount: props.filteredRows.length,
  };

  return (
    <div className="app-shell">
      <NavSidebar
        currentUser={props.currentUser}
        onLogout={props.onLogout}
        dateFilters={props.dateFilters}
        quarterOptions={props.quarterOptions}
        monthOptions={props.monthOptions}
        yearOptions={props.yearOptions}
        onToggleDateFilter={props.onToggleDateFilter}
        onSetAllDate={props.onSetAllDate}
        counts={props.counts}
        selected={props.selected}
        availableValues={props.availableValues}
        searches={props.searches}
        onToggleSelect={props.onToggleSelect}
        onSetSelected={props.onSetSelected}
        onSetSearches={props.onSetSearches}
        onSelectAll={props.onSelectAll}
        filterMode={filterMode}
        recordCount={props.filteredRows.length}
      />

      <main id="main">
        <div id="topbar">
          <div className="breadcrumb">
            {pathname === "/" ? (
              <span>ShipTrack</span>
            ) : (
              <Link to="/" className="breadcrumb-link">ShipTrack</Link>
            )}
            <span>/</span>
            {pageName === "Analytics" ? (
              <>
                <Link to="/analytics" className="breadcrumb-link">Analytics</Link>
                <span>/</span>
                <b>Deep Dive</b>
              </>
            ) : pageName === "Admin" ? (
              <>
                <Link to="/admin" className="breadcrumb-link">Admin</Link>
                <span>/</span>
                <b>User Management</b>
              </>
            ) : (
              <b>{pageName}</b>
            )}
          </div>
          <div className="topbar-right">
            {pageName === "Dashboard" ? <span className="topbar-note">{props.dateRange}</span> : null}
            {pageName === "Analytics" ? <span className="topbar-note">All filters applied</span> : null}
            {pageName === "Shipments" ? (
              <span id="record-count" className="active-badge">
                {formatNumber(props.filteredRows.length)} records
              </span>
            ) : null}
            {pageName !== "Shipments" && pageName !== "Admin" ? (
              <div className="user-chip">
                <div className="user-avatar">
                  {(props.currentUser?.displayName || props.currentUser?.username || "U").charAt(0).toUpperCase()}
                </div>
                {props.currentUser?.displayName || props.currentUser?.username}
                {props.currentUser?.role ? ` (${props.currentUser.role})` : ""}
              </div>
            ) : null}
          </div>
        </div>

        <div id="content">
          {props.state.error ? <div className="inline-error">{props.state.error}</div> : null}

          <Suspense fallback={<div className="status-state">Loading page...</div>}>
            <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  filteredRows={props.filteredRows}
                  totalTeu={props.totalTeu}
                  uniqueBookings={props.uniqueBookings}
                  activeCarriers={props.activeCarriers}
                  totalQty={props.totalQty}
                  overviewRows={props.overviewRows}
                  overviewMonthly={props.overviewMonthly}
                  overviewUnit={props.overviewUnit}
                  topCarrier={props.topCarrier}
                  topCountry={props.topCountry}
                  topSales={props.topSales}
                  topPort={props.topPort}
                  topTrade={props.topTrade}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <AnalyticsPage
                  filteredRows={props.filteredRows}
                  totalQty={props.totalQty}
                  totalTeu={props.totalTeu}
                  detailUnit={props.detailUnit}
                  filteredMonthly={props.filteredMonthly}
                  topCarrier={props.topCarrier}
                  topCountry={props.topCountry}
                  topTrade={props.topTrade}
                  topPort={props.topPort}
                  topSales={props.topSales}
                  saleCards={props.saleCards}
                  dateFilters={props.dateFilters}
                  selected={props.selected}
                  counts={props.counts}
                  onSetAllDate={props.onSetAllDate}
                  onSetSelected={props.onSetSelected}
                />
              }
            />
            <Route
              path="/shipments"
              element={<ShipmentsPage filteredRows={props.filteredRows} />}
            />
            <Route
              path="/admin"
              element={<AdminPage currentUser={props.currentUser} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      {pathname !== "/admin" ? (
        <AiChatDrawer filters={chatFilters} pageContext={chatPageContext} />
      ) : null}
    </div>
  );
}
