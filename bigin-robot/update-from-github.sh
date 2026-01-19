#!/bin/bash

# Script para actualizar Robot Bigin v2 desde GitHub
# Uso: bash update-from-github.sh

set -e  # Salir si hay error

echo "🔄 Actualizando Robot Bigin v2 desde GitHub..."
echo ""

# 1. Ir al directorio del robot
cd /root/v3dsl-bot/bigin-robot

# 2. Verificar que no hay cambios locales
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  ADVERTENCIA: Hay cambios locales no commiteados"
    echo "Cambios detectados:"
    git status --short
    echo ""
    read -p "¿Descartar cambios locales y continuar? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Actualización cancelada"
        exit 1
    fi
    echo "🗑️  Descartando cambios locales..."
    git reset --hard HEAD
fi

# 3. Pull desde GitHub
echo "📥 Descargando última versión desde GitHub..."
cd /root/v3dsl-bot
git pull origin master

# 4. Verificar si hubo cambios en bigin-robot/
CHANGES=$(git diff HEAD@{1} HEAD -- bigin-robot/ | wc -l)

if [ "$CHANGES" -eq 0 ]; then
    echo "✅ No hay cambios en el robot, todo está actualizado"
    exit 0
fi

echo "📝 Cambios detectados en el robot:"
git diff HEAD@{1} HEAD --stat -- bigin-robot/

# 5. Instalar dependencias (por si cambiaron)
echo ""
echo "📦 Instalando dependencias..."
cd /root/v3dsl-bot/bigin-robot
npm install

# 6. Compilar código TypeScript
echo ""
echo "🔨 Compilando TypeScript..."
npm run build

# 7. Reiniciar robot
echo ""
echo "🔄 Reiniciando robot..."
bash /root/v3dsl-bot/bigin-robot/robot-manager.sh restart

# 8. Verificar que esté corriendo
echo ""
echo "✅ Verificando estado..."
sleep 3
bash /root/v3dsl-bot/bigin-robot/robot-manager.sh status

echo ""
echo "✅ Robot actualizado exitosamente desde GitHub!"
echo "📋 Logs: tail -f /tmp/robot-api-v2.log"
