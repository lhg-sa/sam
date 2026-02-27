from __future__ import annotations

import csv
import re
import unicodedata
from datetime import datetime
from typing import Iterable

import frappe


CSV_PATH = "/home/frappe/frappe-bench/sites/sam.mdf.lan/public/files/PMT Historico.csv"

DATE_FIELDS = {"fecha", "fechalimite", "fechaopera"}
TIME_FIELDS = {"hora"}
INT_FIELDS = {
    "idinfraccion",
    "total",
    "totallimite",
    "idsituacion",
    "idagente",
    "idmulta",
    "status",
    "idtipovehiculo",
}
CHECK_FIELDS = {"idinstitucion"}

DATE_FORMATS = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d"]
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")


FIELDS = [
    # Section: Infraccion
    {"fieldtype": "Section Break", "label": "Infracción"},
    {"fieldname": "idinfraccion", "label": "ID Infracción", "fieldtype": "Int", "in_list_view": 1},
    {"fieldname": "fecha", "label": "Fecha", "fieldtype": "Date", "in_list_view": 1},
    {"fieldname": "hora", "label": "Hora", "fieldtype": "Time", "in_list_view": 1},
    {"fieldname": "blegal", "label": "Blegal", "fieldtype": "Data"},
    {"fieldname": "detalle", "label": "Detalle", "fieldtype": "Text"},
    {"fieldtype": "Column Break"},
    {"fieldname": "lugar", "label": "Lugar", "fieldtype": "Data", "in_list_view": 1},
    {"fieldname": "total", "label": "Total", "fieldtype": "Int", "in_list_view": 1},
    {"fieldname": "observaciones", "label": "Observaciones", "fieldtype": "Text"},
    {"fieldname": "fechalimite", "label": "Fecha Límite", "fieldtype": "Date"},
    {"fieldname": "totallimite", "label": "Total Límite", "fieldtype": "Int"},
    # Section: Evidencia
    {"fieldtype": "Section Break", "label": "Evidencia"},
    {"fieldname": "foto1", "label": "Foto 1", "fieldtype": "Data"},
    {"fieldname": "foto2", "label": "Foto 2", "fieldtype": "Data"},
    {"fieldname": "foto3", "label": "Foto 3", "fieldtype": "Data"},
    # Section: Estado
    {"fieldtype": "Section Break", "label": "Estado"},
    {"fieldname": "idinstitucion", "label": "ID Institución", "fieldtype": "Check"},
    {"fieldname": "idsituacion", "label": "ID Situación", "fieldtype": "Int"},
    {"fieldname": "idagente", "label": "ID Agente", "fieldtype": "Int"},
    {"fieldname": "idmulta", "label": "ID Multa", "fieldtype": "Int"},
    {"fieldname": "status", "label": "Status", "fieldtype": "Int", "in_list_view": 1},
    # Section: Vehiculo
    {"fieldtype": "Section Break", "label": "Vehículo"},
    {"fieldname": "placa", "label": "Placa", "fieldtype": "Data", "in_list_view": 1},
    {"fieldname": "placa_unificada", "label": "Placa Unificada", "fieldtype": "Data"},
    {"fieldname": "tcirculacion", "label": "T Circulación", "fieldtype": "Data"},
    {"fieldname": "color", "label": "Color", "fieldtype": "Data"},
    {"fieldname": "idtipovehiculo", "label": "ID Tipo Vehículo", "fieldtype": "Int"},
    {"fieldname": "tipo_placa", "label": "Tipo Placa", "fieldtype": "Data"},
    {"fieldname": "tipo_placa_id", "label": "Tipo Placa ID", "fieldtype": "Data"},
    {"fieldname": "idmarca", "label": "ID Marca", "fieldtype": "Int"},
    # Section: Conductor
    {"fieldtype": "Section Break", "label": "Conductor"},
    {"fieldname": "nitconductor", "label": "NIT Conductor", "fieldtype": "Data"},
    {"fieldname": "nombres", "label": "Nombres", "fieldtype": "Data"},
    {"fieldname": "apellidos", "label": "Apellidos", "fieldtype": "Data"},
    {"fieldname": "dpi", "label": "DPI", "fieldtype": "Data"},
    {"fieldname": "cedula", "label": "Cédula", "fieldtype": "Data"},
    {"fieldname": "nlicencia", "label": "N Licencia", "fieldtype": "Data"},
    {"fieldname": "idtipolicencia", "label": "ID Tipo Licencia", "fieldtype": "Int"},
    {"fieldname": "fechaopera", "label": "Fecha Opera", "fieldtype": "Date"},
    {"fieldname": "articulo_valido", "label": "Articulo Valido", "fieldtype": "Data"},
    {"fieldname": "consolidado", "label": "Consolidado", "fieldtype": "Data"},
]

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

