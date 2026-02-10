export interface AttendanceRecord {
	id: number;
	employee_id: string;
	employee_name: string | null;
	timestamp: string;
	type: "entry" | "exit";
	notes: string | null;
	created_at: string;
	updated_at: string;
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
	unique_employees_present: number;
	last_activity: AttendanceRecord | null;
}

export interface Employee {
	id: string;
	name: string;
	active: boolean;
	created_at: string;
	updated_at: string;
}
