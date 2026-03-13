frappe.query_reports["Hikvision Attendance Report"] = {
	filters: [
		{
			fieldname: "employee",
			label: __("Employee"),
			fieldtype: "Link",
			options: "Employee"
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.add_days(frappe.datetime.now_date(), -7)
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.now_date()
		},
		{
			fieldname: "custom_renglon",
			label: __("Renglon"),
			fieldtype: "Link",
			options: "DAFIM Renglon"
		},
		{
			fieldname: "designation",
			label: __("Puesto"),
			fieldtype: "Link",
			options: "Designation"
		},
		{
			fieldname: "department",
			label: __("Main Department"),
			fieldtype: "Link",
			options: "Department"
		},
		{
			fieldname: "show_entries_late",
			label: __("Show Entries Late"),
			fieldtype: "Check",
			default: 0
		},
		{
			fieldname: "show_leave_before",
			label: __("Show Leave Before"),
			fieldtype: "Check",
			default: 0
		}
	]
};