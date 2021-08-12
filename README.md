# Gazelle-Subsonic -- Stream music straight from Gazelle based trackers!

`gazelle-subsonic` transforms the Gazelle API into the Subsonic API.

## Installation

### From """binaries"""

From the releases page, you can dowlnoad binaries for major platforms. Simply execute these on the
command line to run them.

### From source

1. Install Git, Node.JS, and NPM.
2. Clone this git repository.
3. Navigate to the cloned directory in a terminal.
4. Run `npm install` to install javascript dependencies to the current directory.
5. Run `npm run build` to compile the typescript to javascript.
6. Run `npm start` and gazelle-subsonic will be online!

To generate the portable binaries yourself, execute `npm run package`

## Configuration

Copy `config.example.js` to `config.js` and have it in the working directory where you run gazelle-subsonic.

## Compatible clients

Legend:

| Symbol  | Meaning                          |
|---------|----------------------------------|
| ✔       | Works, perhaps with minor issues |
| 🟡      | Major issues, not recommended    |
| ❌      | Doesn't work at all              |
| (empty) | Not tested                       |

Clients:

| Client        | Status | Platform | Notes                                           |
|---------------|--------|----------|-------------------------------------------------|
| DSub          | ✔      | Android  |                                                 |
| Ultrasonic    | ✔      | Android  |                                                 |
| Sublime Music | 🟡     | Desktop  | Plays fast and loose with the Subsonic API spec |
| Clementine    | ❌     | Desktop  | Tries to load the whole catalog at once         |
| Jamstash      | ✔      | Web      |                                                 |

## Subsonic API progress

Legend:

| Symbol  | Meaning                        |
|---------|--------------------------------|
| ✔       | Reasonably implemented         |
| 🟡        | Partially implemented          |
| ❌      | Will not implement, mocked out |
| (empty) | Unimplemented                  |

Endpoints:

| Endpoint            | Status | Notes                                                                             |
|---------------------|--------|-----------------------------------------------------------------------------------|
| `ping`              | ✔      |                                                                                   |
| `getLicense`        | ✔      |                                                                                   |
| `getMusicFolders`   | ✔      | Trivial                                                                           |
| `getIndexes`        |        | Somehow list popular albums from orpheus?                                         |
| `getMusicDirectory` | ✔      | Main way to access music                                                          |
| `getGenres`         |        | List a selection of the most popular tags?                                        |
| `getArtists`        | ❌     | No paging support, too many artists to list all at once. Maybe random or popular? |
| `getArtist`         | ✔      | Same as getMusicDirectory, no id3 tags                                            |
| `getAlbum`          | ✔      | Same as getMusicDirectory, no id3 tags                                            |
| `getSong`           | ✔      |                                                                                   |
| `getArtistInfo`     |        |                                                                                   |
| `getArtistInfo2`    |        |                                                                                   |
| `getAlbumInfo`      |        |                                                                                   |
| `getAlbumInfo2`     |        |                                                                                   |
| `getSimilarSongs`   |        |                                                                                   |
| `getSimilarSongs2`  |        |                                                                                   |
| `getTopSongs`       |        |                                                                                   |
| `getAlbumList`      | ✔      |                                                                                   |
| `getAlbumList2`     | ✔      | Same as albumList, no id3 tags                                                    |
| `getRandomSongs`    |        |                                                                                   |
| `getSongsByGenre`   |        |                                                                                   |
| `getNowPlaying`     |        |                                                                                   |
| `getStarred`        |        | Use bookmarks?                                                                    |
| `getStarred2`       |        |                                                                                   |
| `search`            | ❌     | Deprecated for a long time.                                                       |
| `search2`           | 🟡     | Gazelle does not support artist search. Song search needs gazelle api change      |
| `search3`           | 🟡     | Same as search2, no id3 tags.                                                     |
| `getPlaylists`      |        |                                                                                   |
| `getPlaylist`       |        |                                                                                   |
| `createPlaylist`    |        |                                                                                   |
| `updatePlaylist`    |        |                                                                                   |
| `deletePlaylist`    |        |                                                                                   |
| `stream`            | ✔      |                                                                                   |
| `download`          | 🟡     | Not implemented group download yet                                            |
| `hls`               |        |                                                                                   |
| `getCoverArt`       | ❌     | Needs gazelle api change to avoid querying each torrentgroup individually         |
| `getLyrics`         |        |                                                                                   |
| `getAvatar`         |        |                                                                                   |
| `star`              |        | Can't modify bookmarks through gazelle api                                        |
| `unstar`            |        |                                                                                   |
| `setRating`         |        |                                                                                   |
| `scrobble`          |        |                                                                                   |
| `getShares`         |        |                                                                                   |
| `createShare`       |        |                                                                                   |
| `updateShare`       |        |                                                                                   |
| `deleteShare`       |        |                                                                                   |
| `getBookmarks`      |        |                                                                                   |
| `createBookmark`    |        |                                                                                   |
| `deleteBookmark`    |        |                                                                                   |
| `getPlayQueue`      |        |                                                                                   |
| `savePlayQueue`     |        |                                                                                   |

Omitted from this list are all endpoints related to video, internet radio, user management, media
library scanning, podcast, jukebox, and shoring control.
