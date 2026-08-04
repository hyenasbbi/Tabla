# HYENAS Sales Command Center — versión compartida

Este repositorio está preparado para publicarse con **GitHub + Netlify**. La tabla se guarda en **Netlify Blobs**, por lo que todos los celulares y computadoras ven los mismos importes, posiciones, flechas, vendedores y strikes.

## Estructura

```text
public/index.html
netlify/functions/dashboard.mjs
netlify.toml
package.json
.node-version
.env.example
.gitignore
```

## Publicación correcta

1. Creá o abrí tu repositorio de GitHub.
2. Subí **todo el contenido de esta carpeta a la raíz del repositorio**. No subas solamente `index.html`.
3. En Netlify elegí **Add new project → Import an existing project → GitHub**.
4. Seleccioná el repositorio.
5. Netlify leerá automáticamente `netlify.toml`:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Antes del deploy final, abrí en Netlify:
   **Project configuration → Environment variables → Add variable**.
7. Agregá estas variables con alcance para Functions:

```text
ADMIN_PASSWORD = Nahuel25$
ADMIN_TOKEN_SECRET = una-cadena-larga-aleatoria-de-40-caracteres-o-mas
```

8. Hacé **Deploy** o **Trigger deploy → Deploy site** después de crear las variables.
9. Compartí la URL pública terminada en `.netlify.app`. Nunca compartas una URL `localhost`.

## Importante

- No uses Netlify Drop o arrastrar únicamente el HTML: esta versión necesita instalar `@netlify/blobs` y desplegar la función de servidor.
- La contraseña no está escrita dentro del HTML público; Netlify la valida mediante una variable de entorno.
- Los visitantes pueden ver la tabla, pero solo el administrador autenticado puede guardar cambios.
- Los demás dispositivos reciben cambios al abrir la página, volver a enfocarla o dentro de un máximo aproximado de 30 segundos.
- El reconocimiento de imágenes usa Tesseract.js desde CDN y necesita internet.

## Desarrollo local opcional

```bash
npm install
npx netlify dev
```

En desarrollo local creá un archivo `.env` con las mismas dos variables. `.env` ya está excluido de Git.
