# Configurador de tortas — V1

## Qué incluye
- Landing visual.
- Galería de diseños tomada de Google Sheets.
- Configuración por personas O por kilos.
- Conversión orientativa: 1 kg ≈ 10 personas, redondeada para la referencia.
- Diseños y hashtags administrables desde Sheets.
- Rellenos administrables.
- Aviso de que la cantidad de rellenos depende del tamaño/formato.
- Cobertura fija: crema.
- Caja sí/no, sin precio.
- Personalización con ejemplos.
- Nombre, fecha de retiro y hora aproximada.
- Mesa dulce con precios fijos.
- Consulta por otra tarta/producto.
- Mesa salada sin precios, a cotizar.
- Consulta por otra opción salada.
- Resumen.
- Envío del pedido a WhatsApp.

## Conectar Google Sheets
1. Abrí `configurador_tortas_google_sheets.xlsx` en Excel o importalo a Google Sheets.
2. Completá y reemplazá los datos de ejemplo.
3. En Google Sheets: Archivo → Compartir → Publicar en la web.
4. Copiá el ID del documento de la URL. Ejemplo:
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`
5. Abrí `app.js` y reemplazá:
   `1xZMIhD5LxJQeN07YHmq8IAxL82R_J313`
   por el ID real.
6. Subí toda la carpeta a Vercel.

### Importante
La página lee las pestañas por nombre. No cambies estos nombres:
- CONFIGURACION
- DISEÑOS
- RELLENOS
- MESA_DULCE
- MESA_SALADA
- CATEGORIAS

Las columnas también deben conservarse. Podés agregar filas y modificar los valores.

## Fotos
En `Imagen_URL` podés pegar URLs públicas de imágenes. Para producción conviene usar URLs directas de imágenes alojadas en un servicio/CDN accesible públicamente.

## WhatsApp
En `CONFIGURACION`, el campo `WhatsApp` debe contener el número con código de país, sin `+`, espacios ni guiones.
Ejemplo de formato:
`54911XXXXXXXX`

## Nota
Esta V1 no guarda pedidos en una base de datos: prepara el resumen y lo abre en WhatsApp. Todas las tortas y la mesa salada se consideran "a cotizar"; solamente la mesa dulce suma precios fijos.


## Hoja de Google Sheets configurada

La página ya está preparada con el ID de tu Google Sheet. No hace falta volver a modificar `app.js` por este motivo.

Antes de subir a Vercel, asegurate de que la hoja esté publicada en la web para que la página pueda leer los datos mediante CSV.

Podés mover el archivo de Google Sheets a otra carpeta de Drive sin cambiar su ID. También podés cambiarle el nombre al archivo. No cambies los nombres de las pestañas ni las columnas esperadas.
