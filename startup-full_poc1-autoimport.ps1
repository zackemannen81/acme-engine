[CmdletBinding()]
param(
    [string]$RepoRoot = $PSScriptRoot,
    [string]$D1Pdf = "$env:USERPROFILE\Downloads\Anonymiserad_d1.pdf",
    [string]$D2Pdf = "$env:USERPROFILE\Downloads\Anonymiserad_d2.pdf",
    [string]$Model = "gpt-5.6-luna",
    [int]$WorkbenchPort = 8790,
    [string]$PostgresDatabase = "acme",
    [string]$Bucket = "evidence-private",
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$AutoImport,
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Local-only POC #1 launcher
#
# Starts:
#   - PostgreSQL 15
#   - MinIO + evidence-private bucket
#   - persistent local development keys
#   - Stage A PDF -> canonical UTF-8 preparation
#   - Evidence Workbench with:
#       PostgreSQL + S3 + live OpenAI adapter + Stage A capability
#   - optional -AutoImport:
#       create/reuse one Stage A case and import D1 + D2 through the real API
#
# The provider credential is never handled by this script when .env.local
# supplies it: the workbench process reads that file itself through Node's
# --env-file-if-exists. The interactive prompt is only a fallback.
#
# It DOES NOT:
#   - commit source documents or secrets
#   - import PDFs directly into ACME
#   - auto-submit provider/model calls
#   - configure a production/hosted authentication deployment
# ---------------------------------------------------------------------------

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "    $Message" -ForegroundColor Green
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Test-ContainerExists([string]$Name) {
    $value = docker ps -a --filter "name=^/$Name$" --format "{{.Names}}"
    return ($LASTEXITCODE -eq 0 -and ($value -join "").Trim() -eq $Name)
}

function Test-ContainerRunning([string]$Name) {
    $value = docker ps --filter "name=^/$Name$" --format "{{.Names}}"
    return ($LASTEXITCODE -eq 0 -and ($value -join "").Trim() -eq $Name)
}

function Wait-Postgres {
    param([int]$TimeoutSeconds = 60)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        docker exec acme-ew-postgres pg_isready -U acme -d acme *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds 1
    }
    throw "PostgreSQL did not become ready within $TimeoutSeconds seconds."
}

function Wait-Http {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return
            }
        }
        catch {
            # Service is still starting.
        }
        Start-Sleep -Seconds 1
    }
    throw "$Url did not become ready within $TimeoutSeconds seconds."
}

function New-Base64KeyFileIfMissing {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (Test-Path -LiteralPath $Path) {
        return
    }

    [byte[]]$bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }

    [Convert]::ToBase64String($bytes) |
        Set-Content -LiteralPath $Path -Encoding ascii -NoNewline
}

function Test-EnvFileHasOpenAiKey([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*OPENAI_API_KEY\s*=\s*\S') {
            return $true
        }
    }

    return $false
}

function Read-OpenAiKeyIfNeeded([string]$EnvFile) {
    if ($env:OPENAI_API_KEY -and $env:OPENAI_API_KEY.Trim().Length -gt 0) {
        Write-Ok "OPENAI_API_KEY already exists in this process environment."
        return
    }

    if (Test-EnvFileHasOpenAiKey -Path $EnvFile) {
        Write-Ok "OPENAI_API_KEY will be read from .env.local by the workbench process."
        return
    }

    Write-Host ""
    Write-Host "OPENAI_API_KEY is not set." -ForegroundColor Yellow
    Write-Host "Enter it once for this process. It will not be written to disk by this script."
    $secure = Read-Host "OPENAI_API_KEY" -AsSecureString

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        if ([string]::IsNullOrWhiteSpace($plain)) {
            throw "OPENAI_API_KEY cannot be empty."
        }
        $env:OPENAI_API_KEY = $plain
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "ACME Evidence Integrity Workbench - FULL POC #1 startup" -ForegroundColor Magenta
Write-Host "Local diagnostic/demo environment only." -ForegroundColor DarkGray

Require-Command git
Require-Command docker
Require-Command corepack
Require-Command node
Require-Command py

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "package.json"))) {
    throw "RepoRoot does not look like the ACME repository: $RepoRoot"
}

