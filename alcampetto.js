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
    noResults:     'Nessun campetto trovato 🏀',
    serverError:   '⚠ Per visualizzare i dati, avvia un server locale',
    serverCmd:     'python3 -m http.server',
    serverHint:    'oppure usa GitHub Pages.',
    labelAddress:  'Indirizzo',
    labelArea:     'Zona',
    labelManto:    'Manto',
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
    labelRacconto: 'Il racconto del battito',
    labelArchive:  'Archivio fotografico',
    labelSurveys:  'rilevazioni',
    labelOverview: 'overview',
    labelContext:  'contesto',
    labelDetail:   'dettaglio',
    labelInSeries: 'campetti in serie',
    fresh:         'Aggiornato',
    aging:         'Da riverificare',
    stale:         'Datato'
  },

  en: {
    noResults:     'No courts found 🏀',
    serverError:   '⚠ To view data, start a local server',
    serverCmd:     'python3 -m http.server',
    serverHint:    'or deploy to GitHub Pages.',
    labelAddress:  'Address',
    labelArea:     'Area',
    labelManto:    'Surface',
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
    labelRacconto: 'The story of this heartbeat',
    labelArchive:  'Photo archive',
    labelSurveys:  'surveys',
    labelOverview: 'overview',
    labelContext:  'context',
    labelDetail:   'detail',
    labelInSeries: 'courts in series',
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
   TRADUZIONE DEI VALORI DI "surface" (manto)
   Nel JSON il manto è il valore rilevato, in italiano: qui c'è
   solo la sua presentazione per le pagine non italiane.
   I valori ammessi sono fissati dall'enum dello schema
   (alcampetto.schema.json): un valore nuovo va aggiunto prima
   lì, poi qui con la sua traduzione.
   ------------------------------------------------------------- */
var SURFACE_EN = {
  'cemento':                        'concrete',
  'asfalto':                        'asphalt',
  'gomma':                          'rubber',
  'granulato sferoidale di quarzo': 'quartz'
};

/* Il valore di surface nella lingua attiva. Se la traduzione
   manca, si mostra il valore italiano del JSON. */
function surfaceLabel(value) {
  if (LANG === 'en' && SURFACE_EN[value]) { return SURFACE_EN[value]; }
  return value;
}


/* -------------------------------------------------------------
   STATO DELL'INTERFACCIA
   ------------------------------------------------------------- */
var DATA          = [];
var COLORS        = {};    /* colori dei manti, da colors.json (derivato) */
var activeFilter  = 'all';
var activeSort    = 'id';
var mapsProvider = localStorage.getItem('mapsProvider') || 'google';
var activeView    = 'grid';  /* vista attiva: 'grid', 'map' o 'serie' */
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

/* Verifica che un colore letto da colors.json sia una tripletta
   esadecimale (#rrggbb): è l'unico formato che finisce dentro
   uno stile della pagina. Restituisce il colore se valido,
   stringa vuota altrimenti. */
function safeHexColor(value) {
  if (typeof value !== 'string') { return ''; }
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
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
   Overlay fullscreen: hero + mosaico Mondrian.
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
  currentId     = campetto.id;
  var loc       = getLocalised(campetto);
  var nome      = loc.nome || '';
  var allPhotos = campetto.photos || [];
  var latest    = allPhotos[0] || {};

  /* Ferma l'eventuale battito del campetto precedente */
  stopLightboxAudio();

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

  /* ── Battito (solo se il campetto ha una registrazione) ── */
  var lightboxAudioUrl = campetto.audio ? safeAudioUrl(campetto.audio) : '';
  if (lightboxAudioUrl) {
    lightbox.appendChild(buildBattitoSection(lightboxAudioUrl));
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
   BATTITO NEL LIGHTBOX
   Sezione tra il mosaico e il contact sheet, per i campetti che
   hanno la registrazione audio. La stessa registrazione ha due
   presentazioni, scelte dal CSS in base alla larghezza:
     - schermi grandi: tracciato pieno (680 picchi) alto 72px,
       con pulsante play circolare;
     - fino a 600px: player compatto, identico a quello della
       scheda (tracciato condensato a 170 picchi).
   Un solo oggetto Audio serve entrambi i pulsanti; viene fermato
   alla chiusura del lightbox o aprendo un altro campetto.
   ============================================================= */

/* L'audio in riproduzione nel lightbox (null = nessuno) */
var lightboxAudio = null;

function stopLightboxAudio() {
  if (lightboxAudio && !lightboxAudio.paused) {
    lightboxAudio.pause();
  }
  lightboxAudio = null;
}

/* Geometria del tracciato ricco, in pixel: ogni barra è larga
   RICH_BAR_PX con RICH_GAP_PX di aria — la stessa proporzione
   pieno/vuoto del tracciato della scheda (circa 70/30), ma
   inchiodata alla griglia dei pixel: niente stiramento, niente
   barre sfocate o vuoti irregolari. RICH_HEIGHT_PX deve
   coincidere con l'altezza di .lb-wave nel CSS. */
var RICH_BAR_PX    = 2;
var RICH_GAP_PX    = 1;
var RICH_HEIGHT_PX = 72;

/* Disegna il tracciato del player ricco in spazio pixel:
   1 unità di viewBox = 1 pixel, nessuna deformazione. */
function buildRichWaveformSvg(peaks, cssClass) {
  var ns = 'http://www.w3.org/2000/svg';
  var pitch  = RICH_BAR_PX + RICH_GAP_PX;
  var width  = peaks.length * pitch - RICH_GAP_PX;
  var center = RICH_HEIGHT_PX / 2;

  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + RICH_HEIGHT_PX);
  svg.setAttribute('width', width);
  svg.setAttribute('height', RICH_HEIGHT_PX);
  svg.setAttribute('class', cssClass);
  svg.setAttribute('aria-hidden', 'true');

  for (var i = 0; i < peaks.length; i++) {
    var barHeight = peaks[i] * (RICH_HEIGHT_PX - 4);
    if (barHeight < 1) {
      barHeight = 1;            // anche il silenzio resta una traccia visibile
    }
    var bar = document.createElementNS(ns, 'rect');
    bar.setAttribute('x', i * pitch);
    bar.setAttribute('y', center - barHeight / 2);
    bar.setAttribute('width', RICH_BAR_PX);
    bar.setAttribute('height', barHeight);
    bar.setAttribute('fill', 'currentColor');
    svg.appendChild(bar);
  }
  return svg;
}

/* (Ri)disegna il tracciato ricco alla larghezza attuale del suo
   contenitore: ricampiona i picchi al numero di barre che ci
   stanno (una ogni RICH_BAR_PX + RICH_GAP_PX pixel) e sovrappone
   i due strati, sfondo grigio + primo piano arancione animabile.
   Chiamata alla costruzione della sezione e a ogni
   ridimensionamento della finestra. */
function fillRichWave(waveRich, peaksData) {
  waveRich.innerHTML = '';
  var pitch = RICH_BAR_PX + RICH_GAP_PX;
  var barCount = Math.floor(waveRich.clientWidth / pitch)
                 || CARD_PEAK_COUNT;
  var richPeaks = resamplePeaks(peaksData, barCount);
  waveRich.appendChild(buildRichWaveformSvg(richPeaks, 'lb-wave-bg'));
  waveRich.appendChild(buildRichWaveformSvg(richPeaks, 'lb-wave-fg'));
}

/* Al ridimensionamento della finestra il tracciato ricco viene
   ridisegnato alla nuova larghezza. Un solo listener globale,
   con una piccola attesa (debounce) per non ridisegnare a ogni
   pixel di trascinamento. Se il battito sta suonando viene
   fermato: la posizione dell'animazione non sopravviverebbe
   al ridisegno e resterebbe fuori sincrono. */
var battitoResizeTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(battitoResizeTimer);
  battitoResizeTimer = setTimeout(function () {
    var section = document.querySelector('.lb-battito');
    if (!section || !section._peaksData) { return; }

    if (section.classList.contains('playing')) {
      stopLightboxAudio();
      section.classList.remove('playing');
    }
    fillRichWave(section.querySelector('.lb-wave'), section._peaksData);
  }, 150);
});

