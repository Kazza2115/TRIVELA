-- TRIVELA — Bonus « qualifié » des matchs à élimination directe.
-- À COLLER UNE SEULE FOIS dans Supabase → SQL Editor → Run. Idempotent.
--
-- Ajoute au pari l'équipe que le joueur pense voir se QUALIFIER. Pour un prono à
-- vainqueur (non-nul) le qualifié est implicite (= le vainqueur) ; ce champ ne sert
-- donc qu'aux PRONOS NULS sur un match KO (qui passe aux tirs au but).
--
-- Le vrai qualifié, lui, est déduit automatiquement du bracket (knockout_teams) :
-- l'équipe de l'affiche qui figure au tour suivant. Aucune autre colonne nécessaire.
--
-- Barème KO = barème normal (+5/+4/+3) + bonus +2 si le bon qualifié est trouvé
-- (tirs au but inclus). Calculé côté serveur par reconcileScores.

alter table public.bets add column if not exists qualifier_short text;