if (-not (Test-Path -LiteralPath $D1Pdf)) {
    throw "D1 PDF not found: $D1Pdf"
}
if (-not (Test-Path -LiteralPath $D2Pdf)) {
    throw "D2 PDF not found: $D2Pdf"
}

$D1Pdf = (Resolve-Path -LiteralPath $D1Pdf).Path
$D2Pdf = (Resolve-Path -LiteralPath $D2Pdf).Path

Set-Location -LiteralPath $RepoRoot

# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------

Write-Step "Repository / branch"

$currentBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read current Git branch."
}

if ($currentBranch -ne "dev/legal-evidence") {
    Invoke-Native {
        git switch dev/legal-evidence
    } "git switch dev/legal-evidence"
}
Write-Ok "Using dev/legal-evidence."

if (-not $SkipInstall) {
    Write-Step "Installing workspace dependencies"
    Invoke-Native {
        corepack pnpm install --frozen-lockfile
    } "pnpm install"
}
else {
    Write-Ok "Dependency installation skipped."
}

if (-not $SkipBuild) {
    Write-Step "Building monorepo"
    Invoke-Native {
        corepack pnpm build
    } "pnpm build"
}
else {
    Write-Ok "Build skipped."
}

# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------

Write-Step "PostgreSQL 15"

if (-not (Test-ContainerExists "acme-ew-postgres")) {
    Invoke-Native {
        docker run -d `
            --name acme-ew-postgres `
            -e POSTGRES_USER=acme `
            -e POSTGRES_PASSWORD=acme `
            -e POSTGRES_DB=acme `
            -p 55432:5432 `
            -v acme-ew-postgres-data:/var/lib/postgresql/data `
            postgres:15
    } "Create PostgreSQL container"
}
elseif (-not (Test-ContainerRunning "acme-ew-postgres")) {
    Invoke-Native {
        docker start acme-ew-postgres
    } "Start PostgreSQL container"
}

Wait-Postgres
if ($PostgresDatabase -ne "acme") {
    $exists = docker exec acme-ew-postgres psql -U acme -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$PostgresDatabase'"
    if (($exists | Out-String).Trim() -ne "1") {
        Invoke-Native {
            docker exec acme-ew-postgres psql -U acme -d postgres -c "CREATE DATABASE `"$PostgresDatabase`" OWNER acme"
        } "Create PostgreSQL database $PostgresDatabase"
    }
}
Write-Ok "PostgreSQL ready on 127.0.0.1:55432 database $PostgresDatabase."

# ---------------------------------------------------------------------------
# MinIO
# ---------------------------------------------------------------------------

Write-Step "MinIO encrypted-object backing store"

