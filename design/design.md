# PinturilloElements × MotherDuck — Style Reference
> Crema neobrutalista con acentos planos y pato mascota

**Theme:** light (warm cream)

PinturilloElements adopta el lenguaje visual de MotherDuck: un lienzo crema cálido, bordes negros gruesos, sombras duras con offset (nunca blur) y una tipografía que mezcla el rigor "developer-first" de una monoespaciada en mayúsculas con la calidez de una sans-serif limpia para el cuerpo. El color es plano y racionado — azul para la acción principal, amarillo para anuncios y contadores, coral para alertas y marca, menta y violeta como variedad — sobre una base crema/negro de altísimo contraste. La personalidad combina seriedad técnica (terminología de datos/SQL/dibujo) con informalidad lúdica (mascota pato, formas geométricas, colores vivos). El resultado se siente sólido, confiable y con carácter, evitando el aspecto genérico de las landings SaaS.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Cream | `#E7E2D4` | `--md-bg` | Lienzo de página y fondo de las escenas de juego — la base cálida donde flota todo |
| Surface | `#FFFDF7` | `--md-surface` | Fondo de tarjetas, inputs y modales — el blanco roto que sostiene el contenido |
| Ink | `#111111` | `--md-ink` | Texto, iconos y **todos** los bordes y sombras — hace todo el trabajo estructural |
| Sky | `#7EB6FF` | `--md-primary` | Acción principal: fondo del botón primario y foco de input — racionado a un CTA por sección |
| Section Blue | `#6FA8F5` | `--md-section` | Barra de título de tarjeta y overlay de "elegir empresa" — el azul de señalización de bloques |
| Duck Yellow | `#F5D033` | `--md-accent1` | Banner de anuncio, badge de timer y contadores ("3 preguntas") |
| Mint | `#3FC9B6` | `--md-accent2` | Estado "correcto" y agente, acentos frescos |
| Coral | `#F26B4E` | `--md-accent3` | Logo, badge MVP y pantalla de error / "sala llena" — texto en blanco encima |
| Violet | `#7C3AED` | `--md-accent4` | Variedad en avatares — nunca como color de acción |
| Muted | `#6B6B62` | `--md-muted` | Texto secundario, captions y notas tenues |

## Tokens — Typography

### Space Mono — Voz display y de UI — títulos, nav, botones, badges, etiquetas y código de sala. Monoespaciada con corte técnico; siempre en MAYÚSCULAS con tracking, evoca terminal/boarding-pass. El peso 700 carga todo el signposting. · `--font-display`
- **Substitute:** IBM Plex Mono, JetBrains Mono
- **Weights:** 400, 700
- **Sizes:** 10, 11, 12, 13, 14, 16, 20, 30, 38, 46, 56, 62
- **Line height:** 1.0–1.15 en display, 1.4 en etiquetas
- **Letter spacing:** display -0.01em; UI y etiquetas 0.04–0.14em uppercase
- **Role:** Todo el texto de interfaz: hero, títulos de sección, barras de título de tarjeta, botones, badges y el código de sala grande.

### DM Sans — Voz de cuerpo — párrafos, descripciones y notas. Sans-serif limpia, caja normal (nunca mayúsculas), alto contraste sobre crema. Es el contrapeso humano a la monoespaciada. · `--font-body`
- **Substitute:** General Sans, system-ui
- **Weights:** 400, 500, 700
- **Sizes:** 12, 13, 14, 15, 17, 19
- **Line height:** 1.5–1.6
- **Letter spacing:** 0 (normal)
- **Role:** Subtítulos del hero, párrafos de tarjeta, mensajes de chat y captions. Nunca para títulos ni botones.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| badge | 10–12px | 1.4 | 0.06–0.14em | `--text-badge` |
| caption | 12px | 1.4 | 0 | `--text-caption` |
| body | 14–15px | 1.6 | 0 | `--text-body` |
| body-lg | 17–19px | 1.5 | 0 | `--text-body-lg` |
| card-title | 16–20px | 1.1 | 0.06em | `--text-card-title` |
| section | 30–40px | 1.1 | 0 | `--text-section` |
| room-code | 30–40px | 1.0 | 0.12em | `--text-room-code` |
| display | 56–62px | 1.05 | -0.01em | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 34 | 34px | `--spacing-34` |
| 44 | 44px | `--spacing-44` |
| 56 | 56px | `--spacing-56` |

