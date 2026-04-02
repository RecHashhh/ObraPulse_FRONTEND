import { downloadPacCsv, downloadPacExcel } from "../api/pacApi";
import { useLoading } from "../context/LoadingContext";

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ExportButtons({ filters }) {
  const { loading, setLoading } = useLoading();
  const exportCsv = async () => {
    try {
      setLoading(true);
      const blob = await downloadPacCsv(filters);
      saveBlob(blob, "pac_export.csv");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      setLoading(true);
      const blob = await downloadPacExcel(filters);
      saveBlob(blob, "pac_export.xlsx");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="export-buttons">
      <button onClick={exportCsv} disabled={loading}>Exportar CSV</button>
      <button onClick={exportExcel} disabled={loading}>Exportar Excel</button>
    </div>
  );
}