# 🏆 Quiniela Mundialista 2026

Sistema completo de quiniela para grupo de trabajo.

## Estructura del proyecto
```
quiniela/
├── schema.sql              ← Ejecutar primero en PostgreSQL
├── backend/
│   ├── package.json
│   ├── .env.example        ← Copiar a .env y configurar
│   └── src/
│       ├── app.js
│       ├── db/pool.js
│       ├── middleware/auth.js
│       └── routes/
│           ├── auth.js         (también contiene matches.js y ranking.js)
│           ├── predictions.js  ← LÓGICA CORE: bloqueo de tiempo
│           └── admin.js        ← Endpoint protegido de resultados
└── frontend/
    ├── index.html          ← Dashboard del jugador
    └── admin.html          ← Panel del administrador
```

## Quick Start

### 1. Base de datos
```bash
createdb quiniela_db
psql -d quiniela_db -f schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
npm install
npm run dev   # o npm start en producción
```

### 3. Frontend
Abrir `frontend/index.html` directamente en el navegador,
o servir con cualquier servidor estático:
```bash
npx serve frontend
# Visitar http://localhost:3000
```

## Crear primer Admin
```sql
-- Después de registrarte en la app, ejecuta esto en psql:
UPDATE users SET role = 'admin' WHERE email = 'tu@email.com';
```

## Reglas de negocio implementadas
- ✅ 1 punto por acertar resultado (G/E/P)
- ✅ 2 puntos por marcador exacto
- ✅ Bloqueo automático cuando inicia el partido (validado en servidor con NOW() AT TIME ZONE 'UTC')
- ✅ Desempate: más exactos → orden alfabético
- ✅ Trigger SQL recalcula puntos automáticamente al subir resultado
- ✅ Corrección de resultados: el trigger hace reset + re-cálculo

## Variables de entorno requeridas
```
PORT=3000
DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
JWT_SECRET   (mín. 64 chars aleatorios en producción)
ALLOWED_ORIGIN
```
