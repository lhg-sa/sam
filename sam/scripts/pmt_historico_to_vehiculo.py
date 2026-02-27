from __future__ import annotations

import frappe


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _normalize_placa_tipo(value: str | None) -> str:
    return _clean(value).upper()


def _normalize_placa_numero(value: str | None) -> str:
    # En PMT Vehiculo se espera sin espacios (según descripción del campo)
    return "".join(_clean(value).upper().split())


def _normalize_marca(value: str | None) -> str:
    return _clean(value)


def _marca_exists(value: str) -> bool:
    if not value:
        return False
    return bool(frappe.db.exists("PMT Marca Vehiculo", value))


def _placa_tipo_exists(value: str) -> bool:
    if not value:
        return False
    return bool(frappe.db.exists("PMT Placa Tipo", value))


def insert_from_historico(limit: int | None = None, commit: bool = False, verbose: bool = True) -> dict:
    """
    Inserta en PMT Vehiculo usando PMT Historico con mapeo:
      placa_tipo   <- tipo_placa_id
      placa_numero <- placa
      marca_vehiculo <- idmarca

    Regla de no repetidos:
      - solo toma la primera ocurrencia por clave (placa_tipo, placa_numero, marca_vehiculo)
      - también evita insertar si ya existe PMT Vehiculo con (placa_tipo, placa_numero)

    Args:
      limit: máximo de inserciones efectivas (útil para pruebas)
      commit: hace commit al finalizar
      verbose: imprime trazas por consola
    """

    source_rows = frappe.get_all(
        "PMT Historico",
        fields=["name", "tipo_placa_id", "placa", "idmarca", "creation"],
        order_by="creation asc, name asc",
        limit_page_length=0,
    )

    seen_source: set[tuple[str, str, str]] = set()
    inserted = 0
    skipped_source_duplicate = 0
    skipped_invalid = 0
    skipped_existing_target = 0
    skipped_missing_brand_link = 0
    skipped_invalid_placa_tipo_link = 0

    for row in source_rows:
        placa_tipo = _normalize_placa_tipo(row.get("tipo_placa_id"))
        placa_numero = _normalize_placa_numero(row.get("placa"))
        marca_vehiculo = _normalize_marca(row.get("idmarca"))

        # PMT Vehiculo exige estos campos
        if not placa_tipo or not placa_numero:
            skipped_invalid += 1
            continue
        if not _placa_tipo_exists(placa_tipo):
            skipped_invalid_placa_tipo_link += 1
            continue

        dedupe_key = (placa_tipo, placa_numero, marca_vehiculo)
        if dedupe_key in seen_source:
            skipped_source_duplicate += 1
            continue
        seen_source.add(dedupe_key)

        if frappe.db.exists(
            "PMT Vehiculo",
            {
                "placa_tipo": placa_tipo,
                "placa_numero": placa_numero,
            },
        ):
            skipped_existing_target += 1
            continue

        doc = frappe.new_doc("PMT Vehiculo")
        doc.placa_tipo = placa_tipo
        doc.placa_numero = placa_numero
        if marca_vehiculo and _marca_exists(marca_vehiculo):
            doc.marca_vehiculo = marca_vehiculo
        elif marca_vehiculo:
            skipped_missing_brand_link += 1
        doc.insert(ignore_permissions=True)

        inserted += 1
        if verbose:
            print(
                f"Insertado PMT Vehiculo: placa_tipo={placa_tipo}, "
                f"placa_numero={placa_numero}, marca_vehiculo={marca_vehiculo or '-'}"
            )

        if limit and inserted >= int(limit):
            break

    if commit:
        frappe.db.commit()

    summary = {
        "inserted": inserted,
        "skipped_source_duplicate": skipped_source_duplicate,
        "skipped_existing_target": skipped_existing_target,
        "skipped_invalid": skipped_invalid,
        "skipped_missing_brand_link": skipped_missing_brand_link,
        "skipped_invalid_placa_tipo_link": skipped_invalid_placa_tipo_link,
        "processed_source": len(source_rows),
        "committed": bool(commit),
        "limit": limit,
    }

    if verbose:
        print(f"Resumen: {summary}")

    return summary


def test_5() -> dict:
    """Prueba rápida: inserta hasta 5 registros."""
    return insert_from_historico(limit=5, commit=True, verbose=True)


def insert_one_by_one(
    limit: int | None = None,
    verbose: bool = True,
    progress_every: int = 1000,
) -> dict:
    """
    Inserta uno a uno (commit por cada inserción), para validar ejecución paso a paso.
    Usa la misma lógica de deduplicación y validación que insert_from_historico.
    """
    source_rows = frappe.get_all(
        "PMT Historico",
        fields=["name", "tipo_placa_id", "placa", "idmarca", "creation"],
        order_by="creation asc, name asc",
        limit_page_length=0,
    )

    seen_source: set[tuple[str, str, str]] = set()
    inserted = 0
    skipped_source_duplicate = 0
    skipped_invalid = 0
    skipped_existing_target = 0
    skipped_missing_brand_link = 0
    skipped_invalid_placa_tipo_link = 0

    for row in source_rows:
        placa_tipo = _normalize_placa_tipo(row.get("tipo_placa_id"))
        placa_numero = _normalize_placa_numero(row.get("placa"))
        marca_vehiculo = _normalize_marca(row.get("idmarca"))

        if not placa_tipo or not placa_numero:
            skipped_invalid += 1
            continue
        if not _placa_tipo_exists(placa_tipo):
            skipped_invalid_placa_tipo_link += 1
            continue

        dedupe_key = (placa_tipo, placa_numero, marca_vehiculo)
        if dedupe_key in seen_source:
            skipped_source_duplicate += 1
            continue
        seen_source.add(dedupe_key)

        if frappe.db.exists(
            "PMT Vehiculo",
            {
                "placa_tipo": placa_tipo,
                "placa_numero": placa_numero,
            },
        ):
            skipped_existing_target += 1
            continue

        doc = frappe.new_doc("PMT Vehiculo")
        doc.placa_tipo = placa_tipo
        doc.placa_numero = placa_numero
        if marca_vehiculo and _marca_exists(marca_vehiculo):
            doc.marca_vehiculo = marca_vehiculo
        elif marca_vehiculo:
            skipped_missing_brand_link += 1

        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        inserted += 1
        if verbose:
            print(
                f"[{inserted}] Insertado: placa_tipo={placa_tipo}, "
                f"placa_numero={placa_numero}, marca_vehiculo={marca_vehiculo or '-'}"
            )
        elif progress_every and inserted % int(progress_every) == 0:
            print(f"Avance: {inserted} registros insertados")

        if limit and inserted >= int(limit):
            break

    summary = {
        "inserted": inserted,
        "skipped_source_duplicate": skipped_source_duplicate,
        "skipped_existing_target": skipped_existing_target,
        "skipped_invalid": skipped_invalid,
        "skipped_missing_brand_link": skipped_missing_brand_link,
        "skipped_invalid_placa_tipo_link": skipped_invalid_placa_tipo_link,
        "processed_source": len(source_rows),
        "limit": limit,
        "progress_every": progress_every,
        "mode": "one-by-one",
    }

    if verbose:
        print(f"Resumen: {summary}")

    return summary
