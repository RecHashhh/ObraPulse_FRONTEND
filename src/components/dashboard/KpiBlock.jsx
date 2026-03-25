import KpiGrid from "../ui/KpiGrid";

export default function KpiBlock({ kpis }) {
  return <KpiGrid kpis={kpis || {}} />;
}
