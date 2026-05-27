---
applyTo: "**/*.{jsx,js,css}"
description: "Animation conventions and performance rules for this Next.js project"
---

## Animation Rules for This Project

### CSS — Write in `app/globals.css`
All animation CSS belongs in `app/globals.css`, grouped under a `/* ── ANIMATIONS ── */` comment block.
Never write `<style>` tags in JSX components.

### Client Components Only
Any component that uses animation hooks (`useState`, `useEffect`, Framer Motion hooks, etc.)
MUST begin with `'use client'`. Create a separate `*Client.jsx` wrapper if the parent is a Server Component.

### GPU-Safe Properties
**ONLY** animate `transform` and `opacity`. Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` — these cause layout reflow and drop frames.

```css
/* ✅ Correct */
transform: translateY(-8px);
opacity: 0.8;

/* ❌ Wrong — causes reflow */
top: -8px;
height: 200px;
```

### Reduced Motion — Always Required
Every animation must have a `prefers-reduced-motion` override:

```css
@media (prefers-reduced-motion: reduce) {
  .your-animated-element {
    animation: none;
    transition: none;
  }
}
```

### Library Priority
1. **Pure CSS** — for simple transitions, hovers, loaders (zero bundle cost)
2. **Framer Motion** — for React component enter/exit/layout animations
3. **GSAP** — only for complex multi-step sequences
4. **Lottie** — only for designer-exported animations

Do not install a new library if the effect is achievable with CSS or the Web Animations API.
