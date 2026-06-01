import { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate, Link } from "react-router-dom";
import { formatNumber } from "./lib/utils";
import { useDashboardModel } from "./hooks/useDashboardModel";
import { useSession } from "./hooks/useSession";
import { useWorkbookState } from "./hooks/useWorkbookState";

import LoginScreen from "./components/LoginScreen";
import AiChatDrawer from "./components/AiChatDrawer";
import NavSidebar from "./components/NavSidebar";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

export default function App() {
  const {
    isAuthenticated,
    currentUser,
    authLoading,
    loginLoading,
    authError,
    handleLogin,
    handleLogout,
  } = useSession();
  const workbook = useWorkbookState(isAuthenticated);
  const {
    state,
    dateFilters,
    selected,
    searches,
    quarterOptions,
    monthOptions,
    yearOptions,
    refreshWorkbookData,
    resetSelections,
    toggleDateFilter,
    setAllDate,
    toggleSelect,
    setSelected,
    setSearches,
  } = workbook;
  const dashboard = useDashboardModel({
    detailData: state.detailData,
    dateFilters,
    selected,
  });

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
      availableValues={dashboard.availableValues}
      searches={searches}
      onToggleSelect={toggleSelect}
      onSetSelected={setSelected}
      onSetSearches={setSearches}
      onSelectAll={resetSelections}
      onDataRefresh={refreshWorkbookData}
      state={state}
      filteredRows={dashboard.filteredRows}
      totalQty={dashboard.totalQty}
      totalTeu={dashboard.totalTeu}
      uniqueBookings={dashboard.uniqueBookings}
      activeCarriers={dashboard.activeCarriers}
      overviewRows={dashboard.overviewRows}
      overviewUnit={dashboard.overviewUnit}
      overviewMonthly={dashboard.overviewMonthly}
      detailUnit={dashboard.detailUnit}
      filteredMonthly={dashboard.filteredMonthly}
      topPort={dashboard.topPort}
      topCarrier={dashboard.topCarrier}
      topCountry={dashboard.topCountry}
      topTrade={dashboard.topTrade}
      topSales={dashboard.topSales}
      saleCards={dashboard.saleCards}
      dateRange={dashboard.dateRange}
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
      : pathname === "/tracking"
        ? "Tracking"
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
            ) : pageName === "Tracking" ? (
              <>
                <Link to="/tracking" className="breadcrumb-link">Tracking</Link>
                <span>/</span>
                <b>Operations</b>
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
              element={<ShipmentsPage filteredRows={props.filteredRows} currentUser={props.currentUser} onDataRefresh={props.onDataRefresh} />}
            />
            <Route
              path="/tracking"
              element={<TrackingPage filteredRows={props.filteredRows} onDataRefresh={props.onDataRefresh} />}
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
