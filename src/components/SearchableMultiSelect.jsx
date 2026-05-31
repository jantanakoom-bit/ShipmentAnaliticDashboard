export default function SearchableMultiSelect({
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
