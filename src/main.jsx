import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";
import { LoadingProvider } from "./context/LoadingContext";
import LoadingOverlay from "./components/ui/LoadingOverlay";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LoadingProvider>
          <App />
          <LoadingOverlay />
        </LoadingProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);