import http from "http";
import { AddressInfo } from "net";
import { google } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import fs from "fs";
import open from "open";

// ---Interfaces---
interface ClientInfo {
    installed: {
        client_id: string,
        client_secret: string,
        project_id?: string,
        auth_uri?: string,
        token_uri?: string,
        auth_provider_x509_cert_url?: string,
        redirect_uris?: string,
    }
}

// ---Variables & Constants---

const READ_ONLY_SCOPE: string = "https://www.googleapis.com/auth/youtube.readonly";
const TOKEN_FILE = "tokens.json";
const CLIENT_FILE = "client.json";

let clientInfo: ClientInfo | undefined;
let serverAddress: string | undefined;

// ---Functions---

function createServer() {
    return new Promise<http.Server>((res, rej) => {

        const server = http.createServer(/*responseHandler*/);

        server.listen(0, "127.0.0.1", () => {
            serverAddress = getServerAddress(server);

            console.log(`Listening on http://${serverAddress}`);

            res(server);
        });

        server.on("error", (e) => {
            rej(e);
        });

        server.on("close", () => {
            console.log(`Closed http://${serverAddress}`);
        });
    })
}

function getServerAddress(server: http.Server) {
    const address = server.address();
    if (isAddressInfo(address))
        return `http://${address.address}:${address.port}`;

    return undefined;
}

function createOAuth2Client(redirectUrl?: string) {
    if (!clientInfo) {
        clientInfo = getClientInfo();

        if (!clientInfo)
            throw "Invalid client.json file";

    }

    const oauth2Client = new google.auth.OAuth2(
        clientInfo.installed.client_id,
        clientInfo.installed.client_secret,
        redirectUrl
    );

    return oauth2Client;
}

function generateAuthUrl(oauth2Client: OAuth2Client) {
    const url = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (gets refresh_token)
        access_type: 'offline',

        // If you only need one scope you can pass it as a string
        scope: READ_ONLY_SCOPE
    });

    return url;
}

function writeTokenToFile(msg: string) {
    fs.writeFileSync(TOKEN_FILE, msg);
}

function getTokensFromFile() {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    return (isCredentials(tokens)) ? tokens : undefined;
}

function getClientInfo() {
    let clientInfo = JSON.parse(fs.readFileSync(CLIENT_FILE, "utf-8"));
    return (isClientInfo(clientInfo)) ? clientInfo : undefined;
}

export default function auth() {
    return new Promise<string|undefined|null>(async (resolve, reject) => {
        //Check if token.json exists
        if (fs.existsSync(TOKEN_FILE)) {
            const oauth2Client = createOAuth2Client();
            const tokens = getTokensFromFile();
            if (tokens) {
                try {
                    oauth2Client.setCredentials(tokens);
                    resolve((await oauth2Client.getAccessToken()).token);
                    console.log("Vaild tokens.json file found.")
                    return;
                } catch (e) {
                    console.log("Invalid access/refresh token (or invalid OAuth2Client).\n")
                    // console.error(e);
                }
            } else {
                console.log(`Invalid ${TOKEN_FILE} file.`);
            }
        }

        let server: http.Server;
        try {
            server = await createServer();
        } catch (error: any) {
            console.error(error);
            reject({ "msg": `Failed to create local server`, "error": error });
            return;
        }

        server.on("request", async (req, res) => {
            let code = new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("code");
            let scope = new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("scope");
            if (code && scope == READ_ONLY_SCOPE) {
                res.writeHead(200);
                // res.end("Success! You may now close this window.");
                res.end("Success! You may now close this window.");

                server.close();

                const { tokens } = await oauth2Client.getToken(code);

                writeTokenToFile(JSON.stringify(tokens));
                resolve(tokens.access_token);
                return;
            } else {
                res.writeHead(200);
                res.end("Nothing to see here...");
            }
        });

        let oauth2Client = createOAuth2Client(getServerAddress(server));
        let authUrl = generateAuthUrl(oauth2Client);

        open(authUrl);
        console.log("A page should have opened in your broser. If this didn't happen, something unkown went wrong.")
        // console.log(authUrl);
    });
}

function isAddressInfo(object: any): object is AddressInfo {
    return object &&
        'port' in object &&
        'address' in object &&
        'family' in object;
}

function isCredentials(object: any): object is Credentials {
    return object &&
        "expiry_date" in object &&
        "access_token" in object &&
        "token_type" in object &&
        "scope" in object && object.scope == READ_ONLY_SCOPE;
}

function isClientInfo(object: any): object is ClientInfo {
    return object &&
        "installed" in object &&
        "client_id" in object.installed &&
        "client_secret" in object.installed;
}