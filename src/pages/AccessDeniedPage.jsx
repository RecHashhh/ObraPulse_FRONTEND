import { useMsal } from "@azure/msal-react";

export default function AccessDeniedPage() {
  const { instance, accounts } = useMsal();
  const email = accounts[0]?.username || accounts[0]?.name || "";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 0% 0%, rgba(41,62,70,0.14), transparent 32%), radial-gradient(circle at 100% 20%, rgba(231,94,13,0.11), transparent 42%), var(--bg-main, #f3f6fb)",
      padding: 24,
    }}>
      <div style={{
        background: "var(--bg-panel, #ffffff)",
        border: "1px solid color-mix(in srgb, var(--danger, #d23f57) 25%, var(--line, #d5dfed))",
        borderRadius: 20,
        padding: "36px 32px",
        width: "100%",
        maxWidth: 400,
        textAlign: "center",
        boxShadow: "var(--shadow-soft, 0 18px 40px rgba(24,45,74,0.1))",
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg, var(--accent, #293E46), var(--accent-2, #E75E0D))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: 16,
          color: "#fff",
          margin: "0 auto 20px",
        }}>
          OP
        </div>

        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary, #12243b)",
          margin: "0 0 12px",
        }}>
          Sin acceso
        </h2>

        {email && (
          <p style={{ fontSize: 13, color: "var(--text-secondary, #5f728b)", margin: "0 0 8px" }}>
            <strong style={{ color: "var(--text-primary, #12243b)" }}>{email}</strong>
          </p>
        )}

        <p style={{ fontSize: 13, color: "var(--text-secondary, #5f728b)", margin: "0 0 28px", lineHeight: 1.6 }}>
          Tu cuenta no está en la lista de usuarios autorizados de ObraPulse. Contacta al administrador para solicitar acceso.
        </p>

        <button
          onClick={() => instance.logoutRedirect()}
          className="ghost-btn"
          style={{ width: "100%", justifyContent: "center", padding: "11px 20px" }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
