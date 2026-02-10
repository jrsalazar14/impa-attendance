# 📋 Design Document: Sistema de Registro de Asistencia

## 1. Visión General

### 1.1 Descripción

Aplicación de escritorio para Windows 11 que permite el registro de entrada/salida de empleados con panel administrativo integrado. La aplicación funciona completamente offline y se distribuye como un único ejecutable portable.

### 1.2 Objetivos

- Registrar entrada y salida de empleados mediante ID
- Permitir a administradora consultar y exportar registros
- Funcionar 100% offline sin requerir internet
- Distribución simple vía Google Drive (un solo .exe)
- No requiere instalación de dependencias adicionales

### 1.3 Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Base de datos**: SQLite (embebida)
- **Estilos**: CSS3 (sin frameworks para mantener tamaño pequeño)
- **Target**: Windows 11 (x64)

---

## 2. Requisitos Funcionales

### 2.1 Modo Kiosco (Empleados)

- **REQ-001**: Capturar ID de empleado (texto/numérico)
- **REQ-002**: Botón "ENTRADA" para registrar llegada
- **REQ-003**: Botón "SALIDA" para registrar salida
- **REQ-004**: Mostrar confirmación visual del último registro
- **REQ-005**: Limpiar campo de ID después de registro exitoso
- **REQ-006**: Validar que ID no esté vacío antes de registrar
- **REQ-007**: Registrar timestamp automático del sistema

### 2.2 Modo Administrador

- **REQ-008**: Acceso mediante combinación de teclas (F12)
- **REQ-009**: Protección con contraseña simple
- **REQ-010**: Listar todos los registros con filtros por:
    - Fecha (hoy, ayer, rango personalizado)
    - Empleado específico
    - Tipo (entrada/salida)
- **REQ-011**: Exportar registros a Excel (.xlsx)
- **REQ-012**: Editar registros existentes (timestamp, tipo)
- **REQ-013**: Eliminar registros con confirmación
- **REQ-014**: Mostrar estadísticas básicas:
    - Total registros del día
    - Empleados presentes actualmente
    - Última actividad
- **REQ-015**: Botón para volver a modo kiosco (ESC)

### 2.3 Gestión de Datos

- **REQ-016**: Crear base de datos SQLite automáticamente al primer uso
- **REQ-017**: Guardar BD en misma carpeta que el ejecutable
- **REQ-018**: Validar integridad de BD al iniciar aplicación
- **REQ-019**: Backup manual mediante copia de archivo .db

---

## 3. Requisitos No Funcionales

### 3.1 Performance

- **NFR-001**: Tiempo de inicio < 2 segundos
- **NFR-002**: Registro de asistencia < 500ms
- **NFR-003**: Carga de registros (1000 entradas) < 1 segundo
- **NFR-004**: Tamaño ejecutable < 15MB

### 3.2 Usabilidad

- **NFR-005**: Interfaz en español
- **NFR-006**: Botones grandes para kiosco (min 150x80px)
- **NFR-007**: Feedback visual claro en cada acción
- **NFR-008**: Fuente legible (min 16px en kiosco)

### 3.3 Seguridad

- **NFR-009**: Contraseña admin configurable
- **NFR-010**: No exponer modo admin en UI de kiosco
- **NFR-011**: Prevenir SQL injection en queries

### 3.4 Mantenibilidad

- **NFR-012**: Código TypeScript con tipos estrictos
- **NFR-013**: Componentes reutilizables
- **NFR-014**: Comentarios en lógica compleja
- **NFR-015**: Manejo de errores consistente

---

## 4. Arquitectura del Sistema

### 4.1 Diagrama de Capas

