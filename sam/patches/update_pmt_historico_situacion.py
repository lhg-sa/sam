from __future__ import annotations

import frappe


TIPO_SITUACION_MAP = {
    1: "CONDUCTOR AUSENTE",
    2: "CONDUCTOR SE NEGÓ A FIRMAR",
    3: "PILOTO A LA FUGA",
    4: "NINGUNO DE LOS ANTERIORES",
    5: "FIRMO",
    6: "NULL",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    table = f"`tab{doctype_name}`"
    cases = " ".join(
        f"WHEN {key} THEN '{value}' WHEN '{key}' THEN '{value}'"
        for key, value in TIPO_SITUACION_MAP.items()
    )
    sql = f"""
        UPDATE {table}
        SET idsituacion = CASE idsituacion
            {cases}
            ELSE 'NULL'
        END
    """
    frappe.db.sql(sql)
    frappe.db.commit()
