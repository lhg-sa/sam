# Copyright (c) 2026, SAM and contributors
# For license information, please see license.txt

"""
Hikvision Attendance Report

Reporte de asistencia que conecta los eventos del dispositivo Hikvision
con los empleados de HRMS/ERPNext usando attendance_device_id.
"""

import frappe
from datetime import datetime, timedelta


def execute(filters=None):
    """
    Execute the report.
    
    Args:
        filters: Dictionary with filters from the report form
    
    Returns:
        Tuple of (columns, data)
    """
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    """
    Define the columns for the report.
    
    Returns:
        List of column definitions
    """
    return [
        {"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "width": 150},
        {"fieldname": "employee_name", "label": "Employee Name", "fieldtype": "Data", "width": 250},
        {"fieldname": "hikvision_id", "label": "Hik Vision ID", "fieldtype": "Data", "width": 130},
        {"fieldname": "custom_renglon", "label": "Renglon", "fieldtype": "Link", "options": "DAFIM Renglon", "width": 100},
        {"fieldname": "designation", "label": "Puesto", "fieldtype": "Link", "options": "Designation", "width": 160},
        {"fieldname": "department", "label": "Main Department", "fieldtype": "Link", "options": "Department", "width": 180},
        {"fieldname": "date", "label": "Date", "fieldtype": "Date", "width": 120},
        {"fieldname": "entry", "label": "Entry", "fieldtype": "Time", "width": 100},
        {"fieldname": "exit_time", "label": "Exit", "fieldtype": "Time", "width": 100},
        {"fieldname": "entry_issue", "label": "Entry Issue", "fieldtype": "Data", "width": 100},
        {"fieldname": "exit_issue", "label": "Exit Issue", "fieldtype": "Data", "width": 100},
        {"fieldname": "extra_time", "label": "Extra Time", "fieldtype": "Data", "width": 120},
        {"fieldname": "late_time", "label": "Late Time", "fieldtype": "Data", "width": 120},
    ]


def get_data(filters):
    """
    Get attendance data from Hikvision Events.
    
    Args:
        filters: Dictionary with filters
    
    Returns:
        List of attendance records
    """
    filters = filters or {}
    
    # Adjust to_date to include the full day
    if filters.get("to_date"):
        to_date = datetime.strptime(filters["to_date"], "%Y-%m-%d")
        filters["to_date"] = (to_date + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Build conditions
    conditions = []
    query_params = {}
    
    if filters.get("employee"):
        conditions.append("e.name = %(employee)s")
        query_params["employee"] = filters["employee"]
    
    if filters.get("from_date"):
        conditions.append("h.event_time >= %(from_date)s")
        query_params["from_date"] = filters["from_date"]
    
    if filters.get("to_date"):
        conditions.append("h.event_time < %(to_date)s")
        query_params["to_date"] = filters["to_date"]
    
    if filters.get("custom_renglon"):
        conditions.append("e.custom_renglon = %(custom_renglon)s")
        query_params["custom_renglon"] = filters["custom_renglon"]
    
    if filters.get("designation"):
        conditions.append("e.designation = %(designation)s")
        query_params["designation"] = filters["designation"]
    
    if filters.get("department"):
        conditions.append("e.department = %(department)s")
        query_params["department"] = filters["department"]
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    # Query to get attendance records grouped by employee and date
    # Note: Using name_field (Employee ID from Hikvision) = Employee.name
    query = """
        SELECT
            e.name AS employee,
            e.employee_name AS employee_name,
            h.employee_no AS hikvision_id,
            e.custom_renglon,
            e.designation,
            e.department,
            DATE(h.event_time) AS date,
            MIN(TIME(h.event_time)) AS entry,
            MAX(TIME(h.event_time)) AS exit_time,
            s.start_time,
            s.end_time
        FROM 
            `tabHikvision Event` h
        INNER JOIN
            `tabEmployee` e 
        ON 
            h.name_field = e.name
        LEFT JOIN 
            `tabShift Type` s 
        ON 
            e.default_shift = s.name
        WHERE
            h.event_time IS NOT NULL
            AND h.name_field IS NOT NULL
            AND h.name_field != ''
            AND {where_clause}
        GROUP BY
            e.name,
            h.employee_no,
            DATE(h.event_time)
        ORDER BY
            e.employee_name,
            DATE(h.event_time)
    """.format(where_clause=where_clause)
    
    attendance_records = frappe.db.sql(query, query_params, as_dict=1)
    
    # Process records and calculate issues
    processed_records = []
    filter_applied = filters.get("show_entries_late") or filters.get("show_leave_before")
    total_extra_time = timedelta(0)
    total_late_time = timedelta(0)
    
    for record in attendance_records:
        entry_issue = ''
        exit_issue = ''
        extra_time = timedelta(0)
        late_time = timedelta(0)
        
        # Parse times for comparison
        if record.entry and record.start_time:
            try:
                entry_time = datetime.strptime(str(record.entry), "%H:%M:%S")
                shift_start_time = datetime.strptime(str(record.start_time), "%H:%M:%S")
                
                if entry_time > shift_start_time:
                    entry_issue = "<span style='color:red'>TARDE</span>"
                else:
                    entry_issue = "<span style='color:green'>OK</span>"
            except (ValueError, TypeError):
                entry_issue = "-"
        
        if record.exit_time and record.end_time:
            try:
                exit_time = datetime.strptime(str(record.exit_time), "%H:%M:%S")
                shift_end_time = datetime.strptime(str(record.end_time), "%H:%M:%S")
                
                if exit_time < shift_end_time:
                    exit_issue = "<span style='color:red'>ANTES</span>"
                else:
                    exit_issue = "<span style='color:green'>OK</span>"
            except (ValueError, TypeError):
                exit_issue = "-"
        
        # Calculate extra/late time
        if record.entry and record.exit_time and record.start_time and record.end_time:
            try:
                entry_dt = datetime.strptime(str(record.entry), "%H:%M:%S")
                exit_dt = datetime.strptime(str(record.exit_time), "%H:%M:%S")
                shift_start_dt = datetime.strptime(str(record.start_time), "%H:%M:%S")
                shift_end_dt = datetime.strptime(str(record.end_time), "%H:%M:%S")
                
                worked_hours = exit_dt - entry_dt
                shift_duration = shift_end_dt - shift_start_dt
                
                if worked_hours > shift_duration:
                    extra_time = worked_hours - shift_duration
                    total_extra_time += extra_time
                
                if worked_hours < shift_duration:
                    late_time = shift_duration - worked_hours
                    total_late_time += late_time
            except (ValueError, TypeError):
                pass
        
        # Build the processed record
        processed_record = {
            "employee": record.employee,
            "employee_name": record.employee_name,
            "hikvision_id": record.hikvision_id,
            "custom_renglon": record.custom_renglon or "",
            "designation": record.designation or "",
            "department": record.department or "",
            "date": record.date,
            "entry": record.entry,
            "exit_time": record.exit_time,
            "entry_issue": entry_issue,
            "exit_issue": exit_issue,
            "extra_time": format_timedelta(extra_time),
            "late_time": format_timedelta(late_time),
        }
        
        # Apply filters if required
        if filter_applied:
            should_add = False
            if filters.get("show_entries_late") and "TARDE" in entry_issue:
                should_add = True
            if filters.get("show_leave_before") and "ANTES" in exit_issue:
                should_add = True
            
            if should_add:
                processed_records.append(processed_record)
        else:
            processed_records.append(processed_record)
    
    # Add total row at the end
    if processed_records:
        processed_records.append({
            "employee": "<b>TOTAL</b>",
            "employee_name": "",
            "hikvision_id": "",
            "custom_renglon": "",
            "designation": "",
            "department": "",
            "date": "",
            "entry": "",
            "exit_time": "",
            "entry_issue": "",
            "exit_issue": "",
            "extra_time": "<b>" + format_timedelta(total_extra_time) + "</b>",
            "late_time": "<b>" + format_timedelta(total_late_time) + "</b>",
        })
    
    return processed_records


def format_timedelta(td):
    """
    Format a timedelta object to HH:MM:SS string.
    
    Args:
        td: timedelta object
    
    Returns:
        Formatted string
    """
    if not td or td == timedelta(0):
        return "00:00:00"
    
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
