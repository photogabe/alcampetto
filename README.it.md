[🇬🇧 English](README.md) | 🇮🇹 Italiano

# 🏀 Campetti nell'area metropolitana di Milano
Una raccolta di campetti di basket, ad accesso libero, nell'area metropolitana di Milano.

Per ogni campetto censito sono disponibili i seguenti dati:

- dettagli geografici: indirizzo e coordinate GPS;

- caratteristiche: presenza o meno di recinzione, illuminazione e copertura;

- note qualitative sullo stato della superficie di gioco e dei canestri;

- galleria fotografica: dalle due alle cinque immagini per ciascun campetto;

- stato di aggiornamento (*verde* se i dati sono stati raccolti meno di 12 mesi fa, *giallo* se i dati sono stati registrati tra i 12 e i 24 mesi, *grigio* se i dati mostrati nella card del campetto sono più vecchi).

## Nota sulle foto
Le immagini di questo repository hanno dimensioni ridotte rispetto agli originali e una bassa risoluzione e sono offerte in formato webp per garantire una velocità di consultazione accettabile.

## "Al Campetto", il sito
Trova il tuo campetto con questo sito facile da consultare: [https://photogabe.github.io/alcampetto/index.html](https://photogabe.github.io/alcampetto/index.html)

## Versione del set di dati
La versione corrente è la 0.3.0
Fintanto che il progetto resta in fase 0.x non si garantisce la compatibilità con precedenti versioni della struttura del file dati json.

## Tracciato dati

Ogni campetto è descritto da un oggetto JSON con i campi seguenti.

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `string` | Identificativo univoco del campetto (es. `"001"`). |
| `data` | `string` | Data di primo inserimento, formato `YYYY-MM-DD`. |
| `aggiornato` | `string` | Data dell'ultimo aggiornamento, formato `YYYY-MM-DD`. |
| `indirizzo` | `string` | Via o piazza di riferimento. |
| `zona` | `string` | Area amministrativa (es. `"Milano / Municipio 8"`). |
| `coordinate` | `object` | Posizione geografica con `lat` e `lng` (WGS 84). |
| `recintato` | `boolean` | `true` se il campo è delimitato da una recinzione. |
| `gratuito` | `boolean` | `true` se l'accesso è libero e gratuito. |
| `illuminato` | `boolean` | `true` se è presente illuminazione per il gioco serale. |
| `coperto` | `boolean` | `true` se il campo è al coperto o dotato di tettoia. |
| `foto` | `object` | Contiene `overview` (foto panoramica) e `dettagli` (array di foto aggiuntive). I percorsi sono relativi alla root del progetto. |
| `i18n` | `object` | Testi localizzati, indicizzati per codice lingua ISO 639-1 (`it`, `en`, …). Ogni lingua fornisce `nome` (nome del campetto) e `note` (descrizione libera sullo stato e le caratteristiche). |

### Esempio minimo

```json
{
  "id": "001",
  "data": "2026-02-01",
  "aggiornato": "2026-02-01",
  "indirizzo": "Via Benedetto Croce",
  "zona": "Milano / Municipio 8",
  "coordinate": { "lat": 45.49409, "lng": 9.11730 },
  "recintato": true,
  "gratuito": true,
  "illuminato": false,
  "coperto": false,
  "foto": {
    "overview": "photos/001/overview.jpg",
    "dettagli": ["photos/001/dettaglio-1.jpg"]
  },
  "i18n": {
    "it": { "nome": "Campetto di Parco Vieira De Mello", "note": "Ben tenuto." },
    "en": { "nome": "Vieira De Mello Park Basketball Court", "note": "Well maintained." }
  }
}
```

---

_Il codice di questo progetto è stato generato con l'assistenza di Claude AI_
