#!/usr/bin/env python3
# =============================================================
# gen-peaks.py — genera il "tracciato dei picchi" di ogni audio
#
# Per ogni file audio del campetto (audio/<id>/<id>-beat.mp3)
# crea, accanto ad esso, un file <id>-beat.peaks.json.
# Quel file contiene una forma d'onda SEMPLIFICATA: al posto
# delle centinaia di migliaia di campioni dell'mp3, solo 170
# numeri (i "picchi"), che il sito disegna come barre nel player.
#
# COME SI USA
#   python3 scripts/gen-peaks.py
#       -> rigenera i picchi per TUTTI gli audio
#   python3 scripts/gen-peaks.py audio/054/054-beat.mp3
#       -> rigenera i picchi solo per il file indicato
#
# RICHIEDE: ffmpeg installato nel PATH. Nessuna libreria esterna.
# =============================================================

import subprocess   # per lanciare ffmpeg
import sys          # per leggere gli argomenti da riga di comando
import json         # per scrivere il file .peaks.json
import array        # per interpretare i byte audio come numeri
import glob         # per trovare tutti i file audio
import os           # per costruire il nome del file di output


# Quanti picchi (barre) compongono il tracciato: più sono, più il
# tracciato è fine. 170 e' la risoluzione scelta per le card.
PEAK_COUNT = 170

# Frequenza di campionamento usata per decodificare l'mp3.
# 44100 campioni al secondo e' lo standard CD: ci basta, ed essendo
# fissa ci permette di ricavare la durata (campioni / frequenza).
SAMPLE_RATE = 44100


def generate_peaks(mp3_path):
    """Legge un mp3 e scrive il suo .peaks.json accanto.
       Restituisce True se l'operazione riesce, False altrimenti."""

    # Nome del file di output: stesso percorso dell'mp3 ma con
    # estensione .peaks.json  (es. 001-beat.mp3 -> 001-beat.peaks.json)
    peaks_path = os.path.splitext(mp3_path)[0] + ".peaks.json"

    # 1) Decodifichiamo l'mp3 in audio "grezzo" tramite ffmpeg:
    #      -ac 1      un solo canale (mono): per il disegno basta
    #      -ar 44100  frequenza fissa, cosi' conosciamo la durata
    #      -f s16le   ogni campione = numero intero a 16 bit
    #      -          manda il risultato sullo standard output
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", mp3_path,
         "-ac", "1",
         "-ar", str(SAMPLE_RATE),
         "-f", "s16le", "-acodec", "pcm_s16le", "-"],
        capture_output=True,
    )
    if result.returncode != 0:
        error = result.stderr.decode()[:120]
        print("  ERRORE su", mp3_path, "->", error)
        return False

    # I byte grezzi prodotti da ffmpeg.
    raw_bytes = result.stdout

    # Ogni campione occupa 2 byte: se per qualche motivo il numero di
    # byte fosse dispari, scartiamo l'ultimo byte spaiato.
    usable_length = (len(raw_bytes) // 2) * 2
    raw_bytes = raw_bytes[:usable_length]

    # Trasformiamo i byte in una lista di numeri interi: ognuno e'
    # l'ampiezza dell'onda in quell'istante (puo' essere + o -).
    samples = array.array("h")        # "h" = intero con segno a 16 bit
    samples.frombytes(raw_bytes)

    sample_count = len(samples)
    if sample_count == 0:
        print("  ERRORE su", mp3_path, "-> file vuoto")
        return False

    # 2) Dividiamo i campioni in PEAK_COUNT segmenti uguali e di ogni
    #    segmento teniamo il valore piu' forte (il suo "picco").
    samples_per_bucket = sample_count / PEAK_COUNT
    peaks = []
    for i in range(PEAK_COUNT):
        start = int(i * samples_per_bucket)
        end = int((i + 1) * samples_per_bucket)
        if end <= start:               # garantiamo almeno un campione
            end = start + 1

        # Cerchiamo l'ampiezza massima nel segmento. Usiamo il valore
        # assoluto perche' l'onda oscilla sopra e sotto lo zero.
        bucket_peak = 0
        for sample in samples[start:end]:
            amplitude = sample if sample >= 0 else -sample
            if amplitude > bucket_peak:
                bucket_peak = amplitude
        peaks.append(bucket_peak)

    # 3) Normalizziamo: portiamo tutti i picchi nell'intervallo 0..1
    #    dividendo per il picco piu' alto in assoluto. Cosi' il tracciato
    #    riempie l'altezza disponibile MANTENENDO le proporzioni reali
    #    (i rimbalzi restano alti, il rumore di fondo resta basso ma
    #    vivo: non applichiamo nessuna soglia che lo cancellerebbe).
    max_peak = max(peaks)
    if max_peak == 0:
        max_peak = 1                   # evita la divisione per zero (audio muto)
    normalized = [round(peak / max_peak, 3) for peak in peaks]

    # Durata reale dell'audio in secondi: serve al sito per far durare
    # l'animazione del tracciato esattamente quanto la registrazione.
    duration = round(sample_count / SAMPLE_RATE, 3)

    # 4) Scriviamo il file .peaks.json accanto all'mp3.
    payload = {
        "version": 1,
        "length": PEAK_COUNT,
        "duration": duration,
        "data": normalized,
    }
    with open(peaks_path, "w") as output_file:
        json.dump(payload, output_file, separators=(",", ":"))

    print(f"  ok  {peaks_path}  ({duration}s)")
    return True


def main():
    # Se passo dei file come argomenti uso quelli; altrimenti cerco
    # tutti gli audio dei campetti secondo il loro schema di nome.
    args = sys.argv[1:]
    if args:
        files = args
    else:
        files = sorted(glob.glob("audio/*/*-beat.mp3"))

    if not files:
        print("Nessun file audio trovato (atteso: audio/<id>/<id>-beat.mp3).")
        return

    print(f"Genero i picchi per {len(files)} file…")
    ok_count = 0
    for mp3_path in files:
        if generate_peaks(mp3_path):
            ok_count += 1
    print(f"Fatto: {ok_count} su {len(files)} file.")


if __name__ == "__main__":
    main()
