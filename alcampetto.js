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
    labelHoops:    'canestri',
    labelHoop:     'canestro',
    labelHalf:     'Mezzo campo',
    labelThreePt:  'Linea da tre',
    openInMaps:    '📍 Apri in Maps',
    labelBattito:  'Battito',
    labelArchive:  'Archivio fotografico',
    labelSurveys:  'rilevazioni',
    labelOverview: 'overview',
    labelContext:  'contesto',
    labelDetail:   'dettaglio',
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
    labelHoops:    'hoops',
    labelHoop:     'hoop',
    labelHalf:     'Half court',
    labelThreePt:  'Three-pt line',
    openInMaps:    '📍 Open in Maps',
    labelBattito:  'Heartbeat',
    labelArchive:  'Photo archive',
    labelSurveys:  'surveys',
    labelOverview: 'overview',
    labelContext:  'context',
    labelDetail:   'detail',
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
   Accetta solo percorsi che iniziano con "audio/". */
function safeAudioUrl(url) {
  if (typeof url !== 'string') { return ''; }
  var trimmed = url.trim();
  if (/^[a-z][a-z0-9+.\-]*:/i.test(trimmed)) { return ''; }
  if (!trimmed.startsWith('audio/'))           { return ''; }
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
   Overlay fullscreen: hero + mosaico Mondrian + foto d'autore.
   Il contenuto viene costruito dinamicamente dal dato del
   campetto cliccato.
   ============================================================= */

var lightbox      = document.getElementById('lightbox');
var lightboxClose = document.getElementById('lightbox-close');

/* Tenta di caricare la variante -full.webp di una foto.
   Se il file non esiste, il browser ricade sulla versione
   standard tramite l'handler onerror. */
function setFullImg(imgEl, src) {
  var fullSrc = src.replace(/\.webp$/, '-full.webp');
  imgEl.src = fullSrc;
  imgEl.onerror = function () {
    imgEl.onerror = null;
    imgEl.src = src;
  };
}

/* Costruisce l'intero overlay a partire da un oggetto campetto.
   photos è un array di rilevazioni (photos[0] = più recente).
   Se il campetto ha più di una rilevazione, una sezione
   "contact sheet" mostra le versioni precedenti delle foto. */
function openLightbox(campetto) {
  var loc       = getLocalised(campetto);
  var nome      = loc.nome || '';
  var allPhotos = campetto.photos || [];
  var latest    = allPhotos[0] || {};

  /* Rimuove il contenuto precedente (mantiene il pulsante ✕) */
  while (lightbox.lastChild !== lightboxClose) {
    lightbox.removeChild(lightbox.lastChild);
  }

  /* ── Hero: overview a schermo pieno ── */
  var overviewUrl = safePhotoUrl(latest.overview);
  if (overviewUrl) {
    var hero    = el('section', 'lb-hero');
    var heroImg = el('img');
    setFullImg(heroImg, overviewUrl);
    heroImg.alt = nome;
    hero.appendChild(heroImg);

    var cap  = el('div', 'lb-hero-caption');
    cap.appendChild(textEl('h2', '', nome));
    var meta = campetto.city
             + (campetto.district ? ' \u00b7 ' + campetto.district : '')
             + ' \u00b7 #' + campetto.id;
    cap.appendChild(textEl('div', 'lb-hero-meta', meta));
    hero.appendChild(cap);
    lightbox.appendChild(hero);
  }

  /* ── Mosaico Mondrian: contesto + dettagli ── */
  var mosaicPhotos = [];

  var contextUrl = latest.context ? safePhotoUrl(latest.context) : '';
  if (contextUrl) {
    mosaicPhotos.push(contextUrl);
  }

  if (latest.details) {
    latest.details.forEach(function (url) {
      var safe = safePhotoUrl(url);
      if (safe) {
        mosaicPhotos.push(safe);
      }
    });
  }

  if (mosaicPhotos.length > 0) {
    var mondrian = el('section', 'lb-mondrian');
    mosaicPhotos.forEach(function (src) {
      var cell = el('div', 'm-cell');
      var img  = el('img');
      setFullImg(img, src);
      img.alt     = '';
      img.loading = 'lazy';
      cell.appendChild(img);
      mondrian.appendChild(cell);
    });
    lightbox.appendChild(mondrian);
  }

  /* ── Foto d'autore (opzionale, staccata) ── */
  var autorePhotos = latest.autore || [];
  if (autorePhotos.length > 0) {
    var section = el('section', 'lb-autore');
    section.appendChild(el('div', 'lb-autore-sep'));
    autorePhotos.forEach(function (url) {
      var safe = safePhotoUrl(url);
      if (!safe) { return; }
      var item = el('div', 'lb-autore-item');
      var img  = el('img');
      setFullImg(img, safe);
      img.alt = '';
      item.appendChild(img);
      section.appendChild(item);
    });
    lightbox.appendChild(section);
  }

  /* ── Contact sheet (solo se più di una rilevazione) ── */
  if (allPhotos.length > 1) {
    lightbox.appendChild(buildContactSheet(allPhotos, latest.date));
  }

  /* Mostra l'overlay */
  lightbox.classList.add('open');
  lightbox.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}


/* =============================================================
   CONTACT SHEET TEMPORALE
   Sezione che compare nel lightbox quando un campetto ha più
   di una rilevazione fotografica. Mostra una striscia orizzontale
   per ogni slot (overview, contesto, dettagli) che ha almeno
   due versioni nel tempo.
   ============================================================= */

/* Formatta una data ISO in etichetta breve ("feb 2026") */
function shortDate(iso) {
  var d = new Date(iso);
  var months = LANG === 'en'
    ? ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    : ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

/* Costruisce l'intera sezione contact sheet */
function buildContactSheet(allPhotos, latestDate) {
  var cs = el('section', 'lb-contact-sheet');

  var title = el('div', 'lb-contact-sheet-title');
  title.textContent = T.labelArchive + ' \u00b7 '
                    + allPhotos.length + ' ' + T.labelSurveys;
  cs.appendChild(title);

  /* Raccogli slot per tipo: ogni slot raggruppa le versioni
     di una stessa foto (overview, contesto, dettaglio N)
     attraverso le rilevazioni. */
  var slots = {};

  allPhotos.forEach(function (survey) {
    if (survey.overview && safePhotoUrl(survey.overview)) {
      if (!slots['overview']) { slots['overview'] = []; }
      slots['overview'].push({ date: survey.date, url: survey.overview });
    }
    if (survey.context && safePhotoUrl(survey.context)) {
      if (!slots['context']) { slots['context'] = []; }
      slots['context'].push({ date: survey.date, url: survey.context });
    }
    if (survey.details) {
      survey.details.forEach(function (url, i) {
        if (!safePhotoUrl(url)) { return; }
        var key = 'detail-' + (i + 1);
        if (!slots[key]) { slots[key] = []; }
        slots[key].push({ date: survey.date, url: url });
      });
    }
  });

  /* Ordine di rendering: overview, contesto, poi dettagli */
  var slotOrder = ['overview', 'context'];
  Object.keys(slots).forEach(function (k) {
    if (slotOrder.indexOf(k) === -1) { slotOrder.push(k); }
  });

  /* Render solo slot con ≥ 2 versioni */
  var hasContent = false;

  slotOrder.forEach(function (slotName) {
    var entries = slots[slotName];
    if (!entries || entries.length < 2) { return; }
    hasContent = true;

    var row = el('div', 'cs-row');

    /* Etichetta dello slot */
    var label;
    if (slotName === 'overview') { label = T.labelOverview; }
    else if (slotName === 'context') { label = T.labelContext; }
    else { label = T.labelDetail + ' ' + slotName.split('-')[1]; }
    row.appendChild(textEl('div', 'cs-row-label', label));

    var strip = el('div', 'cs-strip');

    /* Container per la foto espansa (sotto la strip) */
    var expandBox = el('div', 'cs-expand');

    /* Ordine cronologico: più vecchia a sinistra */
    var sorted = entries.slice().reverse();

    sorted.forEach(function (entry) {
      var isCurrent = (entry.date === latestDate);
      var thumb = el('div', 'cs-thumb' + (isCurrent ? ' current' : ''));

      var img     = el('img');
      img.src     = safePhotoUrl(entry.url);
      img.alt     = label + ' — ' + shortDate(entry.date);
      img.loading = 'lazy';
      thumb.appendChild(img);

      thumb.appendChild(textEl('div', 'cs-thumb-date', shortDate(entry.date)));

      /* Click → espande la foto sotto la striscia */
      thumb.addEventListener('click', (function (e) {
        return function () {
          /* Toggle: se già aperta sulla stessa data, chiudi */
          if (expandBox.classList.contains('open') && expandBox.dataset.date === e.date) {
            expandBox.classList.remove('open');
            return;
          }
          expandBox.innerHTML = '';

          var inner = el('div', 'cs-expand-inner');
          var expImg = el('img');
          setFullImg(expImg, e.url);
          expImg.alt = label + ' — ' + shortDate(e.date);
          inner.appendChild(expImg);

          var meta = el('div', 'cs-expand-meta');
          meta.appendChild(textEl('span', '', label));
          meta.appendChild(textEl('span', '', shortDate(e.date)));
          inner.appendChild(meta);

          expandBox.appendChild(inner);
          expandBox.dataset.date = e.date;
          expandBox.classList.add('open');
        };
      })(entry));

      strip.appendChild(thumb);
    });

    row.appendChild(strip);
    row.appendChild(expandBox);
    cs.appendChild(row);
  });

  /* Se nessuno slot ha ≥ 2 versioni, non mostrare la sezione */
  if (!hasContent) { return document.createDocumentFragment(); }

  return cs;
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && lightbox.classList.contains('open')) {
    closeLightbox();
  }
});


