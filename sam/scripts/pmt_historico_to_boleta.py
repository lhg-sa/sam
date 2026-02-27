from __future__ import annotations

import csv
import os
from datetime import datetime

import frappe


AGENTE_FIJO = "HR-EMP-00001"
NOMBRE_AGENTE_FIJO = "Agente Importado"
CUI_FIJO = "0000000000000"


def _clean(value) -> str:
    return (value or "").strip()


def _estado_valido(value: str) -> str:
    estado = _clean(value) or "VERIFICACION"
    if frappe.db.exists("PMT Boleta Estado", estado):
        return estado
    return "VERIFICACION"


def _nombre_infractor(nombres: str, apellidos: str) -> str:
    return " ".join(part for part in [_clean(nombres), _clean(apellidos)] if part)


def _build_error_file_paths() -> tuple[str, str]:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_dir = "/home/frappe/frappe-bench/sites/sam.mdf.lan/private/files"
    os.makedirs(base_dir, exist_ok=True)
    csv_path = os.path.join(base_dir, f"pmt_boleta_import_errors_{ts}.csv")
    txt_path = os.path.join(base_dir, f"pmt_boleta_import_summary_{ts}.txt")
    return csv_path, txt_path


def insert_test(limit: int = 5, verbose: bool = True) -> dict:
    """
    Inserta registros de prueba en PMT Boleta usando PMT Historico.
    Mapeo solicitado por usuario.
    """

    if not frappe.db.exists("PMT Agente", AGENTE_FIJO):
        raise RuntimeError(f"No existe PMT Agente '{AGENTE_FIJO}'")
    if not frappe.db.exists("PMT Infractor", CUI_FIJO):
        raise RuntimeError(f"No existe PMT Infractor '{CUI_FIJO}'")

    rows = frappe.get_all(
        "PMT Historico",
        fields=[
            "name",
            "idinfraccion",
            "idmulta",
            "status",
            "placa_unificada",
            "fecha",
            "idmarca",
            "nombres",
            "apellidos",
            "nlicencia",
            "articulo_valido",
            "total",
            "fechalimite",
            "detalle",
            "consolidado",
            "lugar",
        ],
        order_by="creation asc, name asc",
        limit_page_length=0,
    )

    inserted = 0
    skipped_invalid = 0
    skipped_existing = 0

    for r in rows:
        boleta_id = r.get("idinfraccion")
        vehiculo_id = _clean(r.get("placa_unificada"))
        articulo_codigo = _clean(r.get("articulo_valido"))

        if not boleta_id or not vehiculo_id or not articulo_codigo:
            skipped_invalid += 1
            continue

        if frappe.db.exists("PMT Boleta", str(boleta_id)):
            skipped_existing += 1
            continue

        if not frappe.db.exists("PMT Vehiculo", vehiculo_id):
            skipped_invalid += 1
            continue

        if not frappe.db.exists("PMT Articulo", articulo_codigo):
            skipped_invalid += 1
            continue

        estado_boleta = _estado_valido(r.get("status"))

        doc = frappe.get_doc(
            {
                "doctype": "PMT Boleta",
                "boleta_id": boleta_id,
                "estado_boleta": estado_boleta,
                "agente": AGENTE_FIJO,
                "nombre_agente": NOMBRE_AGENTE_FIJO,
                "vehiculo_id": vehiculo_id,
                "fecha_infraccion": r.get("fecha"),
                "marca_vehiculo": _clean(r.get("idmarca")),
                "cui": CUI_FIJO,
                "nombre_infractor": _nombre_infractor(r.get("nombres"), r.get("apellidos")),
                "licencia_principal": _clean(r.get("nlicencia")),
                "articulo_codigo": articulo_codigo,
                "articulo_valor": r.get("total") or 0,
                "fecha_infraccion_descuento": r.get("fechalimite"),
                "descripción_del_articulo": _clean(r.get("detalle")),
                "observaciones": _clean(r.get("consolidado")),
                "ubicacion_infraccion": _clean(r.get("lugar")),
            }
        )
        doc.insert(ignore_permissions=True)

        # before_insert fija VERIFICACION; forzamos el estado solicitado después de insertar.
        if estado_boleta != "VERIFICACION":
            doc.db_set("estado_boleta", estado_boleta, update_modified=False)

        frappe.db.commit()
        inserted += 1

        if verbose:
            print(f"[{inserted}] Boleta insertada: {boleta_id} (estado={estado_boleta})")

        if inserted >= int(limit):
            break

    summary = {
        "inserted": inserted,
        "skipped_invalid": skipped_invalid,
        "skipped_existing": skipped_existing,
        "limit": limit,
    }

    if verbose:
        print(f"Resumen: {summary}")

    return summary


