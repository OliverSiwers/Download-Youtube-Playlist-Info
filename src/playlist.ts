import https from "https";
import { IncomingMessage } from "http";

const HOST = "youtube.googleapis.com";
const MAX_RESULTS = 50;
const PART_SNIPPET = "snippet";
const PART_STATUS = "status";

const GET = "GET";

type PlaylistSnippet = {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: {
        default: {
            url: string,
            width: number,
            height: number,
        },
        medium: {
            url: string,
            width: number,
            height: number,
        },
        high: {
            url: string,
            width: number,
            height: number,
        },
        standard: {
            url: string,
            width: number,
            height: number,
        }
    },
    channelTitle: string,
    localized: {
        title: string,
        description: string,
    }
}

type PlaylistResponse = {
    kind: string,
    etag: string,
    pageInfo: {
        totalResults: number,
        resultsPerPage: number
    },
    items: [{
        kind: string,
        etag: string,
        id: string,
        snippet: PlaylistSnippet,
        status: {
            privacyStatus: string
        }
    }],
}

type PlaylistItemsSnippet = {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: {
        default: {
            url: string,
            width: number,
            height: number
        },
        medium: {
            url: string,
            width: number,
            height: number
        },
        high: {
            url: string,
            width: number,
            height: number
        },
        standard: {
            url: string,
            width: number,
            height: number
        }
    },
    channelTitle: string,
    playlistId: string,
    position: number,
    resourceId: {
        kind: string,
        videoId: string
    },
    videoOwnerChannelTitle: string,
    videoOwnerChannelId: string
}

type PlaylistItemsResponse = {
    kind: string,
    etag: string,
    nextPageToken?: string,
    prevPageToken?: string,
    pageInfo: {
        totalResults: number,
        resultPerPage: number,
    },
    items: [{
        kind: string,
        etag: string,
        id: string,
        snippet?: PlaylistItemsSnippet,
    }],
    discriminator: "PlaylistItemsResponse";
}

export type ErrorResponse = {
    code: number,
    message: string,
    errors: any[],
    discriminator: "ErrorResponse";
}

export type VideoEntry = {
    playlistPosition: number,
    dateAdded: string,
    videoTitle: string,
    videoId: string,
    channelId: string,
    channelTitle: string,
    description: string,
}

export type Playlist = {
    playlistId: string,
    playlistTitle: string,
    channelId: string,
    channelTitle: string,
    dateCreated: string,
    description: string,
    privacyStatus: string,
    videos: VideoEntry[],
}

//Type checking

function isErrorResponse(object: any): object is ErrorResponse {
    return object.discriminator == "ErrorResponse";
}

function isPlaylistItemsResponse(object: any): object is PlaylistItemsResponse {
    return object.discriminator == "PlaylistItemsResponse";
}

function getPlaylistInfo(playlistId: string, authToken: string) {
    return new Promise<PlaylistResponse | ErrorResponse>((resolve, reject) => {
        let path = `/youtube/v3/playlists?part=${PART_SNIPPET}&part=${PART_STATUS}&id=${playlistId}&maxResults=1`;
        let options: https.RequestOptions = {
            "method": GET,
            "host": HOST,
            "path": path,
            "headers": {
                "Authorization": `Bearer ${authToken}`,
                "Accept": "appliction/json",
            },
        }

        let callback = function (response: IncomingMessage) {
            var str = '';

            //another chunk of data has been received, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been received, so we just print it out here
            response.on('end', function () {
                let response = JSON.parse(str);

                if (response.error) {
                    reject(response as ErrorResponse);
                    return;
                }

                // console.log(str);

                resolve(response as PlaylistResponse);
            });
        }

        https.request(options, callback).end()
    });
}

//API request

async function playlistPage(playlistId: string, authToken: string, pageToken?: string) {
    return new Promise<ErrorResponse | PlaylistItemsResponse>((resolve, reject) => {
        let path;
        if (pageToken) {
            path = `/youtube/v3/playlistItems?part=${PART_SNIPPET}&pageToken=${pageToken}&maxResults=${MAX_RESULTS}&playlistId=${playlistId}`;
        } else {
            path = `/youtube/v3/playlistItems?part=${PART_SNIPPET}&maxResults=${MAX_RESULTS}&playlistId=${playlistId}`;
        }

        let options: https.RequestOptions = {
            "method": GET,
            "host": HOST,
            "path": path,
            "headers": {
                "Authorization": `Bearer ${authToken}`,
                "Accept": "appliction/json",
            },
        }

        let callback = function (response: IncomingMessage) {
            var str = '';

            //another chunk of data has been received, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been received, so we just print it out here
            response.on('end', function () {
                let response = JSON.parse(str);

                if (response.error) {
                    reject(response as ErrorResponse);
                    return;
                }

                // console.log(str);

                resolve(response as PlaylistItemsResponse);
            });
        }

        https.request(options, callback).end()
    });
}

//Main function

export default async function indexPrivatePlaylist(playlistId: string, authToken: string): Promise<Playlist> {

    let playlist: Playlist = {
        playlistId: playlistId,
        playlistTitle: "Unkown",
        channelId: "Unkown",
        channelTitle: "Unkown",
        dateCreated: "Unkown",
        description: "Unkown",
        privacyStatus: "Unkown",
        videos: [],
    }

    let pageToken: string | undefined = "";

    console.log("Indexing started...");
    while (true) {
        let page: ErrorResponse | PlaylistItemsResponse = await playlistPage(playlistId, authToken, pageToken)

        if (isErrorResponse(page)) {
            throw page;
        } else {
            console.log(`Progress: ${(page.items[0].snippet?.position || 0) + 1} - ${(page.items[page.items.length - 1].snippet?.position || 0) + 1} / ${page.pageInfo.totalResults}`);

            for (let i = 0; i < page.items.length; i++) {
                let snippet = page.items[i].snippet;

                if (!snippet)
                    break;

                let videoEntry: VideoEntry = {
                    playlistPosition: snippet.position,
                    dateAdded: snippet.publishedAt,
                    videoTitle: snippet.title,
                    videoId: snippet.resourceId.videoId,
                    channelId: snippet.videoOwnerChannelId,
                    channelTitle: snippet.videoOwnerChannelTitle,
                    description: snippet.description,
                }

                playlist.videos.push(videoEntry);
            }

            pageToken = page.nextPageToken;

            if (!pageToken) {
                break;
            }
        }
    }

    let playlistInfo = await getPlaylistInfo(playlistId, authToken);

    if (!isErrorResponse(playlistInfo)) {
        let snippet: PlaylistSnippet = playlistInfo.items[0].snippet;

        playlist.playlistTitle = snippet.title;
        playlist.channelId = snippet.channelId;
        playlist.channelTitle = snippet.channelTitle;
        playlist.dateCreated = snippet.publishedAt;
        playlist.description = snippet.description;

        playlist.privacyStatus = playlistInfo.items[0].status.privacyStatus;
    }

    console.log("Indexing done!");

    return playlist;
}