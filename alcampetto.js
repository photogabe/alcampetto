/* =============================================================
   ALCAMPETTO · alcampetto.js · v0.3.0
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


/* =============================================================
   LIGHTBOX
   Apre e chiude il visualizzatore foto a schermo intero.
   ============================================================= */

var lightbox      = document.getElementById('lightbox');
var lightboxImg   = document.getElementById('lightbox-img');
var lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src) {
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

/* Restituisce l'HTML dell'indicatore di freschezza */
function freshnessHtml(isoDateString) {
  var cssClass = freshnessClass(isoDateString);
  var label    = T[cssClass];
  return '<span class="freshness ' + cssClass + '">'
       +   '<span class="freshness-dot"></span>'
       +   label
       + '</span>';
}


/* =============================================================
   PILL BOOLEANE
   label : stringa da mostrare (es. "Illuminato")
   value : true → pill verde · false → pill grigia
   ============================================================= */
function pill(label, value) {
  var cssClass = value ? 'yes' : 'no';
  var icon     = value ? '✓'   : '✗';
  return '<span class="bool-pill ' + cssClass + '">' + icon + ' ' + label + '</span>';
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
   COSTRUZIONE DI UNA CARD
   Riceve un oggetto campetto dal JSON e restituisce
   un elemento DOM <div class="card"> pronto per la griglia.
   ============================================================= */
function buildCard(campetto) {

  var loc      = getLocalised(campetto);
  var nome     = loc.nome || '';
  var note     = loc.note || '—';
  var mapsUrl  = 'https://www.google.com/maps?q='
               + campetto.coordinate.lat + ',' + campetto.coordinate.lng;
  var coordStr = campetto.coordinate.lat.toFixed(4)
               + ', ' + campetto.coordinate.lng.toFixed(4);

  /* Foto panoramica o placeholder */
  var photoHtml = '';
  if (campetto.foto && campetto.foto.overview) {
    photoHtml = '<img class="card-photo"'
              + ' src="' + campetto.foto.overview + '"'
              + ' alt="' + nome + '"'
              + ' loading="lazy"'
              + ' onclick="openLightbox(\'' + campetto.foto.overview + '\')">';
  } else {
    photoHtml = '<div class="card-photo-placeholder">🏀</div>';
  }

  /* Thumbnail foto di dettaglio */
  var thumbsHtml = '';
  if (campetto.foto && campetto.foto.dettagli && campetto.foto.dettagli.length > 0) {
    var imgs = campetto.foto.dettagli.map(function (url) {
      return '<img src="' + url + '" alt="' + T.labelPhotos + '"'
           + ' loading="lazy"'
           + ' onclick="openLightbox(\'' + url + '\')">';
    }).join('');
    thumbsHtml = '<div class="info-row">'
               +   '<div class="info-label">' + T.labelPhotos + '</div>'
               +   '<div class="thumbs">' + imgs + '</div>'
               + '</div>';
  }

  var div = document.createElement('div');
  div.className = 'card';

  div.innerHTML =
      photoHtml
    + '<div class="card-header">'
    +   '<div class="card-num">#' + campetto.id + '</div>'
    +   '<div class="card-name">' + nome + '</div>'
    +   '<div class="card-date">'
    +     campetto.data
    +     freshnessHtml(campetto.aggiornato || campetto.data)
    +   '</div>'
    + '</div>'
    + '<div class="card-body">'
    +   '<div class="info-row">'
    +     '<div class="info-label">' + T.labelAddress + '</div>'
    +     '<div class="info-val">'   + campetto.indirizzo + '</div>'
    +   '</div>'
    +   '<div class="info-row">'
    +     '<div class="info-label">' + T.labelArea + '</div>'
    +     '<div class="info-val">' + campetto.comune + (campetto.municipio ? ' \u2014 ' + campetto.municipio : '') + '</div>'
    +   '</div>'
    +   '<div class="info-row">'
    +     '<div class="info-label">' + T.labelNotes + '</div>'
    +     '<div class="info-val">'   + note + '</div>'
    +   '</div>'
    +   thumbsHtml
    +   '<div class="booleans">'
    +     pill(T.labelLit,     campetto.illuminato)
    +     pill(T.labelFenced,  campetto.recintato)
    +     pill(T.labelIndoors, campetto.coperto)
    +   '</div>'
    + '</div>'
    + '<div class="card-footer">'
    +   '<a class="maps-btn" href="' + mapsUrl + '" target="_blank">' + T.openInMaps + '</a>'
    +   '<div class="coord">' + coordStr + '</div>'
    + '</div>';

  return div;
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
   APPLICA FILTRI E ORDINAMENTO
   ============================================================= */
function applyFilters() {
  var query    = document.getElementById('search').value.toLowerCase().trim();
  var filtered = DATA.slice();

  /* Filtro per proprietà booleana */
  var boolFilters = ['illuminato', 'coperto', 'recintato'];
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
          || c.comune.toLowerCase().indexOf(query) !== -1
          || (c.municipio && c.municipio.toLowerCase().indexOf(query) !== -1)
          || c.indirizzo.toLowerCase().indexOf(query) !== -1
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
      return new Date(b.aggiornato || b.data) - new Date(a.aggiornato || a.data);
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
