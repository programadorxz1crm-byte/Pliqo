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