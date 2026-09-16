# Attenna.net

Site vitrine et portail d’accès aux services privés d’Attenna. Le projet a été
créé dans le cadre de la SAÉ 1.04 du BUT Réseaux & Télécommunications de l’IUT
Grand Ouest Normandie, site d’Ifs.

Le site présente une infrastructure d’auto-hébergement articulée autour de
Proxmox VE et de Nextcloud, avec des accès directs aux différents services et
un suivi de leur disponibilité depuis le navigateur.

Site en production : [attenna.net](https://attenna.net)

## Fonctionnalités

- accès rapide à Proxmox VE, Nextcloud et Home Assistant ;
- panneau de disponibilité des services Attenna ;
- page de présentation de l’infrastructure ;
- guide de connexion WireGuard ;
- profil de l’auteur ;
- interface responsive avec animations et transitions ;
- arrière-plan océanique animé avec WebGPU et solution de repli Canvas 2D.

## Technologies

- HTML, CSS et JavaScript ;
- TypeScript ;
- Vite 8 ;
- vGPU et shaders WGSL pour le rendu WebGPU.

## Installation

Prérequis : une version récente de Node.js et npm.

```bash
git clone https://github.com/matthieuleconte1/Attenna.net.git
cd Attenna.net
npm install
npm run dev
```

Le serveur de développement indique l’adresse locale à ouvrir dans le
navigateur.

## Commandes disponibles

```bash
npm run dev      # lance le serveur de développement
npm run build    # vérifie TypeScript et génère la version de production
npm run preview  # prévisualise localement la version de production
```

Les fichiers générés par `npm run build` sont placés dans `dist/`.

## Structure du projet

```text
CSS/         Feuilles de style du site
HTML/        Pages À propos et profil
JS/          Interactions, suivi des services et intégration de l’océan
fft-ocean/   Moteur WebGPU, graphe de rendu et shaders WGSL
pictures/    Images, logos et icônes
scripts/     Scripts de génération des ressources
index.html   Page d’accueil
wg.html      Guide WireGuard
horloge.html Horloge au style terminal
```

## Branches

- `main` contient la version actuelle du site ;
- `old` conserve la version précédente.

## Auteur

Projet réalisé par [Matthieu Leconte](https://github.com/matthieuleconte1).