TIPO_PLACA_ID_MAP = {
    0: "N",
    1: "P",
    2: "C",
    3: "P",
    4: "BUS",
    5: "P",
    6: "M",
    7: "C",
    8: "A",
    9: "O",
    10: "U",
    11: "M",
    12: "N",
}

TIPO_LICENCIA_MAP = {
    1: "C",
    2: "B",
    3: "A",
    4: "M",
    5: "E",
    6: "NINGUNA",
    7: "NULO",
    8: "D",
}

TIPO_SITUACION_MAP = {
    1: "CONDUCTOR AUSENTE",
    2: "CONDUCTOR SE NEGÓ A FIRMAR",
    3: "PILOTO A LA FUGA",
    4: "NINGUNO DE LOS ANTERIORES",
    5: "FIRMO",
    6: "NULL",
}

TIPO_MARCA_MAP = {
    0: "",
    1: "TOYOTA",
    2: "MAZDA",
    3: "BLUE BIRD",
    4: "NISSAN",
    5: "INTERNACIONAL",
    6: "TORRENT",
    7: "ISUZU",
    8: "MITSUBISHI",
    9: "DATSUN",
    10: "ITALIKA",
    11: "BAJAJ",
    12: "HONDA",
    13: "PEUGEOT",
    14: "SUZUKI",
    15: "BARUCHI",
    16: "YUMBO",
    17: "CHEVROLET",
    18: "HINO",
    19: "VOLKSWAGEN",
    20: "MERCEDES",
    21: "MERCEDEZ BENZ",
    22: "GMC",
    23: "KYNLON",
    24: "FORD",
    25: "JEEP",
    26: "MOVESA",
    27: "QINGQI",
    28: "HUMMER",
    29: "MCI",
    30: "GENESIS",
    31: "KENWORTH",
    32: "HYUNDAI",
    33: "FREEDOM",
    34: "KAWASAKI",
    35: "LUS APACHE",
    36: "LEXUS",
    37: "SUBARU",
    38: "YAMAHA",
    39: "TVS",
    40: "CITROEN",
    41: "KIA",
    42: "DOBLE",
    43: "NINGUNA",
    44: "LAND ROVER",
    45: "MOVESA",
    46: "EVEREST",
    47: "RAIBAR",
    48: "TOUGH",
    49: "BMW",
    50: "JAGUAR",
    51: "ASIA HERO",
    52: "MAZDA PROTEGE",
    53: "PORSCHE",
    54: "DODGE",
    55: "LUFAN",
    56: "FORTE",
    57: "SHINERAY",
    58: "DOGE",
    59: "PLYMOUTH",
    60: "TVS",
    61: "CHEVROLET CELTA",
    62: "VOLVO",
    63: "JIALING",
    64: "MOTOLANSA",
    65: "KEEWAY",
    66: "WOLKWAGEN",
    67: "ACURA",
    68: "OM",
    69: "TVS",
    70: "FASTRAN",
    71: "CHEVY",
    72: "CHRYSLER",
    73: "GEO",
    74: "REBELLIAN",
    75: "LONCIN",
    76: "JINBE",
    77: "SCION",
    78: "PONTIAC",
    79: "FREIGHTLINER",
    80: "TOYOTA RUNER",
    81: "DESTINY",
    82: "PULSAR",
    83: "LIBERTY LIMITED ",
    84: "VENTO",
    85: "DAEWOO",
    86: "CHANA",
    87: "SRS",
    88: "DFSK",
    89: "DAIFO",
    90: "UM",
    91: "PEGASO",
    92: "RENAULT",
    93: "FIAT",
    94: "FESTIVA",
    95: "WUYANS",
    96: "SHYNRAY",
    97: "SPORT",
    98: "HYOSUNG",
    99: "RENAULT",
    100: "LAND ROVER",
    101: "DOD GEGRAND",
    102: "CHERRY",
    103: "JETTA",
    104: "YALING",
    105: "DISCOVER",
    106: "GTR",
    107: "SAMSUNG",
    108: "DENA",
    109: "AUDI",
    110: "GEAT",
    111: "SERPENTO",
    112: "SEAT",
    113: "CMC",
    114: "JMS",
    115: "BYD",
    116: "CHANGAN",
    117: "BTP",
    118: "OVION",
    119: "SKYGO",
    120: "SANYA",
    121: "ASIA",
    122: "GUILLER",
    123: "AVANTI",
    124: "SKODA",
    125: "BUICK",
    126: "MAGNUN",
    127: "ROSTR Z4",
    128: "COROLLA",
    129: "RSM",
    130: "SANAYONA",
    131: "SYM",
    132: "DRAPER",
    133: "GRAND CARAVAN",
    134: "ASIA",
    135: "NEON",
    136: "TOYOTA HILUX",
    137: "UM",
    138: "WHITE",
    139: "MAGIC",
    140: "COLT",
    141: "HILUX",
    142: "BOXER",
    143: "OPEL",
    144: "ECLIPSE",
    145: "JUMBO",
    146: "DISCOVERI",
    147: "PLATINA",
    148: "ZX",
    149: "HONLEI",
    150: "HAFEI",
    151: "AN",
    152: "CUSTOM",
    153: "DAIHATSU",
    154: "HARLEY DAVISON",
    155: "MTM",
    156: "KYNCO",
    157: "SUBURBAN",
    158: "SUKIDA",
    159: "TIMBER",
    160: "AUTOCAR",
    161: "MACK",
    162: "ADMIRAL",
    163: "DINA",
    164: "CAYEN TURBO",
    165: "RANGER ROVER",
    166: "LIYAN",
    167: "LAAAKJB",
    168: "WULING",
    169: "AHM",
    170: "ROSMAN",
    171: "JAC",
    172: "DONG FENG",
    173: "PATHFINDER",
    174: "STERLING",
    175: "KINROAD",
    176: "LIFAN",
    177: "VO TRUCKS",
    178: "LANCER",
    179: "KEIRO",
    180: "UD TRUCKS",
    181: "ALLAMERICAN",
    182: "GREAT WALL",
    183: "HERO",
    184: "ROKETA",
    185: "DAYUN",
    186: "JMC",
    187: "KTM",
    188: "FIAL",
    189: "MACK",
    190: "ROVER",
    191: "ROSMO",
    192: "RENAUTO",
    193: "MAHINDRA",
    194: "ALFA ROMEO",
    195: "BLEIZER",
    196: "KINOTIC",
    197: "HIUASHA",
    198: "MARCK",
    199: "TRAXX",
    200: "GOLD CROWN",
    201: "MAGNATIC",
    202: "FAWJIABAO",
    203: "EAGLE",
    204: "NO VISIBLE",
    205: "AUTO MOSA",
    206: "MINICOPER",
    207: "CANTER",
    208: "MEGANE",
    209: "SANG YONG",
    210: "GOL",
    211: "RINNO",
    212: "LANCRUSER",
    213: "BASHAN",
    214: "TACOMA",
    215: "CARENS",
    216: "INFINITI",
    217: "DMG",
    218: "DAELIM",
    219: "WOYANG",
    220: "POWER",
    221: "RINROAD",
    222: "SANYANG",
    223: "TANK",
    224: "WHITE VOLVO GM",
    225: "TERRACAN",
    226: "HAOJIN",
    227: "LIM",
    228: "SMART",
    229: "HONCIN",
    230: "ROVER",
    231: "MASERATI",
    232: "JAM",
    233: "MAREN",
    234: "UN MAX 125",
    235: "POOUGHAUT",
    236: "MERCURY",
    237: "DUTLANDER",
    238: "GEELY",
    239: "RESENT",
    240: "JIAPENG",
    241: "DAKAR",
    242: "MEGANE",
    243: "ZONGSHEN",
    244: "ESCALADE",
    245: "RUNNER",
    246: "SANLG",
    247: "SUNNY",
    248: "VORTEX",
    249: "APACHE",
    250: "TRIUMPH",
    251: "FLAME",
    252: "DUSTER",
    253: "DAYLIU",
    254: "SIN MARCA",
    255: "LANGOR",
    256: "DUSTER",
    257: "SEPHIA",
    258: "CITY",
    259: "NAVARRA",
    260: "AVEO",
    261: "CEBELLEAUS",
    262: "SUKIDA",
    263: "INTER",
    264: "MOTOGO",
    265: "FIRE",
    266: "COOPER",
    267: "FAW",
    268: "SANLG",
    269: "HALIKA",
    270: "DAYUN",
    271: "FYM",
    272: "HAOJUE",
    273: "RENNO",
    274: "VESPA",
    275: "SACHS MOPEDS",
    276: "HUNK",
    277: "PRINZ",
    278: "KUMOTO",
    279: "RACING",
    280: "FENGCHI",
    281: "MAX",
    282: "VIKING",
    283: "PETERBILT",
    284: "SENKE",
    285: "ATOS",
    286: "APRILIA",
    287: "BENELLI",
    288: "FOTON",
    289: "Iveco",
    290: "UNICO",
    291: "Cobra",
    292: "SATURN",
    293: "APOLO",
    294: "MRT",
    295: "SINSKI",
    296: "MTX",
    297: "AG",
    298: "CFMOTO",
    299: "FOX",
    300: "KING LONG",
    301: "DUCATI",
    302: "MASESA",
    303: "HILINER",
    304: "HYUNDAI",
    305: "OCTAVIA",
    306: "MONTERO",
    307: "XITARGA",
    308: "ENPIRE",
    309: "YITARGA",
    310: "VAYU",
    311: "OSBORNE",
    312: "AKT",
    313: "FUSO",
    314: "NORTEX",
    315: "CNJ",
    316: "FT",
    317: "TMR",
    318: "NAVI",
    319: "RAM",
    320: "COMMER",
    321: "BAJAJ PULSAR",
    322: "VENUS",
    323: "FORWARD",
    324: "MOTO GUZZI",
    325: "JMT",
    326: "DIVISA",
    327: "HUSQUEARNA",
    328: "HAULOE",
    329: "WUYANO",
    330: "HAUJE",
    331: "GOLDEN",
    332: "AMAROK",
    333: "THOMAS",
    334: "MIRAGE",
    335: "JINCHENG",
    336: "FORLAND",
    337: "NIPPONIA",
    338: "SEPON",
    339: "SUNRA",
    340: "TESLA",
    341: "CRAZY ",
    342: "scania",
    343: "HURRICANE",
    344: "YARIS",
    345: "PALETA",
    346: "CANGHE",
    347: "PULSAR",
}

