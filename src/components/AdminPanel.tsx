import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";
import { FiEdit2, FiTrash2, FiX, FiRefreshCw, FiDownload, FiUsers, FiList } from "react-icons/fi";
import ConfirmDialog from "./ConfirmDialog";
import EmployeeManagement from "./EmployeeManagement";
import type { AttendanceRecord, RecordFilter, DailyStats } from "../types/attendance";

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"attendance" | "employees">("attendance");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [filters, setFilters] = useState<RecordFilter>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTimestamp, setEditTimestamp] = useState("");
  const [editType, setEditType] = useState<"entry" | "exit">("entry");
  const [editNotes, setEditNotes] = useState("");

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const loadStats = useCallback(async () => {
    try {
      const result = await invoke<DailyStats>("get_daily_stats");
      setStats(result);
    } catch (err) {
      console.error("Error al cargar estadisticas:", err);
    }
  }, []);

  const loadRecords = useCallback(async (filterParams?: RecordFilter) => {
    setLoading(true);
    clearMessages();
    try {
      const f = filterParams || {};
      const result = await invoke<AttendanceRecord[]>("get_records", {
        startDate: f.start_date || null,
        endDate: f.end_date || null,
        employeeId: f.employee_id || null,
        recordType: f.type || null,
      });
      setRecords(result);
    } catch (err) {
      setError(`Error al cargar registros: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadRecords();
  }, [loadStats, loadRecords]);

  const handleSearch = () => {
    loadRecords(filters);
  };

  const handleRefresh = () => {
    setFilters({});
    loadRecords();
    loadStats();
  };

  // Edit handlers
  const startEdit = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setEditTimestamp(record.timestamp);
    setEditType(record.type);
    setEditNotes(record.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTimestamp("");
    setEditType("entry");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    clearMessages();
    try {
      await invoke("update_record", {
        id: editingId,
        timestamp: editTimestamp,
        recordType: editType,
        notes: editNotes || null,
      });
      setSuccessMessage("Registro actualizado correctamente.");
      cancelEdit();
      loadRecords(filters);
      loadStats();
    } catch (err) {
      setError(`Error al actualizar registro: ${err}`);
    }
  };

  // Delete handlers
  const confirmDelete = async () => {
    if (deleteId === null) return;
    clearMessages();
    try {
      await invoke("delete_record", { id: deleteId });
      setSuccessMessage("Registro eliminado correctamente.");
      setDeleteId(null);
      loadRecords(filters);
      loadStats();
    } catch (err) {
      setError(`Error al eliminar registro: ${err}`);
    }
  };

  // Export handler
  const handleExport = async () => {
    clearMessages();
    try {
      const filePath = await invoke<string>("export_to_excel", {
        startDate: filters.start_date || null,
        endDate: filters.end_date || null,
        employeeId: filters.employee_id || null,
        recordType: filters.type || null,
      });
      setSuccessMessage(`Archivo exportado: ${filePath}`);
    } catch (err) {
      setError(`Error al exportar: ${err}`);
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM/yyyy");
    } catch {
      return timestamp;
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "HH:mm");
    } catch {
      return "";
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h1>Panel Administrativo</h1>
        <button className="btn-close" onClick={onBack} title="Cerrar">
          <FiX size={24} />
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "attendance" ? "active" : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          <FiList size={18} /> Registros de Asistencia
        </button>
        <button
          className={`tab-button ${activeTab === "employees" ? "active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          <FiUsers size={18} /> Empleados
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === "employees" ? (
        <EmployeeManagement />
      ) : (
        <>
          {/* Messages */}
          {error && <div className="message message-error">{error}</div>}
          {successMessage && <div className="message message-success">{successMessage}</div>}

          {/* Stats Section */}
          {stats && (
            <section className="stats-section">
              <div className="stats-card">
                <span className="stats-label">Entradas Hoy</span>
                <span className="stats-value">{stats.total_entries}</span>
              </div>
              <div className="stats-card">
                <span className="stats-label">Salidas Hoy</span>
                <span className="stats-value">{stats.total_exits}</span>
              </div>
              <div className="stats-card">
                <span className="stats-label">Ultima Actividad</span>
                <span className="stats-value">
                  {stats.last_activity
                    ? `${stats.last_activity.employee_id} - ${formatTime(stats.last_activity.timestamp)}`
                    : "Sin actividad"}
                </span>
              </div>
            </section>
          )}

          {/* Filters Section */}
          <section className="filters-section">
            <div className="filter-group">
              <label htmlFor="filter-start">Fecha Inicio</label>
              <input
                id="filter-start"
                type="date"
                className="filter-input"
                value={filters.start_date || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, start_date: e.target.value || undefined }))
                }
              />
            </div>
            <div className="filter-group">
              <label htmlFor="filter-end">Fecha Fin</label>
              <input
                id="filter-end"
                type="date"
                className="filter-input"
                value={filters.end_date || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, end_date: e.target.value || undefined }))
                }
              />
            </div>
            <div className="filter-group">
              <label htmlFor="filter-employee">ID Empleado</label>
              <input
                id="filter-employee"
                type="text"
                className="filter-input"
                placeholder="Buscar por ID..."
                value={filters.employee_id || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, employee_id: e.target.value || undefined }))
                }
              />
            </div>
            <div className="filter-group">
              <label htmlFor="filter-type">Tipo</label>
              <select
                id="filter-type"
                className="filter-input"
                value={filters.type || ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    type: (e.target.value as "entry" | "exit") || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                <option value="entry">Entrada</option>
                <option value="exit">Salida</option>
              </select>
            </div>
            <div className="filter-actions">
              <button className="btn-search" onClick={handleSearch}>
                Buscar
              </button>
              <button className="btn-refresh" onClick={handleRefresh} title="Recargar">
                <FiRefreshCw size={16} /> Recargar
              </button>
              <button className="btn-export" onClick={handleExport} title="Exportar Excel">
                <FiDownload size={16} /> Exportar Excel
              </button>
            </div>
          </section>

          {/* Records Table */}
          <section className="records-section">
            {loading ? (
              <div className="loading">Cargando registros...</div>
            ) : records.length === 0 ? (
              <div className="no-records">No se encontraron registros.</div>
            ) : (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Empleado</th>
                    <th>Nombre</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      {editingId === record.id ? (
                        <>
                          <td>{record.id}</td>
                          <td>{record.employee_id}</td>
                          <td>{record.employee_name || "-"}</td>
                          <td colSpan={2}>
                            <input
                              type="datetime-local"
                              className="edit-input"
                              value={editTimestamp.replace(" ", "T").slice(0, 16)}
                              onChange={(e) => setEditTimestamp(e.target.value.replace("T", " "))}
                            />
                          </td>
                          <td>
                            <select
                              className="edit-input"
                              value={editType}
                              onChange={(e) => setEditType(e.target.value as "entry" | "exit")}
                            >
                              <option value="entry">Entrada</option>
                              <option value="exit">Salida</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="edit-input"
                              placeholder="Notas..."
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                            />
                          </td>
                          <td className="actions-cell">
                            <button className="btn-save" onClick={saveEdit}>
                              Guardar
                            </button>
                            <button className="btn-cancel-edit" onClick={cancelEdit}>
                              Cancelar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{record.id}</td>
                          <td>{record.employee_id}</td>
                          <td>{record.employee_name || "-"}</td>
                          <td>{formatDate(record.timestamp)}</td>
                          <td>{formatTime(record.timestamp)}</td>
                          <td>
                            <span className={`type-badge type-${record.type}`}>
                              {record.type === "entry" ? "Entrada" : "Salida"}
                            </span>
                          </td>
                          <td>{record.notes || "-"}</td>
                          <td className="actions-cell">
                            <button
                              className="btn-edit"
                              onClick={() => startEdit(record)}
                              title="Editar"
                            >
                              <FiEdit2 size={16} />
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => setDeleteId(record.id)}
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Delete Confirmation */}
          <ConfirmDialog
            isOpen={deleteId !== null}
            message="Esta seguro que desea eliminar este registro? Esta accion no se puede deshacer."
            onConfirm={confirmDelete}
            onCancel={() => setDeleteId(null)}
          />
        </>
      )}
    </div>
  );
}