/* =============================================================
   IL RACCONTO DEL BATTITO
   Testo opzionale che accompagna la registrazione (es. la voce
   di un abitante del quartiere). NON vive nel JSON: è un file
   di testo accanto all'mp3, uno per lingua —
       audio/<id>/<id>-beat.it.txt
       audio/<id>/<id>-beat.en.txt
   Se il file esiste, nella sezione battito compare l'icona "i"
   che apre un overlay sopra il lightbox; se manca, niente icona.
   Per aggiungere un racconto basta quindi creare il file nella
   cartella dell'audio: nessuna rigenerazione, nessun build.
   ============================================================= */

/* Cerca il racconto nella lingua attiva, con ripiego
   sull'italiano. Chiama trovato(testo) solo se un file esiste
   e ha contenuto. Il controllo response.ok è essenziale: per
   fetch un 404 non è un errore, e senza il controllo finiremmo
   per mostrare la pagina d'errore del server come racconto. */
function loadBattitoStory(audioUrl, trovato) {
  var base = audioUrl.replace(/\.mp3$/, '');

  function prova(lingua, altrimenti) {
    fetch(base + '.' + lingua + '.txt')
      .then(function (response) {
        if (!response.ok) { throw new Error('file assente'); }
        return response.text();
      })
      .then(function (testo) {
        testo = testo.trim();
        if (testo) { trovato(testo); }
        else if (altrimenti) { altrimenti(); }
      })
      .catch(function () {
        if (altrimenti) { altrimenti(); }
      });
  }

  if (LANG !== 'it') {
    prova(LANG, function () { prova('it', null); });
  } else {
    prova('it', null);
  }
}

/* L'overlay del racconto: costruito una volta sola, appeso al
   body (sta SOPRA il lightbox), riempito a ogni apertura.
   Si chiude con ✕, con un click fuori dal pannello o con Escape
   (gestito nel listener globale della tastiera). */
var infoOverlay = null;

function ensureInfoOverlay() {
  if (infoOverlay) { return; }

  infoOverlay = el('div', 'lb-info-overlay');

  var panel = el('div', 'lb-info-panel');
  var close = el('button', 'lb-info-close');
  close.type = 'button';
  close.textContent = '✕';
  close.addEventListener('click', closeBattitoInfo);
  panel.appendChild(close);
  panel.appendChild(textEl('h3', '', T.labelBattito));
  panel.appendChild(el('div', 'lb-info-testo'));
  infoOverlay.appendChild(panel);

  /* click sul fondo scuro (non sul pannello) → chiudi */
  infoOverlay.addEventListener('click', function (event) {
    if (event.target === infoOverlay) { closeBattitoInfo(); }
  });

  document.body.appendChild(infoOverlay);
}

function openBattitoInfo(testo) {
  ensureInfoOverlay();

  /* un paragrafo per ogni blocco separato da riga vuota;
     tutto passa da textContent: nessun HTML dal file */
  var contenitore = infoOverlay.querySelector('.lb-info-testo');
  contenitore.innerHTML = '';
  testo.split(/\n\s*\n/).forEach(function (paragrafo) {
    contenitore.appendChild(textEl('p', '', paragrafo.trim()));
  });

  infoOverlay.classList.add('open');
}

