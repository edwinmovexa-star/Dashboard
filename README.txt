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

5. PRODUCCIÓN POR HORARIO
Cada tarjeta permite capturar 08:00–10:00, 10:00–12:00, 12:00–14:00 y
15:00–17:00. Cada horario se guarda una vez por persona y fecha.
El total se actualiza después de cada captura y se usa en los reportes.
Los registros diarios históricos se conservan con su total original.
Para habilitar la captura, publica el firestore.rules actualizado en el
mismo proyecto Firebase antes de usar los archivos actualizados del dashboard.

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

ACTUALIZACIÓN: ACTIVIDADES Y PERSONAS
-------------------------------------
- El superadministrador puede crear, editar, activar, desactivar y eliminar actividades.
- Cada actividad define una unidad y una meta semanal.
- Al crear o editar una persona, la actividad se selecciona desde un combo.
- El superadministrador puede eliminar personas desde la tabla Administrar.
- Las áreas existentes se convierten automáticamente en actividades la primera vez que se abre esta versión.

IMPORTANTE: antes de usar estas funciones, publica el archivo firestore.rules actualizado en Firebase.
Desde Firebase CLI, dentro de la carpeta del proyecto, ejecuta:
firebase deploy --only firestore:rules
