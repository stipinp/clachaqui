# Yukk y la Resistencia Calchaquí: versión HTML

Port del juego de Construct 3 a HTML + JavaScript puro, sin motor ni dependencias.
Mismo arte, misma lógica y los mismos tiempos que la hoja de eventos original.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página. Abrila con doble clic para jugar en local. |
| `game.js` | Toda la lógica del juego, comentada, con los números de evento de Construct. |
| `atlas.js` | Mapa de cuadros de cada animación. Lo genera `empaquetar.py`, no hay que editarlo a mano. |
| `img/` | Hojas de sprites (.webp sin pérdida). |
| `manifest.json`, `sw.js`, `icons/` | PWA: se puede instalar y funciona offline cuando se sirve por web. |
| `fuentes/` | No hace falta para publicar. Contiene cada cuadro en PNG suelto y los scripts para regenerar las hojas. |

## Ajustes rápidos (al principio de `game.js`)

- `CONFIG.tiempoJuego`: segundos de juego (30).
- `CONFIG.tiempoCaptura`: segundos de la captura (5).
- `CONFIG.umbralSwipe` / `umbralSwipeFondo`: cuánto hay que deslizar (de costado para las piezas, hacia arriba para el clima).
- `CONFIG.margenToque`: margen extra para tocar el puco y a Yukk.
- `ZONAS`: rectángulos de cabeza, cuerpo, piernas y fondo, en coordenadas 480×320.

Agregá `?debug=1` a la URL para ver las zonas táctiles, el estado y el tiempo.

## Editar el arte

1. Editá o reemplazá los PNG en `fuentes/cuadros/<objeto>/`. Cada cuadro es de 480×320 (Yukk y la magia son más chicos).
   Para agregar cuadros, sumá el PNG y una entrada en `fuentes/animaciones.json`.
2. Corré `python fuentes/empaquetar.py` (requiere `pip install pillow`).
3. Si el juego ya está publicado como PWA, subí la versión en `sw.js` (`yukk-v1` → `yukk-v2`) para que los dispositivos tomen los cambios.

## Publicar en itch.io

Subí `yukk-itch.zip` (tiene `index.html` en la raíz) como "HTML", con viewport de 960×640 o similar y la opción de pantalla completa activada.

## Diferencias con la versión de Construct

- El puco y Yukk responden al toque sobre todo el dibujo, con margen. Antes respondían a polígonos automáticos de unos 20 px.
- Cada toque se ignora fuera de su momento: el puco solo en la intro, Yukk solo durante el juego, el botón solo en la pantalla final.
- Cabeza, cuerpo y piernas usan todos sus cuadros (14). Antes se sorteaba entre 15 y uno de cada 15 swipes no hacía nada. Además, nunca repiten la pieza actual.
- El elemento invocado sortea entre sus 16 cuadros. Antes eran 15 y el último nunca salía.
- Tocar a Yukk (con o sin el puco) cambia de resistencia en cada toque: Suri, Serpiente, Cóndor, Sapo, sin repetir la que está. Antes funcionaba una sola vez.
- Deslizar hacia arriba en cualquier parte de la pantalla cambia el clima (árido → florido → lluvia). Antes solo funcionaba un swipe a la izquierda sobre el borde, porque el evento comparaba `touch_start_y` con `Touch.X`.
