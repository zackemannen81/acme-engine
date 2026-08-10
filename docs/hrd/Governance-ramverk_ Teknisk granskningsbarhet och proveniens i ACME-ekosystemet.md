### Governance-ramverk: Teknisk granskningsbarhet och proveniens i ACME-ekosystemet

#### 1\. Strategiskt syfte och ramverkets omfattning

I en tid där artificiell intelligens i allt högre grad driver kritiska beslutsprocesser är den tekniska proveniensen avgörande för att upprätthålla mänskligt förtroende och regulatorisk efterlevnad. ACME-ekosystemet bygger på principen att AI-genererade resultat kräver absolut spårbarhet för att kunna transformeras från osäkra förslag till legalt och professionellt godtagbara underlag.Detta ramverk har som målsättning att transformera ACME:s tekniska mekanismer – Ledger, Replay och Outbox – till en sammanhörande styrningsmodell för professionella användare och revisorer. Ramverket vilar på tre arkitektoniska kärnprinciper som utgör fundamentet för systemets ansvarsutkrävande:

* **Proveniens:**  Varje påstående och beslut binds strikt till en oföränderlig källartefakt, en specifik kontraktversion och en exakt modellinteraktion.  
* **Oföränderlighet:**  Genom atomiska transaktioner bevaras historiken som en obruten kedja av bevis. Inga data raderas eller skrivs över tyst.  
* **Rekonstruerbarhet:**  Systemet garanterar möjligheten att återskapa ett exakt tillstånd vid tidpunkt (T) för att verifiera logiken bakom ett historiskt beslut utan att kontakta externa AI-leverantörer.Centralt för hela ramverket är  **Kandidatprincipen** :  *Modelloutput är en kandidat, aldrig en sanning* . Systemet, inte modellen, avgör om en kandidat är förenlig med tidigare kanoniskt tillstånd. De arkitektoniska mekanismerna nedan är utformade för att verkställa denna princip genom strikta tekniska garantier.

#### 2\. Arkitektoniska mekanismer för strikt proveniens

ACME:s kärnkomponenter samverkar för att skapa en obruten kedja av bevis från initial indata till slutgiltigt beslut. Genom att separera modellens probabilistiska natur från systemets deterministiska logik säkerställs att endast validerad och tolkad data tillåts påverka systemets tillstånd.

##### ACME Ledger: CAS och atomisk promotion

Kärnan i proveniensmodellen är  **ACME Ledger** . För att eliminera risken för "silent overwrites" använder Ledgern  **CAS (Compare-and-Swap)**  och BEGIN IMMEDIATE-transaktioner. Varje förändring i systemets tillstånd kräver en kontroll av CONFLICT\_STATE\_REVISION. Om två skrivare försöker mutera samma revision avvisas den ena omedelbart, vilket garanterar en linjär och oförfalskad historik.Strukturen för en PreparedCommit i Ledgern inkluderar unika fingeravtryck som binder exekveringen till specifika kontrakt och förutsättningar:  
{  
  "executionId": "exec-7b2a-91fc",  
  "operationDigest": "sha256:e3b0c442...",  
  "requestFingerprint": "sha256:a8f1b3c4...",  
  "contractFingerprint": "sha256:b9c2d5e6...",  
  "provenance": {  
    "contract": "research.observe-evidence@1.0.0",  
    "modelCallId": "call-001",  
    "timestamp": "2026-08-09T14:30:00Z"  
  },  
  "effects": {  
    "memoryMutations": \[...\],  
    "stateDelta": {...},  
    "documents": \["doc-key-123"\]  
  },  
  "revisions": {  
    "expected": 5,  
    "next": 6  
  }  
}

##### Outbox-mekanismen: Lease/Claim-baserad synkronisering

För att externa system ska synkroniseras med den interna sanningen tillämpar ACME en  **Outbox-mekanism**  enligt  **Lease/Claim-mönstret**  (ADR-0018). Detta säkerställer "at-least-once delivery" av händelser. En domänhändelse (t.ex. ett registrerat bevis) blir tillgänglig för omvärlden först när den underliggande transaktionen i Ledgern har committats atomiskt. Detta skapar en absolut korrespondens mellan systemets interna tillstånd och dess externa kommunikation.

##### Replay: En arkitektonisk garanti för determinism

