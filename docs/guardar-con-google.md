# Entrar con Google y guardar el plano

La aplicación usa Firebase Authentication para iniciar sesión con Google y Cloud Firestore para guardar un documento `plans/{uid}` por cuenta. **Entrar con Google es la única forma de abrir el organizador**: sin sesión no se ve el plano, y no hay usuario ni contraseña aparte, así que tampoco hay nada que recuperar. Al entrar por primera vez con una cuenta sin plano en la nube, el borrador que existiera en ese navegador se importa; las siguientes entradas recuperan el plano de la cuenta.

## Quién puede entrar

La lista está en [`app/allowed-accounts.ts`](../app/allowed-accounts.ts):

```ts
export const allowedAccounts: AllowedAccount[] = [
  { email: 'matespinosa09@gmail.com', name: 'Mateo' },
  { email: '', name: 'Juliet' },
];
```

Para habilitar a alguien, escribe su correo de Google en `email`. **Una entrada con `email` vacío no deja entrar a nadie**, así que Juliet no podrá abrir el plano hasta que se complete el suyo. El `name` solo se usa para el saludo mientras Google no haya dado un nombre de perfil.

Una cuenta llega al organizador cuando cumple las tres condiciones:

1. La sesión viene del proveedor `google.com`. Eso es lo que hace que sea de verdad una cuenta de Google y no un correo cualquiera escrito a mano.
2. Google tiene el correo verificado.
3. El correo está en la lista de arriba.

Se aceptan tanto las cuentas `@gmail.com` como las de Google Workspace con dominio propio; en ambos casos quien valida la identidad es Google. Para comparar, los correos de Gmail se normalizan como los lee Google: `ma.teo+bodas@gmail.com` y `mateo@gmail.com` son la misma cuenta. Otros dominios se comparan tal cual, solo en minúsculas.

Quien entra con una cuenta que no está en la lista ve un aviso de plano privado y un botón para entrar con otra cuenta. No se lee ni se escribe ningún plano para esa sesión. Las reglas de Firestore siguen siendo la protección real: cada cuenta solo puede tocar su propio documento.

## La cuenta dentro del organizador

Con la sesión abierta, la esquina superior derecha muestra la foto de perfil de Google y el nombre de pila. Al abrirla aparece el nombre completo, el correo de la cuenta y **Cerrar sesión**. Salir devuelve a la pantalla de entrada, que saluda a esa persona por su nombre para volver de un toque.

## Volver a entrar desde el mismo dispositivo

Al entrar con una cuenta aprobada, el navegador guarda el nombre, el correo y la foto de perfil en `localStorage` para saludar por el nombre («Hola, Mateo — bienvenido de vuelta») y ofrecer esa cuenta de un toque. **No se guarda ninguna contraseña ni token**: la sesión la maneja Firebase y quien verifica sigue siendo Google. En la pantalla de entrada, «olvidar esta cuenta» borra ese recuerdo del dispositivo. El saludo sigue a quien entró de último: si entra otra persona de la lista, es su nombre el que aparece, y las demás cuentas quedan debajo para elegirlas de un toque (hasta cuatro).

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

- Quien no ha entrado no ve el organizador: la pantalla de entrada es lo único que se carga.
- La primera cuenta que entra desde un navegador con un borrador local existente importa ese borrador si aún no tiene documento en Firestore. Las cuentas con plano guardado recuperan su propia copia.
- Un cambio se guarda en la nube después de una pausa breve. Si falla, el encabezado o el menú de móvil ofrecen **Reintentar**. Si una escritura se interrumpe, el borrador pendiente se conserva en ese navegador para recuperarlo al volver a entrar.
- Dos dispositivos editando **la misma cuenta** a la vez usan el último guardado; no hay edición colaborativa en tiempo real.
- El listado inicial de invitados está incluido en los archivos estáticos de la web pública. Las reglas de Firestore protegen los cambios de cada cuenta, pero **no convierten la lista inicial en privada**. Para mantener también los nombres iniciales privados habrá que retirar ese listado del bundle público y cargarlo desde una fuente protegida después del inicio de sesión.
