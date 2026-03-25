import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import EcuadorMap from "../ui/EcuadorMap";

function truncateLabel(value, maxLength = 16) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function Card({ title, subtitle, children }) {
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

export default function TerritorialOverviewBlock({
  principal,
  territorialLayer,
  onChangeLayer,
  selectedProvince,
  onSelectProvince,
  territorialRankingTitle,
  territorialRankingSubtitle,
  territorialRankingData,
  metric,
  formatMoney,
  formatCompactMoney,
}) {
  return (
    <section className="grid-2">
      <Card title="Mapa termico territorial" subtitle="Distribucion de monto por provincia">
        <div className="territorial-layer-toggle">
          <button
            className={territorialLayer === "monto" ? "active" : ""}
            onClick={() => onChangeLayer("monto")}
          >
            Monto total
          </button>
          <button
            className={territorialLayer === "contratos" ? "active" : ""}
            onClick={() => onChangeLayer("contratos")}
          >
            Contratos
          </button>
          <button
            className={territorialLayer === "promedio" ? "active" : ""}
            onClick={() => onChangeLayer("promedio")}
          >
            Promedio contrato
          </button>
        </div>
        <EcuadorMap
          data={principal?.data || []}
          metric={
            territorialLayer === "contratos"
              ? "registros"
              : territorialLayer === "promedio"
                ? "promedio"
                : "monto"
          }
          selectedProvince={selectedProvince}
          onProvinceSelect={onSelectProvince}
        />
      </Card>

      <Card title={territorialRankingTitle} subtitle={territorialRankingSubtitle}>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart
            data={(territorialRankingData || [])
              .map((item) => ({
                nombre: item.nombre,
                nombre_corto: truncateLabel(item.nombre, 18),
                valor:
                  metric === "registros"
                    ? Number(item.total_registros || 0)
                    : Number(item.monto_total || 0),
              }))
              .slice(0, 10)}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis
              dataKey="nombre_corto"
              interval={0}
              angle={-15}
              textAnchor="end"
              height={68}
            />
            <YAxis
              tickFormatter={(value) =>
                metric === "registros"
                  ? Number(value || 0).toLocaleString("es-EC")
                  : formatCompactMoney(value)
              }
            />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.nombre || ""}
              formatter={(value) =>
                metric === "registros"
                  ? [Number(value || 0).toLocaleString("es-EC"), "Total registros"]
                  : [`${formatCompactMoney(value)} (${formatMoney(value)})`, "Monto total"]
              }
            />
            <Bar dataKey="valor" fill="#293E46" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}
