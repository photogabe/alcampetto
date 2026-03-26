🇬🇧 English | [🇮🇹 Italiano](README.it.md)

# 🏀 Basketball courts in Milan metropolitan area
A collection of free-access basketball courts in Milan and surrounding areas.

For each court, the following data points are available:

- geographic details: address and GPS coordinates;

- features: availability of fences, lampposts, indoors facilities;

- qualitative notes: condition of hoops and court surface;

- photo gallery: from two to five images for each court;

- up to date status (green if data has been recorded less than 12 month from today, yellow if data has been recorded between 12 and 24 months, gray if the court card data is older than 24 months).

## Note on images
The images in this repository are web-optimized (resized compared to the original and with a low resolution in webp format) to ensure a reasonably smooth browsing.

## "Al Campetto" the website
Find your court easily through this easy to use website: [https://photogabe.github.io/alcampetto/index.en.html](https://photogabe.github.io/alcampetto/index.en.html)

## Dataset Version
Current version is 0.3.0
At this stage of the project (0.x) compatibility with previous versions of the json structure is not granted.

## Data schema

Each court is described by a JSON object with the following fields.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique court identifier (e.g. `"001"`). |
| `data` | `string` | Date the record was first created, `YYYY-MM-DD` format. |
| `aggiornato` | `string` | Date of the last update, `YYYY-MM-DD` format. |
| `indirizzo` | `string` | Street or square nearest to the court. |
| `zona` | `string` | Administrative area (e.g. `"Milano / Municipio 8"`). |
| `coordinate` | `object` | Geographic position with `lat` and `lng` (WGS 84). |
| `recintato` | `boolean` | `true` if the court is fenced. |
| `gratuito` | `boolean` | `true` if access is free of charge. |
| `illuminato` | `boolean` | `true` if the court has lighting for evening play. |
| `coperto` | `boolean` | `true` if the court is indoors or has a roof cover. |
| `foto` | `object` | Contains `overview` (wide-angle photo) and `dettagli` (array of additional photos). Paths are relative to the project root. |
| `i18n` | `object` | Localised text, keyed by ISO 639-1 language code (`it`, `en`, …). Each language provides `nome` (court name) and `note` (free-text description of condition and features). |

### Minimal example

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

_Code is generated with the assistance of Claude AI_
