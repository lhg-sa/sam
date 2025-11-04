import frappe
from frappe import _

@frappe.whitelist()
def obtener_datos_boleta(boleta_id):
    """Obtiene estado_boleta, agente_asignado_detalle y talonario_id desde la tabla hija 'PMT Talonario Detalle'."""
    if not boleta_id:
        frappe.throw(_("El ID de boleta no puede estar vacío."))

    resultado = frappe.db.get_value(
        "PMT Talonario Detalle",
        {"boleta_id_detalle": boleta_id},
        ["estado_boleta", "agente_asignado_detalle", "talonario_id"],
        as_dict=True
    )

    if not resultado:
        frappe.throw(_("No se encontró una boleta con el ID proporcionado."))

    return resultado