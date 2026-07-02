import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";
import { LoadingProvider } from "./context/LoadingContext";
import LoadingOverlay from "./components/ui/LoadingOverlay";
import { UserProvider } from "./context/UserContext";
import { msalInstance } from "./auth/msalConfig";

// initialize() procesa el redirect de vuelta desde Azure AD (#code=...) antes de renderizar.
// Si hay un código de auth en la URL, MSAL lo intercambia por tokens aquí.
msalInstance
  .initialize()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <LoadingProvider>
                <UserProvider>
                  <App />
                  <LoadingOverlay />
                </UserProvider>
              </LoadingProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </MsalProvider>
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error("MSAL initialization error:", err);
    // Renderizar igual para que el usuario vea algo y pueda reintentar
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <LoadingProvider>
                <UserProvider>
                  <App />
                  <LoadingOverlay />
                </UserProvider>
              </LoadingProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </MsalProvider>
      </React.StrictMode>
    );
  });