Möjligheten till  **Replay**  är kritisk för forensisk granskning. Genom att lagra den råa Model Response i dess normaliserade form kan systemet verifiera beslut offline utan att vara beroende av AI-leverantörens tillgänglighet eller interna loggning. Vid en Replay re-computas systemets Operation Digest; vid minsta avvikelse i indata eller logik misslyckas integritetskontrollen omedelbart, vilket bevisar att exekveringen är deterministisk och fri från drift.

#### 3\. Modellen för hantering av motsägelser (Conflict Management)

I komplexa miljöer är motsägelsefull information en regel. Traditionell CRUD-logik (Create, Read, Update, Delete) är otillräcklig eftersom den raderar tidigare information. ACME använder istället en  **bevarandeprincip**  där motstridiga uppgifter ses som värdefull evidens för att bevara dataentropi.Hanteringen av motsägelser styrs av tre logiska modeller:| Metod | Beskrivning | Strategisk betydelse (So What?) || \------ | \------ | \------ || **Contest (Bestridande)** | Två källor motsäger varandra. Båda bevaras med en explicit konfliktlänk. | Bevarar tvivlet som ett tekniskt faktum; systemet "väljer inte sida" utan mänsklig instruktion. || **Supersede (Ersättande)** | Ny evidens (t.ex. en korrigerad transkription) länkas till och ersätter en tidigare version. | Skapar en audit-safe länkning där den gamla versionen finns kvar som historisk kontext. || **Coexist (Samexistens)** | Påståenden verkar motstridiga men är sanna inom olika kontexter (tid, plats, person). | **Bevarar evidensens entropi.**  Hindrar systemet från att "medla" bort viktiga nyanser i t.ex. vittnesmål. |  
Dessa logiska modeller lagras i Ledger-arkivet, vilket innebär att en granskare kan rekonstruera de vägval systemet gjorde när det konfronterades med motstridig data, vilket är fundamentalt för systemets trovärdighet vid juridisk prövning.

#### 4\. Rekonstruktion av beslutshistorik: En steg-för-steg-guide

Kärnan i ansvarsutkrävande är metodiken att återskapa systemets tillstånd vid tidpunkt (T). Principen är att "hämta beviset, inte gissa kvaliteten". Eftersom Ledgern lagrar den råa modellresponsen är granskaren helt oberoende av AI-leverantörens nuvarande status.

1. **Identifiering:**  Lokalisera ExecutionId och tillhörande Operation Digest.  
2. **Isolering:**  Extrahera det oföränderliga "read-set" (evidens, snapshot, tidigare minnen).  
3. **Exekvering:**  Genomför en  **Replay** . Systemet kör om logiken och validerar att den resulterande digesten är identisk med originalet. ACME genererar inga nya ID:n eller klockslag under processen.  
4. **Validering:**  Granska Memory Decisions via  **MemoryEngine**  för att se exakt vilka påståenden som var applied, ignored eller rejected. Även ignored kandidater behålls som ledger-evidens för att förhindra dataförlust vid audit.Denna process garanterar att varje beslut vilar på observerbara fakta snarare än systemets nuvarande konfiguration.

#### 5\. Ansvarsutkrävande och "The Authority Ladder"

Genom ACME:s lagerstruktur transformeras teknisk data till juridisk och professionell auktoritet. Denna modell, känd som  **"The Authority Ladder"** , utgör baslinjen för  **Evidence Integrity Workbench (POC \#1)** .

* **Nivå 1: Immutable Artifacts:**  Oföränderliga källfiler och deras digitala fingeravtryck (hash-värden).  
* **Nivå 2: Situated Statements:**  Påståenden bundna till talare, tid (T) och plats (S). Genom att förankra påståenden i metadata förhindras modellen från att producera "eviga sanningar" eller hallucinationer.  
* **Nivå 3: Evidence Relations:**  Hur påståenden stödjer eller bestrider varandra (länkad data). Systemet påvisar mönster av korroborering eller konflikt.  
* **Nivå 4: Human Assessment:**  Den mänskliga granskarens slutgiltiga bedömning baserad på systemets underlag.Systemet levererar proveniens för  **observationer**  (Nivå 1–3), men den mänskliga användaren bär alltid det slutgiltiga ansvaret för den professionella  **konklusionen**  (Nivå 4). Detta ramverk gör AI-systemet till ett verktyg för sanning och teknisk integritet, snarare än en ogenomskinlig "black box".