### Border Radius

| Element | Value |
|---------|-------|
| botones | 0px (rectangular) |
| tarjetas | 14px (contenedor exterior) |
| tiles de avatar | 4–6px |
| inputs | 0px |

### Shadows (duras, con offset — nunca blur)

| Name | Value | Token |
|------|-------|-------|
| sm | `3px 3px 0 #111` | `--md-shadow-sm` |
| base | `5px 5px 0 #111` | `--md-shadow` |
| lg | `8px 8px 0 #111` | `--md-shadow-lg` |

### Layout

- **Page / frame width:** 1180–1220px por pantalla
- **Section gap:** 46px entre pantallas
- **Card padding:** 20–24px
- **Element gap:** 12–16px
- **Borders:** `2px solid #111` en toda superficie importante

## Components

### Banner de anuncio
**Role:** Franja superior a todo el ancho por encima del header
Fondo `--md-accent1` (amarillo), borde inferior negro 2px, texto Space Mono uppercase 13px con tracking 0.05em y enlace subrayado. Ejemplo: "NUEVA TEMPORADA · DIBUJA LOGOS DE EMPRESAS TECH · CÓMO SE JUEGA →".

### Header sticky
**Role:** Navegación superior
Logo (marca con skew coral) a la izquierda, nav central Space Mono uppercase 13px, a la derecha `LOG IN` (texto) + botón primario `EMPEZAR GRATIS`. Borde inferior negro 2px, sin sombra.

### Botón primario
**Role:** Acción principal — un solo CTA por sección
Fondo `--md-primary`, borde negro 2px, sombra dura `5px 5px 0 #111`, texto `--md-ink` en Space Mono 700 uppercase. Al activar: `translate(2px,2px)` y sombra `sm`.

### Botón secundario (outline)
**Role:** Acción de apoyo
Igual geometría que el primario pero fondo `--md-surface`. Ejemplo: "CREAR SALA PÚBLICA".

### Tarjeta con barra de título
**Role:** Contenedor de contenido (lobby, resultados, modales)
Fondo `--md-surface`, borde negro 2px, sombra `lg`, y una barra de título de color sólido (`--md-section`) con texto Space Mono uppercase. El cuerpo lleva 20–24px de padding.

### Input
**Role:** Entrada de texto (nombre, código de sala, chat)
Borde negro 2px, fondo `--md-surface`, texto DM Sans 15px, radio 0. Label en Space Mono 11px uppercase encima. Foco: sombra `sm`.

### Badge / etiqueta
**Role:** Contador o estado
Rectángulo con borde negro 2px, fondo `--md-accent1` por defecto, texto Space Mono uppercase 10–12px. Variantes: `--md-accent2` para "AGENTE", `--md-accent3` (texto blanco) para "MVP".

### Tile de avatar
**Role:** Avatar Petdex en roster, chat y selección
Cuadrado con borde negro 2px, color del set de acentos + inicial en Space Mono, radio 4–6px. Es el fallback real cuando el sprite Petdex no carga.

### Tarjeta de opción (elegir empresa)
**Role:** Selector de logo a dibujar
Tarjeta con barra de título de color (una por opción: azul / menta / coral), logo/iniciales en tile y nombre en Space Mono grande; pie "SELECCIONAR →". Overlay sobre fondo `--md-section`.

### Toolbar de dibujo
**Role:** Herramientas del lienzo
Barra oscura flotante (fondo `#111`) con lápiz/borrador, paleta fija de 7 colores (los reales del código) y tres grosores F/M/G. Los colores del lápiz NO son tokens del tema.

### Placeholder de ilustración
**Role:** Hueco para arte (pato mascota, nubes)
Caja con `border:2px dashed #111`, fondo surface y etiqueta Space Mono, p. ej. "[ ILUSTRACIÓN PATO + NUBES ]". Se sustituye por assets reales.

### Formas decorativas
**Role:** Acentos geométricos
Diamantes (cuadrado girado 45°), círculos y cuadrados con borde negro en los colores de acento. Nunca ilustración SVG compleja hecha a mano.

## Do's and Don'ts

