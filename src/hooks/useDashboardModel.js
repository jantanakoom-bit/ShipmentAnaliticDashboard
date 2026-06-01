import { useMemo } from "react";
import {
  buildMonthlySeries,
  buildSaleCards,
  filterByDate,
  filterByMultiSelect,
  getAvailableValues,
  getDateRange,
  getUnitBreakdown,
  topGroup,
} from "../lib/utils";

export function useDashboardModel({ detailData, dateFilters, selected }) {
  const overviewRows = useMemo(() => {
    if (!dateFilters.years.length) {
      return detailData;
    }
    return detailData.filter((row) => dateFilters.years.includes(String(row.year)));
  }, [dateFilters.years, detailData]);

  const dateFilteredRows = useMemo(() => filterByDate(detailData, dateFilters), [dateFilters, detailData]);
  const filteredRows = useMemo(() => filterByMultiSelect(dateFilteredRows, selected), [dateFilteredRows, selected]);

  const availableValues = useMemo(() => {
    return {
      port: getAvailableValues(dateFilteredRows, selected, "port"),
      country: getAvailableValues(dateFilteredRows, selected, "country"),
      trade: getAvailableValues(dateFilteredRows, selected, "trade"),
      carrier: getAvailableValues(dateFilteredRows, selected, "carrier"),
      sales: getAvailableValues(dateFilteredRows, selected, "sales"),
    };
  }, [dateFilteredRows, selected]);

  const overviewUnit = useMemo(() => getUnitBreakdown(overviewRows), [overviewRows]);
  const detailUnit = useMemo(() => getUnitBreakdown(filteredRows), [filteredRows]);
  const overviewMonthly = useMemo(() => buildMonthlySeries(overviewRows), [overviewRows]);
  const filteredMonthly = useMemo(() => buildMonthlySeries(filteredRows), [filteredRows]);
  const topPort = useMemo(() => topGroup(filteredRows, "port", 10), [filteredRows]);
  const topCarrier = useMemo(() => topGroup(filteredRows, "carrier", 10), [filteredRows]);
  const topCountry = useMemo(() => topGroup(filteredRows, "country", 10), [filteredRows]);
  const topTrade = useMemo(() => topGroup(filteredRows, "trade", 12), [filteredRows]);
  const topSales = useMemo(() => topGroup(filteredRows, "saleName", 15), [filteredRows]);
  const saleCards = useMemo(() => buildSaleCards(filteredRows), [filteredRows]);

  const totalQty = filteredRows.reduce((sum, row) => sum + row.qty, 0);
  const totalTeu = filteredRows.reduce((sum, row) => sum + row.teu, 0);
  const uniqueBookings = new Set(filteredRows.map((row) => row.bookingNo).filter(Boolean)).size;
  const activeCarriers = new Set(filteredRows.map((row) => row.carrier).filter(Boolean)).size;

  return {
    overviewRows,
    dateFilteredRows,
    filteredRows,
    availableValues,
    overviewUnit,
    detailUnit,
    overviewMonthly,
    filteredMonthly,
    topPort,
    topCarrier,
    topCountry,
    topTrade,
    topSales,
    saleCards,
    totalQty,
    totalTeu,
    uniqueBookings,
    activeCarriers,
    dateRange: getDateRange(filteredRows),
  };
}
