---
name: Gaud Orchestrator
description: AI agent orchestrator for development teams
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  on-primary: "#FFFFFF"
  accent: "#059669"
  accent-hover: "#047857"
  on-accent: "#FFFFFF"
  destructive: "#DC2626"
  destructive-hover: "#B91C1C"
  on-destructive: "#FFFFFF"
  warning: "#D97706"
  bg: "#FFFFFF"
  bg-dark: "#09090B"
  surface: "#F8FAFC"
  surface-dark: "#18181B"
  surface-elevated: "#F1F5F9"
  surface-elevated-dark: "#27272A"
  ink: "#0F172A"
  ink-dark: "#FAFAFA"
  muted: "#64748B"
  muted-dark: "#A1A1AA"
  border: "#E2E8F0"
  border-dark: "#27272A"
  ring: "#2563EB"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.025em"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-destructive}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  badge-success:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

<!-- SEED — re-run /impeccable document in scan mode once code exists -->

# Design System: Gaud Orchestrator

## 1. Overview

**Creative North Star: "The Mission Control Console"**

A precise, information-dense interface that puts the operator in command. Like a well-designed control room: every display has a purpose, every metric is glanceable, every action is reachable without searching. The system is calm by default and urgent only when it needs to be.

The personality is **intelligent, modern, and reliable** (from PRODUCT.md). This translates to: Inter for clarity at small sizes, a restrained blue primary for trust and action, green exclusively for success/active states, and generous whitespace that prevents the density from becoming noise.

What this system explicitly rejects: the visual noise of Jira (too many elements competing for attention), the superficial "AI vibes" of generic tools (no purple gradients, no chat-first layouts), the flatness of spreadsheets (hierarchy is always visual, never just data), and the oversimplification of Trello (every surface earns its place through information density).

**Key Characteristics:**
- Information-dense but never cluttered — hierarchy through weight and spacing, not decoration
- Keyboard-first interactions with visible focus states
- Dark mode as a first-class citizen, not an afterthought
- Real-time updates feel natural, not jarring (smooth transitions, no layout shifts)
- Monospace for data/code, proportional for everything else

## 2. Colors

A restrained, professional palette. Blue carries trust and action. Green marks success and active states. Red signals danger. The palette is deliberately narrow — when everything is colorful, nothing stands out.

