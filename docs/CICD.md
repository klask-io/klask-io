# CI/CD Pipeline pour Klask

## 🚀 Vue d'ensemble

Klask utilise **GitHub Actions** pour une pipeline CI/CD complète, gratuite et automatisée.

## 📋 Workflows

### 1. **CI/CD Pipeline** (`.github/workflows/ci.yml`)

**Déclencheurs :**
- Push sur `main`, `master`, `develop`
- Pull requests vers `main`, `master`

**Étapes :**
1. **Tests Frontend** 
   - Type checking TypeScript
   - Tests unitaires
   - Build de production

2. **Tests Backend**
   - Format du code (`cargo fmt`)
   - Linting (`cargo clippy`)
   - Tests unitaires avec PostgreSQL

3. **Build & Push Images**
   - Construction des images Docker
   - Push vers GitHub Container Registry
   - Cache intelligent pour builds rapides

4. **Scan de Sécurité**
   - Analyse des vulnérabilités avec Trivy
   - Rapport SARIF intégré à GitHub

### 2. **Release** (`.github/workflows/release.yml`)

**Déclencheurs :**
- Création d'une release GitHub
- Déclenchement manuel

**Étapes :**
- Build des images avec tags de version
- Génération SBOM (Software Bill of Materials)
- Upload des artifacts de release

### 3. **Deploy** (`.github/workflows/deploy.yml`)

**Déclencheurs :**
- Succès du workflow CI/CD
- Déclenchement manuel

**Étapes :**
- Déploiement staging automatique
- Déploiement production (avec approbation)
- Health checks
- Notifications

## 🐳 Images Docker

### Registres supportés
- **GitHub Container Registry** (par défaut)
- Docker Hub (configurable)

### Tags générés
```bash
# Branches
ghcr.io/username/klask-frontend:main
ghcr.io/username/klask-backend:develop

# Releases
ghcr.io/username/klask-frontend:v1.0.0
ghcr.io/username/klask-backend:stable

# SHA commits
ghcr.io/username/klask-frontend:main-abc1234
```

## ⚙️ Configuration

### 1. Secrets GitHub requis

Aller dans **Settings > Secrets and variables > Actions** :

```bash
# Optionnel - si vous utilisez Docker Hub
DOCKER_HUB_USERNAME=your-username
DOCKER_HUB_TOKEN=your-token

# Optionnel - pour le déploiement
SERVER_HOST=your-server.com
SERVER_USER=deploy
SERVER_SSH_KEY=your-private-ssh-key
```

### 2. Variables d'environnement

Dans **Settings > Secrets and variables > Actions > Variables** :

```bash
REGISTRY_URL=ghcr.io
FRONTEND_IMAGE_NAME=klask-frontend
BACKEND_IMAGE_NAME=klask-backend
```

### 3. Permissions requises

Dans **Settings > Actions > General** :
- ✅ "Read and write permissions"
- ✅ "Allow GitHub Actions to create and approve pull requests"

## 🚀 Déploiement

### Development
```bash
# Push automatique
git push origin develop
# → Tests + Build + Push vers ghcr.io
```

### Production
```bash
# Créer une release
git tag v1.0.0
git push origin v1.0.0
# → GitHub release → Deploy workflow
```

### Manuel
```bash
# Via l'interface GitHub
Actions > Deploy > Run workflow
```

## 📊 Monitoring

### Dashboard GitHub Actions
- **Actions** tab : Voir tous les workflows
- **Security** tab : Rapports de vulnérabilités
- **Packages** tab : Images Docker publiées

### Logs et Debugging
```bash
# Voir les logs en temps réel
https://github.com/username/klask-rs/actions

# Debug mode
Re-run jobs with debug logging enabled
```

## 🔧 Customisation

### Ajouter des tests
```yaml
# Dans .github/workflows/ci.yml
- name: E2E Tests
  run: npm run test:e2e
```

### Changer le registre
```yaml
# Utiliser Docker Hub au lieu de GHCR
env:
  REGISTRY: docker.io
  USERNAME: ${{ secrets.DOCKER_HUB_USERNAME }}
  PASSWORD: ${{ secrets.DOCKER_HUB_TOKEN }}
```

### Déploiement personnalisé
```yaml
# Dans .github/workflows/deploy.yml
- name: Deploy to Kubernetes
  run: |
    kubectl apply -f k8s/
    kubectl rollout status deployment/klask-backend
```

## 💰 Coûts

### GitHub Actions (gratuit)
- **Repos publics** : Illimité
- **Repos privés** : 2000 minutes/mois

### GitHub Container Registry
- **Repos publics** : Illimité
- **Repos privés** : 500MB gratuit

### Optimisations
- ✅ Cache Docker layers
- ✅ Cache Rust dependencies  
- ✅ Parallel jobs
- ✅ Conditional builds

## 🐛 Troubleshooting

### Build échoue
```bash
# Vérifier les logs
Actions > Failed workflow > Job logs

# Tester localement
docker build -t test ./klask-rs
```

### Permission denied
```bash
# Vérifier les permissions du repo
Settings > Actions > General > Workflow permissions
```

### Cache issues
```bash
# Clear cache
Actions > Caches > Delete specific cache
```