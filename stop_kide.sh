#!/bin/bash
# ==============================================================================
#  stop_kide.sh - Script de apagado ordenado y limpio para el ecosistema Kide
# ==============================================================================

BASE_DIR="/home/ibai/Dokumentuak/GrAL/Kide"
LOG_DIR="$BASE_DIR/logs"

echo "======================================================================="
echo "🛑 Deteniendo ordenadamente el ecosistema de Kide..."
echo "======================================================================="

# Estrategia 1: Matar procesos por los puertos específicos (Máxima fiabilidad en Linux)
echo "🔒 Liberando puertos de red ocupados por Node/Vite..."

# Puerto 3001 (Backend Express)
if fuser 3001/tcp >/dev/null 2>&1; then
    echo "  -> Cerrando servidor API en puerto 3001..."
    fuser -k 3001/tcp >/dev/null 2>&1
fi

# Puerto 4173 (Vite Preview)
if fuser 4173/tcp >/dev/null 2>&1; then
    echo "  -> Cerrando servidor Frontend Preview en puerto 4173..."
    fuser -k 4173/tcp >/dev/null 2>&1
fi

# Puerto 5173 (Vite Dev por si acaso se quedó colgado alguno viejo)
if fuser 5173/tcp >/dev/null 2>&1; then
    echo "  -> Limpiando servidor de desarrollo residual en puerto 5173..."
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

echo "⏳ Esperando a que el sistema libere los hilos de memoria y conexiones socket..."
sleep 2

echo "======================================================================="
echo "✅ ¡Ecosistema Kide completamente apagado y limpio!"
echo "======================================================================="