### Primary
- **Command Blue** (#2563EB / oklch(0.546 0.245 264)): Primary actions, active navigation, focus rings, links. The single saturated color that says "this is interactive." White text on filled surfaces.

### Secondary
- **Status Green** (#059669 / oklch(0.554 0.167 163)): Success states, active agents, approved specs, completed tasks. Never decorative — always communicates "this succeeded" or "this is live." Derived from the brand seed hue (113deg olive, shifted toward emerald for clarity).

### Tertiary
- **Alert Amber** (#D97706 / oklch(0.608 0.170 74)): Warnings, pending approvals, paused states. Attention without alarm.

### Neutral
- **Ink** (#0F172A / oklch(0.156 0.020 265)): Primary text. Deep navy-black with a whisper of blue.
- **Muted** (#64748B / oklch(0.541 0.030 256)): Secondary text, timestamps, metadata. Meets 4.5:1 on white.
- **Surface** (#F8FAFC / oklch(0.982 0.005 247)): Cards, panels, table rows. Barely-there blue tint separates from pure white bg.
- **Border** (#E2E8F0 / oklch(0.929 0.013 256)): Dividers, input borders. Visible but never heavy.
- **Background** (#FFFFFF / oklch(1.000 0.000 0)): Pure white. The canvas breathes.

### Dark Mode Neutrals
- **Ink Dark** (#FAFAFA): Primary text on dark surfaces.
- **Muted Dark** (#A1A1AA): Secondary text on dark surfaces.
- **Surface Dark** (#18181B): Cards and panels. Zinc-900.
- **Surface Elevated Dark** (#27272A): Elevated surfaces (modals, dropdowns). Zinc-800.
- **Background Dark** (#09090B): Near-black. Pure, no hue tint.
- **Border Dark** (#27272A): Subtle separation on dark surfaces.

### Named Rules
**The Restraint Rule.** Primary blue appears on <= 15% of any given screen. Its rarity is what makes it a signal. If everything is blue, nothing is.

**The Status-Only Green Rule.** Green is never decorative. It means: active, approved, succeeded, healthy. If it's not a status, it's not green.

## 3. Typography

**Display/Body Font:** Inter (system-ui fallback)
**Mono Font:** JetBrains Mono (Fira Code fallback)

**Character:** Inter at 14px body with tight letter-spacing creates the precise, dashboard-native feel of Linear. JetBrains Mono for code blocks, agent output, and data tables adds technical credibility without being cold.

### Hierarchy
- **Display** (700, clamp(2rem, 4vw, 3rem), 1.1): Page titles only. Used sparingly — most screens use Headline.
- **Headline** (600, 1.5rem/24px, 1.25): Section headers, modal titles, card group labels.
- **Title** (600, 1.125rem/18px, 1.4): Card titles, sidebar section labels, table headers.
- **Body** (400, 0.875rem/14px, 1.6): Default text. Everything that isn't a heading. Max line length 75ch.
- **Label** (500, 0.75rem/12px, 1.5, tracking 0.025em): Metadata, timestamps, status badges, form labels. Uppercase ONLY for status badges (3 words max).
- **Mono** (400, 0.8125rem/13px, 1.6): Agent output, code snippets, branch names, terminal logs.

### Named Rules
**The 14px Default Rule.** Body text is 14px (0.875rem). This is a data-dense product, not a marketing site. 16px wastes vertical space on dashboards without improving readability at these line lengths.

**The Mono Discipline Rule.** Monospace is for machine-generated content: code, logs, branch names, terminal output. Never for headings, labels, or UI copy.

## 4. Elevation

Flat by default. Shadows appear only for floating elements (dropdowns, modals, tooltips) to signal "this is above the surface." Cards and panels use border + background differentiation, not shadows.

### Shadow Vocabulary
- **Dropdown** (`box-shadow: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)`): Menus, selects, popovers.
- **Modal** (`box-shadow: 0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1)`): Modals, command palette, full dialogs.
- **Toast** (`box-shadow: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)`): Notifications, toasts.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Cards are distinguished by background color + border, not shadows. Shadows appear only on floating layers (z-index > base).

## 5. Components

### Buttons
- **Shape:** rounded-md (6px), height 36px, padding 8px 16px
- **Primary:** Command Blue bg, white text. Hover: darker blue. Focus: 2px ring offset.
- **Secondary:** transparent bg, ink text, border. Hover: surface bg.
- **Ghost:** no border, no bg. Hover: surface bg. For toolbar actions.
- **Destructive:** red bg, white text. Used only with confirmation dialog.
- **Icon button:** 36x36px, ghost style. Tooltip required.
- **Loading:** spinner replaces label, button disabled, width preserved.

### Badges / Status Pills
- **Shape:** rounded-full (pill), padding 2px 8px, label size
- **Success:** green bg, white text. For: active, approved, done, healthy.
- **Warning:** amber bg, white text. For: pending, paused, needs attention.
- **Error:** red bg, white text. For: failed, rejected, over budget.
- **Neutral:** surface bg, muted text, border. For: draft, idle, unknown.
- **Info:** primary blue bg, white text. For: running, in progress.

### Cards / Containers
- **Corner Style:** rounded-lg (8px)
- **Background:** bg (white) in light, surface-dark in dark mode
- **Border:** 1px border color
- **No shadow at rest** (see Elevation)
- **Internal Padding:** lg (16px)
- **Kanban cards:** compact variant — md padding (12px), title + body size

### Inputs / Fields
- **Shape:** rounded-md (6px), 1px border, height 36px
- **Background:** bg (white) in light, surface-dark in dark
- **Focus:** 2px ring in primary blue, border transitions to primary
- **Error:** border-destructive, helper text in red below field
- **Disabled:** opacity 0.5, cursor not-allowed

### Navigation (Sidebar)
- **Width:** 224px (collapsed: 64px)
- **Background:** bg (same as page background — no visual separation except right border)
- **Items:** body size, 36px height, rounded-md, full-width
- **Active:** surface bg + primary text + primary left indicator (2px)
- **Hover:** surface bg
- **Group labels:** label size, uppercase, muted color, tracking wide

### Kanban Board
- **Columns:** min-width 280px, header with column name + count badge
- **Cards:** white bg, border, rounded-lg, compact padding. Title in title size, description in body/muted.
- **Drag feedback:** card lifts with modal shadow, slight scale (1.02), origin placeholder with dashed border
- **Column action indicator:** small icon in column header when agent_action_prompt is set

### Gantt Chart
- **Bars:** color matches card's column color, rounded-sm corners, height 28px
- **Dependencies:** thin gray arrows between bars
- **Today line:** vertical dashed line in primary blue
- **Grid:** subtle horizontal lines (border color), week/month headers in label size

### Conversation / Chat
- **Messages:** left-aligned, no bubbles. Avatar (24px circle) + name (title weight) + timestamp (label, muted).
- **Agent messages:** surface bg block, full-width
- **User messages:** no bg, just text
- **Question for user:** amber left border (4px), amber bg tint, prominent
- **Artifact:** green left border, green bg tint, with "View Artifact" link
- **Input:** full-width textarea at bottom, send button

### Agent Org Chart
- **Nodes:** card style (white bg, border, rounded-lg), agent name + role + provider badge
- **Connections:** thin gray lines (1px), rounded corners at bends
- **Layout:** top-down tree, collapsible levels

## 6. Do's and Don'ts

**Do** use Command Blue exclusively for interactive elements and focus states.
**Don't** use blue for decorative purposes, backgrounds, or non-interactive text.

**Do** use green only for status communication (active, approved, success, healthy).
**Don't** use green decoratively or for non-status elements.

**Do** keep body text at 14px. This is a data-dense product.
**Don't** use 16px body — it wastes vertical space on dashboards.

**Do** use Inter for all UI text and JetBrains Mono for code/terminal output.
**Don't** use more than 2 font families. Don't use mono for headings or labels.

**Do** distinguish cards from background via border + surface color.
**Don't** use shadows on cards at rest. Shadows are for floating elements only.

**Do** provide keyboard shortcuts for common actions (Cmd+K command palette, arrow keys in Kanban).
**Don't** make any feature accessible only via mouse.

**Do** design both light and dark modes from the start. Test contrast separately.
**Don't** invert light mode colors for dark mode. Use the dedicated dark neutral scale.

**Don't** use purple gradients, neon accents, glassmorphism, or "AI vibes" aesthetics (from anti-references: generic AI tools).
**Don't** create deep menu hierarchies or modal stacking (from anti-references: Jira/Atlassian).
**Don't** show raw data tables without visual hierarchy (from anti-references: Excel/spreadsheets).
**Don't** oversimplify at the expense of information density (from anti-references: Trello).
**Don't** use emojis as icons. Use Lucide icons exclusively.
**Don't** nest cards inside cards. Use sections with headers instead.
