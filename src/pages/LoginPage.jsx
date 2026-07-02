import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/msalConfig";

export default function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((err) => {
      console.error("Login error:", err);
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(360px, 42%) 1fr",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* ── Left panel ── */}
      <div style={{
        background: "#1A3560",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "relative",
      }}>
        {/* Ecuador red top stripe */}
        <div style={{ height: 4, background: "#B83030", flexShrink: 0 }} />

        <div style={{ padding: "40px 44px", display: "flex", flexDirection: "column", flex: 1 }}>

          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 52 }}>
            <div style={{
              width: 36, height: 36,
              background: "rgba(255,255,255,0.14)",
              borderRadius: 5,
              display: "grid", placeItems: "center",
              fontWeight: 800, fontSize: 13,
              letterSpacing: "-0.3px",
              flexShrink: 0,
            }}>OP</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>ObraPulse</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                Sistema de Analítica — Ecuador
              </div>
            </div>
          </div>

          {/* Headline */}
          <div style={{ flex: 1 }}>
            <p style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#B83030",
            }}>
              Contratación Pública
            </p>

            <h1 style={{
              margin: "0 0 20px",
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.22,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}>
              Analítica inteligente de datos SERCOP
            </h1>

            <p style={{
              margin: "0 0 36px",
              fontSize: 14,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.75)",
            }}>
              Visualiza KPIs, tendencias territoriales y comportamiento de entidades contratantes del Ecuador.
            </p>

            {/* Features — full opacity, readable */}
            <div style={{ display: "grid", gap: 16 }}>
              {[
                { label: "Datos SERCOP", desc: "Fuente oficial de contratación pública" },
                { label: "Filtros inteligentes", desc: "Por provincia, entidad, régimen y monto" },
                { label: "Exportación", desc: "Excel, CSV y PDF con un clic" },
                { label: "Alertas automáticas", desc: "Detección de anomalías y outliers" },
              ].map(({ label, desc }) => (
                <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 6, height: 6,
                    borderRadius: "50%",
                    background: "#B83030",
                    flexShrink: 0,
                    marginTop: 6,
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", lineHeight: 1.3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.6,
          }}>
            Uso exclusivo para funcionarios autorizados.<br />
            Datos: SERCOP — Contratación Pública Ecuador.
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Matching red stripe */}
        <div style={{ height: 4, background: "#B83030", flexShrink: 0 }} />

        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
        }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            <h2 style={{
              margin: "0 0 6px",
              fontSize: 22,
              fontWeight: 700,
              color: "#1A202C",
              letterSpacing: "-0.02em",
            }}>
              Iniciar sesión
            </h2>

            <p style={{
              margin: "0 0 32px",
              fontSize: 13,
              color: "#4D5E6E",
              lineHeight: 1.55,
            }}>
              Accede con tu cuenta institucional de Microsoft para continuar al sistema.
            </p>

            {/* Microsoft SSO button */}
            <MsButton onClick={handleLogin} />

            {/* Divider */}
            <div style={{
              margin: "28px 0",
              borderTop: "1px solid #E2E8F0",
            }} />

            <p style={{
              margin: 0,
              fontSize: 12,
              color: "#718096",
              lineHeight: 1.55,
              textAlign: "center",
            }}>
              Solo cuentas institucionales autorizadas por el administrador del sistema.
            </p>
          </div>
        </div>

        {/* Right footer */}
        <div style={{
          padding: "16px 40px",
          borderTop: "1px solid #E2E8F0",
          fontSize: 11,
          color: "#A0AEC0",
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>ObraPulse</span>
          <span>Sistema de Analítica — Ecuador</span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function MsButton({ onClick }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "12px 20px",
        borderRadius: 6,
        border: `1.5px solid ${hovered ? "#1A3560" : "#C8D2DC"}`,
        background: hovered ? "#F0F3F7" : "#fff",
        color: "#1A202C",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontFamily: "'Inter', sans-serif",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <MicrosoftLogo />
      Continuar con Microsoft
    </button>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
