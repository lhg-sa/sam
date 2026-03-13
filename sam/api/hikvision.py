# Copyright (c) 2026, Lidar Holding Group S. A. and contributors
# For license information, please see license.txt

"""
Hikvision ISAPI Event Receiver

Este módulo recibe eventos del biométrico Hikvision DS-K1T341CMFW
a través del endpoint /api/method/sam.api.hikvision.receive_event

Configuración en el Hikvision:
- URL: http://172.16.0.12/api/method/sam.api.hikvision.receive_event
- Method: POST
- Content-Type: application/xml o application/json
"""

import frappe
import json
import frappe
from datetime import datetime
from lxml import etree


@frappe.whitelist(allow_guest=True, methods=["POST", "GET"])
def receive_event():
	"""
	Endpoint para recibir eventos del biométrico Hikvision.
	
	Responde inmediatamente con 200 OK para no bloquear el dispositivo.
	Solo guarda eventos de tipo 'attendanceResult' (marcajes de asistencia).
	
	Returns:
		dict: {"status": "ok", "message": "Event received"}
	"""
	try:
		# Obtener datos de la petición
		request = frappe.local.request
		raw_body = request.get_data(as_text=True)
		content_type = request.content_type or "text/plain"
		source_ip = frappe.local.request_ip or request.remote_addr
		
		# Parsear el evento
		parsed_data = parse_hikvision_event(raw_body, content_type)
		
		# Verificar si es un evento de marcaje (attendanceResult)
		event_type = parsed_data.get("eventType") if parsed_data else None
		
		# Extraer datos del AccessControllerEvent si existe
		acs_event = parsed_data.get("AccessControllerEvent", {}) if parsed_data else {}
		
		# Obtener el nombre del empleado
		employee_name = acs_event.get("name") or parsed_data.get("name") if parsed_data else None
		major_event = acs_event.get("majorEventType")
		
		# Solo guardar eventos con persona identificada (tiene nombre)
		if not employee_name:
			# Responder 200 OK pero no guardar
			return {"status": "ok", "message": "Event ignored (no employee identified)"}
		
		# Log del evento recibido
		frappe.logger("hikvision", allow_site=True).info(
			f"Attendance event received from {source_ip} | Name: {employee_name}"
		)
		
		# Crear el documento de evento
		event_doc = frappe.get_doc({
			"doctype": "Hikvision Event",
			"received_at": datetime.now(),
			"source_ip": source_ip,
			"content_type": content_type,
			"raw_body": raw_body,
			"parsed_json": json.dumps(parsed_data, indent=2) if parsed_data else None,
			"event_type": event_type,
			"employee_no": acs_event.get("employeeNoString") or parsed_data.get("employeeNo") if parsed_data else None,
			"name_field": employee_name,
			"card_no": acs_event.get("cardNo") or parsed_data.get("cardNo") if parsed_data else None,
			"event_time": parse_datetime(parsed_data.get("dateTime")) if parsed_data else None,
			"device_ip": parsed_data.get("ipAddress") or parsed_data.get("deviceIP") if parsed_data else None,
			"major_event": major_event,
			"minor_event": acs_event.get("subEventType") or parsed_data.get("minor") if parsed_data else None,
			"attendance_status": acs_event.get("attendanceStatus") or parsed_data.get("attendanceStatus") if parsed_data else None,
		})
		
		# Insertar sin notificaciones
		event_doc.insert(ignore_permissions=True)
		frappe.db.commit()
		
		frappe.logger("hikvision", allow_site=True).info(
			f"Attendance stored: {event_doc.name} | Employee: {acs_event.get('employeeNoString', 'N/A')} | Name: {acs_event.get('name', 'N/A')}"
		)
		
	except Exception as e:
		# Log del error pero responder 200 OK igualmente
		frappe.logger("hikvision", allow_site=True).error(
			f"Error processing event: {str(e)}\nRaw body: {raw_body[:500] if raw_body else 'empty'}"
		)
		# No lanzar excepción para no afectar al dispositivo
	
	# Siempre responder 200 OK
	return {"status": "ok", "message": "Event received"}


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_events(limit=50, event_type=None, employee_no=None):
	"""
	Endpoint para consultar los últimos eventos recibidos.
	
	Args:
		limit (int): Número máximo de eventos a retornar (default: 50)
		event_type (str): Filtrar por tipo de evento
		employee_no (str): Filtrar por número de empleado
	
	Returns:
		dict: Lista de eventos
	"""
	try:
		limit = int(limit) if limit else 50
		limit = min(limit, 500)  # Máximo 500 eventos
		
		filters = {}
		if event_type:
			filters["event_type"] = event_type
		if employee_no:
			filters["employee_no"] = employee_no
		
		events = frappe.get_all(
			"Hikvision Event",
			filters=filters,
			fields=[
				"name", "received_at", "source_ip", "content_type",
				"event_type", "employee_no", "name_field", "card_no",
				"event_time", "device_ip", "attendance_status",
				"major_event", "minor_event"
			],
			order_by="received_at desc",
			limit=limit
		)
		
		return {
			"status": "ok",
			"count": len(events),
			"events": events
		}
		
	except Exception as e:
		frappe.logger("hikvision", allow_site=True).error(f"Error getting events: {str(e)}")
		return {"status": "error", "message": str(e)}


