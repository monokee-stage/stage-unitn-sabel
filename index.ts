import * as express from 'express';
import * as http from 'http';
import { ajv, issueCallback, issueCallbackSchema, presentationCallback, presentationCallbackSchema, verifiableCredentials } from "./schemas";
import { JSONSchemaType } from "ajv";
import { createClient } from 'redis';

const PORT: number = 8000;
const ID_PREFIX: string = "id";

// let apikey_to_claims = new Map<string, (verifiableCredentials | undefined)[]>()
// let id_to_qr = new Map<string, boolean>()

// Create Express server
const app = express();
const http_server = http.createServer(app);

// Use Redis to save temporally the credentials
const redis = createClient();

// Middle-ware which use ajv library to check the body using schema
function checkSchema<T>(endpoint: string, schema: JSONSchemaType<T>) {
    let validate = ajv.compile(schema)
    app.use(endpoint, (req, res, next) => {
        if (!validate(req.body)) {
            const errors = ajv.errors;
            res.status(400).send(errors)
            console.error(`Middle-ware schema not passed ${errors}`)
            console.error(req.body)
        } else {
            next()
        }
    })
}

// Parse all arrived msg body as json (middle-ware)
app.use(express.json())

// Serve DID document
app.get('/.well-known/did.json', (_req, res) => {
    res.sendFile(__dirname + '/public/.well-known/did.json')
})
app.get('/.well-known/did-configuration.json', (_req, res) => {
    res.sendFile(__dirname + '/public/.well-known/did-configuration.json')
})


checkSchema("/presentationcallback", presentationCallbackSchema)
app.post("/presentationcallback", (req, res) => {
    const body: presentationCallback = req.body
    console.log(body)
    const apikey = req.headers["api-key"]
    // Identify the request using requestId
    console.log("[Verifier] Arrive callback with requestId = ", body.requestId, " and apikey =", apikey)
    switch (body.requestStatus) {
        case "request_retrieved": {
            // QR has been scanned
            redis.set(ID_PREFIX + body.requestId, "true");
            // id_to_qr.set(body.requestId, true)
            console.log("Hide qr")
            break;
        };
        case "presentation_verified": {
            // User has already present the credentials
            redis.del(ID_PREFIX + body.requestId); // TODO: await?
            // id_to_qr.delete(body.requestId)
            console.log("VC checked")
            console.log(body.verifiedCredentialsData)
            if (typeof apikey === "string") {
                // Extract only valid credentials
                const vcs = body.verifiedCredentialsData.map((vc) => {if (vc.credentialState.revocationStatus === "VALID") return vc});
                redis.set(apikey, JSON.stringify(vcs));
                // apikey_to_claims.set(apikey, vcs)

                // set 5 min Timeout to expiry VC
                setTimeout(() => {
                    // apikey_to_claims.delete(apikey)
                    redis.del(apikey);
                }, 300*1000) 
            } else {
                res.status(403)
            }
            break;
        };
        case "presentation_error": {
            // Remove the request from the pendings and show the error occured
            redis.del(ID_PREFIX + body.requestId);
            // id_to_qr.delete(body.requestId)
            console.log("VC error")
            console.log(body.error)
            break;
        }
        default: {
            console.error("Strange value")
        }
    }
    // Send the response (needed for correct functionality of the VerifiedID api)
    res.send()
})

checkSchema("/issuancecallback", issueCallbackSchema)
app.post("/issuancecallback", async (req, res) => {
    let body: issueCallback = req.body
    console.log(body)
    // Identify the request by the requestId
    console.log("[Issuer] Arrive callback with requestId = ", body.requestId, " and apikey =", req.headers["api-key"])
    switch (body.requestStatus) {
        case ("request_retrieved"): {
            // QR has been scanned

            // id_to_qr.set(body.requestId, true);
            // If below does not help against multiple issuance
            const check = await redis.get(ID_PREFIX + body.requestId);
            if (check === "issued") {
                res.status(403).send("Request already approved");
                console.log("Already issued")
                return;
            }

            redis.set(ID_PREFIX + body.requestId, "processing");
            setTimeout(() => { redis.del(ID_PREFIX + body.requestId)
                    .catch((err) => { console.error(`Cannot delete ${body.requestId} because of ${err}`); }); }, 
                1000*600); // Expires after 10 minutes
            console.log("Hide qr")
            break;
        };
        case ("issuance_successful"): {
            // Credentials are correctly saved in the wallet
            // id_to_qr.delete(body.requestId)
            redis.set(ID_PREFIX + body.requestId, "issued");
            console.log("VC issued")
            break;
        };
        case ("issuance_error"): {
            // id_to_qr.delete(body.requestId);
            redis.set(ID_PREFIX + body.requestId, "error");
            console.error("Some error happened during issuance: " + body.error.message);
            break;
        };
        default: {
            console.error("Strange value")
        }
    }
    res.send()
})

app.get("/vcs", async (req, res) => {
    console.log("Credentials request")
    const apikey = req.headers["api-key"]
    // Use apikey to verify identify the request and check the sender
                
    if (typeof apikey !== "string") {
        res.sendStatus(401)
        return;
    }
    const arr = await redis.get(apikey);
    if (arr === null) {
        res.status(403).send("API key is not valid");
        return;
    }
    const credentials = JSON.parse(arr); // apikey_to_claims.get(apikey)
    console.log("Credentials sent")
    console.log(credentials)
    if (credentials && credentials.length > 0) {
        res.status(200).send(credentials)
    } else {
        res.status(403).send("API key is not valid")
    }    
})

app.get("/qr", async (req, res) => {
    const reqID = req.headers["requestId"]
    // Identify by the requestId
    if (typeof reqID === "string") {
        const qr = await redis.get(ID_PREFIX + reqID); // id_to_qr.get(reqID)
        if (qr !== null) {
            // QR has already been scanned
            res.sendStatus(204)
        } else {
            // QR has not been scanned yet
            res.status(404).send("QR not found")
        }
    } else {
        res.status(401).send("Require header requestId of type string")
    }
})

async function main() {
    // Connect to the Redis server
    redis.on('error', err => { console.error("Redis error: ", err); });
    await redis.connect().catch(err => { console.log("Error on connecting to redis server: ", err); });
    // Start the Express server
    http_server.listen(PORT, () => {
        console.log('Listening on ' + PORT.toString() + ' port')
    })    
}

main().then(() => { console.log("Launched"); })
