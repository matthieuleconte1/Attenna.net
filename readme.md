# Attenna.net

Portail d'accès aux services auto-hébergés d'Attenna : Proxmox VE, Nextcloud,
Home Assistant, Vault et un VPN WireGuard. Le site présente l'infrastructure,
donne un accès direct à chaque service et vérifie en temps réel, depuis le
navigateur du visiteur, que tout répond.

**En production : [attenna.net](https://attenna.net)**

Projet né dans le cadre de la SAÉ 1.04 du BUT Réseaux & Télécommunications de
l'IUT Grand Ouest Normandie (site d'Ifs), puis poursuivi comme projet personnel.

---

## Les pages

| Page | Fichier | Contenu |
| --- | --- | --- |
| Accueil | `index.html` | Accès aux services et moniteur d'état, sur fond d'océan animé |
| À propos | `HTML/A-Propos.html` | Présentation en récit : un nuage de points se métamorphose au défilement |
| Profil | `HTML/Matthieu.html` | Présentation de l'auteur |
| WireGuard | `wg.html` | Commande d'installation du VPN, copiable en un clic |
| Horloge | `horloge.html` | Horloge en fenêtre de terminal |

Toutes les pages partagent la même direction artistique : fond noir chaud,
accent orange `#ed6a0c`, titres en *Zalando Sans Expanded*, texte en
*Red Hat Display* et surfaces pleines.

## Sous le capot

### L'océan (WebGPU)

Le fond de chaque page est une vraie simulation d'océan par FFT, calculée sur
le GPU (`fft-ocean/`) :

1. un spectre de vagues de type Phillips est généré à partir du vent ;
2. il évolue à chaque image selon la relation de dispersion en eau profonde ;
3. une transformée de Fourier inverse, en plusieurs passes, donne les déplacements ;
4. une grille de 64 × 64 particules (4 096 points) est déplacée puis rendue, avec un bloom en quatre niveaux.

