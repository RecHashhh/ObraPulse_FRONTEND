import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  downloadPacCsv,
  downloadPacExcel,
  getCatalogosDinamicos,
  getComparadorAgregado,
  getDashboardContextual,
  getEntidadesPorProvincia,
  getPac,
  getPacInsights,
  getTopCiudades,
  getTopProvincias,
  getTopEntidadesPorProvincia,
  getBookmarks,
  addBookmark as apiAddBookmark,
  removeBookmark as apiRemoveBookmark,
} from "../api/pacApi";
import { STALE } from "../lib/queryClient";
import FilterPanel from "../components/ui/FilterPanel";
import FilterChips from "../components/ui/FilterChips";
import SkeletonCards from "../components/ui/SkeletonCards";
import EmptyState from "../components/EmptyState";
import { useTheme } from "../context/ThemeContext";
import { useLoading } from "../context/LoadingContext";

const LazyKpiBlock = lazy(() => import("../components/dashboard/KpiBlock"));
const LazyDashboardChartsBlock = lazy(() => import("../components/dashboard/DashboardChartsBlock"));
const LazyDetailTableBlock = lazy(() => import("../components/dashboard/DetailTableBlock"));
const LazyTerritorialOverviewBlock = lazy(() =>
  import("../components/dashboard/TerritorialOverviewBlock")
);

const SAVED_VIEWS_KEY = "pac.savedViews";
const ALERTS_HISTORY_KEY = "pac.alerts.history";
const COMPARATOR_SERIES_KEY = "pac.comparator.series";
const COMPARATOR_APPLIED_FILTERS_KEY = "pac.comparator.appliedFilters";
const COMPARATOR_PAGE_SIZE = 200;
const COMPARATOR_MAX_PAGES = 25;
const COMPARATOR_CHART_PALETTE = [
  "#293E46",
  "#E75E0D",
  "#5F7780",
  "#F6BA91",
  "#8AA2AC",
  "#C97A47",
];
const INITIAL_COMPARATOR_SERIES = [];
const COMPARATOR_INITIAL_FILTERS = {
  provincia: [],
  ciudad: [],
  entidad: [],
  tipo_compra: [],
  procedimiento: [],
  fecha_inicio: "",
  fecha_fin: "",
  valor_min: "",
  valor_max: "",
};

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;

  return formatMoney(amount);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("es-EC", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function truncateLabel(value, maxLength = 18) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function saveBlob(blob, filename) {
  const url = globalThis.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  globalThis.URL.revokeObjectURL(url);
}

function buildFilterTag(filters = {}) {
  const order = [
    "provincia",
    "ciudad",
    "entidad",
    "tipo_compra",
    "t_regimen",
    "fondo_bid",
    "procedimiento",
    "fecha_inicio",
    "fecha_fin",
    "valor_min",
    "valor_max",
  ];

  const parts = order
    .map((key) => {
      const value = String(filters?.[key] || "").trim();
      if (!value) return "";
      return `${key}-${normalizeText(value).replace(/\s+/g, "-").slice(0, 18)}`;
    })
    .filter(Boolean);

  return parts.length ? parts.slice(0, 4).join("_") : "sin-filtros";
}

function buildExportFileName(prefix, filters, extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `PAC_${prefix}_${buildFilterTag(filters)}_${date}.${extension}`;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <article className="glass-card chart-card-modern">
      <header>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </article>
  );
}

