from __future__ import annotations

import frappe


TIPO_STATUS_MAP = {
    1: "PENDIENTE-PAGO",
    2: "PAGADA",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    # Ensure column can store text values before updating.
    try:
        frappe.db.change_column_type(doctype_name, "status", "Data")
    except Exception:
        table = f"`tab{doctype_name}`"
        frappe.db.sql(f"ALTER TABLE {table} MODIFY COLUMN status VARCHAR(140)")

    table = f"`tab{doctype_name}`"
    cases = " ".join(
        f"WHEN {key} THEN '{value}' WHEN '{key}' THEN '{value}'"
        for key, value in TIPO_STATUS_MAP.items()
    )
    sql = f"""
        UPDATE {table}
        SET status = CASE status
            {cases}
            ELSE ''
        END
    """
    frappe.db.sql(sql)
    frappe.db.commit()
