# CandyBeauty : maquette de refonte

Concept de démonstration pour la boutique Shopify **candybeauty.org**. La maquette n'est pas reliée à la boutique : elle ne modifie rien en production et ne permet ni commande ni paiement.

Ce dossier est indépendant du reste du dépôt.

## Deux versions

- **V1 – `index.html`** : direction « Lisse ou sucré ? », claire et éditoriale.
- **V2 – `v2.html`** : direction plus pop et énergique, inspirée de la mise en page de rebelle.co. On y retrouve de grandes bandes roses à bords courbes, une typo display ronde, des cartes produits sur fonds acidulés et un méga-menu. La fiche produit avance par étapes numérotées, avec une bande « La recette », et le panier propose des suggestions. Seule la mise en page s'inspire de ce site : aucun logo, visuel ni texte de Rebelle n'est repris. Les avis clients, la pop-up et les promesses nutritionnelles de ce site ne sont pas transposés, faute de données réelles chez CandyBeauty.

## Ouvrir la maquette

- **Sur ordinateur** : double-cliquer sur `index.html` (V1) ou `v2.html` (V2). Une connexion internet est utile pour les polices (Google Fonts). Le reste fonctionne hors ligne.
- **Sur téléphone ou pour la partager** : utiliser la page privée publiée sur claude.ai (lien donné dans la conversation), puis la partager avec la cliente depuis le menu « Partager ».

Parcours à montrer, dans l'ordre :

1. Accueil : « Lisse ou plutôt sucré ? »
2. Une collection, par exemple Halal, puis les filtres et le tri
3. Une fiche produit avec variantes, par exemple « Box découverte lisse, sucrée »
4. Le panier latéral : quantités, retrait, total
5. La recherche instantanée, par exemple « cola »
6. La proposition « Composer mon assortiment »

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Maquette complète générée, à ouvrir dans un navigateur |
| `v2.html` | Version 2 générée, à ouvrir dans un navigateur |
| `src/page.html`, `src/page-v2.html` | Sources des deux versions (HTML, CSS et JS sans dépendance) |
| `src/build.py` | Injecte `products.json` dans les pages et produit `index.html` et `v2.html` |
| `products.json` | 38 produits réels relevés le 23/11/2026 : nom, prix, prix barré, variantes, disponibilité, texte de la fiche, URL |
| `img/` | Photos des produits, découpées depuis les pages collection du site |
| `docs/fable-direction.md` | Exploration visuelle et motifs SVG produits avec Fable 5.2 |

Pour régénérer la page après une modification : `python3 src/build.py`.

## Sources et limites

- Prix, variantes, disponibilités, ingrédients, annonces (« 4,99 Mondial relay », « -5% Bienvenue5 »), moyens de paiement et conditions d'expédition proviennent de candybeauty.org (relevé du 23/11/2026).
- Les photos ont été récupérées à partir de captures des pages collection, car les fichiers images ne pouvaient pas être téléchargés directement. Elles font environ 350 px de large. Une intégration réelle dans le thème Shopify utiliserait les fichiers originaux en haute définition.
- L'échantillon compte 38 produits sur les quelque 120 en ligne. Les produits de Noël et d'Halloween n'y figurent pas, faute de photos récupérées.
- Les pastilles Lisse, Sucré, Halal et 🌱 sont déduites du nom et de la fiche de chaque produit, pas des collections Shopify.
- « Composer mon assortiment » et « Me prévenir du retour en stock » sont des **propositions**, signalées comme telles dans la maquette.
