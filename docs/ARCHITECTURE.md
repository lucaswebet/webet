# AI Real Estate 3D Studio — Analyse initiale et architecture

*Rédigé le 2026-10-08. Les capacités Higgsfield ont été relevées en direct sur le connecteur du compte (plan Plus, 1 114 crédits au moment de l'analyse).*

## 0. Principe directeur

Deux produits distincts, qu'on ne présente jamais l'un pour l'autre :

| | Mode 1 — Cinematic Tour | Mode 2 — Interactive 3D Tour |
|---|---|---|
| Nature | **Animation générative** (image-to-video) | **Reconstruction géométrique** (ou, à défaut, points de vue réels reliés) |
| Ce que c'est | Un modèle vidéo *imagine* le mouvement de caméra à partir d'une photo | Positions de caméra et géométrie *calculées* à partir des recouvrements entre photos |
| Fidélité | Bonne sur le cadre visible, mais le modèle invente ce qui est hors champ et peut déformer | Fidèle là où il y a des données ; trous visibles là où il n'y en a pas |
| Mention client | « Vidéo générée par IA à partir de photos réelles » | « Reconstruction 3D approximative, échelle non mesurée » ou « Visite photo » |

## 1. Capacités réelles de l'environnement

### Higgsfield (connecteur MCP, vérifié)

**Vidéo image-to-video avec image de début ET de fin** (utile pour enchaîner deux photos réelles d'une même pièce) :
`kling3_0`, `kling_o3_flf`, `seedance_2_5`, `seedance_2_0`, `seedance1_5`, `cinematic_studio_3_0` (4–15 s, jusqu'à 4K), `cinematic_studio_video_4_0`, `minimax_h3` (2K), `minimax_hailuo`, `wan3_0`, `wan2_7`, `gemini_omni_flash_1_1`, `flux_3_video`, `veo3_1_lite`.

**Image de début seulement** : `veo3_1`, `veo3`, `kling2_6`, `kling3_0_turbo`, `grok_video_v15`, `happy_horse_video`.

**Post-traitement** : `topaz_video` / `bytedance_video_upscale` (jusqu'à 4K), `video_deflicker`, `topaz_hyperion_2_5` (HDR), `reframe` (16:9 → 9:16 pour Reels/TikTok), `upscale_image`.

**3D** : `generate_3d` (Meshy, Tripo, Hunyuan3D, SAM 3) = **un objet isolé → maillage GLB**. Ces modèles inventent les faces cachées d'un objet ; ils **ne reconstruisent pas une pièce** et ne doivent pas être utilisés pour le Mode 2. `scene_builder_3d` (« 3D Jutsu ») est un Blender hébergé : on y *modélise* une scène, il ne peut pas importer nos fichiers ni reconstruire depuis des photos. → **Aucun outil de reconstruction photogrammétrique dans Higgsfield.**

### Conteneur Claude Code

Python 3.13, Node 22, ffmpeg, OpenCV 5 (SIFT disponible), 4 CPU, 15 Go RAM, **pas de GPU**. Suffisant pour l'analyse des photos, le montage ffmpeg, le viewer web et une SfM légère sur CPU. **Insuffisant pour entraîner du Gaussian Splatting** → GPU externe nécessaire (location à la demande).

## 2. Limites de la reconstruction à partir de photos d'annonce

Une annonce Airbnb typique (≈30–40 photos grand-angle, 1 à 3 par pièce, cadrées pour « vendre ») est **conçue pour l'inverse de la photogrammétrie** :

1. **Recouvrement insuffisant** : la SfM exige ~60–80 % de recouvrement entre vues voisines. Deux photos d'une pièce prises depuis deux coins opposés partagent souvent < 30 %.
2. **Pas de parallaxe** : un photographe pivote souvent sur place. Une rotation pure permet un panorama, pas une triangulation.
3. **Surfaces sans texture** (murs blancs, plafonds) et **surfaces réfléchissantes** (vitres, miroirs, piscine) : aucun point fiable.
4. **Retouches** (HDR, ciel remplacé, correction de distorsion) cassent le modèle de caméra.
5. **Pas d'échelle** : sans mesure de référence, les dimensions sont inconnues. On ne les affichera jamais.
6. **Hors champ = inconnu** : ce qui n'est pas photographié n'existe pas dans la reconstruction. Le système ne le génère pas.

**Conclusion attendue pour les 36 photos** : très probablement Mode 1 complet + Mode 2 en « points de vue reliés », avec peut-être une ou deux zones (salon ouvert, extérieur/piscine) candidates à la 3D. Le Module 1 le dira objectivement. Pour une vraie 3D commercialisable : **captation dédiée** (vidéo smartphone lente, 2–3 min par pièce, ou 200–400 photos en se déplaçant), à vendre comme une prestation séparée.

### Comparaison des méthodes (Mode 2)

| Méthode | Entrée nécessaire | Rendu | Navigable | Verdict |
|---|---|---|---|---|
| Points de vue reliés (photos + hotspots) | Les photos d'annonce | Photo réelle, 100 % fidèle | Saut de point en point, rotation limitée au cadre | **Toujours possible, défaut** |
| Panoramas 360° reliés | Prises 360° (ou rotations assemblables) | Fidèle | Rotation complète, sauts entre points | Si l'hôte fournit des 360° |
| SfM + MVS → maillage texturé (COLMAP/OpenMVS) | 50+ photos/pièce, parallaxe | Correct sur surfaces texturées, trous sur murs lisses | Libre | Lourd, rendu moyen en intérieur |
| SfM + **Gaussian Splatting** (gsplat/Nerfstudio) | 100–300 images/pièce (vidéo) | **Photoréaliste** | Libre, temps réel navigateur | **Meilleur choix pour une captation dédiée** |
| Reconstruction à vues éparses (MASt3R/VGGT + splats) | 5–20 vues | Variable, artefacts hors des vues | Libre mais dégradé | Expérimental — à tester sur nos photos, jamais vendu comme exact |
| Image-to-video « orbitale » | 1 photo | Photoréaliste mais inventé | Non (vidéo) | **Ce n'est pas de la 3D** |

## 3. Architecture technique recommandée

```
┌──────────────────── Admin web (Next.js) ────────────────────┐
│ Import photos · Autorisation propriétaire · Revue des zones │
│ Ordre des scènes · Choix modèle/coût · Valider/Relancer     │
└──────────────┬───────────────────────────────┬──────────────┘
               │ API (FastAPI)                 │
        ┌──────▼──────┐   file de tâches  ┌────▼────────────┐
        │ Postgres    │◄──(Redis + RQ)───►│ Workers         │
        │ biens,      │                   │ M1 analyse (CPU)│
        │ jobs, coûts │                   │ M2 vidéo (Higgs)│
        └─────────────┘                   │ M3 3D (GPU loué)│
                                          │ Montage ffmpeg  │
               ┌──────────────────────────┴─────────────────┘
               ▼
        Stockage objets (S3/R2) : photos originales, clips, splats .spz
               │
        ┌──────▼─────────────── Viewer public ───────────────┐
        │ Three.js + Spark (splats) ou hotspots photo        │
        │ Lien partageable, mobile + desktop, plein écran    │
        └────────────────────────────────────────────────────┘
```

**Modules :**
- **M1 Analyse** (fait, `studio/analysis`) : qualité, EXIF, doublons, appariement SIFT + RANSAC (matrice fondamentale), test de parallaxe par homographie, zones, faisabilité 3D, photos manquantes. Étiquetage des pièces par vision IA (Claude) **avec validation humaine** — jamais déduit de la géométrie seule.
- **M2 Vidéo** : un « plan de tournage » JSON par photo (mouvement adapté au cadre : travelling avant si profondeur, latéral si mur parallèle, orbite seulement pour l'extérieur avec plusieurs vues réelles). Paires début/fin quand deux photos réelles de la même zone existent. Prompt « préservation » systématique. Contrôle qualité automatique (comparaison 1re image générée ↔ photo source, détection de lignes droites qui ondulent) + revue humaine. Montage ffmpeg (fondus, musique libre de droits, carton « vidéo générée par IA »).
- **M3 3D** : COLMAP/GLOMAP (CPU possible) → gsplat sur GPU loué (Modal/RunPod, ~10–30 min par pièce) → compression `.spz` → viewer. Contrôle : erreur de reprojection, % d'images enregistrées ; sous un seuil, repli automatique en points de vue reliés.
- **M4 Viewer** : Three.js. Navigation par hotspots, orbit/gyroscope mobile, plein écran, chargement progressif, LOD.
- **M5 Admin & automatisation** : jobs asynchrones idempotents, retries, journal des coûts par bien (crédits préflightés avant chaque génération), budget plafond par bien, export MP4 (16:9, 9:16), publication par lien.

## 4. Technologies

Python 3.12+ (FastAPI, OpenCV, RQ), PostgreSQL, Redis, S3/R2, ffmpeg ; COLMAP/GLOMAP, gsplat ou Nerfstudio (GPU loué) ; Next.js + Three.js + Spark (rendu de splats) ; Higgsfield via MCP pour le prototype — **pour la production SaaS, vérifier qu'une API Higgsfield utilisable hors Claude existe et ses conditions commerciales** (non vérifié ici) ; Claude API (vision) pour l'étiquetage des pièces et la rédaction des prompts.

## 5. Prototype minimal (un seul bien)

1. Recevoir les 36 photos **en pleine résolution** (originaux, pas des captures).
2. M1 → rapport de zones + faisabilité + photos manquantes. **Validation par vous.**
3. Étiquetage des zones (vision) → **validation par vous**.
4. M2 test A/B : 3 photos × 2 modèles (ex. `kling3_0` vs `seedance_2_5`), 5 s → comparer la fidélité. **Choix du modèle par vous.**
5. Génération du lot (≈15–20 clips) + montage 60–90 s.
6. Viewer « points de vue reliés » avec les 36 photos + clips intégrés.
7. Si M1 trouve une zone candidate : essai SfM CPU sur cette zone (sans splats) pour mesurer honnêtement ce que donnent les photos.

## 6. Étapes de développement

| Étape | Contenu | Validation |
|---|---|---|
| 1 | M1 analyse photos (CLI) | ✅ tests synthétiques ; à valider sur vos photos |
| 2 | Étiquetage pièces + plan de tournage JSON | Revue humaine du plan |
| 3 | M2 génération Higgsfield + préflight des coûts + QC | Test A/B sur 3 photos |
| 4 | Montage ffmpeg + export 16:9 / 9:16 | Vidéo finale du bien |
| 5 | Viewer points de vue reliés (Three.js) | Test mobile + desktop |
| 6 | API + file de tâches + base + suivi des coûts | Relance d'un job échoué |
| 7 | Interface admin | Parcours complet sans terminal |
| 8 | M3 SfM + splats sur GPU loué | Sur une captation dédiée |
| 9 | Publication par lien, autorisations, facturation | Pilote avec une agence |

## 7. Coûts de génération

### Confirmés (préflight `get_cost` du connecteur, 2026-10-08, sans image d'entrée)

| Modèle | Réglage | Crédits |
|---|---|---|
| `kling_o3_flf` | 5 s, défaut | 6,25 |
| `seedance_2_0_mini` | 5 s, 720p | 5 |
| `kling3_0` | 5 s / 10 s | 10 / 20 |
| `veo3_1_lite` | défaut | 12 |
| `veo3_1` | défaut | 32 |
| `seedance_2_5` | 5 s 720p / 1080p | 35 / 60 |
| `cinematic_studio_3_0` | 5 s 1080p | 50 |
| `hunyuan3d_v3_image_to_3d` | (objet isolé — non pertinent pour une pièce) | 11 |

Le coût réel avec image de début/fin sera re-préflighté avant chaque lancement (il peut différer).

### Estimations (non confirmées)

- **Clips par bien** : 15–20 clips de 5 s pour une vidéo de 60–90 s ; prévoir **30–50 % de régénérations** (déformations).
- **Vidéo complète** : ≈ 200–300 crédits avec `kling3_0` ; ≈ 1 000–1 800 crédits avec `seedance_2_5` 1080p ; upscale 4K en sus.
- **Test A/B du prototype** : ≈ 100–150 crédits.
- **Conversion en euros** : dépend du prix de votre plan/recharge — à fixer avant de construire la grille tarifaire client.
- **3D par splats (captation dédiée)** : GPU loué ≈ 1–3 € par pièce (estimation, tarifs GPU à l'heure variables) ; coût hors Higgsfield.

## 8. Droits et conformité

- Les photos d'une annonce appartiennent au photographe et/ou à l'hôte. **Autorisation écrite du propriétaire (et du photographe si distinct) obligatoire** avant traitement ; à stocker avec chaque bien.
- Pas d'extraction automatique depuis Airbnb (conditions d'utilisation) : les photos sont fournies par le client.
- Publicité immobilière : une vidéo qui embellit ou déforme le bien peut constituer une pratique commerciale trompeuse. Mention « générée par IA » sur chaque vidéo ; obligations de transparence de l'AI Act (art. 50) pour les contenus synthétiques à faire vérifier par un juriste.
- Retirer ou flouter les personnes, plaques et documents visibles.
