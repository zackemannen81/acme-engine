# Installationsguide — självständig körning av POC #1

Guiden startar **V2 Evidence Workbench** på loopback så att du kan
prova den. Den driftsätter ingenting mot internet och den auktoriserar
inte riktiga ärendedata.

Servern binder till `127.0.0.1`. Ingenting här är en publik tjänst.

## 1. Förutsättningar

| Krav | Version / anmärkning |
| --- | --- |
| Node.js | `>=24.0.0 <25` |
| pnpm | `10.34.5` (se `packageManager` i repots rot) |
| PostgreSQL | Sessionskoppling. **Inte** Supavisors transaction pooler på port `6543`. |
| Objektlager | Lokal katalog **eller** S3-kompatibel lagring (self-hosted Supabase Storage) |
| Live-modell | Valfritt. Utan den fungerar import och granskning; Extract / Compare svarar 501. |

På Windows räcker PowerShell. Kommandon visas för både PowerShell och
POSIX-skal där de skiljer sig.

Aktivera pnpm vid behov:

```powershell
corepack enable
corepack prepare pnpm@10.34.5 --activate
```

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
```

## 2. Bygg

Från repositoryts rot:

```powershell
pnpm install
pnpm build
```

`pnpm build` kompilerar workspace, inklusive
`apps/evidence-workbench-v2-api`. Gränssnittet är serverrenderad HTML
från den processen — det finns ingen separat frontend-server.

Valfri hermetisk kontroll (ingen PostgreSQL, ingen leverantör):

```powershell
pnpm test
```

## 3. Hemligheter

Nycklar är monterade filer. Produkten **vägrar starta** om de saknas,
och den **genererar aldrig** en nyckel åt dig. En genererad nyckel
skulle tyst göra gårdagens krypterade objekt oläsbara.

Skapa katalogen **utanför versionskontroll** (`.local/` är konventionen
från den registrerade körningen):

```powershell
New-Item -ItemType Directory -Force .local/v2/secrets | Out-Null
node -e "const {randomBytes}=require('node:crypto'); const fs=require('node:fs'); for (const n of ['artifact-kek','session-key','ledger-payload-key']) fs.writeFileSync('.local/v2/secrets/'+n+'.b64', randomBytes(32).toString('base64'))"
```

```bash
mkdir -p .local/v2/secrets
node -e "const {randomBytes}=require('node:crypto'); const fs=require('node:fs'); for (const n of ['artifact-kek','session-key','ledger-payload-key']) fs.writeFileSync('.local/v2/secrets/'+n+'.b64', randomBytes(32).toString('base64'))"
```

Tre filer, var och en en base64-kodad 32-bytesnyckel:

| Fil | Används till |
| --- | --- |
| `artifact-kek.b64` | Kryptering av lagrade källobjekt |
| `session-key.b64` | Sessionspayload |
| `ledger-payload-key.b64` | Sparade modellrequest/svar (bara om live är konfigurerat) |

Behåll dem. Att regenerera dem mot en befintlig databas gör lagrade
objekt oläsbara.

## 4. Utvecklingskonton

Skapa en JSON-fil, också utanför repositoryt, till exempel
`.local/v2/accounts.json`. Minst en `organization-admin`:

```json
[
  {
    "email": "operator@example.invalid",
    "password": "choose-a-local-password",
    "subject": "operator",
    "displayLabel": "Local operator",
    "organizationRole": "organization-admin"
  },
  {
    "email": "second@example.invalid",
    "password": "another-local-password",
    "subject": "second",
    "displayLabel": "Second principal",
    "organizationRole": "reviewer"
  }
]
```

Roller: `organization-admin`, `reviewer`, `viewer`. Det här är en
utvecklingsautentiserare, inte Supabase Auth.

## 5. Välj objektlager

### Väg A — fillager (enklast att själv köra)

Ingen S3, inget bucket-skript. Krypterade objekt hamnar i en lokal
katalog.

```powershell
New-Item -ItemType Directory -Force .local/v2/objects | Out-Null
```

PostgreSQL behövs ändå. En lokal `postgres` på port `5432` räcker.
Peka **inte** `ACME_V2_POSTGRES_URL` mot port `6543`.

### Väg B — self-hosted Supabase Storage (registrerad drift)

Använd session poolern på port `5432` (eller en direkt Postgres-URL),
aldrig transaction poolern på `6543`.

S3-endpointens värd måste stavas **exakt** som `STORAGE_PUBLIC_URL`
stavar den (ofta `localhost`, inte `127.0.0.1`), annars faller
signaturerna. Provisionera den privata bucketen en gång:

```powershell
node --env-file=.env.v2.local tooling/supabase/provision-v2-bucket.mjs
```

Detaljer: [ops/evidence-v2-supabase.md](../ops/evidence-v2-supabase.md).

## 6. Miljöfil

Skapa `.env.v2.local` i repositoryts rot. **Checka inte in den.**

### Exempel väg A

```text
ACME_V2_POSTGRES_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/postgres
ACME_V2_SCHEMA=evidence_v2
ACME_V2_IDENTITY_SCHEMA=evidence_v2_identity
ACME_V2_PORT=8795
ACME_V2_OBJECT_STORE=file
ACME_V2_OBJECT_ROOT=.local/v2/objects
ACME_V2_KEK_FILE=.local/v2/secrets/artifact-kek.b64
ACME_V2_SESSION_KEY_FILE=.local/v2/secrets/session-key.b64
ACME_V2_ACCOUNTS_FILE=.local/v2/accounts.json
ACME_V2_ORGANIZATION_LABEL=ACME V2
```

Uteslut `ACME_V2_LIVE_MODEL` tills du vill extrahera.

### Tillägg väg B

```text
ACME_V2_OBJECT_STORE=s3
ACME_V2_S3_ENDPOINT=http://localhost:8000/storage/v1/s3
ACME_V2_S3_REGION=us-east-1
ACME_V2_S3_BUCKET=evidence-v2-artifacts
ACME_V2_S3_ACCESS_KEY_ID=...
ACME_V2_S3_SECRET_ACCESS_KEY_FILE=.local/v2/secrets/s3-secret.txt
```

### Live-modell (valfritt)

Båda vägarna. Fail-closed: modellnamn utan nyckel är en vägran.

```text
ACME_V2_LIVE_MODEL=gpt-5
ACME_V2_LEDGER_SCHEMA=acme_v2_ledger
ACME_V2_LEDGER_PAYLOAD_KEY_FILE=.local/v2/secrets/ledger-payload-key.b64
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` är endast miljö. Lägg den aldrig i repositoryt.

`.env.local` kan redan finnas för andra ACME-grindar. Startkommandot
nedan läser den om den finns; den krävs inte för en fillagerkörning.

## 7. Start

```powershell
node --env-file=.env.local --env-file=.env.v2.local apps/evidence-workbench-v2-api/dist/start.js
```

Utan `.env.local`:

```powershell
node --env-file=.env.v2.local apps/evidence-workbench-v2-api/dist/start.js
```

Migreringar körs vid start. En innehållsfri sammanfattning är framgång:

```text
evidence-workbench-v2-api listening
  url            http://127.0.0.1:8795
  schema         evidence_v2
  identity       evidence_v2_identity
  objects        file .local/v2/objects
  live model     none (extraction answers 501)