export default function Dashboard({ activePage, globalSearch, onStatsChange }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(false);

  const [metric, setMetric] = useState("monto");
  const [compareBy, setCompareBy] = useState("Provincia");
  const [comparatorSeries, setComparatorSeries] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMPARATOR_SERIES_KEY) || "[]");
      return Array.isArray(saved) ? saved : INITIAL_COMPARATOR_SERIES;
    } catch {
      return INITIAL_COMPARATOR_SERIES;
    }
  });
  const [expandedComparatorSeriesId, setExpandedComparatorSeriesId] = useState(null);
  const [expandedComparatorSearch, setExpandedComparatorSearch] = useState("");
  const [expandedComparatorSort, setExpandedComparatorSort] = useState({
    key: "monto",
    direction: "desc",
  });
  const [editingComparatorSeriesId, setEditingComparatorSeriesId] = useState(null);
  const [editingComparatorTitle, setEditingComparatorTitle] = useState("");
  const [comparatorFiltersDraft, setComparatorFiltersDraft] = useState(COMPARATOR_INITIAL_FILTERS);
  const [comparatorFiltersApplied, setComparatorFiltersApplied] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMPARATOR_APPLIED_FILTERS_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  });
  const [comparatorFiltersFeedback, setComparatorFiltersFeedback] = useState("");
  const [territorialLayer, setTerritorialLayer] = useState("monto");
  const [filters, setFilters] = useState(() => {
    const raw = sessionStorage.getItem("pac.jumpFilters");
    if (raw) {
      try {
        sessionStorage.removeItem("pac.jumpFilters");
        return JSON.parse(raw);
      } catch {}
    }
    return {};
  });
  const [catalogos, setCatalogos] = useState({});
  const [dashboardData, setDashboardData] = useState(null);

  const [pacData, setPacData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedProvince, setSelectedProvince] = useState("");
  const [entitiesPage, setEntitiesPage] = useState(1);
  const [filtersWarning, setFiltersWarning] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(500000);
  const [entitySearchInput, setEntitySearchInput] = useState(filters.entidad || "");
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const entitySearchRef = useRef(null);
  const [alertsHistory, setAlertsHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ALERTS_HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const pageSize = 20;
  const provinceEntitiesPageSize = 20;

  const [savedViews, setSavedViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [bookmarks, setBookmarks] = useState([]);

  const { isDark, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { setLoading } = useLoading();
  const nextComparatorSeriesId = useRef(2);
  const comparatorFiltersGridRef = useRef(null);

  useEffect(() => {
    getBookmarks()
      .then((bms) => { if (Array.isArray(bms)) setBookmarks(bms); })
      .catch(() => {});
  }, []);


  const dashboardView =
    activePage === "territorial"
      ? "territorial"
      : activePage === "temporal"
        ? "temporal"
        : "dashboard";

  const loadCatalogs = useCallback(async (activeFilters = {}) => {
    const data = await queryClient.fetchQuery({
      queryKey: ["catalogos", activeFilters],
      queryFn: () => getCatalogosDinamicos(activeFilters),
    });
    setCatalogos(data || {});
  }, [queryClient]);

  const loadDashboard = useCallback(async (activeFilters = {}, activeMetric = metric) => {
    const data = await queryClient.fetchQuery({
      queryKey: ["dashboard", dashboardView, activeFilters, activeMetric],
      queryFn: () =>
        getDashboardContextual(
          {
            ...activeFilters,
            metrica: activeMetric,
          },
          dashboardView
        ),
    });
    setDashboardData(data);
  }, [dashboardView, metric, queryClient]);

  const loadTable = useCallback(async (customPage = 1, activeFilters = {}) => {
    const data = await queryClient.fetchQuery({
      queryKey: ["table", customPage, pageSize, activeFilters],
      queryFn: () =>
        getPac({
          ...activeFilters,
          page: customPage,
          page_size: pageSize,
        }),
    });
    setPacData(data.items || []);
    setTotal(data.total || 0);
  }, [pageSize, queryClient]);

  useEffect(() => {
    const refresh = async () => {
      if (!initialLoading) {
        setFiltersLoading(true);
      }
      try {
        await Promise.all([
          loadCatalogs(filters),
          loadDashboard(filters, metric),
          loadTable(page, filters),
        ]);
      } finally {
        setInitialLoading(false);
        setFiltersLoading(false);
      }
    };

    refresh();
  }, [filters, initialLoading, loadCatalogs, loadDashboard, loadTable, metric, page]);

  const provinceDrilldownQuery = useQuery({
    queryKey: ["top-entidades-provincia", selectedProvince, territorialLayer, filters],
    queryFn: () =>
      getTopEntidadesPorProvincia({
        provincia: selectedProvince,
        limit: 6,
        capa: territorialLayer,
        ...filters,
      }),
    enabled: Boolean(selectedProvince),
  });

  const activeTerritorialProvince = selectedProvince || filters.provincia || "";

  const territoryFilters = useMemo(() => {
    const next = { ...filters };
    delete next.provincia;
    delete next.ciudad;
    delete next.entidad;
    return next;
  }, [filters]);

  const comparatorBaseFilters = useMemo(() => {
    return {
      fecha_inicio: comparatorFiltersApplied.fecha_inicio || undefined,
      fecha_fin: comparatorFiltersApplied.fecha_fin || undefined,
      valor_min:
        comparatorFiltersApplied.valor_min === "" || comparatorFiltersApplied.valor_min === undefined
          ? undefined
          : comparatorFiltersApplied.valor_min,
      valor_max:
        comparatorFiltersApplied.valor_max === "" || comparatorFiltersApplied.valor_max === undefined
          ? undefined
          : comparatorFiltersApplied.valor_max,
    };
  }, [comparatorFiltersApplied]);

  const comparatorListFilters = useMemo(() => {
    const toCSV = (arr) => (Array.isArray(arr) && arr.length ? arr.join(",") : undefined);
    return {
      entidad_list: toCSV(comparatorFiltersApplied.entidad),
      provincia_list: toCSV(comparatorFiltersApplied.provincia),
      ciudad_list: toCSV(comparatorFiltersApplied.ciudad),
      tipo_compra_list: toCSV(comparatorFiltersApplied.tipo_compra),
      procedimiento_list: toCSV(comparatorFiltersApplied.procedimiento),
    };
  }, [comparatorFiltersApplied]);

  // Endpoint /api/pac/comparador devuelve { nombre, monto_total, total_registros, promedio_monto, minimo_monto }.
  const comparatorSourceQuery = useQuery({
    queryKey: ["comparator-source", compareBy, comparatorBaseFilters, comparatorListFilters],
    queryFn: () => getComparadorAgregado(compareBy, comparatorBaseFilters, comparatorListFilters),
    enabled: activePage === "comparador",
    staleTime: STALE.comparador,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const topTerritorialQuery = useQuery({
    queryKey: ["territorial-ranking", activeTerritorialProvince, metric, territoryFilters],
    queryFn: () => {
      const metrica = metric === "registros" ? "registros" : "monto";
      if (activeTerritorialProvince) {
        return getTopCiudades(10, {
          ...territoryFilters,
          provincia: activeTerritorialProvince,
          metrica,
        });
      }
      return getTopProvincias(10, {
        ...territoryFilters,
        metrica,
      });
    },
  });

  const insightsQuery = useQuery({
    queryKey: ["insights-full", alertThreshold, filters],
    queryFn: () =>
      getPacInsights({
        umbral: alertThreshold,
        ...(filters.tipo_compra && { tipo_compra: filters.tipo_compra }),
        ...(filters.t_regimen && { t_regimen: filters.t_regimen }),
        ...(filters.procedimiento && { procedimiento: filters.procedimiento }),
        ...(filters.fecha_inicio && { fecha_inicio: filters.fecha_inicio }),
        ...(filters.fecha_fin && { fecha_fin: filters.fecha_fin }),
        ...(filters.valor_min && { valor_min: filters.valor_min }),
        ...(filters.valor_max && { valor_max: filters.valor_max }),
      }),
    enabled: activePage === "insights",
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const provinceEntitiesQuery = useQuery({
    queryKey: ["entidades-provincia", activeTerritorialProvince, entitiesPage, territorialLayer, filters],
    queryFn: () =>
      getEntidadesPorProvincia({
        provincia: activeTerritorialProvince,
        page: entitiesPage,
        page_size: provinceEntitiesPageSize,
        capa: territorialLayer,
        ciudad: filters.ciudad,
        tipo_compra: filters.tipo_compra,
        procedimiento: filters.procedimiento,
        fecha_inicio: filters.fecha_inicio,
        fecha_fin: filters.fecha_fin,
        valor_min: filters.valor_min,
        valor_max: filters.valor_max,
      }),
    enabled: Boolean(activeTerritorialProvince),
  });

  useEffect(() => {
    setEntitiesPage(1);
  }, [activeTerritorialProvince, filters, territorialLayer]);

  useEffect(() => {
    onStatsChange({
      activeFiltersCount: Object.keys(filters).length,
      bookmarksCount: bookmarks.length,
      lastUpdatedAt: dashboardData?.kpis?.ultima_fecha_carga || null,
      unreadAlertsCount: alertsHistory.filter((item) => !item.read).length,
    });
  }, [alertsHistory, bookmarks.length, dashboardData?.kpis?.ultima_fecha_carga, filters, onStatsChange]);

  const principal = dashboardData?.principal;
  const hasNoResults = !filtersLoading && total === 0;

  const temporalData = useMemo(
    () =>
      (dashboardData?.evolucion || []).map((item) => ({
        fecha: item.Fecha_Carga,
        valor: item.valor,
      })),
    [dashboardData]
  );

  const insights = useMemo(() => {
    if (!pacData.length) return [];

    const montos = pacData.map((item) => Number(item.V_Total_Numeric || 0)).filter((value) => value > 0);
    if (!montos.length) return [];

    const sorted = [...montos].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    const iqr = q3 - q1;
    const outlierLimit = q3 + 1.5 * iqr;
    const avg = montos.reduce((acc, current) => acc + current, 0) / montos.length;
    const max = Math.max(...montos);
    const outliers = pacData.filter((item) => Number(item.V_Total_Numeric || 0) > outlierLimit);

    const cards = [
      {
        id: "insight-outliers",
        title: "Outliers de monto detectados",
        value: `${outliers.length} contratos`,
        tone: outliers.length ? "critical" : "positive",
        reason: `Umbral IQR: ${formatMoney(outlierLimit)}. Maximo: ${formatMoney(max)}.`,
        recommendation:
          outliers.length > 0
            ? "Revisar contratos atipicos por entidad y procedimiento para validar concentracion de riesgo."
            : "Sin atipicos relevantes en los datos visibles.",
      },
      {
        id: "insight-threshold",
        title: "Alerta por umbral configurable",
        value: `${pacData.filter((item) => Number(item.V_Total_Numeric || 0) >= alertThreshold).length} contratos`,
        tone:
          pacData.filter((item) => Number(item.V_Total_Numeric || 0) >= alertThreshold).length > 0
            ? "critical"
            : "positive",
        reason: `Umbral activo: ${formatMoney(alertThreshold)}.`,
        recommendation:
          "Ajusta el umbral para focalizar auditoria segun tolerancia de riesgo del equipo.",
      },
      {
        id: "insight-average",
        title: "Promedio de contrato",
        value: formatMoney(avg),
        tone: avg > 150000 ? "critical" : "normal",
        reason: `Promedio calculado sobre ${pacData.length} registros visibles.`,
        recommendation:
          avg > 150000
            ? "Cruzar esta tendencia con tipo de compra para detectar sobreexposicion presupuestaria."
            : "Mantener monitoreo semanal para asegurar estabilidad.",
      },
    ];

    return cards;
  }, [alertThreshold, pacData]);

  useEffect(() => {
    if (!insights.length) return;

    setAlertsHistory((prev) => {
      const existing = new Map(prev.map((item) => [item.id, item]));
      const generated = insights.map((item) => ({
        id: `${item.id}-${activePage}-${filters.provincia || "global"}`,
        title: item.title,
        value: item.value,
        tone: item.tone,
        reason: item.reason,
        recommendation: item.recommendation,
        read: existing.get(`${item.id}-${activePage}-${filters.provincia || "global"}`)?.read || false,
        createdAt: existing.get(`${item.id}-${activePage}-${filters.provincia || "global"}`)?.createdAt || new Date().toISOString(),
      }));

      const merged = [...generated, ...prev.filter((item) => !generated.some((newItem) => newItem.id === item.id))].slice(0, 80);
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(merged));
      return merged;
    });
  }, [activePage, filters.provincia, insights]);

  // El servidor ya devuelve los datos agrupados — no hay rows crudos que filtrar.
  const comparatorAggregatedRows = useMemo(
    () => (Array.isArray(comparatorSourceQuery.data) ? comparatorSourceQuery.data : []),
    [comparatorSourceQuery.data]
  );

  // Opciones de filtro usan los catálogos ya cargados (no necesitamos rows crudos).
  const comparatorFilterOptions = useMemo(
    () => ({
      provincia: (catalogos?.provincias || []).sort((a, b) => a.localeCompare(b, "es")),
      ciudad: (catalogos?.ciudades || []).sort((a, b) => a.localeCompare(b, "es")),
      entidad: (catalogos?.entidades || []).sort((a, b) => a.localeCompare(b, "es")),
      tipo_compra: (catalogos?.tipos_compra || []).sort((a, b) => a.localeCompare(b, "es")),
      procedimiento: (catalogos?.procedimientos || []).sort((a, b) => a.localeCompare(b, "es")),
      t_regimen: (catalogos?.regimenes || []).sort((a, b) => String(a).localeCompare(String(b), "es")),
      fondo_bid: (catalogos?.fondos_bid || []).sort((a, b) => String(a).localeCompare(String(b), "es")),
    }),
    [catalogos]
  );

  // Mapea la respuesta del servidor al formato que esperan los gráficos.
  const comparatorBaseData = useMemo(
    () =>
      comparatorAggregatedRows.map((item) => ({
        name: item.nombre || `Sin ${compareBy.toLowerCase()}`,
        monto: Number(item.monto_total || 0),
        registros: Number(item.total_registros || 0),
        promedio: Number(item.promedio_monto || 0),
        minimo: Number(item.minimo_monto || 0),
        maximo: Number(item.maximo_monto || 0),
        shortName: truncateLabel(item.nombre || "", 20),
      })),
    [comparatorAggregatedRows, compareBy]
  );

  // Alias mantenido por compatibilidad con código que referencia comparatorFilteredRows.
  const comparatorFilteredRows = comparatorBaseData;

  const handleComparatorListToggle = (field, value) => {
    setComparatorFiltersDraft((prev) => {
      const current = prev[field] || [];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  };

  const handleComparatorRangeChange = (event) => {
    const { name, value } = event.target;
    setComparatorFiltersDraft((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleComparatorSelectAll = (field) => {
    setComparatorFiltersDraft((prev) => ({
      ...prev,
      [field]: [...(comparatorFilterOptions[field] || [])],
    }));
  };

  const handleComparatorClear = (field) => {
    setComparatorFiltersDraft((prev) => ({
      ...prev,
      [field]: [],
    }));
  };

  const applyComparatorFilters = () => {
    const applied = {
      ...comparatorFiltersDraft,
      provincia: [...comparatorFiltersDraft.provincia],
      ciudad: [...comparatorFiltersDraft.ciudad],
      entidad: [...comparatorFiltersDraft.entidad],
      tipo_compra: [...comparatorFiltersDraft.tipo_compra],
      procedimiento: [...comparatorFiltersDraft.procedimiento],
    };

    setComparatorFiltersApplied(applied);

    const selectedSummary = [
      ["Provincia", applied.provincia?.length || 0],
      ["Ciudad", applied.ciudad?.length || 0],
      ["Entidad", applied.entidad?.length || 0],
      ["Tipo de compra", applied.tipo_compra?.length || 0],
      ["Procedimiento", applied.procedimiento?.length || 0],
      ["Fecha inicio", applied.fecha_inicio ? 1 : 0],
      ["Fecha fin", applied.fecha_fin ? 1 : 0],
      ["Monto minimo", String(applied.valor_min || "").trim() ? 1 : 0],
      ["Monto maximo", String(applied.valor_max || "").trim() ? 1 : 0],
    ]
      .filter(([, count]) => count > 0)
      .map(([name, count]) => (count > 1 ? `${name} (${count})` : name));

    if (selectedSummary.length) {
      setComparatorFiltersFeedback(`Filtros aplicados correctamente: ${selectedSummary.join(", ")}.`);
    } else {
      setComparatorFiltersFeedback("No seleccionaste filtros. Agrega filtros para mejorar el resultado.");
    }
  };

  const resetComparatorFilters = () => {
    setComparatorFiltersDraft(COMPARATOR_INITIAL_FILTERS);
    setComparatorFiltersApplied({});
    setComparatorFiltersFeedback("");
  };

  const getComparatorMetricConfig = useCallback((metricKey) => {
    if (metricKey === "registros") {
      return {
        key: "registros",
        label: "Total registros",
        format: (value) => Number(value || 0).toLocaleString("es-EC"),
        axisFormat: (value) => formatCompactNumber(value),
      };
    }
    if (metricKey === "promedio") {
      return {
        key: "promedio",
        label: "Promedio por contrato",
        format: (value) => formatMoney(value),
        axisFormat: (value) => formatCompactMoney(value),
      };
    }
    if (metricKey === "maximo") {
      return {
        key: "maximo",
        label: "Monto maximo",
        format: (value) => formatMoney(value),
        axisFormat: (value) => formatCompactMoney(value),
      };
    }
    if (metricKey === "minimo") {
      return {
        key: "minimo",
        label: "Monto minimo",
        format: (value) => formatMoney(value),
        axisFormat: (value) => formatCompactMoney(value),
      };
    }

    return {
      key: "monto",
      label: "Monto total",
      format: (value) => formatMoney(value),
      axisFormat: (value) => formatCompactMoney(value),
    };
  }, []);

  const getComparatorSeriesData = useCallback(
    (series) => {
      const metricConfig = getComparatorMetricConfig(series.metric);
      const sorted = [...comparatorBaseData].sort((a, b) =>
        Number(b[metricConfig.key] || 0) - Number(a[metricConfig.key] || 0)
      );
      return series.top > 0 ? sorted.slice(0, series.top) : sorted;
    },
    [comparatorBaseData, getComparatorMetricConfig]
  );

  const addComparatorSeries = () => {
    const nextId = nextComparatorSeriesId.current;
    nextComparatorSeriesId.current += 1;
    setComparatorSeries((prev) => [
      ...prev,
      {
        id: nextId,
        title: `Comparativa ${prev.length + 1}`,
        metric: "registros",
        chartType: "line",
        top: 0,
      },
    ]);
  };

  const removeComparatorSeries = (id) => {
    setComparatorSeries((prev) => prev.filter((item) => item.id !== id));
    setExpandedComparatorSeriesId((prev) => (prev === id ? null : prev));
  };

  const updateComparatorSeries = (id, field, value) => {
    setComparatorSeries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const startEditComparatorTitle = (series) => {
    setEditingComparatorSeriesId(series.id);
    setEditingComparatorTitle(series.title || "");
  };

  const saveEditComparatorTitle = (series) => {
    const nextTitle = editingComparatorTitle.trim() || `Comparativa ${series.id}`;
    updateComparatorSeries(series.id, "title", nextTitle);
    setEditingComparatorSeriesId(null);
    setEditingComparatorTitle("");
  };

  const cancelEditComparatorTitle = () => {
    setEditingComparatorSeriesId(null);
    setEditingComparatorTitle("");
  };

  const toggleExpandedSort = (key) => {
    setExpandedComparatorSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "desc" };
    });
  };

  const entityProcedureData = useMemo(
    () =>
      (dashboardData?.procedimientos || []).map((item) => ({
        ...item,
        procedimiento_corto: truncateLabel(item.Procedimiento, 22),
      })),
    [dashboardData?.procedimientos]
  );

  const selectedEntity = filters.entidad || null;

  const localTopEntitiesByProvince = useMemo(() => {
    if (!activeTerritorialProvince) return [];

    const selectedKey = normalizeText(activeTerritorialProvince);
    const grouped = new Map();

    for (const item of pacData) {
      if (normalizeText(item.Provincia) !== selectedKey) continue;

      const entidad = item.Entidad || "Sin entidad";
      const monto = Number(item.V_Total_Numeric || 0);
      const prev = grouped.get(entidad) || { entidad, monto: 0, contratos: 0 };

      grouped.set(entidad, {
        entidad,
        monto: prev.monto + monto,
        contratos: prev.contratos + 1,
      });
    }

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        promedio: item.contratos ? item.monto / item.contratos : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 6);
  }, [activeTerritorialProvince, pacData]);

  const localAllEntitiesByProvince = useMemo(() => {
    if (!activeTerritorialProvince) return [];

    const selectedKey = normalizeText(activeTerritorialProvince);
    const grouped = new Map();

    for (const item of pacData) {
      if (normalizeText(item.Provincia) !== selectedKey) continue;

      const entidad = item.Entidad || "Sin entidad";
      const monto = Number(item.V_Total_Numeric || 0);
      const prev = grouped.get(entidad) || { entidad, monto: 0, contratos: 0 };

      grouped.set(entidad, {
        entidad,
        monto: prev.monto + monto,
        contratos: prev.contratos + 1,
      });
    }

    return [...grouped.values()]
      .map((item) => ({
        entidad: item.entidad,
        monto_total: item.monto,
        total_registros: item.contratos,
        promedio_contrato: item.contratos ? item.monto / item.contratos : 0,
      }))
      .sort((a, b) => {
        if (territorialLayer === "contratos") {
          return b.total_registros - a.total_registros;
        }
        if (territorialLayer === "promedio") {
          return b.promedio_contrato - a.promedio_contrato;
        }
        return b.monto_total - a.monto_total;
      });
  }, [activeTerritorialProvince, pacData, territorialLayer]);

  const topEntitiesByProvince = useMemo(() => {
    const apiData = (provinceDrilldownQuery.data || []).map((item) => ({
        entidad: item.nombre,
        monto: Number(item.monto_total || 0),
        contratos: Number(item.total_registros || 0),
        promedio: Number(item.promedio_contrato || 0),
      }));

    return apiData.length ? apiData : localTopEntitiesByProvince;
  }, [localTopEntitiesByProvince, provinceDrilldownQuery.data]);

  const hasBackendFullEntities = Boolean(provinceEntitiesQuery.data?.items?.length);
  const localPagedEntitiesByProvince = useMemo(() => {
    const start = (entitiesPage - 1) * provinceEntitiesPageSize;
    return localAllEntitiesByProvince
      .slice(start, start + provinceEntitiesPageSize)
      .map((item) => ({
        nombre: item.entidad,
        total_registros: item.total_registros,
        monto_total: item.monto_total,
        promedio_contrato: item.promedio_contrato,
      }));
  }, [entitiesPage, localAllEntitiesByProvince, provinceEntitiesPageSize]);

  const fullEntitiesByProvince = hasBackendFullEntities
    ? provinceEntitiesQuery.data.items
    : localPagedEntitiesByProvince;
  const totalProvinceEntities = hasBackendFullEntities
    ? Number(provinceEntitiesQuery.data?.total || 0)
    : localAllEntitiesByProvince.length;
  const totalEntitiesPages = Math.max(
    1,
    Math.ceil(totalProvinceEntities / provinceEntitiesPageSize)
  );
  const usingLocalEntitiesFallback =
    Boolean(activeTerritorialProvince) &&
    !hasBackendFullEntities &&
    localAllEntitiesByProvince.length > 0;

  const territorialRankingData = topTerritorialQuery.data || [];
  const territorialRankingTitle = activeTerritorialProvince
    ? `Top ciudades en ${activeTerritorialProvince}`
    : "Top provincias";
  const territorialRankingSubtitle =
    metric === "registros"
      ? "Ranking por cantidad de registros"
      : "Ranking por monto total";

  const handleClearProvinceSelection = () => {
    const updated = { ...filters };
    delete updated.provincia;
    delete updated.ciudad;
    delete updated.entidad;

    setSelectedProvince("");
    setPage(1);
    setFilters(updated);
  };

  const handleApplyFilters = (newFilters) => {
    if (newFilters.ciudad && !newFilters.provincia) {
      setFiltersWarning("Filtro incompatible: seleccionaste ciudad sin provincia. Ajusta filtros para precision.");
      return;
    }

    setFiltersWarning("");
    setPage(1);
    setFilters(newFilters);
    setSelectedProvince(newFilters.provincia || "");
  };

  const handleResetFilters = () => {
    setFiltersWarning("");
    setPage(1);
    setFilters({});
    setSelectedProvince("");
  };

  const markAlertAsRead = (id) => {
    setAlertsHistory((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, read: true } : item));
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const markAllAlertsAsRead = () => {
    setAlertsHistory((prev) => {
      const next = prev.map((item) => ({ ...item, read: true }));
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const deleteAlert = (id) => {
    setAlertsHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearAlertsHistory = () => {
    setAlertsHistory([]);
    localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify([]));
  };

  const handleClearOneFilter = (key) => {
    const updated = { ...filters };

    if (key === "provincia") {
      delete updated.provincia;
      delete updated.ciudad;
      delete updated.entidad;
      setSelectedProvince("");
    } else if (key === "ciudad") {
      delete updated.ciudad;
      delete updated.entidad;
    } else {
      delete updated[key];
    }

    setPage(1);
    setFilters(updated);
  };

  const handleSelectProvinceFromMap = (provinceName) => {
    const rawProvince = String(provinceName || "").trim();
    if (!rawProvince) return;

    const normalized = normalizeText(rawProvince);
    const catalogProvince = (catalogos?.provincias || []).find(
      (item) => normalizeText(item) === normalized
    );

    const provinceToApply = catalogProvince || rawProvince;

    if (normalizeText(selectedProvince) === normalizeText(provinceToApply)) {
      const updated = { ...filters };
      delete updated.provincia;
      delete updated.ciudad;
      delete updated.entidad;

      setSelectedProvince("");
      setPage(1);
      setFilters(updated);
      return;
    }

    const updated = {
      ...filters,
      provincia: provinceToApply,
    };

    delete updated.ciudad;
    delete updated.entidad;

    setSelectedProvince(provinceToApply);
    setPage(1);
    setFilters(updated);
  };

  const handleSaveView = (name, activeFilters) => {
    const next = [
      ...savedViews.filter((view) => view.name.toLowerCase() !== name.toLowerCase()),
      { name, filters: activeFilters },
    ];
    setSavedViews(next);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
  };

  const handleLoadView = (name) => {
    const selected = savedViews.find((view) => view.name === name);
    if (!selected) return;
    setFilters(selected.filters || {});
    setPage(1);
  };

  const handleAddBookmark = async (item) => {
    const alreadyBookmarked = bookmarks.some((b) => b.pac_id === item.id);
    if (alreadyBookmarked) {
      apiRemoveBookmark(item.id).catch(() => {});
      setBookmarks((prev) => prev.filter((b) => b.pac_id !== item.id));
    } else {
      apiAddBookmark({
        pac_id: item.id,
        Entidad: item.Entidad,
        Descripcion: item.Descripcion,
        V_Total_Numeric: item.V_Total_Numeric,
        Provincia: item.Provincia,
      }).catch(() => {});
      setBookmarks((prev) => [
        ...prev,
        {
          pac_id: item.id,
          Entidad: item.Entidad,
          Descripcion: item.Descripcion,
          V_Total_Numeric: item.V_Total_Numeric,
          Provincia: item.Provincia,
        },
      ]);
    }
  };

  const exportTop10Csv = () => {
    const top10 = [...pacData]
      .sort((a, b) => Number(b.V_Total_Numeric || 0) - Number(a.V_Total_Numeric || 0))
      .slice(0, 10)
      .map((item) => ({
        Entidad: item.Entidad,
        Provincia: item.Provincia,
        Ciudad: item.Ciudad,
        Monto: item.V_Total_Numeric,
      }));

    const worksheet = XLSX.utils.json_to_sheet(top10);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, buildExportFileName("top10", filters, "csv"));
  };

  const exportFullExcel = async () => {
    try {
      setLoading(true);
      const blob = await downloadPacExcel(filters);
      saveBlob(blob, buildExportFileName("reporte-completo", filters, "xlsx"));
    } finally {
      setLoading(false);
    }
  };

  const exportDetalleExcel = async () => {
    try {
      setLoading(true);
      const blob = await downloadPacExcel(filters);
      saveBlob(blob, buildExportFileName("detalle-filtrado", filters, "xlsx"));
    } finally {
      setLoading(false);
    }
  };

  const exportExecutivePdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte Ejecutivo PAC - Ecuador", 14, 18);

    doc.setFontSize(11);
    doc.text(`Total registros: ${dashboardData?.kpis?.total_registros || 0}`, 14, 30);
    doc.text(`Monto total: ${formatMoney(dashboardData?.kpis?.monto_total || 0)}`, 14, 37);

    autoTable(doc, {
      startY: 46,
      head: [["Entidad", "Provincia", "Monto"]],
      body: pacData.slice(0, 10).map((item) => [
        item.Entidad,
        item.Provincia,
        formatMoney(item.V_Total_Numeric),
      ]),
    });

    doc.save(buildExportFileName("reporte-ejecutivo", filters, "pdf"));
  };

  const exportDashboardCsv = async () => {
    try {
      setLoading(true);
      const blob = await downloadPacCsv(filters);
      saveBlob(blob, buildExportFileName("dashboard", filters, "csv"));
    } finally {
      setLoading(false);
    }
  };

  const getComparatorCaptureNode = (seriesId, source = "auto") => {
    if (source === "expanded") {
      return document.querySelector(`[data-comparator-expanded-capture="${seriesId}"]`);
    }

    if (source === "card") {
      return document.querySelector(`[data-comparator-capture="${seriesId}"]`);
    }

    const expandedNode = document.querySelector(`[data-comparator-expanded-capture="${seriesId}"]`);
    if (expandedNode) return expandedNode;

    const cardNode = document.querySelector(`[data-comparator-capture="${seriesId}"]`);
    if (cardNode) return cardNode;

    return document.getElementById(`comparator-series-${seriesId}`);
  };

  const downloadCanvasAsPng = (canvas, fileName) => {
    if (!canvas) return;
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        saveBlob(blob, fileName);
      }, "image/png");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  };

  const exportComparatorSeriesImage = async (seriesId, title = "grafica", source = "auto") => {
    const chartNode = getComparatorCaptureNode(seriesId, source);
    if (!chartNode) return;

    try {
      const canvas = await html2canvas(chartNode, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: 2,
        logging: false,
      });

      const safeTitle = normalizeText(title).replace(/\s+/g, "-") || "grafica";
      const fileName = buildExportFileName(
        `comparador-${safeTitle}`,
        comparatorFiltersApplied,
        "png"
      );
      downloadCanvasAsPng(canvas, fileName);
    } catch (error) {
      console.error("No se pudo exportar imagen del comparador", error);
    }
  };

  const exportComparatorSeriesPdf = async (series, source = "auto") => {
    const metricConfig = getComparatorMetricConfig(series.metric);
    const seriesData = getComparatorSeriesData(series);
    const chartNode = getComparatorCaptureNode(series.id, source);

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte Comparador PAC", 14, 16);

    doc.setFontSize(12);
    doc.text(series.title || "Grafica comparativa", 14, 24);

    doc.setFontSize(10);
    doc.text(`Dimension: ${compareBy}`, 14, 32);
    doc.text(`Metrica: ${metricConfig.label}`, 14, 38);
    doc.text(`Top aplicado: ${series.top === 0 ? "Sin limite" : series.top}`, 14, 44);
    doc.text(`Registros comparados: ${seriesData.length}`, 14, 50);

    let tableStartY = 56;
    if (chartNode) {
      try {
        const chartCanvas = await html2canvas(chartNode, {
          backgroundColor: "#ffffff",
          useCORS: true,
          scale: 2,
          logging: false,
        });
        const chartImage = chartCanvas.toDataURL("image/png");
        const imgWidth = 180;
        const imgHeight = 90;
        doc.addImage(chartImage, "PNG", 14, 56, imgWidth, imgHeight);
        tableStartY = 152;
      } catch (error) {
        console.error("No se pudo capturar grafica para PDF", error);
      }
    }

    autoTable(doc, {
      startY: tableStartY,
      head: [[compareBy, "Registros", "Monto total", "Promedio"]],
      body: seriesData.map((item) => [
        item.name,
        Number(item.registros || 0).toLocaleString("es-EC"),
        formatMoney(item.monto),
        formatMoney(item.promedio),
      ]),
    });

    const safeTitle = normalizeText(series.title || "grafica").replace(/\s+/g, "-");
    doc.save(buildExportFileName(`comparador-informe-${safeTitle}`, comparatorFiltersApplied, "pdf"));
  };

  const renderComparatorChart = (series, metricConfig, seriesData, height = 320) => {
    const baseColor = COMPARATOR_CHART_PALETTE[(Number(series.id || 1) - 1) % COMPARATOR_CHART_PALETTE.length];
    const getColorAt = (index) =>
      COMPARATOR_CHART_PALETTE[(index + Number(series.id || 1) - 1) % COMPARATOR_CHART_PALETTE.length];
    const dotRenderer = ({ cx, cy, index }) => {
      if (cx === undefined || cy === undefined) return null;
      return <circle cx={cx} cy={cy} r={4} fill={getColorAt(index || 0)} stroke="#ffffff" strokeWidth={1} />;
    };

    if (series.chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={seriesData} margin={{ top: 8, right: 16, left: 8, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="shortName" interval={0} angle={-18} textAnchor="end" height={72} />
            <YAxis width={96} tickFormatter={metricConfig.axisFormat} />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
              formatter={(value) => [metricConfig.format(value), metricConfig.label]}
            />
            <Legend />
            <Line
              dataKey={metricConfig.key}
              name={metricConfig.label}
              stroke={baseColor}
              strokeWidth={3}
              dot={dotRenderer}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (series.chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={seriesData} margin={{ top: 8, right: 16, left: 8, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="shortName" interval={0} angle={-18} textAnchor="end" height={72} />
            <YAxis width={96} tickFormatter={metricConfig.axisFormat} />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
              formatter={(value) => [metricConfig.format(value), metricConfig.label]}
            />
            <Legend />
            <Area
              dataKey={metricConfig.key}
              name={metricConfig.label}
              type="monotone"
              stroke={baseColor}
              fill={baseColor}
              fillOpacity={0.28}
              dot={dotRenderer}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (series.chartType === "barH") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={seriesData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis type="number" tickFormatter={metricConfig.axisFormat} />
            <YAxis type="category" dataKey="shortName" width={170} />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
              formatter={(value) => [metricConfig.format(value), metricConfig.label]}
            />
            <Legend />
            <Bar dataKey={metricConfig.key} name={metricConfig.label} fill={baseColor} radius={[0, 8, 8, 0]}>
              {seriesData.map((entry, index) => (
                <Cell key={`${series.id}-barh-${entry.name}`} fill={getColorAt(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (series.chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={seriesData}
              dataKey={metricConfig.key}
              nameKey="name"
              outerRadius={height > 320 ? 160 : 110}
              labelLine={false}
              label={({ name, percent }) => `${truncateLabel(name, 14)} ${(percent * 100).toFixed(0)}%`}
            >
              {seriesData.map((entry, index) => (
                <Cell
                  key={`${series.id}-slice-${entry.name}`}
                  fill={getColorAt(index)}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [metricConfig.format(value), metricConfig.label]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={seriesData} margin={{ top: 8, right: 16, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="shortName" interval={0} angle={-18} textAnchor="end" height={72} />
          <YAxis width={96} tickFormatter={metricConfig.axisFormat} />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
            formatter={(value) => [metricConfig.format(value), metricConfig.label]}
          />
          <Legend />
          <Bar dataKey={metricConfig.key} name={metricConfig.label} fill={baseColor} radius={[8, 8, 0, 0]}>
            {seriesData.map((entry, index) => (
              <Cell key={`${series.id}-bar-${entry.name}`} fill={getColorAt(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const isComparatorBusy = activePage === "comparador" && comparatorSourceQuery.isFetching;
  const hasComparatorSelection = useMemo(() => {
    const selectedLists = [
      comparatorFiltersApplied.provincia,
      comparatorFiltersApplied.ciudad,
      comparatorFiltersApplied.entidad,
      comparatorFiltersApplied.tipo_compra,
      comparatorFiltersApplied.procedimiento,
    ].some((list) => Array.isArray(list) && list.length > 0);

    const selectedRanges = [
      comparatorFiltersApplied.fecha_inicio,
      comparatorFiltersApplied.fecha_fin,
      comparatorFiltersApplied.valor_min,
      comparatorFiltersApplied.valor_max,
    ].some((value) => String(value || "").trim() !== "");

    return selectedLists || selectedRanges;
  }, [comparatorFiltersApplied]);
  const hasComparatorCharts = comparatorSeries.length > 0;

  useEffect(() => {
    localStorage.setItem(COMPARATOR_SERIES_KEY, JSON.stringify(comparatorSeries));
  }, [comparatorSeries]);

  useEffect(() => {
    localStorage.setItem(COMPARATOR_APPLIED_FILTERS_KEY, JSON.stringify(comparatorFiltersApplied));
  }, [comparatorFiltersApplied]);

  useEffect(() => {
    if (!comparatorSeries.length) return;
    const maxId = Math.max(...comparatorSeries.map((item) => Number(item.id || 0)));
    nextComparatorSeriesId.current = maxId + 1;
  }, [comparatorSeries]);

  useEffect(() => {
    const onOutsideClick = (event) => {
      const root = comparatorFiltersGridRef.current;
      if (!root) return;
      if (root.contains(event.target)) return;

      root.querySelectorAll("details[open]").forEach((node) => {
        node.removeAttribute("open");
      });
    };

    document.addEventListener("click", onOutsideClick);
    return () => document.removeEventListener("click", onOutsideClick);
  }, []);

  useEffect(() => {
    const onOutside = (event) => {
      if (entitySearchRef.current && !entitySearchRef.current.contains(event.target)) {
        setShowEntityDropdown(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (initialLoading) {
    return (
      <div className="page-stack">
        <SkeletonCards />
      </div>
    );
  }

  return (
    <div className="page-stack">
      {["dashboard", "detalle", "territorial", "temporal", "entidad"].includes(activePage) && (
        <div className="view-metric-bar">
          <span>Ver por:</span>
          <div className="metric-toggle-modern">
            <button
              className={metric === "monto" ? "active" : ""}
              onClick={() => setMetric("monto")}
            >
              Monto
            </button>
            <button
              className={metric === "registros" ? "active" : ""}
              onClick={() => setMetric("registros")}
            >
              Registros
            </button>
          </div>
        </div>
      )}

      {activePage !== "configuracion" && activePage !== "comparador" && activePage !== "entidad" ? (
        <>
          <FilterPanel
            catalogos={catalogos}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            onSaveView={handleSaveView}
            savedViews={savedViews}
            onLoadView={handleLoadView}
          />

          <FilterChips
            filters={filters}
            onClearOne={handleClearOneFilter}
            onClearAll={handleResetFilters}
          />
        </>
      ) : null}

      {activePage !== "configuracion" && activePage !== "comparador" && activePage !== "entidad" && filtersWarning ? (
        <div className="filters-warning">{filtersWarning}</div>
      ) : null}

      <AnimatePresence mode="wait">
        <div
          key={activePage}
          className="page-stack"
        >
          {hasNoResults && activePage !== "entidad" ? (
            <EmptyState
              title={
                activePage === "territorial"
                  ? "Sin cobertura territorial para estos filtros"
                  : activePage === "detalle"
                    ? "No hay filas para mostrar en la vista detallada"
                    : activePage === "insights"
                      ? "Sin insumos para generar insights"
                      : "No hay datos para estos filtros"
              }
              message={
                activePage === "territorial"
                  ? "Quita filtro de provincia/ciudad o cambia el rango de fechas para recuperar el mapa."
                  : activePage === "detalle"
                    ? "Amplia filtros o limpia busqueda global para volver a poblar la tabla."
                    : activePage === "insights"
                      ? "Se necesitan registros visibles para calcular outliers y alertas."
                      : "Prueba quitando algun filtro o ampliando la busqueda."
              }
            />
          ) : null}

          {activePage === "dashboard" && !hasNoResults ? (
            <>
              <Suspense fallback={<div className="glass-card">Cargando KPIs...</div>}>
                <LazyKpiBlock kpis={dashboardData?.kpis || {}} />
              </Suspense>

              <Suspense fallback={<div className="glass-card">Cargando modulos analiticos...</div>}>
                <LazyDashboardChartsBlock
                  principal={principal}
                  dashboardData={dashboardData}
                  metric={metric}
                  temporalData={temporalData}
                />
              </Suspense>
            </>
          ) : null}

          {activePage === "detalle" && !hasNoResults ? (
            <>
              <section className="glass-card detail-export-card">
                <h3>Exportar detalle filtrado</h3>
                <p>
                  Descarga en Excel todos los registros que cumplen los filtros activos
                  (no solo la pagina visible).
                </p>
                <button className="primary-btn report-action-btn" onClick={exportDetalleExcel}>
                  <FileSpreadsheet size={16} /> Excel filtrado
                </button>
              </section>

              <Suspense fallback={<div className="glass-card">Cargando tabla avanzada...</div>}>
                <LazyDetailTableBlock
                  data={pacData}
                  page={page}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  globalSearch={globalSearch}
                  onAddBookmark={handleAddBookmark}
                  bookmarkedIds={bookmarks.map((b) => b.pac_id)}
                />
              </Suspense>
            </>
          ) : null}

          {activePage === "territorial" && !hasNoResults ? (
            <Suspense fallback={<div className="glass-card">Cargando mapa territorial...</div>}>
              <LazyTerritorialOverviewBlock
                principal={principal}
                territorialLayer={territorialLayer}
                onChangeLayer={setTerritorialLayer}
                selectedProvince={selectedProvince}
                onSelectProvince={handleSelectProvinceFromMap}
                territorialRankingTitle={territorialRankingTitle}
                territorialRankingSubtitle={territorialRankingSubtitle}
                territorialRankingData={territorialRankingData}
                metric={metric}
                formatMoney={formatMoney}
                formatCompactMoney={formatCompactMoney}
              />
            </Suspense>
          ) : null}

          {activePage === "territorial" && !hasNoResults ? (
            <section className="glass-card drilldown-card">
              <header className="drilldown-header">
                <div>
                  <h3>Drill-down por provincia</h3>
                  <p>
                    {selectedProvince
                      ? `Top entidades en ${selectedProvince} (registros visibles).`
                      : "Haz click en una provincia del mapa para ver el detalle."}
                  </p>
                </div>
                {selectedProvince ? (
                  <button className="ghost-btn" onClick={handleClearProvinceSelection}>
                    Limpiar seleccion
                  </button>
                ) : null}
              </header>

              {selectedProvince && provinceDrilldownQuery.isLoading ? (
                <EmptyState
                  title="Cargando detalle provincial"
                  subtitle="Estamos calculando las entidades lideres para esta provincia"
                />
              ) : selectedProvince && topEntitiesByProvince.length ? (
                <div className="drilldown-grid">
                  {topEntitiesByProvince.map((item, index) => (
                    <article className="drilldown-item" key={item.entidad}>
                      <span className="rank">#{index + 1}</span>
                      <div>
                        <strong>{item.entidad}</strong>
                        <p>{item.contratos} contratos visibles</p>
                      </div>
                      <div>
                        <strong>{formatMoney(item.monto)}</strong>
                        <p className="avg-hint">Promedio: {formatMoney(item.promedio)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sin detalle disponible"
                  message="Selecciona una provincia con datos para habilitar el drill-down."
                />
              )}

              {selectedProvince ? (
                <div className="province-entities-full">
                  <div className="province-entities-head">
                    <h4>Listado completo de entidades ({totalProvinceEntities})</h4>
                    {provinceEntitiesQuery.isFetching ? (
                      <small>Cargando pagina {entitiesPage}...</small>
                    ) : null}
                  </div>

                  {usingLocalEntitiesFallback ? (
                    <small className="fallback-hint">
                      Mostrando registros visibles en memoria local mientras se sincroniza el
                      endpoint de entidades por provincia.
                    </small>
                  ) : null}

                  {fullEntitiesByProvince.length ? (
                    <div className="province-entities-table-shell">
                      <table className="province-entities-table">
                        <thead>
                          <tr>
                            <th>Entidad</th>
                            <th>Contratos</th>
                            <th>Monto</th>
                            <th>Promedio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullEntitiesByProvince.map((item) => (
                            <tr key={item.nombre}>
                              <td>{item.nombre}</td>
                              <td>{Number(item.total_registros || 0).toLocaleString("es-EC")}</td>
                              <td>{formatMoney(item.monto_total)}</td>
                              <td>{formatMoney(item.promedio_contrato)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="No se encontraron entidades"
                      message="No hay resultados para esta provincia con los filtros actuales."
                    />
                  )}

                  <div className="province-entities-pagination">
                    <button
                      className="ghost-btn"
                      disabled={entitiesPage <= 1}
                      onClick={() => setEntitiesPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </button>
                    <span>
                      Pagina {entitiesPage} de {totalEntitiesPages}
                    </span>
                    <button
                      className="ghost-btn"
                      disabled={entitiesPage >= totalEntitiesPages}
                      onClick={() =>
                        setEntitiesPage((prev) =>
                          Math.min(totalEntitiesPages, prev + 1)
                        )
                      }
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activePage === "temporal" && !hasNoResults ? (
            <section className="grid-2">
              <ChartCard title="Evolucion mensual">
                <ResponsiveContainer width="100%" height={330}>
                  <LineChart data={temporalData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="fecha" />
                    <YAxis
                      tickFormatter={(value) =>
                        metric === "monto" ? formatCompactMoney(value) : formatCompactNumber(value)
                      }
                    />
                    <Tooltip
                      formatter={(value) =>
                        metric === "monto"
                          ? [formatCompactMoney(value), "Monto"]
                          : [formatCompactNumber(value), "Total registros"]
                      }
                    />
                    <Line
                      dataKey="valor"
                      type="monotone"
                      stroke="#293E46"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Ultimos 12 meses">
                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={temporalData.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="fecha" />
                    <YAxis
                      tickFormatter={(value) =>
                        metric === "monto" ? formatCompactMoney(value) : formatCompactNumber(value)
                      }
                    />
                    <Tooltip
                      formatter={(value) =>
                        metric === "monto"
                          ? [formatCompactMoney(value), "Monto"]
                          : [formatCompactNumber(value), "Total registros"]
                      }
                    />
                    <Area
                      dataKey="valor"
                      type="monotone"
                      fill="#F6BA91"
                      stroke="#E75E0D"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>
          ) : null}

          {activePage === "reportes" ? (
            <>
              {Object.values(filters).some((v) =>
                Array.isArray(v) ? v.length > 0 : String(v || "").trim() !== ""
              ) ? (
                <div
                  className="glass-card"
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    Filtros activos
                  </span>
                  — Los reportes se generaran con el alcance actual de los filtros.
                  Limpia los filtros para exportar el universo completo.
                </div>
              ) : (
                <div
                  className="glass-card"
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                    Sin filtros activos
                  </span>
                  — Los reportes incluiran todos los registros del sistema.
                  Aplica filtros arriba para acotar el alcance.
                </div>
              )}
              <section className="reports-grid">
                <article className="glass-card report-card">
                  <h3>Top 10 por monto</h3>
                  <p>
                    Los 10 contratos de mayor valor segun los filtros activos. Ideal para revision
                    ejecutiva rapida.
                  </p>
                  <button className="primary-btn report-action-btn" onClick={exportTop10Csv}>
                    <Download size={16} /> CSV Top 10
                  </button>
                </article>

                <article className="glass-card report-card">
                  <h3>Excel completo filtrado</h3>
                  <p>
                    Todos los contratos que cumplen los filtros activos en una hoja de calculo
                    lista para pivot o analisis.
                  </p>
                  <button className="primary-btn report-action-btn" onClick={exportFullExcel}>
                    <FileSpreadsheet size={16} /> Excel completo
                  </button>
                </article>

                <article className="glass-card report-card">
                  <h3>Informe PDF ejecutivo</h3>
                  <p>
                    Resumen ejecutivo con KPIs, top entidades y graficos. Listo para presentaciones
                    y auditorias.
                  </p>
                  <button className="primary-btn report-action-btn" onClick={exportExecutivePdf}>
                    <FileText size={16} /> PDF ejecutivo
                  </button>
                </article>

                <article className="glass-card report-card">
                  <h3>CSV para analisis externo</h3>
                  <p>
                    Dataset filtrado en formato CSV plano. Compatible con Python, R, Power BI o
                    cualquier herramienta externa.
                  </p>
                  <button className="primary-btn report-action-btn" onClick={exportDashboardCsv}>
                    <Download size={16} /> CSV dataset
                  </button>
                </article>
              </section>
            </>
          ) : null}

          {activePage === "insights" ? (
            <>
              <section className="glass-card insight-controls">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ flex: 1, minWidth: 220 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Umbral de alerta</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>$</span>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={alertThreshold}
                        onChange={(event) => setAlertThreshold(Math.max(0, Number(event.target.value) || 0))}
                        style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-soft)", color: "var(--text-primary)", fontSize: 14, width: 160 }}
                      />
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatCompactMoney(alertThreshold)}</span>
                    </div>
                  </label>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, maxWidth: 340 }}>
                    Analisis sobre el <strong>dataset completo</strong>, no solo la pagina visible.
                    {insightsQuery.data ? (
                      <> Universo: <strong>{Number(insightsQuery.data.total_registros || 0).toLocaleString("es-EC")}</strong> contratos.</>
                    ) : null}
                  </p>
                </div>
              </section>

              {insightsQuery.isLoading ? (
                <section className="insight-grid">
                  {[1, 2, 3].map((n) => (
                    <article key={n} className="glass-card insight-card normal" style={{ minHeight: 120, opacity: 0.5 }} />
                  ))}
                </section>
              ) : insightsQuery.data ? (() => {
                const d = insightsQuery.data;
                const pctOut = Number(d.pct_outliers || 0);
                const outlierTone = pctOut > 10 ? "critical" : pctOut > 5 ? "warning" : "positive";
                const sobreTone = Number(d.total_sobre_umbral || 0) > 0 ? "critical" : "positive";
                const avgTone = Number(d.avg_monto || 0) > 150000 ? "critical" : "normal";
                return (
                  <section className="insight-grid">
                    <article className={`glass-card insight-card ${outlierTone}`}>
                      <h3>Outliers de monto (IQR)</h3>
                      <strong>{Number(d.total_outliers || 0).toLocaleString("es-EC")} contratos</strong>
                      <p>Umbral estadistico: {formatMoney(d.outlier_limit)}. Representa el {pctOut}% del total.</p>
                      <p>Q1: {formatMoney(d.q1)} · Q3: {formatMoney(d.q3)} · IQR: {formatMoney(d.iqr)}</p>
                    </article>
                    <article className={`glass-card insight-card ${sobreTone}`}>
                      <h3>Alerta por umbral ({formatCompactMoney(alertThreshold)})</h3>
                      <strong>{Number(d.total_sobre_umbral || 0).toLocaleString("es-EC")} contratos</strong>
                      <p>De {Number(d.total_positivos || 0).toLocaleString("es-EC")} contratos con valor positivo.</p>
                      <p>Ajusta el umbral arriba para focalizar la auditoria.</p>
                    </article>
                    <article className={`glass-card insight-card ${avgTone}`}>
                      <h3>Promedio por contrato</h3>
                      <strong>{formatMoney(d.avg_monto)}</strong>
                      <p>Maximo: {formatMoney(d.max_monto)} · Minimo: {formatMoney(d.min_monto)}</p>
                      <p>Calculado sobre {Number(d.total_registros || 0).toLocaleString("es-EC")} registros del dataset completo.</p>
                    </article>
                  </section>
                );
              })() : null}

              <section className="glass-card insight-history">
                <header>
                  <h3>Historial de alertas</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                      {alertsHistory.filter((item) => !item.read).length} no leidas de {alertsHistory.length}
                    </p>
                    {alertsHistory.some((item) => !item.read) && (
                      <button className="ghost-btn" style={{ fontSize: 12 }} onClick={markAllAlertsAsRead}>
                        Marcar todas leidas
                      </button>
                    )}
                    {alertsHistory.length > 0 && (
                      <button className="ghost-btn" style={{ fontSize: 12, color: "var(--danger, #d23f57)" }} onClick={clearAlertsHistory}>
                        Borrar historial
                      </button>
                    )}
                  </div>
                </header>

                {alertsHistory.length ? (
                  <div className="insight-history-list">
                    {alertsHistory.map((alert) => (
                      <article
                        key={alert.id}
                        className={`history-item ${alert.read ? "read" : "unread"}`}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{alert.title}</strong>
                          <p>{alert.reason}</p>
                          <small>{new Date(alert.createdAt).toLocaleString("es-EC")}</small>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {!alert.read && (
                            <button className="ghost-btn" style={{ fontSize: 12 }} onClick={() => markAlertAsRead(alert.id)}>
                              Leida
                            </button>
                          )}
                          <button
                            className="ghost-btn"
                            style={{ fontSize: 12, color: "var(--danger, #d23f57)" }}
                            onClick={() => deleteAlert(alert.id)}
                          >
                            Borrar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sin historial de alertas"
                    message="Cuando se detecten condiciones de riesgo apareceran aqui."
                  />
                )}
              </section>
            </>
          ) : null}

          {activePage === "comparador" ? (
            <section className="glass-card chart-card-modern comparator-panel">
              <header>
                <h3>Comparador flexible</h3>
                <p>Configura filtros, aplica y luego crea una o varias graficas con exportacion individual.</p>
              </header>

              <div
                className="comparator-filter-grid comparator-filter-grid-expanded"
                ref={comparatorFiltersGridRef}
              >
                {[
                  ["provincia", "Provincia"],
                  ["ciudad", "Ciudad"],
                  ["entidad", "Entidad"],
                  ["tipo_compra", "Tipo de compra"],
                  ["procedimiento", "Procedimiento"],
                ].map(([field, label]) => (
                  <details className="comparator-dropdown" key={field}>
                    <summary>
                      <span>{label}</span>
                      <small>
                        {comparatorFiltersDraft[field].length
                          ? `${comparatorFiltersDraft[field].length} seleccionados`
                          : "Sin seleccion"}
                      </small>
                      <ChevronDown size={16} className="comparator-dropdown-arrow" />
                    </summary>
                    <div className="comparator-dropdown-body">
                      <div className="comparator-dropdown-actions">
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() => handleComparatorSelectAll(field)}
                        >
                          Seleccionar todos
                        </button>
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() => handleComparatorClear(field)}
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="comparator-checklist">
                        {(comparatorFilterOptions[field] || []).length === 0 ? (
                          <div className="comparator-empty-options">Sin opciones disponibles</div>
                        ) : null}
                        {(comparatorFilterOptions[field] || []).map((item) => {
                          const checked = comparatorFiltersDraft[field].includes(item);
                          return (
                            <label key={item} className="comparator-check-item">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleComparatorListToggle(field, item)}
                              />
                              <span>{item}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                ))}

                <label className="comparator-input-box">
                  <span>Fecha inicio</span>
                  <input
                    type="date"
                    name="fecha_inicio"
                    value={comparatorFiltersDraft.fecha_inicio}
                    onChange={handleComparatorRangeChange}
                  />
                </label>

                <label className="comparator-input-box">
                  <span>Fecha fin</span>
                  <input
                    type="date"
                    name="fecha_fin"
                    value={comparatorFiltersDraft.fecha_fin}
                    onChange={handleComparatorRangeChange}
                  />
                </label>

                <label className="comparator-input-box">
                  <span>Monto minimo</span>
                  <input
                    type="number"
                    name="valor_min"
                    placeholder="0"
                    value={comparatorFiltersDraft.valor_min}
                    onChange={handleComparatorRangeChange}
                  />
                </label>

                <label className="comparator-input-box">
                  <span>Monto maximo</span>
                  <input
                    type="number"
                    name="valor_max"
                    placeholder="0"
                    value={comparatorFiltersDraft.valor_max}
                    onChange={handleComparatorRangeChange}
                  />
                </label>
              </div>

              <div className="comparator-filter-actions">
                <button className="primary-btn report-action-btn" onClick={applyComparatorFilters}>
                  Aplicar filtros comparador
                </button>
                <button className="ghost-btn" onClick={resetComparatorFilters}>
                  Limpiar filtros
                </button>
              </div>

              {comparatorFiltersFeedback ? (
                <div className="comparator-feedback">{comparatorFiltersFeedback}</div>
              ) : null}

              <div className="comparator-controls">
                <label>
                  Comparar por
                  <select
                    value={compareBy}
                    onChange={(event) => setCompareBy(event.target.value)}
                    disabled={isComparatorBusy}
                  >
                    <option value="Provincia">Provincia</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Entidad">Entidad</option>
                    <option value="Procedimiento">Procedimiento</option>
                    <option value="T_Compra">Tipo de compra</option>
                    <option value="Anio">Anio</option>
                    <option value="Mes">Mes</option>
                  </select>
                </label>
                <button className="ghost-btn comparator-add-btn" type="button" onClick={addComparatorSeries}>
                  <Plus size={16} /> Agregar grafica
                </button>
              </div>

              {hasComparatorCharts ? (
                <div className="comparator-series-grid">
                  {comparatorSeries.map((series, index) => {
                    const metricConfig = getComparatorMetricConfig(series.metric);
                    const seriesData = getComparatorSeriesData(series);
                    const displayOrder = index + 1;

                    return (
                      <article
                        className="glass-card comparator-series-card"
                        key={series.id}
                        id={`comparator-series-${series.id}`}
                      >
                        <header className="comparator-series-header">
                          {editingComparatorSeriesId === series.id ? (
                            <div className="comparator-series-title-edit">
                              <input
                                className="comparator-series-title"
                                value={editingComparatorTitle}
                                onChange={(event) => setEditingComparatorTitle(event.target.value)}
                                placeholder={`Grafica comparativa #${displayOrder}`}
                                autoFocus
                              />
                              <button
                                className="ghost-btn"
                                type="button"
                                onClick={() => saveEditComparatorTitle(series)}
                              >
                                <Check size={16} /> Guardar
                              </button>
                              <button className="ghost-btn" type="button" onClick={cancelEditComparatorTitle}>
                                <X size={16} /> Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="comparator-series-title-row">
                              <h4 className="comparator-series-title-text">
                                {series.title || `Comparativa ${displayOrder}`}
                              </h4>
                              <button
                                className="icon-button comparator-edit-icon"
                                type="button"
                                onClick={() => startEditComparatorTitle(series)}
                                title="Editar titulo"
                                aria-label="Editar titulo"
                              >
                                <Pencil size={16} />
                              </button>
                            </div>
                          )}
                          <div className="comparator-series-actions">
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => setExpandedComparatorSeriesId(series.id)}
                            >
                              Ver detalle
                            </button>
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => exportComparatorSeriesImage(series.id, series.title, "card")}
                            >
                              <Download size={16} /> Imagen
                            </button>
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => exportComparatorSeriesPdf(series, "card")}
                            >
                              <FileText size={16} /> Informe
                            </button>
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => removeComparatorSeries(series.id)}
                            >
                              <Trash2 size={16} /> Quitar
                            </button>
                          </div>
                        </header>

                        <div className="comparator-series-controls">
                          <label>
                            Metrica
                            <select
                              value={series.metric}
                              onChange={(event) =>
                                updateComparatorSeries(series.id, "metric", event.target.value)
                              }
                              disabled={isComparatorBusy}
                            >
                              <option value="monto">Monto total</option>
                              <option value="registros">Total registros</option>
                              <option value="promedio">Promedio por contrato</option>
                              <option value="maximo">Monto maximo</option>
                              <option value="minimo">Monto minimo</option>
                            </select>
                          </label>

                          <label>
                            Top
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={series.top}
                              onChange={(event) =>
                                updateComparatorSeries(
                                  series.id,
                                  "top",
                                  Math.max(0, Number(event.target.value || 0))
                                )
                              }
                              disabled={isComparatorBusy}
                            />
                          </label>

                          <label>
                            Tipo de grafica
                            <select
                              value={series.chartType}
                              onChange={(event) =>
                                updateComparatorSeries(series.id, "chartType", event.target.value)
                              }
                              disabled={isComparatorBusy}
                            >
                              <option value="bar">Barras</option>
                              <option value="barH">Barras horizontales</option>
                              <option value="line">Linea</option>
                              <option value="area">Area</option>
                              <option value="pie">Pastel</option>
                            </select>
                          </label>
                        </div>

                        <div
                          className="comparator-chart-preview"
                          data-comparator-capture={series.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedComparatorSeriesId(series.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setExpandedComparatorSeriesId(series.id);
                            }
                          }}
                        >
                          {renderComparatorChart(series, metricConfig, seriesData, 320)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Aun no hay comparacion"
                  message="Usa Agregar grafica para crear visualizaciones. Los filtros son opcionales — sin filtros se compara el universo completo."
                />
              )}
            </section>
          ) : null}

          {activePage === "entidad" ? (
            <>
              {/* Dedicated entity search bar */}
              <section className="glass-card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div ref={entitySearchRef} style={{ flex: 1, minWidth: 260, position: "relative" }}>
                    <input
                      value={entitySearchInput}
                      onChange={(e) => {
                        setEntitySearchInput(e.target.value);
                        setShowEntityDropdown(true);
                      }}
                      onFocus={() => setShowEntityDropdown(true)}
                      placeholder="Escribe el nombre de la entidad..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-soft)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const match = (catalogos?.entidades || []).find(
                            (ent) => ent.toLowerCase() === entitySearchInput.toLowerCase()
                          ) || entitySearchInput.trim();
                          if (match) {
                            setFilters({ entidad: match });
                            setEntitySearchInput(match);
                            setShowEntityDropdown(false);
                          }
                        }
                        if (e.key === "Escape") setShowEntityDropdown(false);
                      }}
                    />
                    {showEntityDropdown && entitySearchInput.length >= 2 && (() => {
                      const opts = (catalogos?.entidades || [])
                        .filter((e) => e.toLowerCase().includes(entitySearchInput.toLowerCase()))
                        .slice(0, 20);
                      if (!opts.length) return null;
                      return (
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 9000,
                          background: "var(--bg-panel)",
                          border: "1px solid var(--line)",
                          borderRadius: "var(--radius-sm)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                          maxHeight: 320,
                          overflowY: "auto",
                          marginTop: 4,
                        }}>
                          {opts.map((ent) => (
                            <div
                              key={ent}
                              onMouseDown={() => {
                                setFilters({ entidad: ent });
                                setEntitySearchInput(ent);
                                setShowEntityDropdown(false);
                              }}
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                cursor: "pointer",
                                borderBottom: "1px solid var(--line)",
                                color: "var(--text-primary)",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-soft)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              {ent}
                            </div>
                          ))}
                          {(catalogos?.entidades || []).filter((e) => e.toLowerCase().includes(entitySearchInput.toLowerCase())).length > 20 && (
                            <div style={{ padding: "8px 14px", fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
                              Refinando mas la busqueda para ver el resto...
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    style={{
                      padding: "10px 20px",
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                      const match = (catalogos?.entidades || []).find(
                        (ent) => ent.toLowerCase() === entitySearchInput.toLowerCase()
                      ) || entitySearchInput.trim();
                      if (match) {
                        setFilters({ entidad: match });
                        setEntitySearchInput(match);
                        setShowEntityDropdown(false);
                      }
                    }}
                  >
                    Buscar entidad
                  </button>
                  {selectedEntity && (
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        setFilters({});
                        setEntitySearchInput("");
                        setShowEntityDropdown(false);
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                {!selectedEntity && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                    {(catalogos?.entidades || []).length > 0
                      ? `${(catalogos?.entidades || []).length} entidades disponibles. Escribe al menos 2 caracteres para filtrar.`
                      : "Escribe el nombre de la entidad contratante."}
                  </p>
                )}
              </section>

              {!selectedEntity ? (
                <EmptyState
                  title="Busca una entidad"
                  message="Escribe el nombre de la entidad contratante en el buscador y pulsa 'Buscar entidad' para ver su perfil completo."
                />
              ) : hasNoResults ? (
                <EmptyState
                  title={`Sin datos para "${selectedEntity}"`}
                  message="No se encontraron contratos para esta entidad con los filtros actuales. Verifica el nombre o intenta con otra entidad."
                />
              ) : (() => {
                const entityMontoTotal = pacData.reduce((acc, item) => acc + Number(item.V_Total_Numeric || 0), 0);
                const entityMontoMax = pacData.length ? Math.max(...pacData.map((item) => Number(item.V_Total_Numeric || 0))) : 0;
                const entityMontoMin = pacData.length ? Math.min(...pacData.filter((item) => Number(item.V_Total_Numeric || 0) > 0).map((item) => Number(item.V_Total_Numeric || 0))) : 0;
                const entityProvincias = [...new Set(pacData.map((item) => item.Provincia).filter(Boolean))];
                const entityCiudades = [...new Set(pacData.map((item) => item.Ciudad).filter(Boolean))];
                const entityProcedures = [...new Set(pacData.map((item) => item.Procedimiento).filter(Boolean))];
                const entityTiposCompra = [...new Set(pacData.map((item) => item.T_Compra).filter(Boolean))];
                const entityPeriodos = [...new Set(pacData.map((item) => item.Periodo).filter(Boolean))].sort().reverse();
                return (
                  <div className="page-stack">
                    {/* Metrics strip */}
                    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      {[
                        { label: "Contratos cargados", value: pacData.length.toLocaleString("es-EC") },
                        { label: "Monto acumulado", value: formatMoney(entityMontoTotal) },
                        { label: "Promedio por contrato", value: pacData.length ? formatMoney(entityMontoTotal / pacData.length) : "—" },
                        { label: "Contrato mas alto", value: formatMoney(entityMontoMax) },
                        { label: "Contratos minimos", value: entityMontoMin ? formatMoney(entityMontoMin) : "—" },
                        { label: "Periodos", value: entityPeriodos.length > 0 ? entityPeriodos.slice(0, 3).join(", ") : "—" },
                      ].map(({ label, value }) => (
                        <article key={label} className="glass-card" style={{ padding: "14px 16px" }}>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                        </article>
                      ))}
                    </section>

                    {/* Location + procedures info */}
                    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      <article className="glass-card" style={{ padding: "16px 20px" }}>
                        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Ubicacion</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Provincias: </span>
                            <span>{entityProvincias.length ? entityProvincias.join(", ") : "—"}</span>
                          </div>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Ciudades: </span>
                            <span>{entityCiudades.length ? entityCiudades.join(", ") : "—"}</span>
                          </div>
                        </div>
                      </article>
                      <article className="glass-card" style={{ padding: "16px 20px" }}>
                        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Modalidades</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Tipos de compra: </span>
                            <span>{entityTiposCompra.length ? entityTiposCompra.join(", ") : "—"}</span>
                          </div>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Procedimientos: </span>
                            <span>{entityProcedures.length ? `${entityProcedures.length} tipos` : "—"}</span>
                          </div>
                        </div>
                      </article>
                    </section>

                    {/* Procedure chart */}
                    <article className="glass-card chart-card-modern">
                      <header>
                        <h3>Distribucion por procedimiento</h3>
                        <p>Desglose de contratos por tipo de procedimiento segun los registros cargados.</p>
                      </header>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={entityProcedureData} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                          <XAxis dataKey="procedimiento_corto" interval={0} angle={-18} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(value) => metric === "monto" ? formatCompactMoney(value) : formatCompactNumber(value)} />
                          <Tooltip
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.Procedimiento || ""}
                            formatter={(value) => metric === "monto" ? [formatCompactMoney(value), "Monto total"] : [Number(value || 0).toLocaleString("es-EC"), "Total registros"]}
                          />
                          <Bar dataKey={metric === "monto" ? "monto_total" : "total_registros"} fill="#E75E0D" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </article>

                    {/* Contracts table */}
                    <article className="glass-card" style={{ padding: "20px 24px" }}>
                      <header style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 17 }}>Contratos ({pacData.length.toLocaleString("es-EC")} registros cargados)</h3>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                          Muestra los primeros {Math.min(pacData.length, 50)} contratos de la pagina actual. Usa Vista Detallada para busqueda avanzada y exportacion.
                        </p>
                      </header>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--line)" }}>
                              {["#", "Nro.", "Descripcion", "Procedimiento", "Tipo compra", "Monto", "Periodo", "Ciudad"].map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pacData.slice(0, 50).map((item, idx) => (
                              <tr key={item.id || idx} style={{ borderBottom: "1px solid var(--line)" }}>
                                <td style={{ padding: "8px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{idx + 1}</td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{item.Nro || "—"}</td>
                                <td style={{ padding: "8px 10px", maxWidth: 320 }}>
                                  <div style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }} title={item.Descripcion}>
                                    {item.Descripcion || "—"}
                                  </div>
                                </td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{item.Procedimiento || "—"}</td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{item.T_Compra || "—"}</td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontWeight: 600 }}>{formatMoney(item.V_Total_Numeric)}</td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{item.Periodo || "—"}</td>
                                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{item.Ciudad || item.Provincia || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {pacData.length > 50 && (
                        <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
                          Mostrando 50 de {pacData.length.toLocaleString("es-EC")} contratos. Ve a <strong>Vista Detallada</strong> para ver todos con filtros y exportacion.
                        </p>
                      )}
                    </article>
                  </div>
                );
              })()}
            </>
          ) : null}

          {activePage === "configuracion" ? (
            <section className="settings-grid">
              <article className="glass-card setting-card">
                <h3>Tema visual</h3>
                <p>Selecciona el modo que mejor se adapte a tu flujo de trabajo.</p>
                <div className="settings-actions">
                  <button className="ghost-btn" onClick={() => setTheme("light")}>
                    <Sun size={16} /> Claro
                  </button>
                  <button className="ghost-btn" onClick={() => setTheme("dark")}>
                    <Moon size={16} /> Oscuro
                  </button>
                </div>
                <small>Tema actual: {isDark ? "Oscuro" : "Claro"}</small>
              </article>

              <article className="glass-card setting-card">
                <h3>Preferencias de usuario</h3>
                <p>Define la experiencia de uso para sesiones futuras.</p>
                <ul>
                  <li>Persistencia de filtros guardados: activa.</li>
                  <li>Favoritos de contratos: {bookmarks.length} elementos.</li>
                  <li>Animaciones UI: activas.</li>
                </ul>
              </article>
            </section>
          ) : null}
        </div>
      </AnimatePresence>

      {filtersLoading ? <div className="floating-loader">Actualizando datos...</div> : null}

      {isComparatorBusy ? (
        <div className="comparator-modal-overlay" role="dialog" aria-modal="true">
          <div className="comparator-modal">
            <h3>Cargando grafico</h3>
            <p>Estamos procesando filtros y actualizando el comparador. Espera un momento...</p>
          </div>
        </div>
      ) : null}

      {expandedComparatorSeriesId !== null ? (
        (() => {
          const activeSeries = comparatorSeries.find((item) => item.id === expandedComparatorSeriesId);
          if (!activeSeries) return null;
          const metricConfig = getComparatorMetricConfig(activeSeries.metric);
          const seriesData = getComparatorSeriesData(activeSeries);
          const totalMonto = seriesData.reduce((acc, item) => acc + Number(item.monto || 0), 0);
          const totalRegistros = seriesData.reduce((acc, item) => acc + Number(item.registros || 0), 0);
          const promedioGeneral = totalRegistros ? totalMonto / totalRegistros : 0;
          const topMonto = seriesData.length
            ? Math.max(...seriesData.map((item) => Number(item.monto || 0)))
            : 0;
          const filteredSeriesData = seriesData.filter((item) =>
            normalizeText(item.name).includes(normalizeText(expandedComparatorSearch))
          );
          const sortedSeriesData = [...filteredSeriesData].sort((a, b) => {
            const direction = expandedComparatorSort.direction === "asc" ? 1 : -1;
            if (expandedComparatorSort.key === "name") {
              return direction * String(a.name || "").localeCompare(String(b.name || ""), "es");
            }
            return (
              direction *
              (Number(a[expandedComparatorSort.key] || 0) - Number(b[expandedComparatorSort.key] || 0))
            );
          });

          return (
            <div className="comparator-modal-overlay" role="dialog" aria-modal="true">
              <div className="comparator-modal comparator-modal-expanded">
                <header className="comparator-expanded-header">
                  <div>
                    <h3>{activeSeries.title || "Comparativa"}</h3>
                    <p>
                      Dimension: {compareBy} | Metrica: {metricConfig.label} | Top: {activeSeries.top === 0 ? "Sin limite" : activeSeries.top}
                    </p>
                  </div>
                  <button className="ghost-btn" onClick={() => setExpandedComparatorSeriesId(null)}>
                    Cerrar
                  </button>
                </header>

                <div className="comparator-expanded-content">
                  <div className="comparator-expanded-chart">
                    <div data-comparator-expanded-capture={activeSeries.id}>
                      {renderComparatorChart(activeSeries, metricConfig, seriesData, 520)}
                    </div>
                  </div>

                  <div className="comparator-expanded-side">
                    <div className="comparator-expanded-kpis">
                      <article className="comparator-kpi">
                        <span>Total monto</span>
                        <strong>{formatMoney(totalMonto)}</strong>
                      </article>
                      <article className="comparator-kpi">
                        <span>Total registros</span>
                        <strong>{Number(totalRegistros || 0).toLocaleString("es-EC")}</strong>
                      </article>
                      <article className="comparator-kpi">
                        <span>Promedio general</span>
                        <strong>{formatMoney(promedioGeneral)}</strong>
                      </article>
                      <article className="comparator-kpi">
                        <span>Maximo de la serie</span>
                        <strong>{formatMoney(topMonto)}</strong>
                      </article>
                    </div>

                    <div className="comparator-expanded-actions">
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() =>
                          exportComparatorSeriesImage(activeSeries.id, activeSeries.title, "expanded")
                        }
                      >
                        <Download size={16} /> Imagen
                      </button>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => exportComparatorSeriesPdf(activeSeries, "expanded")}
                      >
                        <FileText size={16} /> Informe PDF
                      </button>
                    </div>

                    <div className="comparator-expanded-search">
                      <input
                        type="text"
                        placeholder={`Buscar por ${compareBy.toLowerCase()}...`}
                        value={expandedComparatorSearch}
                        onChange={(event) => setExpandedComparatorSearch(event.target.value)}
                      />
                    </div>

                    <div className="comparator-expanded-table-shell">
                      <table className="comparator-table">
                        <thead>
                          <tr>
                            <th>
                              <button className="th-button" onClick={() => toggleExpandedSort("name")}>
                                {compareBy}
                              </button>
                            </th>
                            <th>
                              <button className="th-button" onClick={() => toggleExpandedSort("registros")}>
                                Registros
                              </button>
                            </th>
                            <th>
                              <button className="th-button" onClick={() => toggleExpandedSort("monto")}>
                                Monto total
                              </button>
                            </th>
                            <th>
                              <button className="th-button" onClick={() => toggleExpandedSort("promedio")}>
                                Promedio
                              </button>
                            </th>
                            <th>Participacion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSeriesData.map((item) => (
                            <tr key={item.name}>
                              <td>{item.name}</td>
                              <td>{Number(item.registros || 0).toLocaleString("es-EC")}</td>
                              <td>{formatMoney(item.monto)}</td>
                              <td>{formatMoney(item.promedio)}</td>
                              <td>{totalMonto ? `${((Number(item.monto || 0) / totalMonto) * 100).toFixed(1)}%` : "0.0%"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
