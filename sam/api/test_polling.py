#!/usr/bin/env python3
"""
Script de prueba para el polling de Hikvision.

Uso:
    cd /home/frappe/frappe-bench
    python3 apps/sam/sam/api/test_polling.py
"""

import sys
import os

# Agregar el path de frappe
sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
sys.path.insert(0, '/home/frappe/frappe-bench/apps/sam')

import frappe
from sam.api.hikvision_polling import get_device_info, poll_alert_stream

def main():
    # Inicializar frappe
    frappe.init(site='sam.mdf.lan', sites_path='/home/frappe/frappe-bench/sites')
    frappe.connect()
    
    print("=" * 60)
    print("HIKVISION POLLING TEST")
    print("=" * 60)
    
    # Test 1: Device Info
    print("\n[TEST 1] Obteniendo información del dispositivo...")
    info = get_device_info()
    if info:
        print(f"  ✓ Dispositivo: {info.get('deviceName')}")
        print(f"  ✓ Modelo: {info.get('model')}")
        print(f"  ✓ Firmware: {info.get('firmwareVersion')}")
        print(f"  ✓ Serial: {info.get('serialNumber')}")
    else:
        print("  ✗ Error: No se pudo obtener información del dispositivo")
        return
    
    # Test 2: Polling
    print("\n[TEST 2] Iniciando polling por 10 segundos...")
    print("  (Los eventos se guardarán en la base de datos)")
    print()
    
    events = poll_alert_stream(10)
    
    print(f"\n  Eventos recibidos: {len(events)}")
    
    if events:
        print("\n  Últimos eventos:")
        for e in events[:5]:
            acs = e.get("AccessControllerEvent", {})
            print(f"    - {e.get('dateTime', 'N/A')}")
            print(f"      Tipo: {e.get('eventType')}")
            print(f"      Empleado: {acs.get('name', 'N/A')} ({acs.get('employeeNoString', 'N/A')})")
            print(f"      Verificación: {acs.get('currentVerifyMode', 'N/A')}")
            print()
    
    # Test 3: Verificar en base de datos
    print("[TEST 3] Verificando eventos en base de datos...")
    saved_events = frappe.get_all(
        "Hikvision Event",
        fields=["name", "event_type", "employee_no", "name_field", "received_at"],
        order_by="received_at desc",
        limit=5
    )
    
    print(f"  Eventos en BD: {len(saved_events)}")
    for e in saved_events:
        print(f"    - {e.name}: {e.event_type} | {e.name_field} ({e.employee_no})")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETADO")
    print("=" * 60)
    
    frappe.destroy()


if __name__ == "__main__":
    main()
