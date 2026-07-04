# 🌻 Huerto vs Zombis — Tower Defense

Juego de *tower defense* para navegador (escritorio y móvil): defiende tu casa de la horda de zombis plantando distintas plantas defensoras a lo largo del camino.

## ▶️ Cómo ejecutarlo

No necesita instalación ni dependencias: es HTML + CSS + JavaScript puro.

- **Opción rápida:** abre `index.html` en tu navegador.
- **Servidor local (recomendado):**

  ```bash
  python3 -m http.server 8000
  # y abre http://localhost:8000
  ```

- También puedes publicarlo tal cual en GitHub Pages, Netlify, etc.

## 🎮 Características

- **8 niveles** con mapas distintos que se desbloquean al completar el anterior, elegidos desde un **mapa de niveles** con progreso y estrellas (⭐⭐⭐ según las vidas que conserves).
- **Dificultad creciente**: más oleadas, zombis más resistentes y niveles con **dos caminos**.
- **6 plantas con mecánicas distintas**:
  - 🌻 **Girasol** — genera monedas.
  - 🫛 **Lanzaguisantes** — disparo rápido a un objetivo.
  - 🌿 **Menta Helada** — aura que ralentiza a los zombis cercanos.
  - 🌺 **Boca de Dragón** — fuego con daño en área.
  - 🍄 **Seta Venenosa** — veneno con daño mantenido.
  - 🌵 **Cactus** — francotirador de largo alcance.
- Las plantas se pueden **mejorar hasta nivel 3** y **vender** (70 % de lo invertido).
- **Rango visible antes de comprar**: al elegir una planta se muestra su alcance sobre el mapa antes de colocarla.
- **5 tipos de zombis**: normal, cono, corredor, cubo y gigante.
- **Velocidad x1 / x2 / x3**, pausa y botón para adelantar la siguiente oleada (con bonus).
- **Música de fondo suave y efectos de sonido** generados con Web Audio API (sin archivos de audio) y botón de silencio.
- **Compatible con móvil**: controles táctiles (toca para previsualizar, vuelve a tocar para plantar), diseño adaptable y colores alegres pero suaves.
- **Progreso guardado** automáticamente en el navegador (`localStorage`).

## 🗂️ Estructura

```
index.html      Pantallas y overlays (menú, mapa, juego)
css/style.css   Estilos y diseño adaptable
js/data.js      Definición de torres, enemigos y niveles
js/audio.js     Música y efectos (Web Audio API)
js/entities.js  Zombis, plantas, proyectiles y partículas
js/game.js      Motor: bucle, oleadas, entrada y renderizado
js/main.js      UI, mapa de niveles, HUD y guardado
```
