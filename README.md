🇬🇧 English | [🇮🇹 Italiano](README.it.md)

![ALCAMPETTO — Basketball courts in Milan](assets/banner.webp)

# 🏀 Basketball courts in Milan metropolitan area

A photographic atlas of free-access basketball courts in Milan and surrounding areas.

**[Browse the atlas →](https://photogabe.github.io/alcampetto/index.en.html)**

For each court, the following data points are available:

- geographic details: address and GPS coordinates;
- court features: number of hoops, three-point line, fencing, lighting, indoor/outdoor;
- qualitative notes on the condition of hoops and court surface;
- photo gallery: from two to five images per court;
- freshness indicator (green if data is less than 12 months old, yellow between 12 and 24 months, grey if older).

## Contribute

Found a court that's missing? Report it through the **[contribution form](https://tally.so/r/QKYOlX)** or open an issue / pull request on this repository.

## Note on images

The images in this repository are web-optimized (resized and converted to webp format) to ensure smooth browsing. They are not intended as high-resolution prints.

## Dataset version

Current version is **0.4.0**.
At this stage of the project (0.x), compatibility with previous versions of the JSON structure is not guaranteed.

## Data schema

Each court is described by a JSON object. Fields are grouped by category.

### Identification

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique court identifier (e.g. `"001"`). |
| `created` | `string` | Date the record was first created, `YYYY-MM-DD`. |
| `updated` | `string` | Date of the last update, `YYYY-MM-DD`. |

### Location

| Field | Type | Description |
|---|---|---|
| `address` | `string` | Street or square nearest to the court. |
| `city` | `string` | Municipality name (e.g. `"Milano"`, `"Sesto San Giovanni"`). |
| `district` | `string\|null` | Administrative subdivision (e.g. `"Municipio 8"`). `null` for municipalities without subdivisions. |
| `coordinates` | `object` | Geographic position with `lat` and `lng` (WGS 84). |

### Court features

| Field | Type | Description |
|---|---|---|
| `hoops` | `integer` | Number of hoops (typically 1, 2 or 4). |
| `half_court` | `boolean` | `true` if the court is a half court only. |
| `three_pt_line` | `boolean` | `true` if a three-point line is marked on the surface. |
| `fenced` | `boolean` | `true` if the court is enclosed by a fence. |
| `free` | `boolean` | `true` if access is free of charge. |
| `lit` | `boolean` | `true` if the court has lighting for evening play. |
| `indoor` | `boolean` | `true` if the court is indoors or has a roof cover. |

### Media and text

| Field | Type | Description |
|---|---|---|
| `photos` | `object` | Contains `overview` (wide-angle photo) and `details` (array of close-up photos). Paths are relative to the project root. |
| `i18n` | `object` | Localised text, keyed by ISO 639-1 language code (`it`, `en`, …). Each language provides `nome` (court name) and `note` (free-text description of condition and features). |

### Example

```json
{
  "id": "001",
  "created": "2026-02-20",
  "updated": "2026-02-20",
  "address": "Via Benedetto Croce",
  "city": "Milano",
  "district": "Municipio 8",
  "coordinates": { "lat": 45.49409, "lng": 9.11730 },
  "hoops": 2,
  "half_court": false,
  "three_pt_line": true,
  "fenced": false,
  "free": true,
  "lit": false,
  "indoor": false,
  "photos": {
    "overview": "photos/001/overview.webp",
    "details": [
      "photos/001/dettaglio-1.webp",
      "photos/001/dettaglio-2.webp",
      "photos/001/dettaglio-3.webp"
    ]
  },
  "i18n": {
    "it": { "nome": "Campetto di Giardini Vieira De Mello", "note": "Ben tenuto. Superficie in ottime condizioni." },
    "en": { "nome": "Giardini Vieira De Mello Basketball Court", "note": "Well maintained. Surface in good condition." }
  }
}
```

---

_Code is generated with the assistance of Claude AI_
