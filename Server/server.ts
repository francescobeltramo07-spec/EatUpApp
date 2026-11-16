"use strict"

//a. importare le librerie
import http from "http";
import https from "https";
import fs from "fs";
import express, { CookieOptions } from "express";
import dotenv from "dotenv";
import cors from "cors";
import queryStringParcer from "./queryStringParser";
import { Document, MongoClient, ObjectId, WithId } from "mongodb";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import path from "path";
import cookieParser from "cookie-parser"
import { OAuth2Client } from "google-auth-library";
import { rateLimit } from "express-rate-limit";
import Groq from "groq-sdk";

//b. callback
const app: express.Express = express();
// prende le configurazioni dal file .env
dotenv.config({ path: './.env' });
const connectionString = process.env.connectionStringAtlas;  //process.env.connectionStringLocal    process.env.connectionStringAtlas
const dbName = process.env.dbName;
//const PORT = parseInt(process.env.PORT!);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
const FOOD_NOT_FOUND_IMAGE = "/foodNotFound.png";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const recipeImageCache = new Map<string, string>();
const googleAuthClient = new OAuth2Client();
let groqClient: Groq | undefined;
let mongoClient: MongoClient | undefined;
let mongoClientConnection: Promise<MongoClient> | undefined;

async function getMongoClient() {
    if (!connectionString) {
        throw new Error("MongoDB connection string is not configured");
    }

    if (!mongoClient) {
        mongoClient = new MongoClient(connectionString);
    }

    if (!mongoClientConnection) {
        const client = mongoClient;
        mongoClientConnection = client.connect().then(() => client).catch((err) => {
            mongoClientConnection = undefined;
            throw err;
        });
    }

    return mongoClientConnection;
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false
});
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
});

//c. configurazione e avvio del server http
// const server = http.createServer(app);
let paginaErrore: string = "";

fs.readFile("./static/error.html", function (err, content) {
    if (err) {
        paginaErrore = "<h1>Risorsa non trovata</h1>";
    }
    else {
        paginaErrore = content.toString();
    }
});

// server.listen(PORT, function () {
//     console.log(`Server in ascolto sulla porta ${PORT}`);
// });

// creazione ed avvio del server HTTPS
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { "key": privateKey, "cert": certificate }
const jwtKey = fs.readFileSync("keys/jwtKey", "utf8")

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT);

//d. middleware
// 1. log della richiesta
// in app.use() se ometto la risorsa, vuol dire che richiama '/'
app.use('/', function (req, res, next) {
    console.log(`${req.method} ${req.path}`);
    next();
});

// 2. gestione delle risorse statiche
app.use('/', express.static('./static'));

// 3. lettura dei parametri post
// i parametri post sono restuituiti in req.body già parsificati
// i parametri get sono sempre in req.query già parsificati
app.use('/', express.json({ 'limit': '5mb' }));

// 4. gestione dei parametri GET
app.use('/', queryStringParcer);

// 6. vincoli CORS
const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)
);
const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
};
app.use("/", cors(corsOptions))

// 7. cookie parsing
app.use(cookieParser())

// D2. Gestione login e token
//il servizio di login deve essere eseguito PRIMA del controllo token
const cookiesOpsions: CookieOptions = {
    path: "/",//vale per tutte le sotto-route
    httpOnly: true, //non è visibile da javascript
    secure: true,//trasmesso solo su canali HTTPS
    maxAge: parseInt(process.env.DURATA_TOKEN!) * 1000, //durata relativa a partire da ora espressa in millisecondi
    sameSite: "none" //i cookie devono essere trasmessi anche extra domain
}

//1. login
app.post('/api/login', loginLimiter, async function (req, res) {
    const username = req.body?.username;
    const password = req.body?.password;
    let client: MongoClient;

    try {
        client = await getMongoClient();
    } catch {
        return res.status(503).send("Errore di connessione al database");
    }

    try {
        const dbUser = await client.db(dbName).collection("users").findOne({ username });
        if (!dbUser) {
            return res.status(401).send("Username non valido");
        }
        if (typeof password !== "string" || typeof dbUser.password !== "string") {
            return res.status(401).send("Password non valida");
        }

        const isPasswordValid = await bcrypt.compare(password, dbUser.password);
        if (!isPasswordValid) {
            return res.status(401).send("Password non valida");
        }

        const TOKEN = createToken(dbUser);
        res.cookie("TOKEN", TOKEN, cookiesOpsions);
        return res.send({ _id: dbUser._id, token: TOKEN });
    } catch {
        return res.status(500).send("Errore lettura collezioni");
    }
});

