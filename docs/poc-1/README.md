# POC #1 — Evidence Integrity Workbench

Status: Koden är fryst. Det här paketet är ingången för den som ska
sätta upp, använda eller förstå applikationen.

POC #1 är en avgränsad granskningsprodukt: den gör en källa till en
spårbar liggare över vad källan säger, hur utsagor står mot varandra,
och vad granskat material just nu stöder, bestrider, villkorar eller
lämnar olöst.

Den avgör **inte** om någon är trovärdig, skyldig eller rättsligt
ansvarig. Den avgör inte tillåtlighet eller rättslig tillräcklighet.
Den är inte SKL, NFC eller ett ärendehanteringssystem.

## Börja här

| Dokument | För |
| --- | --- |
| [Installationsguide](setup-guide.md) | Sätta upp och starta en självständig testkörning |
| [Användarmanual](user-manual.md) | Arbeta ett ärende i webbläsaren |
| [Teknisk översikt](technical-overview.md) | Syfte, arkitektur och flöden |

Intern auktoritet — behövs inte för att prova produkten:

- [Produktdefinition](../design/evidence-integrity-workbench-product-definition.md)
- [V2-domänspecifikation](../design/evidence-workbench-v2-domain-specification.md)
- [Supabase-körbok](../ops/evidence-v2-supabase.md)
- [SYSTEMDOC](../SYSTEMDOC.md)

## Vad som är fryst

Den levererade V2-arbetsbänken under `apps/evidence-workbench-v2-*`:

- ärende, import (text och PDF), källdelar, kedjor och instanser
- live-observation (J3) och live-jämförelse (J4), när en modell är konfigurerad
- granskning och ställning, påståenden, relationer
- tidslinje och konsensus som rena läsprojektioner
- loopback-HTTP, utvecklingskonton, PostgreSQL, krypterade artefakter

Den tidigare V1-arbetsbänken under `apps/evidence-workbench-*` är en
fryst diagnostisk referens. Använd den inte som produkten.

## Vad en självständig körning kan visa

Utan live-modell: import, struktur, kedjor, granskarskrivna
förekomster, ställning, påståenden, relationer, tidslinje och
konsensus.

Med live-modell: samma sak, plus avgränsad extraktion och jämförelse
som bara spenderar det antal anrop sidan anger.

## Permanenta undantag

Trovärdighet, skuld, rättslig slutsats, poäng, diagram, genererade
rapporter, Stage B-material och varje dataklass som inte är uttryckligen
auktoriserad. Stage A anonymiserad juridisk text och klassen
`stage-a-pdf-extracted-text/1` är de enda icke-syntetiska importvägarna.

Kontrollnamn i manualen är de engelska strängar produkten visar.
