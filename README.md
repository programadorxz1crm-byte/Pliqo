# Pliqo

Aplicación frontend y backend para activaciones y gestión de planes.
## Despliegue en Ubuntu (Nginx + PM2 + SSL)

Este repo incluye un script para desplegar rápidamente en un servidor Ubuntu con Nginx, PM2 y certificados de Let’s Encrypt.

1) Requisitos
- Ubuntu con puertos 80/443 abiertos.
- DNS apuntando al servidor:
  - `pliqo.gonzabot.lat` → IP del servidor
  - `botapi.gonzabot.lat` → IP del servidor

2) Ejecución
- Conéctate por SSH y ejecuta:
```
sudo bash deploy/install-ubuntu.sh --frontend=pliqo.gonzabot.lat --backend=botapi.gonzabot.lat --email=tu-correo@example.com
```

El script:
- Instala Node 18, Nginx, Certbot y PM2.
- Arranca el backend en PM2 con datos en `/var/lib/pliqo-data`.
- Construye el frontend con `VITE_API_URL=/api`.
- Configura Nginx para servir el frontend y proxy `/api` → backend.
- Emite certificados SSL y habilita redirección a HTTPS.

3) Verificación
- `https://botapi.gonzabot.lat/` → `{ "ok": true }`
- `https://pliqo.gonzabot.lat/api/` → `{ "ok": true }`
- `https://pliqo.gonzabot.lat/register` → formulario funcional (POST a `/api/auth/register`).

Logs y administración:
- `pm2 status`, `pm2 logs pliqo-backend`, `pm2 restart pliqo-backend`.
- `sudo nginx -t` y `sudo systemctl reload nginx`.
## Despliegue automático en Ubuntu (GitHub Actions)

Este proyecto incluye un workflow para instalar y configurar automáticamente el frontend y backend en un servidor Ubuntu mediante SSH, usando el instalador `deploy/install-ubuntu.sh`.

### Secretos requeridos
- `SSH_HOST`: IP o hostname del servidor (p. ej. `51.222.12.132`).
- `SSH_USER`: Usuario del servidor (p. ej. `ubuntu`).
- `SSH_PASSWORD`: Contraseña del usuario SSH.
- `SSH_PORT`: Puerto SSH (por defecto `22`).

Configúralos en GitHub → Settings → Secrets and variables → Actions → New repository secret.

### Ejecutar el workflow
1. Ve a GitHub → `Actions` → `Deploy to Ubuntu Server`.
2. Pulsa `Run workflow` y proporciona:
   - `frontend_domain`: dominio del frontend (p. ej. `pliqo.gonzabot.lat`).
   - `backend_domain`: dominio del backend (p. ej. `botapi.gonzabot.lat`).
   - `certbot_email`: correo para certificados SSL de Let’s Encrypt.
3. El workflow se conectará por SSH y ejecutará el instalador:
   - Instala Node 18, Nginx, Certbot, PM2.
   - Inicia backend en `127.0.0.1:4000` con PM2.
   - Construye frontend con `VITE_API_URL=/api` y publica en Nginx.
   - Configura proxy `/api` → backend y activa SSL para ambos dominios.

### Validación y salud
- Backend: `curl https://<backend_domain>/` debe responder `{"ok":true}`.
- Frontend proxy: `curl https://<frontend_domain>/api/` debe responder `{"ok":true}`.

### Requisitos previos
- DNS de `frontend_domain` y `backend_domain` apuntan al servidor.
- Puertos `80/443` abiertos y Nginx activo.

### Solución de problemas
- Logs backend: `pm2 logs pliqo-backend`.
- Verificar Nginx: `sudo nginx -t` y `sudo systemctl reload nginx`.
- DNS: `dig +short <frontend_domain>` y `<backend_domain>` deben devolver la IP del servidor.