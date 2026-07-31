date: 2026-07-31
updated at: 2026-07-31
owner: mrWhite (Rickard Zakrisson)
Status: Idébank och framtidsbild. Inte beslutad arkitektur, inte roadmap och inte underlag för nuvarande scope.

ACME – framtida användningsområden och möjlig AudioLeaf-PoC
Grundidé

ACME kan på sikt användas som ett transparent, komponerbart mellanlager mellan en befintlig applikation och dess AI-providers.

AudioLeaf
  → ACME-kompatibel providerproxy
    → vald provider

Applikationen fortsätter använda samma providerprotokoll och svarskontrakt. Integrationen kan i princip begränsas till att byta API-bas-URL. Nya funktioner läggs till genom statisk komposition av domän- och adaptermoduler, utan speciallogik i ACME core och utan förändringar i AudioLeafs ordinarie pipeline.

Möjliga användningsområden

Transparent loggning och analys

En logg- eller telemetrymodul kan observera hela request- och responsekedjan och skapa strukturerad evidens kring:

provider, modell, kontrakt och uppgift
responstid, spoolup, time-to-first-token och total exekveringstid
tokenanvändning, cache reads/writes och kostnad
normaliserade felkategorier
schema- och semantikfel
retries, fallback och slutligt utfall
kvalitets- och stabilitetsmönster över tid

Detta kan flytta eller komplettera stora delar av loggning, statistik, felsökning och analytics utan att AudioLeaf behöver instrumenteras med nya hooks.

Providerabstraktion och routing

Proxykompositionen kan välja provider och modell utifrån explicit policy, capabilities och observerad evidens. På sikt kan routing väga samman:

kontrakt och domän
pris
latens
tillgänglighet
valideringsgrad
tidigare kvalitetsutfall
cachemöjligheter
providerbegränsningar

Routing ska vara ett separat policyägt lager. Provideradaptrar ska endast översätta transport, capabilities, usage och fel.

Requestnormalisering

Provider- och applikationsspecifika payloads kan översättas till och från ACME:s providerneutrala modellgräns.

AudioLeaf-request
  → canonical ACME request
    → provideranpassad request
      → providerrespons
    → NormalizedModelResponse
  → AudioLeaf-kompatibel respons

Detta gör det möjligt att byta provider utan att providerformat läcker in i AudioLeaf eller ACME core.

Payload Organizer och cacheoptimering

En framtida Payload Organizer kan deterministiskt strukturera providerpayloaden så att stabilt innehåll ligger i cachevänliga prefix och volatil information placeras senare.

Stabilt:
- systemregler
- verktygsdefinitioner
- kontrakt och schemas
- domäninstruktioner
- statisk referensdata

Volatilt:
- aktuell state
- relevant memory
- användarinput
- uppgiftsspecifika data

Möjliga funktioner:

canonicalisering och stabil sortering
deterministisk tool- och schemaordning
deduplicering av identiska instruktioner
explicita cachegränser
separerad logisk requestidentitet och providerpayload-identitet
mätning av cache write/read och faktisk kostnadsbesparing

Organizern får optimera representationen men aldrig ändra requestens logiska innebörd.

Kontraktsmedveten cache

Cacheidentitet kan baseras på mer än en rå payloadhash:

canonical input
+ kontraktsversion
+ modellval
+ relevant kontext
+ policyversion
= återanvändningsidentitet

Det möjliggör säkrare återanvändning och förhindrar att ytligt liknande men semantiskt olika anrop delar cachepost.

Felklassning och kontrollerad felhantering

ACME kan skilja mellan:

request- och konfigurationsfel
transport- och nätverksfel
providerkapacitet och providerpolicy
ambiguous calls där utfallet är okänt
modelloutput som misslyckas syntaktiskt eller semantiskt
domänfel och invariantbrott

Det ger bättre retry-, fallback- och felsökningssemantik än ett generellt “provider call failed”.

Faktagranskning och sanningsfiltrering

