export default function LoadingOverlay({ show, text = "Actualizando dashboard..." }) {
  if (!show) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-box">
        <div className="spinner"></div>
        <p>{text}</p>
      </div>
    </div>
  );
}