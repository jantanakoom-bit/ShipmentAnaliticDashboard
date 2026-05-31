function sortByValue(items) {
  return items.sort((a, b) => b.value - a.value);
}

function aggregateBy(items, key, valueKey) {
  const map = new Map();

  for (const item of items) {
    const label = item[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + (item[valueKey] || 0));
  }

  return sortByValue(
    [...map.entries()].map(([name, value]) => ({
      name,
      value,
    })),
  );
}

function aggregateCount(items, key) {
  const map = new Map();

  for (const item of items) {
    const label = item[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + 1);
  }

  return sortByValue(
    [...map.entries()].map(([name, value]) => ({
      name,
      value,
    })),
  );
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`));
}

function formatPeriodLabel(row, grain) {
  if (grain === "year") {
    return `${row.year ?? "Unknown"}`;
  }

  if (grain === "quarter") {
    return row.year ? `${row.year} ${row.quarter}` : "Unknown";
  }

  return row.monthLabel;
}

function buildTimeSeries(items, grain) {
  const map = new Map();

  for (const item of items) {
    const key =
      grain === "year" ? `${item.year}` : grain === "quarter" ? item.yearQuarter : item.yearMonth;

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: formatPeriodLabel(item, grain),
        teu: 0,
        shipments: 0,
        qty: 0,
      });
    }

    const entry = map.get(key);
    entry.teu += item.teu;
    entry.shipments += 1;
    entry.qty += item.qty;
  }

  return [...map.values()].sort((a, b) => `${a.key}`.localeCompare(`${b.key}`));
}

function findPreviousValue(series, key) {
  const index = series.findIndex((item) => item.key === key);
  if (index <= 0) {
    return null;
  }

  return series[index - 1];
}

function calculateChange(current, previous, field) {
  if (!current || !previous || !previous[field]) {
    return null;
  }

  return ((current[field] - previous[field]) / previous[field]) * 100;
}

export function buildFilterOptions(detailData) {
  const monthMap = new Map();

  for (const item of detailData) {
    if (item.yearMonth !== "Unknown" && item.monthLabel !== "Unknown") {
      monthMap.set(item.yearMonth, item.monthLabel);
    }
  }

  return {
    years: uniqueSorted(detailData.map((item) => item.year)).filter((item) => item !== "null"),
    quarters: uniqueSorted(detailData.map((item) => item.quarter)).filter((item) => item !== "Unknown"),
    months: [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry) => entry[1]),
  };
}

export function filterDetailData(detailData, filters) {
  return detailData.filter((item) => {
    if (filters.year !== "All" && `${item.year}` !== filters.year) {
      return false;
    }

    if (filters.quarter !== "All" && item.quarter !== filters.quarter) {
      return false;
    }

    if (filters.month !== "All" && item.monthLabel !== filters.month) {
      return false;
    }

    return true;
  });
}

export function buildDashboardModel(detailData, filters) {
  const filtered = filterDetailData(detailData, filters);
  const shipments = filtered.length;
  const totalTeu = filtered.reduce((sum, item) => sum + item.teu, 0);
  const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
  const uniqueShippers = new Set(filtered.map((item) => item.shipper)).size;
  const activeRoutes = new Set(filtered.map((item) => item.route)).size;
  const averageTeuPerShipment = shipments ? totalTeu / shipments : 0;

  const timeSeries = buildTimeSeries(filtered, filters.grain);
  const latestPeriod = timeSeries[timeSeries.length - 1] || null;
  const previousPeriod = latestPeriod ? findPreviousValue(timeSeries, latestPeriod.key) : null;

  const topTrades = aggregateBy(filtered, "trade", "teu").slice(0, 6);
  const topCarriers = aggregateBy(filtered, "carrier", "teu").slice(0, 8);
  const topDestinations = aggregateBy(filtered, "destination", "teu").slice(0, 8);
  const topShippers = aggregateBy(filtered, "shipper", "teu").slice(0, 8);
  const statusBreakdown = aggregateCount(filtered, "status");
  const routeRanking = aggregateBy(filtered, "route", "teu").slice(0, 8);

  const detailRows = [...filtered]
    .sort((a, b) => {
      const left = a.date ? a.date.getTime() : 0;
      const right = b.date ? b.date.getTime() : 0;
      return right - left;
    })
    .slice(0, 20);

  return {
    filteredCount: filtered.length,
    summary: {
      shipments,
      totalTeu,
      totalQty,
      uniqueShippers,
      activeRoutes,
      averageTeuPerShipment,
      latestPeriodLabel: latestPeriod?.label || "N/A",
      shipmentChangePct: calculateChange(latestPeriod, previousPeriod, "shipments"),
      teuChangePct: calculateChange(latestPeriod, previousPeriod, "teu"),
    },
    timeSeries,
    topTrades,
    topCarriers,
    topDestinations,
    topShippers,
    statusBreakdown,
    routeRanking,
    detailRows,
  };
}
