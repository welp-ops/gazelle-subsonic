import { GazelleTorrent, TorrentSelectionConfig, TorrentSelectionOrderBy } from './types'
import _ from 'lodash'

function torrentCompare(config: TorrentSelectionConfig,
			compareBy: TorrentSelectionOrderBy,
			t1: GazelleTorrent,
			t2: GazelleTorrent)
: boolean | void {

    switch (compareBy) {
	case 'seeders':
	    if (t1.seeders >= config.seeders) {
		return false;
	    }
	    return t1.seeders < t2.seeders;
	case 'format':
	    return config.formats.indexOf(t1.format) < config.formats.indexOf(t2.format);
	case 'year':
	    return config.preferNewEditions
		? (t1.year < t2.year)
		: (t1.year > t2.year);
	case 'numTracks':
	    return t1.files.length > t2.files.length;
    }
}

export function torrentSelect(config: TorrentSelectionConfig, torrents: Array<GazelleTorrent>): GazelleTorrent | void {
    // first, filter by allowed formats. This supersedes the sort order.
    const candidates =
	torrents.filter(t => config.formats.some(f => t.format === f))
	.sort((t1, t2) => {
	    // try each comparison strategy in the order the user wants
	    for (let i = 0; i < config.sortOrder.length; i++) {
		const compareResult: boolean | void = torrentCompare(config, config.sortOrder[i], t1, t2);
		if (typeof compareResult === 'boolean') {
		    return compareResult ? 1 : 0;
		}
	    }
	    // none of the comparisons gave a crap, so they're equal
	    return 0;
	});
    if (candidates.length > 0) {
	return candidates[0];
    }
}