app.post('/api/loginWithGoogle', async function (req, res) {
    const googleToken = req.body?.googleToken;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (typeof googleToken !== "string" || !googleClientId) {
        return res.status(401).send("Token Google non valido");
    }

    let email: string;
    try {
        const ticket = await googleAuthClient.verifyIdToken({
            idToken: googleToken,
            audience: googleClientId
        });
        const payload = ticket.getPayload();
        if (!payload?.email || payload.email_verified !== true) {
            return res.status(401).send("Token Google non valido");
        }
        email = payload.email;
    } catch {
        return res.status(401).send("Token Google non valido");
    }

    let client: MongoClient;
    try {
        client = await getMongoClient();
    } catch {
        return res.status(503).send("Errore di connessione al database");
    }

    try {
        const collection = client.db(dbName).collection("users");
        let dbUser = await collection.findOne({ username: email });
        if (!dbUser) {
            const newUser = { username: email };
            const result = await collection.insertOne(newUser);
            dbUser = { ...newUser, _id: result.insertedId };
        }

        const TOKEN = createToken(dbUser);
        res.cookie("TOKEN", TOKEN, cookiesOpsions);
        return res.send({ username: email, token: TOKEN });
    } catch {
        return res.status(500).send("Errore lettura collezioni");
    }
});

// Registrazione
app.post('/api/register', registerLimiter, async function (req, res) {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = req.body?.password;
    if (
        username.length < 3 ||
        username.length > 254 ||
        typeof password !== "string" ||
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).send("Username o password non validi");
    }

    try {
        const client = await getMongoClient();
        const collection = client.db(dbName).collection("users");
        const dbUser = await collection.findOne({ username });
        if (dbUser) {
            return res.status(401).send("Username già esistente");
        }

        const newUser = {
            username,
            password: await bcrypt.hash(password, 10)
        };
        const result = await collection.insertOne(newUser);
        const user = { ...newUser, _id: result.insertedId };
        const TOKEN = createToken(user);
        res.cookie("TOKEN", TOKEN, cookiesOpsions);
        return res.send({ _id: result.insertedId, token: TOKEN });
    } catch {
        return res.status(500).send("Errore server");
    }
});

app.post("/api/logout", function (req, res, next) {
    let options = {
        ...cookiesOpsions,
        maxAge: -1
    }
    res.cookie("TOKEN", "", options)
    res.send({ ok: 1 })
})

// nome della collezione passato come risorsa
app.get('/api/getIngredients', async function (req: any, res: any) {
    const currentCollection: string = "ingredienti"

    let client: MongoClient;
    try {
        client = await getMongoClient();
    } catch {
        return res.status(503).send("Errore di connessione al database");
    }

    try {
        const collection = client.db(dbName).collection(currentCollection);
        const data = await collection.find({}).toArray();
        return res.send(data);
    } catch {
        return res.status(500).send("Errore lettura collezioni");
    }
});

//2. controllo token
//controllo su tutte le richieste che iniziano per /api se il token è valido
app.use("/api", function (req:any, res, next) {
    const authorization = req.get("authorization");
    const bearerToken = typeof authorization === "string"
        ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]
        : undefined;
    const token = req.cookies?.TOKEN ?? bearerToken;
    if (!token) {
        return res.status(403).send("Token mancante")
    } else {
        jwt.verify(token, jwtKey, { algorithms: ["HS256"] }, function (err: any, payload: any) {
            if (err) {
                return res.status(403).send("Token scaduto o non valido")
            } else {
                const newToken = createToken(payload)
                res.cookie("TOKEN", newToken, cookiesOpsions)
                req["username"] = payload.username
                return next();
            }
        })

    }
})