if (-not (Test-ContainerExists "acme-ew-minio")) {
    Invoke-Native {
        docker run -d `
            --name acme-ew-minio `
            -p 9000:9000 `
            -p 9001:9001 `
            -e MINIO_ROOT_USER=acmeadmin `
            -e MINIO_ROOT_PASSWORD=acme-evidence-dev-secret `
            -v acme-ew-minio-data:/data `
            quay.io/minio/minio server /data --console-address ":9001"
    } "Create MinIO container"
}
elseif (-not (Test-ContainerRunning "acme-ew-minio")) {
    Invoke-Native {
        docker start acme-ew-minio
    } "Start MinIO container"
}

Wait-Http -Url "http://127.0.0.1:9000/minio/health/live" -TimeoutSeconds 60
Write-Ok "MinIO ready on 127.0.0.1:9000."

Write-Step "Ensuring MinIO bucket $Bucket exists"
Invoke-Native {
    docker run --rm `
        --entrypoint /bin/sh `
        minio/mc `
        -c "mc alias set local http://host.docker.internal:9000 acmeadmin acme-evidence-dev-secret >/dev/null && mc mb --ignore-existing local/$Bucket"
} "Create/verify MinIO bucket $Bucket"
Write-Ok "Bucket $Bucket ready."

# ---------------------------------------------------------------------------
# Local secrets
# ---------------------------------------------------------------------------

Write-Step "Local POC key material"

$LocalRoot = Join-Path $RepoRoot ".local\poc1"
$SecretDir = Join-Path $LocalRoot "secrets"
$LogDir = Join-Path $LocalRoot "logs"
New-Item -ItemType Directory -Force -Path $SecretDir, $LogDir | Out-Null

$S3SecretFile = Join-Path $SecretDir "s3-secret.txt"
$ArtifactKekFile = Join-Path $SecretDir "artifact-kek.b64"
$PayloadKeyFile = Join-Path $SecretDir "payload-key.b64"

if (-not (Test-Path -LiteralPath $S3SecretFile)) {
    "acme-evidence-dev-secret" |
        Set-Content -LiteralPath $S3SecretFile -Encoding ascii -NoNewline
}

New-Base64KeyFileIfMissing -Path $ArtifactKekFile
New-Base64KeyFileIfMissing -Path $PayloadKeyFile

Write-Ok "Persistent local artifact/payload keys ready beneath .local\poc1\secrets."

# ---------------------------------------------------------------------------
# Stage A source preparation
# ---------------------------------------------------------------------------

Write-Step "Stage A PDF -> canonical UTF-8 preparation"

$pypdfVersion = ""
try {
    $pypdfVersion = (& py -c "import importlib.metadata as m; print(m.version('pypdf'))" 2>$null).Trim()
}
catch {
    $pypdfVersion = ""
}

if ($pypdfVersion -ne "6.10.0") {
    Invoke-Native {
        py -m pip install --disable-pip-version-check "pypdf==6.10.0"
    } "Install pypdf 6.10.0"
}

$StageAOutputDir = Join-Path $env:LOCALAPPDATA "Temp\acme-stage-a"
New-Item -ItemType Directory -Force -Path $StageAOutputDir | Out-Null

$env:ACME_STAGE_A_D1 = $D1Pdf
$env:ACME_STAGE_A_D2 = $D2Pdf
$env:ACME_STAGE_A_D1_ACQUIRED_AT = (Get-Item -LiteralPath $D1Pdf).CreationTimeUtc.ToString("o")
$env:ACME_STAGE_A_D2_ACQUIRED_AT = (Get-Item -LiteralPath $D2Pdf).CreationTimeUtc.ToString("o")
$env:ACME_STAGE_A_OUTPUT = $StageAOutputDir

$python = @'
import json
import os
import unicodedata

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from pypdf import PdfReader


sources = [
    (
        "D1",
        Path(os.environ["ACME_STAGE_A_D1"]),
        os.environ["ACME_STAGE_A_D1_ACQUIRED_AT"],
    ),
    (
        "D2",
        Path(os.environ["ACME_STAGE_A_D2"]),
        os.environ["ACME_STAGE_A_D2_ACQUIRED_AT"],
    ),
]

outdir = Path(os.environ["ACME_STAGE_A_OUTPUT"])
outdir.mkdir(parents=True, exist_ok=True)


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


for label, src, acquired_at in sources:
    pdf_bytes = src.read_bytes()
    reader = PdfReader(str(src))

    pages = []
    for page_number, page in enumerate(reader.pages, start=1):
        value = page.extract_text() or ""
        if not value.strip():
            raise RuntimeError(
                f"{label}: page {page_number} extracted as empty."
            )
        pages.append(value)

    text = "\n".join(pages)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = unicodedata.normalize("NFC", text)

    if "\x00" in text:
        raise RuntimeError(f"{label}: canonical text contains NUL.")
    if "\ufffd" in text:
        raise RuntimeError(
            f"{label}: canonical text contains Unicode replacement characters."
        )

    canonical = text.encode("utf-8")
    parent_sha = digest(pdf_bytes)
    canonical_sha = digest(canonical)
    prepared_at = datetime.now(timezone.utc).isoformat()

    txt = outdir / f"{src.stem}.txt"
    meta = outdir / f"{src.stem}.metadata.json"

    txt.write_bytes(canonical)

    metadata = {
        "label": label,
        "title": src.stem,
        "sourcePdf": str(src),
        "preparedText": str(txt),
        "sourceKind": "judicial-document",
        "dataClass": "stage-a-anonymized-judicial-text/1",
        "suggestedExternalSourceRef": f"sha256:{parent_sha}",
        "acquiredAt": acquired_at,
        "parentContainer": {
            "kind": "pdf",
            "sha256": parent_sha,
            "byteLength": len(pdf_bytes),
            "pageCount": len(reader.pages),
        },
        "canonicalText": {
            "sha256": canonical_sha,
            "byteLength": len(canonical),
            "encoding": "utf-8",
            "unicodeNormalization": "NFC",
            "lineEndings": "LF",
        },
        "extraction": {
            "method": "pypdf-text-extraction",
            "version": "6.10.0",
            "extractedAt": prepared_at,
        },
    }

    meta.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("")
    print(f"{label}: {src.name}")
    print(f"  TEXT          : {txt}")
    print(f"  METADATA      : {meta}")
    print(f"  ACQUIRED AT   : {acquired_at}")
    print(f"  PDF SHA256    : {parent_sha}")
    print(f"  PDF BYTES     : {len(pdf_bytes)}")
    print(f"  PAGES         : {len(reader.pages)}")
    print(f"  TEXT SHA256   : {canonical_sha}")
    print(f"  TEXT BYTES    : {len(canonical)}")
    print(f"  EXTRACTED AT  : {prepared_at}")
'@

$python | py -
if ($LASTEXITCODE -ne 0) {
    throw "Stage A source preparation failed."
}

Remove-Item Env:\ACME_STAGE_A_D1 -ErrorAction SilentlyContinue
Remove-Item Env:\ACME_STAGE_A_D2 -ErrorAction SilentlyContinue
Remove-Item Env:\ACME_STAGE_A_D1_ACQUIRED_AT -ErrorAction SilentlyContinue
Remove-Item Env:\ACME_STAGE_A_D2_ACQUIRED_AT -ErrorAction SilentlyContinue
Remove-Item Env:\ACME_STAGE_A_OUTPUT -ErrorAction SilentlyContinue

Write-Ok "Stage A prepared files ready at $StageAOutputDir."

# ---------------------------------------------------------------------------
# Live composition environment
# ---------------------------------------------------------------------------

Write-Step "Configuring Evidence Workbench live POC #1 composition"

$env:EVIDENCE_WORKBENCH_PORT = "$WorkbenchPort"
$env:EVIDENCE_WORKBENCH_SEED = "none"
$env:EVIDENCE_AUTH_MODE = "development"

$env:ACME_PERSISTENCE = "postgres"
$env:ACME_POSTGRES_URL = "postgresql://acme:acme@127.0.0.1:55432/$PostgresDatabase"

$env:ACME_HOSTED = "1"

$env:ACME_ARTIFACT_STORE = "s3"
$env:ACME_ARTIFACT_S3_ENDPOINT = "http://127.0.0.1:9000"
$env:ACME_ARTIFACT_S3_REGION = "us-east-1"
$env:ACME_ARTIFACT_S3_BUCKET = $Bucket
$env:ACME_ARTIFACT_S3_ACCESS_KEY_ID = "acmeadmin"
$env:ACME_ARTIFACT_S3_SECRET_FILE = $S3SecretFile

$env:ACME_ARTIFACT_KEK_FILE = $ArtifactKekFile
$env:ACME_ARTIFACT_KEK_ID = "evidence-kek"
$env:ACME_ARTIFACT_KEK_VERSION = "1"

$env:ACME_EVIDENCE_LIVE = "1"
$env:ACME_EVIDENCE_COMPOSITION_PROFILE = "evidence-poc1-live/1"
$env:ACME_EVIDENCE_LIVE_MODEL = $Model

$env:ACME_EVIDENCE_PAYLOAD_KEY_FILE = $PayloadKeyFile
$env:ACME_EVIDENCE_PAYLOAD_KEY_ID = "evidence-poc1-payload-1"

# Emergency hard ceiling only. The reviewer confirmation shows the planner's
# exact bounded call count for the selected part; this stops a real loop or
# regression, not a run the planner already sized.
$env:ACME_EVIDENCE_LIVE_MAX_MODEL_CALLS = "20"
$env:ACME_EVIDENCE_LIVE_COST_CEILING_MINOR = "19998"
$env:ACME_EVIDENCE_LIVE_CURRENCY = "SEK"

$EnvFile = Join-Path $RepoRoot ".env.local"
Read-OpenAiKeyIfNeeded -EnvFile $EnvFile

Write-Ok "Live tuple configured for PostgreSQL + S3 + $Model."

# ---------------------------------------------------------------------------
# Start Workbench
# ---------------------------------------------------------------------------

Write-Step "Starting Evidence Integrity Workbench"

$WorkbenchUrl = "http://127.0.0.1:$WorkbenchPort/"
$HealthUrl = "${WorkbenchUrl}health"

try {
    $existing = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    if ($existing.StatusCode -eq 200) {
        Write-Host ""
        Write-Host "A Workbench is already answering on $WorkbenchUrl" -ForegroundColor Yellow
        Write-Host "This script will not kill an unknown existing process."
        Write-Host "Stop it first if you need the freshly configured live environment."
        Write-Host "The old process keeps the environment and build it started with."

        $RecordedPidFile = Join-Path $LocalRoot "workbench.pid"
        if (Test-Path -LiteralPath $RecordedPidFile) {
            $recorded = (Get-Content -LiteralPath $RecordedPidFile -Raw).Trim()
            Write-Host "Last recorded workbench PID: $recorded (Stop-Process -Id $recorded)"
        }

        exit 0
    }
}
catch {
    # Expected when nothing is listening.
}

$StdoutLog = Join-Path $LogDir "workbench.stdout.log"
$StderrLog = Join-Path $LogDir "workbench.stderr.log"
$PidFile = Join-Path $LocalRoot "workbench.pid"

Remove-Item -LiteralPath $StdoutLog, $StderrLog -Force -ErrorAction SilentlyContinue

$WorkbenchEntryPoint = "apps/evidence-workbench-api/dist/local-main.js"
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $WorkbenchEntryPoint))) {
    throw "Built workbench entry point is missing: $WorkbenchEntryPoint. Run without -SkipBuild."
}

