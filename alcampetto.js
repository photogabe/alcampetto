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
    labelBattito:  'Battito',
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
    labelBattito:  'Heartbeat',
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
var DATA          = [];
var activeFilter  = 'all';
var activeSort    = 'id';
var mapsProvider = localStorage.getItem('mapsProvider') || 'google';
var activeView    = 'grid';
var leafletMap    = null;
var markersLayer  = null;
var lastFiltered  = [];



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

/* Verifica che un URL audio sia un percorso relativo sicuro.
   Stesse regole di safePhotoUrl: accetta solo "photos/…". */
function safeAudioUrl(url) {
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
   PLAYER AUDIO "BATTITO"
   Tracciato ECG animato che riproduce l'audio del rimbalzo
   di una palla sul campetto — il battito del campetto.
   ============================================================= */

/* Dati del tracciato ECG (due cicli cardiaci stilizzati) */
var ECG_PATH = 'M0,12 L6,12 L8,10 L10,12 L12,12 L13.5,3 L15,21 L16.5,9 L18,12 L24,12 L27,8 L30,12 L40,12 L46,12 L48,10 L50,12 L52,12 L53.5,3 L55,21 L56.5,9 L58,12 L64,12 L67,8 L70,12 L80,12';

/* Crea un elemento SVG con il tracciato ECG.
   cssClass distingue sfondo (muted) e primo piano (orange). */
function buildEcgSvg(cssClass) {
  var ns  = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 80 24');
  svg.setAttribute('class', cssClass);
  svg.setAttribute('aria-hidden', 'true');
  var path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ECG_PATH);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

/* Avvia o ferma la riproduzione audio del battito.
   Gestisce il ciclo play/pause e l'animazione CSS. */
function toggleBattito(btn) {
  var url = btn.dataset.audio;

  /* Se sta suonando → ferma e resetta */
  if (btn._audio && !btn._audio.paused) {
    btn._audio.pause();
    btn._audio.currentTime = 0;
    btn.classList.remove('playing');
    return;
  }

  /* Crea l'elemento Audio al primo utilizzo */
  if (!btn._audio) {
    var safe = safeAudioUrl(url);
    if (!safe) { return; }
    btn._audio = new Audio(safe);
    btn._audio.addEventListener('ended', function () {
      btn.classList.remove('playing');
    });
  }

  /* Avvia riproduzione con reset animazione */
  btn._audio.currentTime = 0;
  btn.classList.remove('playing');
  void btn.offsetWidth;
  btn.classList.add('playing');
  btn._audio.play().catch(function () {
    btn.classList.remove('playing');
  });
}


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
   MAPPA LEAFLET
   Inizializzazione lazy: la mappa viene creata solo al primo
   click sul tab "Mappa". I marker sono gestiti in un LayerGroup
   separato, svuotato e ripopolato ad ogni cambio di filtri.
   I popup usano DOM API (textContent) per coerenza XSS-safe.
   ============================================================= */

/* Crea la mappa Leaflet centrata su Milano (solo al primo uso) */
function initMap() {
  if (leafletMap) { return; }
  leafletMap = L.map('map').setView([45.464, 9.19], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(leafletMap);
  markersLayer = L.layerGroup().addTo(leafletMap);
  updateMapMarkers(lastFiltered);
}

/* Aggiorna i marker sulla mappa in base alla lista filtrata */
function updateMapMarkers(lista) {
  if (!markersLayer) { return; }
  markersLayer.clearLayers();

  var bounds = [];
  lista.forEach(function (c) {
    var lat = parseFloat(c.coordinates.lat);
    var lng = parseFloat(c.coordinates.lng);
    if (!isFinite(lat) || !isFinite(lng)) { return; }

    var loc        = getLocalised(c);
    var nome       = loc.nome || '';
    var hoopsCount = parseInt(c.hoops, 10) || 0;
    var hoopsLabel = hoopsCount + ' ' + (hoopsCount === 1 ? T.labelHoop : T.labelHoops);

    /* Popup costruito con DOM API — nessun innerHTML dal JSON */
    var popup = el('div', 'map-popup');
    popup.appendChild(textEl('div', 'map-popup-name', '#' + c.id + ' \u2014 ' + nome));
    popup.appendChild(textEl('div', 'map-popup-address', c.address));
    popup.appendChild(textEl('div', 'map-popup-hoops', hoopsLabel));

    var marker = L.marker([lat, lng]).bindPopup(popup);
    markersLayer.addLayer(marker);
    bounds.push([lat, lng]);
  });

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [30, 30] });
  }
}

