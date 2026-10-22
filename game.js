/*
 * YUKK Y LA RESISTENCIA CALCHAQUÍ
 * Pablo Rivero (Stipinpixel) · IAM Tucumán · 2026
 *
 * Versión en HTML/JavaScript puro, sin Construct.
 * Reproduce la hoja de eventos original ("Event sheet 1").
 *
 * Parámetro de URL opcional:
 *   ?debug=1   dibuja las zonas táctiles y muestra el estado y el tiempo
 */
(() => {
  'use strict';

  // ───────────────────────── CONFIGURACIÓN ─────────────────────────
  const W = 480, H = 320;

  const CONFIG = {
    tiempoJuego: 30,      // segundos de juego antes de la captura
    tiempoCaptura: 5,     // segundos de la animación de captura
    umbralSwipe: 20,      // px (en coordenadas del juego) para cambiar cabeza/cuerpo/piernas
    umbralSwipeFondo: 40, // px hacia arriba para cambiar el clima
    evitarRepetir: true,  // al deslizar, no repetir la misma pieza
    margenToque: 14,      // px extra alrededor del puco y de Yukk para que sea fácil tocarlos
  };

  // Zonas táctiles (rectángulos en coordenadas 480×320), copiadas del layout original.
  // [izquierda, arriba, derecha, abajo]
  const ZONAS = {
    cabeza:  [125.6,  70.1, 367.6, 132.1],
    cuerpo:  [118.1, 130.8, 330.3, 227.9],
    piernas: [127.6, 227.8, 370.5, 280.8],
    fondo: [
      [23.8,   2.0, 110.0, 177.6],
      [ 0.0, 280.5,  84.1, 320.0],
    ],
  };

  // Orden de dibujo (de atrás hacia adelante), igual que las capas del layout.
  const CAPAS = [
    'fondo_lluvia', 'fondo_arido', 'fondo_florida',
    'elemento_invocado',
    'guerrero_piernas', 'guerrero_cuerpo',
    'yukk', 'idle',
    'guerrero_cabeza',
    'mapa_fijo', 'yukk_puco', 'entidad',
    'entidad_final',
    'yukk_captura',
    'btn_reiniciar',
  ];

  const params = new URLSearchParams(location.search);
  const DEBUG = params.get('debug') === '1';

  // ───────────────────────── CANVAS Y ESCALA ─────────────────────────
  const canvas = document.getElementById('juego');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Escala "letterbox": ocupa todo lo posible sin deformar, con bandas negras.
  function ajustarPantalla() {
    const escala = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = (W * escala) + 'px';
    canvas.style.height = (H * escala) + 'px';
    canvas.style.transform = 'translate(-50%, -50%)';
  }
  window.addEventListener('resize', ajustarPantalla);
  window.addEventListener('orientationchange', () => setTimeout(ajustarPantalla, 100));
  ajustarPantalla();

  // Convierte una posición de pantalla a coordenadas del juego (480×320).
  function aCoordenadasJuego(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) * W / r.width, y: (clientY - r.top) * H / r.height };
  }

  // ───────────────────────── CARGA DE IMÁGENES ─────────────────────────
  const hojas = [];
  function cargarHojas(alProgresar) {
    let listas = 0;
    return Promise.all(ATLAS.sheets.map((src, i) => new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => { listas++; alProgresar(listas / ATLAS.sheets.length); ok(); };
      img.onerror = () => mal(new Error('No se pudo cargar ' + src));
      img.src = src;
      hojas[i] = img;
    })));
  }

  function dibujarCarga(p) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#333'; ctx.fillRect(140, 156, 200, 8);
    ctx.fillStyle = '#e8dca8'; ctx.fillRect(140, 156, Math.round(200 * p), 8);
  }

  // ───────────────────────── SPRITES ─────────────────────────
  class Sprite {
    constructor(nombre) {
      const def = ATLAS.objects[nombre];
      this.nombre = nombre;
      this.frames = def.frames;
      this.fps = def.fps;
      this.loop = def.loop;
      this.x = W / 2; this.y = H / 2;
      this.visible = true;
      this.frame = 0;
      this.playing = false;
      this.t = 0;
      this.alTerminar = null;
    }
    get total() { return this.frames.length; }
    play() { this.frame = 0; this.t = 0; this.playing = true; }   // "Set animation … desde el principio"
    start() { this.t = 0; this.playing = true; }                  // "Start animation"
    stop() { this.playing = false; }
    setFrame(i) {
      if (i >= 0 && i < this.total) { this.frame = Math.floor(i); this.t = 0; }
    }
    update(dt) {
      if (!this.playing || this.fps <= 0) return;
      this.t += dt;
      const dur = 1 / this.fps;
      while (this.t >= dur && this.playing) {
        this.t -= dur;
        if (this.frame < this.total - 1) this.frame++;
        else if (this.loop) this.frame = 0;
        else {
          this.playing = false;
          if (this.alTerminar) this.alTerminar();
        }
      }
    }
    draw() {
      if (!this.visible) return;
      const [hoja, sx, sy, w, h, rx, ry, fw, fh, ox, oy] = this.frames[this.frame];
      if (hoja < 0) return;   // cuadro vacío
      ctx.drawImage(hojas[hoja], sx, sy, w, h,
        Math.round(this.x - ox * fw) + rx, Math.round(this.y - oy * fh) + ry, w, h);
    }
    // Toque sobre lo dibujado en el cuadro actual, con un margen generoso.
    tocaDibujo(px, py, margen) {
      const [hoja, , , w, h, rx, ry, fw, fh, ox, oy] = this.frames[this.frame];
      if (hoja < 0) return false;
      const l = this.x - ox * fw + rx - margen, t = this.y - oy * fh + ry - margen;
      return px >= l && px <= l + w + 2 * margen && py >= t && py <= t + h + 2 * margen;
    }
    // Toque sobre el polígono de colisión del cuadro actual (como Construct).
    contiene(px, py) {
      const [, , , , , , , w, h, ox, oy, poly] = this.frames[this.frame];
      if (!poly || poly.length < 6) {
        const l = this.x - ox * w, t = this.y - oy * h;
        return px >= l && px <= l + w && py >= t && py <= t + h;
      }
      let dentro = false;
      for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
        const xi = this.x + poly[i] * w, yi = this.y + poly[i + 1] * h;
        const xj = this.x + poly[j] * w, yj = this.y + poly[j + 1] * h;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) dentro = !dentro;
      }
      return dentro;
    }
  }

  const S = {};
  CAPAS.forEach(n => { S[n] = new Sprite(n); });

  // ───────────────────────── ESTADO ─────────────────────────
  let estado = 'cargando';
  let escenario = 1;
  let elementoActivo = 0;
  let tiempoJuego = CONFIG.tiempoJuego;
  let tiempoCaptura = 0;

  const azar = n => Math.floor(Math.random() * n);
  function piezaNueva(sprite) {
    if (!CONFIG.evitarRepetir || sprite.total < 2) return azar(sprite.total);
    let f; do { f = azar(sprite.total); } while (f === sprite.frame);
    return f;
  }

  // Evento 1 · Inicio del layout
  function iniciar() {
    estado = 'intro';
    escenario = 1;
    elementoActivo = 0;
    tiempoJuego = CONFIG.tiempoJuego;
    tiempoCaptura = 0;

    for (const s of Object.values(S)) { s.visible = false; s.stop(); s.setFrame(0); }

    // Fondos animados en bucle (siempre corriendo)
    ['fondo_lluvia', 'fondo_arido', 'fondo_florida'].forEach(n => S[n].play());
    S.fondo_arido.visible = true;

    // Intro: mapa + Yukk sobre el puco
    S.mapa_fijo.visible = true;
    S.yukk_puco.visible = true;
    S.yukk_puco.play();

    // Yukk espera en su lugar, en bucle
    S.yukk.visible = true;
    S.yukk.play();
  }

  // Evento 2 · Tocar el puco → presentación de la entidad
  function presentacion() {
    estado = 'presentacion';
    S.yukk_puco.visible = false;
    S.mapa_fijo.visible = false;
    S.entidad.visible = true;
    S.entidad.play();
  }

  // Evento 3 · Termina la entidad → empieza el juego
  S.entidad.alTerminar = () => {
    if (estado !== 'presentacion') return;
    S.entidad.visible = false;
    estado = 'jugando';
    tiempoJuego = CONFIG.tiempoJuego;
    S.fondo_arido.visible = escenario === 1;
    ['guerrero_cabeza', 'guerrero_cuerpo', 'guerrero_piernas', 'elemento_invocado']
      .forEach(n => { S[n].visible = true; });
    S.entidad_final.visible = false;
  };

  // Evento 4 · Tocar a Yukk (con o sin el puco) → cambia de resistencia
  // (Suri, Serpiente, Cóndor, Sapo). Cada toque elige una distinta de la actual.
  const imagenDe = i => S.elemento_invocado.frames[i].slice(0, 3).join(',');
  function invocar() {
    S.yukk.visible = false;
    S.idle.visible = true;
    S.idle.play();                       // reinicia la magia en cada toque
    const elem = S.elemento_invocado;
    const actual = imagenDe(elem.frame);
    const opciones = [];
    for (let i = 0; i < elem.total; i++) if (imagenDe(i) !== actual) opciones.push(i);
    const f = opciones.length ? opciones[azar(opciones.length)] : azar(elem.total);
    elementoActivo = f + 1;
    elem.setFrame(f);                    // Eventos 5–6
  }

  function siguienteClima() {
    escenario = escenario % 3 + 1;       // árido → florido → lluvia → árido
    aplicarEscenario();
  }

  // Evento 29 · Se acaba el tiempo → captura
  function captura() {
    estado = 'captura';
    S.yukk_captura.visible = true;
    S.yukk_captura.play();
    tiempoCaptura = CONFIG.tiempoCaptura;
  }

  // Evento 32 · Termina la captura → pantalla final
  function final() {
    estado = 'final';
    S.yukk_captura.visible = false;
    S.yukk_captura.stop();
    S.entidad_final.visible = true;
    S.entidad_final.play();
    S.btn_reiniciar.visible = true;
    S.btn_reiniciar.play();
  }

  function aplicarEscenario() {   // Eventos 23–26
    S.fondo_arido.visible   = escenario === 1;
    S.fondo_florida.visible = escenario === 2;
    S.fondo_lluvia.visible  = escenario === 3;
  }

  // ───────────────────────── ENTRADA (toque / mouse) ─────────────────────────
  const dentro = (r, p) => p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3];
  const toques = new Map();   // pointerId → punto de inicio

  canvas.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    const p = aCoordenadasJuego(ev.clientX, ev.clientY);
    toques.set(ev.pointerId, p);
    try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    // "On touched object" (se dispara al apoyar el dedo)
    if (estado === 'intro' && S.yukk_puco.tocaDibujo(p.x, p.y, CONFIG.margenToque)) { presentacion(); return; }
    if (estado === 'jugando' &&
        ((S.yukk.visible && S.yukk.tocaDibujo(p.x, p.y, CONFIG.margenToque)) ||
         (S.idle.visible && S.idle.tocaDibujo(p.x, p.y, CONFIG.margenToque)))) {
      toques.delete(ev.pointerId);       // un toque a Yukk no cuenta como swipe
      invocar(); return;
    }
    if (estado === 'final' && S.btn_reiniciar.contiene(p.x, p.y)) { iniciar(); return; }
  });

  function soltar(ev) {
    const ini = toques.get(ev.pointerId);
    toques.delete(ev.pointerId);
    if (!ini || estado !== 'jugando') return;
    const fin = aCoordenadasJuego(ev.clientX, ev.clientY);
    const dx = fin.x - ini.x, dy = fin.y - ini.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);

    // Deslizar hacia ARRIBA en cualquier parte de la pantalla → cambia el clima
    if (!horizontal && -dy > CONFIG.umbralSwipeFondo) { siguienteClima(); return; }

    // Eventos 8–19 · deslizar de costado sobre cabeza / cuerpo / piernas
    // (se mira dónde empezó o dónde terminó el gesto)
    if (horizontal && Math.abs(dx) > CONFIG.umbralSwipe) {
      const en = r => dentro(r, ini) || dentro(r, fin);
      const zona = en(ZONAS.cabeza) ? 'cabeza' : en(ZONAS.cuerpo) ? 'cuerpo' : en(ZONAS.piernas) ? 'piernas' : null;
      if (zona) {
        const s = S['guerrero_' + zona];
        s.setFrame(piezaNueva(s));
      } else if (-dx > CONFIG.umbralSwipeFondo && ZONAS.fondo.some(r => dentro(r, fin))) {
        siguienteClima();   // se mantiene el gesto original sobre el borde izquierdo
      }
    }
  }
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', ev => toques.delete(ev.pointerId));
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  // ───────────────────────── BUCLE PRINCIPAL ─────────────────────────
  let anterior = 0;
  function bucle(ahora) {
    const dt = Math.min((ahora - anterior) / 1000 || 0, 0.1);
    anterior = ahora;

    for (const s of Object.values(S)) s.update(dt);

    if (estado === 'jugando') {
      tiempoJuego -= dt;
      if (tiempoJuego <= 0) captura();
    } else if (estado === 'captura') {
      tiempoCaptura -= dt;
      if (tiempoCaptura < 0) final();
    }

    ctx.clearRect(0, 0, W, H);
    for (const n of CAPAS) S[n].draw();
    if (DEBUG) dibujarDebug();

    requestAnimationFrame(bucle);
  }

  function dibujarDebug() {
    ctx.save();
    ctx.lineWidth = 1;
    const caja = (r, c) => { ctx.strokeStyle = c; ctx.strokeRect(r[0] + .5, r[1] + .5, r[2] - r[0], r[3] - r[1]); };
    caja(ZONAS.cabeza, '#f00'); caja(ZONAS.cuerpo, '#0f0'); caja(ZONAS.piernas, '#00f');
    ZONAS.fondo.forEach(r => caja(r, '#ff0'));
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, 210, 12);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace';
    ctx.fillText(`${estado} t=${tiempoJuego.toFixed(1)} esc=${escenario} elem=${elementoActivo}`, 2, 9);
    ctx.restore();
  }

  // ───────────────────────── ARRANQUE ─────────────────────────
  dibujarCarga(0);
  cargarHojas(dibujarCarga).then(() => {
    iniciar();
    requestAnimationFrame(t => { anterior = t; bucle(t); });
  }).catch(err => {
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
    ctx.fillText(err.message, 10, 20);
  });

  // PWA: funciona offline cuando se sirve por http(s)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
