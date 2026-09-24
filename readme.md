<div align="center">

<img src="pictures/favicon-192.png" width="96" alt="Logo Attenna">

# Attenna.net

**Le portail de mon infrastructure auto-hébergée, sur un océan simulé en temps réel sur le GPU.**

[**attenna.net**](https://attenna.net) · WebGPU · TypeScript · Vite · anime.js

</div>

---

Attenna.net donne accès à mes services auto-hébergés (Proxmox VE, Nextcloud,
Home Assistant, Vault, WireGuard) et vérifie en direct, depuis le navigateur du
visiteur, qu'ils répondent tous.

Le projet a commencé avec la SAÉ 1.04 du BUT Réseaux & Télécommunications (IUT
Grand Ouest Normandie, Ifs) et je l'ai ensuite continué comme projet personnel.

## Points forts

- 🌊 **Océan FFT en WebGPU.** Un spectre de Phillips évolue sur le GPU, puis une
  FFT inverse en WGSL déplace 4 096 particules, rendues avec un bloom. L'océan
  réagit au défilement : la caméra plonge vers l'eau et les crêtes s'avivent.
  Sans WebGPU, le site passe sur un rendu Canvas 2D.
- 💓 **Moniteur de services.** Chaque service est sondé toutes les 60 s, avec sa
  latence et un historique. L'état s'affiche comme un battement cardiaque
  animé : un point par service, qui retombe à plat s'il ne répond pas.
- ✨ **Récit « À propos ».** Pendant le défilement, un nuage d'environ
  1 600 points devient le logo Proxmox, puis un nuage, un cadenas et une nappe
  d'océan. Les points fuient le curseur.
- ♿ **Accessible et sobre.** Le site respecte `prefers-reduced-motion`, son
  contenu reste lisible sans JavaScript, et les animations s'arrêtent hors de
  l'écran ou quand la fenêtre perd le focus.

## Démarrer

```bash
git clone https://github.com/matthieuleconte1/Attenna.net.git
cd Attenna.net
npm install
npm run dev      # développement
npm run build    # build de production dans dist/
```

Il faut Node.js 22 ou plus récent. Le rendu WebGPU demande Chrome ou Edge ; les
autres navigateurs affichent le rendu Canvas 2D.

## Structure

```text
index.html · wg.html · horloge.html   Accueil, VPN WireGuard, horloge
HTML/                                 Pages À propos et profil
fft-ocean/                            Moteur WebGPU : caméra, réglages, shaders WGSL
JS/                                   Moniteur, récit, apparitions au défilement
CSS/                                  Styles partagés
scripts/                              Favicons et déploiement serveur
```

## Déploiement

1. À chaque push sur `main`, **GitHub Actions** construit le site et publie
   `dist/` sur la branche `deploy`.
2. Sur le serveur, `scripts/server-pull.sh` récupère la branche `deploy` et la
   synchronise dans la racine nginx avec `rsync`. Le serveur n'a besoin ni de
   Node ni de npm.

## Personnaliser

| Quoi | Où |
| --- | --- |
| Services surveillés et intervalle des contrôles | `monitoredServices` et `checkInterval` dans `JS/service-status.js` |
| Vent, vagues, caméra, bloom et réaction au défilement | `OCEAN_TUNING` dans `fft-ocean/tuning.ts` |
| Favicons | `python3 scripts/build-favicon.py` (nécessite Pillow) |

---

<div align="center">

Conçu et réalisé par [Matthieu Leconte](https://github.com/matthieuleconte1)

</div>
