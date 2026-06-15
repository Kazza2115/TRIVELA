# TRIVELA — notes pour Claude

App React/Vite (pronostics Coupe du Monde 2026) déployée sur **trivela.ch** via Cloudflare Pages.
Données : Supabase (auth + Postgres + Realtime). Scores/cotes alimentés par des jobs GitHub Actions (API-Football, football-data.org).

## Déploiement (IMPORTANT — préférence durable de l'utilisateur)

L'utilisateur veut que **tout changement soit toujours déployé sur trivela.ch**, sans redemander.

- La production (trivela.ch) est déployée par `.github/workflows/cloudflare-pages.yml`, déclenché
  sur push vers la branche **`claude/resume-codebase-work-i3uAg`** (c'est la branche de production)
  ou `main`.
- Flux standard après avoir validé un changement :
  1. commit + push sur la branche de travail courante ;
  2. **fast-forward** vers la prod :
     `git push origin <branche-de-travail>:claude/resume-codebase-work-i3uAg`
  3. le workflow Cloudflare reconstruit et publie automatiquement (~1-2 min).
- Garder la branche de travail alignée sur la prod (fast-forward, zéro conflit).

## Base de données (Supabase)

- Les fichiers `db-*.sql` à la racine sont **appliqués manuellement** dans Supabase → SQL Editor
  (l'environnement n'a pas d'accès réseau sortant vers Supabase, et la clé service role REST ne fait
  pas de DDL). Ils sont idempotents.
- Le réseau egress vers `*.supabase.co` est bloqué depuis l'environnement de dev : pour vérifier des
  données en prod, passer par un job GitHub Actions ponctuel (clé `SUPABASE_SERVICE_ROLE_KEY`),
  puis le retirer.

## Qualité

- Vérifier avec `npx tsc -b` (doit passer). `npm run lint` a un large historique d'erreurs
  `no-explicit-any` préexistantes — ce n'est pas un critère bloquant ; le build (`npm run build`) l'est.
