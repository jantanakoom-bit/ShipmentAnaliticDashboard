import { useEffect, useState } from "react";
import { buildFilterOptions } from "../lib/dashboard";
import { loadWorkbookData } from "../lib/loadWorkbook";
import { MONTH_LABELS } from "../lib/constants";
import { getCounts } from "../lib/utils";

const EMPTY_WORKBOOK_STATE = {
  loading: true,
  error: "",
  metadata: null,
  detailData: [],
  filterOptions: { years: [], quarters: [], months: [] },
  counts: { port: [], country: [], trade: [], carrier: [], sales: [] },
};

const EMPTY_DATE_FILTERS = { years: [], quarters: [], months: [] };
const EMPTY_SELECTED_FILTERS = { port: [], country: [], trade: [], carrier: [], sales: [] };
const EMPTY_SEARCHES = { port: "", country: "", trade: "", carrier: "", sales: "" };

export function useWorkbookState(isAuthenticated) {
  const [state, setState] = useState(EMPTY_WORKBOOK_STATE);
  const [dateFilters, setDateFilters] = useState(EMPTY_DATE_FILTERS);
  const [selected, setSelected] = useState(EMPTY_SELECTED_FILTERS);
  const [searches, setSearches] = useState(EMPTY_SEARCHES);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    loadWorkbookData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        initializeFromData(data);
      })
      .catch((error) => {
        if (mounted) {
          setState({
            ...EMPTY_WORKBOOK_STATE,
            loading: false,
            error: error.message || "Unable to load workbook",
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  async function refreshWorkbookData() {
    const data = await loadWorkbookData();
    initializeFromData(data);
  }

  function initializeFromData(data) {
    const filterOptions = buildFilterOptions(data.detailData);
    const monthSelection = [...new Set(data.detailData.map((row) => String(row.monthNumber)).filter(Boolean))].sort();
    const counts = {
      port: getCounts(data.detailData, "port"),
      country: getCounts(data.detailData, "country"),
      trade: getCounts(data.detailData, "trade"),
      carrier: getCounts(data.detailData, "carrier"),
      sales: getCounts(data.detailData, "saleName"),
    };

    setState({
      loading: false,
      error: "",
      metadata: data.metadata,
      detailData: data.detailData,
      filterOptions,
      counts,
    });
    setDateFilters({
      years: filterOptions.years.map(String),
      quarters: filterOptions.quarters,
      months: monthSelection,
    });
    setSelected({
      port: counts.port.map((item) => item.value),
      country: counts.country.map((item) => item.value),
      trade: counts.trade.map((item) => item.value),
      carrier: counts.carrier.map((item) => item.value),
      sales: counts.sales.map((item) => item.value),
    });
    setSearches(EMPTY_SEARCHES);
  }

  function toggleDateFilter(type, value) {
    setDateFilters((current) => ({
      ...current,
      [type]: current[type].includes(value) ? current[type].filter((item) => item !== value) : [...current[type], value],
    }));
  }

  function setAllDate(type, values) {
    setDateFilters((current) => ({ ...current, [type]: values }));
  }

  function toggleSelect(key, value, checked) {
    setSelected((current) => ({
      ...current,
      [key]: checked ? [...current[key], value] : current[key].filter((item) => item !== value),
    }));
  }

  const quarterOptions = state.filterOptions.quarters.map((item) => ({ label: item, value: item }));
  const monthOptions = [...new Set(state.detailData.map((row) => row.monthNumber))]
    .sort((a, b) => a - b)
    .map((monthNumber) => ({ label: MONTH_LABELS[monthNumber - 1], value: String(monthNumber) }));
  const yearOptions = state.filterOptions.years.map((item) => ({ label: `${item}`, value: `${item}` }));

  return {
    state,
    dateFilters,
    selected,
    searches,
    quarterOptions,
    monthOptions,
    yearOptions,
    refreshWorkbookData,
    resetSelections: () => initializeFromData({ detailData: state.detailData, metadata: state.metadata }),
    toggleDateFilter,
    setAllDate,
    toggleSelect,
    setSelected,
    setSearches,
  };
}