# Start node directly rather than through cmd.exe/corepack/pnpm: the recorded
# PID must be the process that owns the port, and --env-file-if-exists lets the
# workbench read OPENAI_API_KEY from .env.local without this script touching it.
$process = Start-Process `
    -FilePath "node" `
    -ArgumentList @(
        "--env-file-if-exists=.env.local",
        $WorkbenchEntryPoint
    ) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

"$($process.Id)" |
    Set-Content -LiteralPath $PidFile -Encoding ascii -NoNewline

$deadline = (Get-Date).AddSeconds(90)
$ready = $false
while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
        break
    }
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    }
    catch {
        # Keep waiting.
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host ""
    Write-Host "Workbench failed to become ready." -ForegroundColor Red

    if (Test-Path -LiteralPath $StderrLog) {
        Write-Host ""
        Write-Host "--- stderr tail ---" -ForegroundColor Yellow
        Get-Content -LiteralPath $StderrLog -Tail 60
    }
    if (Test-Path -LiteralPath $StdoutLog) {
        Write-Host ""
        Write-Host "--- stdout tail ---" -ForegroundColor Yellow
        Get-Content -LiteralPath $StdoutLog -Tail 60
    }

    throw "Workbench startup failed."
}

# ---------------------------------------------------------------------------
# Optional AutoImport
# ---------------------------------------------------------------------------

