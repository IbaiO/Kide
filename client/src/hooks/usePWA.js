import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * usePWA — gestiona el ciclo de vida del Service Worker.
 * Devuelve needRefresh (hay actualización disponible) y updateSW (aplica la actualización).
 *
 * Uso en App.jsx:
 *   const { needRefresh, updateSW } = usePWA();
 *   {needRefresh && <button onClick={updateSW}>Nueva versión disponible — Actualizar</button>}
 */
export function usePWA() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Comprueba actualizaciones cada hora
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  return {
    needRefresh,
    updateSW: () => updateServiceWorker(true),
  };
}
