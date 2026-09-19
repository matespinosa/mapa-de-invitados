# Guardar un plano por cuenta de Google

La aplicación usa Firebase Authentication para iniciar sesión con Google y Cloud Firestore para guardar un documento `plans/{uid}` por cuenta. Quien no inicia sesión conserva el borrador solo en su navegador. Al entrar por primera vez con una cuenta sin plano en la nube, ese borrador se importa; las siguientes entradas recuperan el plano de la cuenta.

## 1. Crear y configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y registra una **aplicación web**. Copia de su `firebaseConfig` los valores `apiKey`, `authDomain`, `projectId` y `appId`. Son identificadores públicos de la aplicación; **no** uses una clave privada ni una cuenta de servicio en el navegador.
2. En **Authentication → Sign-in method**, habilita **Google** y selecciona un correo de soporte.
3. En **Authentication → Settings → Authorized domains**, añade el dominio donde usarás la aplicación: `matespinosa.github.io` para GitHub Pages, tu dominio de Vercel si aplica y `localhost` para pruebas locales. Firebase ya no añade `localhost` automáticamente en proyectos recientes.
4. En **Firestore Database**, crea la base de datos y publica exactamente las reglas de [`firestore.rules`](../firestore.rules). Estas reglas permiten que cada cuenta lea y escriba únicamente `plans/{su uid}`. No dejes las reglas de prueba abiertas.

## 2. Probar en el computador

En la raíz del proyecto, crea `.env.local` con los cuatro valores de la aplicación web:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_APP_ID=...
```

Ejecuta `npm run dev`, abre la dirección local e inicia sesión. El archivo `.env.local` queda fuera de Git. Si pruebas desde el celular por Wi-Fi con `npm run dev -- --host`, añade a **Authorized domains** el dominio/IP exacto que muestra el navegador si Firebase lo requiere; para una IP local, Google puede exigir un dominio HTTPS de prueba. La opción más sencilla para probar el acceso desde otro dispositivo es una URL desplegada autorizada.

## 3. Activarlo en GitHub Pages

En GitHub, abre **Settings → Secrets and variables → Actions → Variables** del repositorio y crea las cuatro variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`. El workflow `.github/workflows/deploy-pages.yml` las pasa al build. Después ejecuta **Actions → Deploy to GitHub Pages → Run workflow** o haz un push a `main`.

Si también publicas en Vercel, agrega los mismos cuatro valores a las variables de entorno del proyecto y vuelve a desplegar. Cada dominio usado debe estar autorizado en Firebase Authentication.

## Comportamiento y límites

- La primera cuenta que entra desde un navegador con un borrador local existente importa ese borrador si aún no tiene documento en Firestore. Las cuentas con plano guardado recuperan su propia copia.
- Un cambio se guarda en la nube después de una pausa breve. La barra muestra “Guardando”, “Guardado” o un error con **Reintentar**. Si una escritura se interrumpe, el borrador pendiente se conserva en ese navegador para recuperarlo al volver a entrar.
- Dos dispositivos editando **la misma cuenta** a la vez usan el último guardado; no hay edición colaborativa en tiempo real.
- El listado inicial de invitados está incluido en los archivos estáticos de la web pública. Las reglas de Firestore protegen los cambios de cada cuenta, pero **no convierten la lista inicial en privada**. Para mantener también los nombres iniciales privados habrá que retirar ese listado del bundle público y cargarlo desde una fuente protegida después del inicio de sesión.
