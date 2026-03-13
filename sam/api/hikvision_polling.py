# Copyright (c) 2026, Lidar Holding Group S. A. and contributors
# For license information, please see license.txt

"""
Hikvision ISAPI Polling Service

Este módulo hace polling al endpoint de eventos del Hikvision
y guarda los eventos en la base de datos.

Uso:
    bench --site sam.mdf.lan console
    >>> from sam.api.hikvision_polling import poll_events
    >>> poll_events()
"""

import frappe
import json
import requests
from datetime import datetime
from requests.auth import HTTPDigestAuth


# Configuración del Hikvision
HIKVISION_CONFIG = {
    "host": "172.16.0.25",
    "port": 80,
    "username": "admin",
    "password": "Fraijanes1.",
    "timeout": 30,
}


def get_hikvision_auth():
    """Retorna las credenciales de autenticación digest."""
    return HTTPDigestAuth(
        HIKVISION_CONFIG["username"],
        HIKVISION_CONFIG["password"]
    )


def get_hikvision_url(endpoint):
    """Construye la URL completa del endpoint ISAPI."""
    host = HIKVISION_CONFIG["host"]
    port = HIKVISION_CONFIG["port"]
    return f"http://{host}:{port}{endpoint}"


def poll_alert_stream(duration_seconds=60):
    """
    Lee el stream de alertas del Hikvision por un tiempo determinado.
    
    Args:
        duration_seconds (int): Segundos a escuchar el stream
    
    Returns:
        list: Lista de eventos recibidos
    """
    import time
    
    url = get_hikvision_url("/ISAPI/Event/notification/alertStream")
    auth = get_hikvision_auth()
    timeout = HIKVISION_CONFIG["timeout"]
    
    events = []
    boundary = None
    buffer = ""
    
    frappe.logger("hikvision").info(f"Starting alert stream polling for {duration_seconds}s")
    
    try:
        with requests.get(
            url,
            auth=auth,
            headers={"Accept": "multipart/x-mixed-replace"},
            stream=True,
            timeout=(5, duration_seconds + 10)
        ) as response:
            if response.status_code != 200:
                frappe.logger("hikvision").error(f"Alert stream failed: {response.status_code}")
                return events
            
            start_time = time.time()
            
            for line in response.iter_lines(decode_unicode=True):
                if time.time() - start_time > duration_seconds:
                    break
                
                if line:
                    buffer += line + "\n"
                    
                    # Detectar boundary
                    if line.startswith("--") and boundary is None:
                        boundary = line.strip()
                    
                    # Detectar fin de evento
                    if boundary and line.strip() == boundary:
                        # Parsear el evento completo
                        event = parse_multipart_event(buffer)
                        if event:
                            events.append(event)
                            # Guardar en base de datos
                            save_event_from_stream(event)
                        buffer = ""
                        
    except requests.exceptions.Timeout:
        frappe.logger("hikvision").info("Alert stream timeout (normal)")
    except Exception as e:
        frappe.logger("hikvision").error(f"Alert stream error: {str(e)}")
    
    frappe.logger("hikvision").info(f"Polling complete. Events received: {len(events)}")
    return events


def parse_multipart_event(buffer):
    """
    Parsea un evento multipart del stream.
    
    Args:
        buffer (str): Buffer con el contenido del evento
    
    Returns:
        dict: Evento parseado o None
    """
    try:
        # Buscar el JSON en el buffer
        lines = buffer.split("\n")
        json_content = None
        in_json = False
        json_lines = []
        
        for line in lines:
            if line.strip() == "{" or in_json:
                in_json = True
                json_lines.append(line)
                if line.strip() == "}":
                    json_content = "\n".join(json_lines)
                    break
        
        if json_content:
            return json.loads(json_content)
    except Exception as e:
        frappe.logger("hikvision").debug(f"Parse error: {str(e)}")
    
    return None


