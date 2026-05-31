import TopListCard from "./TopListCard";
import { formatNumber } from "../lib/utils";

export default function TopRankings({ topPort, topCarrier, topCountry, topTrade, saleCards }) {
  return (
    <>
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
    </>
  );
}
