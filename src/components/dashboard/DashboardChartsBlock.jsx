import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#293E46", "#E75E0D", "#5D727A", "#F08B4D", "#93A5AB", "#F6BA91"];

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(amount);
}

function truncateLabel(value, maxLength = 22) {
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

export default function DashboardChartsBlock({ principal, dashboardData, metric, temporalData }) {
  const principalData = (principal?.data || []).map((item) => ({
    ...item,
    nombre_corto: truncateLabel(item.nombre, 24),
  }));

  return (
    <>
      <section className="grid-2">
        <Card title={principal?.titulo || "Resumen principal"}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={principalData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  metric === "monto"
                    ? formatCompactMoney(value)
                    : Number(value || 0).toLocaleString("es-EC")
                }
              />
              <YAxis dataKey="nombre_corto" type="category" width={170} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.nombre || ""}
                formatter={(value) =>
                  metric === "monto"
                    ? [new Intl.NumberFormat("es-EC", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(value || 0)), "Monto total"]
                    : [Number(value || 0).toLocaleString("es-EC"), "Total registros"]
                }
              />
              <Bar
                dataKey={metric === "monto" ? "monto_total" : "total_registros"}
                radius={[0, 6, 6, 0]}
                fill="#293E46"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Distribucion por tipo de compra">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={dashboardData?.tipo_compra || []}
                dataKey="total_registros"
                nameKey="T_Compra"
                outerRadius={118}
              >
                {(dashboardData?.tipo_compra || []).map((item, index) => (
                  <Cell key={item.T_Compra} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <section className="grid-2">
        <Card title="Distribucion de montos">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardData?.histograma || []}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="rango" />
              <YAxis tickFormatter={(value) => Number(value || 0).toLocaleString("es-EC")} />
              <Tooltip formatter={(value) => [Number(value || 0).toLocaleString("es-EC"), "Total registros"]} />
              <Bar dataKey="total_registros" fill="#E75E0D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Evolucion temporal">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={temporalData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="fecha" />
              <YAxis
                tickFormatter={(value) =>
                  metric === "monto"
                    ? formatCompactMoney(value)
                    : Number(value || 0).toLocaleString("es-EC")
                }
              />
              <Tooltip
                formatter={(value) =>
                  metric === "monto"
                    ? [new Intl.NumberFormat("es-EC", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(value || 0)), "Monto total"]
                    : [Number(value || 0).toLocaleString("es-EC"), "Total registros"]
                }
              />
              <Area type="monotone" dataKey="valor" stroke="#293E46" fill="#F6BA91" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </section>
    </>
  );
}
