# LOFESTYLE — Chat de moda interactivo

## Cómo abrirlo
1. Descomprime `LOFESTYLE.zip`.
2. Abre la carpeta `LOFESTYLE`.
3. Haz doble clic en `index.html` o ábrelo con Chrome/Edge.
4. Sube fotos desde **Mi armario virtual** y utiliza el chat para crear combinaciones.

No necesita instalar Python, Flask ni extensiones. Para editar los archivos puedes usar Visual Studio Code.

## Funciones
- Chat de moda con sugerencias rápidas.
- Carga de fotos y límite de 20 prendas.
- Categoría, nombre y color de cada prenda.
- Composición visual de outfits usando las fotos subidas.
- Guardado local de prendas, outfits e historial mediante IndexedDB.
- Historial por prenda y registro de cuándo se usa en un outfit.
- Exportación del historial a CSV.
- Diseño adaptable a computador y móvil.
- POO en JavaScript: clases `StorageManager`, `Garment`, `Outfit`, `FashionAssistant` y `LofestyleApp`.

## Importante
La app combina las fotografías originales; no genera imágenes nuevas mediante un servicio de IA ni coloca las prendas sobre una persona. El chat utiliza reglas locales sencillas para seleccionar las prendas. Los datos se quedan en el navegador y en el mismo perfil del dispositivo. Si borras los datos del sitio/navegador, puedes perder el armario guardado. No se requiere cuenta ni se envían las fotos a un servidor.