def save_event_from_stream(event_data):
    """
    Guarda un evento del stream en la base de datos.
    
    Args:
        event_data (dict): Datos del evento
    """
    try:
        # Extraer datos del AccessControllerEvent
        acs_event = event_data.get("AccessControllerEvent", {})
        
        event_doc = frappe.get_doc({
            "doctype": "Hikvision Event",
            "received_at": datetime.now(),
            "source_ip": HIKVISION_CONFIG["host"],
            "content_type": "application/json",
            "raw_body": json.dumps(event_data, indent=2),
            "parsed_json": json.dumps(event_data, indent=2),
            "event_type": event_data.get("eventType"),
            "employee_no": acs_event.get("employeeNoString"),
            "name_field": acs_event.get("name"),
            "card_no": acs_event.get("cardNo"),
            "event_time": parse_hikvision_datetime(event_data.get("dateTime")),
            "device_ip": event_data.get("ipAddress"),
            "major_event": acs_event.get("majorEventType"),
            "minor_event": acs_event.get("subEventType"),
            "attendance_status": acs_event.get("attendanceStatus"),
        })
        
        event_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        frappe.logger("hikvision").info(
            f"Event saved: {event_doc.name} | Type: {event_data.get('eventType')} | "
            f"Employee: {acs_event.get('employeeNoString')} | Name: {acs_event.get('name')}"
        )
        
        return event_doc
        
    except Exception as e:
        frappe.logger("hikvision").error(f"Error saving event: {str(e)}")
        return None


def parse_hikvision_datetime(datetime_str):
    """
    Parsea un datetime del Hikvision.
    
    Args:
        datetime_str (str): String de fecha/hora
    
    Returns:
        datetime: Objeto datetime o None
    """
    if not datetime_str:
        return None
    
    # Formato: 2024-10-11T15:17:26-06:00
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(datetime_str.strip(), fmt)
        except ValueError:
            continue
    
    return None


def search_acs_events(start_time=None, end_time=None, max_results=30):
    """
    Busca eventos de control de acceso en el Hikvision.
    
    Args:
        start_time (str): Tiempo inicio (formato: 2026-03-01T00:00:00)
        end_time (str): Tiempo fin (formato: 2026-03-13T23:59:59)
        max_results (int): Máximo de resultados
    
    Returns:
        list: Lista de eventos
    """
    from datetime import timedelta
    
    if not start_time:
        start_time = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
    if not end_time:
        end_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    
    url = get_hikvision_url("/ISAPI/AccessControl/AcsEvent")
    auth = get_hikvision_auth()
    
    # El endpoint requiere POST con JSON
    payload = {
        "AcsEventCond": {
            "searchID": "001",
            "searchResultPosition": 0,
            "maxResults": max_results,
            "startTime": start_time,
            "endTime": end_time
        }
    }
    
    try:
        response = requests.post(
            url,
            auth=auth,
            json=payload,
            timeout=HIKVISION_CONFIG["timeout"]
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            frappe.logger("hikvision").error(f"AcsEvent search failed: {response.status_code}")
            return None
            
    except Exception as e:
        frappe.logger("hikvision").error(f"AcsEvent search error: {str(e)}")
        return None


def get_device_info():
    """
    Obtiene información del dispositivo Hikvision.
    
    Returns:
        dict: Información del dispositivo
    """
    url = get_hikvision_url("/ISAPI/System/deviceInfo")
    auth = get_hikvision_auth()
    
    try:
        response = requests.get(url, auth=auth, timeout=HIKVISION_CONFIG["timeout"])
        
        if response.status_code == 200:
            # Parsear XML a dict
            from xml.etree import ElementTree as ET
            root = ET.fromstring(response.content)
            
            info = {}
            for child in root:
                info[child.tag] = child.text
            
            return info
        else:
            frappe.logger("hikvision").error(f"DeviceInfo failed: {response.status_code}")
            return None
            
    except Exception as e:
        frappe.logger("hikvision").error(f"DeviceInfo error: {str(e)}")
        return None


def poll_events(duration=60):
    """
    Función principal de polling.
    
    Args:
        duration (int): Duración en segundos
    
    Returns:
        list: Eventos recibidos
    """
    print(f"Iniciando polling de eventos Hikvision por {duration} segundos...")
    print(f"Dispositivo: {HIKVISION_CONFIG['host']}")
    
    # Verificar conexión
    device_info = get_device_info()
    if device_info:
        print(f"Conectado a: {device_info.get('deviceName', 'Unknown')}")
        print(f"Modelo: {device_info.get('model', 'Unknown')}")
        print(f"Firmware: {device_info.get('firmwareVersion', 'Unknown')}")
    else:
        print("ERROR: No se pudo conectar al dispositivo")
        return []
    
    # Iniciar polling
    events = poll_alert_stream(duration)
    
    print(f"\nEventos recibidos: {len(events)}")
    for event in events:
        acs = event.get("AccessControllerEvent", {})
        print(f"  - {event.get('dateTime')}: {acs.get('name', 'Unknown')} ({acs.get('employeeNoString', 'N/A')})")
    
    return events


# Para uso desde consola
if __name__ == "__main__":
    poll_events(60)
