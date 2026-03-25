import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent, VisualMapComponent } from "echarts/components";
import { MapChart } from "echarts/charts";

echarts.use([MapChart, CanvasRenderer, TooltipComponent, VisualMapComponent]);

const MAP_NAME = "ecuador-provinces";
const LOCAL_GEOJSON_URL = `${import.meta.env.BASE_URL}maps/ecuador-adm1.geojson`;

function normalizeName(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function EcuadorMap({
  data = [],
  metric = "monto",
  selectedProvince = "",
  onProvinceSelect,
}) {
  const [mapReady, setMapReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  const [provinceAlias, setProvinceAlias] = useState({});

  useEffect(() => {
    let mounted = true;

    fetch(LOCAL_GEOJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `No se pudo cargar GeoJSON (${response.status} ${response.statusText || ""}) URL: ${response.url || LOCAL_GEOJSON_URL}`
          );
        }
        return response.json();
      })
      .then((geoJson) => {
        const features = (geoJson?.features || []).map((feature) => {
          const fallbackName =
            feature?.properties?.shapeName ||
            feature?.properties?.name ||
            feature?.properties?.NAME_1 ||
            "Provincia";

          return {
            ...feature,
            properties: {
              ...feature.properties,
              name: fallbackName,
            },
          };
        });

        const alias = Object.fromEntries(
          features.map((feature) => {
            const canonicalName = feature.properties.name;
            return [normalizeName(canonicalName), canonicalName];
          })
        );

        echarts.registerMap(MAP_NAME, {
          ...geoJson,
          features,
        });

        if (mounted) setMapReady(true);
        if (mounted) setProvinceAlias(alias);
      })
      .catch((error) => {
        if (mounted) {
          setHasError(true);
          setErrorDetail(error?.message || "Error desconocido al cargar GeoJSON local");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const valuesByProvince = useMemo(() => {
    const grouped = new Map();

    for (const item of data) {
      const provinceName = normalizeName(item.nombre || item.Provincia || "");
      if (!provinceName) continue;

      const value =
        metric === "monto"
          ? Number(item.monto_total || item.V_Total_Numeric || 0)
          : Number(item.total_registros || 0);

      grouped.set(provinceName, (grouped.get(provinceName) || 0) + value);
    }

    return grouped;
  }, [data, metric]);

  const seriesData = useMemo(() => {
    return [...valuesByProvince.entries()].map(([name, value]) => ({
      name: provinceAlias[name] || name,
      value,
      selected:
        normalizeName(provinceAlias[name] || name) === normalizeName(selectedProvince),
    }));
  }, [provinceAlias, selectedProvince, valuesByProvince]);

  const ranking = useMemo(() => {
    return [...seriesData]
      .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [seriesData]);

  const rankByName = useMemo(() => {
    return new Map(ranking.map((item) => [item.name, item.rank]));
  }, [ranking]);

  const totalValue = useMemo(
    () => seriesData.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [seriesData]
  );

  const maxValue = Math.max(...seriesData.map((item) => item.value), 1);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const value = Number(params.value || 0);
          if (!value) return `${params.name}<br/>Sin datos`;

          const rank = rankByName.get(params.name) || "-";
          const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0.0";

          const valueLabel =
            metric === "monto"
              ? formatMoney(value)
              : `${value.toLocaleString("es-EC")} registros`;

          return [
            `<strong>${params.name}</strong>`,
            `Valor: ${valueLabel}`,
            `Ranking nacional: #${rank}`,
            `Participacion: ${pct}%`,
          ].join("<br/>");
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        left: 8,
        bottom: 8,
        orient: "horizontal",
        calculable: true,
        inRange: {
          color: ["#f8e0d1", "#f4b68f", "#E75E0D", "#293E46"],
        },
        text: ["Alto", "Bajo"],
      },
      series: [
        {
          name: "Provincias",
          type: "map",
          map: MAP_NAME,
          roam: true,
          selectedMode: "single",
          data: seriesData,
          nameMap: {
            "Santo Domingo": "Santo Domingo de los Tsachilas",
          },
          select: {
            label: { show: true, color: "#0f172a" },
            itemStyle: {
              areaColor: "#293E46",
              borderColor: "#1E2E34",
              borderWidth: 1.4,
            },
          },
          emphasis: {
            label: { show: true, color: "#0f172a" },
            itemStyle: {
              areaColor: "#E75E0D",
            },
          },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1,
          },
        },
      ],
    }),
    [maxValue, metric, rankByName, seriesData, totalValue]
  );

  const onEvents = useMemo(
    () => ({
      click: (params) => {
        if (onProvinceSelect) {
          onProvinceSelect(params?.name || "");
        }
      },
    }),
    [onProvinceSelect]
  );

  if (hasError) {
    return (
      <div className="map-fallback">
        <div>
          <p>
            No se pudo cargar el mapa local de Ecuador. Verifica el archivo
            public/maps/ecuador-adm1.geojson.
          </p>
          <small>{errorDetail}</small>
        </div>
      </div>
    );
  }

  if (!mapReady) {
    return <div className="map-fallback">Cargando mapa de Ecuador...</div>;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 360, width: "100%" }}
      onEvents={onEvents}
    />
  );
}
