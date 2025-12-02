"""Scheduled utilities for PMT Boleta."""

from __future__ import annotations

from datetime import date, timedelta

import frappe
from frappe.utils import flt, getdate, today

DISCOUNT_RATE = 0.25
DISCOUNT_BUSINESS_DAYS = 5
INTEREST_RATE = 0.20
INTEREST_GRACE_DAYS = 6
LOCKED_STATES = {"PAGADO", "ANULADA-JUZGADO"}


def update_infraccion_saldos() -> None:
    """Recalculate `infraccion_saldo` for open boletas once per day."""

    boletas = frappe.get_all(
        "PMT Boleta",
        filters={
            "estado_boleta": ["not in", list(LOCKED_STATES)],
            "docstatus": ["<", 2],
            "articulo_valor": [">", 0],
        },
        fields=["name", "articulo_valor", "fecha_infraccion"],
    )

    if not boletas:
        return

    today_date = getdate(today())
    updates: list[tuple[float, str]] = []

    for boleta in boletas:
        principal = flt(boleta.articulo_valor)
        fecha_infraccion = getdate(boleta.fecha_infraccion) if boleta.fecha_infraccion else None
        saldo = calculate_infraccion_saldo(principal, fecha_infraccion, today_date)
        if saldo is None:
            continue
        updates.append((saldo, boleta.name))

    if not updates:
        return

    update_query = "UPDATE `tabPMT Boleta` SET infraccion_saldo = %s WHERE name = %s"
    for params in updates:
        frappe.db.sql(update_query, params)


def calculate_infraccion_saldo(principal: float, fecha_infraccion: date | None, today_date: date) -> float | None:
    if not principal or not fecha_infraccion:
        return None

    discount_deadline = add_business_days(fecha_infraccion, DISCOUNT_BUSINESS_DAYS)
    accrual_start = add_business_days(fecha_infraccion, INTEREST_GRACE_DAYS)

    if discount_deadline and today_date <= discount_deadline:
        return round(principal * (1 - DISCOUNT_RATE), 2)

    if not accrual_start or today_date <= accrual_start:
        return round(principal, 2)

    elapsed_days = max(0, (today_date - accrual_start).days)
    interest = principal * INTEREST_RATE * (elapsed_days / 365)
    return round(principal + interest, 2)


def add_business_days(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday-Friday
            added += 1
    return current
