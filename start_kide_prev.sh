#!/bin/bash
# ==============================================================================
#  start_kide.sh - Script de arranque automatizado para el ecosistema Kide (Preview PWA + Backend Express)
# ==============================================================================

BASE_DIR="/home/ibai/Dokumentuak/GrAL/Kide"
LOG_DIR="$BASE_DIR/logs"

# Crear carpeta de logs si no existe
mkdir -p "$LOG_DIR"

echo "======================================================================="
echo "🚀 Kide aplikazioaren ekosistema abiarazten (Preview)..."
echo "======================================================================="

# 1. Arrancar el Servidor Backend (Express + MongoDB)
echo "📂 [1/2] Server Backend abiarazten (3001 portua)..."
cd "$BASE_DIR/server" || { echo "❌ Error: Ezin izan da $BASE_DIR/server direktoriora sartu"; exit 1; }

# Ejecutamos en segundo plano redirigiendo la salida a un log dedicado
nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"

# Tiempo de espera crucial para permitir la conexión limpia con MongoDB
echo "⏳ 5 segundu itxaroten, backend-a eraiki eta datu-basearekin konektatzeko..."
sleep 5

# 2. Arrancar el Cliente Frontend (Modo Preview PWA)
echo "📂 [2/2] Client Frontend PWA Preview abiarazten (4173 portua)..."
cd "$BASE_DIR/client" || { echo "❌ Error: Ezin izan da $BASE_DIR/client direktoriora sartu"; exit 1; }

# Ejecutamos en segundo plano el previsualizador del Build optimizado con Service Worker
nohup npm run preview > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"

echo "⏳ Sincronizando flujos de red..."
sleep 2

echo "======================================================================="
echo "✅ Kide aplikazioaren ekosistema abiarazi da."
echo "======================================================================="
echo "🌐 URL Frontend (PWA - SW):          http://localhost:4173"
echo "🖥️  URL API Backend (Express):       http://localhost:3001"
echo "📝 Erregistroak zuzenean:            $LOG_DIR/backend.log"
echo "                                     $LOG_DIR/frontend.log"
echo "======================================================================="