# 🎨 Configuration Webhook Figma → GitHub Actions

## Vue d'ensemble

Ce système permet de déclencher automatiquement le pipeline de tokens Solstice quand tu publies des variables dans Figma.

### Flux complet :
```
Figma Publish → Webhook → GitHub Pages → GitHub Actions → Pipeline Tokens
```

## 📋 Étapes de configuration

### 1. Activer GitHub Pages

1. Va dans **Settings** de ton repository GitHub
2. Scroll jusqu'à **Pages** dans la sidebar
3. Sous **Source**, sélectionne **Deploy from a branch**
4. Choisis **main** branch et **/docs** folder
5. Clique **Save**

Ton endpoint sera disponible à : `https://josscuette.github.io/TokensPipeline/webhook.html`

### 2. Configurer les secrets GitHub

Va dans **Settings** → **Secrets and variables** → **Actions** et ajoute :

- **`FIGMA_TOKEN`** : Ton token Figma API
- **`GITHUB_TOKEN`** : Token GitHub (généré automatiquement)

### 3. Créer un token GitHub pour le webhook

1. Va sur [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Clique **Generate new token (classic)**
3. Donne un nom : `Solstice Tokens Webhook`
4. Sélectionne ces permissions :
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Clique **Generate token**
6. **Copie le token** (tu ne pourras plus le voir après)

### 4. Mettre à jour le webhook.html

Dans `docs/webhook.html`, remplace cette ligne :
```javascript
const GITHUB_TOKEN = 'ghp_xxxxxxxxxxxxxxxxxxxx'; // À remplacer par un token GitHub
```

Par ton vrai token :
```javascript
const GITHUB_TOKEN = 'ghp_ton_vrai_token_ici';
```

### 5. Configurer le webhook dans Figma

1. Va sur [Figma Settings → Webhooks](https://www.figma.com/settings/webhooks)
2. Clique **Create webhook**
3. Configure :
   - **Name** : `Solstice Tokens Pipeline`
   - **URL** : `https://josscuette.github.io/TokensPipeline/webhook.html`
   - **Events** : Sélectionne `FILE_PUBLISHED` et `VARIABLE_PUBLISHED`
4. Clique **Create webhook**

### 6. Tester le système

1. **Test manuel** : Va sur `https://josscuette.github.io/TokensPipeline/webhook.html` et clique "Test Webhook"
2. **Test réel** : Publie une variable dans Figma et vérifie que GitHub Actions se déclenche

## 🔧 Dépannage

### Le webhook ne se déclenche pas
- Vérifie que GitHub Pages est activé
- Vérifie que l'URL du webhook est correcte
- Vérifie les logs dans Figma Settings → Webhooks

### GitHub Actions ne se déclenche pas
- Vérifie que le token GitHub est correct dans webhook.html
- Vérifie que le secret `FIGMA_TOKEN` est configuré
- Vérifie les logs dans GitHub Actions

### Erreur 404 sur GitHub Pages
- Assure-toi que le dossier `docs/` est commité
- Vérifie que GitHub Pages pointe vers `/docs`

## 📊 Monitoring

- **Figma** : Va dans Settings → Webhooks pour voir les logs
- **GitHub Actions** : Va dans l'onglet Actions de ton repository
- **GitHub Pages** : Va sur l'URL du webhook pour tester

## 🚀 Une fois configuré

À chaque fois que tu publies des variables dans Figma :
1. Figma envoie un webhook
2. GitHub Pages déclenche GitHub Actions
3. GitHub Actions extrait les tokens et génère le CSS
4. Les changements sont automatiquement commités

**C'est tout ! Ton pipeline est maintenant 100% automatisé !** 🎉



