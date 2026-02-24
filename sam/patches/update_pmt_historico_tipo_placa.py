from __future__ import annotations

import frappe


TIPO_PLACA_MAP = {
    0: "Nulo",
    1: "PARTICULAR",
    2: "COMERCIAL",
    3: "AUTOMOVIL",
    4: "BUS",
    5: "CAMIONETILLA",
    6: "MOTO",
    7: "CAMION",
    8: "ALQUILER",
    9: "OFICIALES",
    10: "U Bus Urbano",
    11: "APACHE",
    12: "EXTRANJERO",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    table = f"`tab{doctype_name}`"
    cases = " ".join(
        f"WHEN {key} THEN '{value}'" for key, value in TIPO_PLACA_MAP.items()
    )
    sql = f"""
        UPDATE {table}
        SET tipo_placa = CASE idtipovehiculo
            {cases}
            ELSE 'Nulo'
        END
    """
    frappe.db.sql(sql)
    frappe.db.commit()
