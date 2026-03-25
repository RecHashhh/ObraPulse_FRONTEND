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
  getDashboardContextual,
  getEntidadesPorProvincia,
  getPac,
  getTopCiudades,
  getTopProvincias,
  getTopEntidadesPorProvincia,
} from "../api/pacApi";
import FilterPanel from "../components/ui/FilterPanel";
import FilterChips from "../components/ui/FilterChips";
import SkeletonCards from "../components/ui/SkeletonCards";
import EmptyState from "../components/EmptyState";
import { useTheme } from "../context/ThemeContext";

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
  const [filters, setFilters] = useState({});
  const [catalogos, setCatalogos] = useState({});
  const [dashboardData, setDashboardData] = useState(null);

  const [pacData, setPacData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedProvince, setSelectedProvince] = useState("");
  const [entitiesPage, setEntitiesPage] = useState(1);
  const [filtersWarning, setFiltersWarning] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(500000);
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

  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pac.bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  const { isDark, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const nextComparatorSeriesId = useRef(2);
  const comparatorFiltersGridRef = useRef(null);

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

  const comparatorSourceQuery = useQuery({
    queryKey: ["comparator-source", comparatorBaseFilters],
    queryFn: async () => {
      let page = 1;
      let total = 0;
      const allItems = [];

      while (page <= COMPARATOR_MAX_PAGES) {
        const response = await getPac({
          ...comparatorBaseFilters,
          page,
          page_size: COMPARATOR_PAGE_SIZE,
        });

        const items = response?.items || [];
        total = Number(response?.total || 0);
        allItems.push(...items);

        if (!items.length) break;
        if (items.length < COMPARATOR_PAGE_SIZE) break;
        if (total > 0 && allItems.length >= total) break;

        page += 1;
      }

      return {
        items: allItems,
        total,
      };
    },
    enabled:
      activePage === "comparador" &&
      comparatorSeries.length > 0 &&
      (Boolean(comparatorFiltersApplied.provincia?.length) ||
        Boolean(comparatorFiltersApplied.ciudad?.length) ||
        Boolean(comparatorFiltersApplied.entidad?.length) ||
        Boolean(comparatorFiltersApplied.tipo_compra?.length) ||
        Boolean(comparatorFiltersApplied.procedimiento?.length) ||
        Boolean(String(comparatorFiltersApplied.fecha_inicio || "").trim()) ||
        Boolean(String(comparatorFiltersApplied.fecha_fin || "").trim()) ||
        Boolean(String(comparatorFiltersApplied.valor_min || "").trim()) ||
        Boolean(String(comparatorFiltersApplied.valor_max || "").trim())),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: false,
    refetchOnReconnect: false,
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

  const comparatorSourceRows = comparatorSourceQuery.data?.items?.length
    ? comparatorSourceQuery.data.items
    : pacData;

  const comparatorFilterOptions = useMemo(
    () => {
      const fromRows = {
        provincia: [...new Set(comparatorSourceRows.map((item) => item.Provincia).filter(Boolean))],
        ciudad: [...new Set(comparatorSourceRows.map((item) => item.Ciudad).filter(Boolean))],
        entidad: [...new Set(comparatorSourceRows.map((item) => item.Entidad).filter(Boolean))],
        tipo_compra: [...new Set(comparatorSourceRows.map((item) => item.T_Compra).filter(Boolean))],
        procedimiento: [...new Set(comparatorSourceRows.map((item) => item.Procedimiento).filter(Boolean))],
      };

      return {
        provincia: (catalogos?.provincias || fromRows.provincia).sort((a, b) => a.localeCompare(b, "es")),
        ciudad: (catalogos?.ciudades || fromRows.ciudad).sort((a, b) => a.localeCompare(b, "es")),
        entidad: (catalogos?.entidades || fromRows.entidad).sort((a, b) => a.localeCompare(b, "es")),
        tipo_compra: (catalogos?.tipos_compra || fromRows.tipo_compra).sort((a, b) => a.localeCompare(b, "es")),
        procedimiento: (catalogos?.procedimientos || fromRows.procedimiento).sort((a, b) => a.localeCompare(b, "es")),
      };
    },
    [catalogos, comparatorSourceRows]
  );

  const comparatorFilteredRows = useMemo(() => {
    const minValue = comparatorFiltersApplied.valor_min === "" ? null : Number(comparatorFiltersApplied.valor_min);
    const maxValue = comparatorFiltersApplied.valor_max === "" ? null : Number(comparatorFiltersApplied.valor_max);
    const startDate = comparatorFiltersApplied.fecha_inicio
      ? new Date(comparatorFiltersApplied.fecha_inicio)
      : null;
    const endDate = comparatorFiltersApplied.fecha_fin
      ? new Date(comparatorFiltersApplied.fecha_fin)
      : null;

    return comparatorSourceRows.filter((item) => {
      if (
        comparatorFiltersApplied.provincia?.length &&
        !comparatorFiltersApplied.provincia.includes(item.Provincia)
      ) {
        return false;
      }
      if (
        comparatorFiltersApplied.ciudad?.length &&
        !comparatorFiltersApplied.ciudad.includes(item.Ciudad)
      ) {
        return false;
      }
      if (
        comparatorFiltersApplied.entidad?.length &&
        !comparatorFiltersApplied.entidad.includes(item.Entidad)
      ) {
        return false;
      }
      if (
        comparatorFiltersApplied.tipo_compra?.length &&
        !comparatorFiltersApplied.tipo_compra.includes(item.T_Compra)
      ) {
        return false;
      }
      if (
        comparatorFiltersApplied.procedimiento?.length &&
        !comparatorFiltersApplied.procedimiento.includes(item.Procedimiento)
      ) {
        return false;
      }

      const amount = Number(item.V_Total_Numeric || 0);
      if (minValue !== null && amount < minValue) return false;
      if (maxValue !== null && amount > maxValue) return false;

      if (startDate || endDate) {
        const rowDate = item.Fecha_Carga ? new Date(item.Fecha_Carga) : null;
        if (!rowDate || Number.isNaN(rowDate.getTime())) return false;
        if (startDate && rowDate < startDate) return false;
        if (endDate && rowDate > endDate) return false;
      }

      return true;
    });
  }, [comparatorFiltersApplied, comparatorSourceRows]);

  const comparatorBaseData = useMemo(() => {
    const grouped = new Map();

    for (const item of comparatorFilteredRows) {
      let key = item?.[compareBy];
      if (compareBy === "Anio") {
        key = String(item?.Fecha_Carga || "").slice(0, 4);
      }
      if (compareBy === "Mes") {
        key = String(item?.Fecha_Carga || "").slice(0, 7);
      }

      key = key || `Sin ${compareBy.toLowerCase()}`;
      const previous = grouped.get(key) || {
        name: key,
        monto: 0,
        registros: 0,
        maximo: 0,
        minimo: Number.POSITIVE_INFINITY,
      };
      const monto = Number(item.V_Total_Numeric || 0);
      grouped.set(key, {
        name: key,
        monto: previous.monto + monto,
        registros: previous.registros + 1,
        maximo: Math.max(previous.maximo, monto),
        minimo: Math.min(previous.minimo, monto),
      });
    }

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        promedio: item.registros ? item.monto / item.registros : 0,
        minimo: Number.isFinite(item.minimo) ? item.minimo : 0,
        shortName: truncateLabel(item.name, 20),
      }));
  }, [compareBy, comparatorFilteredRows]);

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

  const selectedEntity =
    filters.entidad || pacData[0]?.Entidad || "Selecciona una entidad en filtros";

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

  const addBookmark = (item) => {
    const next = [
      ...bookmarks.filter((bookmark) => bookmark.id !== item.id),
      {
        id: item.id,
        entidad: item.Entidad,
        provincia: item.Provincia,
        valor: item.V_Total_Numeric,
      },
    ];

    setBookmarks(next);
    localStorage.setItem("pac.bookmarks", JSON.stringify(next));
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
    const blob = await downloadPacExcel(filters);
    saveBlob(blob, buildExportFileName("reporte-completo", filters, "xlsx"));
  };

  const exportDetalleExcel = async () => {
    const blob = await downloadPacExcel(filters);
    saveBlob(blob, buildExportFileName("detalle-filtrado", filters, "xlsx"));
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
    const blob = await downloadPacCsv(filters);
    saveBlob(blob, buildExportFileName("dashboard", filters, "csv"));
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

  if (initialLoading) {
    return (
      <div className="page-stack">
        <SkeletonCards />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-banner">
        <div>
          <h2>Plataforma Inteligente de Contratacion Publica</h2>
          <p>
            Diseñada para exploracion ejecutiva, seguimiento territorial y decisiones
            basadas en datos.
          </p>
        </div>

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
      </section>

      {activePage !== "configuracion" && activePage !== "comparador" ? (
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

      {activePage !== "configuracion" && activePage !== "comparador" && filtersWarning ? (
        <div className="filters-warning">{filtersWarning}</div>
      ) : null}

      <AnimatePresence mode="wait">
        <div
          key={activePage}
          className="page-stack"
        >
          {hasNoResults ? (
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
                  onAddBookmark={addBookmark}
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

              <ChartCard title="Comparativa anual (simulada)">
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
            <section className="reports-grid">
              <article className="glass-card report-card">
                <h3>CSV Top 10</h3>
                <p>
                  Usa filtros para definir universo y descarga solo los 10 contratos de mayor monto.
                </p>
                <button className="primary-btn report-action-btn" onClick={exportTop10Csv}>
                  <Download size={16} /> CSV Top 10
                </button>
              </article>

              <article className="glass-card report-card">
                <h3>Excel Completo Filtrado</h3>
                <p>
                  Exporta en Excel todos los registros que cumplen los filtros seleccionados.
                </p>
                <button className="primary-btn report-action-btn" onClick={exportFullExcel}>
                  <FileSpreadsheet size={16} /> Excel Completo
                </button>
              </article>

              <article className="glass-card report-card">
                <h3>PDF Ejecutivo</h3>
                <p>
                  Genera un resumen ejecutivo con KPIs y top entidades segun los filtros activos.
                </p>
                <button className="primary-btn report-action-btn" onClick={exportExecutivePdf}>
                  <FileText size={16} /> PDF Ejecutivo
                </button>
              </article>

              <article className="glass-card report-card">
                <h3>Exportar Dashboard</h3>
                <p>
                  Descarga en CSV el dataset filtrado para analisis adicional fuera de la plataforma.
                </p>
                <button className="primary-btn report-action-btn" onClick={exportDashboardCsv}>
                  <Download size={16} /> CSV Dashboard
                </button>
              </article>
            </section>
          ) : null}

          {activePage === "insights" ? (
            <>
              <section className="glass-card insight-controls">
                <label>
                  Umbral de alerta ({formatMoney(alertThreshold)})
                  <input
                    type="range"
                    min={10000}
                    max={2000000}
                    step={10000}
                    value={alertThreshold}
                    onChange={(event) => setAlertThreshold(Number(event.target.value))}
                  />
                </label>
              </section>

              <section className="insight-grid">
                {insights.map((item) => (
                  <article key={item.id} className={`glass-card insight-card ${item.tone}`}>
                    <h3>{item.title}</h3>
                    <strong>{item.value}</strong>
                    <p>{item.reason}</p>
                    <p>{item.recommendation}</p>
                  </article>
                ))}
              </section>

              <section className="glass-card insight-history">
                <header>
                  <h3>Historial de alertas</h3>
                  <p>
                    {alertsHistory.filter((item) => !item.read).length} no leidas de {alertsHistory.length}
                  </p>
                </header>

                {alertsHistory.length ? (
                  <div className="insight-history-list">
                    {alertsHistory.map((alert) => (
                      <article
                        key={alert.id}
                        className={`history-item ${alert.read ? "read" : "unread"}`}
                      >
                        <div>
                          <strong>{alert.title}</strong>
                          <p>{alert.reason}</p>
                          <small>{new Date(alert.createdAt).toLocaleString("es-EC")}</small>
                        </div>
                        {!alert.read ? (
                          <button className="ghost-btn" onClick={() => markAlertAsRead(alert.id)}>
                            Marcar leida
                          </button>
                        ) : null}
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

              {hasComparatorSelection && hasComparatorCharts ? (
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
                  message="Selecciona filtros, pulsa Aplicar filtros comparador y luego usa Agregar grafica para crear visualizaciones."
                />
              )}
            </section>
          ) : null}

          {activePage === "entidad" ? (
            <section className="entity-layout">
              <article className="glass-card entity-profile">
                <h3>{selectedEntity}</h3>
                <p>
                  Perfil dinamico de entidad: comportamiento de montos, presencia territorial
                  y volumen de contrataciones.
                </p>
                <div className="entity-metrics">
                  <div>
                    <span>Contratos visibles</span>
                    <strong>{pacData.length}</strong>
                  </div>
                  <div>
                    <span>Monto acumulado</span>
                    <strong>
                      {formatMoney(
                        pacData.reduce(
                          (acc, item) => acc + Number(item.V_Total_Numeric || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="glass-card chart-card-modern">
                <header>
                  <h3>Distribucion por procedimiento</h3>
                </header>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={entityProcedureData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis
                      dataKey="procedimiento_corto"
                      interval={0}
                      angle={-16}
                      textAnchor="end"
                      height={72}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        metric === "monto" ? formatCompactMoney(value) : formatCompactNumber(value)
                      }
                    />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.Procedimiento || ""}
                      formatter={(value) =>
                        metric === "monto"
                          ? [formatCompactMoney(value), "Monto total"]
                          : [Number(value || 0).toLocaleString("es-EC"), "Total registros"]
                      }
                    />
                    <Bar
                      dataKey={metric === "monto" ? "monto_total" : "total_registros"}
                      fill="#E75E0D"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </article>
            </section>
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
