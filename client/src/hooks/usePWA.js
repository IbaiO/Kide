import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef, useState } from 'react';
import { auth } from '../services/firebase';
import api from '../services/api';

const DB_NAME = 'kide-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-expenses';

let dbPromise = null;

let isSyncingGlobal = false; 

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllPendingExpenses(db) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return reqToPromise(store.getAll());
}

async function deletePendingExpense(db, localId) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return reqToPromise(store.delete(localId));
}

export async function queueExpenseAction(action) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await reqToPromise(store.put(action));

  const updated = await getAllPendingExpenses(db);
  globalListeners.forEach(l => l(updated));
}

const globalListeners = new Set();
let globalPendingCache = [];

function createSyncRunner(getUser) {
  return async function syncQueuedActions() {
    if (isSyncingGlobal || !navigator.onLine) return;
    
    isSyncingGlobal = true;

    try {
      const user = getUser();
      if (!user) {
        isSyncingGlobal = false;
        return;
      }

      try {
        await auth.currentUser.getIdToken(false);
      } catch (tokenErr) {
        console.warn("Firebase tokena ezin izan da sarean freskatu, cachekoa erabiliko da:", tokenErr.message);
      }

      const db = await openDB();
      const actions = await getAllPendingExpenses(db);
      if (actions.length === 0) {
        isSyncingGlobal = false;
        return;
      }

      console.log(`[PWA Sync] ${actions.length} ekintza sinkronizatzen...`);

      for (const action of actions) {
        try {
          if (action.type === 'create') {
            await api.post('/expenses', action.payload);
          } else if (action.type === 'update') {
            await api.put(`/expenses/${action.expenseId}`, action.payload);
          } else if (action.type === 'delete') {
            await api.delete(`/expenses/${action.expenseId}`);
          }
          
          await deletePendingExpense(db, action.localId);
        } catch (err) {
          console.error(`[PWA Sync] Errorea ${action.localId} ekintzan:`, err.message);
          break; 
        }
      }

      const updated = await getAllPendingExpenses(db);
      globalListeners.forEach(l => l(updated));

    } catch (globalErr) {
      console.error('[PWA Sync] Errore orokorra sinkronizazioan:', globalErr.message);
    } finally {
      isSyncingGlobal = false;
    }
  };
}

openDB().then(getAllPendingExpenses).then(initial => {
  globalPendingCache = initial;
  globalListeners.forEach(l => l(globalPendingCache));
}).catch(console.error);

export function usePWA() {
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(globalPendingCache);
  const [syncToast, setSyncToast]           = useState(null);

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onNeedRefresh() { console.log('[PWA] Eguneraketa berria eskuragarri.'); },
    onOfflineReady() { console.log('[PWA] Aplikazioa konexiorik gabe erabiltzeko prest.'); },
  });

  const { user } = auth.currentUser ? { user: auth.currentUser } : { user: null };
  const userRef = useRef(user);
  const wasPendingRef = useRef(pendingActions.length);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    userRef.current = auth.currentUser;
  });

  useEffect(() => {
    function handleChange(updatedList) {
      globalPendingCache = updatedList;
      setPendingActions(updatedList);
    }
    globalListeners.add(handleChange);
    handleChange(globalPendingCache);
    return () => globalListeners.delete(handleChange);
  }, []);

  useEffect(() => {
    const sync = createSyncRunner(() => userRef.current);

    function handleOnline() {
      setIsOnline(true);
      sync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) sync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (wasPendingRef.current > 0 && pendingActions.length === 0 && isOnline) {
      setSyncToast('Gastu guztiak sinkronizatu dira.');
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setSyncToast(null), 3500);
    }
    wasPendingRef.current = pendingActions.length;
  }, [pendingActions, isOnline]);

  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  return {
    isOnline,
    pendingActions,
    syncToast,
    needRefresh,
    updateServiceWorker
  };
}