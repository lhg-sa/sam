import frappe
from frappe import _
from frappe.utils import getdate, format_duration


def execute(filters=None):
	filters = frappe._dict(filters or {})

	columns = get_columns()
	data = get_data(filters)

	return columns, data


def get_columns():
	return [
		{
			"label": _("Employee"),
			"fieldname": "employee",
			"fieldtype": "Link",
			"options": "Employee",
			"width": 140,
		},
		{
			"label": _("Employee Name"),
			"fieldname": "employee_name",
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"label": _("Hik Vision ID"),
			"fieldname": "hikvision_id",
			"fieldtype": "Data",
			"width": 130,
		},
		{
			"label": _("Date"),
			"fieldname": "attendance_date",
			"fieldtype": "Date",
			"width": 100,
		},
		{
			"label": _("Entry"),
			"fieldname": "entry_time",
			"fieldtype": "Time",
			"width": 90,
		},
		{
			"label": _("Exit"),
			"fieldname": "exit_time",
			"fieldtype": "Time",
			"width": 90,
		},
		{
			"label": _("Entry Issue"),
			"fieldname": "entry_issue",
			"fieldtype": "Data",
			"width": 95,
		},
		{
			"label": _("Exit Issue"),
			"fieldname": "exit_issue",
			"fieldtype": "Data",
			"width": 95,
		},
		{
			"label": _("Extra Time"),
			"fieldname": "extra_time",
			"fieldtype": "Data",
			"width": 100,
		},
		{
			"label": _("Salida Almuerzo"),
			"fieldname": "almuerzo_sale",
			"fieldtype": "Time",
			"width": 120,
		},
		{
			"label": _("Retorno de Almuerzo"),
			"fieldname": "almuerzo_retorna",
			"fieldtype": "Time",
			"width": 120,
		},
		{
			"label": _("Puesto"),
			"fieldname": "designation",
			"fieldtype": "Link",
			"options": "Designation",
			"width": 160,
		},
		{
			"label": _("Main Department"),
			"fieldname": "department",
			"fieldtype": "Link",
			"options": "Department",
			"width": 180,
		},
	]


def get_data(filters):
	# Build conditions for the query
	conditions = ["he.event_time IS NOT NULL"]
	values = {}

	if filters.get("from_date"):
		conditions.append("DATE(he.event_time) >= %(from_date)s")
		values["from_date"] = filters["from_date"]

	if filters.get("to_date"):
		conditions.append("DATE(he.event_time) <= %(to_date)s")
		values["to_date"] = filters["to_date"]

	if filters.get("employee"):
		conditions.append("he.employee_no = %(employee)s")
		values["employee"] = filters["employee"]

	if filters.get("department"):
		conditions.append("emp.department = %(department)s")
		values["department"] = filters["department"]

	if filters.get("designation"):
		conditions.append("emp.designation = %(designation)s")
		values["designation"] = filters["designation"]

	conditions_sql = " AND ".join(conditions)

	# Query to get grouped data
	query = f"""
		SELECT
			he.employee_no AS employee,
			COALESCE(emp.employee_name, he.name_field) AS employee_name,
			he.employee_no AS hikvision_id,
			DATE(he.event_time) AS attendance_date,
			MIN(TIME(he.event_time)) AS entry_time,
			MAX(TIME(he.event_time)) AS exit_time,
			TIMESTAMPDIFF(SECOND, MIN(he.event_time), MAX(he.event_time)) AS worked_seconds,
			emp.designation AS designation,
			emp.department AS department
		FROM `tabHikvision Event` he
		LEFT JOIN `tabEmployee` emp ON emp.name = he.employee_no
		WHERE {conditions_sql}
		GROUP BY
			he.employee_no,
			COALESCE(emp.employee_name, he.name_field),
			DATE(he.event_time),
			emp.designation,
			emp.department
		ORDER BY
			DATE(he.event_time) DESC,
			he.employee_no ASC
	"""

	rows = frappe.db.sql(query, values, as_dict=True)

	data = []
	for row in rows:
		# Apply conditional filters for show_entries_late and show_leave_before
		if filters.get("show_entries_late") and not (row.entry_time and str(row.entry_time) > "08:00:00"):
			continue

		if filters.get("show_leave_before") and not (row.exit_time and str(row.exit_time) < "17:00:00"):
			continue

		# Calculate entry_issue and exit_issue with styling
		entry_issue = get_entry_issue(row.entry_time)
		exit_issue = get_exit_issue(row.exit_time)

		# Format extra_time
		extra_time = format_duration(row.worked_seconds or 0)

		data.append({
			"employee": row.employee,
			"employee_name": row.employee_name,
			"hikvision_id": row.hikvision_id,
			"attendance_date": row.attendance_date,
			"entry_time": row.entry_time,
			"exit_time": row.exit_time,
			"entry_issue": entry_issue,
			"exit_issue": exit_issue,
			"extra_time": extra_time,
			"almuerzo_sale": None,  # Placeholder for future use
			"almuerzo_retorna": None,  # Placeholder for future use
			"designation": row.designation,
			"department": row.department,
		})

	return data


def get_entry_issue(entry_time):
	if not entry_time:
		return '<span style="color: red; font-weight: bold;">NO IN</span>'
	entry_str = str(entry_time)
	if entry_str > "08:00:00":
		return '<span style="color: red; font-weight: bold;">LATE</span>'
	return '<span style="color: green; font-weight: bold;">OK</span>'


def get_exit_issue(exit_time):
	if not exit_time:
		return '<span style="color: red; font-weight: bold;">NO OUT</span>'
	exit_str = str(exit_time)
	if exit_str < "17:00:00":
		return '<span style="color: orange; font-weight: bold;">EARLY</span>'
	return '<span style="color: green; font-weight: bold;">OK</span>'