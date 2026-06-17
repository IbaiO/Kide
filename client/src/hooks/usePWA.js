import { useRegisterSW } from 'virtual:pwa-register/react';

// Service Worker-aren bizitza-zikloa kudeatu.
// needRefresh: true denean, SW berria dago eskuragarri.
// updateSW: SW berria aplikatzeko.

export function usePWA() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Orduro begiratu
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