```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ KioskView    │    │ AdminPanel   │  │
│  │ Component    │    │ Component    │  │
│  └──────────────┘    └──────────────┘  │
│              │              │           │
│         ┌────▼──────────────▼────┐     │
│         │      App.tsx           │     │
│         │  (State Management)    │     │
│         └────────────────────────┘     │
└─────────────────┬───────────────────────┘
                  │ @tauri-apps/api
┌─────────────────▼───────────────────────┐
│          APPLICATION LAYER              │
│  ┌──────────────────────────────────┐  │
│  │      Tauri Commands (Rust)       │  │
│  │  - check_in()                    │  │
│  │  - check_out()                   │  │
│  │  - get_records()                 │  │
│  │  - update_record()               │  │
│  │  - delete_record()               │  │
│  │  - export_to_excel()             │  │
│  └──────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           DATA LAYER                    │
│  ┌──────────────────────────────────┐  │
│  │      SQLite Database             │  │
│  │  - attendance table              │  │
│  │  - employees table (future)      │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 4.2 Flujo de Datos

```
Usuario ingresa ID → KioskView Component
                           ↓
                    invoke('check_in', {id})
                           ↓
                    Tauri Backend (Rust)
                           ↓
                    SQLite: INSERT INTO attendance
                           ↓
                    Return Result
                           ↓
                    Update UI con confirmación
