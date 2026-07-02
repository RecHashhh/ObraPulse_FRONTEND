import axios from "axios";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest, msalInstance } from "../auth/msalConfig";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// ── Auth interceptor: agrega Bearer token en cada request ─────────────────────

api.interceptors.request.use(async (config) => {
  const account = msalInstance.getActiveAccount();
  if (!account) return config;

  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    config.headers["Authorization"] = `Bearer ${result.idToken}`;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        const result = await msalInstance.acquireTokenPopup({ ...loginRequest, account });
        config.headers["Authorization"] = `Bearer ${result.idToken}`;
      } catch {
        // user cancelled popup — request proceeds without auth
      }
    }
  }
  return config;
});

// ── PAC ───────────────────────────────────────────────────────────────────────

export const getHealth = async () => {
  const { data } = await api.get("/health");
  return data;
};

export const getDashboardContextual = async (params = {}, view = "all") => {
  const queryParams = view === "all" ? params : { ...params, view };
  const { data } = await api.get("/api/pac/dashboard-contextual", { params: queryParams });
  return data;
};

export const getCatalogosDinamicos = async (params = {}) => {
  const { data } = await api.get("/api/pac/catalogos-dinamicos", { params });
  return data;
};

export const getKpis = async (params = {}) => {
  const { data } = await api.get("/api/pac/kpis", { params });
  return data;
};

export const getCatalogos = async () => {
  const { data } = await api.get("/api/pac/catalogos-dinamicos");
  return data;
};

export const getCargasDisponibles = async () => {
  const { data } = await api.get("/api/pac/cargas-disponibles");
  return data;
};

export const downloadPacCsv = async (params = {}) => {
  const response = await api.get("/api/pac/export/csv", { params, responseType: "blob" });
  return response.data;
};

export const downloadPacExcel = async (params = {}) => {
  const response = await api.get("/api/pac/export/excel", { params, responseType: "blob" });
  return response.data;
};

export const getTopEntidades = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-entidades", { params: { limit, ...params } });
  return data;
};

export const getTopProvincias = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-provincias", { params: { limit, ...params } });
  return data;
};

export const getTopCiudades = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-ciudades", { params: { limit, ...params } });
  return data;
};

export const getDistribucionTipoCompra = async (params = {}) => {
  const { data } = await api.get("/api/pac/distribucion-tipo-compra", { params });
  return data;
};

export const getEvolucionFecha = async (params = {}) => {
  const { data } = await api.get("/api/pac/evolucion-fecha", { params });
  return data;
};

export const getPac = async (params = {}) => {
  const { data } = await api.get("/api/pac", { params });
  return data;
};

export const getTopEntidadesPorProvincia = async (params = {}) => {
  const { data } = await api.get("/api/pac/top-entidades-por-provincia", { params });
  return data;
};

export const getEntidadesPorProvincia = async (params = {}) => {
  const { data } = await api.get("/api/pac/entidades-por-provincia", { params });
  return data;
};

// ── Comparador server-side ────────────────────────────────────────────────────

export const getComparadorAgregado = async (groupBy = "Provincia", params = {}, listFilters = {}) => {
  const listParams = {};
  if (listFilters.entidad_list) listParams.entidad_list = listFilters.entidad_list;
  if (listFilters.provincia_list) listParams.provincia_list = listFilters.provincia_list;
  if (listFilters.ciudad_list) listParams.ciudad_list = listFilters.ciudad_list;
  if (listFilters.tipo_compra_list) listParams.tipo_compra_list = listFilters.tipo_compra_list;
  if (listFilters.procedimiento_list) listParams.procedimiento_list = listFilters.procedimiento_list;
  const { data } = await api.get("/api/pac/comparador", {
    params: { group_by: groupBy, limit: 200, ...params, ...listParams },
  });
  return data;
};

export const getPacInsights = async (params = {}) => {
  const { data } = await api.get("/api/pac/insights", { params });
  return data;
};

export const checkBookmarkChanges = async () => {
  const { data } = await api.get("/api/preferencias/bookmarks/changes");
  return data;
};

// ── Preferencias de usuario ───────────────────────────────────────────────────

export const getAllPreferencias = async () => {
  const { data } = await api.get("/api/preferencias");
  return data;
};

export const getPreferencia = async (key) => {
  const { data } = await api.get(`/api/preferencias/${key}`);
  return data.value;
};

export const setPreferencia = async (key, value) => {
  const { data } = await api.put(`/api/preferencias/${key}`, { value });
  return data;
};

export const deletePreferencia = async (key) => {
  const { data } = await api.delete(`/api/preferencias/${key}`);
  return data;
};

export const getPacById = async (pacId) => {
  const { data } = await api.get(`/api/pac/item/${pacId}`);
  return data;
};

export const getBookmarks = async () => {
  const { data } = await api.get("/api/preferencias/bookmarks/list");
  return data;
};

export const addBookmark = async (body) => {
  const { data } = await api.post("/api/preferencias/bookmarks", body);
  return data;
};

export const removeBookmark = async (pacId) => {
  const { data } = await api.delete(`/api/preferencias/bookmarks/${pacId}`);
  return data;
};

// ── Entidades (CRUD) ──────────────────────────────────────────────────────────

export const getEntidades = async (soloActivas = false) => {
  const { data } = await api.get("/api/entidades", { params: { solo_activas: soloActivas } });
  return data;
};

export const crearEntidad = async (body) => {
  const { data } = await api.post("/api/entidades", body);
  return data;
};

export const actualizarEntidad = async (id, body) => {
  const { data } = await api.put(`/api/entidades/${id}`, body);
  return data;
};

export const eliminarEntidad = async (id) => {
  const { data } = await api.delete(`/api/entidades/${id}`);
  return data;
};

export const importarEntidadesJson = async (entidades) => {
  const { data } = await api.post("/api/entidades/importar-json", entidades, {
    timeout: 120000,
  });
  return data;
};

// ── Scraper ───────────────────────────────────────────────────────────────────

export const runScraper = async (entidadId = null) => {
  const params = entidadId != null ? { entidad_id: entidadId } : {};
  const { data } = await api.post("/api/scraper/run", null, { params });
  return data;
};

export const getScraperStatus = async () => {
  const { data } = await api.get("/api/scraper/status");
  return data;
};

export const getScraperLogs = async (page = 1, pageSize = 20) => {
  const { data } = await api.get("/api/scraper/logs", {
    params: { page, page_size: pageSize },
  });
  return data;
};

// ── Admin: gestión de usuarios ────────────────────────────────────────────────

export const getUsuarios = async () => {
  const { data } = await api.get("/api/admin/usuarios");
  return data;
};

export const crearUsuario = async (body) => {
  const { data } = await api.post("/api/admin/usuarios", body);
  return data;
};

export const actualizarUsuario = async (id, body) => {
  const { data } = await api.put(`/api/admin/usuarios/${id}`, body);
  return data;
};

export const eliminarUsuario = async (id) => {
  const { data } = await api.delete(`/api/admin/usuarios/${id}`);
  return data;
};
