# CandyBeauty — direction visuelle et motifs SVG

## 1. Exploration de direction visuelle

**A. « Vitrine de confiserie »** — Fond blush, grands aplats berry, produits détourés posés comme dans un bocal de comptoir. Le festonné (scallop) sert de fil conducteur : bords de sections, étiquettes, badges.

**B. « Lisse ou sucré ? »** — Tout le site s'organise autour du duel de textures : brillant d'un côté, grain de sucre de l'autre. Deux pictos, deux finitions de surface (reflet net / pointillé de sucre) déclinés du hero aux fiches produit.

**C. « Carnet de pesée »** — Esprit épicerie au poids : typographie Archivo très grande, chiffres « 100 g » mis en scène, filets fins et sachets kraft au trait. Plus éditorial, moins gourmand.

**Recommandation : B, avec le festonné de A comme ornement.** C'est la seule direction qui part de la vraie structure du catalogue : elle transforme la navigation en choix ludique, sans arc-en-ciel ni mascotte, donc joueuse sans être enfantine. Le rose porte le lisse, le berry apporte la profondeur, le blush laisse respirer.

**Sur le concept du hero.** Le contraste brillant / grain est juste et immédiatement lisible, à condition que la texture se voie vraiment : macro-photo serrée, pas de packshot lointain. Risque : un hero coupé en deux, à 50/50, peut sembler figé et laisse de côté halal, Bubs et box.

**Raffinement proposé.** Remplacer la coupure droite par une couture festonnée et ajouter une troisième réponse sous la question : « Les deux » → box surprise. Le choix devient ensuite un filtre persistant (pastilles « lisse » / « sucré » sur chaque carte produit), ce qui prolonge le concept au-delà du hero.

## 2. Motifs SVG

Notes d'usage : `currentColor` suit la couleur du texte parent (SVG inline). Pour un usage en `background-image`, remplacer `currentColor` par une valeur de la palette.

### a. wrapper

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path fill="#FC7EB7" d="M21 32 7 20.5Q4 19 4.5 22.5L7 32l-2.5 9.5Q4 45 7 43.5zM43 32l14-11.5q3-1.5 2.5 2L57 32l2.5 9.5q.5 3.5-2.5 2z"/>
  <path stroke="#880E4F" stroke-width="2" stroke-linecap="round" opacity=".45" d="M10 32h8M46 32h8"/>
  <circle cx="32" cy="32" r="13" fill="#880E4F"/>
  <path stroke="#FFF0F9" stroke-width="2.5" stroke-linecap="round" d="M24 28a9 9 0 0 1 8-5"/>
</svg>
```

### b. lisse

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <path fill="#FC7EB7" d="M24 5S9 22 9 30a15 15 0 0 0 30 0C39 22 24 5 24 5z"/>
  <path stroke="#880E4F" stroke-width="3" stroke-linecap="round" opacity=".3" d="M35.5 31A11.5 11.5 0 0 1 24 41.5"/>
  <path stroke="#fff" stroke-width="3" stroke-linecap="round" d="M15.5 30c0-4 3-9 6-13"/>
  <circle cx="17.5" cy="35.5" r="1.8" fill="#fff"/>
</svg>
```

### c. sucre

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke-linecap="round">
  <path fill="#FC7EB7" stroke="#FFF0F9" stroke-width="2" stroke-dasharray=".1 3.4" d="M24 5S9 22 9 30a15 15 0 0 0 30 0C39 22 24 5 24 5z"/>
  <path stroke="#880E4F" stroke-width="1.6" opacity=".35" d="M24 25h0M18 32h0M29 31.5h0M23 38.5h0M32 37h0"/>
  <path stroke="#fff" stroke-width="2.4" d="M24 14h0M20 21h0M27 21.5h0M16 28h0M23 29.5h0M31 27.5h0M14 34.5h0M20.5 36h0M27 35h0M34 33h0M18 41h0M25 42.5h0M31 40.5h0"/>
</svg>
```

### d. sparkle

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="currentColor" d="M12 1c.8 6.5 4.5 10.2 11 11-6.5.8-10.2 4.5-11 11-.8-6.5-4.5-10.2-11-11 6.5-.8 10.2-4.5 11-11z"/>
</svg>
```

### e. scallop

Se répète horizontalement sans raccord (4 festons de 30 unités, jointures en x = 0 et x = 120).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 16">
  <path fill="currentColor" d="M0 0h120v6a15 10 0 0 1-30 0 15 10 0 0 1-30 0 15 10 0 0 1-30 0 15 10 0 0 1-30 0z"/>
</svg>
```

### f. box

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 30h40v22a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2zM32 30v24"/>
  <g transform="rotate(-9 10 28)">
    <rect x="9" y="20" width="46" height="8" rx="2"/>
    <path d="M32 20v8M32 20c-3-7-11-6-9-1 1 2 5 2 9 1zm0 0c3-7 11-6 9-1-1 2-5 2-9 1z"/>
  </g>
  <path d="M57 3v6M54 6h6"/>
</svg>
```

### g. bag

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 20 13 53a3 3 0 0 0 3 3.3h32a3 3 0 0 0 3-3.3L47 20"/>
  <path d="M17 20v-9a2 2 0 0 1 2-2h26a2 2 0 0 1 2 2v9z"/>
  <path d="M28 14.5h8"/>
  <circle cx="32" cy="38" r="9"/>
  <path stroke-width="3.5" d="M29 36h0M35 37h0M31.5 42h0"/>
</svg>
```

---

Résumé : trois directions dans la palette (recommandation « Lisse ou sucré ? » + festonné, avec une troisième réponse « Les deux » vers la box surprise) et sept motifs SVG inline écrits à la main, conformes aux contraintes.
