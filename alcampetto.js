/* =============================================================
   ALCAMPETTO · alcampetto.js
   Logica JavaScript condivisa dalle pagine index del progetto.
   Incluso da: index.html (italiano) e index.en.html (inglese).

   La lingua viene rilevata automaticamente dall'attributo lang
   del tag html di ogni pagina).

   Per aggiungere una nuova lingua:
   1. Aggiungere un blocco nel dizionario I18N qui sotto
   2. Creare la pagina index.[lingua].html con <html lang="...">
   3. Aggiungere i campi tradotti in alcampetto.json
   ============================================================= */


/* -------------------------------------------------------------
   DIZIONARIO STRINGHE LOCALIZZATE (I18N)
   Tutte le stringhe visibili nell'interfaccia sono qui,
   organizzate per codice lingua.
   ------------------------------------------------------------- */
var I18N = {

  it: {
    loading:       'Caricamento dati…',
    noResults:     'Nessun campetto trovato 🏀',
    serverError:   '⚠ Per visualizzare i dati, avvia un server locale',
    serverCmd:     'python3 -m http.server',
    serverHint:    'oppure usa GitHub Pages.',
    labelAddress:  'Indirizzo',
    labelArea:     'Zona',
    labelNotes:    'Note',
    labelPhotos:   'Foto',
    labelLit:      'Illuminato',
    labelFenced:   'Recintato',
    labelIndoors:  'Coperto',
    labelHoops:    'canestri',
    labelHoop:     'canestro',
    labelHalf:     'Mezzo campo',
    labelThreePt:  'Linea da tre',
    openInMaps:    '📍 Apri in Maps',
    fresh:         'Aggiornato',
    aging:         'Da riverificare',
    stale:         'Datato'
  },

  en: {
    loading:       'Loading data…',
    noResults:     'No courts found 🏀',
    serverError:   '⚠ To view data, start a local server',
    serverCmd:     'python3 -m http.server',
    serverHint:    'or deploy to GitHub Pages.',
    labelAddress:  'Address',
    labelArea:     'Area',
    labelNotes:    'Notes',
    labelPhotos:   'Photos',
    labelLit:      'Lit',
    labelFenced:   'Fenced',
    labelIndoors:  'Indoors',
    labelHoops:    'hoops',
    labelHoop:     'hoop',
    labelHalf:     'Half court',
    labelThreePt:  'Three-pt line',
    openInMaps:    '📍 Open in Maps',
    fresh:         'Up to date',
    aging:         'Needs check',
    stale:         'Outdated'
  }

};


/* -------------------------------------------------------------
   LINGUA ATTIVA
   Letta dall'attributo lang del tag <html> della pagina.
   Se la lingua non è nel dizionario I18N, si usa 'it'.
   ------------------------------------------------------------- */
var LANG = document.documentElement.lang;
if (!I18N[LANG]) { LANG = 'it'; }

/* Scorciatoia per leggere le stringhe della lingua attiva */
var T = I18N[LANG];


/* -------------------------------------------------------------
   STATO DELL'INTERFACCIA
   ------------------------------------------------------------- */
var DATA         = [];
var activeFilter = 'all';
var activeSort   = 'id';
var mapsProvider = localStorage.getItem('mapsProvider') || 'google';


/* =============================================================
   UTILITÀ DI SANITIZZAZIONE
   Proteggono l'interfaccia da contenuti malevoli nel JSON.
   ============================================================= */

/* Verifica che un URL foto sia un percorso relativo sicuro.
   Accetta solo percorsi che iniziano con "photos/" e non
   contengono schemi (javascript:, data:, http:, ecc.).
   Restituisce il percorso originale se valido, stringa vuota
   altrimenti. */
function safePhotoUrl(url) {
  if (typeof url !== 'string') { return ''; }
  var trimmed = url.trim();
  if (/^[a-z][a-z0-9+.\-]*:/i.test(trimmed)) { return ''; }
  if (!trimmed.startsWith('photos/'))          { return ''; }
  return trimmed;
}


/* =============================================================
   HELPER DOM
   Funzioni brevi per costruire nodi in modo leggibile.
   Ogni valore testuale passa da textContent, che il browser
   non interpreta mai come HTML → XSS impossibile by design.
   ============================================================= */

/* Crea un elemento con tag e classe opzionale */
function el(tag, className) {
  var node = document.createElement(tag);
  if (className) { node.className = className; }
  return node;
}

/* Crea un elemento con tag, classe e contenuto testuale */
function textEl(tag, className, content) {
  var node = el(tag, className);
  node.textContent = content;
  return node;
}

