#!/usr/bin/env python3
# =============================================================
# gen-colors.py — genera il "campionario dei colori" dei manti
#
# Per ogni campetto che ha una foto della superficie col nome
# esplicito surface.webp (nella rilevazione più recente), estrae
# il colore dominante del manto e lo scrive in colors.json, alla
# radice del repository.
#
# colors.json è un file DERIVATO, come i .peaks.json dell'audio:
# non si modifica a mano, si rigenera con questo script. Il sito
# lo carica per la serie "Colore"; i campetti con foto dai nomi
# ancora generici (dettaglio-N) non compaiono e entreranno man
# mano che i loro nomi vengono normalizzati dagli audit.
#
# COME SI USA
#   python3 scripts/gen-colors.py
#       -> rigenera colors.json da zero (da lanciare dopo OGNI
#          modifica alle foto: rinomina, nuovo campetto, nuova
#          rilevazione; pochi secondi per tutto il dataset)
#   python3 scripts/gen-colors.py --check
#       -> verifica che colors.json sia allineato al dataset,
#          senza toccare nulla: exit 0 se allineato, 1 se no.
#          È il controllo usato dalla CI. Confronta campetti e
#          percorsi, non i colori: così non richiede ffmpeg e dà
#          lo stesso esito su qualunque macchina.
#   python3 scripts/gen-colors.py photos/001/2026-04-16/surface.webp
#       -> prova l'estrazione su singole foto (stampa e basta)
#
# COME VIENE SCELTO IL COLORE (il perché delle scelte)
#   La media semplice di tutti i pixel produce un impasto che non
#   esiste nella foto. Qui invece l'elezione avviene così:
#     1. la foto viene rimpicciolita a 64x64 pixel: per il colore
#        d'insieme non serve più dettaglio, e il calcolo è rapido;
#     2. ogni pixel vota per la sua "famiglia" di colori simili
#        (8 livelli per canale = 512 famiglie possibili);
#     3. si candidano solo le "vette": le famiglie che non hanno
#        una confinante più numerosa (le sfumature di passaggio
#        tra due colori non corrono). Tra le vette vince quella
#        con la "collina" più pesante — la vetta più le famiglie
#        confinanti, cioè le sue sfumature. La collina serve
#        perché un manto usurato si sparge su più famiglie
#        contigue e la vetta da sola perderebbe contro una zona
#        piccola ma verniciata di fresco;
#     4. il colore è la media dei pixel della sola vetta vincente:
#        la tinta più pura del colore che ha vinto, non la media
#        annacquata di tutta la collina.
#   In una riga: le vette si candidano, la collina elegge, la
#   vetta colora.
#
# RICHIEDE: ffmpeg nel PATH per la generazione (come gen-peaks.py).
#           Il --check non ne ha bisogno. Nessuna libreria esterna.
# =============================================================

import json
import os
import subprocess
import sys
from pathlib import Path

# Radice del repository, ricavata dalla posizione di questo script
# (scripts/gen-colors.py -> due livelli sopra), così il comando
# funziona da qualunque cartella venga lanciato.
REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET = REPO_ROOT / "alcampetto.json"
COLORS = REPO_ROOT / "colors.json"

# Lato del quadrato a cui ridurre la foto prima dell'analisi.
LATO_CAMPIONE = 64

# Ampiezza delle famiglie di colore: 256 / 32 = 8 livelli per
# canale, quindi 8x8x8 = 512 famiglie possibili.
AMPIEZZA_FAMIGLIA = 32


