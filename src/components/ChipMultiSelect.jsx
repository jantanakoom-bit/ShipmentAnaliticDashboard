export default function ChipMultiSelect({ options, selected, onToggle, onSelectAll, onClearAll }) {
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