/* Costruisce una riga etichetta + valore (pattern ripetuto
   tre volte in ogni card: Indirizzo, Zona, Note) */
function infoRow(label, value) {
  var row = el('div', 'info-row');
  row.appendChild(textEl('div', 'info-label', label));
  row.appendChild(textEl('div', 'info-val',   value));
  return row;
}


/* =============================================================
   LIGHTBOX
   Apre e chiude il visualizzatore foto a schermo intero.
   ============================================================= */

var lightbox      = document.getElementById('lightbox');
var lightboxImg   = document.getElementById('lightbox-img');
var lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src) {
  if (!safePhotoUrl(src)) { return; }
  lightboxImg.src = src;
  lightbox.classList.add('open');
}

lightboxClose.addEventListener('click', function () {
  lightbox.classList.remove('open');
});

lightbox.addEventListener('click', function (event) {
  if (event.target === lightbox) {
    lightbox.classList.remove('open');
  }
});


/* =============================================================
   INDICATORE DI FRESCHEZZA
   Confronta il campo "aggiornato" del JSON con la data odierna.

   Soglie (modificare qui per cambiarle):
     meno di 12 mesi → 'fresh' (verde)
     12–24 mesi      → 'aging' (giallo)
     oltre 24 mesi   → 'stale' (grigio)
   ============================================================= */

/* Restituisce il numero di mesi interi tra due oggetti Date */
function monthsBetween(dateA, dateB) {
  var years  = dateB.getFullYear() - dateA.getFullYear();
  var months = dateB.getMonth()    - dateA.getMonth();
  return years * 12 + months;
}

/* Restituisce la classe CSS in base ai mesi trascorsi */
function freshnessClass(isoDateString) {
  var updated = new Date(isoDateString);
  var today   = new Date();
  var months  = monthsBetween(updated, today);
  if (months < 12) { return 'fresh'; }
  if (months < 24) { return 'aging'; }
  return 'stale';
}

/* Restituisce un nodo DOM per l'indicatore di freschezza */
function freshnessNode(isoDateString) {
  var cssClass = freshnessClass(isoDateString);
  var label    = T[cssClass];

  var span = el('span', 'freshness ' + cssClass);
  span.appendChild(el('span', 'freshness-dot'));
  span.appendChild(document.createTextNode(label));
  return span;
}


/* =============================================================
   PILL BOOLEANE
   label : stringa da mostrare (es. "Illuminato")
   value : true → pill verde · false → pill grigia
   Restituisce un nodo DOM <span>.
   ============================================================= */
function pillNode(label, value) {
  var cssClass = value ? 'yes' : 'no';
  var icon     = value ? '✓'   : '✗';
  return textEl('span', 'bool-pill ' + cssClass, icon + ' ' + label);
}


/* =============================================================
   INTERSECTIONOBSERVER
   Aggiunge .visible alla card quando entra nel viewport
   (con 100px di anticipo), attivando animazione e immagini.
   ============================================================= */
var cardObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      cardObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '100px' });


/* =============================================================
   LETTURA TESTI LOCALIZZATI DA UN RECORD JSON
   Legge nome e note dalla struttura i18n del campetto,
   con fallback all'italiano se la lingua attiva manca.
   ============================================================= */
function getLocalised(campetto) {
  if (campetto.i18n && campetto.i18n[LANG]) {
    return campetto.i18n[LANG];
  }
  if (campetto.i18n && campetto.i18n['it']) {
    return campetto.i18n['it'];
  }
  return { nome: '', note: '—' };
}


/* =============================================================
   URL MAPPE ESTERNE
   Genera l'URL per aprire le coordinate nell'app di mappe
   selezionata dall'utente (Google Maps o OpenStreetMap).
   ============================================================= */
function getMapsUrl(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) { return '#'; }
  if (mapsProvider === 'osm') {
    return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=18/' + lat + '/' + lng;
  }
  return 'https://www.google.com/maps?q=' + lat + ',' + lng;
}


/* =============================================================
   COSTRUZIONE DI UNA CARD
   Riceve un oggetto campetto dal JSON e restituisce un elemento
   DOM <article class="card"> pronto per la griglia.

   L'albero viene costruito interamente con DOM API: ogni valore
   testuale proveniente dal JSON passa da textContent, rendendo
   impossibile l'iniezione di HTML malevolo (XSS) by design.

   Struttura generata:
   article.card
   ├── img.card-photo | div.card-photo-placeholder
   ├── header.card-header
   │   ├── div.card-num
   │   ├── div.card-name
   │   └── div.card-date + span.freshness
   ├── div.card-body
   │   ├── div.info-row  (Indirizzo)
   │   ├── div.info-row  (Zona)
   │   ├── div.info-row  (Note)
   │   ├── div.info-row  (Foto thumbnail, opzionale)
   │   └── div.booleans  (pill canestri, illuminato, ecc.)
   └── footer.card-footer
       └── a.maps-btn
   ============================================================= */
