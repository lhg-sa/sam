frappe.query_reports["PMT Corte Boleta"] = {
	filters: [
		{
			fieldname: "fecha_inicial",
			label: __("Fecha Inicial"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.month_start(),
		},
		{
			fieldname: "fecha_final",
			label: __("Fecha Final"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.now_date(),
		},
	],
};
