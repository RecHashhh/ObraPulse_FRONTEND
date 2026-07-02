import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 2 minutos — los datos PAC cambian solo al hacer scraping (semanal)
      staleTime: 2 * 60_000,
      // 10 minutos en caché antes de garbage-collect
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Claves de staleTime específicas por tipo de query.
// Usar como: useQuery({ queryKey: [...], staleTime: STALE.catalogos })
export const STALE = {
  // Catálogos cambian rarísimo — 10 min
  catalogos: 10 * 60_000,
  // Dashboard / KPIs — 3 min
  dashboard: 3 * 60_000,
  // Tabla detalle paginada — 2 min
  tabla: 2 * 60_000,
  // Comparador ya agrupado — 5 min (es un cómputo costoso)
  comparador: 5 * 60_000,
  // Preferencias de usuario — siempre fresco al montar
  preferencias: 0,
};
