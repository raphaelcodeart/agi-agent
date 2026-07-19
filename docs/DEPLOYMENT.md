# Guida al deploy su server Linux

Guida pratica per portare questo progetto (backend FastAPI + frontend Next.js + Postgres + Redis) su un server Linux, creare il database, e avviare tutto. Scritta per essere seguita passo passo da una persona, oppure eseguita direttamente da Claude Code se gli viene chiesto "fai il deploy seguendo docs/DEPLOYMENT.md".

Se sei Claude Code e stai leggendo questo file per eseguire un deploy: vai alla sezione **[13. Istruzioni per Claude Code](#13-istruzioni-per-claude-code)** in fondo prima di iniziare.

---

## Indice

1. [Cosa serve prima di iniziare](#1-cosa-serve-prima-di-iniziare)
2. [Installare Docker sul server](#2-installare-docker-sul-server)
3. [Portare i file del progetto sul server](#3-portare-i-file-del-progetto-sul-server)
4. [Configurare il file .env](#4-configurare-il-file-env)
5. [Creare il database e le tabelle](#5-creare-il-database-e-le-tabelle)
6. [Creare l'utente amministratore](#6-creare-lutente-amministratore)
7. [Avviare backend e frontend](#7-avviare-backend-e-frontend)
8. [Verificare che tutto funzioni](#8-verificare-che-tutto-funzioni)
9. [Dominio e HTTPS (opzionale, consigliato)](#9-dominio-e-https-opzionale-consigliato)
10. [Backup e ripristino del database (il "dump")](#10-backup-e-ripristino-del-database-il-dump)
11. [Aggiornare il progetto in futuro](#11-aggiornare-il-progetto-in-futuro)
12. [Problemi noti e cose da sistemare](#12-problemi-noti-e-cose-da-sistemare)
13. [Istruzioni per Claude Code](#13-istruzioni-per-claude-code)
14. [Comandi di uso quotidiano (riepilogo)](#14-comandi-di-uso-quotidiano-riepilogo)

---

## 1. Cosa serve prima di iniziare

- Un server Linux (consigliato **Ubuntu 22.04 o 24.04 LTS**), con almeno 2 GB di RAM.
- Un utente con permessi `sudo` e accesso SSH (es. `ssh utente@IP_DEL_SERVER`).
- Nessuna conoscenza di Docker richiesta: i comandi sono già pronti qui sotto, basta copiarli.
- Facoltativo ma consigliato: un nome a dominio che punti all'IP del server (serve solo per il passo 9, HTTPS).

Tutto il progetto gira dentro **container Docker**: non devi installare Python, Node.js o Postgres direttamente sul server, solo Docker.

---

## 2. Installare Docker sul server

Collegati al server via SSH, poi esegui:

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Docker (script ufficiale)
curl -fsSL https://get.docker.com | sudo sh

# Permetti al tuo utente di usare docker senza scrivere "sudo" ogni volta
sudo usermod -aG docker $USER
newgrp docker

# Verifica che funzioni
docker --version
docker compose version
```

Se `docker compose version` risponde con un numero di versione, sei a posto.

---

## 3. Portare i file del progetto sul server

Hai due strade. **Consigliata: Git**, perché rende semplicissimi i futuri aggiornamenti (vedi sezione 11).

### Opzione A — Git (consigliata)

Sul tuo PC Windows, dentro la cartella del progetto (`e:\Clienti\AgentMultiPost`), apri Git Bash e crea un repository:

```bash
cd /e/Clienti/AgentMultiPost
git init
git add .
git commit -m "Initial commit"
```

Crea un repository vuoto su GitHub (o GitLab, o un altro servizio) e collegalo:

```bash
git remote add origin https://github.com/TUO-UTENTE/TUO-REPO.git
git branch -M main
git push -u origin main
```

Sul server:

```bash
git clone https://github.com/TUO-UTENTE/TUO-REPO.git social-publisher
cd social-publisher
```

### Opzione B — Copia diretta (senza Git)

Se non vuoi usare Git, copia i file direttamente da Windows al server con `scp` (da Git Bash, sul tuo PC):

```bash
# Attenzione: NON copiare node_modules, .next, __pycache__ (sono pesanti e si rigenerano da soli)
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '__pycache__' --exclude '.venv' \
  /e/Clienti/AgentMultiPost/ utente@IP_DEL_SERVER:~/social-publisher/
```

Se `rsync` non è disponibile su Windows, usa `scp -r` (più lento, copia tutto compresi i file inutili — poi cancellali sul server con `rm -rf node_modules apps/*/node_modules apps/dashboard/.next`).

> Con questa opzione, per aggiornare il codice in futuro dovrai ripetere la copia ogni volta. Con Git basta `git pull`.

---

## 4. Configurare il file .env

Il progetto ha **un solo file `.env` nella cartella principale**, condiviso da backend e frontend (Docker lo carica automaticamente in entrambi i container).

```bash
cd ~/social-publisher   # o il nome che hai dato alla cartella
cp .env.example .env
nano .env
```

Cosa cambiare rispetto all'esempio (le altre righe puoi lasciarle come sono):

| Variabile | Cosa metterci | Perché |
|---|---|---|
| `SECRET_KEY` | una stringa casuale lunga | firma i login degli amministratori — se qualcuno la scopre può falsificare l'accesso |
| `ENCRYPTION_KEY` | una chiave generata come spiegato sotto | cripta i token Buffer salvati nel database |
| `POSTGRES_PASSWORD` | una password robusta a tua scelta | password del database |
| `DATABASE_URL` | aggiorna la password se l'hai cambiata sopra | stringa di connessione al database |
| `NEXT_PUBLIC_API_URL` | `http://IP_DEL_SERVER:8000` (o il tuo dominio, vedi sezione 9) | indirizzo che il **browser** userà per l'API |
| `API_INTERNAL_URL` | lascia `http://api:8000` | indirizzo che usa il frontend **dentro Docker** per parlare col backend, non cambia mai |
| `BUFFER_INTEGRATION_MODE` | `mock` finché non hai le credenziali Buffer reali, poi `production` | vedi sezione 12 |

Genera `SECRET_KEY` con:

```bash
openssl rand -hex 32
```

Genera `ENCRYPTION_KEY` con:

```bash
docker run --rm python:3.12-slim python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || \
python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

(il secondo comando è un fallback se non hai voglia di scaricare l'immagine Python solo per questo; il formato è compatibile).

Salva con `Ctrl+O`, esci con `Ctrl+X`.

**Importante:** questo file contiene segreti veri. Non finisce mai su Git (è già escluso in `.gitignore`) e non va condiviso.

---

## 5. Creare il database e le tabelle

Qui rispondo alla tua domanda "il database, le tabelle che servono come le creiamo?".

Il progetto usa **Alembic** (lo strumento standard di FastAPI/SQLAlchemy per gestire le tabelle del database in modo tracciato e ripetibile, invece di crearle a mano con SQL). In pratica: le tabelle non esistono finché non esegui una "migration".

**Nota tecnica importante**: questo progetto non ha ancora nessuna migration salvata (la cartella `apps/api/alembic/versions/` è vuota). Il primo che esegue questi comandi genera il file che crea davvero tutte le tabelle — dopo, quel file va **salvato nel progetto** (con `git add`/`git commit`, o riportato indietro sul tuo PC) così non dovrai mai più rigenerarlo, in nessun altro ambiente.

Passo per passo, dalla cartella del progetto sul server:

```bash
# 1) Avvia solo database e redis (non ancora backend/frontend)
docker compose up -d db redis

# 2) Aspetta ~10 secondi che il database sia pronto, poi controlla:
docker compose ps
# la colonna "STATUS" di "db" deve dire "healthy"

# 3) Costruisci l'immagine del backend (serve per eseguire i comandi Python/Alembic)
docker compose build api

# 4) Genera la migration iniziale (crea il file che descrive tutte le tabelle)
#    IMPORTANTE: usa sempre "docker compose" semplice (senza -f docker-compose.prod.yml)
#    per QUESTO comando, anche se il tuo obiettivo finale è la produzione. Solo il file
#    di sviluppo collega la cartella apps/api al container, quindi solo così il file
#    generato appare davvero sul disco (in apps/api/alembic/versions/) invece di sparire
#    con il container. Una volta generato e salvato con git, tutti gli altri ambienti
#    (incluso docker-compose.prod.yml) lo trovano già pronto e devono solo applicarlo.
docker compose run --rm api alembic revision --autogenerate -m "initial schema"

# 5) Applica la migration: QUESTO è il comando che crea davvero le tabelle nel database
docker compose run --rm api alembic upgrade head
```

Se tutto va bene, l'output del comando 4 elenca le tabelle create (`users`, `user_groups`, `buffer_connections`, `social_channels`, `media_files`, `campaigns`, `campaign_targets`, `publications`, `publication_attempts`, `administrators`, `audit_log`, ecc.) e il comando 5 termina senza errori.

**Salva la migration generata**, altrimenti la perdi se il server viene ricreato:

```bash
git add apps/api/alembic/versions/
git commit -m "Add initial database migration"
git push
```

(se usi la copia diretta invece di Git, scarica quel file sul tuo PC con `scp` e conservalo).

Da questo momento in poi, per creare il database su qualsiasi altro ambiente (staging, un altro server, il tuo PC) basta il comando 5 (`alembic upgrade head`), **non rigenerare mai più il comando 4** a meno che tu non modifichi i modelli del backend (in quel caso è normale farne una nuova, si chiama `make revision name="descrizione modifica"`).

---

## 6. Creare l'utente amministratore

Con il database pronto, crea il primo account per accedere alla dashboard:

```bash
docker compose run --rm api python -m app.utils.create_admin \
  --email "tuaemail@esempio.com" \
  --password "UnaPasswordRobusta123!" \
  --name "Il tuo nome"
```

Questo è l'account con cui farai login sulla dashboard (sezione 8).

> In alternativa esiste `make seed`, che crea l'admin **insieme a dati di esempio** (utenti finti, campagne finte) — comodo per fare un test rapido, ma **cancella e ricrea tutte le tabelle**, quindi usalo solo su un database vuoto/di prova, mai su un database con dati veri.

---

## 7. Avviare backend e frontend

Ci sono due file Docker Compose:

- **`docker-compose.yml`** — pensato per test/sviluppo: espone le porte 3000 (dashboard), 8000 (API), 5432 (database) e 6379 (redis) direttamente, così puoi raggiungerle da `http://IP_DEL_SERVER:3000` senza configurare nulla.
- **`docker-compose.prod.yml`** — pensato per produzione: solo Nginx espone le porte 80/443 verso l'esterno, tutto il resto resta interno e più sicuro. Richiede un dominio configurato (sezione 9).

### Per iniziare subito, senza dominio (consigliato per il primo avvio)

```bash
docker compose build
docker compose up -d
docker compose ps
```

Apri il browser su `http://IP_DEL_SERVER:3000` — dovresti vedere la pagina di login.

### Per la produzione vera e propria, con dominio e Nginx

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db redis
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker compose -f docker-compose.prod.yml up -d
```

(le migration vanno applicate anche qui — se le hai già fatte al passo 5 con l'altro compose file, il database è lo stesso volume solo se non hai cambiato `POSTGRES_DB`/`POSTGRES_USER`; altrimenti ripeti il passo 5 con `-f docker-compose.prod.yml`).

---

## 8. Verificare che tutto funzioni

```bash
# Il backend risponde?
curl http://localhost:8000/
# Deve rispondere: {"status":"online","service":"...","docs_url":"/docs"}

# Il controllo di salute (database, redis, worker) è ok?
curl http://localhost:8000/api/v1/settings/health

# I log, se qualcosa non va:
docker compose logs -f api
docker compose logs -f dashboard
docker compose logs -f worker
```

Poi apri il browser su `http://IP_DEL_SERVER:3000/login` (o il tuo dominio) e prova ad accedere con l'account creato al passo 6.

---

## 9. Dominio e HTTPS (consigliato, richiesto per pubblicare foto/video su Buffer)

HTTPS non è più opzionale se vuoi pubblicare foto/video: Buffer scarica il media dall'URL quando il post va in coda e rifiuta URL non-HTTPS (vedi problema noto #4 nella sezione 12). Le campagne di solo testo funzionano anche senza.

### Se hai già un dominio tuo

Punta questi sottodomini all'IP del server (record DNS di tipo A):

- `app.tuodominio.com` → dashboard
- `api.tuodominio.com` → backend
- `media.tuodominio.com` → file media

Poi modifica `infrastructure/nginx/nginx.conf` sostituendo i tre hostname `*.162-55-187-18.sslip.io` con i tuoi domini reali, e ripeti la procedura sotto passando i tuoi domini invece del valore sslip.io.

### Se non hai un dominio: sslip.io (nessun costo, nessuna registrazione)

[sslip.io](https://sslip.io) è un servizio DNS pubblico reale (non un dominio "interno" o finto) che fa risolvere hostname come `162-55-187-18.sslip.io` direttamente all'IP incorporato nel nome — senza possedere né configurare nulla. Essendo un dominio pubblico realmente risolvibile, **Let's Encrypt può emettere certificati HTTPS validi** per questi hostname tramite la normale challenge HTTP-01 (non serve un certificato wildcard).

`infrastructure/nginx/nginx.conf` in questo repo è già configurato per l'IP di questo server (`162.55.187.18` → `app.162-55-187-18.sslip.io`, `api.162-55-187-18.sslip.io`, `media.162-55-187-18.sslip.io`). Per ottenere i certificati reali:

```bash
docker compose down   # ferma lo stack dev, libera la porta 80
./scripts/setup-https.sh 162-55-187-18.sslip.io tuaemail@esempio.com
```

Lo script (vedi commenti in testa al file per i dettagli):
1. avvia uno stack temporaneo con Nginx in solo HTTP per rispondere alla verifica di Let's Encrypt;
2. richiede un certificato Let's Encrypt valido per tutti e tre gli hostname in un solo comando (Certbot, container ufficiale, nessuna installazione sull'host);
3. ripristina la configurazione Nginx finale con HTTPS attivo e la ricarica.

Da questo momento la piattaforma gira sullo **stack produzione** (`docker-compose.prod.yml`): solo Nginx espone le porte 80/443 verso l'esterno, tutto il resto (Postgres, Redis, API, dashboard) resta interno a Docker. **Nota**: questo stack usa un volume Postgres diverso da quello di sviluppo (`postgres_data_prod`), quindi al primo avvio va **ripetuta la sezione 5** (`alembic upgrade head`) e la **sezione 6** (creare l'amministratore) su questo volume.

Rinnovo automatico: i certificati Let's Encrypt durano 90 giorni. Una volta ottenuto il primo certificato, la configurazione Nginx finale (quella già nel repo) risponde già da sola alla verifica ACME su porta 80, quindi il rinnovo **non richiede più lo script**: basta `certbot renew` seguito da un reload di Nginx. Aggiungi in crontab (stesso schema del backup, sezione 10):

```bash
crontab -e
# Rinnovo certificato ogni notte alle 4:00 (no-op se non vicino a scadenza)
0 4 * * * cd ~/social-publisher && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload >> backups/certbot-renew.log 2>&1
```

---

## 10. Backup e ripristino del database (il "dump")

Un **dump** è una fotografia completa del database in un file `.sql`: serve per fare backup, spostare i dati su un altro server, o tornare indietro se qualcosa va storto.

Ho preparato due script pronti in `scripts/`:

```bash
# Crea un backup completo in backups/<data>.sql (e backups/latest.sql)
./scripts/backup-db.sh

# Ripristina un backup (ATTENZIONE: sovrascrive i dati attuali, chiede conferma)
./scripts/restore-db.sh backups/latest.sql
```

Consigli pratici:

- Esegui `./scripts/backup-db.sh` **prima di ogni aggiornamento importante** del progetto.
- Scarica periodicamente i file da `backups/` sul tuo PC o su uno storage esterno (i backup restano solo sul server finché non li copi altrove — se il server si rompe, li perdi insieme al resto).
- Imposta un backup automatico giornaliero con `cron`, ad esempio:
  ```bash
  crontab -e
  # aggiungi questa riga (backup ogni notte alle 3:00):
  0 3 * * * cd ~/social-publisher && ./scripts/backup-db.sh >> backups/backup.log 2>&1
  ```

---

## 11. Aggiornare il progetto in futuro

Se hai usato Git (opzione A al passo 3), aggiornare è semplice. Ho preparato uno script che fa tutto:

```bash
./scripts/deploy.sh
```

Fa, in ordine: `git pull`, ricostruisce le immagini Docker cambiate, applica eventuali nuove migration del database, riavvia tutti i servizi. Usa `docker-compose.prod.yml` di default; se stai ancora usando la configurazione senza dominio, esegui `COMPOSE_FILE=docker-compose.yml ./scripts/deploy.sh`.

Se hai copiato i file manualmente (opzione B), ripeti la copia con `rsync`, poi:

```bash
docker compose build
docker compose run --rm api alembic upgrade head
docker compose up -d
```

---

## 12. Problemi noti e cose da sistemare

Trasparenza su alcune cose che **non funzioneranno ancora perfettamente** su un server reale, così non perdi tempo a capire perché:

1. ~~Il collegamento OAuth con Buffer reindirizza sempre a `localhost:3000`~~ — **risolto**: il collegamento non usa più OAuth. Verificato su developers.buffer.com (luglio 2026) che Buffer non accetta più registrazioni OAuth di nuove app di terze parti (né sulla vecchia REST API, né — non ancora — sulla nuova API GraphQL). Ogni utente genera una **chiave API personale** dal proprio account Buffer (Settings → API) e la incolla nella dashboard (pulsante "Collega account" in Connessioni Buffer); il backend la valida e la salva cifrata. Nessun redirect, nessun problema di dominio/localhost.
2. **CORS nel backend** (`apps/api/app/main.py`) accetta richieste da `http://localhost:3000`, `http://app.example.com` e dal dominio sslip.io configurato per questo server (`https://app.162-55-187-18.sslip.io`). Se usi un dominio diverso, aggiorna quella lista. Nota: il collegamento Buffer e la maggior parte delle chiamate della dashboard passano dal proxy interno same-origin, quindi non sono influenzate da questo; riguarda solo eventuali chiamate dirette al backend dal browser.
3. **`BUFFER_INTEGRATION_MODE=mock`** nel `.env`: finché resta così, la piattaforma non parla col vero Buffer, usa dati finti generati dal backend stesso (utile per collaudare tutto senza account Buffer reali). Quando un utente fornisce la propria chiave API Buffer reale, va cambiato `BUFFER_INTEGRATION_MODE=production` — non serve più nessuna credenziale a livello di piattaforma (niente `BUFFER_CLIENT_ID`/`BUFFER_CLIENT_SECRET`, rimossi).
4. ~~Pubblicazione di foto/video su Buffer richiede hosting media in HTTPS pubblico~~ — **risolvibile**: segui la sezione 9 (`./scripts/setup-https.sh`) per attivare HTTPS reale con un dominio sslip.io. `PUBLIC_MEDIA_BASE_URL` nel `.env` deve puntare all'origine `https://media.<tuo-dominio>` risultante; il guardrail in `apps/api/app/tasks/publication.py` continuerà a rifiutare esplicitamente (Publication "failed", categoria "configuration_error") solo se questa variabile non è ancora configurata in HTTPS. Le campagne di solo testo funzionano comunque anche senza.
5. **Media caricati**: i file finiscono in un volume Docker (`media_storage`), servito da Nginx. Se cambi server, i file media non si spostano da soli — vanno copiati a parte (non sono nel dump del database).

Nessuno di questi blocca l'avvio della dashboard, degli utenti, delle campagne o del resto: riguardano solo l'integrazione reale con Buffer.

---

## 13. Istruzioni per Claude Code

Se l'utente ti chiede di fare il deploy su un server a cui hai accesso (es. via terminale SSH collegato), segui questo ordine e **fermati a chiedere conferma prima di ogni passo distruttivo** (sovrascrivere `.env` esistente, `alembic upgrade` su un database con dati veri, `restore-db.sh`, force-push):

1. Verifica cosa esiste già sul server prima di agire: `docker --version`, presenza di una cartella del progetto, un `.env` già configurato, container già in esecuzione (`docker compose ps`). Non sovrascrivere nulla di esistente senza chiedere.
2. Segui le sezioni 2 → 8 in ordine. Salta i passi già completati (es. se Docker è già installato, salta la sezione 2).
3. Per la sezione 4 (`.env`): se il file esiste già, NON rigenerarlo — leggilo e verifica solo che le variabili richieste siano presenti. Se manca, generalo con i comandi indicati e mostra all'utente cosa hai messo (tranne i segreti, di quelli conferma solo che sono stati generati).
4. Per la sezione 5: se `apps/api/alembic/versions/` contiene già dei file, **non generare una nuova migration iniziale** — esegui solo `alembic upgrade head`. Genera una nuova migration solo se l'utente ha modificato i modelli SQLAlchemy e te lo chiede esplicitamente.
5. Dopo ogni `docker compose up -d`, verifica lo stato con `docker compose ps` e i log (`docker compose logs --tail 50 <servizio>`) prima di dichiarare il passo riuscito.
6. Esegui sempre `./scripts/backup-db.sh` prima di un redeploy che tocca un database con dati reali.
7. Alla fine, riporta all'utente: quali container sono attivi, su quale URL è raggiungibile la dashboard, quali credenziali admin sono state create (senza scrivere la password in chiaro nel riepilogo se il canale non è sicuro — di' solo che è stata impostata), e quali dei "problemi noti" (sezione 12) restano da sistemare.

Non modificare l'integrazione Buffer reale, i worker Celery o la logica di pubblicazione durante un deploy, a meno che l'utente non lo chieda esplicitamente (vedi `AGENTS.md` alla radice del progetto).

---

## 14. Comandi di uso quotidiano (riepilogo)

```bash
# Stato dei servizi
docker compose ps

# Log di un servizio in tempo reale
docker compose logs -f api
docker compose logs -f dashboard

# Riavviare un servizio
docker compose restart api

# Fermare tutto
docker compose down

# Backup del database
./scripts/backup-db.sh

# Aggiornare il progetto (dopo git pull automatico)
./scripts/deploy.sh

# Aprire una shell dentro il container del backend (debug)
docker compose exec api bash

# Creare un nuovo amministratore
docker compose run --rm api python -m app.utils.create_admin --email "..." --password "..." --name "..."
```
