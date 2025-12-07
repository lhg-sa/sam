import frappe
from frappe import _
from frappe.utils import getdate


def execute(filters=None):
	filters = filters or {}
	from_date, to_date = validate_filters(filters)
	columns = get_columns()
	data = get_data(from_date, to_date)
	return columns, data


def validate_filters(filters):
	from_date = filters.get("fecha_inicial")
	to_date = filters.get("fecha_final")

	if not from_date or not to_date:
		frappe.throw(_("Debe ingresar Fecha Inicial y Fecha Final."))

	from_date = getdate(from_date)
	to_date = getdate(to_date)

	if to_date < from_date:
		frappe.throw(_("Fecha Final no puede ser anterior a Fecha Inicial."))

	return from_date, to_date


def get_columns():
	return [
		{
			"label": _("Documento"),
			"fieldname": "name",
			"fieldtype": "Link",
			"options": "PMT Boleta",
			"width": 150,
		},
		{"label": _("Numero de Boleta"), "fieldname": "boleta_id", "fieldtype": "Int", "width": 140},
		{"label": _("Fecha de Infraccion"), "fieldname": "fecha_infraccion", "fieldtype": "Date", "width": 120},
		{
			"label": _("Vehiculo / Placa"),
			"fieldname": "vehiculo_id",
			"fieldtype": "Link",
			"options": "PMT Vehiculo",
			"width": 140,
		},
		{"label": _("Propietario"), "fieldname": "propietario", "fieldtype": "Data", "width": 160},
		{"label": _("Infractor"), "fieldname": "nombre_infractor", "fieldtype": "Data", "width": 160},
		{
			"label": _("Estado"),
			"fieldname": "estado_boleta",
			"fieldtype": "Link",
			"options": "PMT Boleta Estado",
			"width": 120,
		},
		{
			"label": _("Articulo"),
			"fieldname": "articulo_codigo",
			"fieldtype": "Link",
			"options": "PMT Articulo",
			"width": 120,
		},
		{"label": _("Valor de Infraccion"), "fieldname": "articulo_valor", "fieldtype": "Currency", "width": 140},
		{"label": _("Saldo Actual"), "fieldname": "infraccion_saldo", "fieldtype": "Currency", "width": 120},
		{"label": _("Fecha de Pago"), "fieldname": "fecha_pago", "fieldtype": "Date", "width": 120},
	]


def get_data(from_date, to_date):
	return frappe.db.sql(
		"""
		SELECT
			name,
			boleta_id,
			fecha_infraccion,
			vehiculo_id,
			propietario,
			nombre_infractor,
			estado_boleta,
			articulo_codigo,
			articulo_valor,
			infraccion_saldo,
			fecha_pago
		FROM `tabPMT Boleta`
		WHERE fecha_infraccion BETWEEN %(from_date)s AND %(to_date)s
		ORDER BY fecha_infraccion ASC, boleta_id ASC
		""",
		{"from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
