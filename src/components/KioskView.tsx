import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Employee } from '../types/attendance';

export default function KioskView() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [lastRecord, setLastRecord] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const result = await invoke<Employee[]>('get_employees', {
                activeOnly: true,
            });
            setEmployees(result);
        } catch (error) {
            setLastRecord(`❌ Error al cargar empleados: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        if (!selectedEmployeeId) {
            setLastRecord('⚠️ Selecciona un empleado');
            return;
        }
        try {
            const employee = employees.find(e => e.id === selectedEmployeeId);
            await invoke('check_in', {
                employeeId: selectedEmployeeId,
                employeeName: employee?.name || null,
            });
            setLastRecord(`✅ Entrada registrada: ${employee?.name || selectedEmployeeId}`);
            setSelectedEmployeeId('');
        } catch (error) {
            setLastRecord(`❌ Error: ${error}`);
        }
    };

    const handleCheckOut = async () => {
        if (!selectedEmployeeId) {
            setLastRecord('⚠️ Selecciona un empleado');
            return;
        }
        try {
            const employee = employees.find(e => e.id === selectedEmployeeId);
            await invoke('check_out', {
                employeeId: selectedEmployeeId,
                employeeName: employee?.name || null,
            });
            setLastRecord(`🔴 Salida registrada: ${employee?.name || selectedEmployeeId}`);
            setSelectedEmployeeId('');
        } catch (error) {
            setLastRecord(`❌ Error: ${error}`);
        }
    };

    if (loading) {
        return (
            <div className="kiosk">
                <h1>REGISTRO DE ASISTENCIA</h1>
                <p className="loading">Cargando empleados...</p>
            </div>
        );
    }

    if (employees.length === 0) {
        return (
            <div className="kiosk">
                <h1>REGISTRO DE ASISTENCIA</h1>
                <div className="no-employees">
                    <p>⚠️ No hay empleados registrados</p>
                    <p className="hint">
                        Presiona F12 para acceder al panel de administración y agregar empleados
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="kiosk">
            <h1>REGISTRO DE ASISTENCIA</h1>

            <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="employee-select"
                autoFocus
            >
                <option value="">-- Selecciona un empleado --</option>
                {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.id})
                    </option>
                ))}
            </select>

            <div className="buttons">
                <button onClick={handleCheckIn} className="btn-entry">
                    🟢 ENTRADA
                </button>
                <button onClick={handleCheckOut} className="btn-exit">
                    🔴 SALIDA
                </button>
            </div>

            {lastRecord && <p className="last-record">{lastRecord}</p>}

            <p className="hint">Presiona F12 para panel de administración</p>
        </div>
    );
}