app.post('/api/generateWeekProgram', aiLimiter, async function (req: any, res: any) {
    const calorie = Number(req.body?.calorie);

    if (!calorie || calorie <= 0) {
        return res.status(400).send("Le calorie sono obbligatorie");
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).send("GROQ_API_KEY non configurato nel file .env");
    }

    try {
        const generatedProgram = await generateJson(
            "Sei un nutrizionista digitale per EatUp. Genera solo programmi alimentari realistici e vari, senza diagnosi mediche.",
            {
                richiesta: "Crea un programma alimentare in JSON per 7 date consecutive con colazione, pranzo, merenda e cena. Non usare nomi dei giorni della settimana.",
                vincoli: {
                    calorieGiornaliere: calorie,
                    proteineGrammi: req.body?.proteine ?? null,
                    carboidratiGrammi: req.body?.carboidrati ?? null,
                    grassiGrammi: req.body?.grassi ?? null,
                    fibreGrammi: req.body?.fibre ?? null,
                    preferenze: req.body?.preferenze ?? "",
                    intolleranze: req.body?.intolleranze ?? ""
                }
            },
            "weekly_program",
            {
                type: "object",
                additionalProperties: false,
                required: ["days"],
                properties: {
                    days: {
                        type: "array",
                        minItems: 7,
                        maxItems: 7,
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["colazione", "pranzo", "merenda", "cena"],
                            properties: {
                                colazione: { type: "string" },
                                pranzo: { type: "string" },
                                merenda: { type: "string" },
                                cena: { type: "string" }
                            }
                        }
                    }
                }
            },
            0.2
        );

        const weekProgram = buildDatedWeekProgram(generatedProgram, req.body);
        await saveWeekProgram(req.username, weekProgram);

        return res.send(weekProgram);
    } catch (err: any) {
        return res.status(500).send("Errore durante la generazione del programma settimanale");
    }
});

app.get('/api/weekProgram', async function (req: any, res: any) {
    try {
        const program = await getLatestWeekProgram(req.username);

        return res.send(program ?? { days: [] });
    } catch (err: any) {
        return res.status(500).send("Errore durante il recupero del programma settimanale");
    }
});

app.get('/api/generatedRecipes', async function (req: any, res: any) {
    try {
        const recipes = await getLatestGeneratedRecipes(req.username);
        return res.send(recipes?.groups ?? {});
    } catch (err: any) {
        return res.status(500).send("Errore durante il recupero delle ricette salvate");
    }
});

app.get('/api/shoppingList', async function (req: any, res: any) {
    try {
        const shoppingList = await getLatestShoppingList(req.username);
        return res.send(shoppingList ?? { categories: [] });
    } catch (err: any) {
        return res.status(500).send("Errore durante il recupero della lista della spesa");
    }
});

