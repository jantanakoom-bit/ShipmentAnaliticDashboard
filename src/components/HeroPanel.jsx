import InsightTile from "./InsightTile";
import { formatNumber } from "../lib/utils";

export default function HeroPanel({ topCarrier, topCountry, uniqueBookings, activeCarriers }) {
  const topCarrierName = topCarrier[0]?.name || "N/A";
  const topCountryName = topCountry[0]?.name || "N/A";

  return (
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
  );
}
