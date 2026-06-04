# TRIVELA — Migration Cloudflare (front + live) + domaine trivela.ch

Supabase ne change pas. On déplace le front sur **Cloudflare Pages** et on ajoute
un **Worker Cron 1 min** pour le live. Tout le code est déjà prêt dans le repo.

## 1) Front sur Cloudflare Pages
1. Crée un compte sur https://dash.cloudflare.com (gratuit).
2. **Workers & Pages → Create → Pages → Connect to Git** → choisis le dépôt **TRIVELA**.
3. Réglages de build :
   - **Production branch** : `claude/resume-codebase-work-i3uAg` (ou `main` si tu fusionnes)
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
   - **Variable d'environnement** : `VITE_BASE` = `/`   ← IMPORTANT (sinon les assets cassent)
4. **Save and Deploy** → ton site sera sur `https://trivela-xxx.pages.dev`.

## 2) Domaine trivela.ch
> Cloudflare ne **vend pas** les `.ch`. Achète `trivela.ch` chez un registrar
> (Infomaniak, Hostpoint, Gandi, Netim…), puis :
1. Cloudflare → **Add a site** → `trivela.ch` (plan Free).
2. Cloudflare te donne **2 nameservers** → mets-les chez ton registrar (remplace les DNS).
3. Quand le domaine est « actif » sur Cloudflare : **Pages → ton projet → Custom domains → Set up a domain** → `trivela.ch` (et `www.trivela.ch`). SSL automatique.

## 3) Live — Worker Cron (1 min)
Fichiers déjà prêts : `cloudflare/live-worker.js` + `wrangler.toml`.
**Option CLI (recommandée)** depuis le repo :
```
npm i -g wrangler
wrangler login
wrangler secret put API_FOOTBALL_KEY          # colle ta clé
wrangler secret put SUPABASE_SERVICE_ROLE_KEY # colle la clé service Supabase
wrangler deploy
```
Le cron `* * * * *` est déjà configuré → le live se met à jour chaque minute.
(Test manuel : ouvre l'URL du Worker, il renvoie « live: N ».)

## 4) Après vérification
- Désactiver l'ancien poller GitHub (`api-football-live.yml`) pour ne pas doubler.
- (Option) garder GitHub Pages comme miroir, ou le retirer.

<!-- deploy trigger 1780608437 -->