Les shaders sont écrits en WGSL et orchestrés avec [vgpu](https://www.npmjs.com/package/vgpu).
Sans WebGPU, `JS/fft-ocean.ts` bascule sur un rendu Canvas 2D plus léger, limité à 30 images par seconde.

L'océan réagit au défilement : la caméra avance sur la houle et descend vers
l'eau au fil de la page, et la vitesse de défilement agite les vagues et avive
les crêtes orange (`fft-ocean/scroll-motion.ts`). Il ralentit jusqu'à l'arrêt
quand la fenêtre perd le focus, et repart proprement après un retour arrière
du navigateur (bfcache).

### Le moniteur de services

Sur l'accueil, `JS/service-status.js` sonde chaque service toutes les 60 secondes :

- requête `fetch` en mode `no-cors` : on sait si le serveur répond, sans lire la réponse ;
- chargement d'image pour Vault, dont la page de connexion ne se prête pas au `fetch` ;
- latence mesurée pour chaque sonde, et historique des 12 derniers contrôles gardé dans le `localStorage`.

La pastille n'affiche que « 6/6 en ligne ». Au premier contrôle, six points y
passent de l'ambre au vert puis se replient. Le panneau détaille chaque service
et affiche un battement de moniteur cardiaque animé avec [anime.js](https://animejs.com) :
chaque point est un service, qui prend sa place dans le battement s'il répond
et retombe à plat sinon.

### Le récit « À propos »

`JS/about-story.js` épingle une scène pendant le défilement. Environ 1 600 points
dessinés sur un canvas passent d'une forme à l'autre : le logo Proxmox, un nuage,
un cadenas, puis une nappe d'océan. Chaque forme est dessinée hors écran puis
relevée sur une grille. Les points fuient le curseur, et anime.js anime la
typographie de chaque étape (lettres qui montent d'un masque, texte brouillé
qui se fixe).

### Accessibilité et sobriété

- Avec `prefers-reduced-motion`, les animations s'arrêtent et le récit « À propos » s'affiche en simple liste.
- Sans JavaScript, tout le contenu reste lisible.
- Les boucles d'animation s'arrêtent hors de l'écran, quand la fenêtre n'a pas le focus, ou dès que plus rien ne bouge.

## Technologies

- HTML, CSS et JavaScript, sans framework
- TypeScript pour le moteur de l'océan
- WebGPU et WGSL, via vgpu
- [anime.js](https://animejs.com) 4 pour les animations de texte et du moniteur
- [Vite](https://vite.dev) 8 pour le développement et le build multipage

## Démarrer

Prérequis : Node.js 22 ou plus récent, et npm.

```bash
git clone https://github.com/matthieuleconte1/Attenna.net.git
cd Attenna.net
npm install
npm run dev
```

Vite affiche l'adresse locale à ouvrir. Pour voir l'océan en WebGPU, utilisez
un navigateur qui le prend en charge, comme Chrome ou Edge. Les autres
navigateurs affichent le rendu de secours en Canvas 2D.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Vérification TypeScript, puis build de production dans `dist/` |
| `npm run preview` | Sert localement le build de production |

## Structure

```text
index.html, wg.html, horloge.html   Pages à la racine
HTML/                               Pages À propos et profil
CSS/
  style.css                         Accueil : fond, en-tête, titres
  button-refresh.css                Boutons des services
  service-status.css                Moniteur de services
  unified-pages.css                 Pages secondaires : en-tête, cartes, récit, WireGuard, horloge
JS/
  fft-ocean.ts                      Démarrage de l'océan et rendu de secours Canvas 2D
  service-status.js                 Sondes, historique et battement du moniteur
  about-story.js                    Récit à métamorphoses de la page À propos
  dot-field.js                      Trame de points qui réagit au curseur (À propos)
  reveal.js                         Apparitions au défilement
  scroll-arrows.js                  Indicateur de défilement et retour en haut
fft-ocean/                          Moteur WebGPU : graphe de rendu, caméra, réglages, shaders WGSL
pictures/                           Logos, avatar et favicons
scripts/
  build-favicon.py                  Génère les favicons à partir du logo
  server-pull.sh                    Déploiement côté serveur
.github/workflows/                  Build et publication automatiques
```

## Déploiement

Le déploiement se fait en deux temps, et le serveur n'a besoin ni de Node ni de npm.

1. **Build (GitHub Actions).** À chaque push sur `main`, le workflow installe
   les dépendances, lance `npm run build` et pousse le contenu de `dist/` sur
   la branche `deploy`, sous forme d'un commit unique. Un fichier `VERSION`
   contient le SHA du commit construit.
2. **Publication (serveur).** `scripts/server-pull.sh` récupère la branche
   `deploy` et la synchronise avec `rsync --checksum --delete` dans la racine
   nginx. Les anciens fichiers hashés par Vite sont supprimés au passage.

Installation initiale sur le serveur. La branche `deploy` ne contient que le
site construit : copiez d'abord `scripts/server-pull.sh` sur le serveur.

```bash
sudo mkdir -p /srv/attenna /var/www/attenna
sudo chown -R "$USER" /srv/attenna /var/www/attenna
git clone --depth 1 -b deploy https://github.com/matthieuleconte1/Attenna.net.git /srv/attenna
./server-pull.sh
```

Ensuite, `./server-pull.sh` suffit à chaque mise à jour. Les chemins peuvent
être changés avec les variables `REPO_DIR`, `WEB_ROOT` et `BRANCH`.

## Personnaliser

- **Ajouter ou retirer un service surveillé :** modifier le tableau `monitoredServices`
  dans `JS/service-status.js`. Le moniteur, la liste et le compteur s'adaptent seuls.
  Le battement est dessiné pour six points (`pulseShape`).
- **Régler l'océan :** tout est dans `OCEAN_TUNING` (`fft-ocean/tuning.ts`), dont le
  vent, l'amplitude, la caméra, le bloom et la réaction au défilement (`scroll`).
- **Changer l'intervalle des contrôles :** `checkInterval` dans `JS/service-status.js`.
- **Regénérer les favicons :** `python3 scripts/build-favicon.py` (nécessite Pillow).

## Branches

- `main` : version actuelle, déployée automatiquement ;
- `old` : version précédente du site, conservée pour mémoire.

## Auteur

Conçu et réalisé par [Matthieu Leconte](https://github.com/matthieuleconte1).
