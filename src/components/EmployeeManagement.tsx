import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FiEdit2, FiTrash2, FiPlus, FiX, FiCheck, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import ConfirmDialog from "./ConfirmDialog";
import type { Employee } from "../types/attendance";

export default function EmployeeManagement() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Add employee state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newId, setNewId] = useState("");
    const [newName, setNewName] = useState("");

    // Edit employee state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    // Delete confirmation state
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const clearMessages = () => {
        setError(null);
        setSuccessMessage(null);
    };

    const loadEmployees = async () => {
        setLoading(true);
        clearMessages();
        try {
            const result = await invoke<Employee[]>("get_employees", {
                activeOnly: false,
            });
            setEmployees(result);
        } catch (err) {
            setError(`Error al cargar empleados: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    const handleAddEmployee = async () => {
        if (!newId.trim() || !newName.trim()) {
            setError("El ID y nombre son requeridos");
            return;
        }

        clearMessages();
        try {
            await invoke("create_employee", {
                id: newId.trim(),
                name: newName.trim(),
            });
            setSuccessMessage("Empleado creado exitosamente");
            setShowAddForm(false);
            setNewId("");
            setNewName("");
            loadEmployees();
        } catch (err) {
            setError(`Error al crear empleado: ${err}`);
        }
    };

    const startEdit = (employee: Employee) => {
        setEditingId(employee.id);
        setEditName(employee.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName("");
    };

    const saveEdit = async () => {
        if (editingId === null) return;
        if (!editName.trim()) {
            setError("El nombre no puede estar vacío");
            return;
        }

        clearMessages();
        try {
            await invoke("update_employee", {
                id: editingId,
                name: editName.trim(),
                active: null,
            });
            setSuccessMessage("Empleado actualizado exitosamente");
            cancelEdit();
            loadEmployees();
        } catch (err) {
            setError(`Error al actualizar empleado: ${err}`);
        }
    };

    const toggleActive = async (employee: Employee) => {
        clearMessages();
        try {
            await invoke("update_employee", {
                id: employee.id,
                name: null,
                active: !employee.active,
            });
            setSuccessMessage(
                `Empleado ${!employee.active ? "activado" : "desactivado"} exitosamente`
            );
            loadEmployees();
        } catch (err) {
            setError(`Error al actualizar estado: ${err}`);
        }
    };

    const confirmDelete = async () => {
        if (deleteId === null) return;
        clearMessages();
        try {
            await invoke("delete_employee", { id: deleteId });
            setSuccessMessage("Empleado eliminado exitosamente");
            setDeleteId(null);
            loadEmployees();
        } catch (err) {
            setError(`Error al eliminar empleado: ${err}`);
        }
    };

    return (
        <div className="employee-management">
            <div className="employee-header">
                <h2>Gestión de Empleados</h2>
                <button
                    className="btn-add"
                    onClick={() => setShowAddForm(!showAddForm)}
                    title={showAddForm ? "Cancelar" : "Agregar Empleado"}
                >
                    {showAddForm ? <FiX size={20} /> : <FiPlus size={20} />}
                    {showAddForm ? " Cancelar" : " Agregar Empleado"}
                </button>
            </div>

            {/* Messages */}
            {error && <div className="message message-error">{error}</div>}
            {successMessage && <div className="message message-success">{successMessage}</div>}

            {/* Add Employee Form */}
            {showAddForm && (
                <div className="add-employee-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="new-employee-id">ID del Empleado</label>
                            <input
                                id="new-employee-id"
                                type="text"
                                className="form-input"
                                placeholder="Ej: 001"
                                value={newId}
                                onChange={(e) => setNewId(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-employee-name">Nombre Completo</label>
                            <input
                                id="new-employee-name"
                                type="text"
                                className="form-input"
                                placeholder="Ej: Juan Pérez"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddEmployee();
                                }}
                            />
                        </div>
                        <button className="btn-save" onClick={handleAddEmployee}>
                            <FiCheck size={16} /> Guardar
                        </button>
                    </div>
                </div>
            )}

            {/* Employees Table */}
            <div className="employees-section">
                {loading ? (
                    <div className="loading">Cargando empleados...</div>
                ) : employees.length === 0 ? (
                    <div className="no-records">
                        No hay empleados registrados. Agrega uno para comenzar.
                    </div>
                ) : (
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Estado</th>
                                <th>Fecha Creación</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map((employee) => (
                                <tr key={employee.id} className={!employee.active ? "inactive" : ""}>
                                    {editingId === employee.id ? (
                                        <>
                                            <td>{employee.id}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="edit-input"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") saveEdit();
                                                        if (e.key === "Escape") cancelEdit();
                                                    }}
                                                    autoFocus
                                                />
                                            </td>
                                            <td>
                                                <span className={`status-badge ${employee.active ? "active" : "inactive"}`}>
                                                    {employee.active ? "Activo" : "Inactivo"}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(employee.created_at).toLocaleDateString("es-MX")}
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
                                            <td>{employee.id}</td>
                                            <td>{employee.name}</td>
                                            <td>
                                                <span className={`status-badge ${employee.active ? "active" : "inactive"}`}>
                                                    {employee.active ? "Activo" : "Inactivo"}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(employee.created_at).toLocaleDateString("es-MX")}
                                            </td>
                                            <td className="actions-cell">
                                                <button
                                                    className="btn-toggle"
                                                    onClick={() => toggleActive(employee)}
                                                    title={employee.active ? "Desactivar" : "Activar"}
                                                >
                                                    {employee.active ? (
                                                        <FiToggleRight size={20} />
                                                    ) : (
                                                        <FiToggleLeft size={20} />
                                                    )}
                                                </button>
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => startEdit(employee)}
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => setDeleteId(employee.id)}
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
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={deleteId !== null}
                message={`¿Está seguro que desea eliminar este empleado? Esta acción no se puede deshacer.${employees.find((e) => e.id === deleteId)
                        ? "\n\nNota: Los registros de asistencia existentes no se eliminarán."
                        : ""
                    }`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
