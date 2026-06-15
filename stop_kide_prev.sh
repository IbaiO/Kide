#!/bin/bash
# ==============================================================================
#  stop_kide.sh - Script de apagado ordenado y limpio para el ecosistema Kide (Preview PWA + Backend Express)
# ==============================================================================

BASE_DIR="/home/ibai/Dokumentuak/GrAL/Kide"
LOG_DIR="$BASE_DIR/logs"

echo "======================================================================="
echo "🛑 Kide aplikazioaren ekosistema itzaltzen (Preview)..."
echo "======================================================================="

# Estrategia 1: Matar procesos por los puertos específicos (Máxima fiabilidad en Linux)
echo "🔒 Node/Vite-k erabilitako portuak askatzen..."

# Puerto 3001 (Backend Express)
if fuser 3001/tcp >/dev/null 2>&1; then
    echo "  -> 3001 portuko API zerbitzaria itzaltzen..."
    fuser -k 3001/tcp >/dev/null 2>&1
fi

# Puerto 4173 (Vite Preview)
if fuser 4173/tcp >/dev/null 2>&1; then
    echo "  -> 4173 portuko Frontend preview zerbitzaria itzaltzen..."
    fuser -k 4173/tcp >/dev/null 2>&1
fi

# Puerto 5173 (Vite Dev por si acaso se quedó colgado alguno viejo)
if fuser 5173/tcp >/dev/null 2>&1; then
    echo "  -> 5173 portuko garapen erresitualeko zerbitzaria garbitzen..."
    fuser -k 5173/tcp >/dev/null 2>&1
fi

# Estrategia 2: Limpieza secundaria por archivos PID guardados
if [ -f "$LOG_DIR/frontend.pid" ]; then
    FPID=$(cat "$LOG_DIR/frontend.pid")
    kill $FPID >/dev/null 2>&1
    rm "$LOG_DIR/frontend.pid" 2>/dev/null
fi

if [ -f "$LOG_DIR/backend.pid" ]; then
    BPID=$(cat "$LOG_DIR/backend.pid")
    kill $BPID >/dev/null 2>&1
    rm "$LOG_DIR/backend.pid" 2>/dev/null
fi

echo "⏳ Memoria eta socket konexioak askatzen..."
sleep 2

echo "======================================================================="
echo "✅ Kide aplikazioaren ekosistema guztiz itzali da eta garbitu da!"
echo "======================================================================="