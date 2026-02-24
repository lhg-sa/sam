from __future__ import annotations

import frappe


TIPO_LICENCIA_MAP = {
    1: "C",
    2: "B",
    3: "A",
    4: "M",
    5: "E",
    6: "NINGUNA",
    7: "NULO",
    8: "D",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    table = f"`tab{doctype_name}`"
    cases = " ".join(
        f"WHEN {key} THEN '{value}' WHEN '{key}' THEN '{value}'"
        for key, value in TIPO_LICENCIA_MAP.items()
    )
    sql = f"""
        UPDATE {table}
        SET idtipolicencia = CASE idtipolicencia
            {cases}
            ELSE 'NULO'
        END
    """
    frappe.db.sql(sql)
    frappe.db.commit()
