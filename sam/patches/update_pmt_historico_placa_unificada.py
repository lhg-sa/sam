from __future__ import annotations

import frappe


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    table = f"`tab{doctype_name}`"
    frappe.db.sql(
        f"""
        UPDATE {table}
        SET placa_unificada = CONCAT(COALESCE(tipo_placa_id, ''), COALESCE(placa, ''))
        """
    )
    frappe.db.commit()