```

---

## 5. Modelo de Datos

### 5.1 Esquema SQLite

```sql
-- Tabla principal de asistencia
CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL CHECK(type IN ('entry', 'exit')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX idx_employee_id ON attendance(employee_id);
CREATE INDEX idx_timestamp ON attendance(timestamp);
CREATE INDEX idx_type ON attendance(type);
CREATE INDEX idx_date ON attendance(DATE(timestamp));

-- Tabla de configuración (futura expansión)
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insertar contraseña admin por defecto
INSERT INTO config (key, value) VALUES ('admin_password', '0824');
```

### 5.2 Interfaces TypeScript

```typescript
// src/types/attendance.ts
export interface AttendanceRecord {
	id: number;
	employee_id: string;
	employee_name: string | null;
	timestamp: string; // ISO 8601 format
	type: "entry" | "exit";
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface CheckInPayload {
	employee_id: string;
	employee_name?: string;
}

export interface CheckOutPayload {
	employee_id: string;
}

export interface RecordFilter {
	start_date?: string;
	end_date?: string;
	employee_id?: string;
	type?: "entry" | "exit";
}

export interface DailyStats {
	total_entries: number;
	total_exits: number;
	employees_present: number;
	last_activity: AttendanceRecord | null;
}
```

---

## 6. Estructura de Archivos

```
attendance-app/
├── src/                                # Frontend React
│   ├── App.tsx                         # Componente raíz + routing de modos
│   ├── App.css                         # Estilos globales
│   ├── main.tsx                        # Entry point React
│   ├── vite-env.d.ts
│   │
│   ├── components/                     # Componentes reutilizables
│   │   ├── KioskView.tsx              # Vista empleados
│   │   ├── KioskView.css
│   │   ├── AdminPanel.tsx             # Vista administrador
│   │   ├── AdminPanel.css
│   │   ├── RecordTable.tsx            # Tabla de registros
│   │   ├── DateFilter.tsx             # Filtro de fechas
│   │   ├── StatsCard.tsx              # Tarjeta estadísticas
│   │   └── ConfirmDialog.tsx          # Diálogo confirmación
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useAttendance.ts           # Hook para operaciones BD
│   │   └── useKeyboardShortcut.ts     # Hook para F12/ESC
│   │
│   ├── types/                          # TypeScript types
│   │   └── attendance.ts              # Interfaces compartidas
│   │
│   └── utils/                          # Utilidades
│       ├── formatDate.ts              # Formateo de fechas
│       ├── exportExcel.ts             # Exportación Excel
│       └── validators.ts              # Validaciones
│
├── src-tauri/                          # Backend Tauri (Rust)
│   ├── src/
│   │   ├── main.rs                    # Entry point + comandos Tauri
│   │   ├── db.rs                      # Módulo base de datos
│   │   ├── models.rs                  # Structs de datos
│   │   └── utils.rs                   # Utilidades Rust
│   │
│   ├── Cargo.toml                     # Dependencias Rust
│   ├── tauri.conf.json                # Configuración Tauri
│   ├── build.rs
│   └── icons/                         # Iconos de la app
│       ├── icon.ico
│       └── icon.png
│
├── public/                             # Assets estáticos
│   └── favicon.ico
│
├── package.json                        # Dependencias Node
├── tsconfig.json                       # Configuración TypeScript
├── vite.config.ts                      # Configuración Vite
└── README.md                           # Documentación
```

---

## 7. Especificaciones de Componentes

### 7.1 App.tsx

**Responsabilidades:**

- Gestionar estado global del modo (kiosco/admin)
- Manejar atajos de teclado (F12, ESC)
- Validar contraseña admin
- Renderizar componente apropiado según modo

**Estado:**

```typescript
const [mode, setMode] = useState<"kiosk" | "admin">("kiosk");
const [isAuthenticated, setIsAuthenticated] = useState(false);
```

**Métodos:**

- `handleAdminAccess()`: Validar contraseña y cambiar a modo admin
- `handleBackToKiosk()`: Volver a modo kiosco

---

### 7.2 KioskView.tsx

**Responsabilidades:**

- Capturar ID de empleado
- Registrar entrada/salida
- Mostrar feedback visual

**Estado:**

```typescript
const [employeeId, setEmployeeId] = useState("");
const [lastRecord, setLastRecord] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);
```

**Métodos:**

- `handleCheckIn()`: Invocar comando check_in de Tauri
- `handleCheckOut()`: Invocar comando check_out de Tauri
- `validateInput()`: Validar que ID no esté vacío
- `clearForm()`: Limpiar campos después de registro

**UI Elements:**

```
┌──────────────────────────────────────┐
│                                      │
│     REGISTRO DE ASISTENCIA           │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Ingresa tu ID: [__________]    │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌──────────────┐  ┌──────────────┐ │
│  │              │  │              │ │
│  │  🟢 ENTRADA  │  │  🔴 SALIDA   │ │
│  │              │  │              │ │
│  └──────────────┘  └──────────────┘ │
│                                      │
│  Último registro:                    │
│  ✅ Entrada - ID: 001 - 08:30 AM    │
│                                      │
└──────────────────────────────────────┘
```

---

### 7.3 AdminPanel.tsx

**Responsabilidades:**

- Mostrar lista de registros
- Aplicar filtros
- Exportar a Excel
- Editar/eliminar registros
- Mostrar estadísticas

**Estado:**

```typescript
const [records, setRecords] = useState<AttendanceRecord[]>([]);
const [filters, setFilters] = useState<RecordFilter>({});
const [stats, setStats] = useState<DailyStats | null>(null);
const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
```

**Métodos:**

- `loadRecords()`: Cargar registros con filtros
- `handleExport()`: Exportar a Excel
- `handleEdit()`: Editar registro seleccionado
- `handleDelete()`: Eliminar registro con confirmación
- `applyFilters()`: Aplicar filtros de búsqueda

**UI Elements:**

```
┌────────────────────────────────────────────┐
│  🔒 Panel Administrativo          [X Cerrar]│
├────────────────────────────────────────────┤
│  📊 Estadísticas de Hoy                    │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ 45   │ │ 42   │ │ 3    │              │
│  │Entr. │ │Sal.  │ │Pres. │              │
│  └──────┘ └──────┘ └──────┘              │
├────────────────────────────────────────────┤
│  Filtros:                                  │
│  Fecha: [__/__/____] a [__/__/____] 🔍    │
│  Empleado: [________]  Tipo: [Todos ▼]    │
├────────────────────────────────────────────┤
│  ID    Empleado   Fecha      Hora    Tipo │
│  001   Juan P.    09/02/26   08:30   ↓    │
│  002   María G.   09/02/26   08:45   ↓    │
│  001   Juan P.    09/02/26   17:00   ↑    │
│  [...]                                     │
├────────────────────────────────────────────┤
│  [📥 Exportar Excel] [🔄 Recargar]        │
└────────────────────────────────────────────┘
```

---

## 8. Comandos Tauri (Rust)

### 8.1 Listado de Comandos

```rust
// src-tauri/src/main.rs

#[tauri::command]
fn check_in(
    state: State<AppState>,
    employee_id: String,
    employee_name: Option<String>,
) -> Result<String, String>

#[tauri::command]
fn check_out(
    state: State<AppState>,
    employee_id: String,
) -> Result<String, String>

#[tauri::command]
fn get_records(
    state: State<AppState>,
    start_date: Option<String>,
    end_date: Option<String>,
    employee_id: Option<String>,
    record_type: Option<String>,
) -> Result<Vec<AttendanceRecord>, String>

#[tauri::command]
fn get_daily_stats(
    state: State<AppState>,
) -> Result<DailyStats, String>

#[tauri::command]
fn update_record(
    state: State<AppState>,
    id: i32,
    timestamp: String,
    record_type: String,
    notes: Option<String>,
) -> Result<String, String>

#[tauri::command]
fn delete_record(
    state: State<AppState>,
    id: i32,
) -> Result<String, String>

#[tauri::command]
fn export_to_excel(
    state: State<AppState>,
    records: Vec<AttendanceRecord>,
) -> Result<String, String>

#[tauri::command]
fn verify_admin_password(
    state: State<AppState>,
    password: String,
) -> Result<bool, String>
```

### 8.2 Módulo de Base de Datos

```rust
// src-tauri/src/db.rs

pub fn initialize_database(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Crear tablas
    // Crear índices
    // Insertar datos iniciales
}

pub fn insert_attendance(
    conn: &Connection,
    employee_id: &str,
    employee_name: Option<&str>,
    record_type: &str,
) -> Result<(), rusqlite::Error>

pub fn query_records(
    conn: &Connection,
    filters: RecordFilter,
) -> Result<Vec<AttendanceRecord>, rusqlite::Error>

pub fn update_attendance(
    conn: &Connection,
    id: i32,
    timestamp: &str,
    record_type: &str,
    notes: Option<&str>,
) -> Result<(), rusqlite::Error>

pub fn delete_attendance(
    conn: &Connection,
    id: i32,
) -> Result<(), rusqlite::Error>

pub fn get_stats(
    conn: &Connection,
) -> Result<DailyStats, rusqlite::Error>
```

---

## 9. Flujos de Usuario

### 9.1 Flujo: Registrar Entrada

```
1. Usuario abre la aplicación → Vista Kiosco
2. Usuario ingresa su ID en el campo de texto
3. Usuario presiona botón "ENTRADA"
4. Sistema valida que ID no esté vacío
5. Sistema invoca comando check_in(employee_id)
6. Backend inserta registro en BD con:
   - employee_id
   - timestamp actual
   - type: 'entry'
7. Backend retorna resultado exitoso
8. Frontend muestra mensaje: "✅ Entrada registrada: [ID] - [hora]"
9. Campo de ID se limpia automáticamente
10. Sistema queda listo para siguiente registro
```

### 9.2 Flujo: Acceder a Panel Admin

```
1. Administradora presiona F12 desde vista kiosco
2. Sistema muestra prompt: "Contraseña de administrador:"
3. Administradora ingresa contraseña
4. Sistema invoca verify_admin_password(password)
5. Si correcta:
   a. Sistema cambia a vista AdminPanel
   b. Carga registros del día actual
   c. Calcula y muestra estadísticas
6. Si incorrecta:
   a. Muestra mensaje de error
   b. Permanece en vista kiosco
```

### 9.3 Flujo: Exportar a Excel

```
1. Administradora está en panel admin
2. (Opcional) Aplica filtros de fecha/empleado
3. Presiona botón "📥 Exportar Excel"
4. Sistema invoca export_to_excel(records)
5. Backend:
   a. Crea archivo .xlsx en memoria
   b. Agrega headers: ID, Empleado, Fecha, Hora, Tipo
   c. Escribe cada registro como fila
   d. Guarda archivo en Desktop/Asistencia_[fecha].xlsx
6. Sistema muestra diálogo: "✅ Exportado a: [ruta]"
7. Administradora puede abrir el archivo
```

---

## 10. Paleta de Colores y Diseño

### 10.1 Colores

```css
:root {
	/* Primarios */
	--color-primary: #2563eb; /* Azul principal */
	--color-success: #10b981; /* Verde entrada */
	--color-danger: #ef4444; /* Rojo salida */
	--color-warning: #f59e0b; /* Amarillo alertas */

	/* Neutrales */
	--color-bg: #f9fafb; /* Fondo general */
	--color-surface: #ffffff; /* Tarjetas/paneles */
	--color-text: #111827; /* Texto principal */
	--color-text-secondary: #6b7280; /* Texto secundario */
	--color-border: #e5e7eb; /* Bordes */

	/* Sombras */
	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
	--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
	--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### 10.2 Tipografía

```css
body {
	font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
	font-size: 16px;
	line-height: 1.5;
}

/* Vista Kiosco */
.kiosk h1 {
	font-size: 2.5rem;
	font-weight: 700;
}
.kiosk input {
	font-size: 1.5rem;
}
.kiosk button {
	font-size: 1.25rem;
	font-weight: 600;
}

/* Panel Admin */
.admin h2 {
	font-size: 1.75rem;
	font-weight: 600;
}
.admin table {
	font-size: 0.95rem;
}
```

---

## 11. Manejo de Errores

### 11.1 Tipos de Errores

```typescript
// src/types/errors.ts

export enum ErrorCode {
	VALIDATION_ERROR = "VALIDATION_ERROR",
	DATABASE_ERROR = "DATABASE_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	AUTH_ERROR = "AUTH_ERROR",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface AppError {
	code: ErrorCode;
	message: string;
	details?: string;
}
```

### 11.2 Estrategia de Manejo

```typescript
// Frontend
try {
  await invoke('check_in', payload);
} catch (error) {
  // Mostrar mensaje amigable al usuario
  setError('No se pudo registrar la entrada. Intenta nuevamente.');
  console.error('Check-in error:', error);
}

// Backend (Rust)
fn check_in(...) -> Result<String, String> {
    match insert_attendance(&db, ...) {
        Ok(_) => Ok("Entrada registrada".to_string()),
        Err(e) => Err(format!("Error de base de datos: {}", e)),
    }
}
```

---

## 12. Plan de Desarrollo

### 12.1 Fase 1: Setup y Estructura Base (2-3 horas)

- ✅ Crear proyecto Tauri
- ✅ Configurar TypeScript y ESLint
- ✅ Crear estructura de carpetas
- ✅ Configurar base de datos SQLite
- ✅ Crear esquema inicial

### 12.2 Fase 2: Vista Kiosco (3-4 horas)

- ✅ Implementar componente KioskView
- ✅ Crear formulario de captura ID
- ✅ Implementar botones ENTRADA/SALIDA
- ✅ Conectar con comandos Tauri
- ✅ Agregar validaciones
- ✅ Estilizar interfaz

### 12.3 Fase 3: Panel Administrativo (5-6 horas)

- ✅ Implementar componente AdminPanel
- ✅ Crear tabla de registros
- ✅ Implementar filtros
- ✅ Agregar estadísticas
- ✅ Funcionalidad editar/eliminar
- ✅ Exportar a Excel

### 12.4 Fase 4: Comandos Backend (3-4 horas)

- ✅ Implementar todos los comandos Tauri
- ✅ Crear módulo de base de datos
- ✅ Agregar validaciones en Rust
- ✅ Manejo de errores

### 12.5 Fase 5: Integración y Testing (2-3 horas)

- ✅ Integrar frontend y backend
- ✅ Probar todos los flujos
- ✅ Ajustar UI/UX
- ✅ Resolver bugs

### 12.6 Fase 6: Build y Distribución (1-2 horas)

- ✅ Compilar para producción
- ✅ Probar ejecutable en Windows limpio
- ✅ Crear documentación de usuario
- ✅ Subir a Google Drive

**Tiempo total estimado: 16-22 horas**

---

## 13. Testing Strategy

### 13.1 Testing Frontend

```typescript
// Ejemplo con Vitest (opcional)
describe("KioskView", () => {
	test("should register entry", async () => {
		// Test lógica de registro
	});

	test("should validate empty ID", () => {
		// Test validación
	});
});
```

### 13.2 Testing Backend

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_attendance() {
        // Test inserción en BD
    }

    #[test]
    fn test_query_records() {
        // Test consultas
    }
}
```

### 13.3 Testing Manual

- ✅ Registrar entrada/salida múltiples veces
- ✅ Acceder a panel admin con contraseña correcta/incorrecta
- ✅ Filtrar registros por diferentes criterios
- ✅ Exportar a Excel y verificar contenido
- ✅ Editar y eliminar registros
- ✅ Cerrar y reabrir app (persistencia)
- ✅ Probar sin conexión a internet

---

## 14. Dependencias

### 14.1 Frontend (package.json)

```json
{
	"dependencies": {
		"react": "^18.2.0",
		"react-dom": "^18.2.0",
		"@tauri-apps/api": "^1.5.0",
		"date-fns": "^2.30.0"
	},
	"devDependencies": {
		"@types/react": "^18.2.0",
		"@types/react-dom": "^18.2.0",
		"@vitejs/plugin-react": "^4.2.0",
		"typescript": "^5.3.0",
		"vite": "^5.0.0"
	}
}
```

### 14.2 Backend (Cargo.toml)

```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.30", features = ["bundled"] }
chrono = "0.4"

# Para exportar Excel (opcional)
rust_xlsxwriter = "0.60"
```

---

## 15. Configuración Tauri

### 15.1 tauri.conf.json (Configuración clave)

```json
{
	"build": {
		"beforeBuildCommand": "npm run build",
		"beforeDevCommand": "npm run dev",
		"devPath": "http://localhost:5173",
		"distDir": "../dist"
	},
	"package": {
		"productName": "Sistema de Asistencia",
		"version": "1.0.0"
	},
	"tauri": {
		"allowlist": {
			"all": false,
			"fs": {
				"writeFile": true,
				"readFile": true,
				"createDir": true
			},
			"dialog": {
				"save": true
			}
		},
		"bundle": {
			"active": true,
			"targets": ["msi", "nsis"],
			"identifier": "com.empresa.asistencia",
			"icon": ["icons/icon.ico", "icons/icon.png"],
			"windows": {
				"certificateThumbprint": null,
				"digestAlgorithm": "sha256",
				"timestampUrl": ""
			}
		},
		"windows": [
			{
				"title": "Sistema de Asistencia",
				"width": 800,
				"height": 600,
				"resizable": true,
				"fullscreen": false,
				"center": true
			}
		]
	}
}
```

---

## 16. Consideraciones de Seguridad

### 16.1 Validación de Inputs

- Sanitizar employee_id antes de insertar en BD
- Validar formato de fechas en filtros
- Limitar longitud de campos de texto

### 16.2 Protección de Datos

- No exponer contraseña admin en código frontend
- Usar prepared statements para prevenir SQL injection
- Validar permisos antes de operaciones destructivas

### 16.3 Configuración Admin

```sql
-- Permitir cambiar contraseña desde panel admin (futuro)
UPDATE config SET value = 'nueva_contraseña' WHERE key = 'admin_password';
```

---

## 17. Roadmap Futuro (Opcional)

### 17.1 Versión 1.1

- Catálogo de empleados (nombre, foto, departamento)
- Registro mediante lector de código de barras
- Tema oscuro/claro

### 17.2 Versión 1.2

- Reportes avanzados (asistencia mensual, retardos)
- Gráficas de estadísticas
- Notificaciones de eventos importantes

### 17.3 Versión 2.0

- Sincronización opcional con la nube
- App móvil para admin
- Reconocimiento facial (futuro lejano)

---

## 18. Comandos Útiles para Desarrollo

```bash
# Desarrollo
npm run tauri dev          # Modo desarrollo con hot reload

# Build
npm run tauri build        # Compilar para producción

# Linting
npm run lint               # Verificar código TypeScript
cargo clippy               # Verificar código Rust

# Testing
npm test                   # Tests frontend
cargo test                 # Tests backend

# Limpiar
npm run clean              # Limpiar archivos temporales
cargo clean                # Limpiar compilación Rust
```

---

## 19. Entregables Finales

### Para distribución:

1. ✅ `attendance.exe` (~5-15MB)
2. ✅ `README.md` con instrucciones de usuario
3. ✅ Carpeta opcional con manual en PDF

### Para mantenimiento (tu repositorio):

1. ✅ Código fuente completo
2. ✅ Este design document
3. ✅ Historial de versiones (git tags)
4. ✅ Backups de esquema de BD

---

## 20. Notas para Claude Code

### Comandos sugeridos para Claude Code:

```bash
# Crear estructura base
claude-code "Create the complete Tauri project structure according to design document section 6"

# Implementar componente específico
claude-code "Implement KioskView component with all functionality from section 7.2"

# Crear comandos backend
claude-code "Implement all Tauri commands listed in section 8.1 with proper error handling"

# Revisar y refactorizar
claude-code "Review the code for type safety issues and suggest improvements"
```

### Contexto importante:

- El proyecto es para Windows 11 únicamente
- No requiere conexión a internet (100% offline)
- Priorizar simplicidad sobre features complejas
- La BD se crea automáticamente en primera ejecución
- Distribución es mediante Google Drive (single .exe)

---

**Documento creado el:** 2026-02-09  
**Versión:** 1.0  
**Autor:** Jose (Data Engineer)  
**Para uso con:** Claude Code + Desarrollo manual
