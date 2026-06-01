import { useState } from "react";
import { NavLink } from "react-router-dom";
import ChipMultiSelect from "./ChipMultiSelect";
import SearchableMultiSelect from "./SearchableMultiSelect";

const NAV_ITEMS = [
  { to: "/", icon: "📊", label: "Dashboard" },
  { to: "/analytics", icon: "📈", label: "Analytics" },
  { to: "/shipments", icon: "📋", label: "Shipments" },
  { to: "/tracking", icon: "⏱", label: "Tracking" },
  { to: "/admin", icon: "⚙️", label: "Admin" },
];

export default function NavSidebar({
  currentUser,
  onLogout,
  dateFilters,
  quarterOptions,
  monthOptions,
  yearOptions,
  onToggleDateFilter,
  onSetAllDate,
  counts,
  selected,
  availableValues,
  searches,
  onToggleSelect,
  onSetSelected,
  onSetSearches,
  onSelectAll,
  filterMode,
  recordCount = 0,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const showQuickFilters = filterMode === "compact" || filterMode === "full";
  const showFullFilters = filterMode === "full";

  const displayName = currentUser?.displayName || currentUser?.name || currentUser?.username || "User";
  const initials = displayName ? displayName.charAt(0).toUpperCase() : "?";

  return (
    <aside className={`nav-sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="nav-sidebar-head">
        <div className="nav-brand">
          <div className="nav-brand-icon">ST</div>
          {!collapsed && (
            <div>
              <div className="nav-brand-name">ShipTrack</div>
              <div className="nav-brand-sub">Logistics Intelligence</div>
            </div>
          )}
        </div>
        <button
          className="nav-collapse-btn"
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      <div className="nav-sidebar-body">
        <nav className="nav-section">
          <div className="nav-section-title">Pages</div>
          {NAV_ITEMS.filter((item) => item.to !== "/admin" || currentUser?.role === "admin").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.to === "/shipments" && !collapsed ? (
                <span className="nav-badge">{recordCount.toLocaleString()}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {showQuickFilters && !collapsed && (
          <div className="nav-filter-section">
            <div className="nav-section-title">Quick Filter</div>

            <div className="filter-section">
              <div className="filter-label">Year</div>
              <ChipMultiSelect
                options={yearOptions}
                selected={dateFilters.years}
                onToggle={(value) => onToggleDateFilter("years", value)}
                onSelectAll={() =>
                  onSetAllDate("years", yearOptions.map((item) => item.value))
                }
                onClearAll={() => onSetAllDate("years", [])}
              />
            </div>

            <div className="filter-section">
              <div className="filter-label">Quarter</div>
              <ChipMultiSelect
                options={quarterOptions}
                selected={dateFilters.quarters}
                onToggle={(value) => onToggleDateFilter("quarters", value)}
                onSelectAll={() =>
                  onSetAllDate(
                    "quarters",
                    quarterOptions.map((item) => item.value),
                  )
                }
                onClearAll={() => onSetAllDate("quarters", [])}
              />
            </div>
          </div>
        )}

        {showFullFilters && !collapsed && (
          <div className="nav-filter-section">
            <div className="nav-section-title">Filters</div>

            <SearchableMultiSelect
              label="Port"
              items={counts.port}
              available={availableValues.port}
              selected={selected.port}
              search={searches.port}
              onSearch={(value) =>
                onSetSearches((current) => ({ ...current, port: value }))
              }
              onToggle={(value, checked) =>
                onToggleSelect("port", value, checked)
              }
              onSelectAll={() =>
                onSetSelected((current) => ({
                  ...current,
                  port: counts.port.map((item) => item.value),
                }))
              }
              onClearAll={() =>
                onSetSelected((current) => ({ ...current, port: [] }))
              }
            />

            <SearchableMultiSelect
              label="Country"
              items={counts.country}
              available={availableValues.country}
              selected={selected.country}
              search={searches.country}
              onSearch={(value) =>
                onSetSearches((current) => ({ ...current, country: value }))
              }
              onToggle={(value, checked) =>
                onToggleSelect("country", value, checked)
              }
              onSelectAll={() =>
                onSetSelected((current) => ({
                  ...current,
                  country: counts.country.map((item) => item.value),
                }))
              }
              onClearAll={() =>
                onSetSelected((current) => ({ ...current, country: [] }))
              }
            />

            <SearchableMultiSelect
              label="Trade"
              items={counts.trade}
              available={availableValues.trade}
              selected={selected.trade}
              search={searches.trade}
              onSearch={(value) =>
                onSetSearches((current) => ({ ...current, trade: value }))
              }
              onToggle={(value, checked) =>
                onToggleSelect("trade", value, checked)
              }
              onSelectAll={() =>
                onSetSelected((current) => ({
                  ...current,
                  trade: counts.trade.map((item) => item.value),
                }))
              }
              onClearAll={() =>
                onSetSelected((current) => ({ ...current, trade: [] }))
              }
            />

            <SearchableMultiSelect
              label="Carrier"
              items={counts.carrier}
              available={availableValues.carrier}
              selected={selected.carrier}
              search={searches.carrier}
              onSearch={(value) =>
                onSetSearches((current) => ({ ...current, carrier: value }))
              }
              onToggle={(value, checked) =>
                onToggleSelect("carrier", value, checked)
              }
              onSelectAll={() =>
                onSetSelected((current) => ({
                  ...current,
                  carrier: counts.carrier.map((item) => item.value),
                }))
              }
              onClearAll={() =>
                onSetSelected((current) => ({ ...current, carrier: [] }))
              }
            />

            <SearchableMultiSelect
              label="Sale"
              items={counts.sales}
              available={availableValues.sales}
              selected={selected.sales}
              search={searches.sales}
              onSearch={(value) =>
                onSetSearches((current) => ({ ...current, sales: value }))
              }
              onToggle={(value, checked) =>
                onToggleSelect("sales", value, checked)
              }
              onSelectAll={() =>
                onSetSelected((current) => ({
                  ...current,
                  sales: counts.sales.map((item) => item.value),
                }))
              }
              onClearAll={() =>
                onSetSelected((current) => ({ ...current, sales: [] }))
              }
            />

            <div className="filter-actions">
              <button
                className="btn-filter btn-all"
                type="button"
                onClick={onSelectAll}
              >
                Select All
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="nav-footer">
        <div className="nav-user-avatar">{initials}</div>
        {!collapsed && (
          <>
            <div className="nav-user-info">
              <div className="nav-user-name">{displayName}</div>
              <div className="nav-user-role">{currentUser?.role || ""}</div>
            </div>
            <button
              className="nav-logout"
              type="button"
              onClick={onLogout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