def dominant_color(photo_path):
    """Restituisce il colore dominante della foto come stringa
       '#rrggbb', oppure None se la lettura fallisce.
       L'algoritmo è descritto nel commento di testa."""

    # 1) ffmpeg decodifica la foto e la riduce a 64x64 pixel RGB
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(photo_path),
         "-vf", f"scale={LATO_CAMPIONE}:{LATO_CAMPIONE}",
         "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    )
    if result.returncode != 0 or not result.stdout:
        errore = result.stderr.decode()[:120]
        print(f"  ERRORE su {photo_path} -> {errore}", file=sys.stderr)
        return None

    pixels = result.stdout  # r,g,b, r,g,b, ... un byte per canale

    # 2) Ogni pixel vota per la sua famiglia di colori simili.
    #    Per ogni famiglia accumuliamo conteggio e somme dei canali,
    #    così la media finale è già pronta.
    famiglie = {}   # (fr, fg, fb) -> [conteggio, somma_r, somma_g, somma_b]
    for i in range(0, len(pixels) - 2, 3):
        r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
        chiave = (r // AMPIEZZA_FAMIGLIA,
                  g // AMPIEZZA_FAMIGLIA,
                  b // AMPIEZZA_FAMIGLIA)
        if chiave not in famiglie:
            famiglie[chiave] = [0, 0, 0, 0]
        famiglia = famiglie[chiave]
        famiglia[0] += 1
        famiglia[1] += r
        famiglia[2] += g
        famiglia[3] += b

    # 3) L'elezione: si candidano le vette, decide la collina.
    def confinanti(chiave):
        """Le famiglie presenti nella foto che confinano con
           quella indicata (compresa la famiglia stessa)."""
        vicine = []
        for altra in famiglie:
            if (abs(altra[0] - chiave[0]) <= 1 and
                    abs(altra[1] - chiave[1]) <= 1 and
                    abs(altra[2] - chiave[2]) <= 1):
                vicine.append(altra)
        return vicine

    def superficie_collina(chiave):
        """Quanti pixel coprono la famiglia e le sue confinanti."""
        return sum(famiglie[vicina][0] for vicina in confinanti(chiave))

    # Le vette: famiglie senza una confinante più numerosa.
    vette = []
    for chiave in famiglie:
        piu_numerosa = max(famiglie[vicina][0] for vicina in confinanti(chiave))
        if famiglie[chiave][0] == piu_numerosa:
            vette.append(chiave)

    cima = max(vette, key=superficie_collina)

    # 4) La tinta è la media dei pixel della sola vetta vincente.
    conteggio, somma_r, somma_g, somma_b = famiglie[cima]
    r_medio = somma_r // conteggio
    g_medio = somma_g // conteggio
    b_medio = somma_b // conteggio
    return f"#{r_medio:02x}{g_medio:02x}{b_medio:02x}"


def surface_per_campetto(dataset):
    """Per ogni campetto, il percorso della foto surface.webp della
       rilevazione più recente — SOLO se il nome è esplicito.
       Restituisce un dizionario {id: percorso}, ordinato per id."""
    mappa = {}
    for campetto in dataset:
        rilevazione_recente = campetto["photos"][0]
        for percorso in rilevazione_recente["details"]:
            if os.path.basename(percorso) == "surface.webp":
                mappa[campetto["id"]] = percorso
                break
    return dict(sorted(mappa.items()))


def genera():
    """Rigenera colors.json da zero. Exit code 0 se tutto bene."""
    with open(DATASET) as f:
        dataset = json.load(f)

    mappa = surface_per_campetto(dataset)
    print(f"Estraggo il colore del manto per {len(mappa)} campetti…")

    colori = {}
    errori = 0
    for court_id, percorso in mappa.items():
        colore = dominant_color(REPO_ROOT / percorso)
        if colore is None:
            errori += 1
            continue
        # accanto al colore salviamo la foto d'origine: è ciò che
        # permette al --check di scoprire un derivato non aggiornato
        colori[court_id] = {"surface": percorso, "color": colore}
        print(f"  {court_id}  {colore}  {percorso}")

    payload = {"version": 1, "colors": colori}
    with open(COLORS, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")

    print(f"Scritto {COLORS} — {len(colori)} colori"
          + (f", {errori} errori" if errori else "") + ".")
    return 1 if errori else 0


def verifica():
    """Controlla che colors.json sia allineato al dataset, senza
       rigenerare nulla (niente ffmpeg: usato dalla CI).
       Confronta gli id dei campetti e i percorsi delle foto."""
    try:
        with open(COLORS) as f:
            attuale = json.load(f)["colors"]
    except FileNotFoundError:
        print("ERRORE: colors.json non esiste. "
              "Genera il file con: python3 scripts/gen-colors.py",
              file=sys.stderr)
        return 1

    with open(DATASET) as f:
        dataset = json.load(f)
    attesa = surface_per_campetto(dataset)

    problemi = []
    for court_id, percorso in attesa.items():
        if court_id not in attuale:
            problemi.append(f"manca il campetto {court_id} ({percorso})")
        elif attuale[court_id]["surface"] != percorso:
            problemi.append(f"campetto {court_id}: colors.json punta a "
                            f"{attuale[court_id]['surface']}, il dataset a {percorso}")
    for court_id in attuale:
        if court_id not in attesa:
            problemi.append(f"campetto {court_id} presente in colors.json "
                            "ma senza surface.webp nel dataset")

    if problemi:
        for p in problemi:
            print(f"✗ {p}")
        print()
        print("colors.json non è allineato al dataset.")
        print("Rigeneralo con: python3 scripts/gen-colors.py")
        return 1

    print(f"colors.json allineato: {len(attesa)} campetti con colore del manto.")
    return 0


def main():
    args = sys.argv[1:]

    if args == ["--check"]:
        return verifica()

    if args:
        # modalità di prova: estrazione su singole foto, senza
        # toccare colors.json
        for percorso in args:
            colore = dominant_color(percorso)
            print(f"{colore or 'ERRORE'}  {percorso}")
        return 0

    return genera()


if __name__ == "__main__":
    sys.exit(main())
