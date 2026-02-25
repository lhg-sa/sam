from __future__ import annotations

import frappe


def _normalize_codigo(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    cleaned = value.replace("-", ".").replace(" ", "").lower()
    parts = cleaned.split(".")
    normalized_parts: list[str] = []
    for part in parts:
        if part.isdigit():
            # remove leading zeros from purely numeric segments
            normalized_parts.append(str(int(part)))
        else:
            normalized_parts.append(part)
    return ".".join(normalized_parts)


SPECIAL_MAP = {
    "181.14": "181.14a",
    "180.2": "180.2a",
}


def execute():
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        return

    if not frappe.db.has_column(doctype_name, "articulo_valido"):
        return

    codigos = frappe.db.get_all("PMT Articulo", pluck="articulo_codigo")
    codigos = [c for c in codigos if c]
    codigo_set = set(codigos)
    codigo_lower_map: dict[str, str | None] = {}
    for codigo in codigos:
        key = codigo.lower()
        if key in codigo_lower_map:
            codigo_lower_map[key] = None
        else:
            codigo_lower_map[key] = codigo

    rows = frappe.db.sql(
        f"""
        SELECT name, blegal, articulo_valido
        FROM `tab{doctype_name}`
        WHERE blegal IS NOT NULL AND blegal != ''
        """,
        as_dict=True,
    )

    updates: list[tuple[str, str]] = []
    for row in rows:
        raw = (row.get("blegal") or "").strip()
        if not raw:
            continue

        target = ""
        if raw in codigo_set:
            target = raw
        else:
            raw_key = raw.lower()
            mapped = codigo_lower_map.get(raw_key)
            if mapped:
                target = mapped
            else:
                normalized = _normalize_codigo(raw)
                special = SPECIAL_MAP.get(normalized)
                if special:
                    if special in codigo_set:
                        target = special
                    else:
                        mapped = codigo_lower_map.get(special.lower())
                        if mapped:
                            target = mapped
                elif normalized in codigo_set:
                    target = normalized
                else:
                    mapped = codigo_lower_map.get(normalized)
                    if mapped:
                        target = mapped

        if (row.get("articulo_valido") or "") != target:
            updates.append((target, row["name"]))

    if updates:
        query = f"UPDATE `tab{doctype_name}` SET articulo_valido = %s WHERE name = %s"
        for target, name in updates:
            frappe.db.sql(query, (target, name))
        frappe.db.commit()
