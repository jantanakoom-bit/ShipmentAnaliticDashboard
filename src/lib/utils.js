import { MONTH_LABELS, FILTER_KEYS } from "./constants";

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

export function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function getSelectionSummary(selected, total) {
  if (total === 0) {
    return "No options";
  }
  if (selected.length === total) {
    return "All selected";
  }
  if (selected.length === 0) {
    return "None selected";
  }
  return `${selected.length} of ${total}`;
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`));
}

export function topGroup(rows, key, limit = 10) {
  const map = new Map();

  for (const row of rows) {
    const label = row[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + row.teu);
  }

  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function getUnitBreakdown(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.unit.startsWith("20")) {
        acc.unit20 += row.qty;
      } else if (row.unit.startsWith("40")) {
        acc.unit40 += row.qty;
      }
      return acc;
    },
    { unit20: 0, unit40: 0 },
  );
}

export function buildMonthlySeries(rows) {
  const years = uniqueSorted(rows.map((row) => row.year));
  const series = MONTH_LABELS.map((month, index) => {
    const item = { month };
    for (const year of years) {
      item[year] = 0;
    }
    for (const row of rows) {
      if (row.monthNumber === index + 1 && row.year) {
        item[row.year] += row.teu;
      }
    }
    return item;
  });

  return { years, series };
}

export function getDateRange(rows) {
  const timestamps = rows
    .map((row) => row.date?.getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!timestamps.length) {
    return "No active data range";
  }

  return `${formatDate(new Date(timestamps[0]))} -> ${formatDate(new Date(timestamps[timestamps.length - 1]))}`;
}

export function getCounts(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function filterByDate(rows, dateFilters) {
  const anyYear = dateFilters.years.length === 0;
  const anyQuarter = dateFilters.quarters.length === 0;
  const anyMonth = dateFilters.months.length === 0;

  return rows.filter((row) => {
    if (!anyYear && !dateFilters.years.includes(String(row.year))) {
      return false;
    }
    if (!anyQuarter && !dateFilters.quarters.includes(row.quarter)) {
      return false;
    }
    if (!anyMonth && !dateFilters.months.includes(String(row.monthNumber))) {
      return false;
    }
    return true;
  });
}

export function getFilterValue(row, key) {
  if (key === "port") {
    return row.port;
  }
  if (key === "country") {
    return row.country;
  }
  if (key === "trade") {
    return row.trade;
  }
  if (key === "carrier") {
    return row.carrier;
  }
  return row.saleName;
}

export function filterByMultiSelect(rows, selected) {
  return rows.filter((row) => {
    for (const key of FILTER_KEYS) {
      if (selected[key].length && !selected[key].includes(getFilterValue(row, key))) {
        return false;
      }
      if (!selected[key].length) {
        return false;
      }
    }
    return true;
  });
}

export function getAvailableValues(rows, selected, targetKey) {
  const available = new Set();

  rows
    .filter((row) => {
      for (const key of FILTER_KEYS) {
        if (key === targetKey) {
          continue;
        }
        if (selected[key].length && !selected[key].includes(getFilterValue(row, key))) {
          return false;
        }
        if (!selected[key].length) {
          return false;
        }
      }
      return true;
    })
    .forEach((row) => {
      const value = getFilterValue(row, targetKey);
      if (value) {
        available.add(value);
      }
    });

  return available;
}

export function buildSaleCards(rows) {
  const saleTop = topGroup(rows, "saleName", 30);
  const stats = new Map();

  for (const row of rows) {
    if (!stats.has(row.saleName)) {
      stats.set(row.saleName, {
        unit20: 0,
        unit40: 0,
        bookings: new Set(),
        shippers: new Set(),
      });
    }
    const item = stats.get(row.saleName);
    if (row.unit.startsWith("20")) {
      item.unit20 += row.qty;
    } else if (row.unit.startsWith("40")) {
      item.unit40 += row.qty;
    }
    if (row.bookingNo) {
      item.bookings.add(row.bookingNo);
    }
    if (row.shipper) {
      item.shippers.add(row.shipper);
    }
  }

  const max = saleTop[0]?.value || 1;

  return saleTop.map((item, index) => {
    const stat = stats.get(item.name) || {
      unit20: 0,
      unit40: 0,
      bookings: new Set(),
      shippers: new Set(),
    };

    return {
      rank: index + 1,
      name: item.name,
      teu: item.value,
      unit20: stat.unit20,
      unit40: stat.unit40,
      totalUnits: stat.unit20 + stat.unit40,
      bookings: stat.bookings.size,
      shippers: stat.shippers.size,
      pct: (item.value / max) * 100,
    };
  });
}