app.post('/api/generateShoppingList', aiLimiter, async function (req: any, res: any) {
    try {
        const availableIngredients = normalizeStringArray(req.body?.availableIngredients);
        const latestWeekProgram = await getLatestWeekProgram(req.username);
        const latestRecipes = await getLatestGeneratedRecipes(req.username);

        const hasWeekProgram = Array.isArray(latestWeekProgram?.days) && latestWeekProgram.days.length > 0;
        const hasRecipes = !!latestRecipes && hasGeneratedRecipeContent(latestRecipes.groups);
        const generationSignature = createShoppingListSignature(
            availableIngredients,
            latestWeekProgram,
            latestRecipes
        );
        const savedShoppingList = await getLatestShoppingList(req.username);

        if (savedShoppingList?.generationSignature === generationSignature && Array.isArray(savedShoppingList?.categories)) {
            return res.send({
                categories: savedShoppingList.categories,
                sources: savedShoppingList.sources ?? {
                    weekProgram: hasWeekProgram,
                    recipes: hasRecipes
                },
                cached: true
            });
        }

        if (!hasWeekProgram && !hasRecipes) {
            return res.send({
                categories: [],
                sources: {
                    weekProgram: false,
                    recipes: false
                }
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).send("GROQ_API_KEY non configurato nel file .env");
        }

        const recipeSourceIngredients = normalizeStringArray(latestRecipes?.sourceIngredients);
        const ownedIngredients = uniqueStrings([...availableIngredients, ...recipeSourceIngredients]);
        const recipesForShoppingList = hasRecipes ? compactRecipesForShoppingList(latestRecipes.groups) : {};
        const shoppingList = await generateJson(
            "Sei l'assistente spesa di EatUp. Genera una lista concreta, ordinata per categoria e senza ingredienti gia disponibili.",
            {
                richiesta: "Crea una lista della spesa automatica in italiano partendo dalle ricette generate e dal programma settimanale.",
                ingredientiGiaDisponibili: ownedIngredients,
                programmaSettimanale: hasWeekProgram ? latestWeekProgram.days : [],
                ricetteGenerate: recipesForShoppingList,
                regole: [
                    "Includi solo ingredienti probabilmente mancanti o necessari per preparare i pasti.",
                    "Non includere acqua, sale, pepe, olio, spezie comuni o ingredienti gia disponibili.",
                    "Accorpa duplicati e varianti simili nello stesso elemento.",
                    "Usa quantita pratiche quando deducibili, altrimenti scrivi 'q.b.'.",
                    "Ordina gli elementi per categorie da supermercato: Frutta e verdura, Pane pasta e cereali, Carne pesce e uova, Latticini, Dispensa, Surgelati, Altro.",
                    "Nel motivo indica in modo breve se serve per ricette, programma settimanale o entrambi."
                ]
            },
            "shopping_list",
            shoppingListSchema(),
            0.2
        );

        const normalizedShoppingList = normalizeShoppingList(shoppingList);
        const shoppingListResponse = {
            ...normalizedShoppingList,
            sources: {
                weekProgram: hasWeekProgram,
                recipes: hasRecipes
            }
        };

        await saveShoppingList(req.username, shoppingListResponse, {
            availableIngredients,
            generationSignature
        });

        return res.send(shoppingListResponse);
    } catch (err: any) {
        return res.status(500).send("Errore durante la generazione della lista della spesa");
    }
});

app.post('/api/generateRecipesFromIngredients', aiLimiter, async function (req: any, res: any) {
    const ingredients = Array.isArray(req.body?.ingredients)
        ? req.body.ingredients.map((ingredient: any) => String(ingredient).trim()).filter((ingredient: string) => ingredient.length > 0)
        : [];

    if (ingredients.length === 0) {
        return res.status(400).send("Seleziona almeno un ingrediente");
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).send("GROQ_API_KEY non configurato nel file .env");
    }

    const savedRecipes = await getLatestGeneratedRecipes(req.username);
    if (
        savedRecipes &&
        sameStringSet(savedRecipes.sourceIngredients, ingredients) &&
        hasGeneratedRecipeContent(savedRecipes.groups) &&
        recipesHaveGeneratedImages(savedRecipes.groups)
    ) {
        return res.send({
            ...savedRecipes.groups,
            cached: true
        });
    }

    try {
        const recipes = await generateJson(
            "Sei lo chef digitale di EatUp. Suggerisci solo ricette vere, realistiche e cucinabili in italiano. Privilegia piatti riconoscibili, ingredienti compatibili e preparazioni sensate. Non inventare ricette finte.",
            {
                richiesta: "Genera solo ricette vere, riconoscibili e cucinabili, divise in tre gruppi: solo ingredienti selezionati, ricette con 2 o 3 ingredienti extra, ricette con piu ingredienti da comprare ma molto valide.",
                ingredientiSelezionati: ingredients,
                regole: [
                    "Ogni ricetta deve essere un piatto realmente esistente o una variante comune e credibile della cucina italiana o internazionale.",
                    "Non inventare nomi fantasiosi, non proporre abbinamenti assurdi e non creare ricette impossibili da preparare.",
                    "Il titolo deve essere il nome di un piatto vero e riconoscibile, non una frase generica.",
                    "Ogni ricetta deve avere qualita da 0 a 5, ingredienti, ingredientiExtra, descrizione e imageSearchQuery.",
                    "imageSearchQuery deve essere una query breve e precisa per cercare una foto reale dello stesso piatto, non di una categoria generica. Se il piatto ha un nome italiano tradizionale, usa quel nome esatto.",
                    "La descrizione deve spiegare in modo realistico che tipo di piatto e' e perche' funziona con gli ingredienti indicati.",
                    "Le ricette del gruppo soloSelezionati devono usare solo gli ingredienti selezionati piu acqua, sale, pepe, olio o spezie base.",
                    "Le ricette del gruppo pochiExtra devono indicare 2 o 3 ingredienti extra.",
                    "Le ricette del gruppo daComprare possono indicare piu ingredienti extra, ma devono spiegare perche vale la pena.",
                    "Se per un gruppo non esistono ricette vere e plausibili, restituisci un array vuoto invece di forzare una ricetta inventata."
                ]
            },
            "generated_recipes",
            {
                type: "object",
                additionalProperties: false,
                required: ["soloSelezionati", "pochiExtra", "daComprare"],
                properties: {
                    soloSelezionati: {
                        type: "array",
                        minItems: 0,
                        maxItems: 4,
                        items: recipeSchema()
                    },
                    pochiExtra: {
                        type: "array",
                        minItems: 0,
                        maxItems: 4,
                        items: recipeSchema()
                    },
                    daComprare: {
                        type: "array",
                        minItems: 0,
                        maxItems: 4,
                        items: recipeSchema()
                    }
                }
            },
            0.35
        );

        const preparedRecipes = await prepareRecipesForClient(recipes);
        await saveGeneratedRecipes(req.username, preparedRecipes, ingredients);
        return res.send(preparedRecipes);
    } catch (err: any) {
        return res.status(500).send("Errore durante la generazione delle ricette");
    }
});

