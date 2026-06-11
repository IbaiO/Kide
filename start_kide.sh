#!/bin/bash
# ==============================================================================
#  start_kide.sh - Script de arranque automatizado para el ecosistema Kide
# ==============================================================================

BASE_DIR="/home/ibai/Dokumentuak/GrAL/Kide"
LOG_DIR="$BASE_DIR/logs"

# Crear carpeta de logs si no existe
mkdir -p "$LOG_DIR"

echo "======================================================================="
echo "🚀 Arrancando el ecosistema de Kide (GrAL)..."
echo "======================================================================="

# 1. Arrancar el Servidor Backend (Express + MongoDB)
echo "📂 [1/2] Iniciando el Servidor Backend (Puerto 3001)..."
cd "$BASE_DIR/server" || { echo "❌ Error: No se pudo acceder a $BASE_DIR/server"; exit 1; }

# Ejecutamos en segundo plano redirigiendo la salida a un log dedicado
nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"

# Tiempo de espera crucial para permitir la conexión limpia con MongoDB
echo "⏳ Esperando 5 segundos a que el backend levante y conecte con la Base de Datos..."
sleep 5

# 2. Arrancar el Cliente Frontend (Modo Preview PWA)
echo "📂 [2/2] Iniciando el Cliente Frontend PWA Preview (Puerto 4173)..."
cd "$BASE_DIR/client" || { echo "❌ Error: No se pudo acceder a $BASE_DIR/client"; exit 1; }

# Ejecutamos en segundo plano el previsualizador del Build optimizado con Service Worker
nohup npm run preview > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"

echo "⏳ Sincronizando flujos de red..."
sleep 2

echo "======================================================================="
echo "✅ ¡Ecosistema de Kide levantado con éxito!"
echo "======================================================================="
echo "🌐 URL Frontend (PWA con SW activo): http://localhost:4173"
echo "🖥️  URL API Backend (Express):       http://localhost:3001"
echo "📝 Los registros en vivo están en:  $LOG_DIR/backend.log"
echo "                                     $LOG_DIR/frontend.log"
echo "======================================================================="