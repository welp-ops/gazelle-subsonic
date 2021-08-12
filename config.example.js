({
    // gazelle API settings:
    "gazelle": {
	"baseUrl": "https://orpheus.network", // no trailing slash
	"authToken": "abcdefghijklmnovqrstuvwxyz1234567890", // generate an API token from user settings
	"passkey": "abcdefghijklmnovqrstuvwxyz1234567890", // look in your download link URLs for this
	"searchPageSize": 50,
    },
    // how to choose which torrent to leech from a group
    "torrentSelection": {
	"sortOrder": ["seeders", "format", "year", "numTracks"],
	// what order to consider these characteristics, according to the following options.
	// numTracks maximizes the number of tracks in the torrent, for example, to prefer torrents
	// with bonus tracks.

	"seeders": 6, // If set to a number, all torrents with at least this many seeders are
			 // given high priority and considered equivalent, and the remaining torrents are sorted. Alternatively, set to
			 // `true` to sort strictly by seeders.
	"formats": ["MP3 V2", "MP3 V0", "MP3 Other", "MP3 320", "FLAC" ], // in order of preference. If some are unacceptable, remove them from the list.
	"preferNewEditions": true, // whether to prefer new (eg remasters) or old.
    },
    "subsonic": {
	"defaultCoverArt": "gazelle.png",
	"defaultCoverArtType": "image/png",
    },
    "server": {
	"bindIp": "127.0.0.1", // change to 0.0.0.0 if accessing over the network
	"port": 2773,
	"corsOrigins": false, // either "*", an array of strings of acceptable origins (eg
	                      // ["http://jamstash.com"]), or false to disable CORS
    },
    "users": {
	"welp": "password"
    }
})
