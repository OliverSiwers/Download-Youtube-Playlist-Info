import fs from "fs";
import auth from "./auth.js";
import indexPrivatePlaylist from "./playlist.js";
import readline from "readline";

const RESULT_FOLDER = "result";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function question(msg: string) {
    return new Promise<string>(resolve => {
        rl.question(msg, resolve);
    });
}


console.log("Starting authorization...");
let authToken = await auth();
console.log("Authorization done!\n");

if (authToken) {

    let playlistId = await question("Playlist id: ");
    let playlist = await indexPrivatePlaylist(playlistId, authToken);

    try {
        if (!fs.existsSync(RESULT_FOLDER)) {
            fs.mkdirSync(RESULT_FOLDER);
        }
    } catch (e) {
        console.log("Something went wrong when checking or creating the result folder");
        console.log(e);
    }

    let timeAndDate = new Date().toISOString().replace(/\.\d{3}(?=Z$)/, "").replace(/:/g, "_"); //Gets date as iso date, removes the ms, and converts ':' to '_' to make it a valid file path 
    fs.writeFileSync(`${RESULT_FOLDER}/${playlist.playlistTitle} - ${timeAndDate}.json`, JSON.stringify(playlist));
} else {
    console.log("Failed to get authentication token");
}

rl.close();