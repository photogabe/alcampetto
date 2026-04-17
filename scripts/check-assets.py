#!/usr/bin/env python3
"""
check-assets.py — verifica che tutti i file referenziati in alcampetto.json
esistano davvero sul disco.

A COSA SERVE
------------
Ogni campetto del dataset punta a immagini (e talvolta un file audio).
Quando si aggiunge un nuovo campetto, o si aggiornano le foto di uno esistente,
è facile dimenticare di caricare una foto o scrivere un refuso nel percorso.
Questo script scorre tutto alcampetto.json e segnala i file che mancano.

COME USARLO
-----------
Lanciare dalla radice del progetto:

    python3 scripts/check-assets.py

Se tutto va bene, stampa un riepilogo e termina con exit code 0.
Se qualche file manca, elenca quali (e dove sono referenziati) e termina
con exit code 1. Lo stesso script viene lanciato automaticamente dalla
GitHub Action: se fallisce, non si può fare il merge della pull request.

DIPENDENZE
----------
Nessuna libreria esterna. Solo Python 3.9 o successivi, già installato
su macOS e sui runner di GitHub Actions.
"""

import json
import sys
from pathlib import Path


# --- Percorsi di base -----------------------------------------------------
#
# __file__ contiene il percorso di questo script (cioè
# "scripts/check-assets.py"). Risalendo di due livelli arriviamo alla radice
# del repo, dove vive alcampetto.json. Così lo script funziona
# indipendentemente da dove viene lanciato.
REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET = REPO_ROOT / "alcampetto.json"


def collect_references(data):
    """
    Scorre l'intero dataset e raccoglie ogni percorso di file referenziato,
    accompagnato da una descrizione che indica da dove viene (utile in caso
    di errore, per identificare subito il campetto o la rilevazione coinvolta).

    Ritorna una lista di tuple (percorso_relativo, descrizione_contesto).
    """
    references = []

    for court in data:
        court_id = court["id"]

        # "audio" è un campo opzionale: è null quando non è disponibile una
        # registrazione audio per quel campetto.
        if court.get("audio"):
            references.append((
                court["audio"],
                f"campetto {court_id}, campo: audio",
            ))

        # "photos" è la lista delle rilevazioni fotografiche del campetto,
        # ordinate dalla più recente alla più vecchia. Ogni rilevazione
        # contiene diversi campi che possono referenziare immagini.
        for survey in court["photos"]:
            survey_date = survey["date"]
            ctx = f"campetto {court_id}, rilevazione {survey_date}"

            # Panoramica: sempre presente (non può essere null).
            references.append((
                survey["overview"],
                f"{ctx}, campo: overview",
            ))

            # Foto di contesto: opzionale.
            if survey.get("context"):
                references.append((
                    survey["context"],
                    f"{ctx}, campo: context",
                ))

            # Dettagli: lista di foto, sempre con almeno un elemento.
            for i, photo_path in enumerate(survey["details"]):
                references.append((
                    photo_path,
                    f"{ctx}, campo: details[{i}]",
                ))

            # Foto d'autore: lista opzionale, spesso vuota.
            for i, photo_path in enumerate(survey["autore"]):
                references.append((
                    photo_path,
                    f"{ctx}, campo: autore[{i}]",
                ))

    return references


def main():
    # Leggo alcampetto.json. Se non c'è o non è JSON valido, lo segnalo ed
    # esco con exit code 2 per distinguerlo dal caso "file mancanti" (1).
    try:
        with open(DATASET) as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERRORE: non trovo {DATASET}", file=sys.stderr)
        print("Assicurati di lanciare lo script dalla radice del repository.",
              file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"ERRORE: alcampetto.json non è JSON valido ({e}).",
              file=sys.stderr)
        return 2

    references = collect_references(data)

    # Per ciascun percorso referenziato, controllo se esiste davvero sul
    # disco. Path.is_file() è True se il percorso punta a un file regolare
    # (e non a una cartella o a un symlink rotto).
    missing = []
    for path, context in references:
        if not (REPO_ROOT / path).is_file():
            missing.append((path, context))

    # Statistiche per il riepilogo finale.
    total_courts = len(data)
    total_surveys = sum(len(c["photos"]) for c in data)
    total_refs = len(references)
    total_missing = len(missing)
    total_verified = total_refs - total_missing

    # Caso positivo: niente di mancante.
    if not missing:
        print(f"Verificati {total_courts} campetti, {total_surveys} rilevazioni — "
              f"{total_refs} file controllati, 0 mancanti.")
        return 0

    # Caso negativo: elenco ogni file mancante con il suo contesto.
    for path, context in missing:
        print(f"✗ {path}")
        print(f"    manca ({context})")
    print()
    print(f"Verificati {total_courts} campetti, {total_surveys} rilevazioni — "
          f"{total_verified}/{total_refs} file controllati, "
          f"{total_missing} mancanti.")
    print()
    print("Suggerimento: controlla di aver caricato tutte le foto della nuova")
    print("rilevazione, e che il nome del file corrisponda esattamente al "
          "percorso indicato in alcampetto.json (attenzione a maiuscole, "
          "trattini e date).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
