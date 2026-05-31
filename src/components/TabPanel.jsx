export default function TabPanel({ tabs, activeTab, onTabChange, children }) {
  return (
    <div className="tabs-container">
      <div className="tab-btn-row">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">{children}</div>
    </div>
  );
}