TIPO_STATUS_MAP = {
    1: "PENDIENTE-PAGO",
    2: "PAGADA",
}


def _map_idtipolicencia(value) -> str:
    if value is None:
        return "NULO"
    if isinstance(value, int):
        return TIPO_LICENCIA_MAP.get(value, "NULO")
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return "NULO"
        if cleaned.isdigit():
            return TIPO_LICENCIA_MAP.get(int(cleaned), "NULO")
        return cleaned
    return "NULO"


def _map_idsituacion(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return TIPO_SITUACION_MAP.get(value, "NULL")
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return "NULL"
        if cleaned.isdigit():
            return TIPO_SITUACION_MAP.get(int(cleaned), "NULL")
        return cleaned
    return "NULL"


def _map_idmarca(value) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return TIPO_MARCA_MAP.get(value, "")
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return ""
        if cleaned.isdigit():
            return TIPO_MARCA_MAP.get(int(cleaned), "")
        return cleaned
    return ""


def _map_status(value) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return TIPO_STATUS_MAP.get(value, "")
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return ""
        if cleaned.isdigit():
            return TIPO_STATUS_MAP.get(int(cleaned), "")
        return cleaned
    return ""


def _parse_date(value: str) -> str | None:
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except Exception:
            continue
    return None


def _parse_time(value: str) -> str | None:
    match = TIME_RE.match(value)
    if not match:
        return None
    hh, mm, ss = match.groups()
    if ss is None:
        ss = "00"
    return f"{int(hh):02d}:{int(mm):02d}:{int(ss):02d}"


def _clean_value(fieldname: str, value: str):
    if value is None:
        if fieldname in INT_FIELDS or fieldname in CHECK_FIELDS:
            return 0
        return None
    value = value.strip()
    if value == "" or value.upper() == "NULL":
        if fieldname in INT_FIELDS or fieldname in CHECK_FIELDS:
            return 0
        return None

    if fieldname in CHECK_FIELDS:
        v = value.lower()
        return 1 if v in {"1", "true", "yes", "si", "sí"} else 0

    if fieldname in INT_FIELDS:
        try:
            return int(value)
        except Exception:
            return 0

    if fieldname in DATE_FIELDS:
        return _parse_date(value)

    if fieldname in TIME_FIELDS:
        return _parse_time(value)

    return value


def create_doctype():
    doctype_name = "PMT Historico"
    if frappe.db.exists("DocType", doctype_name):
        doc = frappe.get_doc("DocType", doctype_name)
        doc.module = "SAM"
        doc.set("fields", FIELDS)
        doc.autoname = "hash"
        doc.sort_field = "fecha"
        doc.sort_order = "DESC"
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc(
            {
                "doctype": "DocType",
                "name": doctype_name,
                "module": "SAM",
                "custom": 0,
                "autoname": "hash",
                "fields": FIELDS,
                "sort_field": "fecha",
                "sort_order": "DESC",
                "permissions": [
                    {
                        "role": "System Manager",
                        "read": 1,
                        "write": 1,
                        "create": 1,
                        "delete": 1,
                        "submit": 0,
                        "cancel": 0,
                        "amend": 0,
                    }
                ],
            }
        )
        doc.insert(ignore_permissions=True)

    frappe.db.commit()


def _normalize_header(value: str) -> str:
    if value is None:
        return ""
    value = value.strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value


def _iter_rows() -> Iterable[tuple]:
    fieldnames = [f["fieldname"] for f in FIELDS if f.get("fieldname")]
    aliases = {
        "tipoplaca": "tipo_placa",
        "articulovalido": "articulo_valido",
    }
    with open(CSV_PATH, newline="", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(2048)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
        except Exception:
            dialect = csv.get_dialect("excel")
        reader = csv.DictReader(f, dialect=dialect)
        mapped_headers = {}
        for header in reader.fieldnames or []:
            normalized = _normalize_header(header)
            mapped = aliases.get(normalized, normalized)
            if mapped in fieldnames:
                mapped_headers[header] = mapped
        for row in reader:
            row_mapped = {mapped: row.get(orig) for orig, mapped in mapped_headers.items()}
            idtipovehiculo = _clean_value("idtipovehiculo", row_mapped.get("idtipovehiculo"))
            idtipolicencia = _map_idtipolicencia(row_mapped.get("idtipolicencia"))
            idsituacion = _map_idsituacion(row_mapped.get("idsituacion"))
            idmarca = _map_idmarca(row_mapped.get("idmarca"))
            status = _map_status(row_mapped.get("status"))
            values = []
            for fieldname in fieldnames:
                if fieldname == "tipo_placa":
                    values.append(TIPO_PLACA_MAP.get(idtipovehiculo, "Nulo"))
                elif fieldname == "tipo_placa_id":
                    values.append(TIPO_PLACA_ID_MAP.get(idtipovehiculo, "N"))
                elif fieldname == "placa_unificada":
                    tipo = TIPO_PLACA_ID_MAP.get(idtipovehiculo, "N")
                    placa = (_clean_value("placa", row_mapped.get("placa")) or "")
                    values.append(f"{tipo}{placa}")
                elif fieldname == "idtipovehiculo":
                    values.append(idtipovehiculo)
                elif fieldname == "idtipolicencia":
                    values.append(idtipolicencia)
                elif fieldname == "idsituacion":
                    values.append(idsituacion)
                elif fieldname == "idmarca":
                    values.append(idmarca)
                elif fieldname == "status":
                    values.append(status)
                else:
                    values.append(_clean_value(fieldname, row_mapped.get(fieldname)))
            yield tuple(values)


def import_data(batch_size: int = 2000, truncate: bool = True):
    doctype_name = "PMT Historico"
    if not frappe.db.exists("DocType", doctype_name):
        raise RuntimeError("DocType 'PMT Historico' no existe. Ejecuta create_doctype primero.")

    if truncate:
        table = f"tab{doctype_name}"
        frappe.db.sql(f"TRUNCATE `{table}`")
        frappe.db.commit()

    data_fields = [f["fieldname"] for f in FIELDS if f.get("fieldname")]
    fields = [
        "name",
        "owner",
        "creation",
        "modified",
        "modified_by",
        "docstatus",
    ] + data_fields

    now = frappe.utils.now()
    owner = "Administrator"

    def value_batches():
        batch = []
        counter = 0
        for row in _iter_rows():
            counter += 1
            name = f"PMT-H-{counter:06d}"
            batch.append((name, owner, now, now, owner, 0, *row))
            if len(batch) >= batch_size:
                yield batch
                batch = []
        if batch:
            yield batch

    for batch in value_batches():
        frappe.db.bulk_insert(doctype_name, fields, batch)
        frappe.db.commit()


def update_tipo_placa_id_records():
    doctype_name = "PMT Historico"
    table = f"tab{doctype_name}"
    frappe.db.sql(
        f"""
        UPDATE `{table}`
        SET tipo_placa_id = CASE idtipovehiculo
            WHEN 0 THEN 'N'
            WHEN 1 THEN 'P'
            WHEN 2 THEN 'C'
            WHEN 3 THEN 'P'
            WHEN 4 THEN 'BUS'
            WHEN 5 THEN 'P'
            WHEN 6 THEN 'M'
            WHEN 7 THEN 'C'
            WHEN 8 THEN 'A'
            WHEN 9 THEN 'O'
            WHEN 10 THEN 'U'
            WHEN 11 THEN 'M'
            WHEN 12 THEN 'N'
            ELSE 'N'
        END
        """
    )
    frappe.db.commit()


def update_placa_unificada_records():
    doctype_name = "PMT Historico"
    table = f"tab{doctype_name}"
    frappe.db.sql(
        f"""
        UPDATE `{table}`
        SET placa_unificada = CONCAT(COALESCE(tipo_placa_id, ''), COALESCE(placa, ''))
        """
    )
    frappe.db.commit()


def run_all():
    create_doctype()
    import_data()
    update_tipo_placa_id_records()
    update_placa_unificada_records()
