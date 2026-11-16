# Server EatUp

Backend Node.js, Express e TypeScript dell'app EatUp. Espone le API usate dal client Angular, gestisce autenticazione, persistenza MongoDB, email e generazione AI tramite Google GenAI / Vertex AI.

## Responsabilita'

- Registrazione, login tradizionale e login con Google.
- Cifratura password con bcrypt.
- Sessione tramite JWT salvato in cookie HTTP-only.
- Recupero ingredienti dal database.
- Generazione ricette con AI.
- Generazione e salvataggio del programma alimentare settimanale.
- Salvataggio delle ultime ricette generate per utente.
- Generazione della lista della spesa combinando ricette, programma settimanale e ingredienti gia' disponibili.
- Invio email di benvenuto ai nuovi account Google.

## Endpoint principali

- `POST /api/register`: registra un nuovo utente.
- `POST /api/login`: effettua il login con email e password.
- `POST /api/loginWithGoogle`: effettua il login tramite Google Identity Services.
- `POST /api/logout`: elimina il cookie JWT.
- `GET /api/getIngredients`: restituisce ingredienti e categorie.
- `POST /api/generateRecipesFromIngredients`: genera ricette con AI e salva le ultime ricette dell'utente.
- `POST /api/generateWeekProgram`: genera un programma settimanale e lo salva in MongoDB.
- `GET /api/weekProgram`: recupera il programma settimanale salvato.
- `POST /api/generateShoppingList`: genera una lista della spesa ordinata per categoria.
- `GET /api/getCollections`: endpoint di utilita' per leggere le collezioni presenti nel database.

## Generazione lista della spesa

`POST /api/generateShoppingList` richiede un utente autenticato e riceve dal client:

```json
{
  "availableIngredients": ["pasta", "uova", "latte"]
}
```

Il server:

1. recupera l'ultimo programma settimanale dell'utente;
2. recupera le ultime ricette generate dall'utente;
3. unisce gli ingredienti dichiarati disponibili con gli ingredienti sorgente delle ricette;
4. chiede all'AI di creare una lista JSON evitando ingredienti gia' disponibili;
5. normalizza la risposta in categorie con `nome`, `quantita` e `motivo`;
6. restituisce anche le fonti usate (`recipes` e `weekProgram`).

Esempio di risposta:

```json
{
  "categories": [
    {
      "categoria": "Verdura",
      "items": [
        {
          "nome": "Pomodori",
          "quantita": "500 g",
          "motivo": "Serve per ricette e programma settimanale"
        }
      ]
    }
  ],
  "sources": {
    "weekProgram": true,
    "recipes": true
  }
}
```

## Collezioni MongoDB usate

- `users`: account utente e password cifrate.
- `ingredients`: ingredienti divisi per categorie.
- `weekPrograms`: programma settimanale salvato per utente.
- `generatedRecipes`: ultime ricette generate e ingredienti di partenza.

## Configurazione

Crea un file `.env` nella cartella `Server/`.

```env
dbName=EatUp
HTTPS_PORT=3000
DURATA_TOKEN=3600
connectionStringLocal=mongodb://127.0.0.1:27017
connectionStringAtlas=mongodb+srv://...
googleOAuth={"user":"tua-email@gmail.com","pass":"password-per-app-google"}
GOOGLE_CLOUD_PROJECT=nome-progetto-google-cloud
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
VERTEX_AI_MODEL=gemini-3.1-pro-preview
GOOGLE_APPLICATION_CREDENTIALS=percorso/al/service-account.json
```

## Sicurezza e GDPR

Il server tratta dati personali e preferenze alimentari. Le misure principali sono:

- password salvate solo come hash bcrypt;
- JWT firmato e inviato in cookie HTTP-only;
- comunicazione HTTPS;
- route protette dal controllo del token;
- segreti esterni al codice tramite `.env`;
- uso dei dati alimentari solo per ricette, programma settimanale e lista della spesa.

Questi punti sono utili anche per collegare il progetto al GDPR: minimizzazione dei dati, limitazione della finalita', integrita' e riservatezza.

## Avvio

```bash
npm install
npm start
```

Il server risponde su:

```text
https://localhost:3000/api
```