def insert_massive(
    limit: int | None = None,
    progress_every: int = 10000,
    commit_every: int = 1000,
    verbose: bool = True,
) -> dict:
    """
    Inserción masiva PMT Boleta desde PMT Historico.
    - Reporta avance cada `progress_every` registros procesados.
    - Genera CSV con errores (si existen) y TXT de resumen.
    """

    if not frappe.db.exists("PMT Agente", AGENTE_FIJO):
        raise RuntimeError(f"No existe PMT Agente '{AGENTE_FIJO}'")
    if not frappe.db.exists("PMT Infractor", CUI_FIJO):
        raise RuntimeError(f"No existe PMT Infractor '{CUI_FIJO}'")

    rows = frappe.get_all(
        "PMT Historico",
        fields=[
            "name",
            "idinfraccion",
            "idmulta",
            "status",
            "placa_unificada",
            "fecha",
            "idmarca",
            "nombres",
            "apellidos",
            "nlicencia",
            "articulo_valido",
            "total",
            "fechalimite",
            "detalle",
            "consolidado",
            "lugar",
        ],
        order_by="creation asc, name asc",
        limit_page_length=0,
    )

    error_csv_path, summary_txt_path = _build_error_file_paths()
    errors_written = 0

    inserted = 0
    processed = 0
    skipped_invalid = 0
    skipped_existing = 0
    skipped_missing_vehicle = 0
    skipped_missing_article = 0
    skipped_exception = 0
    uncommitted = 0

    with open(error_csv_path, "w", newline="", encoding="utf-8") as err_file:
        writer = csv.writer(err_file)
        writer.writerow(["historico_name", "boleta_id", "error_type", "error_detail"])

        for r in rows:
            processed += 1
            boleta_id = r.get("idinfraccion")
            vehiculo_id = _clean(r.get("placa_unificada"))
            articulo_codigo = _clean(r.get("articulo_valido"))

            if not boleta_id or not vehiculo_id or not articulo_codigo:
                skipped_invalid += 1
                errors_written += 1
                writer.writerow([r.get("name"), boleta_id, "invalid_required", "Falta boleta_id, vehiculo_id o articulo_codigo"])
                continue

            if frappe.db.exists("PMT Boleta", str(boleta_id)):
                skipped_existing += 1
                continue

            if not frappe.db.exists("PMT Vehiculo", vehiculo_id):
                skipped_missing_vehicle += 1
                errors_written += 1
                writer.writerow([r.get("name"), boleta_id, "missing_vehicle", f"No existe PMT Vehiculo: {vehiculo_id}"])
                continue

            if not frappe.db.exists("PMT Articulo", articulo_codigo):
                skipped_missing_article += 1
                errors_written += 1
                writer.writerow([r.get("name"), boleta_id, "missing_article", f"No existe PMT Articulo: {articulo_codigo}"])
                continue

            estado_boleta = _estado_valido(r.get("status"))

            try:
                doc = frappe.get_doc(
                    {
                        "doctype": "PMT Boleta",
                        "boleta_id": boleta_id,
                        "estado_boleta": estado_boleta,
                        "agente": AGENTE_FIJO,
                        "nombre_agente": NOMBRE_AGENTE_FIJO,
                        "vehiculo_id": vehiculo_id,
                        "fecha_infraccion": r.get("fecha"),
                        "marca_vehiculo": _clean(r.get("idmarca")),
                        "cui": CUI_FIJO,
                        "nombre_infractor": _nombre_infractor(r.get("nombres"), r.get("apellidos")),
                        "licencia_principal": _clean(r.get("nlicencia")),
                        "articulo_codigo": articulo_codigo,
                        "articulo_valor": r.get("total") or 0,
                        "fecha_infraccion_descuento": r.get("fechalimite"),
                        "descripción_del_articulo": _clean(r.get("detalle")),
                        "observaciones": _clean(r.get("consolidado")),
                        "ubicacion_infraccion": _clean(r.get("lugar")),
                    }
                )
                doc.insert(ignore_permissions=True)

                if estado_boleta != "VERIFICACION":
                    doc.db_set("estado_boleta", estado_boleta, update_modified=False)

                inserted += 1
                uncommitted += 1

                if commit_every and uncommitted >= int(commit_every):
                    frappe.db.commit()
                    uncommitted = 0

            except Exception as e:
                skipped_exception += 1
                errors_written += 1
                writer.writerow([r.get("name"), boleta_id, "insert_exception", str(e)])

            if progress_every and processed % int(progress_every) == 0:
                frappe.db.commit()
                uncommitted = 0
                if verbose:
                    print(
                        f"Avance: procesados={processed}, insertados={inserted}, "
                        f"errores={errors_written}, existentes={skipped_existing}"
                    )

            if limit and inserted >= int(limit):
                break

    if uncommitted > 0:
        frappe.db.commit()

    summary = {
        "processed": processed,
        "inserted": inserted,
        "skipped_existing": skipped_existing,
        "skipped_invalid": skipped_invalid,
        "skipped_missing_vehicle": skipped_missing_vehicle,
        "skipped_missing_article": skipped_missing_article,
        "skipped_exception": skipped_exception,
        "errors_written": errors_written,
        "error_csv": error_csv_path if errors_written else None,
        "summary_txt": summary_txt_path,
        "progress_every": progress_every,
        "commit_every": commit_every,
        "limit": limit,
    }

    with open(summary_txt_path, "w", encoding="utf-8") as f:
        f.write("Resumen carga masiva PMT Boleta\n")
        for k, v in summary.items():
            f.write(f"{k}: {v}\n")

    if errors_written == 0:
        try:
            os.remove(error_csv_path)
        except FileNotFoundError:
            pass

    if verbose:
        print(f"Finalizado: {summary}")

    return summary
