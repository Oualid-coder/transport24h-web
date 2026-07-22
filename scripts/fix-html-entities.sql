-- Nettoyage ponctuel des entités HTML dans les adresses stockées en base.
--
-- Contexte : Nominatim encodait certains caractères dans display_name
-- (&#39; pour l'apostrophe, &amp; pour &, etc.). L'API frontend ne décodait
-- pas ces entités avant de les envoyer au backend, qui les a stockées telles
-- quelles. Ce script corrige les données existantes.
--
-- À exécuter une seule fois, après déploiement du fix frontend.
-- Testé sur PostgreSQL. Adaptez les noms de colonnes si nécessaire.
--
-- IMPORTANT : &amp; doit être décodé EN DERNIER pour ne pas transformer
-- &amp;lt; en < (double-encodage). L'ordre des REPLACE est intentionnel.

BEGIN;

-- ── Table bookings ────────────────────────────────────────────────────────────

UPDATE bookings
SET pickup_address = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    pickup_address,
    '&#39;',  ''''),
    '&apos;', ''''),
    '&quot;', '"'),
    '&lt;',   '<'),
    '&gt;',   '>'),
    '&amp;',  '&')
WHERE pickup_address ~ '&#39;|&apos;|&quot;|&lt;|&gt;|&amp;';

UPDATE bookings
SET delivery_address = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    delivery_address,
    '&#39;',  ''''),
    '&apos;', ''''),
    '&quot;', '"'),
    '&lt;',   '<'),
    '&gt;',   '>'),
    '&amp;',  '&')
WHERE delivery_address ~ '&#39;|&apos;|&quot;|&lt;|&gt;|&amp;';

-- ── Table quotes (source des adresses, dénormalisées dans bookings) ───────────

UPDATE quotes
SET pickup_address = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    pickup_address,
    '&#39;',  ''''),
    '&apos;', ''''),
    '&quot;', '"'),
    '&lt;',   '<'),
    '&gt;',   '>'),
    '&amp;',  '&')
WHERE pickup_address ~ '&#39;|&apos;|&quot;|&lt;|&gt;|&amp;';

UPDATE quotes
SET delivery_address = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    delivery_address,
    '&#39;',  ''''),
    '&apos;', ''''),
    '&quot;', '"'),
    '&lt;',   '<'),
    '&gt;',   '>'),
    '&amp;',  '&')
WHERE delivery_address ~ '&#39;|&apos;|&quot;|&lt;|&gt;|&amp;';

COMMIT;
