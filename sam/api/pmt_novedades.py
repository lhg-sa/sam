import json

import frappe
from frappe.sessions import get_csrf_token as _get_csrf_token


@frappe.whitelist()
def get_csrf_token():
	"""Return current session CSRF token for PWA clients."""
	if frappe.session.user == "Guest":
		frappe.throw("No autorizado", frappe.PermissionError)

	try:
		token = _get_csrf_token()
	except Exception:
		# Fallback for contexts where session_obj update is unavailable.
		token = frappe.session.data.csrf_token or frappe.generate_hash()
		frappe.session.data.csrf_token = token

	return {"csrf_token": token}


@frappe.whitelist()
def create_pmt_novedad(payload: str | None = None):
	"""Create PMT Novedades from pmt-movil app.

	Expected payload JSON:
	{
		"tipo_incidencia": "Accidente de Tránsito",
		"descripcion": "...",
		"usar_ubicacion_gps": 1,
		"latitud": 14.6,
		"longitud": -90.5,
		"precision_gps": 8.2,
		"ubicacion_texto": "Referencia",
		"imagenes": [
			{"image_data": "data:image/jpeg;base64,...", "filename": "foto1.jpg", "descripcion": "..."}
		]
	}
	"""
	if frappe.session.user == "Guest":
		frappe.throw("No autorizado", frappe.PermissionError)

	if not frappe.has_permission("PMT Novedades", ptype="create"):
		frappe.throw("No tiene permisos para registrar novedades", frappe.PermissionError)

	data = {}
	if payload:
		data = json.loads(payload)

	tipo_incidencia = (data.get("tipo_incidencia") or "").strip()
	descripcion = (data.get("descripcion") or "").strip()

	if not tipo_incidencia:
		frappe.throw("El campo Tipo de Incidencia es obligatorio")
	if not descripcion:
		frappe.throw("El campo Descripción es obligatorio")

	novedad = frappe.new_doc("PMT Novedades")
	novedad.tipo_incidencia = tipo_incidencia
	novedad.descripcion = descripcion
	novedad.usuario_registro = frappe.session.user
	novedad.usar_ubicacion_gps = 1 if data.get("usar_ubicacion_gps") else 0
	novedad.latitud = data.get("latitud")
	novedad.longitud = data.get("longitud")
	novedad.precision_gps = data.get("precision_gps")
	novedad.ubicacion_texto = (data.get("ubicacion_texto") or "").strip()

	imagenes = data.get("imagenes") or []
	if len(imagenes) > 10:
		frappe.throw("Máximo 10 imágenes por novedad")

	if novedad.usar_ubicacion_gps:
		if novedad.latitud is None or novedad.longitud is None:
			frappe.throw("Debe enviar latitud y longitud cuando activa GPS")
		if not (-90 <= float(novedad.latitud) <= 90):
			frappe.throw("Latitud fuera de rango")
		if not (-180 <= float(novedad.longitud) <= 180):
			frappe.throw("Longitud fuera de rango")

	for idx, img in enumerate(imagenes, start=1):
		file_url = None
		image_data = img.get("image_data")
		filename = img.get("filename") or f"novedad_{idx}.jpg"
		if image_data:
			if len(image_data) > 12_000_000:
				frappe.throw(f"La imagen {filename} excede el tamaño permitido")

			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": filename,
					"content": image_data,
					"decode": 1,
					"is_private": 1,
				}
			)
			file_doc.save()
			file_url = file_doc.file_url

		novedad.append(
			"imagenes",
			{
				"imagen": file_url,
				"descripcion": (img.get("descripcion") or "").strip(),
			},
		)

	novedad.insert()
	frappe.db.commit()

	return {"name": novedad.name}
