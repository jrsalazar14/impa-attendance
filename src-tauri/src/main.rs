// Tauri genera este archivo, solo agregas los comandos
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Local;
use rusqlite::{params, Connection};
use rust_xlsxwriter::{Format, Workbook};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AttendanceRecord {
    id: i64,
    employee_id: String,
    employee_name: Option<String>,
    timestamp: String,
    r#type: String,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Employee {
    id: String,
    name: String,
    active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct DailyStats {
    total_entries: i64,
    total_exits: i64,
    unique_employees_present: i64,
    last_activity: Option<AttendanceRecord>,
}

fn init_database(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY,
            employee_id TEXT NOT NULL,
            employee_name TEXT,
            timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
            type TEXT CHECK(type IN ('entry', 'exit')),
            notes TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO config (key, value) VALUES ('admin_password', '0824');
        UPDATE config SET value = '0824' WHERE key = 'admin_password' AND value = '1234';

        CREATE INDEX IF NOT EXISTS idx_employee_id ON attendance(employee_id);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON attendance(timestamp);
        CREATE INDEX IF NOT EXISTS idx_type ON attendance(type);
        CREATE INDEX IF NOT EXISTS idx_date ON attendance(date(timestamp, 'localtime'));
        CREATE INDEX IF NOT EXISTS idx_employee_active ON employees(active);",
    )
    .expect("Failed to initialize database");

    // Migrate: add columns that may be missing from older databases
    for col in &[
        ("notes", "TEXT"),
        ("created_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"),
        ("updated_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"),
    ] {
        let sql = format!("ALTER TABLE attendance ADD COLUMN {} {}", col.0, col.1);
        // Ignore error — means column already exists
        let _ = conn.execute(&sql, []);
    }
}

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<AttendanceRecord> {
    Ok(AttendanceRecord {
        id: row.get(0)?,
        employee_id: row.get(1)?,
        employee_name: row.get(2)?,
        timestamp: row.get(3)?,
        r#type: row.get(4)?,
        notes: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

#[tauri::command]
fn check_in(
    state: tauri::State<AppState>,
    employee_id: String,
    employee_name: Option<String>,
) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    // Try to get employee name from database if not provided
    let name = if let Some(n) = employee_name {
        n
    } else {
        db.query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![&employee_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| format!("Empleado {}", employee_id))
    };

    db.execute(
        "INSERT INTO attendance (employee_id, employee_name, type, timestamp, created_at, updated_at) 
         VALUES (?1, ?2, 'entry', datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime'))",
        params![employee_id, name],
    )
    .map_err(|e| e.to_string())?;

    Ok("Entrada registrada".to_string())
}

#[tauri::command]
fn check_out(
    state: tauri::State<AppState>,
    employee_id: String,
    employee_name: Option<String>,
) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    // Try to get employee name from database if not provided
    let name = if let Some(n) = employee_name {
        n
    } else {
        db.query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![&employee_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| format!("Empleado {}", employee_id))
    };

    db.execute(
        "INSERT INTO attendance (employee_id, employee_name, type, timestamp, created_at, updated_at) 
         VALUES (?1, ?2, 'exit', datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime'))",
        params![employee_id, name],
    )
    .map_err(|e| e.to_string())?;

    Ok("Salida registrada".to_string())
}

#[tauri::command]
fn get_records(
    state: tauri::State<AppState>,
    start_date: Option<String>,
    end_date: Option<String>,
    employee_id: Option<String>,
    record_type: Option<String>,
) -> Result<Vec<AttendanceRecord>, String> {
    let db = state.db.lock().unwrap();

    let mut sql = String::from(
        "SELECT id, employee_id, employee_name, timestamp, type, notes, created_at, updated_at FROM attendance WHERE 1=1",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    build_query_filters(&mut sql, &mut param_values, &start_date, &end_date, &employee_id, &record_type);
    sql.push_str(" ORDER BY timestamp DESC");

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let records = stmt
        .query_map(params_refs.as_slice(), row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

fn build_query_filters(
    sql: &mut String,
    param_values: &mut Vec<Box<dyn rusqlite::types::ToSql>>,
    start_date: &Option<String>,
    end_date: &Option<String>,
    employee_id: &Option<String>,
    record_type: &Option<String>,
) {
    if let Some(ref sd) = start_date {
        param_values.push(Box::new(sd.clone()));
        sql.push_str(&format!(" AND date(timestamp, 'localtime') >= date(?{})", param_values.len()));
    }
    if let Some(ref ed) = end_date {
        param_values.push(Box::new(ed.clone()));
        sql.push_str(&format!(" AND date(timestamp, 'localtime') <= date(?{})", param_values.len()));
    }
    if let Some(ref eid) = employee_id {
        param_values.push(Box::new(eid.clone()));
        sql.push_str(&format!(" AND employee_id = ?{}", param_values.len()));
    }
    if let Some(ref rt) = record_type {
        param_values.push(Box::new(rt.clone()));
        sql.push_str(&format!(" AND type = ?{}", param_values.len()));
    }
}

#[tauri::command]
fn get_daily_stats(state: tauri::State<AppState>) -> Result<DailyStats, String> {
    let db = state.db.lock().unwrap();

    let total_entries: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM attendance WHERE type = 'entry' AND date(timestamp, 'localtime') = date('now', 'localtime')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_exits: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM attendance WHERE type = 'exit' AND date(timestamp, 'localtime') = date('now', 'localtime')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let unique_employees_present: i64 = db
        .query_row(
            "SELECT COUNT(DISTINCT employee_id) FROM attendance
             WHERE type = 'entry' AND date(timestamp, 'localtime') = date('now', 'localtime')
             AND employee_id NOT IN (
                 SELECT employee_id FROM attendance
                 WHERE type = 'exit' AND date(timestamp, 'localtime') = date('now', 'localtime')
             )",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let last_activity: Option<AttendanceRecord> = db
        .query_row(
            "SELECT id, employee_id, employee_name, timestamp, type, notes, created_at, updated_at
             FROM attendance WHERE date(timestamp, 'localtime') = date('now', 'localtime')
             ORDER BY timestamp DESC LIMIT 1",
            [],
            row_to_record,
        )
        .ok();

    Ok(DailyStats {
        total_entries,
        total_exits,
        unique_employees_present,
        last_activity,
    })
}

#[tauri::command]
fn update_record(
    state: tauri::State<AppState>,
    id: i64,
    timestamp: Option<String>,
    record_type: Option<String>,
    notes: Option<String>,
) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref ts) = timestamp {
        param_values.push(Box::new(ts.clone()));
        sets.push(format!("timestamp = ?{}", param_values.len()));
    }
    if let Some(ref rt) = record_type {
        param_values.push(Box::new(rt.clone()));
        sets.push(format!("type = ?{}", param_values.len()));
    }
    if let Some(ref n) = notes {
        param_values.push(Box::new(n.clone()));
        sets.push(format!("notes = ?{}", param_values.len()));
    }

    if sets.is_empty() {
        return Err("No fields to update".to_string());
    }

    sets.push("updated_at = datetime('now', 'localtime')".to_string());
    param_values.push(Box::new(id));
    let sql = format!(
        "UPDATE attendance SET {} WHERE id = ?{}",
        sets.join(", "),
        param_values.len()
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let rows_affected = db
        .execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err("Record not found".to_string());
    }

    Ok("Registro actualizado".to_string())
}

#[tauri::command]
fn delete_record(state: tauri::State<AppState>, id: i64) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    let rows_affected = db
        .execute("DELETE FROM attendance WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err("Record not found".to_string());
    }

    Ok("Registro eliminado".to_string())
}

// Employee management commands
#[tauri::command]
fn get_employees(
    state: tauri::State<AppState>,
    active_only: Option<bool>,
) -> Result<Vec<Employee>, String> {
    let db = state.db.lock().unwrap();

    let sql = if active_only.unwrap_or(false) {
        "SELECT id, name, active, created_at, updated_at FROM employees WHERE active = 1 ORDER BY name"
    } else {
        "SELECT id, name, active, created_at, updated_at FROM employees ORDER BY name"
    };

    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
    let employees = stmt
        .query_map([], |row| {
            Ok(Employee {
                id: row.get(0)?,
                name: row.get(1)?,
                active: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(employees)
}

#[tauri::command]
fn create_employee(
    state: tauri::State<AppState>,
    id: String,
    name: String,
) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    // Validate inputs
    if id.trim().is_empty() {
        return Err("El ID del empleado no puede estar vacío".to_string());
    }
    if name.trim().is_empty() {
        return Err("El nombre del empleado no puede estar vacío".to_string());
    }

    db.execute(
        "INSERT INTO employees (id, name) VALUES (?1, ?2)",
        params![id.trim().to_string(), name.trim().to_string()],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Ya existe un empleado con ese ID".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok("Empleado creado exitosamente".to_string())
}

#[tauri::command]
fn update_employee(
    state: tauri::State<AppState>,
    id: String,
    name: Option<String>,
    active: Option<bool>,
) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref n) = name {
        if n.trim().is_empty() {
            return Err("El nombre del empleado no puede estar vacío".to_string());
        }
        param_values.push(Box::new(n.trim().to_string()));
        sets.push(format!("name = ?{}", param_values.len()));
    }
    if let Some(a) = active {
        param_values.push(Box::new(a));
        sets.push(format!("active = ?{}", param_values.len()));
    }

    if sets.is_empty() {
        return Err("No hay campos para actualizar".to_string());
    }

    sets.push("updated_at = datetime('now', 'localtime')".to_string());
    param_values.push(Box::new(id.clone()));
    let sql = format!(
        "UPDATE employees SET {} WHERE id = ?{}",
        sets.join(", "),
        param_values.len()
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let rows_affected = db
        .execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err("Empleado no encontrado".to_string());
    }

    Ok("Empleado actualizado exitosamente".to_string())
}

#[tauri::command]
fn delete_employee(state: tauri::State<AppState>, id: String) -> Result<String, String> {
    let db = state.db.lock().unwrap();

    let rows_affected = db
        .execute("DELETE FROM employees WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err("Empleado no encontrado".to_string());
    }

    Ok("Empleado eliminado exitosamente".to_string())
}


#[tauri::command]
fn verify_admin_password(
    state: tauri::State<AppState>,
    password: String,
) -> Result<bool, String> {
    let db = state.db.lock().unwrap();

    let stored: String = db
        .query_row(
            "SELECT value FROM config WHERE key = 'admin_password'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(stored == password)
}

#[tauri::command]
fn export_to_excel(
    state: tauri::State<AppState>,
    start_date: Option<String>,
    end_date: Option<String>,
    employee_id: Option<String>,
    record_type: Option<String>,
) -> Result<String, String> {
    let records = {
        let db = state.db.lock().unwrap();

        let mut sql = String::from(
            "SELECT id, employee_id, employee_name, timestamp, type, notes, created_at, updated_at FROM attendance WHERE 1=1",
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        build_query_filters(&mut sql, &mut param_values, &start_date, &end_date, &employee_id, &record_type);
        sql.push_str(" ORDER BY timestamp DESC");

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        let result = stmt
            .query_map(params_refs.as_slice(), row_to_record)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        result
    };

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let header_format = Format::new().set_bold();

    let headers = ["ID", "Empleado ID", "Nombre", "Fecha", "Hora", "Tipo", "Notas"];
    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| e.to_string())?;
    }

    for (row_idx, record) in records.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        worksheet.write_number(row, 0, record.id as f64).map_err(|e| e.to_string())?;
        worksheet.write_string(row, 1, &record.employee_id).map_err(|e| e.to_string())?;
        worksheet
            .write_string(row, 2, record.employee_name.as_deref().unwrap_or(""))
            .map_err(|e| e.to_string())?;

        // Split timestamp into date and time
        let parts: Vec<&str> = record.timestamp.splitn(2, ' ').collect();
        let date_str = parts.first().unwrap_or(&"");
        let time_str = parts.get(1).unwrap_or(&"");

        worksheet.write_string(row, 3, *date_str).map_err(|e| e.to_string())?;
        worksheet.write_string(row, 4, *time_str).map_err(|e| e.to_string())?;

        let tipo = match record.r#type.as_str() {
            "entry" => "Entrada",
            "exit" => "Salida",
            other => other,
        };
        worksheet.write_string(row, 5, tipo).map_err(|e| e.to_string())?;
        worksheet
            .write_string(row, 6, record.notes.as_deref().unwrap_or(""))
            .map_err(|e| e.to_string())?;
    }

    // Set column widths
    worksheet.set_column_width(0, 8).map_err(|e| e.to_string())?;
    worksheet.set_column_width(1, 15).map_err(|e| e.to_string())?;
    worksheet.set_column_width(2, 25).map_err(|e| e.to_string())?;
    worksheet.set_column_width(3, 12).map_err(|e| e.to_string())?;
    worksheet.set_column_width(4, 10).map_err(|e| e.to_string())?;
    worksheet.set_column_width(5, 10).map_err(|e| e.to_string())?;
    worksheet.set_column_width(6, 30).map_err(|e| e.to_string())?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let filename = format!("Asistencia_{}.xlsx", today);

    // Try Desktop first, fallback to exe directory
    let export_path = if let Some(desktop) = dirs_desktop() {
        desktop.join(&filename)
    } else if let Ok(exe_dir) = std::env::current_exe() {
        exe_dir.parent().unwrap_or(std::path::Path::new(".")).join(&filename)
    } else {
        std::path::PathBuf::from(&filename)
    };

    workbook
        .save(&export_path)
        .map_err(|e| e.to_string())?;

    Ok(export_path.to_string_lossy().to_string())
}

fn dirs_desktop() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|home| std::path::PathBuf::from(home).join("Desktop"))
            .filter(|p| p.exists())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| std::path::PathBuf::from(home).join("Desktop"))
            .filter(|p| p.exists())
    }
}

fn main() {
    let conn = Connection::open("attendance.db").unwrap();
    init_database(&conn);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            check_in,
            check_out,
            get_records,
            get_daily_stats,
            update_record,
            delete_record,
            get_employees,
            create_employee,
            update_employee,
            delete_employee,
            verify_admin_password,
            export_to_excel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
