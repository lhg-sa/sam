from __future__ import annotations

import frappe


TIPO_PLACA_ID_MAP = {
    0: "N",
    1: "P",
    2: "C",
    3: "P",
    4: "BUS",
    5: "P",
    6: "M",
    7: "C",
    8: "A",
    9: "O",
    10: "U",
    11: "M",
    12: "N",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    table = f"`tab{doctype_name}`"
    cases = " ".join(
        f"WHEN {key} THEN '{value}'" for key, value in TIPO_PLACA_ID_MAP.items()
    )
    sql = f"""
        UPDATE {table}
        SET tipo_placa_id = CASE idtipovehiculo
            {cases}
            ELSE 'N'
        END
    """
    frappe.db.sql(sql)
    frappe.db.commit()
