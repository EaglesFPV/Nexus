# ⚡ Nexus

Panneau de contrôle desktop pour appareils **Tuya / Smart Life** — ampoules, prises connectées, et plus.

Construit avec Electron. Open source, pour ceux qui ont les compétences.

## Pré-requis

- [Node.js](https://nodejs.org) v18+
- Un compte [Tuya IoT Platform](https://iot.tuya.com) (gratuit)
- Vos appareils liés à Smart Life

## Installation

```bash
git clone https://github.com/EaglesFPV/Nexus.git
cd Nexus
npm install
npm start
```

## Configuration

Au premier lancement, Nexus vous guide pour entrer votre **Client ID** et **Client Secret** depuis iot.tuya.com.

1. Créez un projet **Smart Home** sur [iot.tuya.com](https://iot.tuya.com) (Data Center : Central Europe)
2. Autorisez les API suggérées
3. Dans **Devices → Link App Account**, liez votre compte Smart Life
4. Copiez votre Client ID et Client Secret dans Nexus

## Build

```bash
npm run build
```

Le `.exe` est généré dans `dist/`.

## Release (GitHub Actions)

Déclenchez le workflow `Release Nexus` depuis GitHub Actions avec le numéro de version.

## Appareils supportés

| Type | Catégories Tuya |
|------|----------------|
| 💡 Ampoules / éclairage | `dj`, `dd`, `xdd`, `fwd`, `dc` |
| 🔌 Prises connectées | `cz`, `pc`, `kg` |

## Licence

MIT
