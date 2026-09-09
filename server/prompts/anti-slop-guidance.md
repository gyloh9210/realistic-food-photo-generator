# Anti-slop guidance

Core principle: if a human food photographer would not take the shot this
way, don't generate it this way. Real food photography has physical logic,
imperfection, and a specific cooking/plating stage; AI slop ignores all
three.

## Prompt scaffold

Build any generation prompt from these parts, in order:
1. Stage-specific description of the dish (finished plated state, exact
   garnish/components) — not a generic "delicious food" description.
2. Material/texture cues — e.g. piece sizes vary 15-30%, matte patches next
   to glossy ones, sauce pooling thicker in some spots with a thin oil
   sheen, not uniform gloss.
3. Light direction — one consistent, physically plausible source (e.g. soft
   natural light from the left, a slight hot spot, asymmetric shadow
   falloff).
4. Camera style — e.g. 50mm lens, shallow but slightly uneven depth-of-field
   falloff, a touch of sensor grain, faint chromatic aberration at
   high-contrast edges.
5. Explicit negatives — no identical pieces/dice, no radial or symmetrical
   plating, no algorithmic garnish scatter, no thick centered steam plume,
   no tiled/repeating background texture, no plastic texture, no
   oversaturation, no floating ingredients, no readable label text or logos.

## Hard avoid list

- Waxy, glossy, airbrushed food; plastic or rubbery textures; perfectly
  uniform browning or mincing.
- Oversaturated/neon colors; a single AI color-grade skew (heavy
  teal-orange, all-amber, magenta-cyan).
- Steam or liquids defying physics (symmetrical plumes, drips that don't
  pool, sauce frozen mid-air); duplicated or floating garnish.
- Malformed hands/utensils; wrong proportions (pan vs. stove, portion vs.
  plate).
- Radial/symmetrical plating; studio-perfect crumbs or garnish rings;
  repeating/tiled background patterns.
- Readable text, logos, or watermarks on packaging or dishware.
- Product-shot-perfect uniform lighting with no natural asymmetry.

## Appetite checklist

Before accepting a generation prompt or a generated image, it should pass:
food looks edible (not a render); textures are visually distinguishable;
colors are warm/natural and match real ingredient colors; composition draws
the eye to the food; no artifacts (melted utensils, extra limbs, garbled
text, impossible physics); natural irregularity is visible (varied piece
sizes, hand-scattered garnish, uneven sauce pooling, non-perfect lighting).
