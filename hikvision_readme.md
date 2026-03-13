# Hikvision ISAPI Event Receiver

Receptor de eventos del biométrico Hikvision DS-K1T341CMFW integrado en SAM.

## Endpoints

### Recibir eventos (POST)
```
POST http://172.16.0.12/api/method/sam.api.hikvision.receive_event
```

### Consultar eventos (GET)
```
GET http://172.16.0.12/api/method/sam.api.hikvision.get_events?limit=50&event_type=attendanceResult&employee_no=EMP001
```

## Configuración del Hikvision DS-K1T341CMFW

### Paso 1: Acceder a la interfaz web del dispositivo
1. Abrir navegador y acceder a: `http://172.16.0.25`
2. Iniciar sesión con credenciales de administrador

### Paso 2: Configurar el servidor de alarmas
1. Ir a **Configuration** → **Event** → **Event Center**
2. Buscar la sección **HTTP Event Notification** o **Alarm Server**
3. Configurar:
   - **URL**: `http://172.16.0.12/api/method/sam.api.hikvision.receive_event`
   - **Method**: POST
   - **Content-Type**: application/xml (o application/json)
   - **Port**: 80

### Paso 3: Habilitar eventos de asistencia
1. Ir a **Event** → **Access Control Event**
2. Habilitar los eventos que deseas recibir:
   - ✅ Attendance Result (Resultado de asistencia)
   - ✅ Face Recognition Result (Reconocimiento facial)
   - ✅ Card Recognition Result (Lectura de tarjeta)
   - ✅ Fingerprint Recognition Result (Huella dactilar)

### Paso 4: Probar la conexión
1. Usar el botón **Test** en la configuración del dispositivo
2. O hacer una marca de prueba en el biométrico
3. Verificar en el servidor que el evento se recibió

## Formatos de evento soportados

### XML (EventNotificationAlert)
```xml
<?xml version="1.0"?>
<EventNotificationAlert version="2.0">
  <ipAddress>172.16.0.25</ipAddress>
  <eventType>attendanceResult</eventType>
  <dateTime>2026-03-12T10:30:00</dateTime>
  <employeeNo>EMP001</employeeNo>
  <name>Juan Perez</name>
  <cardNo>1234567890</cardNo>
  <major>1</major>
  <minor>1</minor>
  <attendanceStatus>checkIn</attendanceStatus>
</EventNotificationAlert>
```

### JSON
```json
{
  "eventType": "attendanceResult",
  "dateTime": "2026-03-12T11:00:00",
  "employeeNo": "EMP002",
  "name": "Maria Garcia",
  "cardNo": "9876543210",
  "attendanceStatus": "checkOut"
}
```

## Campos extraídos

| Campo | Descripción |
|-------|-------------|
| `eventType` | Tipo de evento (attendanceResult, faceRecognition, etc.) |
| `dateTime` | Fecha y hora del evento |
| `employeeNo` | Número de empleado |
| `name` | Nombre del empleado |
| `cardNo` | Número de tarjeta |
| `attendanceStatus` | Estado (checkIn, checkOut) |
| `major` | Código de evento mayor |
| `minor` | Código de evento menor |
| `ipAddress` | IP del dispositivo |

## Pruebas desde consola

### Enviar evento XML de prueba
```bash
curl -X POST "http://172.16.0.12/api/method/sam.api.hikvision.receive_event" \
  -H "Content-Type: application/xml" \
  -H "Host: sam.mdf.lan" \
  -d '<?xml version="1.0"?>
<EventNotificationAlert version="2.0">
  <ipAddress>172.16.0.25</ipAddress>
  <eventType>attendanceResult</eventType>
  <dateTime>2026-03-12T10:30:00</dateTime>
  <employeeNo>EMP001</employeeNo>
  <name>Juan Perez</name>
  <cardNo>1234567890</cardNo>
  <major>1</major>
  <minor>1</minor>
  <attendanceStatus>checkIn</attendanceStatus>
</EventNotificationAlert>'
```

### Enviar evento JSON de prueba
```bash
curl -X POST "http://172.16.0.12/api/method/sam.api.hikvision.receive_event" \
  -H "Content-Type: application/json" \
  -H "Host: sam.mdf.lan" \
  -d '{
    "eventType": "attendanceResult",
    "dateTime": "2026-03-12T11:00:00",
    "employeeNo": "EMP002",
    "name": "Maria Garcia",
    "cardNo": "9876543210",
    "attendanceStatus": "checkOut"
  }'
```

### Consultar últimos eventos
```bash
curl -s "http://172.16.0.12/api/method/sam.api.hikvision.get_events?limit=10" \
  -H "Host: sam.mdf.lan" | python3 -m json.tool
```

### Ver eventos en la base de datos
```bash
mysql -u root -p'Soporte1.$' -e "SELECT name, event_type, employee_no, name_field, attendance_status, received_at FROM _904ece5118a95aa9.\`tabHikvision Event\` ORDER BY received_at DESC LIMIT 10;"
```

## Ver logs
```bash
# Logs de Frappe
tail -f /home/frappe/frappe-bench/logs/bench-start.log | grep hikvision

# O buscar en los logs
grep -r "hikvision" /home/frappe/frappe-bench/logs/
```

## Estructura de archivos

```
sam/
├── sam/
│   ├── api/
│   │   └── hikvision.py          # API endpoints
│   └── doctype/
│       └── hikvision_event/       # DocType para almacenar eventos
│           ├── hikvision_event.json
│           └── hikvision_event.py
└── hikvision_readme.md            # Este archivo
```

## Integración futura con HRMS

Para integrar con HRMS y crear Employee Checkin automáticamente, se puede crear un hook que procese los eventos:

```python
# En hooks.py
doc_events = {
    "Hikvision Event": {
        "on_submit": "sam.api.hikvision_integration.create_employee_checkin"
    }
}
```

## Notas importantes

1. **Respuesta 200 OK**: El endpoint siempre responde 200 OK para no bloquear el dispositivo
2. **Sin autenticación**: El endpoint es público (`allow_guest=True`) para facilitar la integración
3. **Preservación de datos**: El raw_body se guarda completo aunque falle el parseo
4. **Content-Type**: Soporta XML, JSON y text/plain
