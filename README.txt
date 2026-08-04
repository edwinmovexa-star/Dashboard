DASHBOARD DE PRODUCTIVIDAD CON FIREBASE
HTML, CSS y JavaScript normal. No utiliza React, TypeScript, Vite ni Node.js.

1. CONFIGURACIÓN
- En Firebase Console crea o selecciona tu proyecto.
- Activa Authentication > Sign-in method > Correo electrónico/contraseña.
- Crea exactamente las dos cuentas: superadministrador y administrador.
- Activa Firestore Database.
- Copia la configuración web en firebase-config.js.
- Publica el contenido de firestore.rules en Firestore > Reglas.

2. PERFILES DE USUARIO EN FIRESTORE
Crea la colección "usuarios". El ID de cada documento debe ser exactamente el
UID que aparece en Firebase Authentication.

Documento del superadministrador:
  nombre: "Edwin Martínez"
  email: "correo@noventia.com.mx"
  rol: "super_admin"
  activo: true

Documento del administrador:
  nombre: "Administrador Noventia"
  email: "correo@noventia.com.mx"
  rol: "admin"
  activo: true

3. PERMISOS
SUPERADMINISTRADOR:
- Captura productividad diaria.
- Crea y edita operadores.
- Activa o desactiva operadores.
- Importa y exporta operadores en JSON.
- Consulta registros y reportes general, semanal y mensual.

ADMINISTRADOR:
- Únicamente ve operadores activos y captura productividad diaria.
- No puede administrar operadores, consultar registros ni generar reportes.

4. OPERADORES
El superadministrador puede darlos de alta desde Administrar. Ya no es necesario
editar operadores.json manualmente. operadores.json queda como ejemplo/importación
inicial y puede importarse desde la misma pantalla.

5. REGISTROS BLOQUEADOS
Cada registro usa como ID la fecha más el ID del operador. Las reglas permiten
crearlo una sola vez y bloquean actualización y eliminación para ambos perfiles.

6. EJECUCIÓN
Abre el proyecto con Live Server o publícalo en GitHub Pages/Firebase Hosting.
Inicia siempre desde login.html.

ARCHIVOS IMPORTANTES
- firebase-config.js: configuración del proyecto.
- firebase-service.js: conexión con Authentication y Firestore.
- firestore.rules: reglas de seguridad.
- login.html / login.js: inicio de sesión real.
- index.html / app.js: dashboard, captura y administración.
- operadores.json: datos de ejemplo para importación inicial.