function buildCard(campetto) {

  var loc  = getLocalised(campetto);
  var nome = loc.nome || '';
  var note = loc.note || '—';

  /* ── Coordinate: accetta solo valori numerici finiti ── */
  var lat = parseFloat(campetto.coordinates.lat);
  var lng = parseFloat(campetto.coordinates.lng);

  /* ── Radice della card ── */
  var card = el('article', 'card');


  /* ── Foto panoramica (o placeholder) ── */

  var overviewUrl = campetto.photos ? safePhotoUrl(campetto.photos.overview) : '';

  if (overviewUrl) {
    var photo   = el('img', 'card-photo');
    photo.src   = overviewUrl;
    photo.alt   = nome;
    photo.loading = 'lazy';
    photo.dataset.photo = overviewUrl;
    card.appendChild(photo);
  } else {
    card.appendChild(textEl('div', 'card-photo-placeholder', '\uD83C\uDFC0'));
  }


  /* ── Header: numero, nome, data + freschezza ── */

  var header = el('header', 'card-header');

  header.appendChild(textEl('div', 'card-num',  '#' + campetto.id));
  header.appendChild(textEl('div', 'card-name', nome));

  var dateStr = campetto.updated || campetto.created;
  var dateDiv = el('div', 'card-date');
    dateDiv.appendChild(document.createTextNode(dateStr));
    dateDiv.appendChild(freshnessNode(dateStr));
  header.appendChild(dateDiv);

  card.appendChild(header);


  /* ── Body: righe informative + pill booleane ── */

  var body = el('div', 'card-body');

  body.appendChild(infoRow(T.labelAddress, campetto.address));

  var area = campetto.city
           + (campetto.district ? ' \u2014 ' + campetto.district : '');
  body.appendChild(infoRow(T.labelArea, area));

  body.appendChild(infoRow(T.labelNotes, note));

  /* Thumbnail foto di dettaglio (opzionale) */
  if (campetto.photos && campetto.photos.details && campetto.photos.details.length > 0) {
    var thumbRow = el('div', 'info-row');
    thumbRow.appendChild(textEl('div', 'info-label', T.labelPhotos));

    var thumbs = el('div', 'thumbs');
    campetto.photos.details.forEach(function (url) {
      var safe = safePhotoUrl(url);
      if (!safe) { return; }
      var img     = el('img');
      img.src     = safe;
      img.alt     = T.labelPhotos;
      img.loading = 'lazy';
      img.dataset.photo = safe;
      thumbs.appendChild(img);
    });
    thumbRow.appendChild(thumbs);
    body.appendChild(thumbRow);
  }

  /* Pill booleane (canestri, illuminato, recintato, ecc.) */
  var bools      = el('div', 'booleans');
  var hoopsCount = parseInt(campetto.hoops, 10) || 0;
  var hoopsLabel = hoopsCount + ' ' + (hoopsCount === 1 ? T.labelHoop : T.labelHoops);

  bools.appendChild(textEl('span', 'bool-pill yes', hoopsLabel));
  bools.appendChild(pillNode(T.labelLit,     campetto.lit));
  bools.appendChild(pillNode(T.labelFenced,  campetto.fenced));
  bools.appendChild(pillNode(T.labelThreePt, campetto.three_pt_line));
  if (campetto.half_court) { bools.appendChild(pillNode(T.labelHalf,    true)); }
  if (campetto.indoor)     { bools.appendChild(pillNode(T.labelIndoors, true)); }

  body.appendChild(bools);
  card.appendChild(body);


  /* ── Footer: link a Google Maps ── */

  var footer = el('footer', 'card-footer');
  var mapsLink    = el('a', 'maps-btn');
  mapsLink.dataset.lat = lat;
  mapsLink.dataset.lng = lng;
  mapsLink.href   = getMapsUrl(lat, lng);
  mapsLink.target = '_blank';
  mapsLink.rel    = 'noopener';
  mapsLink.textContent = T.openInMaps;
  footer.appendChild(mapsLink);

  card.appendChild(footer);

  return card;
}


