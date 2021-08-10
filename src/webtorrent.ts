import WebTorrent from 'webtorrent'
import getConfig from './config.js'

const webTorrentOptions: any = {
    dht: false,
    lsd: false,
    webSeeds: false,
}

if (process.env.GZS_PEERID) {
    webTorrentOptions.peerId = Buffer.from(process.env.GZS_PEERID)
}

const wtClient = new WebTorrent(webTorrentOptions);

const torrents: { [key: number]: WebTorrent.Torrent } = {};

export class TorrentFileNotFoundError extends Error { };

// ensure the given torrent is added and metadata has been retrieved
function ensureTorrent(torrentId: number): Promise<WebTorrent.Torrent> {
    return new Promise((resolve, reject) => {
	if (torrents[torrentId]) {
	    const torrent = torrents[torrentId];
	    if (torrent.ready) {
		return resolve(torrent)
	    } else {
		// this listener is guaranteed to be fired after the one that does the deselection
		torrent.on('ready', () => {
		    return resolve(torrent)
		})
	    }
	}
	const torrentFileUrl = `${getConfig().gazelle.baseUrl}/torrents.php?action=download&id=${torrentId}&torrent_pass=${getConfig().gazelle.passkey}`;
	// TODO: store opts
	const torrent = wtClient.add(torrentFileUrl)
	torrents[torrentId] = torrent;
	// TODO: there's a slight possibility of a race condition here, if the torrent is added to torrents but the metadata event has not fired yet, then the second client will start streaming the file and then the deselect call will occur, which will deselct the file? (unless the selection due to create)
	torrent.once('ready', () => {
	    // https://github.com/webtorrent/webtorrent/issues/164#issuecomment-248395202
	    torrent.deselect(0, torrent.pieces.length - 1, 0)
	    resolve(torrent)
	})
	torrent.on('error', e => reject(e))
    });
}

// const collator = new Intl.Collator("en", { localeMatcher: 'lookup', usage: 'sort', sensitivity: 'variant' });
// function fileComparator(a, b): number {
//     return collator.compare(a.path, b.path);
// }

export async function getTorrentFile(torrentId: number, fileId: number): Promise<WebTorrent.TorrentFile> {
    const torrent = await ensureTorrent(torrentId);
    // TODO: helper function for this filtering.
    const relevantFiles = torrent.files.filter(file => /\.(mp3|flac|aac)$/i.test(file.name));
    if (fileId >= relevantFiles.length) {
	throw new TorrentFileNotFoundError();
    }
    //const sortedFiles = [...torrents[torrentId].files].sort(fileComparator);
    const file = relevantFiles[fileId];
    return file
}
