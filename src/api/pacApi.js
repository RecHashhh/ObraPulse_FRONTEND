import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export const getHealth = async () => {
  const { data } = await api.get("/health");
  return data;
};

export const getDashboardContextual = async (params = {}, view = "all") => {
  const queryParams = view === "all" ? params : { ...params, view };
  const { data } = await api.get("/api/pac/dashboard-contextual", {
    params: queryParams,
  });
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
  const { data } = await api.get("/api/pac/catalogos");
  return data;
};

export const downloadPacCsv = async (params = {}) => {
  const response = await api.get("/api/pac/export/csv", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const downloadPacExcel = async (params = {}) => {
  const response = await api.get("/api/pac/export/excel", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const getTopEntidades = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-entidades", {
    params: { limit, ...params },
  });
  return data;
};

export const getTopProvincias = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-provincias", {
    params: { limit, ...params },
  });
  return data;
};

export const getTopCiudades = async (limit = 10, params = {}) => {
  const { data } = await api.get("/api/pac/top-ciudades", {
    params: { limit, ...params },
  });
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
  const { data } = await api.get("/api/pac/top-entidades-por-provincia", {
    params,
  });
  return data;
};

export const getEntidadesPorProvincia = async (params = {}) => {
  const { data } = await api.get("/api/pac/entidades-por-provincia", {
    params,
  });
  return data;
};