async function generateJson(
    system: string,
    payload: unknown,
    schemaName: string,
    schema: Record<string, any>,
    temperature: number
) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY non configurato");
    }
    if (!GROQ_MODEL) {
        throw new Error("GROQ_MODEL non configurato");
    }
    if (!groqClient) {
        groqClient = new Groq({ apiKey });
    }

    const response = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            {
                role: "system",
                content: `${system} Rispondi esclusivamente in lingua italiana e rispetta lo schema JSON.`
            },
            {
                role: "user",
                content: JSON.stringify(payload)
            }
        ],
        temperature,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: schemaName,
                strict: true,
                schema
            }
        }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("Groq non ha restituito contenuto JSON");
    }
    return JSON.parse(content);
}

function buildDatedWeekProgram(generatedProgram: any, preferences: any) {
    const days = Array.isArray(generatedProgram?.days) ? generatedProgram.days : [];
    const startDate = todayIsoDate();
    const datedDays = days.slice(0, 7).map((day: any, index: number) => ({
        date: addDaysIsoDate(startDate, index),
        colazione: day?.colazione ?? "",
        pranzo: day?.pranzo ?? "",
        merenda: day?.merenda ?? "",
        cena: day?.cena ?? ""
    }));

    return {
        startDate,
        endDate: addDaysIsoDate(startDate, Math.max(datedDays.length - 1, 0)),
        updatedAt: new Date(),
        preferences: {
            calorie: preferences?.calorie ?? null,
            proteine: preferences?.proteine ?? null,
            carboidrati: preferences?.carboidrati ?? null,
            grassi: preferences?.grassi ?? null,
            fibre: preferences?.fibre ?? null,
            preferenze: preferences?.preferenze ?? "",
            intolleranze: preferences?.intolleranze ?? ""
        },
        days: datedDays
    };
}