$AutoImportedCaseId = $null

if ($AutoImport) {
    Write-Step "AutoImport: Stage A case + D1/D2 through the product API"

    $D1Meta = Join-Path $StageAOutputDir (([System.IO.Path]::GetFileNameWithoutExtension($D1Pdf)) + ".metadata.json")
    $D2Meta = Join-Path $StageAOutputDir (([System.IO.Path]::GetFileNameWithoutExtension($D2Pdf)) + ".metadata.json")
    $D1Text = Join-Path $StageAOutputDir (([System.IO.Path]::GetFileNameWithoutExtension($D1Pdf)) + ".txt")
    $D2Text = Join-Path $StageAOutputDir (([System.IO.Path]::GetFileNameWithoutExtension($D2Pdf)) + ".txt")

    foreach ($requiredFile in @($D1Meta, $D2Meta, $D1Text, $D2Text)) {
        if (-not (Test-Path -LiteralPath $requiredFile)) {
            throw "AutoImport prerequisite missing: $requiredFile"
        }
    }

    $env:ACME_POC1_AUTOIMPORT_URL = $WorkbenchUrl
    $env:ACME_POC1_AUTOIMPORT_D1_META = $D1Meta
    $env:ACME_POC1_AUTOIMPORT_D2_META = $D2Meta
    $env:ACME_POC1_AUTOIMPORT_D1_TEXT = $D1Text
    $env:ACME_POC1_AUTOIMPORT_D2_TEXT = $D2Text
    $env:ACME_POC1_AUTOIMPORT_RESULT = Join-Path $LocalRoot "autoimport-result.json"

    $autoImportJs = @'
const fs = require("node:fs");
const crypto = require("node:crypto");

async function main() {
const base = process.env.ACME_POC1_AUTOIMPORT_URL;
const organizationId = "acme-synthetic-organization";
const caseReference = "POC1-AUTO-UI";
const caseTitle = "POC #1 - anonymized judicial review";

if (!base) throw new Error("Missing ACME_POC1_AUTOIMPORT_URL.");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function expectResponse(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(
      `${label} failed: HTTP ${response.status}: ${await response.text()}`,
    );
  }
  return response;
}

const origin = base.endsWith("/") ? base.slice(0, -1) : base;

const login = await fetch(`${base}auth/session`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin,
  },
  body: JSON.stringify({
    email: "reviewer@acme.local",
    password: "acme-synthetic-reviewer",
  }),
});

