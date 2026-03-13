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


def get_device_config(device_name=None):
	"""
	Obtiene la configuración del dispositivo desde el DocType.
	
	Args:
		device_name (str): Nombre del dispositivo. Si es None, retorna el primero activo.
	
	Returns:
		dict: Configuración del dispositivo o None si no existe
	"""
	filters = {"is_active": 1}
	if device_name:
		filters["name"] = device_name
	
	device = frappe.db.get_value(
		"Hikvision Device",
		filters,
		["name", "device_name", "device_ip", "port", "username", "password"],
		as_dict=True
	)
	
	if not device:
		return None
	
	# Obtener la contraseña (campo Password)
	password = frappe.get_decrypted_password("Hikvision Device", device.name, "password")
	
	return {
		"host": device.device_ip,
		"port": device.port or 80,
		"username": device.username,
		"password": password,
		"timeout": 30,
	}


def get_hikvision_auth(device_name=None):
	"""Retorna las credenciales de autenticación digest."""
	config = get_device_config(device_name)
	if not config:
		raise ValueError("No active Hikvision device found in configuration")
	
	return HTTPDigestAuth(config["username"], config["password"])


def get_hikvision_url(endpoint, device_name=None):
	"""Construye la URL completa del endpoint ISAPI."""
	config = get_device_config(device_name)
	if not config:
		raise ValueError("No active Hikvision device found in configuration")
	
	host = config["host"]
	port = config["port"]
	return f"http://{host}:{port}{endpoint}"


def poll_alert_stream(duration_seconds=60, device_name=None):
    """
    Lee el stream de alertas del Hikvision por un tiempo determinado.
    
    Args:
        duration_seconds (int): Segundos a escuchar el stream
        device_name (str): Nombre del dispositivo (opcional)
    
    Returns:
        list: Lista de eventos recibidos
    """
    import time
    
    config = get_device_config(device_name)
    if not config:
        raise ValueError("No active Hikvision device found in configuration")
    
    url = get_hikvision_url("/ISAPI/Event/notification/alertStream", device_name)
    auth = get_hikvision_auth(device_name)
    timeout = config["timeout"]
    
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


def save_event_from_stream(event_data, device_name=None):
    """
    Guarda un evento del stream en la base de datos.
    
    Args:
        event_data (dict): Datos del evento
        device_name (str): Nombre del dispositivo (opcional)
    """
    try:
        config = get_device_config(device_name)
        if not config:
            raise ValueError("No active Hikvision device found in configuration")
        
        # Extraer datos del AccessControllerEvent
        acs_event = event_data.get("AccessControllerEvent", {})
        
        event_doc = frappe.get_doc({
            "doctype": "Hikvision Event",
            "received_at": datetime.now(),
            "source_ip": config["host"],
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
    
    config = get_device_config()
    if not config:
        raise ValueError("No active Hikvision device found in configuration")
    
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
            timeout=config["timeout"]
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            frappe.logger("hikvision").error(f"AcsEvent search failed: {response.status_code}")
            return None
            
    except Exception as e:
        frappe.logger("hikvision").error(f"AcsEvent search error: {str(e)}")
        return None


def get_device_info(device_name=None):
    """
    Obtiene información del dispositivo Hikvision.
    
    Args:
        device_name (str): Nombre del dispositivo (opcional)
    
    Returns:
        dict: Información del dispositivo
    """
    config = get_device_config(device_name)
    if not config:
        raise ValueError("No active Hikvision device found in configuration")
    
    url = get_hikvision_url("/ISAPI/System/deviceInfo", device_name)
    auth = get_hikvision_auth(device_name)
    
    try:
        response = requests.get(url, auth=auth, timeout=config["timeout"])
        
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


def poll_events(duration=60, device_name=None):
    """
    Función principal de polling.
    
    Args:
        duration (int): Duración en segundos
        device_name (str): Nombre del dispositivo (opcional)
    
    Returns:
        list: Eventos recibidos
    """
    config = get_device_config(device_name)
    if not config:
        raise ValueError("No active Hikvision device found in configuration")
    
    print(f"Iniciando polling de eventos Hikvision por {duration} segundos...")
    print(f"Dispositivo: {config['host']}")
    
    # Verificar conexión
    device_info = get_device_info(device_name)
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