async function saveWeekProgram(username: string, weekProgram: any) {
    const db = (await getMongoClient()).db(dbName);
    const savedWeekProgram = {
        ...weekProgram,
        username,
        updatedAt: new Date()
    };

    await db.collection("weekPrograms").updateOne(
        { username },
        {
            $set: savedWeekProgram,
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    await db.collection("users").updateOne(
        { username },
        {
            $set: {
                "savedData.weekProgram": savedWeekProgram,
                "savedData.updatedAt": new Date()
            }
        }
    );
}

async function getLatestWeekProgram(username: string) {
    const db = (await getMongoClient()).db(dbName);
    const user = await db.collection("users").findOne(
        { username },
        { projection: { _id: 0, "savedData.weekProgram": 1 } }
    );

    if (user?.savedData?.weekProgram) {
        return user.savedData.weekProgram;
    }

    return await db.collection("weekPrograms").findOne(
        { username },
        { sort: { updatedAt: -1 }, projection: { _id: 0 } }
    );
}

async function saveGeneratedRecipes(username: string, recipes: any, sourceIngredients: string[]) {
    const db = (await getMongoClient()).db(dbName);
    const savedRecipes = {
        username,
        groups: recipes,
        sourceIngredients,
        updatedAt: new Date()
    };

    await db.collection("generatedRecipes").updateOne(
        { username },
        {
            $set: savedRecipes,
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    await db.collection("users").updateOne(
        { username },
        {
            $set: {
                "savedData.generatedRecipes": savedRecipes,
                "savedData.updatedAt": new Date()
            }
        }
    );
}

async function getLatestGeneratedRecipes(username: string) {
    const db = (await getMongoClient()).db(dbName);
    const user = await db.collection("users").findOne(
        { username },
        { projection: { _id: 0, "savedData.generatedRecipes": 1 } }
    );

    if (user?.savedData?.generatedRecipes) {
        return user.savedData.generatedRecipes;
    }

    return await db.collection("generatedRecipes").findOne(
        { username },
        { sort: { updatedAt: -1 }, projection: { _id: 0 } }
    );
}

async function saveShoppingList(username: string, shoppingList: any, context: any) {
    const db = (await getMongoClient()).db(dbName);
    const savedShoppingList = {
        username,
        ...shoppingList,
        availableIngredients: normalizeStringArray(context?.availableIngredients),
        generationSignature: String(context?.generationSignature ?? ""),
        updatedAt: new Date()
    };

    await db.collection("shoppingLists").updateOne(
        { username },
        {
            $set: savedShoppingList,
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    await db.collection("users").updateOne(
        { username },
        {
            $set: {
                "savedData.shoppingList": savedShoppingList,
                "savedData.updatedAt": new Date()
            }
        }
    );
}

async function getLatestShoppingList(username: string) {
    const db = (await getMongoClient()).db(dbName);
    const user = await db.collection("users").findOne(
        { username },
        { projection: { _id: 0, "savedData.shoppingList": 1 } }
    );

    if (user?.savedData?.shoppingList) {
        return user.savedData.shoppingList;
    }

    return await db.collection("shoppingLists").findOne(
        { username },
        { sort: { updatedAt: -1 }, projection: { _id: 0 } }
    );
}

function todayIsoDate() {
    return formatIsoDate(new Date());
}

function addDaysIsoDate(isoDate: string, daysToAdd: number) {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() + daysToAdd);
    return formatIsoDate(date);
}

function formatIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function recipeSchema() {
    return {
        type: "object",
        additionalProperties: false,
        required: ["titolo", "qualita", "imageSearchQuery", "ingredienti", "ingredientiExtra", "descrizione"],
        properties: {
            titolo: { type: "string" },
            qualita: { type: "number", minimum: 0, maximum: 5 },
            imageSearchQuery: { type: "string" },
            ingredienti: {
                type: "array",
                minItems: 1,
                items: { type: "string" }
            },
            ingredientiExtra: {
                type: "array",
                items: { type: "string" }
            },
            descrizione: { type: "string" }
        }
    };
}

function shoppingListSchema() {
    return {
        type: "object",
        additionalProperties: false,
        required: ["categories"],
        properties: {
            categories: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["categoria", "items"],
                    properties: {
                        categoria: { type: "string" },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["nome", "quantita", "motivo"],
                                properties: {
                                    nome: { type: "string" },
                                    quantita: { type: "string" },
                                    motivo: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
}

async function prepareRecipesForClient(recipes: any) {
    const groupKeys = ["soloSelezionati", "pochiExtra", "daComprare"];
    const result: any = {};

    for (const groupKey of groupKeys) {
        const groupRecipes = Array.isArray(recipes?.[groupKey]) ? recipes[groupKey] : [];
        const realisticRecipes = groupRecipes.filter((recipe: any) => isRealisticRecipe(recipe));

        result[groupKey] = await Promise.all(realisticRecipes.map(async (recipe: any) => ({
                titolo: String(recipe.titolo).trim(),
                qualita: Math.max(0, Math.min(5, Number(recipe.qualita ?? 0))),
                immagine: await findRecipeImage(recipe),
                ingredienti: normalizeStringArray(recipe.ingredienti),
                ingredientiExtra: normalizeStringArray(recipe.ingredientiExtra),
                descrizione: String(recipe.descrizione ?? "").trim()
            })));
    }

    return result;
}

function normalizeShoppingList(shoppingList: any) {
    const categoryOrder = [
        "Frutta e verdura",
        "Pane pasta e cereali",
        "Carne pesce e uova",
        "Latticini",
        "Dispensa",
        "Surgelati",
        "Altro"
    ];

    const categories = Array.isArray(shoppingList?.categories) ? shoppingList.categories : [];
    const normalizedCategories = categories
        .map((category: any) => ({
            categoria: String(category?.categoria ?? "Altro").trim() || "Altro",
            items: Array.isArray(category?.items)
                ? category.items
                    .map((item: any) => ({
                        nome: String(item?.nome ?? "").trim(),
                        quantita: String(item?.quantita ?? "q.b.").trim() || "q.b.",
                        motivo: String(item?.motivo ?? "").trim()
                    }))
                    .filter((item: any) => item.nome.length > 0)
                : []
        }))
        .filter((category: any) => category.items.length > 0);

    normalizedCategories.sort((a: any, b: any) => {
        const firstIndex = categoryOrder.indexOf(a.categoria);
        const secondIndex = categoryOrder.indexOf(b.categoria);
        return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex);
    });

    return { categories: normalizedCategories };
}

function hasGeneratedRecipeContent(groups: any) {
    return ["soloSelezionati", "pochiExtra", "daComprare"]
        .some((groupKey) => Array.isArray(groups?.[groupKey]) && groups[groupKey].length > 0);
}

function recipesHaveGeneratedImages(groups: any) {
    return ["soloSelezionati", "pochiExtra", "daComprare"]
        .flatMap((groupKey) => Array.isArray(groups?.[groupKey]) ? groups[groupKey] : [])
        .every((recipe: any) => {
            const image = String(recipe?.immagine ?? "");
            return image.startsWith("data:image/") || image === FOOD_NOT_FOUND_IMAGE;
        });
}

function compactRecipesForShoppingList(groups: any) {
    const result: any = {};

    for (const groupKey of ["soloSelezionati", "pochiExtra", "daComprare"]) {
        const recipes = Array.isArray(groups?.[groupKey]) ? groups[groupKey] : [];
        result[groupKey] = recipes.map((recipe: any) => ({
            titolo: String(recipe?.titolo ?? "").trim(),
            ingredienti: normalizeStringArray(recipe?.ingredienti),
            ingredientiExtra: normalizeStringArray(recipe?.ingredientiExtra),
            descrizione: String(recipe?.descrizione ?? "").trim()
        }));
    }

    return result;
}

function uniqueStrings(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const key = value.toLocaleLowerCase("it-IT");
        if (!seen.has(key)) {
            seen.add(key);
            result.push(value);
        }
    }

    return result;
}

function sameStringSet(first: any, second: any) {
    const normalizedFirst = normalizeSignatureArray(normalizeStringArray(first));
    const normalizedSecond = normalizeSignatureArray(normalizeStringArray(second));
    return JSON.stringify(normalizedFirst) === JSON.stringify(normalizedSecond);
}

function createShoppingListSignature(availableIngredients: string[], weekProgram: any, recipes: any) {
    return JSON.stringify({
        availableIngredients: normalizeSignatureArray(availableIngredients),
        weekProgramUpdatedAt: normalizeDateForSignature(weekProgram?.updatedAt),
        recipesUpdatedAt: normalizeDateForSignature(recipes?.updatedAt),
        weekProgramStartDate: weekProgram?.startDate ?? "",
        recipeIngredients: normalizeSignatureArray(normalizeStringArray(recipes?.sourceIngredients))
    });
}

function normalizeSignatureArray(values: string[]) {
    return uniqueStrings(values)
        .map((value) => value.toLocaleLowerCase("it-IT"))
        .sort((first, second) => first.localeCompare(second, "it-IT"));
}

function normalizeDateForSignature(value: any) {
    if (!value) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

function isRealisticRecipe(recipe: any) {
    const title = String(recipe?.titolo ?? "").trim();
    const description = String(recipe?.descrizione ?? "").trim();
    const ingredients = normalizeStringArray(recipe?.ingredienti);

    if (title.length < 4 || description.length < 20 || ingredients.length === 0) {
        return false;
    }

    const bannedGenericTitles = [
        "ricetta consigliata",
        "ricetta inventata",
        "piatto creativo",
        "mix di ingredienti",
        "fantasia di ingredienti"
    ];

    return !bannedGenericTitles.some((bannedTitle) => title.toLocaleLowerCase("it-IT").includes(bannedTitle));
}

async function findRecipeImage(recipe: any) {
    const queries = buildRecipeImageQueries(recipe);

    if (queries.length === 0) {
        return FOOD_NOT_FOUND_IMAGE;
    }

    const cacheKey = queries.join("|");

    if (recipeImageCache.has(cacheKey)) {
        return recipeImageCache.get(cacheKey)!;
    }

    let imageUrl: string | null = null;
    for (const query of queries) {
        imageUrl = await findTheMealDbImage(query)
            ?? await findWikipediaImage(query)
            ?? await findWikimediaCommonsImage(query);
        if (imageUrl) {
            break;
        }
    }

    const result = imageUrl ?? FOOD_NOT_FOUND_IMAGE;
    recipeImageCache.set(cacheKey, result);
    return result;
}

function buildRecipeImageQueries(recipe: any) {
    const title = String(recipe?.titolo ?? "").trim();
    const suggestedQuery = String(recipe?.imageSearchQuery ?? "").trim();
    const ingredients = normalizeStringArray(recipe?.ingredienti).slice(0, 2).join(" ");
    const titleTokens = significantTokens(title);
    const suggestedTokens = significantTokens(suggestedQuery);

    return Array.from(new Set([
        title,
        suggestedQuery,
        titleTokens.join(" "),
        suggestedTokens.join(" "),
        titleTokens.slice(-2).join(" "),
        suggestedTokens.slice(-2).join(" "),
        ...titleTokens,
        ...suggestedTokens,
        [title, ingredients].filter(Boolean).join(" ")
    ].map((query) => query.trim()).filter((query) => query.length >= 3)));
}

async function findTheMealDbImage(query: string) {
    const url = "https://www.themealdb.com/api/json/v1/1/search.php?" + new URLSearchParams({
        s: query
    }).toString();

    const data = await fetchJson(url);
    const meals = Array.isArray(data?.meals) ? data.meals : [];

    return meals
        .filter((meal: any) => isRelevantImageResult(query, meal?.strMeal, true))
        .sort((first: any, second: any) => relevanceScore(query, second?.strMeal) - relevanceScore(query, first?.strMeal))
        .map((meal: any) => meal?.strMealThumb)
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findWikipediaImage(query: string) {
    return await findWikipediaImageInLanguage("it", query) ??
        await findWikipediaImageInLanguage("en", query);
}

async function findWikipediaImageInLanguage(language: "it" | "en", query: string) {
    const exactImage = await findExactWikipediaImage(language, query);

    if (exactImage) {
        return exactImage;
    }

    const url = `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrlimit: "5",
        prop: "pageimages|info",
        piprop: "thumbnail|original",
        pithumbsize: "900",
        inprop: "url",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];

    return pages
        .filter((page: any) => isRelevantImageResult(query, page?.title))
        .sort((first: any, second: any) => relevanceScore(query, second?.title) - relevanceScore(query, first?.title))
        .flatMap((page: any) => [page?.original?.source, page?.thumbnail?.source])
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findExactWikipediaImage(language: "it" | "en", query: string) {
    const url = `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
        action: "query",
        titles: query,
        redirects: "1",
        prop: "pageimages|info",
        piprop: "thumbnail|original",
        pithumbsize: "900",
        inprop: "url",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];
    const page = pages.find((item: any) => !item?.missing && isRelevantImageResult(query, item?.title));

    return [page?.original?.source, page?.thumbnail?.source]
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findWikimediaCommonsImage(query: string) {
    const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
        action: "query",
        generator: "search",
        gsrnamespace: "6",
        gsrsearch: query,
        gsrlimit: "20",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "900",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];

    return pages
        .filter((page: any) => isRelevantImageResult(query, page?.title, true))
        .sort((first: any, second: any) => relevanceScore(query, second?.title) - relevanceScore(query, first?.title))
        .map((page: any) => page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url)
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function fetchJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "EatUp/1.0 recipe-image-search"
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (err: any) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function isUsableImageUrl(imageUrl: any) {
    return typeof imageUrl === "string" &&
        imageUrl.startsWith("https://") &&
        /\.(jpg|jpeg|png|webp)(\?|$)/i.test(imageUrl);
}

function isRelevantImageResult(query: string, resultTitle: any, allowPartialMatch = false) {
    if (typeof resultTitle !== "string") {
        return false;
    }

    const queryTokens = significantTokens(query);
    const titleTokens = significantTokens(resultTitle.replace(/^file:/i, ""));

    if (queryTokens.length === 0 || titleTokens.length === 0) {
        return false;
    }

    const matchedTokens = queryTokens.filter((token) => titleTokens.includes(token));
    const requiredMatches = allowPartialMatch
        ? Math.max(1, Math.ceil(queryTokens.length * 0.5))
        : (queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.65));

    return matchedTokens.length >= requiredMatches;
}

function relevanceScore(query: string, resultTitle: any) {
    if (typeof resultTitle !== "string") {
        return 0;
    }

    const queryTokens = significantTokens(query);
    const titleTokens = significantTokens(resultTitle.replace(/^file:/i, ""));
    const matchedTokens = queryTokens.filter((token) => titleTokens.includes(token));

    return matchedTokens.length * 10 - Math.max(0, titleTokens.length - matchedTokens.length);
}

function significantTokens(value: string) {
    const stopWords = new Set([
        "con", "alla", "alle", "allo", "all", "della", "delle", "degli", "del", "di", "e", "al", "ai",
        "the", "and", "with", "food", "dish", "recipe", "recipes", "cooked", "homemade", "plate", "file", "jpg", "jpeg", "png", "webp"
    ]);

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function normalizeStringArray(value: any) {
    return Array.isArray(value)
        ? value.map((item: any) => String(item).trim()).filter((item: string) => item.length > 0)
        : [];
}

function createToken(data: any) {
    //tempo di creazione del token in secondi
    let now = Math.floor(((new Date()).getTime()) / 1000);
    const payload = {
        _id: data._id,
        username: data.username,
        iat: data.iat || now,
        exp: now + parseInt(process.env.DURATA_TOKEN!)
    }
    return jwt.sign(payload, jwtKey, { algorithm: "HS256" });
}

//f. default root
app.use(function (req, res, next) {
    if (req.originalUrl.startsWith('/api/')) {
        // servizio non trovato
        res.status(404).send("Risorsa non trovata");
    }
    else if (req.accepts('html')) {
        res.status(404).send(paginaErrore);
    }
    else {
        res.sendStatus(404);
    }
});

//g. gestione degli errori
app.use('/', function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    // err.stack contiene l'elenco completo degli errori
    res.status(500).send(err.message);
});