/* =============================================================
   RENDERING DELLA GRIGLIA
   Svuota la griglia e la ripopola con le card filtrate.
   Usa DocumentFragment per una singola operazione DOM.
   ============================================================= */
function renderCards(lista) {
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  document.getElementById('count').textContent = lista.length;

  if (lista.length === 0) {
    grid.innerHTML = '<div class="state-msg">' + T.noResults + '</div>';
    return;
  }

  var fragment = document.createDocumentFragment();
  lista.forEach(function (campetto) {
    var card = buildCard(campetto);
    cardObserver.observe(card);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}


/* =============================================================
   EVENT DELEGATION — LIGHTBOX
   Un unico listener sulla griglia gestisce i click su tutte
   le immagini (panoramiche e thumbnail). L'URL della foto è
   letto dall'attributo data-photo, già validato in buildCard.
   ============================================================= */
document.getElementById('grid').addEventListener('click', function (event) {
  var img = event.target.closest('[data-photo]');
  if (img) {
    openLightbox(img.getAttribute('data-photo'));
  }
});


/* =============================================================
   APPLICA FILTRI E ORDINAMENTO
   ============================================================= */
function applyFilters() {
  var query    = document.getElementById('search').value.toLowerCase().trim();
  var filtered = DATA.slice();

  /* Filtro per proprietà booleana */
  var boolFilters = ['lit', 'three_pt_line', 'fenced'];
  if (boolFilters.indexOf(activeFilter) !== -1) {
    filtered = filtered.filter(function (c) {
      return c[activeFilter] === true;
    });
  }

  /* Filtro per testo libero nella lingua attiva */
  if (query) {
    filtered = filtered.filter(function (c) {
      var loc  = getLocalised(c);
      var nome = (loc.nome || '').toLowerCase();
      var note = (loc.note || '').toLowerCase();
      return nome.indexOf(query) !== -1
          || c.city.toLowerCase().indexOf(query) !== -1
          || (c.district && c.district.toLowerCase().indexOf(query) !== -1)
          || c.address.toLowerCase().indexOf(query) !== -1
          || note.indexOf(query) !== -1;
    });
  }

  /* Ordinamento */
  if (activeSort === 'id') {
    filtered.sort(function (a, b) {
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  } else if (activeSort === 'date') {
    filtered.sort(function (a, b) {
      return new Date(b.updated || b.created) - new Date(a.updated || a.created);
    });
  }

  renderCards(filtered);
}


/* =============================================================
   LISTENER — RICERCA TESTUALE
   ============================================================= */
document.getElementById('search').addEventListener('input', applyFilters);


/* =============================================================
   LISTENER — PULSANTI FILTRO
   ============================================================= */
document.querySelectorAll('.filter-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilters();
  });
});


/* =============================================================
   LISTENER — PULSANTI ORDINAMENTO
   ============================================================= */
document.querySelectorAll('.sort-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.sort-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    activeSort = btn.dataset.sort;
    applyFilters();
  });
});


/* =============================================================
   LISTENER — TOGGLE PROVIDER MAPPE
   ============================================================= */
function updateAllMapsLinks() {
  document.querySelectorAll('.maps-btn').forEach(function (btn) {
    var lat = parseFloat(btn.dataset.lat);
    var lng = parseFloat(btn.dataset.lng);
    btn.href = getMapsUrl(lat, lng);
  });
}

document.querySelectorAll('.provider-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.provider-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    mapsProvider = btn.dataset.provider;
    localStorage.setItem('mapsProvider', mapsProvider);
    updateAllMapsLinks();
  });
});

/* Inizializza lo stato del toggle dal localStorage */
if (mapsProvider !== 'google') {
  document.querySelectorAll('.provider-btn').forEach(function (btn) {
    btn.classList.remove('active');
    if (btn.dataset.provider === mapsProvider) {
      btn.classList.add('active');
    }
  });
}


/* =============================================================
   CARICAMENTO DATI
   Il parametro ?v= con il timestamp impedisce al browser
   di usare una versione in cache del file JSON.
   ============================================================= */
fetch('alcampetto.json?v=' + Date.now())
  .then(function (response) { return response.json(); })
  .then(function (json) {
    DATA = json;
    applyFilters();
  })
  .catch(function () {
    /* Fallback: il fetch fallisce con il protocollo file://
       Avviare un server locale: python3 -m http.server */
    document.getElementById('grid').innerHTML =
        '<div class="state-msg">'
      + T.serverError + '<br>'
      + '<code style="font-size:0.75rem;color:#FF5F1F">' + T.serverCmd + '</code><br>'
      + T.serverHint
      + '</div>';
  });
