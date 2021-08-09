# Gazelle-Subsonic -- Stream music straight from Gazelle based trackers!

`gazelle-subsonic` transforms the Gazelle API into the Subsonic API.

## Subsonic API progress

Legend:

| Symbol  | Meaning                        |
|---------+--------------------------------|
| ✓       | Reasonably implemented         |
| ⃝        | Partially implemented          |
| ❌      | Will not implement, mocked out |
| (empty) | Unimplemented                  |

Endpoints:

| Endpoint            | Status  | Notes                                                   |
|---------------------+---------+---------------------------------------------------------|
| `ping`              | ✓       |                                                         |
| `getLicense`        | ✓       |                                                         |
| `getMusicFolders`   |         |                                                         |
| `getIndexes`        |         | Somehow list popular albums from orpheus?               |
| `getMusicDirectory` |         | Main way to access music                                |
| `getGenres`         |         | List a selection of the most popular tags?              |
| `getArtists`        | ❌ TODO | No paging support, too many artists to list all at once |
| `getArtist`         |         | Same as getMusicDirectory, no id3 tags                  |
| `getAlbum`          |         | Same as getMusicDirectory, no id3 tags                  |
| `getSong`           |         |                                                         |
| `getArtistInfo`     |         |                                                         |
| `getArtistInfo2`    |         |                                                         |
| `getAlbumInfo`      |         |                                                         |
| `getAlbumInfo2`     |         |                                                         |
| `getSimilarSongs`   |         |                                                         |
| `getSimilarSongs2`  |         |                                                         |
| `getTopSongs`       |         |                                                         |
| `getAlbumList`      |         |                                                         |
| `getAlbumList2`     |         |                                                         |
| `getRandomSongs`    |         |                                                         |
| `getSongsByGenre`   |         |                                                         |
| `getNowPlaying`     |         |                                                         |
| `getStarred`        |         |                                                         |
| `getStarred2`       |         |                                                         |
| `search`            | ❌      | Deprecated for a long time.                             |
| `search2`           |         |                                                         |
| `search3`           |         | Same as search2, no id3 tags.                           |
| `getPlaylists`      |         |                                                         |
| `getPlaylist`       |         |                                                         |
| `createPlaylist`    |         |                                                         |
| `updatePlaylist`    |         |                                                         |
| `deletePlaylist`    |         |                                                         |
| `stream`            | ✓       |                                                         |
| `download`          |         | Same as stream for our purposes                         |
| `hls`               |         |                                                         |
| `getCoverArt`       |         |                                                         |
| `getLyrics`         |         |                                                         |
| `getAvatar`         |         |                                                         |
| `star`              |         |                                                         |
| `unstar`            |         |                                                         |
| `setRating`         |         |                                                         |
| `scrobble`          |         |                                                         |
| `getShares`         |         |                                                         |
| `createShare`       |         |                                                         |
| `updateShare`       |         |                                                         |
| `deleteShare`       |         |                                                         |
| `getBookmarks`      |         |                                                         |
| `createBookmark`    |         |                                                         |
| `deleteBookmark`    |         |                                                         |
| `getPlayQueue`      |         |                                                         |
| `savePlayQueue`     |         |                                                         |

Omitted from this list are all endpoints related to video, internet radio, user management, media
library scanning, podcast, jukebox, and shoring control.