await expectResponse(login, 201, "Development login");

const setCookies =
  typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [];

if (setCookies.length === 0) {
  throw new Error(
    "Development login returned no Set-Cookie values; Node 24 getSetCookie() is required.",
  );
}

const cookieParts = setCookies.map((value) => value.split(";")[0]);
const cookie = cookieParts.join("; ");
const csrfCookie = cookieParts.find((value) => value.startsWith("acme_csrf="));

if (!csrfCookie) throw new Error("Development login returned no CSRF cookie.");

const csrf = decodeURIComponent(csrfCookie.slice("acme_csrf=".length));

async function api(pathname, init = {}) {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers ?? {});
  headers.set("cookie", cookie);

  if (!["GET", "HEAD"].includes(method)) {
    headers.set("origin", origin);
    headers.set("x-acme-csrf", csrf);
  }

  return fetch(`${base}${pathname}`, { ...init, headers });
}

const capabilitiesResponse = await api("api/capabilities");
await expectResponse(capabilitiesResponse, 200, "Capabilities");
const capabilities = await capabilitiesResponse.json();

if (
  capabilities.stageAImport !== true ||
  capabilities.liveObservation !== true ||
  capabilities.liveRelation !== true ||
  capabilities.liveAssessment !== true
) {
  throw new Error(
    `Live Stage A capability is incomplete: ${JSON.stringify(capabilities)}`,
  );
}

