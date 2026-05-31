import ChipMultiSelect from "./ChipMultiSelect";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { formatNumber, getSelectionSummary } from "../lib/utils";

export default function Sidebar({
  metadata,
  filteredRows,
  totalTeu,
  quarterOptions,
  monthOptions,
  yearOptions,
  dateFilters,
  counts,
  selected,
  availableValues,
  searches,
  currentUser,
  onToggleDateFilter,
  onSetAllDate,
  onToggleSelect,
  onSetSelected,
  onSetSearches,
  onSelectAll,
  onShowAdmin,
  onLogout,
}) {
  return (
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
          <div className="upload-meta-sub">{formatNumber(metadata?.shipments || 0)} shipment records</div>
        </div>
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
            onToggle={(value) => onToggleDateFilter("quarters", value)}
            onSelectAll={() => onSetAllDate("quarters", quarterOptions.map((item) => item.value))}
            onClearAll={() => onSetAllDate("quarters", [])}
          />
        </div>

        <div className="filter-section">
          <div className="filter-label">Month</div>
          <ChipMultiSelect
            options={monthOptions}
            selected={dateFilters.months}
            onToggle={(value) => onToggleDateFilter("months", value)}
            onSelectAll={() => onSetAllDate("months", monthOptions.map((item) => item.value))}
            onClearAll={() => onSetAllDate("months", [])}
          />
        </div>

        <div className="filter-section">
          <div className="filter-label">Year</div>
          <ChipMultiSelect
            options={yearOptions}
            selected={dateFilters.years}
            onToggle={(value) => onToggleDateFilter("years", value)}
            onSelectAll={() => onSetAllDate("years", yearOptions.map((item) => item.value))}
            onClearAll={() => onSetAllDate("years", [])}
          />
        </div>

        <SearchableMultiSelect
          label="Port"
          items={counts.port}
          available={availableValues.port}
          selected={selected.port}
          search={searches.port}
          onSearch={(value) => onSetSearches((current) => ({ ...current, port: value }))}
          onToggle={(value, checked) => onToggleSelect("port", value, checked)}
          onSelectAll={() => onSetSelected((current) => ({ ...current, port: counts.port.map((item) => item.value) }))}
          onClearAll={() => onSetSelected((current) => ({ ...current, port: [] }))}
        />

        <div className="filter-footnote">
          Port {getSelectionSummary(selected.port, counts.port.length)} · Country{" "}
          {getSelectionSummary(selected.country, counts.country.length)}
        </div>

        <SearchableMultiSelect
          label="Country"
          items={counts.country}
          available={availableValues.country}
          selected={selected.country}
          search={searches.country}
          onSearch={(value) => onSetSearches((current) => ({ ...current, country: value }))}
          onToggle={(value, checked) => onToggleSelect("country", value, checked)}
          onSelectAll={() => onSetSelected((current) => ({ ...current, country: counts.country.map((item) => item.value) }))}
          onClearAll={() => onSetSelected((current) => ({ ...current, country: [] }))}
        />

        <SearchableMultiSelect
          label="Trade"
          items={counts.trade}
          available={availableValues.trade}
          selected={selected.trade}
          search={searches.trade}
          onSearch={(value) => onSetSearches((current) => ({ ...current, trade: value }))}
          onToggle={(value, checked) => onToggleSelect("trade", value, checked)}
          onSelectAll={() => onSetSelected((current) => ({ ...current, trade: counts.trade.map((item) => item.value) }))}
          onClearAll={() => onSetSelected((current) => ({ ...current, trade: [] }))}
        />

        <SearchableMultiSelect
          label="Carrier"
          items={counts.carrier}
          available={availableValues.carrier}
          selected={selected.carrier}
          search={searches.carrier}
          onSearch={(value) => onSetSearches((current) => ({ ...current, carrier: value }))}
          onToggle={(value, checked) => onToggleSelect("carrier", value, checked)}
          onSelectAll={() => onSetSelected((current) => ({ ...current, carrier: counts.carrier.map((item) => item.value) }))}
          onClearAll={() => onSetSelected((current) => ({ ...current, carrier: [] }))}
        />

        <SearchableMultiSelect
          label="Sale Name"
          items={counts.sales}
          available={availableValues.sales}
          selected={selected.sales}
          search={searches.sales}
          onSearch={(value) => onSetSearches((current) => ({ ...current, sales: value }))}
          onToggle={(value, checked) => onToggleSelect("sales", value, checked)}
          onSelectAll={() => onSetSelected((current) => ({ ...current, sales: counts.sales.map((item) => item.value) }))}
          onClearAll={() => onSetSelected((current) => ({ ...current, sales: [] }))}
        />

        <div className="filter-actions">
          <button
            className="btn-filter btn-all"
            type="button"
            onClick={onSelectAll}
          >
            Select All
          </button>
          {currentUser?.role === "admin" ? (
            <button className="btn-filter btn-all" type="button" onClick={onShowAdmin}>
              Users
            </button>
          ) : null}
          <button className="btn-filter btn-reset" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