def parse_hikvision_event(raw_body, content_type):
	"""
	Parsea el cuerpo del evento recibido del Hikvision.
	
	Soporta:
	- application/xml
	- text/xml
	- text/plain (asume JSON o XML)
	- application/json
	- multipart/x-mixed-replace (stream)
	
	Args:
		raw_body (str): Cuerpo raw del evento
		content_type (str): Content-Type header
	
	Returns:
		dict: Datos parseados del evento
	"""
	if not raw_body:
		return None
	
	# Normalizar content type
	content_type = (content_type or "").lower()
	
	try:
		# Limpiar el body si tiene multipart boundary
		clean_body = extract_json_from_multipart(raw_body)
		
		# Intentar parsear como JSON primero (formato más común del Hikvision)
		try:
			return json.loads(clean_body)
		except:
			pass
		
		# Intentar parsear como XML
		if "xml" in content_type:
			return parse_xml_event(clean_body)
		
		# Último intento: XML
		try:
			return parse_xml_event(clean_body)
		except:
			pass
			
	except Exception as e:
		frappe.logger("hikvision", allow_site=True).warning(
			f"Failed to parse event: {str(e)}"
		)
		return None


def extract_json_from_multipart(raw_body):
	"""
	Extrae JSON limpio de un body multipart.
	
	El Hikvision envía eventos con formato:
	--MIME_boundary
	Content-Disposition: form-data; name="event_log"
	
	{...json...}
	--MIME_boundary--
	
	Args:
		raw_body (str): Cuerpo raw del evento
	
	Returns:
		str: JSON limpio
	"""
	if not raw_body:
		return raw_body
	
	body = raw_body.strip()
	
	# Si empieza con {, es JSON puro
	if body.startswith("{"):
		# Buscar el cierre del JSON
		boundary_markers = ["--MIME_boundary", "--boundary", "\n--"]
		
		for marker in boundary_markers:
			if marker in body:
				parts = body.split(marker)
				if parts:
					json_part = parts[0].strip()
					if not json_part.endswith("}"):
						last_brace = json_part.rfind("}")
						if last_brace > 0:
							json_part = json_part[:last_brace+1]
					return json_part
		return body
	
	# Si empieza con --, es multipart
	if body.startswith("--"):
		# Buscar el JSON después de los headers multipart
		lines = body.split("\n")
		json_start = -1
		brace_count = 0
		json_lines = []
		
		for i, line in enumerate(lines):
			# Buscar el inicio del JSON (línea que empieza con {)
			if line.strip().startswith("{"):
				json_start = i
			
			if json_start >= 0:
				# Acumular líneas del JSON
				json_lines.append(line)
				brace_count += line.count("{") - line.count("}")
				
				# Si encontramos el cierre del JSON
				if brace_count == 0:
					break
		
		if json_lines:
			return "\n".join(json_lines)
	
	return raw_body