### Do
- Poner borde negro 2px + sombra dura con offset en botones, tarjetas, inputs y badges
- Usar Space Mono en MAYÚSCULAS para todo texto de UI; DM Sans en caja normal para cuerpo
- Limitar a 1–2 colores de fondo sólido por pantalla y un solo CTA principal
- Referenciar siempre los tokens `--md-*` con `var(--token, fallback)` para que un cambio propague a toda la plataforma
- Usar tarjetas con barra de título de color sólido para señalizar secciones
- Mantener alto contraste: `--md-ink` sobre azul/amarillo/menta; blanco sobre coral/violeta
- Marcar los huecos de ilustración con placeholder discontinuo hasta tener assets reales

### Don't
- Usar degradados, sombras con blur o glassmorphism — el sistema es de sombra dura
- Redondear botones/inputs (son rectangulares); el radio solo vive en el contenedor de tarjeta y los tiles
- Inventar hex fuera de la paleta o promover un color de acento a segundo CTA
- Escribir títulos o botones en DM Sans, ni párrafos en Space Mono
- Dibujar SVG ilustrativos complejos a mano (pato, nubes) — usar placeholder + assets
- Recolorear los colores reales del lápiz del canvas como si fueran tokens del tema

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Cream Canvas | `#E7E2D4` | Fondo de página y de escenas de juego — todo se apoya aquí |
| 1 | Surface | `#FFFDF7` | Tarjetas, inputs y modales que necesitan leerse por encima del crema |
| 2 | Section Fill | `#6FA8F5` | Barras de título y bloques de color sólido a todo el ancho |
| 3 | Ink | `#111111` | Toolbar de dibujo, overlays oscuros y texto/bordes |

## Elevation

- **Sin elevación por sombra suave.** La profundidad viene de la sombra dura con offset (`3/5/8px 0 #111`) y de los bordes negros de 2px — nunca de blur.

## Imagery

La imaginería es lúdica e iconográfica, no fotográfica: un pato mascota ilustrado, nubes dibujadas con contorno negro y formas geométricas flotantes (diamantes, círculos, estrellas). Los logos de empresa (Vercel, Supabase, Obsidian) se sirven como marcas SVG con fallback de iniciales sobre color. Los avatares Petdex son sprites; su fallback es la inicial sobre el color dominante. Mientras no existan los assets ilustrados, los huecos se marcan con placeholders de borde discontinuo y etiqueta monoespaciada. La ilustración ocupa una fracción menor de la página: el peso está en el texto, el color plano y los bordes.

## Layout

Secciones a todo el ancho con frames de ~1180–1220px. Header sticky (logo izquierda, nav centro, acciones derecha) bajo un banner amarillo. El hero centra un título display en 2–3 líneas, subtítulo corto, dos CTAs y la selección de nombre + avatar. Debajo, las secciones alternan fondo crema y bloques de color sólido a todo el ancho para separar features, con `section-gap` generoso (~46px). Las escenas de juego usan tarjetas con barra de título; la de dibujo divide lienzo (izquierda) + panel de chat (derecha, 320px). Ritmo izquierda-arriba, sin multi-columna de texto denso. Densidad cómoda: todo respira.

## Agent Prompt Guide

**Quick Color Reference**
- text: #111111
- background: #E7E2D4
- surface: #FFFDF7
- border: #111111 (2px)
- primary action: #7EB6FF (fondo, texto negro)
- accent / signal: #F5D033 (amarillo) · #F26B4E (coral)
- muted text: #6B6B62

**Example Component Prompts**

1. *Banner de anuncio:* Franja a todo el ancho, fondo #F5D033, borde inferior 2px #111, texto Space Mono 13px uppercase tracking 0.05em: "NUEVA TEMPORADA · DIBUJA LOGOS DE EMPRESAS TECH" + enlace subrayado "CÓMO SE JUEGA →".

2. *Botón primario:* Botón rectangular (radio 0), fondo #7EB6FF, borde 2px #111, sombra 5px 5px 0 #111, padding 14px 22px, texto #111 en Space Mono 700 uppercase "EMPEZAR GRATIS".

3. *Tarjeta con barra de título:* Tarjeta fondo #FFFDF7, borde 2px #111, sombra 8px 8px 0 #111. Barra superior fondo #6FA8F5, borde inferior 2px #111, texto Space Mono uppercase "SALA DE ESPERA". Cuerpo con padding 22px.

4. *Badge de contador:* Rectángulo borde 2px #111, fondo #F5D033, texto Space Mono 11px uppercase tracking 0.06em "3 PREGUNTAS". Variante "AGENTE" con fondo #3FC9B6.

