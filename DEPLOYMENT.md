# TRIVELA — Checklist de mise en ligne (système de paris)

Ce document garantit que, lorsque la Coupe du Monde 2026 débutera (11 juin),
les scores s'afficheront et que tous les paris seront **comptabilisés**.

Suis les étapes dans l'ordre. ✅ = à cocher avant de partager l'appli.

---

## 1. Base de données Supabase (CRITIQUE)

Le code attend des tables et fonctions qui n'étaient pas toutes dans le schéma.

- [ ] Ouvrir **Supabase → SQL Editor**
- [ ] Coller et exécuter l'intégralité de `supabase-schema.sql` (il est idempotent,
      sûr à rejouer même si une partie existe déjà)
- [ ] Vérifier que ces objets existent (Supabase → Table/Database) :
  - table `profiles` (avec colonnes `score`, `favorites`)
  - table `bets` (avec colonnes `locked`, `points`)
  - table `match_results`
  - fonction `settle_match`
  - trigger `on_auth_user_created` sur `auth.users`

### Realtime
- [ ] Supabase → **Database → Replication** : confirmer que `match_results`
      et `profiles` sont publiés (le script SQL le fait, mais vérifier dans l'UI).

> Sans cette étape, **le classement reste à 0** : c'est `settle_match` qui
> transforme les résultats en points, et le trigger qui crée les profils.

---

## 2. Secrets GitHub Actions (CRITIQUE)

Le job `auto-results.yml` tourne toutes les 5 min et a besoin de 2 secrets.

- [ ] GitHub → repo **Settings → Secrets and variables → Actions** → New secret
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → `service_role` (secret)
  - [ ] `FOOTBALL_DATA_API_KEY` — clé de https://www.football-data.org/
- [ ] (Déploiement web) Ajouter aussi, si tu veux les sortir du code :
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

> Sans ces secrets, le job échoue à chaque exécution → aucun score remonté.

---

## 3. API football-data.org (CRITIQUE)

- [ ] Confirmer que ton **plan couvre la compétition `WC` (World Cup) saison 2026**
      (le plan gratuit a une couverture/limite restreinte).
- [ ] Test manuel de la clé :
      `curl -H "X-Auth-Token: TA_CLE" "https://api.football-data.org/v4/competitions/WC/matches?season=2026"`
      → doit renvoyer la liste des matchs, pas une erreur 403/restricted.
- [ ] Vérifier que les noms d'équipes renvoyés par l'API correspondent à
      `API_TEAM_MAP` dans `scripts/update-results.mjs` (sinon : « Unknown team »
      dans les logs et match non comptabilisé).

---

## 4. Test bout-en-bout (À FAIRE AVANT LE 11 JUIN)

Simule un match terminé pour vérifier toute la chaîne :

1. [ ] Crée 2 comptes de test, place un pari sur le même match de groupe
       (ex. `gA-md1-mex-zaf`) : un score exact, un faux.
2. [ ] Dans Supabase SQL Editor, règle le match à la main :
       `select settle_match('gA-md1-mex-zaf', 2, 0);`
3. [ ] Vérifie :
   - [ ] page **Paris** : le match affiche `FT 2–0` et les points (+5 / 0)
   - [ ] page **Classement** : les scores se mettent à jour en direct
   - [ ] table `match_results` : 1 ligne ; table `bets` : `locked = true`, `points` rempli
4. [ ] Nettoyage du test :
       `delete from match_results where match_id='gA-md1-mex-zaf';`
       puis remets les `profiles.score` et `bets` de test à zéro (ou supprime les comptes test).

> Refaire `settle_match` sur le même match ne recompte pas (idempotent) :
> pour re-tester, supprime d'abord la ligne dans `match_results`.

---

## 5. Phase à élimination directe (APRÈS la phase de groupes)

⚠️ Aujourd'hui les matchs `r32`→`final` ont des équipes **TBD** : on ne peut
pas parier dessus et le job **ignore** les matchs à élimination directe.

Quand les qualifiés sont connus :
- [ ] Mettre à jour `KNOCKOUT_MATCHES` dans `src/data/wc2026Matches.ts`
      (vraies équipes + dates/heures/stades)
- [ ] Ajouter les correspondances correspondantes dans `MATCH_LOOKUP`
      (`scripts/update-results.mjs`) au format `'HOME-AWAY': 'match-id'`
- [ ] Commit + push (déclenche le redéploiement)

---

## 6. Sécurité (déjà couvert / bon à savoir)

- ✅ Les scores ne peuvent pas être falsifiés par les joueurs : seule la clé
  `service_role` (job GitHub) écrit dans `match_results`, et la RLS bloque
  l'écriture côté client.
- ✅ Un pari verrouillé (`locked = true`) ne peut plus être modifié (policy RLS).
- ⚠️ Le verrou « 1h30 avant le coup d'envoi » est appliqué **côté navigateur**.
  Un utilisateur technique pourrait écrire un pari via l'API juste avant le match.
  Pour des amis, le risque est faible. Renforcement possible (verrou serveur basé
  sur l'heure de coup d'envoi) si besoin — me le demander.

---

## 7. Sauvegardes & filet manuel (important avec de l'argent)

### Sauvegarde de la base
- Workflow **« Backup database »** : exporte `profiles`, `bets`, `match_results`
  toutes les 6 h dans un **artifact privé** (Actions → run → Artifacts,
  conservé 90 jours). Jamais commité (dépôt public → données joueurs protégées).
- Déclencher à la demande : Actions → « Backup database » → Run workflow.
- **Restaurer** : télécharger l'artifact, dézipper dans `db-backup/`, puis
  `MODE=restore SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-db.mjs`
  (réinjecte en upsert). Note : restaurer `profiles` suppose que les comptes
  `auth.users` existent encore (gérés/sauvegardés par Supabase séparément).
- Supabase fait aussi ses propres sauvegardes quotidiennes (selon le plan).

### Source de scores
- Source unique : **football-data.org (plan payant)** → données live, fiables,
  sans limite de requêtes. Le robot tourne toute la journée pendant le Mondial.
- Pas de 2e source automatique (choix assumé) : le filet manuel ci-dessous
  couvre les cas rares où l'API se tromperait ou serait indisponible.

### Filet manuel (toujours disponible)
Si l'API principale échoue ou se trompe, règle un match à la main dans
Supabase → SQL Editor :
```sql
select settle_match('gA-md1-mex-zaf', 2, 0);  -- (match_id, score domicile, score extérieur)
```
- Voir les matchs déjà réglés : `select * from match_results order by settled_at desc;`
- Pour **corriger** un score déjà réglé (settle_match est idempotent et ne
  recompte pas) : il faut annuler manuellement (supprimer la ligne
  `match_results` + ajuster les points concernés). Me demander la procédure.

### Vérifier la fiabilité de la source avant le tournoi
- Workflow **« Validate data source »** : relancer la veille du 11 juin pour
  confirmer que les 72 matchs sont correctement mappés (noms d'équipes,
  orientation domicile/extérieur).

---

## Résumé : ça marchera si…

1. `supabase-schema.sql` a été exécuté ✅
2. Les 2 secrets GitHub sont en place ✅
3. La clé football-data.org couvre bien la WC 2026 ✅
4. Le test bout-en-bout (section 4) passe ✅

Les sections 1 à 4 suffisent pour la **phase de groupes**. La section 5 sera à
faire en cours de tournoi pour les **éliminatoires**.