def parse_xml_event(xml_string):
	"""
	Parsea un evento XML del Hikvision (EventNotificationAlert).
	
	Args:
		xml_string (str): String XML del evento
	
	Returns:
		dict: Datos extraídos del XML
	"""
	# Limpiar el XML si tiene BOM o espacios
	xml_string = xml_string.strip()
	if xml_string.startswith('\ufeff'):
		xml_string = xml_string[1:]
	
	# Parsear XML
	parser = etree.XMLParser(remove_blank_text=True, recover=True)
	root = etree.fromstring(xml_string.encode('utf-8'), parser=parser)
	
	# Extraer campos comunes del EventNotificationAlert
	result = {}
	
	# Mapeo de campos XML a diccionario
	field_mapping = {
		# Campos estándar Hikvision
		"eventType": ["eventType", "eventtype"],
		"dateTime": ["dateTime", "datetime", "timeStamp"],
		"ipAddress": ["ipAddress", "ipaddress", "deviceIP", "deviceIp"],
		"employeeNo": ["employeeNo", "employeeno", "employeeID", "employeeId"],
		"name": ["name", "employeeName"],
		"cardNo": ["cardNo", "cardno", "cardNumber"],
		"major": ["major", "majorEvent"],
		"minor": ["minor", "minorEvent"],
		"attendanceStatus": ["attendanceStatus", "attendancestatus"],
		# Campos adicionales
		"deviceName": ["deviceName"],
		"serialNumber": ["serialNumber"],
		"macAddress": ["macAddress"],
		"channelID": ["channelID", "channelId"],
		"regionID": ["regionID", "regionId"],
	}
	
	# Buscar cada campo en el XML
	for key, xpath_names in field_mapping.items():
		for xpath_name in xpath_names:
			# Buscar en cualquier nivel del XML
			element = root.find(f".//{xpath_name}")
			if element is not None and element.text:
				result[key] = element.text.strip()
				break
	
	# Si hay un campo de verificación (face verify, fingerprint, etc.)
	verify_result = root.find(".//FaceVerifyResult") or root.find(".//FingerprintVerifyResult")
	if verify_result is not None:
		for child in verify_result:
			if child.text:
				result[child.tag] = child.text.strip()
	
	# Extraer atributos del root si existen
	if root.attrib:
		result["_attributes"] = dict(root.attrib)
	
	return result


def parse_datetime(datetime_str):
	"""
	Parsea un string de fecha/hora del Hikvision a objeto datetime.
	
	Args:
		datetime_str (str): String de fecha/hora
	
	Returns:
		datetime: Objeto datetime o None si falla
	"""
	if not datetime_str:
		return None
	
	# Formatos comunes de Hikvision
	formats = [
		"%Y-%m-%dT%H:%M:%S",
		"%Y-%m-%dT%H:%M:%S.%f",
		"%Y-%m-%d %H:%M:%S",
		"%Y-%m-%d %H:%M:%S.%f",
	]
	
	# Limpiar el string
	dt_str = datetime_str.strip()
	
	# Manejar formato ISO 8601 con timezone (ej: 2025-11-17T07:39:54-06:00)
	# Remover la parte de timezone
	if "+" in dt_str:
		dt_str = dt_str.split("+")[0]
	elif dt_str.count("-") > 2:  # Tiene timezone negativo
		# Buscar el último "-" que es parte del timezone
		last_dash = dt_str.rfind("-")
		if last_dash > 10:  # No es parte de la fecha
			dt_str = dt_str[:last_dash]
	
	# Remover Z si existe
	dt_str = dt_str.replace("Z", "")
	
	for fmt in formats:
		try:
			return datetime.strptime(dt_str.strip(), fmt)
		except ValueError:
			continue
	
	return None
