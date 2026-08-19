# Användarmanual — Evidence Workbench 2.0

Produkten är en ärendeavgränsad granskningsarbetsbänk. Varje lista är
begränsad. Varje rad som namnger en källa öppnar de exakta raderna.
Ingenting på skärmen är en rättslig slutsats.

Etiketterna nedan är de engelska strängar produkten visar.

## Logga in och ärenden

Öppna `http://127.0.0.1:8795`. Logga in med ett konto från
driftsättningens kontofil.

**Cases** listar bara ärenden du tillhör. Skapa ett ärende med titel
och case reference. Då blir du `case-admin` på det ärendet.

Ett andra konto som inte är medlem får **404**, inte 403, på varje
ärendeavgränsad URL. Det är isolering, inte en trasig länk.

Sign out sitter i sidhuvudet.

## Skalet

Inne i ett ärende namnger det marinblå sidhuvudet ärendet. Den mörka
sidomenyn är ytfältet. Varje yta i fältet finns.

| Sidomeny | Vad det är |
| --- | --- |
| **1. Overview** | Status: antal och var du återupptar. Inte en dashboard. |
| **2. Sources / Documents** | Delar av en importerad källa |
| **Case · import** | Importera PDF eller förberedd text; lista källor |
| **3. Chains** | Longitudinella subjekt (en persons förhör, …) |
| **4. Claims** | Namngivna grupperingar. De slår inte ihop förekomster |
| **5. Relations** | Typade utsagor om två ändpunkter |
| **6. Timeline** | Samma förekomster, i tid |
| **7. Consensus** | Per påstående, över accepterat material |

## Importera en källa

**Case · import**.

- **Import a PDF** — mottagna byte lagras krypterade. Kanonisk text
  härleds i produkten (`pdfjs-text/1`). Bild-only och krypterade PDF:er
  vägras. Ingenting sparas vid vägran.
- **Import prepared text** — strikt UTF-8. Använd när texten
  förberetts utanför produkten.

Import skivar källan i delar och föreslår kedjor **en gång**,
deterministiskt, i samma transaktion. Ingen modell anropas.

Efter import visar **Sources** radantal, delantal, kedjeantal och
kanoniskt SHA-256.

## Läs källan

**2. Sources / Documents** → en del. Du ser de exakta raderna och
vilken kedja delen tillhör. En deltitel är en **etikett**, inte
dokumentets identitet och inte dess klocka.

## Kedjor och instanser

**3. Chains**. Subjekt och tid kommer från dokumentkroppen, aldrig från
en deltitel.

Öppna en kedja. Instanser är ordnade efter källtid. Varje instans har
ett granskningstillstånd:

| Tillstånd | Betydelse |
| --- | --- |
| `not extracted` | Inget committat extraktionsfönster |
| `pending review` | Förekomster finns; minst en är obestämd |
| `reviewed` | Varje förekomst har en ställning |

En kedja är klar bara när varje instans är granskad.

## Extract observations (live)

Öppna en instans. Om driftsättningen har en live-modell och fönster
återstår anger **Extract observations** hur många modellanrop som ska
köras, och postar sedan den planen.

Det här är J3: en instans egen källa, inget tidigare förhör, ingen
grannkontext. Modellen citerar citable unit-id:n. **Citat och locator
kommer från enheten**, aldrig från modellen.

Ett misslyckat fönster stoppar körningen och behåller allt som redan
committats. En ny knapptryckning spenderar bara utestående fönster.

Utan live-modell saknas kontrollen.

Du kan också lägga till en missad förekomst genom att ange ett
**citable unit id**. Du kan inte skriva in ord som källan inte
innehåller.

## Granska ställning

På instansen har varje förekomst Accept / Reject / Revise och en
motivering. Ett beslut **läggs till**. Att avvisa en förekomst raderar
ingenting. Effektiv ställning viks från loggen vid varje läsning.

Att skriva en förekomst är i sig ett godkännande.

## Compare instances (live)

När en instans är granskad anger **3.2 Compare with earlier instances**
ett härlett anropsantal över fryst accepterat material från tidigare
instanser i **samma** kedja, och kör sedan J4.

Modellen citerar bara förekomst-id:n. Ett tomt fönster är giltigt:
tystnad är inte en motsägelse. Compare ändrar inte extraktionen.

## Claims

**4. Claims**. Skapa en etikett och en sats. Inkludera en förekomst
med id; exkludera den senare på samma sätt.

Ett påstående **slår aldrig ihop, absorberar aldrig, äger aldrig**. Två
identiska citat förblir två bidrag. Ett tömt påstående säger att det är
tomt. Ett påstående har ingen poäng och ingen dom — det är Consensus.

## Relations

**5. Relations**. Fyra verb: `contradicts`, `adds`, `supports`,
`qualifies`. En relation raderar aldrig en ändpunkt.

`adds` är tillagt material, inte stöd. En `contradicts`-relation vars
aktör eller tid inte är jämförbar vägras.

Granska en relation på samma sätt som en förekomst. Mänskligt
författarskap är ett godkännande. Modellföreslagna relationer från J4
börjar som pending.

## Timeline

**6. Timeline**. Varje förekomst och varje påstående, vid en
innehållshärledd ärenderevision. Daterade poster behåller sin typade
gräns. Okänd eller saknad tid är en separat grupp **Unordered** —
aldrig inskjuten på ett datum.

Två förekomster förblir två rader även när de citerar samma ord.

## Consensus

**7. Consensus**. Per påstående, från **accepterade** förekomster och
**accepterade** relationer bara. Ärendet har ingen egen dom.

| Dom | När |
| --- | --- |
| `insufficient-material` | Inga accepterade medlemmar |
| `contested` | En accepterad `contradicts` rör påståendet |
| `qualified` | Annars en accepterad `qualifies` |
| `supported` | Annars en accepterad `supports` |
| `unresolved` | Annars material utan ståndpunktsverb (inklusive bara `adds`) |

Avsaknad av material är inte en vederläggning.

## Overview

**1. Overview** räknar det som är lagrat och namnger nästa instans att
återuppta. Ett antal är ett faktum om arbetsytan, aldrig ett fynd. Det
finns inget diagram, ingen mätare och ingen poäng.

## Arbetssätt

1. Följ återupptagningslänken, eller välj den lägsta oavslutade instansen.
2. Extrahera först när du läst instansens källdelar.
3. Granska innan du jämför. Compare ser inte ogranskat arbete.
4. Gruppera i påståenden bara det som rör en proposition.
5. Öppna källan på varje rad du litar på.

## Vad du inte hittar

- En genererad rapport eller bedömningshandling
- Grafvisualisering eller en aktörslista
- Poäng, vikter, konfidens eller rangordning
- En ärendenivå ”detta är sant”
- Bulk-tilldelning eller fleranvändargranskning
- Uppladdning av DOCX, OCR eller media
