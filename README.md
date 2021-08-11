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

| Endpoint            | Status | Notes                                                                             |
|---------------------+--------+-----------------------------------------------------------------------------------|
| `ping`              | ✓      |                                                                                   |
| `getLicense`        | ✓      |                                                                                   |
| `getMusicFolders`   | ✓      | Trivial                                                                           |
| `getIndexes`        |        | Somehow list popular albums from orpheus?                                         |
| `getMusicDirectory` | ✓      | Main way to access music                                                          |
| `getGenres`         |        | List a selection of the most popular tags?                                        |
| `getArtists`        | ❌     | No paging support, too many artists to list all at once. Maybe random or popular? |
| `getArtist`         | ✓      | Same as getMusicDirectory, no id3 tags                                            |
| `getAlbum`          | ✓      | Same as getMusicDirectory, no id3 tags                                            |
| `getSong`           | ✓      |                                                                                   |
| `getArtistInfo`     |        |                                                                                   |
| `getArtistInfo2`    |        |                                                                                   |
| `getAlbumInfo`      |        |                                                                                   |
| `getAlbumInfo2`     |        |                                                                                   |
| `getSimilarSongs`   |        |                                                                                   |
| `getSimilarSongs2`  |        |                                                                                   |
| `getTopSongs`       |        |                                                                                   |
| `getAlbumList`      | ✓      |                                                                                   |
| `getAlbumList2`     | ✓      | Same as albumList, no id3 tags                                                    |
| `getRandomSongs`    |        |                                                                                   |
| `getSongsByGenre`   |        |                                                                                   |
| `getNowPlaying`     |        |                                                                                   |
| `getStarred`        |        | Use bookmarks?                                                                    |
| `getStarred2`       |        |                                                                                   |
| `search`            | ❌     | Deprecated for a long time.                                                       |
| `search2`           | ⃝       | Gazelle does not support artist search. Song search needs gazelle api change      |
| `search3`           | ⃝       | Same as search2, no id3 tags.                                                     |
| `getPlaylists`      |        |                                                                                   |
| `getPlaylist`       |        |                                                                                   |
| `createPlaylist`    |        |                                                                                   |
| `updatePlaylist`    |        |                                                                                   |
| `deletePlaylist`    |        |                                                                                   |
| `stream`            | ✓      |                                                                                   |
| `download`          | ✓      | Same as stream for our purposes                                                   |
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