function closeBattitoInfo() {
  if (infoOverlay) { infoOverlay.classList.remove('open'); }
}


/* Costruisce l'intera sezione del battito per il lightbox.
   audioUrl è già passato da safeAudioUrl. */
function buildBattitoSection(audioUrl) {
  var section = el('section', 'lb-battito');

  var title = el('div', 'lb-battito-title');
  title.appendChild(textEl('span', '', T.labelBattito));
  section.appendChild(title);

  /* Se il racconto esiste, accanto al titolo compare l'icona "i" */
  loadBattitoStory(audioUrl, function (testo) {
    var infoBtn = el('button', 'lb-info-btn');
    infoBtn.type = 'button';
    infoBtn.textContent = 'i';
    infoBtn.title = T.labelRacconto;
    infoBtn.setAttribute('aria-label', T.labelRacconto);
    infoBtn.addEventListener('click', function () {
      openBattitoInfo(testo);
    });
    title.appendChild(infoBtn);
  });

  /* Player ricco (schermi grandi): play circolare + tracciato pieno */
  var rich = el('div', 'lb-battito-rich');
  var playBig = el('button', 'lb-play-big');
  playBig.type = 'button';
  playBig.setAttribute('aria-label', T.labelBattito);
  playBig.appendChild(buildPlaySvg());
  var waveRich = el('div', 'lb-wave');
  rich.appendChild(playBig);
  rich.appendChild(waveRich);
  section.appendChild(rich);

  /* Player compatto (smartphone): come nella scheda */
  var compact = el('button', 'battito-btn lb-battito-compact');
  compact.type = 'button';
  compact.appendChild(buildPlaySvg());
  compact.appendChild(textEl('span', 'battito-label', T.labelBattito));
  var waveCompact = el('div', 'battito-wave');
  compact.appendChild(waveCompact);
  section.appendChild(compact);

  /* Tracciati dal .peaks.json. Il player ricco è ADATTIVO e
     disegnato in SPAZIO PIXEL (vedi fillRichWave): il numero di
     barre discende dalla larghezza reale del contenitore — più
     schermo, più barre — e si ricalcola anche al ridimensionamento
     della finestra. Il file a 680 picchi è il serbatoio.
     Il player compatto usa la stessa risoluzione della scheda. */
  fetch(audioUrl.replace(/\.mp3$/, '.peaks.json'))
    .then(function (response) { return response.json(); })
    .then(function (peaks) {
      /* i picchi restano sul nodo: servono ai ridisegni futuri */
      section._peaksData = peaks.data;
      fillRichWave(waveRich, peaks.data);

      var cardPeaks = resamplePeaks(peaks.data, CARD_PEAK_COUNT);
      waveCompact.appendChild(buildWaveformSvg(cardPeaks, 'battito-wave-bg'));
      waveCompact.appendChild(buildWaveformSvg(cardPeaks, 'battito-wave-fg'));

      section.style.setProperty('--battito-duration', peaks.duration + 's');
    })
    .catch(function () {
      /* senza .peaks.json i player restano senza tracciato */
    });

  /* Riproduzione: un solo Audio per la sezione, creato al primo
     play. L'animazione parte quando l'audio suona davvero (la
     promise di play() si risolve all'avvio effettivo), non al
     click: l'mp3 va prima scaricato e decodificato, e un
     tracciato partito in anticipo resterebbe avanti rispetto
     al suono per tutta la corsa. */
  var audio = null;

  function toggle() {
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      section.classList.remove('playing');
      return;
    }
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.addEventListener('ended', function () {
        section.classList.remove('playing');
      });
    }
    audio.currentTime = 0;
    section.classList.remove('playing');
    lightboxAudio = audio;
    audio.play().then(function () {
      void section.offsetWidth;   /* reset dell'animazione CSS */
      section.classList.add('playing');
    }).catch(function () {
      section.classList.remove('playing');
    });
  }

  playBig.addEventListener('click', toggle);
  compact.addEventListener('click', toggle);

  return section;
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
  stopLightboxAudio();   /* il battito non sopravvive alla chiusura */
  closeBattitoInfo();    /* e nemmeno il suo racconto */
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  currentId = null;
  /* Toglie l'hash dall'URL senza ricaricare e senza lasciare il '#' */
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

lightboxClose.addEventListener('click', closeLightbox);

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') { return; }
  /* gli strati si chiudono dal più alto: prima il racconto
     del battito (se aperto), poi il lightbox */
  if (infoOverlay && infoOverlay.classList.contains('open')) {
    closeBattitoInfo();
    return;
  }
  if (lightbox.classList.contains('open')) {
    closeLightbox();
  }
});


/* =============================================================
   HASH ROUTING / DEEP-LINK
   L'URL è la fonte di verità per l'overlay: "#001" apre il
   campetto con id "001". Il click su una card scrive l'hash;
   apertura, chiusura e avvio della pagina reagiscono qui.
   currentId tiene l'id del campetto aperto (null = overlay chiuso),
   così non ricostruiamo l'overlay quando l'hash non cambia.
   Un id inesistente o spazzatura viene ignorato senza errori.
   ============================================================= */
var currentId = null;