/* Alterna tra vista griglia e vista mappa */
function switchView(view) {
  activeView = view;
  var grid = document.getElementById('grid');
  var map  = document.getElementById('map');

  document.querySelectorAll('.view-tab').forEach(function (tab) {
    tab.classList.remove('active');
    if (tab.dataset.view === view) { tab.classList.add('active'); }
  });

  if (view === 'grid') {
    grid.style.display = '';
    map.classList.remove('active');
  } else {
    grid.style.display = 'none';
    map.classList.add('active');
    initMap();
    /* Leaflet ha bisogno di ricalcolare le dimensioni dopo
       che il contenitore diventa visibile */
    setTimeout(function () { leafletMap.invalidateSize(); }, 100);
  }
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

   Struttura generata (layout "Respiro duale"):
   article.card
   ├── img.card-photo | div.card-photo-placeholder
   ├── div.thumbs  (ribbon sovrapposto alla foto, opzionale)
   ├── header.card-header
   │   ├── div.card-num
   │   ├── div.card-name
   │   └── div.card-date + span.freshness
   ├── div.card-body
   │   ├── div.info-row  (Indirizzo)
   │   ├── div.info-row  (Zona)
   │   ├── div.info-row  (Note)
   │   └── div.booleans  (pill canestri, illuminato, ecc.)
   └── footer.card-footer
       ├── a.maps-btn
       └── button.battito-btn (player audio, opzionale)
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


  /* ── Ribbon thumbnail (sovrapposto al bordo inferiore della foto) ── */

  if (campetto.photos && campetto.photos.details && campetto.photos.details.length > 0) {
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
    card.appendChild(thumbs);
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


  /* ── Footer: link a Google Maps + player audio battito ── */

  var footer = el('footer', 'card-footer');
  var mapsLink    = el('a', 'maps-btn');
  mapsLink.dataset.lat = lat;
  mapsLink.dataset.lng = lng;
  mapsLink.href   = getMapsUrl(lat, lng);
  mapsLink.target = '_blank';
  mapsLink.rel    = 'noopener';
  mapsLink.textContent = T.openInMaps;
  footer.appendChild(mapsLink);

  /* Player audio "battito" — visibile solo se il campetto
     ha un file audio associato (campo "audio" nel JSON) */
  var audioUrl = campetto.audio ? safeAudioUrl(campetto.audio) : '';
  if (audioUrl) {
    var battitoBtn = el('button', 'battito-btn');
    battitoBtn.type = 'button';
    battitoBtn.dataset.audio = audioUrl;

    var ecgWrap = el('div', 'battito-ecg');
    ecgWrap.appendChild(buildEcgSvg('battito-ecg-bg'));
    ecgWrap.appendChild(buildEcgSvg('battito-ecg-fg'));
    battitoBtn.appendChild(ecgWrap);

    battitoBtn.appendChild(textEl('span', 'battito-label', T.labelBattito));
    footer.appendChild(battitoBtn);
  }

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
   EVENT DELEGATION — LIGHTBOX + BATTITO
   Un unico listener sulla griglia gestisce i click su tutte
   le immagini (lightbox) e sui pulsanti battito (audio).
   ============================================================= */
document.getElementById('grid').addEventListener('click', function (event) {
  /* Player audio battito */
  var battitoBtn = event.target.closest('.battito-btn');
  if (battitoBtn) {
    toggleBattito(battitoBtn);
    return;
  }
  /* Lightbox foto */
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

  lastFiltered = filtered;
  renderCards(filtered);
  updateMapMarkers(filtered);
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
   LISTENER — TAB VISTA (Griglia / Mappa)
   ============================================================= */
document.querySelectorAll('.view-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    switchView(tab.dataset.view);
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
