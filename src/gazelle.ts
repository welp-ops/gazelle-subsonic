import { GazelleConfig, GazelleFormat, GazelleTorrent, GazelleTorrentGroup, GazelleSearchOrderBy, GazelleSearchResult } from './types'
import _ from 'lodash';
import needle from 'needle';

async function gazelleApiQuery(gazelleConfig: GazelleConfig, action: string, otherProps: object): Promise<object> {
    const props: string = Object.keys(otherProps)
	.map(key => `&${encodeURIComponent(key)}=${encodeURIComponent(otherProps[key])}`)
	.join('');
    const response: needle.NeedleResponse
	= await needle('get', `${gazelleConfig.baseUrl}/ajax.php?action=${action}${props}`, null, { json: true });
    if (response.body.status !== 'success') {
	throw new Error('Gazelle API returned "status: failure"');
    }

    return response.body.response;
}

function getFormat(gazelleFormat: string, gazelleEncoding: string): GazelleFormat {
    if (gazelleFormat === 'FLAC') {
	return 'FLAC';
    }
    if (gazelleFormat === 'MP3') {
	switch (gazelleEncoding) {
	    case '320': return 'MP3 320';
	    case 'V0': return 'MP3 V0';
	    case 'V2': return 'MP3 V2';
	    default: return 'MP3 Other';
	}
    }
    return 'Other';
}

function parseTorrent(responseTorrent: any): GazelleTorrent {
    return {
	id: responseTorrent.id || responseTorrent.torrentId,
	size: responseTorrent.size,
	format: getFormat(responseTorrent.format, responseTorrent.encoding),
	year: responseTorrent.remasterYear,
	media: responseTorrent.media,
	snatches: responseTorrent.snatches,
	seeders: responseTorrent.seeders,
	leechers: responseTorrent.leechers,
	files: responseTorrent.fileList
	    ? responseTorrent.fileList.split('|||').map(file => {
		const [, fileName, fileSize] = file.match(/(.+){{{(\d+)}}}/);
		return {
		    name: fileName,
		    size: parseInt(fileSize),
		}
	    })
	    : null,
    }
}

function parseGroup(responseGroup: any, responseTorrents: Array<object>): GazelleTorrentGroup {
    return {
	id: responseGroup.id || responseGroup.groupId,
	name: responseGroup.name || responseGroup.groupName,
	artist: responseGroup.artist, // TODO: is this what we want? Does it matter? If you
	// look in torrents[0] you can get an actual list of
	// artists instead of "various artists"
	year: responseGroup.year || responseGroup.groupYear,
	releaseType: responseGroup.releaseTypeName || responseGroup.releaseType,
	snatches: responseGroup.totalSnatched,
	seeders: responseGroup.totalSeeders,
	leechers: responseGroup.totalLeechers,
	imageUrl: responseGroup.wikiImage,
	torrents: responseTorrents.map(parseTorrent),
    }
}

export async function torrentGroupSearch(gazelleConfig: GazelleConfig,
					 term: string,
					 orderBy: GazelleSearchOrderBy,
					 orderAscending: boolean = false,
					 page: number = 1)
: Promise<GazelleSearchResult> {

    const response: any = await gazelleApiQuery(gazelleConfig, 'browse',
					   { searchstr: term,
					     page,
					     order_by: orderBy,
					     order_way: orderAscending ? 'asc' : 'desc' });
    return {
	numPages: response.pages,
	groups: response.results.map(g => parseGroup(g, g.torrents)),
    }
}

export async function groupGet(gazelleConfig: GazelleConfig,
			       groupId: number)
: Promise<GazelleTorrentGroup> {

    const response: any = await gazelleApiQuery(gazelleConfig, 'torrent', { id: groupId });
    return parseGroup(response.group, response.torrents);
}
