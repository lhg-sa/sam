from __future__ import annotations

import frappe


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    meta = frappe.get_meta(doctype_name)
    fieldnames = [
        f.fieldname
        for f in meta.fields
        if f.fieldname
        and f.fieldname != "consolidado"
        and f.fieldtype not in {"Section Break", "Column Break", "Tab Break"}
    ]
    if not fieldnames:
        return

    table = f"`tab{doctype_name}`"
    parts = ", ' | ', ".join(f"COALESCE(CAST({table}.`{fn}` AS CHAR), '')" for fn in fieldnames)
    sql = f"UPDATE {table} SET consolidado = CONCAT({parts})"
    frappe.db.sql(sql)
    frappe.db.commit()
