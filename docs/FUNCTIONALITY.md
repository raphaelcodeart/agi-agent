# Funzionalità del sistema

Cosa fa **davvero**, oggi, questo software — non un elenco di intenzioni, ma il comportamento effettivo del codice in `apps/api` e `apps/dashboard`. Utile per capire il sistema senza doverlo rileggere da zero, e per chiunque (persona o Claude Code) debba ricostruirlo identico su un nuovo server dopo aver applicato le migration ([DATABASE.md](./DATABASE.md)) e completato il deploy ([DEPLOYMENT.md](./DEPLOYMENT.md)).

Se modifichi il comportamento descritto qui, aggiorna questo file nello stesso commit (AGENTS.md, regola 20).

Il modulo **Blog Writer AI** (generazione articoli, siti WordPress, pubblicazione) è documentato separatamente in [BLOG_WRITER.md](./BLOG_WRITER.md) essendo un modulo isolato con proprie tabelle/endpoint/pagine — questo file copre solo la piattaforma campagne/Buffer preesistente.

---

## Indice

1. [Architettura in breve](#1-architettura-in-breve)
2. [Autenticazione amministratori](#2-autenticazione-amministratori)
3. [Utenti, gruppi e canali](#3-utenti-gruppi-e-canali)
4. [Integrazione Buffer: mock vs production](#4-integrazione-buffer-mock-vs-production)
5. [Campagne: targeting e testo](#5-campagne-targeting-e-testo)
6. [Ciclo di vita di una pubblicazione](#6-ciclo-di-vita-di-una-pubblicazione)
7. [Rate limiting verso Buffer](#7-rate-limiting-verso-buffer)
8. [Task in background (Celery)](#8-task-in-background-celery)
9. [Endpoint API](#9-endpoint-api)
10. [Metriche](#10-metriche)
11. [Media](#11-media)
12. [Impostazioni runtime](#12-impostazioni-runtime)
13. [Cose note come non finite o legacy](#13-cose-note-come-non-finite-o-legacy)

---

## 1. Architettura in breve

```
Next.js dashboard (apps/dashboard)
   → proxy BFF same-origin (app/api/backend/[...path])
      → FastAPI (apps/api), Postgres (fonte di verità), Redis (rate limit + broker Celery)
         → Celery worker (esegue i task) + Celery beat (pianifica i task periodici)
            → Buffer (mock in sviluppo, reale in produzione)
```

Per i dettagli di deploy/infrastruttura vedi [DEPLOYMENT.md](./DEPLOYMENT.md); per lo schema dati vedi [DATABASE.md](./DATABASE.md). Questo file copre solo il *comportamento*.

---

## 2. Autenticazione amministratori

- `POST /api/v1/auth/login` — email + password, verificata con Argon2 (`SecurityService`), ritorna un JWT HS256 valido `ACCESS_TOKEN_EXPIRE_MINUTES` (default 7 giorni).
- `GET /api/v1/auth/me` — ritorna l'amministratore autenticato.
- Ogni altro endpoint richiede il JWT (dependency `get_current_admin`).
- La dashboard verifica lo stesso JWT lato server nelle sue route BFF (`SECRET_KEY` deve essere identica tra `apps/api` e `apps/dashboard`).
- Gli **utenti** (`users`) non fanno mai login: sono gestiti dagli amministratori, non un ruolo applicativo.

---

## 3. Utenti, gruppi e canali

- Un `User` è un cliente/amico i cui canali social vengono pubblicati tramite il **suo** account Buffer personale.
- `status` di un utente (`active`/`inactive`/`suspended`) e `deleted_at` (soft delete) determinano se è targetabile: solo utenti `active` e non cancellati entrano nella risoluzione di una campagna.
- I `UserGroup` sono raggruppamenti arbitrari (many-to-many) usati solo per il targeting, non per permessi.
- Un `SocialChannel` è **un singolo profilo social** connesso a Buffer (una pagina FB, un profilo IG, un canale YouTube...). `is_active` e `publication_mode` (`automatic`/`notification`/`approval`/`disabled`) determinano se una campagna può davvero pubblicarci sopra — `disabled` lo esclude sempre dal targeting, a prescindere dagli altri criteri.
- `SocialChannel.external_link` è l'URL pubblico reale del profilo/pagina sul social network (`Channel.externalLink` di Buffer), popolato dal sync — non un URL Buffer. Può essere `null` se Buffer non lo espone per quella piattaforma. La pagina "Canali" della dashboard lo usa per aprire il profilo in una nuova scheda.

---

## 4. Integrazione Buffer: mock vs production

Buffer non offre più OAuth funzionante per app di terze parti (verificato luglio 2026): l'unico meccanismo di collegamento è che ogni utente generi una **chiave API personale** dal proprio account Buffer (Settings → API) e la incolli nella dashboard. Non esiste alcuna credenziale a livello di piattaforma (niente client id/secret condiviso).

Punto di switch: `get_buffer_client()` in `apps/api/app/integrations/buffer/service.py`, controllato dalla variabile `BUFFER_INTEGRATION_MODE`:

| Modalità | Classe | Comportamento |
|---|---|---|
| `mock` (default) | `MockBufferClient` | Interamente in memoria: nessuna chiamata di rete reale. Organizzazioni/canali fissi restituiti per test. `create_post` supporta stringhe magiche nel testo per simulare errori (`simulate-fail-temp-429` → rate limit, `simulate-fail-temp-500` → errore server, `simulate-fail-perm` → errore permanente). `get_post_metrics` genera metriche pseudo-casuali deterministiche (seed = id del post). |
| `production` | `ProductionBufferClient` | Chiama davvero `https://api.buffer.com` (GraphQL), header `Authorization: Bearer <chiave utente>`. Mappa 401→errore auth, 429→rate limit, 5xx→errore server. |

**Non è mai permesso** che `mock` sia attivo in produzione con dati reali (AGENTS.md, regola 16) — è una responsabilità operativa: verificare `BUFFER_INTEGRATION_MODE=production` nel `.env` di produzione, il codice non lo forza automaticamente in base ad `ENVIRONMENT`.

Ogni implementazione rispetta la stessa interfaccia astratta `BaseBufferClient` (`client.py`): `get_user_info`, `sync_organizations`, `sync_channels`, `create_post`, `get_post_status`, `get_post_metrics`.

Cose specifiche del client production, da non "correggere" per errore:
- YouTube richiede metadati strutturati separati (`metadata.youtube.title`/`categoryId`), non il solo testo del post.
- Instagram richiede `metadata.instagram.type`/`shouldShareToFeed`.
- Facebook richiede `metadata.facebook.type` (`post`/`story`/`reel`) e `metadata.facebook.annotations` (lista, inviata vuota perché il progetto non calcola menzioni/link annotati) — senza questi campi Buffer rifiuta il post con "Facebook posts require a type (post, story, or reel)".
- Le miniature video personalizzate **non vengono mai inviate a Buffer**: l'API reale rifiuta `VideoAssetInput.thumbnailUrl`. Le miniature generate da questo progetto (via ffmpeg) servono solo per l'anteprima interna nella dashboard.

---

## 5. Campagne: targeting e testo

### Modalità di targeting (`Campaign.targeting_mode`)

Risolte da `CampaignResolver.resolve_targets` (`apps/api/app/services/campaign_resolver.py`). La query di base **richiede sempre**, per ogni riga candidata: utente `active` e non cancellato, `BufferConnection.status == "connected"`, canale `is_active`, `publication_mode != "disabled"`. Un utente con connessione Buffer scaduta/non connessa (`expired`, `error`, `disconnected`, `pending`) è **sempre escluso**, qualunque sia il targeting scelto — non è un bug, è la garanzia di non pubblicare con un token non valido.

| Modalità | Chi include |
|---|---|
| `all_active_channels` | Tutti i canali attivi di tutti gli utenti attivi con connessione valida |
| `selected_users` | Solo i canali degli utenti scelti esplicitamente (`user_ids`) |
| `selected_groups` | Solo i canali degli utenti appartenenti ai gruppi scelti (`group_ids`) |
| `selected_channels` | Esattamente i canali scelti (`channel_ids`) — nessun altro filtro applicato sopra |
| `selected_platforms` | Tutti i canali di tutti gli utenti validi che corrispondono alle piattaforme scelte (`platform_names`) |

**Filtro piattaforma secondario** (`platform_names`): applicabile solo sopra a `all_active_channels`, `selected_users`, `selected_groups` — non su `selected_channels` (già esplicito) né su `selected_platforms` (che *è* già il filtro). È un `WHERE platform IN (...)` per singolo canale, **non** un "deve avere tutte queste piattaforme": se scegli Instagram+YouTube e un utente ha solo YouTube, quell'utente contribuisce comunque con il suo canale YouTube, e viene escluso silenziosamente solo su Instagram — nessun errore, nessuna pubblicazione persa, nessun invio sulla piattaforma sbagliata. Se il totale risolto per **l'intera campagna** è zero (es. l'unico utente selezionato non ha connessione valida), `launch_campaign` blocca il lancio con un errore esplicito e imposta `Campaign.status = "failed"`, senza creare nessuna `Publication`.

### Testo per canale

`CampaignResolver.resolve_text_for_channel`, in ordine di priorità:
1. Override specifico del singolo canale (se impostato in fase di lancio)
2. Testo specifico per piattaforma (`instagram_text`, `facebook_text`, `linkedin_text`, `tiktok_text`, `x_text`, `threads_text`)
3. `default_text`

YouTube è un caso a parte: `youtube_title` e `youtube_description` sono campi strutturati separati, risolti indipendentemente dal testo generico (Buffer richiede un titolo per i video YouTube, non solo una didascalia).

**Limite caratteri per piattaforma**: se non è impostato un testo specifico per una piattaforma, il fallback è `default_text` (fino a 5000 caratteri) — ma X/Twitter e Threads hanno limiti reali molto più bassi (280 e 500). `launch_campaign` (`campaign_resolver.py`, `PLATFORM_TEXT_LIMITS`) verifica la lunghezza del testo **risolto** per questi due casi *prima* di contattare Buffer: se supera il limite, quel target/`Publication` viene creato direttamente in stato `failed` con `error_category="validation_failed"` e un messaggio esplicativo, senza sprecare una chiamata reale e senza consumare un tentativo. Gli altri canali della stessa campagna non sono influenzati (ogni destinazione resta indipendente, regola 1 di AGENTS.md).

**Generazione testo con AI (opzionale)**: nello step 2 del wizard, il pulsante "Genera con AI" apre un dialog dove l'admin descrive un argomento in linguaggio naturale; `POST /api/v1/ai/generate-campaign-text` (`app/integrations/openai/client.py`) chiama l'API di OpenAI chiedendo un JSON con tutti e 9 i campi testo, rispettando target di lunghezza realistici per piattaforma nel prompt, un tetto di `max_tokens=1500` per contenere il costo per chiamata, e un **troncamento server-side di sicurezza** (`HARD_LIMITS`) allineato agli stessi vincoli già validati da `CampaignCreateRequest` (x=280, threads=500, youtube_title=100, altri=5000) — non può mai generare un testo che fallisca la creazione della campagna. Il risultato compila i campi del form ma **non salva né lancia nulla**: è solo una bozza di partenza, modificabile liberamente come se fosse scritta a mano. Genera solo testo — nessuna chiamata a endpoint immagine/video di OpenAI esiste in questa integrazione.

Credenziali: la chiave API OpenAI è **configurabile dalla pagina Impostazioni** della dashboard (tabella `ai_settings`, cifrata a riposo come le chiavi Buffer — vedi [DATABASE.md §9](./DATABASE.md#9-impostazioni-ai)), non solo dal `.env`. `GET/PUT/DELETE /api/v1/settings/ai` gestiscono lettura (solo `configured`+`model`, mai la chiave), scrittura (valida la chiave contro `GET /v1/models` di OpenAI prima di salvarla, stesso principio del collegamento Buffer) e rimozione. `app/services/ai_settings_service.get_openai_credentials` decide quale chiave usare ad ogni generazione: quella in `ai_settings` se presente, altrimenti `OPENAI_API_KEY` da `.env` come fallback di primo avvio. Se nessuna delle due è configurata, l'endpoint di generazione risponde 503 e il pulsante mostra un errore chiaro — il resto del wizard funziona identico comunque.

### Modalità di pubblicazione (`Campaign.publishing_mode`)

`immediate` (lancia subito), `scheduled` (aspetta `scheduled_at`, poi il task periodico `poll_and_queue_scheduled_publications` lancia la campagna), `buffer_queue`, `draft` (non lanciata, salvata per dopo), `approval`.

### Stato campagna (`Campaign.status`)

`draft → preparing → queued → running → (paused) → partially_completed | completed | failed | cancelled`. Ricalcolato automaticamente ad ogni cambio di stato di una sua `Publication` (`_recalculate_campaign_status` in `tasks/publication.py`): se *tutti* i target sono terminali e almeno uno è riuscito ma non tutti → `partially_completed`; se tutti riusciti → `completed`; se tutti falliti → `failed`.

### Pausa / ripresa / annullamento / cancellazione

- **Pausa**: congela le pubblicazioni `pending`/`queued` in `retry_wait` per 24h (non le annulla).
- **Ripresa**: le rimette `pending` e ridà la sveglia al task di poll.
- **Annullamento**: cancella la campagna e ogni pubblicazione non ancora terminale — irreversibile.
- **Eliminazione** (`DELETE /campaigns/{id}`): cancella *tutto* in cascata (target, pubblicazioni, tentativi), scrive prima un audit log, funziona anche se la campagna è già stata pubblicata su alcuni canali. Il media allegato **non** viene eliminato (può essere riusato da altre campagne).

---

## 6. Ciclo di vita di una pubblicazione

Ogni coppia `(campagna, canale)` risolta al lancio produce **un** `CampaignTarget` e **una** `Publication` — mai una pubblicazione unica "cumulativa" per la campagna (AGENTS.md, regola 1). La chiave di idempotenza è deterministica: `"{campaign_id}:{social_channel_id}"` — rilanciare la stessa campagna non duplica mai un invio già fatto (AGENTS.md, regola 7).

`Publication.status`:

```
pending → queued → processing → submitted → published
                              ↘ scheduled (se Buffer accoda per dopo)
                 ↘ retry_wait (errore temporaneo, backoff con jitter) → pending (quando matura)
                 ↘ failed (errore permanente, o retry esauriti)
pending/queued/retry_wait → cancelled (azione admin)
qualunque stato non terminale → skipped (azione admin, non verrà più ritentato)
```

Eseguito da `process_publication_task` (`apps/api/app/tasks/publication.py`): prende un lock di riga (`SELECT ... FOR UPDATE SKIP LOCKED`) per evitare doppie esecuzioni concorrenti dello stesso target, controlla il rate limiter, chiama `create_post` sul client Buffer attivo, registra **sempre** un `PublicationAttempt` (successo o fallimento — AGENTS.md, regola 6), poi aggiorna lo stato.

Backoff dei retry (`RETRY_BACKOFF_SEQUENCE_SECONDS`, default `60,300,900,3600,21600`): 1 min, 5 min, 15 min, 1h, 6h — con jitter per evitare thundering herd. Numero massimo di tentativi: `MAX_PUBLICATION_ATTEMPTS` (default 5); il retry manuale da dashboard estende il limite di 3 tentativi in più se già esaurito.

Nessuna pubblicazione **riuscita** viene mai ritentata (AGENTS.md, regola 2): gli endpoint di retry operano solo su `failed`/`cancelled`/`retry_wait`.

**`published` vs `scheduled` sono entrambi esiti di successo**, non uno "in attesa" dell'altro: `scheduled` significa che Buffer ha accettato ed accodato il post per la data futura richiesta (`Campaign.publishing_mode == "scheduled"`), `published` che è già stato pubblicato live. La distinzione immediato/programmato è un dettaglio di *quando*, non un esito diverso — per l'amministratore conta solo che Buffer l'abbia accettato. Il backend li tratta già come equivalenti nel calcolo di `Campaign.status`/`progress_percentage` (`_recalculate_campaign_status`, `campaigns.py`); qualunque contatore lato dashboard che mostri "quante pubblicazioni sono andate a buon fine" deve sommare entrambi in un unico numero ("Riuscite"), altrimenti una campagna programmata risulta erroneamente "a zero successi" pur avendo funzionato — vedi `campaign-progress.tsx` e la lista campagne.

Se un worker crash lascia una pubblicazione bloccata in `processing` per più di 15 minuti, il task periodico `recover_stale_publications` la rimette in `retry_wait` o `failed` a seconda dei tentativi già fatti. Lo stesso task recupera anche pubblicazioni bloccate in `queued` da più di 15 minuti (job Celery perso, mai eseguito) rimettendole in `pending`. Un admin può anche forzare subito un retry manuale su una riga `queued` bloccata da dashboard/endpoint, senza aspettare i 15 minuti.

---

## 7. Rate limiting verso Buffer

`RateLimiter` (`apps/api/app/services/rate_limiter.py`), backed da chiavi Redis:

- `buffer:paused:{connection_id}` — pausa forzata dopo un 429 da quella specifica connessione Buffer.
- `buffer:active:conn:{connection_id}` — concorrenza massima per singola connessione (`CONCURRENT_JOBS_PER_CONNECTION`, default 1).
- `buffer:active:global` — concorrenza massima aggregata su tutte le connessioni (`GLOBAL_CONCURRENCY_LIMIT`, default 5).
- `buffer:last_req:{connection_id}` — intervallo minimo tra due richieste sulla stessa connessione (`PAUSE_BETWEEN_REQUESTS_SECONDS`, default 10s).

Questi limiti sono **modificabili a caldo** senza riavviare i worker: vedi [§12](#12-impostazioni-runtime).

---

## 8. Task in background (Celery)

| Task | Trigger | Cosa fa |
|---|---|---|
| `process_publication` | on-demand (lancio/retry campagna, o dal task di poll) | Esegue una singola pubblicazione verso Buffer (vedi §6) |
| `poll_and_queue_scheduled_publications` | periodico, ogni 30s | Lancia le campagne `draft` il cui `scheduled_at` è passato; accoda le pubblicazioni `pending` o `retry_wait` mature |
| `sync_buffer_connection` | on-demand (collegamento/ricollegamento, sync manuale) | Sincronizza organizzazioni e canali Buffer per una connessione; disattiva i canali non più presenti |
| `refresh_expired_tokens` | periodico, ogni ora | **Codice legacy inattivo**, vedi [§13](#13-cose-note-come-non-finite-o-legacy) |
| `inspect_media` | on-demand (dopo ogni upload media) | ffprobe + generazione miniatura |
| `recover_stale_publications` | periodico, ogni 5 minuti | Recupera pubblicazioni bloccate in `processing` (worker crashato) o in `queued` (job Celery perso) da più di 15 minuti |
| `media_retention_cleanup` | periodico, giornaliero alle 02:00 UTC | Cancella fisicamente file/miniature dei media soft-eliminati |

---

## 9. Endpoint API

Prefisso comune `/api/v1`. Elenco completo per router — per i dettagli di request/response vedi lo Swagger generato automaticamente su `/docs` (FastAPI) di ogni ambiente.

- **`/auth`**: `POST /login`, `GET /me`
- **`/buffer`**: `GET /connections`, `POST /connections` (collega/ricollega), `POST /connections/{id}/sync`, `GET /channels`, `PUT /channels/{id}/publication-mode`, `DELETE /connections/{id}`
- **`/campaigns`**: `GET /`, `POST /`, `POST /preview-targets`, `POST /{id}/launch`, `GET /{id}`, `GET /{id}/metrics`, `POST /{id}/pause`, `POST /{id}/resume`, `POST /{id}/cancel`, `DELETE /{id}`
- **`/publications`**: `GET /`, `GET /{id}`, `GET /{id}/metrics`, `POST /{id}/retry`, `POST /retry-selected`, `POST /retry-campaign-failures/{campaign_id}`, `POST /{id}/cancel`, `POST /{id}/skip`
- **`/media`**: `GET /`, `POST /upload`, `GET /{id}`, `PATCH /{id}` (rinomina solo `original_filename`, non tocca il file fisico), `DELETE /{id}`
- **`/users`**: `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` (soft delete), `GET /groups/list`, `POST /groups`, `PUT /groups/{id}`
- **`/settings`**: `GET /`, `PUT /`, `GET /health`, `GET /ai`, `PUT /ai`, `DELETE /ai` (credenziali OpenAI, vedi §5)
- **`/ai`**: `POST /generate-campaign-text` (bozza testi campagna via OpenAI, richiede una chiave configurata — vedi `/settings/ai` sopra)

---

## 10. Metriche

`GET /campaigns/{id}/metrics` chiama Buffer **on-demand** (non salvato periodicamente) per ogni pubblicazione `published` **o** `scheduled` della campagna con un `external_post_id` valorizzato (stessa equivalenza pubblicato/programmato del §6 — un `scheduled` il cui orario è già passato è quasi certamente già live sulla piattaforma reale anche se la nostra label interna non lo riflette), tramite `get_post_metrics`. Le metriche di tipo "tasso" (es. `engagementRate`, unica percentuale 0-100 secondo la documentazione Buffer) vengono **mediate**, tutte le altre (like, visualizzazioni, commenti, ecc.) vengono **sommate** — non si sommano mai metriche di tipo diverso tra loro nella dashboard (es. visualizzazioni + impression + copertura restano tile separate, perché misurano cose diverse).

`GET /publications/{id}/metrics` è lo stesso meccanismo ma scoped a **una singola pubblicazione** (mostrato nella scheda di dettaglio pubblicazione, sotto "Cronologia tentativi"): stessa chiamata `get_post_metrics`, stesso schema di risposta (`ChannelMetrics`), nessuna aggregazione essendo un solo canale. Risponde 400 se la pubblicazione non è `published`/`scheduled` o non ha ancora un `external_post_id`.

---

## 11. Media

- Upload validato e salvato da `MediaService`; poi `inspect_media` gira ffprobe per estrarre durata/risoluzione/codec (solo video) e genera una miniatura.
- `public_url` deve essere raggiungibile via **HTTPS pubblico**: Buffer scarica il file da lì al momento della pubblicazione. Senza HTTPS configurato, il task di pubblicazione rifiuta esplicitamente (categoria errore `configuration_error`) prima di provare a chiamare Buffer.
- Cancellazione: rifiutata se il media è ancora referenziato da una campagna attiva; altrimenti soft-delete, poi pulizia fisica giornaliera via `media_retention_cleanup`.
- Limite dimensione upload: `UPLOAD_MAX_SIZE_BYTES` (default 100MB) — attenzione a mantenere allineato anche `client_max_body_size` in Nginx (vedi problema noto #6 in DEPLOYMENT.md).
- Rinomina (`PATCH /media/{id}`): modifica solo `original_filename`, cioè il nome mostrato in dashboard — non tocca mai `stored_filename`/`storage_key`/`public_url`, quindi non può mai rompere un media già referenziato da una campagna o già inviato a Buffer.

---

## 12. Impostazioni runtime

`GET/PUT /api/v1/settings` legge/scrive in Redis i limiti di concorrenza, retry e upload — sovrascrivono i default di `apps/api/app/core/config.py` **senza richiedere il riavvio dei worker**, perché ogni task li rilegge da Redis ad ogni esecuzione invece che una sola volta all'avvio. `GET /settings/health` verifica DB (`SELECT 1`), Redis (`ping`) e che almeno un worker Celery risponda (`inspector.ping()`) — usato dal passo 8 di DEPLOYMENT.md.

---

## 13. Cose note come non finite o legacy

- **`get_post_status`** in `ProductionBufferClient` non è implementato (`NotImplementedError`, marcato `BUFFER_API_TODO` nel codice): non è mai stato verificato contro l'API reale di Buffer. Non inventare un comportamento per questo metodo (AGENTS.md, regola 8) — se serve, va prima verificato manualmente contro Buffer e poi implementato.
- **`refresh_expired_tokens`** (task periodico orario in `tasks/sync.py`) presuppone semantiche OAuth (token/refresh token in scadenza) che non si applicano più al modello attuale a chiave API personale (`authentication_type="personal_api_key"`, nessun refresh token). Il task gira ancora ogni ora ma di fatto non ha più righe valide su cui agire nel modello dati corrente — codice legacy rimasto dalla vecchia integrazione OAuth, non rimosso per prudenza. Se lo tocchi, verifica prima con l'utente se va rimosso o riadattato.
- Le colonne `refresh_token_encrypted`, `token_expires_at`, `scopes` su `buffer_connections` esistono ancora nello schema (stessa ragione: retaggio OAuth) ma non sono più popolate dal flusso a chiave API personale — restano `NULL`. Non è un bug, ma non affidarti al loro valore.
