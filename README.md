<div align="center">

# Nexus

**Hub de contrôle pour appareils connectés Tuya / Smart Life**

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-28-47848F?style=flat-square&logo=electron)

</div>

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/download.svg" width="18"/> Téléchargement

Rendez-vous dans l'onglet [**Releases**](../../releases/latest) et téléchargez `Nexus-Setup-x.x.x.exe`.

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/star.svg" width="18"/> Fonctionnalités

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/zap.svg" width="14"/> Contrôle des appareils
- Allumage / extinction en un clic
- Détection automatique du type d'appareil (ampoule, prise, etc.)
- Rafraîchissement du statut en temps réel

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/sun.svg" width="14"/> Éclairage
- Réglage de la luminosité et de la température de couleur
- Color picker pour les ampoules RGB
- Modes blanc et couleur

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/cpu.svg" width="14"/> Prises connectées
- Affichage de la puissance consommée (W) et de la tension (V)

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/settings.svg" width="14"/> Configuration
- Setup guidé au premier lancement
- Compatible avec tous les appareils Tuya / Smart Life
- Données stockées localement

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/layers.svg" width="18"/> Appareils supportés

| Type | Catégories Tuya |
|---|---|
| 💡 Ampoules / éclairage | `dj`, `dd`, `xdd`, `fwd`, `dc`, `jsq` |
| 🔌 Prises connectées | `cz`, `pc`, `kg` |

> D'autres types d'appareils seront ajoutés dans les prochaines versions.

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/settings.svg" width="18"/> Configuration

Au premier lancement, Nexus vous guide étape par étape.

1. Créez un projet **Smart Home** sur [iot.tuya.com](https://iot.tuya.com) — Data Center : **Central Europe**
2. Autorisez les API suggérées
3. Dans **Devices → Link App Account**, liez votre compte Smart Life via QR code
4. Entrez votre **Client ID** et **Client Secret** dans Nexus

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/git-branch.svg" width="18"/> Build

```bash
git clone https://github.com/EaglesFPV/Nexus.git
cd Nexus
npm install
npm start
```

Les releases sont générées automatiquement via GitHub Actions.

```bash
# Déclenchez le workflow "Release Nexus" depuis GitHub Actions
# avec le numéro de version souhaité (ex: 1.0.0)
```

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/tool.svg" width="18"/> Dépannage

<details>
<summary><strong>Aucun appareil trouvé</strong></summary>

Vérifiez que vos appareils sont bien liés à votre projet sur iot.tuya.com via **Devices → Link App Account**.

</details>

<details>
<summary><strong>Erreur de connexion API</strong></summary>

Vérifiez que votre Client ID et Client Secret sont corrects et que la région sélectionnée correspond à votre Data Center Tuya.

</details>

<details>
<summary><strong>L'application ne démarre pas</strong></summary>

Vérifiez que la version installée correspond à la dernière release disponible.

</details>