/* =============================================================
   PLAYER AUDIO "BATTITO"
   Tracciato ECG animato che riproduce l'audio del rimbalzo
   di una palla sul campetto — il battito del campetto.
   ============================================================= */

/* Dati del tracciato ECG (tre cicli con micro-variazioni).
   Ogni ciclo occupa ~27 unità SVG: baseline → onda P (Bézier) →
   complesso QRS (picco netto) → onda T (Bézier) → baseline.
   Le lievi differenze tra i cicli (ampiezza P/T, picco QRS,
   lunghezza segmenti) rendono il battito più organico.
   Tre cicli anziché quattro alleggeriscono la resa visiva
   quando l'animazione si ripete su molte card in parallelo.
   La durata dell'animazione in style.css deve corrispondere
   alla durata dell'audio (10.104 s — audio/001/001_beat.mp3). */
var ECG_PATH = 'M0,12 L4,12 Q6,10 8,12 L10,12 L11.5,2 L13,20 L14.5,12 L16.5,12 Q19,7.5 21.5,12 L27,12 L31,12 Q33,9.5 35,12 L37,12 L38.5,1.5 L40,20.5 L41.5,12 L43.5,12 Q46,8 48.5,12 L53,12 L57,12 Q59,10.5 61,12 L63,12 L64.5,2.5 L66,19.5 L67.5,11.5 L69.5,12 Q72,8.5 74.5,12 L80,12';
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
  card._campetto = campetto;


  /* ── Foto panoramica (o placeholder) ──
     photos è un array di rilevazioni; la card mostra solo
     la più recente (photos[0]). */

  var latestPhotos = (campetto.photos && campetto.photos[0]) || {};
  var overviewUrl  = safePhotoUrl(latestPhotos.overview);

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

  if (latestPhotos.details && latestPhotos.details.length > 0) {
    var thumbs = el('div', 'thumbs');
    latestPhotos.details.slice(0, 3).forEach(function (url) {
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
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'state-msg';
    emptyMsg.textContent = T.noResults;
    grid.appendChild(emptyMsg);
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
    var card = img.closest('.card');
    if (card && card._campetto) {
      openLightbox(card._campetto);
    }
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
   AGGIORNAMENTO TAGLINE
   Calcola barra di progresso, numero di campetti mappati e
   percentuale rispetto alla stima totale (~180).
   La barra è larga 20 caratteri: ogni "█" vale il 5%.
   ============================================================= */
function updateTagline() {
  var TOTAL_ESTIMATE = 180;
  var BAR_WIDTH = 20;
  var count = DATA.length;
  var ratio = Math.min(count / TOTAL_ESTIMATE, 1);
  var filled = Math.round(ratio * BAR_WIDTH);
  var bar = '[' + '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled) + ']';
  var percent = Math.round(ratio * 100);

  var barEl     = document.getElementById('progress-bar');
  var countEl   = document.getElementById('court-count');
  var totalEl   = document.getElementById('court-total');
  var percentEl = document.getElementById('court-percent');
  if (barEl)     barEl.textContent     = bar;
  if (countEl)   countEl.textContent   = count;
  if (totalEl)   totalEl.textContent   = TOTAL_ESTIMATE;
  if (percentEl) percentEl.textContent = percent;
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
    updateTagline();
    applyFilters();
  })
  .catch(function () {
    /* Fallback: il fetch fallisce con il protocollo file://
       Avviare un server locale: python3 -m http.server */
    var grid = document.getElementById('grid');
    grid.innerHTML = '';
    var errMsg = document.createElement('div');
    errMsg.className = 'state-msg';
    errMsg.appendChild(document.createTextNode(T.serverError));
    errMsg.appendChild(document.createElement('br'));
    var cmd = document.createElement('code');
    cmd.textContent = T.serverCmd;
    errMsg.appendChild(cmd);
    errMsg.appendChild(document.createElement('br'));
    errMsg.appendChild(document.createTextNode(T.serverHint));
    grid.appendChild(errMsg);
  });
