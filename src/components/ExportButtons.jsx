import { downloadPacCsv, downloadPacExcel } from "../api/pacApi";

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ExportButtons({ filters }) {
  const exportCsv = async () => {
    const blob = await downloadPacCsv(filters);
    saveBlob(blob, "pac_export.csv");
  };

  const exportExcel = async () => {
    const blob = await downloadPacExcel(filters);
    saveBlob(blob, "pac_export.xlsx");
  };

  return (
    <div className="export-buttons">
      <button onClick={exportCsv}>Exportar CSV</button>
      <button onClick={exportExcel}>Exportar Excel</button>
    </div>
  );
}