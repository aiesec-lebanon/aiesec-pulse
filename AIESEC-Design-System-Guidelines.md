# Dashboard Design System Guidelines

Version: 1.1 (Includes Dark Mode)
Last updated: 2026-05-19

## 1. Purpose

The goal is a premium, calm, minimal UI with strong readability and clear visual hierarchy. This system supports both Light and Dark themes to ensure accessibility and comfort across all viewing environments.

## 2. Design Principles

1. **Readability first**
   - Prioritize high foreground/background contrast in both light and dark modes.
   - Keep text sizes and line heights consistent.
2. **Calm visual rhythm**
   - Use neutral surfaces and restrained accents.
   - Avoid unnecessary effects, gradients, and heavy shadows. Dark mode drops shadows entirely in favor of border contrast.
3. **Color-led guidance**
   - Use blue for primary focus and active navigation.
   - Use orange and teal as meaning accents (warning/costs vs. positive/growth), not for decoration.
4. **System over one-off styling**
   - Use CSS variables (Tailwind tokens) rather than hardcoded hex values to ensure seamless theme switching.

## 3. Color System

The application uses dynamic CSS variables that adapt based on the active theme (`.dark` class).

### 3.1 Theme Tokens

| Token | Light Theme | Dark Theme | Role |
|---|---|---|---|
| `--background` | `#f5f5f5` | `#11141a` | App background |
| `--foreground` | `#1d2129` | `#f5f5f5` | Primary body and heading text |
| `--card` | `#ffffff` | `#1d2129` | Cards, nav surfaces, elevated elements |
| `--card-foreground`| `#1d2129` | `#f5f5f5` | Text within cards |
| `--primary` | `#037ef3` | `#037ef3` | Primary actions, active states, branding |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text on primary brand backgrounds |
| `--muted` | `#f5f5f5` | `#1d2129` | Secondary neutral backgrounds |
| `--muted-foreground` | `#6b7586` | `#9ca7ae` | Secondary copy, labels, disabled text |
| `--border` | `#e3e5e9` | `#52565e` | Component outlines, separators, dividers |
| `--destructive` | `#f48924` | `#f48924` | Warning highlights, cost metrics |
| `--success` | `#0cb9c1` | `#0cb9c1` | Positive highlights, growth metrics |

### 3.2 Chart Palette

Data visualizations use an adaptive sequence of colors:

| Token | Light Theme | Dark Theme | Usage |
|---|---|---|---|
| `--chart-1` | `#037ef3` | `#037ef3` | Primary data series (e.g., Revenue) |
| `--chart-2` | `#0cb9c1` | `#0cb9c1` | Positive/Growth series |
| `--chart-3` | `#f48924` | `#f48924` | Cost/Warning series |
| `--chart-4` | `#52565e` | `#6b7586` | Neutral data series |
| `--chart-5` | `#9ca7ae` | `#e3e5e9` | Muted data series |

## 4. Typography

### 4.1 Font Families

- **Primary:** `Lato`, Arial, sans-serif

### 4.2 Font Weights

- **400 (Normal):** Body text
- **500 (Medium):** Standard labels, table headers
- **700 (Bold):** Strong labels, buttons, section headings, active tabs
- **900 (Black):** Hero headlines (`h1`, `h2`)

### 4.3 Type Scale

| Use case | Size | Weight | Line Height |
|---|---|---|---|
| Hero title | 38px - 48px | 900 (Black) | 1.1 (Tight) |
| Large metrics | 28px | 700 (Bold) | Normal |
| Page/Card titles | 20px | 700 (Bold) | Tight |
| Lead body | 18px | 400 (Normal)| 1.6 (Relaxed) |
| Base body / Buttons| 16px | 400-700 | Normal |
| Tabs | 15px | 700 (Bold) | Normal |
| Compact / Metadata | 14px | 500 (Medium)| Normal |
| Micro labels | 12px | 500 (Medium)| Normal |

## 5. Layout and Spacing

### 5.1 Containers

- **Max Width:** `1200px` for main dashboard content.
- **Horizontal Padding:** `24px` standard on main wrapper.

### 5.2 Spacing Rhythm

We use a strict 4px grid system:
- **Micro:** `4px`
- **Small:** `8px`
- **Regular:** `12px`
- **Medium:** `16px`
- **Large:** `20px` - `24px`
- **Section:** `32px`

## 6. Shape, Border, Elevation

### 6.1 Border Radius (Tokens)

- `--radius-sm`: `4px` (Buttons, small inputs)
- `--radius-md`: `8px` (Tabs, chips, secondary elements)
- `--radius-lg`: `12px` (Cards, large surfaces)

### 6.2 Elevation / Shadows

- **Light Mode Shadows:**
  - `shadow-sm`: Used sparingly on interactive hover states.
  - Card Shadow: `0px 2px 0px 0px rgba(29,33,41,0.02)`
  - Primary Button: `0px 2px 0px 0px rgba(5,145,255,0.1)`
- **Dark Mode Shadows:** 
  - Shadows are disabled (`dark:shadow-none`) in favor of relying on border contrast against the dark background.

## 7. Component Guidelines

### 7.1 Card
- **Background:** `var(--card)`
- **Border:** 1px solid `var(--border)`
- **Radius:** `12px`
- **Padding:** `24px` generally, `20px` for compact KPI boxes.

### 7.2 Buttons
- **Primary:** 
  - Background: `var(--primary)`
  - Text: `var(--primary-foreground)`
  - Radius: `4px`
  - Padding: `11px 24px`
  - Typography: 16px, Bold
- **Secondary:**
  - Background: `var(--card)`
  - Border: 1px solid `var(--border)`
  - Hover: Border and text shift to `var(--primary)`

### 7.3 Navigation Tabs
- **Container:** `var(--muted)` background, 8px radius, 4px inner padding.
- **Inactive Tab:** `var(--muted-foreground)`, transparent background.
- **Active Tab:** `var(--card)` background, `var(--foreground)` text, 4px radius, with a 2px absolute bottom border indicating active state.

### 7.4 Filter Chips
- **Container:** 8px radius, 1px border.
- **Inactive:** `var(--card)` background, `var(--border)` border.
- **Active:** `var(--primary)/10` background, `var(--primary)` border, `var(--primary)` text.

### 7.5 Status/Trend Indicators
- **Positive/Growth:** Uses `var(--success)` text (e.g., +14.2%).
- **Negative/Cost:** Uses `var(--destructive)` text (e.g., -2.4%).
- **Neutral Pills:** `var(--muted)` background with `var(--muted-foreground)` text.