const catalogResponse = await api(
  `api/cases?organizationId=${encodeURIComponent(organizationId)}` +
    `&q=${encodeURIComponent(caseReference)}&status=active`,
);
await expectResponse(catalogResponse, 200, "Case catalog");
const catalog = await catalogResponse.json();

let stageACase = (catalog.cases ?? []).find(
  (item) =>
    item.caseReference === caseReference &&
    item.dataPolicy === "stage-a-authorized-judicial-text",
);

if (!stageACase) {
  const createResponse = await api(
    `api/organizations/${encodeURIComponent(organizationId)}/cases`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "evidence-create-case-command/2",
        commandKey: `poc1-auto-case-${crypto.randomUUID()}`,
        title: caseTitle,
        caseReference,
        metadata: {
          purpose: "local-poc1-ui-bughunt",
          bootstrap: "startup-full_poc1.ps1",
        },
        dataPolicy: "stage-a-authorized-judicial-text",
      }),
    },
  );

  await expectResponse(createResponse, 201, "Stage A case creation");
  stageACase = await createResponse.json();
  console.log(`Created Stage A case: ${stageACase.caseId}`);
} else {
  console.log(`Reusing Stage A case: ${stageACase.caseId}`);
}

const caseId = stageACase.caseId;
if (!caseId) throw new Error("Stage A case has no caseId.");

async function importOne(label, metaPath, textPath) {
  const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const text = fs.readFileSync(textPath, "utf8");
  const parentSha = metadata?.parentContainer?.sha256;

  if (!parentSha) throw new Error(`${label}: metadata has no parent PDF SHA-256.`);
  if (!metadata?.canonicalText?.sha256) {
    throw new Error(`${label}: metadata has no canonical text SHA-256.`);
  }
  if (!metadata?.acquiredAt) {
    throw new Error(`${label}: metadata has no acquiredAt.`);
  }

  const listResponse = await api(
    `api/cases/${encodeURIComponent(caseId)}/text-imports`,
  );
  await expectResponse(listResponse, 200, `${label} import list`);
  const list = await listResponse.json();

  const existing = (list.imports ?? []).find(
    (item) => item?.sourceProvenance?.parentContainer?.sha256 === parentSha,
  );

  if (existing) {
    console.log(
      `${label}: already imported as ${existing.artifactVersionId}; skipping.`,
    );
    return {
      label,
      status: "existing",
      artifactVersionId: existing.artifactVersionId,
    };
  }

  const commandKey =
    `poc1-auto-import-${label.toLowerCase()}-` +
    metadata.canonicalText.sha256.slice(0, 16);

  const response = await api(
    `api/cases/${encodeURIComponent(caseId)}/text-imports`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metadata: {
          schemaVersion: "evidence-text-import-metadata/2",
          commandKey,
          intent: { kind: "create" },
          title: metadata.title || `${label} anonymized judgment`,
          artifactKind: "structured-exhibit-text",
          declaredMediaType: "text/plain; charset=utf-8",
          dataClass: "stage-a-anonymized-judicial-text/1",
          attestationVersion: "evidence-stage-a-source-attestation/1",
          anonymizationAttested: true,
          operatorAuthorityAttested: true,
          providerTransmissionAuthorized: true,
          sourceProvenance: {
            schemaVersion: "evidence-external-source-provenance/1",
            sourceKind: "judicial-document",
            externalSourceRef:
              metadata.suggestedExternalSourceRef || `sha256:${parentSha}`,
            acquiredAt: metadata.acquiredAt,
            parentContainer: {
              kind: "pdf",
              sha256: parentSha,
              byteLength: metadata.parentContainer.byteLength,
            },
            extraction: {
              method: metadata.extraction.method,
              version: metadata.extraction.version,
              extractedAt: metadata.extraction.extractedAt,
              pageCount: metadata.parentContainer.pageCount,
            },
          },
        },
        text,
      }),
    },
  );

  await expectResponse(response, 201, `${label} import`);
  const imported = await response.json();

  if (imported.canonicalSha256 !== metadata.canonicalText.sha256) {
    throw new Error(
      `${label}: server canonical SHA-256 does not match prepared source.`,
    );
  }

  console.log(
    `${label}: imported ${imported.artifactVersionId} (${imported.canonicalSha256})`,
  );

  return {
    label,
    status: "imported",
    artifactVersionId: imported.artifactVersionId,
  };
}