En Research-baserad modulkomposition kan analysera verifierbara påståenden i modellresultat:

modellresultat
→ extrahera propositioner
→ sök eller tillför evidens
→ bedöm källoberoende och motsägelser
→ allow / annotate / revise / block

Resultatet kan skilja mellan:

verifierat påstående
motsagt påstående
otillräcklig evidens
flera källor med samma ursprung
omtvistat påstående med bevarade varianter

Detta kan eftermonteras på exempelvis AudioLeafs faktaböcker utan att faktagranskningen byggs in i den befintliga bokmotorn.

Produkt- och kunskapsinjektion

Aktuell produktdata, policies eller annan kanonisk kunskap kan väljas och injiceras vid requestgränsen, utan modellträning eller globala ändringar av systemprompten.

Modulen kan äga:

vilken information som är relevant
vilken version som gäller
källa och giltighetstid
hur informationen ska presenteras för modellen
om modellresultatet motsäger kanonisk data

Domänspecifik analys

Olika AudioLeaf-anrop kan få olika kompositioner:

chapter_text
→ continuity + safety + språkgranskning

fact_book
→ propositioner + källor + faktagranskning

illustration_prompt
→ normalisering + policykontroll + provider-routing

tts
→ capabilityval + providerhälsa + cache

generic generation
→ loggning + kostnad + validering

ACME core behöver inte känna till något av detta. Betydelsen och policyn ligger i AudioLeaf-modulerna.

Möjlig AudioLeaf-PoC
Syfte

Bevisa att ACME kan införas som ett transparent providerkompatibelt mellanlager framför ett verkligt system utan att ändra AudioLeafs domänlogik.

Integration

AudioLeafs provider-URL ändras från den verkliga providern till ACME-proxyn:

Före:
AudioLeaf → OpenAI Responses API

Efter:
AudioLeaf → ACME Proxy → OpenAI Responses API

Rollback sker genom att återställa URL:en.

Föreslagen första komposition
providerkompatibelt proxy-I/O
OpenAI Responses-adapter
hash-only retention
logg- och analysmodul
strukturerad felklassning
request- och responsnormalisering
oförändrad pass-through till AudioLeaf
Fas 1: Transparent observation

Första körningen ska inte optimera eller förändra trafik.

Ingen:

modellrouting
fallback
payloadreparation
cache
faktagranskning
produktinjektion
semantisk omskrivning

Målet är:

kompatibel request in
→ verklig provider
→ kompatibel response ut

Samtidigt samlas säker, strukturerad och lagerindelad evidens.

Fas 1 bör mäta
om requestmappningen motsvarar verkligt providerformat
om streaming, headers och statuskoder bevaras korrekt
om usage och provider response ID normaliseras korrekt
om timeouts efter skickad request klassificeras som ambiguous när utfallet är okänt
om providerfel skiljs från AudioLeaf-, transport- och modellfel
om hash-only verkligen hindrar payloadpersistens
om live-replay korrekt blir unavailable
om AudioLeaf får ett semantiskt kompatibelt svar
om proxyn kan tas bort utan migration eller kvarvarande beroenden
Möjliga senare PoC-utökningar

Efter att transparent pass-through är bevisad kan funktioner aktiveras en i taget:

förbättrad diagnostik och felrapportering
requestnormalisering
deterministisk Payload Organizer
cachemätning och cacheoptimering
kontraktsmedveten cache
provider- och modellrouting
kontrollerad fallback
faktagranskning för faktaböcker
produkt- eller kunskapsinjektion
jämförande kvalitets-, kostnads- och latensanalys
Det starka plattformsbeviset

PoC:n skulle kunna demonstrera:

AudioLeafs kod och ACME core ändrades inte. Genom en ny composition root och en uppsättning AudioLeaf-moduler tillfördes central loggning, providerabstraktion, normalisering, analys och möjlighet till framtida cache, routing och faktagranskning.

Det är i praktiken en transparent men domänmedveten AI-runtime framför ett redan fungerande produktionssystem.