```

Med live konfigurerat namnger sista raden modellen i stället.

Kontroll:

```powershell
Invoke-RestMethod http://127.0.0.1:8795/health
```

Förväntat: `{ "status": "ok", "service": "evidence-workbench-v2-api" }`.

Öppna `http://127.0.0.1:8795` och logga in med ett konto från
JSON-filen. Fortsätt i [användarmanualen](user-manual.md).

## 8. Vad som fungerar i vilken konfiguration

| Åtgärd | Ingen live-modell | Live-modell konfigurerad |
| --- | --- | --- |
| Logga in, skapa ärende | Ja | Ja |
| Importera text eller PDF | Ja | Ja |
| Bläddra delar, kedjor, instanser | Ja | Ja |
| Granskarskriven förekomst | Ja | Ja |
| Accept / reject / revise | Ja | Ja |
| Påståenden och relationer (mänskliga) | Ja | Ja |
| Tidslinje och konsensus | Ja | Ja |
| **Extract observations** (J3) | 501 | Spenderar det angivna antalet |
| **Compare with earlier instances** (J4) | 501 | Spenderar det angivna antalet |

## 9. Vanliga vägran

| Symptom | Orsak |
| --- | --- |
| Startfel: `ACME_V2_POSTGRES_URL` / saknad `*_FILE` | Ofullständig miljö |
| Startfel som nämner port `6543` | Transaction pooler. Använd `5432` eller en direkt URL |
| `SignatureDoesNotMatch` mot S3 | Endpoint-värd ≠ `STORAGE_PUBLIC_URL` |
| Extract / Compare säger att live saknas | `ACME_V2_LIVE_MODEL` eller `OPENAI_API_KEY` saknas |
| Andra kontot får 404 på ditt ärende | Avsiktligt. Medlemskap, inte en saknad sida |
| Krypterade objekt oläsbara efter omstart | KEK-filen byttes ut |

## 10. Stopp och data

Stoppa processen (`Ctrl+C`). PostgreSQL och objektkatalogen behåller
ärendet. Säkerhetskopior är värdelösa utan de tre nyckelfilerna.

Exponera inte port `8795`. Kompositionen är loopback avsiktligt.
