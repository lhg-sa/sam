# PMT Movil PWA - Guía de instalación en nuevo servidor

## 1) Prerrequisitos
- Ubuntu/Linux con Nginx y Supervisor (o `bench setup production`).
- Bench/Frappe operativo.
- Sitio creado (ejemplo: `v15.local`).
- App `sam` instalada en el sitio.
- Node.js 18+ y npm.

## 2) Código y dependencias
Desde la raíz del bench:

```bash
cd /home/frappe/frappe-bench/frappe-bench/apps/sam/pmt_movil
npm install
```

## 3) Build de la PWA

```bash
cd /home/frappe/frappe-bench/frappe-bench/apps/sam/pmt_movil
npm run build
```

La salida se genera en:
- `apps/sam/sam/public/pmt-movil/`

## 4) Migración y caché backend

```bash
cd /home/frappe/frappe-bench/frappe-bench
bench --site v15.local migrate
bench --site v15.local clear-cache
```

## 5) Nginx para `/pmt-movil/`
Asegúrate de tener un bloque equivalente en `config/nginx.conf` (y regenerar/reload si aplica):

```nginx
location /pmt-movil/ {
    alias /home/frappe/frappe-bench/frappe-bench/sites/assets/sam/pmt-movil/;
    index index.html;
    try_files $uri $uri/ /assets/sam/pmt-movil/index.html;
    add_header Service-Worker-Allowed "/pmt-movil/";
}
location = /pmt-movil {
    return 301 /pmt-movil/;
}
```

Luego:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Reinicio de servicios

```bash
cd /home/frappe/frappe-bench/frappe-bench
bench restart
```

## 7) Validación funcional
1. Abrir `http://<host>/pmt-movil/`.
2. Login exitoso.
3. Buscar placa y ver resultados.
4. Registrar novedad (con/sin GPS, con múltiples imágenes).
5. Confirmar creación en Doctype `PMT Novedades`.
6. Logout exitoso.

## 8) Notas de seguridad
- Evidencia se guarda en archivos privados (`is_private=1`).
- API `create_pmt_novedad` respeta permisos del DocType.
- Si un usuario no tiene permisos de creación en `PMT Novedades`, verá error de permisos.

## 9) Problemas comunes

### 403/CSRFTokenError
- Verificar sesión activa.
- Limpiar caché del navegador/PWA (Service Worker y Cache Storage).
- Confirmar endpoint `sam.api.pmt_novedades.get_csrf_token` responde.

### 404 en `/pmt-movil/`
- Confirmar build ejecutado.
- Confirmar archivos en `sites/assets/sam/pmt-movil`.
- Revisar bloque Nginx y reload.

### No actualiza frontend
- Hard refresh.
- Borrar datos del sitio (SW/Cache).
- Rebuild y recarga de Nginx.