5. *Tile de avatar:* Cuadrado 48px, borde 2px #111, radio 6px, fondo del set de acentos (#F26B4E) con inicial "N" en Space Mono 700 blanco.

## Similar Brands

- **MotherDuck** — Origen directo: crema + acentos planos, bordes negros gruesos, mono uppercase y mascota pato
- **Gumroad** — Mismo neobrutalismo de bordes duros y sombra con offset sobre fondos cálidos
- **Figma FigJam** — Colores planos vibrantes y formas geométricas lúdicas con contorno
- **Skribbl.io** — Referencia funcional del bucle de juego (dibujar/adivinar) que este sistema reviste
- **Vercel** — Disciplina tipográfica y de logos tech, aquí en clave cálida en vez de oscura

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --md-bg: #E7E2D4;
  --md-surface: #FFFDF7;
  --md-ink: #111111;
  --md-primary: #7EB6FF;
  --md-section: #6FA8F5;
  --md-accent1: #F5D033;
  --md-accent2: #3FC9B6;
  --md-accent3: #F26B4E;
  --md-accent4: #7C3AED;
  --md-muted: #6B6B62;

  /* Typography — Font Families */
  --font-display: "Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-body: "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-badge: 11px;      --tracking-badge: 0.08em;
  --text-caption: 12px;
  --text-body: 15px;       --leading-body: 1.6;
  --text-body-lg: 18px;    --leading-body-lg: 1.5;
  --text-card-title: 18px; --tracking-card-title: 0.06em;
  --text-section: 34px;    --leading-section: 1.1;
  --text-room-code: 38px;  --tracking-room-code: 0.12em;
  --text-display: 60px;    --leading-display: 1.05; --tracking-display: -0.01em;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;   --spacing-8: 8px;   --spacing-12: 12px;
  --spacing-16: 16px; --spacing-20: 20px; --spacing-24: 24px;
  --spacing-34: 34px; --spacing-44: 44px; --spacing-56: 56px;

  /* Layout */
  --page-max-width: 1220px;
  --section-gap: 46px;
  --card-padding: 22px;
  --element-gap: 14px;

  /* Border Radius */
  --radius-button: 0px;
  --radius-card: 14px;
  --radius-tile: 6px;
  --radius-input: 0px;

  /* Borders & Shadows (duras, con offset) */
  --md-border: 2px solid var(--md-ink);
  --md-shadow-sm: 3px 3px 0 var(--md-ink);
  --md-shadow: 5px 5px 0 var(--md-ink);
  --md-shadow-lg: 8px 8px 0 var(--md-ink);

  /* Surfaces */
  --surface-canvas: #E7E2D4;
  --surface-card: #FFFDF7;
  --surface-section: #6FA8F5;
  --surface-ink: #111111;
}

/* Variante morada / atardecer: reasignar solo los acentos */
:root.theme-sunset {
  --md-primary: #C6407E;
  --md-section: #472A6E;
  --md-accent1: #FF8C42;
  --md-accent2: #E85D9E;
  --md-accent3: #F0794A;
  --md-accent4: #472A6E;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-md-bg: #E7E2D4;
  --color-md-surface: #FFFDF7;
  --color-md-ink: #111111;
  --color-md-primary: #7EB6FF;
  --color-md-section: #6FA8F5;
  --color-md-accent1: #F5D033;
  --color-md-accent2: #3FC9B6;
  --color-md-accent3: #F26B4E;
  --color-md-accent4: #7C3AED;
  --color-md-muted: #6B6B62;

  /* Typography */
  --font-display: "Space Mono", ui-monospace, monospace;
  --font-body: "DM Sans", system-ui, sans-serif;

  /* Type scale */
  --text-badge: 11px;
  --text-caption: 12px;
  --text-body: 15px;
  --text-body-lg: 18px;
  --text-card-title: 18px;
  --text-section: 34px;
  --text-room-code: 38px;
  --text-display: 60px;

  /* Spacing */
  --spacing-4: 4px;   --spacing-8: 8px;   --spacing-12: 12px;
  --spacing-16: 16px; --spacing-20: 20px; --spacing-24: 24px;
  --spacing-34: 34px; --spacing-44: 44px; --spacing-56: 56px;

  /* Border radius */
  --radius-button: 0px;
  --radius-card: 14px;
  --radius-tile: 6px;

  /* Shadow (hard offset) */
  --shadow-md: 5px 5px 0 #111111;
}
```