const d1 = await importOne(
  "D1",
  required("ACME_POC1_AUTOIMPORT_D1_META"),
  required("ACME_POC1_AUTOIMPORT_D1_TEXT"),
);

const d2 = await importOne(
  "D2",
  required("ACME_POC1_AUTOIMPORT_D2_META"),
  required("ACME_POC1_AUTOIMPORT_D2_TEXT"),
);

const result = {
  caseId,
  caseReference,
  title: stageACase.title ?? caseTitle,
  imports: [d1, d2],
};

fs.writeFileSync(
  required("ACME_POC1_AUTOIMPORT_RESULT"),
  JSON.stringify(result, null, 2),
  "utf8",
);

console.log(`AUTOIMPORT_CASE_ID=${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@

    $autoImportJs | node --input-type=commonjs -
    if ($LASTEXITCODE -ne 0) {
        throw "AutoImport failed."
    }

    $resultPath = $env:ACME_POC1_AUTOIMPORT_RESULT
    if (Test-Path -LiteralPath $resultPath) {
        $autoResult = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
        $AutoImportedCaseId = [string]$autoResult.caseId
        Write-Ok "D1/D2 are ready in Stage A case $AutoImportedCaseId."
    }

    Remove-Item Env:\ACME_POC1_AUTOIMPORT_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\ACME_POC1_AUTOIMPORT_D1_META -ErrorAction SilentlyContinue
    Remove-Item Env:\ACME_POC1_AUTOIMPORT_D2_META -ErrorAction SilentlyContinue
    Remove-Item Env:\ACME_POC1_AUTOIMPORT_D1_TEXT -ErrorAction SilentlyContinue
    Remove-Item Env:\ACME_POC1_AUTOIMPORT_D2_TEXT -ErrorAction SilentlyContinue
    Remove-Item Env:\ACME_POC1_AUTOIMPORT_RESULT -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "POC #1 IS UP" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Workbench       : $WorkbenchUrl"
Write-Host "MinIO console   : http://127.0.0.1:9001/"
Write-Host "PostgreSQL      : postgresql://acme:acme@127.0.0.1:55432/$PostgresDatabase"
Write-Host "MinIO bucket    : $Bucket"
Write-Host ""
Write-Host "Workbench login : reviewer@acme.local"
Write-Host "Password        : acme-synthetic-reviewer"
Write-Host ""
Write-Host "Stage A files   : $StageAOutputDir"
Write-Host "Model           : $Model"
Write-Host "Max model calls : 6 deployment ceiling"
Write-Host "Cost ceiling    : 19998 minor SEK units"
Write-Host ""
Write-Host "Workbench PID   : $($process.Id)  (Stop-Process -Id $($process.Id))"
Write-Host "stdout          : $StdoutLog"
Write-Host "stderr          : $StderrLog"
Write-Host ""
if ($AutoImport -and $AutoImportedCaseId) {
    Write-Host "AutoImport      : complete"
    Write-Host "Stage A case    : $AutoImportedCaseId"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  1. Sign in."
    Write-Host "  2. Select case POC1-AUTO-UI."
    Write-Host "  3. Open Documents; D1 and D2 are already imported."
    Write-Host "  4. Click Analyze source when you want to spend a live model call."
    Write-Host "  5. Start clicking until something breaks. :)"
}
else {
    Write-Host "AutoImport      : off"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  1. Sign in."
    Write-Host "  2. Create a Stage A - authorized anonymized judicial text case."
    Write-Host "  3. Open Documents."
    Write-Host "  4. Use the generated .txt + .metadata.json for D1, then D2."
    Write-Host "  5. Start clicking until something breaks. :)"
}
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $WorkbenchUrl
}
