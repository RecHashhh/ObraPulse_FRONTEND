import axios from "axios";
import { createContext, useContext, useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "../auth/msalConfig";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { accounts, instance } = useMsal();
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authErrorDetail, setAuthErrorDetail] = useState(null);

  useEffect(() => {
    if (accounts.length === 0) {
      setAppUser(null);
      setLoading(false);
      return;
    }

    const account = accounts[0];
    instance.setActiveAccount(account);
    setLoading(true);
    setAuthError(null);
    setAuthErrorDetail(null);

    instance
      .acquireTokenSilent({ ...loginRequest, account })
      .catch((err) => {
        // Si el token expiró o requiere interacción, forzar re-login
        if (err instanceof InteractionRequiredAuthError) {
          return instance.acquireTokenRedirect({ ...loginRequest, account });
        }
        throw err;
      })
      .then((result) => {
        if (!result) return Promise.reject(new Error("redirect_initiated"));
        return axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${result.idToken}` },
          timeout: 10000,
        });
      })
      .then((res) => {
        setAppUser(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.message === "redirect_initiated") return; // MSAL está redirigiendo

        const status = err.response?.status;
        if (status === 403) {
          setAuthError("access_denied");
        } else if (status === 401) {
          setAuthError("token_error");
          setAuthErrorDetail(
            `Token inválido o expirado (${err.response?.data?.detail || "401"}). Intenta cerrar sesión y volver a entrar.`
          );
        } else if (status >= 500) {
          setAuthError("server_error");
          setAuthErrorDetail(
            `Error del servidor (${status}): ${err.response?.data?.detail || err.message}`
          );
        } else if (!err.response) {
          // Sin respuesta = red caída o CORS
          setAuthError("network_error");
          setAuthErrorDetail(
            `No se recibió respuesta del servidor. Verifica que el backend esté corriendo en ${import.meta.env.VITE_API_URL}`
          );
        } else {
          setAuthError("unknown_error");
          setAuthErrorDetail(
            `Error ${status || "desconocido"}: ${err.response?.data?.detail || err.message}`
          );
        }
        setLoading(false);
      });
  }, [accounts, instance]);

  const logout = () => {
    instance.logoutRedirect();
  };

  return (
    <UserContext.Provider value={{ appUser, loading, authError, authErrorDetail, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
