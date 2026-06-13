[🇬🇧 English](README.md) | 🇮🇹 Italiano

![ALCAMPETTO — Campetti da basket a Milano](assets/banner.webp)

# 🏀 Campetti di basket a Milano

Un atlante fotografico di campetti di basket, ad accesso libero, a Milano.

**[Consulta l'atlante →](https://alcampetto.org/index.html)**

Per ogni campetto censito sono disponibili i seguenti dati:

- dettagli geografici: indirizzo e coordinate GPS;
- caratteristiche del campo: numero di canestri, linea da tre, recinzione, illuminazione;
- note qualitative sullo stato della superficie di gioco e dei canestri;
- galleria fotografica: dalle due alle cinque immagini per ciascun campetto;
- indicatore di aggiornamento (verde se i dati sono stati raccolti meno di 12 mesi fa, giallo tra i 12 e i 24 mesi, grigio se più vecchi).

## Contribuisci

Conosci un campetto che manca? Segnalalo attraverso il **[modulo di segnalazione](https://tally.so/r/QKYOlX)**.

Prima di inoltrare una pull request, [apri una issue](https://github.com/photogabe/alcampetto/issues/new) per discutere la tua proposta e ricevere un riscontro dal maintainer.

## Protocollo fotografico

Le immagini sono scattate secondo un protocollo standardizzato che garantisce uniformità e comparabilità tra i campetti censiti.

### Condizioni generali

- **Orario:** mattino, preferibilmente nelle prime ore (luce morbida, campi vuoti). Sono accettate anche foto scattate nel corso della mattinata, purché in condizioni di luce adeguata.
- **Campo:** vuoto, senza persone nel frame.
- **Luce:** naturale. Cielo sereno o coperto entrambi accettabili. Da evitare la luce diretta e dura di metà giornata.
- **Attrezzatura:** fotocamera reflex o mirrorless (file RAW preferito). Lo smartphone è accettato come soluzione secondaria; le foto potranno essere sostituite in futuro da scatti ad alta definizione.

### Le 4 foto standard

![Protocollo fotografico — posizioni di scatto](assets/court-protocol.svg)

| # | Nome | Posizione | Soggetto |
|---|---|---|---|
| 1 | Vista d'insieme | Vertice più libero da ostacoli, altezza d'occhio | Campo intero nel frame, orientamento landscape |
| 2 | Canestro 1 | Linea di tiro libero, asse centrale del pitturato | Canestro, tabellone e parte del pitturato |
| 3 | Canestro 2 | Linea di tiro libero, lato opposto | Identico alla foto 2, lato specchiato |
| 4 | Superficie | Centrocampo, in piedi | Fotocamera verticale verso il basso; semicerchio e linea di centrocampo nel frame |

### Eccezioni documentate

- Le 4 foto standard possono essere integrate da scatti aggiuntivi che documentano condizioni particolari del campo.


## Nota sulle foto

Le immagini di questo repository hanno dimensioni ridotte e sono in formato webp per garantire una velocità di consultazione accettabile. Non sono destinate alla stampa.


## Versione del set di dati

La versione corrente è la **0.4.0**.
Fintanto che il progetto resta in fase 0.x non si garantisce la compatibilità con precedenti versioni della struttura del file JSON.

## Tracciato dati

Ogni campetto è descritto da un oggetto JSON. I campi sono raggruppati per categoria.

### Identificazione

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `string` | Identificativo univoco del campetto (es. `"001"`). |
| `created` | `string` | Data di primo inserimento, formato `YYYY-MM-DD`. |
| `updated` | `string` | Data dell'ultimo aggiornamento, formato `YYYY-MM-DD`. |

### Localizzazione

| Campo | Tipo | Descrizione |
|---|---|---|
| `address` | `string` | Via o piazza di riferimento. |
| `city` | `string` | Nome del comune (es. `"Milano"`, `"Sesto San Giovanni"`). |
| `district` | `string\|null` | Suddivisione amministrativa (es. `"Municipio 8"`). `null` per i comuni senza suddivisioni. |
| `coordinates` | `object` | Posizione geografica con `lat` e `lng` (WGS 84). |

### Caratteristiche del campo

| Campo | Tipo | Descrizione |
|---|---|---|
| `hoops` | `integer` | Numero di canestri (tipicamente 1, 2 o più). |
| `surface` | `string` | Materiali usati per la superficie _(proprietà tracciata ma non ancora esposta)_. |
| `half_court` | `boolean` | `true` Se si tratta di un mezzo campo. |
| `three_pt_line` | `boolean` | `true` se la linea da tre punti è tracciata sulla superficie. |
| `fenced` | `boolean` | `true` Se il campo è delimitato da una recinzione. |
| `lit` | `boolean` | `true` Se è presente illuminazione per il gioco serale. |

### Media e testi

| Campo | Tipo | Descrizione |
|---|---|---|
| `audio` | `string\|null` | Percorso relativo alla root di progetto di un file audio registrato sul campo. |
| `photos` | `array` | Array di rilevazioni fotografiche, ordinate dalla più recente alla più vecchia. Ogni elemento è un oggetto con i campi descritti sotto. `photos[0]` è sempre la rilevazione corrente. |
| `photos[].date` | `string` | Data della rilevazione, formato `YYYY-MM-DD`. |
| `photos[].overview` | `string\|null` | Foto panoramica. Percorso relativo alla root del progetto. |
| `photos[].context` | `string\|null` | Foto di contesto (opzionale). |
| `photos[].details` | `array` | Array di foto di dettaglio. Vedi sezione sul protocollo fotografico. |
| `photos[].autore` | `array` | Array di foto d'autore (opzionale). |
| `i18n` | `object` | Testi localizzati, indicizzati per codice lingua ISO 639-1 (`it`, `en`, …). Ogni lingua fornisce `nome` (nome del campetto) e `note` (descrizione libera). |

### Esempio

```json
{
    "id": "001",
    "created": "2026-03-30",
    "updated": "2026-04-16",
    "address": "Giardino Sergio Vieira de Mello",
    "city": "Milano",
    "district": "Municipio 8",
    "coordinates": {
      "lat": 45.49409,
      "lng": 9.1173
    },
    "hoops": 2,
    "surface": "cemento",
    "half_court": false,
    "three_pt_line": true,
    "fenced": false,
    "lit": true,
    "audio": "audio/001/001-beat.mp3",
    "photos": [
      {
        "date": "2026-04-16",
        "overview": "photos/001/2026-04-16/overview.webp",
        "context": "photos/001/2026-04-16/context.webp",
        "details": [
          "photos/001/2026-04-16/hoop-1.webp",
          "photos/001/2026-04-16/hoop-2.webp",
          "photos/001/2026-04-16/surface.webp",
          "photos/001/2026-04-16/benches.webp",
          "photos/001/2026-04-16/flyer.webp",
          "photos/001/2026-04-16/shopping-cart.webp",
          "photos/001/2026-04-16/noticeboard.webp"
        ],
        "autore": [ "photos/001/2026-04-16/auth-1.webp" ]
      },
      {
        "date": "2026-03-30",
        "overview": "photos/001/2026-03-30/overview.webp",
        "context": null,
        "details": [
          "photos/001/2026-03-30/hoop-1.webp",
          "photos/001/2026-03-30/hoop-2.webp"
        ],
        "autore": []
      }
    ],
    "i18n": {
      "it": {
        "nome": "Campetto di Giardino Sergio Vieira de Mello",
        "note": "Campetto in buono stato, presenta ben undici panchine lungo i lati. Sette piccoli lampioni ai lati dovrebbero garantire l'illuminazione notturna. Un canestro senza retina. Uno stallo per sei posti bici a bordo campo."
      },
      "en": {
        "nome": "Giardino Sergio Vieira de Mello Basketball Court",
        "note": "Court well mantained, with eleven benches along its sides. Seven small court lights on the sides should provide nighttime illumination. One rim without net. A six-space bike rack right beside the court."
      }
    }
  }
```


## License

Questo progetto usa licenze diverse per diverse componenti:

| Componente | Licenza | Perimetro |
|-----------|----------|-----------|
| Codice sorgente | [EUPL-1.2](LICENSE-CODE) | README, .js, .html, .css, .json-schema files |
| Dati (JSON) | [CC BY 4.0](LICENSE-DATA) | tutti i dati (*.json) |
| Foto e audio | [CC BY-NC-ND 4.0](LICENSE-MEDIA) | tutte le foto e i file audio |

In origine l'intero progetto era sotto un'unica licenza MIT; il 18 aprile 2026 è stata suddivisa nelle licenze per componente elencate sopra. Dalla **v0.5.0** la componente di codice passa da MIT alla **EUPL-1.2** (Licenza Pubblica dell'Unione Europea): le versioni fino alla **v0.4.0** inclusa restano disponibili sotto MIT — una licenza già concessa non è revocabile — mentre dalla v0.5.0 in avanti vale la EUPL-1.2.
Foto e audio sono sempre state soggette alla legge sul diritto d'autore indipendentemente dalla licenza applicata alla componente software.


---

_Il codice di questo progetto è stato generato con l'assistenza di Claude AI_
