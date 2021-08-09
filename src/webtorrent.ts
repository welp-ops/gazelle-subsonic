import WebTorrent from 'webtorrent'
import getConfig from './config.js'

const wtClient = new WebTorrent({
    dht: false,
    webSeeds: false,
    // TODO: peerid
});

const torrents: { [key: number]: WebTorrent.Torrent } = {};

export class TorrentFileNotFoundError extends Error { };

function addNewTorrent(torrentId: number): Promise<void> {
    return new Promise((resolve, reject) => {
	const torrentFileUrl = `${getConfig().gazelle.baseUrl}/torrents.php?action=download&id=${torrentId}&torrent_pass=${getConfig().gazelle.authToken}`;
	// TODO: store opts
	const torrent = wtClient.add(torrentFileUrl, { private: true })
	torrent.on('metadata', () => {
	    // https://github.com/webtorrent/webtorrent/issues/164#issuecomment-248395202
	    torrent.deselect(0, torrent.pieces.length - 1, 0)
	    resolve()
	})
	torrent.on('error', e => reject(e))
    });
}

// const collator = new Intl.Collator("en", { localeMatcher: 'lookup', usage: 'sort', sensitivity: 'variant' });
// function fileComparator(a, b): number {
//     return collator.compare(a.path, b.path);
// }

export async function getTorrentFile(torrentId: number, fileId: number): Promise<WebTorrent.TorrentFile> {
    if (!torrents[torrentId]) {
	await addNewTorrent(torrentId);
    }
    if (fileId >= torrents[torrentId].files.length) {
	throw new TorrentFileNotFoundError();
    }
    //const sortedFiles = [...torrents[torrentId].files].sort(fileComparator);
    const file = torrents[torrentId].files[fileId];
    return file
}