function openFromHash() {
  var id = location.hash.replace(/^#/, '');
  if (!id) {                        /* nessun hash → overlay chiuso */
    if (currentId) { closeLightbox(); }
    return;
  }
  if (id === currentId) { return; } /* già aperto su questo campetto */
  var campetto = DATA.find(function (c) { return c.id === id; });
  if (campetto) { openLightbox(campetto); }
}

window.addEventListener('hashchange', openFromHash);


/* =============================================================
   PLAYER AUDIO "BATTITO"
   Forma d'onda reale della registrazione (letta dal .peaks.json
   e disegnata a barre), che si colora di arancione durante la
   riproduzione — il battito del campetto.
   ============================================================= */

/* Piccola freccia "play" mostrata all'inizio del player battito. */
function buildPlaySvg() {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'battito-play');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  var triangle = document.createElementNS(ns, 'path');
  triangle.setAttribute('d', 'M2 1 L11 6 L2 11 Z');
  triangle.setAttribute('fill', 'currentColor');
  svg.appendChild(triangle);
  return svg;
}

/* Costruisce la forma d'onda come barre verticali, a partire dai
   picchi (valori 0..1) letti dal .peaks.json. cssClass distingue lo
   sfondo (grigio) dal primo piano (arancione, che si "riempie" al play). */
function buildWaveformSvg(peaks, cssClass) {
  var ns = 'http://www.w3.org/2000/svg';
  var height = 24;
  var center = height / 2;

  var svg = document.createElementNS(ns, 'svg');
  // Una unita' di viewBox per ogni barra; "preserveAspectRatio none"
  // poi la stira a riempire tutta la larghezza del player.
  svg.setAttribute('viewBox', '0 0 ' + peaks.length + ' ' + height);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', cssClass);
  svg.setAttribute('aria-hidden', 'true');

  for (var i = 0; i < peaks.length; i++) {
    var barHeight = peaks[i] * (height - 2);
    if (barHeight < 0.5) {
      barHeight = 0.5;          // anche il silenzio resta una traccia visibile
    }
    var bar = document.createElementNS(ns, 'rect');
    bar.setAttribute('x', i + 0.15);
    bar.setAttribute('y', center - barHeight / 2);
    bar.setAttribute('width', 0.7);
    bar.setAttribute('height', barHeight);
    bar.setAttribute('fill', 'currentColor');
    svg.appendChild(bar);
  }
  return svg;
}

/* Quante barre mostra il tracciato della scheda. Il .peaks.json
   contiene una risoluzione più alta (680 picchi, 4 volte tanto:
   vedi PEAK_COUNT in scripts/gen-peaks.py) pensata per il player
   grande del lightbox; la scheda ne usa una versione condensata.
   Un solo file serve entrambi i tracciati. */
var CARD_PEAK_COUNT = 170;

/* Ricampiona i picchi al numero di barre voluto: divide il
   tracciato in targetCount segmenti e tiene il massimo di
   ciascuno — la stessa logica con cui gen-peaks.py ricava i
   picchi dai campioni audio, un piano più su.
   Per la scheda (680 -> 170) i segmenti sono esattamente di
   quattro picchi e il risultato coincide col vecchio tracciato;
   il player del lightbox chiede invece il numero di barre che
   il suo schermo può mostrare, qualunque esso sia. */
function resamplePeaks(peaks, targetCount) {
  if (targetCount >= peaks.length) { return peaks; }

  var resampled = [];
  for (var i = 0; i < targetCount; i++) {
    var start = Math.floor(i * peaks.length / targetCount);
    var end   = Math.max(Math.floor((i + 1) * peaks.length / targetCount),
                         start + 1);
    var segmentMax = 0;
    for (var j = start; j < end; j++) {
      if (peaks[j] > segmentMax) { segmentMax = peaks[j]; }
    }
    resampled.push(segmentMax);
  }
  return resampled;
}

/* Carica il .peaks.json dell'audio e disegna la forma d'onda dentro
   il player: due copie sovrapposte (sfondo grigio + primo piano
   arancione). Imposta anche la durata dell'animazione pari a quella
   reale della registrazione. E' asincrona: il tracciato compare
   appena il file dei picchi e' stato letto. */
