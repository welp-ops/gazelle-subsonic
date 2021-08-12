import { Gazelle } from './gazelle.js'
import { readFileSync } from 'fs'

//** TYPES

namespace Config {

	interface Gazelle {
		baseUrl: string, // NO trailing slash
		authToken: string,
		passkey: string,
		// TODO: add a cache exprie, and add wikiImage to browse and artist results
		searchPageSize: number,
	}

	type TorrentSelectionOrderBy = 'seeders' | 'format' | 'year' | 'numTracks';

	interface TorrentSelection {
		sortOrder: Array<TorrentSelectionOrderBy>;
		formats: Array<Gazelle.Format>,
		seeders: number | true, // if number, any torrent with at least that many seeders is considered equivalently good. If true, always maximize seeders.
		preferNewEditions: boolean, // If true, prefer newer torrents, else, prefer older ones.
	}

	interface Subsonic {
		defaultCoverArt: string,
		defaultCoverArtType: string,
	}

	interface Server {
		bindIp: string,
		port: number,
		corsOrigins: string | string[] | false,
	}

	export type All = {
		gazelle: Gazelle,
		torrentSelection: TorrentSelection,
		subsonic: Subsonic,
		server: Server,
		users: Array<{ [key: string]: string }>,
	}

}

//** FUNCTIONS

let config: Config.All;

// synchronously read config from disk, or return it if already read.
export default function getConfig(): Config.All {
	try {
		config = config || eval(readFileSync('./config.js', { encoding: 'utf-8' })) as Config.All;
	} catch (e) {
		console.error('Error reading or parsing configuration.')
		throw e;
	}
	return config;
}