function loadWaveform(button, container, audioUrl) {
  var peaksUrl = audioUrl.replace(/\.mp3$/, '.peaks.json');
  fetch(peaksUrl)
    .then(function (response) { return response.json(); })
    .then(function (peaks) {
      /* la scheda mostra la versione ricampionata del tracciato */
      var cardPeaks = resamplePeaks(peaks.data, CARD_PEAK_COUNT);
      container.appendChild(buildWaveformSvg(cardPeaks, 'battito-wave-bg'));
      container.appendChild(buildWaveformSvg(cardPeaks, 'battito-wave-fg'));
      button.style.setProperty('--battito-duration', peaks.duration + 's');
    })
    .catch(function () {
      // Se il .peaks.json manca, il player resta semplicemente senza tracciato.
    });
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

  /* Avvia la riproduzione. L'animazione del tracciato parte
     quando l'audio suona davvero (la promise di play() si
     risolve all'avvio effettivo), non al click: l'mp3 va prima
     scaricato e decodificato, e un tracciato partito in anticipo
     resterebbe avanti rispetto al suono per tutta la corsa. */
  btn._audio.currentTime = 0;
  btn.classList.remove('playing');
  btn._audio.play().then(function () {
    void btn.offsetWidth;   /* reset dell'animazione CSS */
    btn.classList.add('playing');
  }).catch(function () {
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
   INDICATORE ARCHIVIO FOTOGRAFICO
   Compare nell'intestazione della scheda, accanto alla
   freschezza, solo quando il campetto ha più di una rilevazione:
   segnala che nel lightbox c'è il contact sheet (l'archivio
   delle foto nel tempo). Icona "due foto sovrapposte" + numero
   totale delle rilevazioni.
   ============================================================= */

/* L'icona: due cornici fotografiche sovrapposte. Quella davanti
   è riempita col colore di fondo dell'header (via CSS, classe
   archivio-front) per staccarsi da quella dietro. */
function buildArchiveSvg() {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('aria-hidden', 'true');

  var dietro = document.createElementNS(ns, 'rect');
  dietro.setAttribute('x', '4.5');
  dietro.setAttribute('y', '1');
  dietro.setAttribute('width', '8.5');
  dietro.setAttribute('height', '8.5');
  dietro.setAttribute('rx', '1');
  dietro.setAttribute('fill', 'none');
  dietro.setAttribute('stroke', 'currentColor');
  dietro.setAttribute('stroke-width', '1.3');

  var davanti = document.createElementNS(ns, 'rect');
  davanti.setAttribute('class', 'archivio-front');
  davanti.setAttribute('x', '1');
  davanti.setAttribute('y', '4.5');
  davanti.setAttribute('width', '8.5');
  davanti.setAttribute('height', '8.5');
  davanti.setAttribute('rx', '1');
  davanti.setAttribute('stroke', 'currentColor');
  davanti.setAttribute('stroke-width', '1.3');

  svg.appendChild(dietro);
  svg.appendChild(davanti);
  return svg;
}

/* Il nodo completo: icona + numero, con la spiegazione nel
   tooltip ("Archivio fotografico · N rilevazioni" — le stesse
   stringhe usate dal titolo del contact sheet). */
function archiveNode(surveyCount) {
  var span = el('span', 'archivio');
  span.title = T.labelArchive + ' · ' + surveyCount + ' ' + T.labelSurveys;
  span.appendChild(buildArchiveSvg());
  span.appendChild(document.createTextNode(surveyCount));
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

/* Alterna tra le viste interne: schede, mappa e serie.
   Una vista alla volta: la griglia delle schede usa display,
   mappa e serie la classe .active; la barra del selettore di
   serie compare e scompare insieme alla sua vista. */
function switchView(view) {
  var grid      = document.getElementById('grid');
  var map       = document.getElementById('map');
  var serie     = document.getElementById('serie');
  var serieBar  = document.getElementById('serie-bar');

  document.querySelectorAll('.view-tab').forEach(function (tab) {
    tab.classList.remove('active');
    if (tab.dataset.view === view) { tab.classList.add('active'); }
  });

  activeView = view;

  grid.style.display = (view === 'grid') ? '' : 'none';
  map.classList.toggle('active',      view === 'map');
  serie.classList.toggle('active',    view === 'serie');
  serieBar.classList.toggle('active', view === 'serie');

  /* il pulsante di ordinamento "Per tinta" esiste solo nella
     vista Serie con la serie Colore attiva */
  syncTintaButton();

  if (view === 'map') {
    initMap();
    /* Leaflet ha bisogno di ricalcolare le dimensioni dopo
       che il contenitore diventa visibile */
    setTimeout(function () { leafletMap.invalidateSize(); }, 100);
  }
}


/* =============================================================
   VISTA SERIE — CONFIGURAZIONE
   Griglia comparativa in stile tipologico: foto dello stesso
   tipo affiancate, una cella per campetto.

   Ogni riga di questa lista diventa un pulsante del selettore,
   nell'ordine in cui compare qui; la prima riga è la serie
   mostrata all'apertura della vista.

   Significato dei campi:
     key          identificatore interno (niente spazi)
     label        etichetta del pulsante, una per lingua
     fileNames    nomi di file (senza estensione) che identificano
                  questo tipo di foto dentro "details" del JSON;
                  più nomi = sinonimi accettati
     position     indice della foto dentro "details" per le
                  rilevazioni vecchie coi nomi generici
                  dettaglio-1/2/3, che seguono l'ordine del
                  protocollo fotografico. RAMO TRANSITORIO: gli
                  audit stanno convertendo i nomi generici in
                  specifici; quando l'ultimo sarà migrato,
                  "position" e la mappatura per posizione in
                  seriesPhoto() potranno essere rimossi
     dedicatedField  solo per la serie "insieme": la foto vive
                  nel campo dedicato "overview" del JSON,
                  non dentro "details"
     orientation  forma della cella: 'landscape' (3:2) oppure
                  'portrait' (3:4)
     type         'color' segna la serie speciale "Colore": le
                  celle non mostrano una foto ma un tassello del
                  colore dominante del manto, letto da colors.json
                  (file derivato, rigenerato con scripts/gen-colors.py).
                  Al passaggio del mouse compare la foto surface
                  da cui il colore proviene; è disponibile
                  l'ordinamento "Per tinta".

   COME AGGIUNGERE UNA SERIE (esempio: le panchine)
     1. aggiungere una riga nella posizione voluta:
          { key: 'panchine',
            label: { it: 'Panchine', en: 'Benches' },
            fileNames: ['benches', 'bench'],
            orientation: 'portrait' },
     2. ricaricare la pagina: pulsante e griglia si costruiscono
        da soli a partire da questa lista. Nessun altro punto
        da toccare, né in HTML né in CSS.
   COME RIMUOVERE UNA SERIE: cancellare la sua riga.
   COME CAMBIARE L'ORDINE DEI PULSANTI: spostare le righe.
   ============================================================= */
var SERIES = [
  { key: 'insieme',
    label: { it: 'Insieme', en: 'Overview' },
    dedicatedField: 'overview',
    orientation: 'landscape' },

  { key: 'canestro1',
    label: { it: 'Canestro 1', en: 'Hoop 1' },
    fileNames: ['hoop-1'],
    position: 0,
    orientation: 'portrait' },

  { key: 'canestro2',
    label: { it: 'Canestro 2', en: 'Hoop 2' },
    fileNames: ['hoop-2'],
    position: 1,
    orientation: 'portrait' },

  { key: 'superficie',
    label: { it: 'Superficie', en: 'Surface' },
    fileNames: ['surface'],
    position: 2,
    orientation: 'portrait' },

  { key: 'colore',
    label: { it: 'Colore', en: 'Color' },
    type: 'color',
    orientation: 'landscape' }
];

/* La serie attualmente selezionata (default: la prima) */
var activeSeries = SERIES[0].key;

/* Restituisce la configurazione della serie attiva */
function activeSeriesConfig() {
  for (var i = 0; i < SERIES.length; i++) {
    if (SERIES[i].key === activeSeries) { return SERIES[i]; }
  }
  return SERIES[0];
}

/* Dal percorso completo al solo nome file senza estensione
   (photos/001/2026-04-16/hoop-1.webp -> hoop-1) */
function photoBaseName(path) {
  var fileName = path.split('/').pop();
  return fileName.replace(/\.[^.]+$/, '');
}

/* Vero se la rilevazione usa i nomi file espliciti (hoop-1,
   surface, ...): basta che un dettaglio ne abbia uno. */
function surveyHasExplicitNames(survey) {
  var details = survey.details || [];
  return details.some(function (path) {
    return SERIES.some(function (series) {
      var names = series.fileNames || [];
      return names.indexOf(photoBaseName(path)) !== -1;
    });
  });
}

/* Percorso della foto di una serie dentro una rilevazione,
   o '' se quel tipo di scatto manca.

   Due criteri, mutuamente esclusivi per non sbagliare mai:
   - se la rilevazione ha ALMENO UN nome file esplicito, vale
     SOLO la corrispondenza per nome: una foto mancante resta
     mancante (mai ripiegare sulla posizione, che potrebbe
     restituire un soggetto sbagliato);
   - se ha solo nomi generici (dettaglio-1/2/3), vale la
     posizione secondo l'ordine del protocollo fotografico
     (ramo transitorio: vedi nota su "position" in SERIES). */
function seriesPhoto(survey, series) {
  /* Caso "Insieme": la foto è nel campo dedicato del JSON */
  if (series.dedicatedField) {
    return survey[series.dedicatedField] || '';
  }

  var details = survey.details || [];

  if (surveyHasExplicitNames(survey)) {
    for (var i = 0; i < details.length; i++) {
      if (series.fileNames.indexOf(photoBaseName(details[i])) !== -1) {
        return details[i];
      }
    }
    return '';
  }

  if (typeof series.position === 'number' && series.position < details.length) {
    return details[series.position];
  }
  return '';
}


/* =============================================================
   ORDINAMENTO PER TINTA (solo serie Colore)
   ============================================================= */

/* Chiave di ordinamento per i tasselli della serie Colore.
   Due criteri insieme, fusi in un'unica stringa confrontabile:
   - la ruota cromatica decide la FAMIGLIA: bande di 30 gradi
     (bruni/rossi, aranci, gialli, verdi, azzurri, blu, viola,
     rosa...), con i quasi-grigi in una banda finale a parte;
   - DENTRO la banda si ordina per luminanza percepita, dal buio
     alla luce. Non si confronta la tripletta esadecimale: quel
     confronto mette il canale rosso davanti a tutto, mentre
     l'occhio pesa i canali in modo molto diverso (verde ~71%,
     rosso ~21%, blu ~7% — i coefficienti standard usati sotto).
   Esempio di chiave: "06078" = banda 06 (azzurri), luminanza 78. */
function colorSortKey(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);

  /* luminanza percepita (0-255), scritta su tre cifre */
  var luminanza = String(Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b));
  while (luminanza.length < 3) { luminanza = '0' + luminanza; }

  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var croma = max - min;

  var saturazione = (max === 0) ? 0 : croma / max;
  if (saturazione < 0.15) {
    /* quasi-grigio: banda finale, dal più scuro al più chiaro */
    return '99' + luminanza;
  }

  /* formula standard della tinta (hue, 0-360 gradi): in quale
     zona della ruota cade dipende dal canale più forte */
  var tinta;
  if (max === r)      { tinta = ((g - b) / croma + 6) % 6; }
  else if (max === g) { tinta = (b - r) / croma + 2; }
  else                { tinta = (r - g) / croma + 4; }
  var gradi = tinta * 60;

  /* banda di 30 gradi, scritta su due cifre (00-11) */
  var banda = String(Math.floor(gradi / 30));
  if (banda.length < 2) { banda = '0' + banda; }
  return banda + luminanza;
}

/* Mostra o nasconde il pulsante "Per tinta": esiste solo nella
   vista Serie con la serie Colore attiva. Uscendone, se era
   l'ordinamento attivo, si torna all'ordine per id. */
function syncTintaButton() {
  var btn = document.getElementById('sort-tinta');
  if (!btn) { return; }

  var visible = (activeView === 'serie' && activeSeriesConfig().type === 'color');
  btn.hidden = !visible;

  if (!visible && activeSort === 'tinta') {
    activeSort = 'id';
    document.querySelectorAll('.sort-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    document.querySelector('.sort-btn[data-sort="id"]').classList.add('active');
    applyFilters();
  }
}


/* =============================================================
   RENDERING DELLA VISTA SERIE
   Una cella per campetto: la foto del tipo scelto, con #id e
   indirizzo visibili al passaggio del mouse. Ogni cella è un
   link all'hash del campetto (#001): il click passa dal solito
   hash routing e apre il lightbox.
   I campetti senza foto per la serie attiva non compaiono;
   il contatore accanto al selettore dice quanti sono in serie.
   Nella serie Colore la cella è un tassello del colore dominante
   del manto (da colors.json): la foto surface sta sopra,
   invisibile, e compare in hover per mostrare l'origine.
   ============================================================= */
function renderSeries(lista) {
  var container = document.getElementById('serie');
  container.innerHTML = '';

  var series = activeSeriesConfig();
  var isColorSeries = (series.type === 'color');

  /* Forma delle celle: orizzontale (3:2) o verticale (3:4) */
  container.classList.toggle('verticale', series.orientation === 'portrait');

  /* Solo i campetti che hanno il contenuto della serie attiva:
     la foto (nella rilevazione più recente), oppure il colore
     estratto per la serie Colore */
  var cells = [];
  lista.forEach(function (campetto) {
    if (isColorSeries) {
      var voce = COLORS[campetto.id];
      if (!voce) { return; }
      var colore = safeHexColor(voce.color);
      if (!colore) { return; }
      cells.push({ campetto: campetto,
                   colore: colore,
                   url: safePhotoUrl(voce.surface) });
    } else {
      var latest = (campetto.photos && campetto.photos[0]) || {};
      var url = safePhotoUrl(seriesPhoto(latest, series));
      if (url) { cells.push({ campetto: campetto, url: url }); }
    }
  });

  /* Ordine per tinta: famiglie lungo la ruota cromatica, dentro
     ogni famiglia dal buio alla luce, grigi in coda */
  if (isColorSeries && activeSort === 'tinta') {
    cells.sort(function (a, b) {
      var ka = colorSortKey(a.colore);
      var kb = colorSortKey(b.colore);
      return ka < kb ? -1 : 1;
    });
  }

  document.getElementById('serie-count').textContent =
    cells.length + ' ' + T.labelInSeries;

  if (cells.length === 0) {
    container.appendChild(textEl('div', 'state-msg', T.noResults));
    return;
  }

  var fragment = document.createDocumentFragment();
  cells.forEach(function (cell) {
    var campetto = cell.campetto;

    var link  = el('a', 's-cell');
    link.href = '#' + campetto.id;

    if (isColorSeries) {
      /* tassello pieno del colore dominante; la foto surface è
         sopra, invisibile finché il mouse non la rivela */
      link.classList.add('s-cell-colore');
      link.style.backgroundColor = cell.colore;
    }

    if (cell.url) {
      var img     = el('img');
      img.src     = cell.url;
      img.alt     = '#' + campetto.id + ' — ' + campetto.address;
      img.loading = 'lazy';
      link.appendChild(img);
    }

    /* Etichetta #id + indirizzo (visibile solo in hover, via CSS).
       L'indirizzo al posto del nome: nello spazio stretto della
       cella "Campetto di..." si troncava sempre, la via no.
       Nella serie Colore compare anche la tripletta estratta. */
    var tag = el('div', 's-tag');
    tag.appendChild(textEl('strong', '', '#' + campetto.id));
    if (isColorSeries) {
      tag.appendChild(textEl('span', 's-tag-hex', cell.colore));
    }
    tag.appendChild(document.createTextNode(campetto.address));
    link.appendChild(tag);

    fragment.appendChild(link);
  });
  container.appendChild(fragment);
}

/* Costruisce i pulsanti del selettore di serie, uno per ogni
   riga di SERIES, nell'ordine in cui compaiono lì. */
function buildSeriesSelector() {
  var box = document.getElementById('serie-select');
  SERIES.forEach(function (series) {
    var btn = el('button',
      'serie-btn' + (series.key === activeSeries ? ' active' : ''));
    btn.type = 'button';
    btn.textContent = series.label[LANG] || series.label.it;
    btn.addEventListener('click', function () {
      document.querySelectorAll('.serie-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      activeSeries = series.key;
      /* il pulsante "Per tinta" segue la serie Colore */
      syncTintaButton();
      renderSeries(lastFiltered);
    });
    box.appendChild(btn);
  });
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

/* Icona "segnaposto" (pin) della mappa, in SVG. */
function buildPinSvg() {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 12 16');
  svg.setAttribute('aria-hidden', 'true');
  var drop = document.createElementNS(ns, 'path');
  drop.setAttribute('d', 'M6 0C2.7 0 0 2.7 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6z');
  drop.setAttribute('fill', 'none');
  drop.setAttribute('stroke', 'currentColor');
  drop.setAttribute('stroke-width', '1.5');
  var dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', '6');
  dot.setAttribute('cy', '6');
  dot.setAttribute('r', '2');
  dot.setAttribute('fill', 'currentColor');
  svg.appendChild(drop);
  svg.appendChild(dot);
  return svg;
}

/* Crea il link "apri sulla mappa" (pin) da affiancare all'indirizzo,
   nel body della card. Mantiene i dataset lat/lng usati da
   updateAllMapsLinks per aggiornare l'URL al cambio di provider. */
function buildMapsPin(lat, lng) {
  var link = el('a', 'addr-pin');
  link.href = getMapsUrl(lat, lng);
  link.target = '_blank';
  link.rel = 'noopener';
  link.dataset.lat = lat;
  link.dataset.lng = lng;
  link.setAttribute('aria-label', T.openInMaps);
  link.title = T.openInMaps;
  link.appendChild(buildPinSvg());
  return link;
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
   │   ├── div.info-row  (Indirizzo + a.addr-pin -> mappa)
   │   ├── div.info-row  (Zona)
   │   ├── div.info-row  (Note)
   │   └── div.booleans  (pill canestri, illuminato, ecc.)
   └── footer.card-footer  (solo se il campetto ha audio)
       └── button.battito-btn  (play + "Battito" + forma d'onda)
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

  /* Aggiungere un attributo id all'articolo che
   * rappresenta la card, consente di creare link
   * puntuali ciascuna di esse facendo seguire
   * alla pagina web il cancelletto e l'id della
   * card cui si vuole puntare: es.:
   * https://alcampetto.org/index.html#041 */
  card.setAttribute('id', campetto.id);
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


  /* ── Header: numero, nome, data + freschezza + archivio ── */

  var header = el('header', 'card-header');

  header.appendChild(textEl('div', 'card-num',  '#' + campetto.id));
  header.appendChild(textEl('div', 'card-name', nome));

  var dateStr = campetto.updated || campetto.created;
  var dateDiv = el('div', 'card-date');
    dateDiv.appendChild(document.createTextNode(dateStr));
    dateDiv.appendChild(freshnessNode(dateStr));
    /* indicatore archivio: solo se ci sono più rilevazioni */
    if (campetto.photos && campetto.photos.length > 1) {
      dateDiv.appendChild(archiveNode(campetto.photos.length));
    }
  header.appendChild(dateDiv);

  card.appendChild(header);


  /* ── Body: righe informative + pill booleane ── */

  var body = el('div', 'card-body');

  /* Riga indirizzo, con il pin della mappa allineato a destra */
  var addressRow = infoRow(T.labelAddress, campetto.address);
  addressRow.appendChild(buildMapsPin(lat, lng));
  body.appendChild(addressRow);

  var area = campetto.city
           + (campetto.district ? ' \u2014 ' + campetto.district : '');
  body.appendChild(infoRow(T.labelArea, area));

  /* Riga del manto: solo se la superficie è stata rilevata
     (null = non rilevato = riga assente) */
  if (campetto.surface) {
    body.appendChild(infoRow(T.labelManto, surfaceLabel(campetto.surface)));
  }

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


  /* ── Footer: il player "battito".
     Esiste SOLO per i campetti che hanno una registrazione audio
     (campo "audio" nel JSON); il link alla mappa ora vive nel body,
     accanto all'indirizzo. ── */

  var audioUrl = campetto.audio ? safeAudioUrl(campetto.audio) : '';
  if (audioUrl) {
    var footer = el('footer', 'card-footer');

    var battitoBtn = el('button', 'battito-btn');
    battitoBtn.type = 'button';
    battitoBtn.dataset.audio = audioUrl;

    /* freccia play + etichetta "Battito" + forma d'onda */
    battitoBtn.appendChild(buildPlaySvg());
    battitoBtn.appendChild(textEl('span', 'battito-label', T.labelBattito));

    var waveWrap = el('div', 'battito-wave');
    battitoBtn.appendChild(waveWrap);
    /* disegna la forma d'onda reale leggendo il .peaks.json (async) */
    loadWaveform(battitoBtn, waveWrap, audioUrl);

    footer.appendChild(battitoBtn);
    card.appendChild(footer);
  }

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
      /* L'URL è la fonte di verità: scrivere l'hash apre l'overlay
         tramite il listener 'hashchange' (vedi openFromHash). */
      location.hash = card._campetto.id;
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

  /* Ordinamento. "tinta" riguarda solo i tasselli della serie
     Colore (vedi renderSeries): qui la lista generale resta
     ordinata per id. */
  if (activeSort === 'date') {
    filtered.sort(function (a, b) {
      return new Date(b.updated || b.created) - new Date(a.updated || a.created);
    });
  } else {
    filtered.sort(function (a, b) {
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }

  lastFiltered = filtered;
  renderCards(filtered);
  updateMapMarkers(filtered);
  renderSeries(filtered);
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
   LISTENER — TAB VISTA (Schede / Mappa / Serie)
   ============================================================= */
/* Solo i tab con data-view sono toggle in-pagina;
   il link "Blog" e' un <a> senza data-view e naviga da solo. */
document.querySelectorAll('.view-tab[data-view]').forEach(function (tab) {
  tab.addEventListener('click', function () {
    switchView(tab.dataset.view);
  });
});

/* I pulsanti del selettore di serie si costruiscono una volta
   sola, all'avvio: dipendono solo dalla configurazione SERIES,
   non dai dati del JSON. */
buildSeriesSelector();

/* =============================================================
   LISTENER — TOGGLE PROVIDER MAPPE
   ============================================================= */
function updateAllMapsLinks() {
  document.querySelectorAll('.addr-pin').forEach(function (btn) {
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
   Prima il dataset, poi colors.json (il derivato coi colori dei
   manti, per la serie Colore). colors.json è opzionale: se il
   fetch fallisce, la serie Colore resta semplicemente vuota e
   il resto del sito non ne risente.
   Il parametro ?v= con il timestamp impedisce al browser
   di usare una versione in cache dei file JSON.
   ============================================================= */
fetch('alcampetto.json?v=' + Date.now())
  .then(function (response) { return response.json(); })
  .then(function (json) {
    DATA = json;
    return fetch('colors.json?v=' + Date.now())
      .then(function (response) { return response.json(); })
      .then(function (derivato) { COLORS = derivato.colors || {}; })
      .catch(function () { /* senza colori il sito vive lo stesso */ });
  })
  .then(function () {
    updateTagline();
    applyFilters();
    openFromHash();   /* se l'URL ha già un hash (#001), apre quel campetto */
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
