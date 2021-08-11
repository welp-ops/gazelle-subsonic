import needle from 'needle';
import makeDebug from 'debug'
const debug = makeDebug('gazelle-subsonic:gazelle-api')

import getConfig from './config.js';

//** TYPES

type SearchOrderBy = 'time' | 'year' | 'size' | 'random' | 'snatched' | 'seeders' | 'leechers';

type TorrentSelectionOrderBy = 'seeders' | 'format' | 'year' | 'numTracks';

namespace Wire {

    export type ArtistLite = {
	id: number,
	name: string,
    }

    // "wire" types are what we get "over the wire", i.e., directly returned by gazelle API

    // returned by torrentgroup
    export type Group = {
	wikiImage: string,
	id: number,
	name: string,
	year: number,
	musicInfo: {
	    composers: ArtistLite[],
	    artists: ArtistLite[],
	    with: ArtistLite[],
	}
    }

    // returned by browse
    type TorrentLite = {
    // 	torrentId: number,
	artists: ArtistLite[],
    // 	remaster: boolean,
    // 	remasterYear: number,
    // 	media: Media,
    // 	encoding: string,
    // 	format: string,
    // 	snatches: number,
    // 	seeders: number,
    // 	leechers: number,
    // 	isFreelech: boolean,
    // 	isNeutralLeech: boolean,
    // 	isPersonalFreeleech: boolean,
    }

    // returned by torrentgroup
    export type Torrent = {
	id: number,
	media: Gazelle.Media,
	format: string,
	encoding: string,
	remastered: boolean,
	remasterYear: number,
	size: number,
	seeders: number,
	leechers: number,
	snatched: number,
	freeTorrent: boolean,
	fileList: string,
    }

    export type TorrentGroupResult = {
	group: Group,
	torrents: Torrent[],
    }

    export type BrowseResult = {
	pages: number,
	results: [
	    {
		groupId: number,
		groupName: string,
		artist: string,
		tags: string[],
		bookmarked: boolean,
		groupYear: number,
		torrents: TorrentLite[],
	    }
	]
    }

    export type ArtistResult = {
	id: number,
	name: string,
	image: string,
	torrentgroup: [
	    {
		groupId: number,
		groupName: string,
		groupYear: number,
		torrent: [
		    {
			// to estimate number of songs. I'd like to add file list here too
			fileCount: number,
		    }
		]
	    }
	]
    }
}

// TODO: optimize fetching artist by performing a search for the artists name to get all the
// cover images at once?

// types in this namespace are returned by the higher level functions later in this file
export namespace Gazelle {
    export type Format = 'FLAC' | 'MP3' | 'Ogg Vorbis' | 'AAC' | 'AC3' | 'DTS';
    export type Encoding = 'Lossless' | '24bit Lossless' | 'V0 (VBR)' | 'V1 (VBR)' | 'V2 (VBR)' | '320' | '256' | '192' | '160' | '128' | '96' | '64' | 'APS (VBR)' | 'APX (VBR)' | 'q8.x (VBR)' | 'Other'

    export type Codec = {
	format: Format,
	encoding: Encoding,
    }

    export type Media = 'Vinyl' | 'CD' | 'WEB' | 'DVD' | 'BD' | 'Soundboard' | 'SACD' | 'DAT' | 'Casette';


    export type File = {
	name: string,
	size: number,
    }

    // meant to have enough information to determine which torrent from a group is the best
    export type Torrent = {
	id: number,
	size: number,
	codec: Codec,
	media: Media,
	year: number,
	snatches: number,
	seeders: number,
	leechers: number,
	files: Array<File>,
    }

    export interface GroupLite {
	id: number,
	name: string,
	year: number,
	artist: ArtistLite,
    }

    export interface Group extends GroupLite {
	imageUrl: string,
	// artists: Array<GazelleArtist>,
	// only the selected torrent
	torrent: Torrent,
    }

    interface ArtistLite {
	id: number,
	name: string,
    }

    export interface Artist extends ArtistLite {
	imageUrl: string,
	groups: Array<Group>,
    }
}

export type BrowseOptions = {
    term?: string,
    filelistTerm?: string,
    tags?: string[],
    orderBy: SearchOrderBy,
    orderAscending?: boolean,
    fromYear?: number,
    toYear?: number,
    page?: number,
}

//** FUNCTIONS

export function codecEstimatedBitRate(codec: Gazelle.Codec): number {
    switch(codec.encoding) {
	case 'Lossless':
	    return 950*1024;
	case '24bit Lossless':
	    return 3000*1024;
	case 'V0 (VBR)':
	    return 260*1024;
	case 'V1 (VBR)':
	    return 225*1024;
	case 'V2 (VBR)':
	    return 192*1024;
	default:
	    if (parseInt(codec.encoding).toString() === codec.encoding) {
		return parseInt(codec.encoding);
	    }
	    // who knows?
	    debug(`Unable to guesstimate bitrate for encoding ${codec.encoding}`)
	    return 200 * 1024;
    }
}

export function codecContentType(codec: Gazelle.Codec): string {
    switch(codec.format) {
	case 'FLAC':
	    return 'audio/flac';
	case 'MP3':
	case 'AAC':
	case 'DTS':
	    return 'audio/mpeg';
	case 'Ogg Vorbis':
	    return 'audio/ogg';
	case 'AC3':
	    return 'audio/ac3'
	default:
	    debug(`Unable to guestimate content type for format ${codec.format}`)
	    return 'audio/mpeg'
    }
}

export function songNamePredicate(name: string): string | void {
    if (/\.(mp3|aac)$/i.test(name)) {
	return 'audio/mpeg'
    }
    if (/\.flac$/i.test(name)) {
	return 'audio/flac'
    }
}

// get files, sizes, and filter only to music.
function parseFileList(wireFileList: string): Gazelle.File[] {
    return wireFileList
	.split('|||')
	.map(file => {
	    const [, fileName, fileSize] = file.match(/(.+){{{(\d+)}}}/);
	    return {
		name: fileName,
		size: parseInt(fileSize),
	    }
	})
	.filter(file => songNamePredicate(file.name))
}

function w2gTorrent(wire: Wire.Torrent): Gazelle.Torrent {
    return {
	id: wire.id,
	size: wire.size,
	year: wire.remasterYear, // TODO: will we ever use this? If so, conditional on remastered
	snatches: wire.snatched,
	seeders: wire.seeders,
	leechers: wire.leechers,
	media: wire.media,
	codec: { format: wire.format as any, encoding: wire.encoding as any },
	files: parseFileList(wire.fileList),	
    }
}

function parseTorrentGroupResult(wire: Wire.TorrentGroupResult): Gazelle.Group {
    return {
	id: wire.group.id,
	name: wire.group.name,
	year: wire.group.year,
	// TODO: handle multiple artists somehow
	artist: wire.group.musicInfo.artists[0],
	imageUrl: wire.group.wikiImage,
	torrent: torrentSelect(wire.torrents.map(w2gTorrent)),
    }
}

function parseBrowseResult(wire: Wire.BrowseResult): Gazelle.GroupLite[] {
    // TODO: filter to those torrents that have at least one torrent and one artist on the torrent?
    return wire.results.map(wireGroup => {
	let artist = { name: 'Unknown', id: -1 };
	try {
	    artist = wireGroup.torrents[0].artists[0];
	} catch (e) { }
	return {
	    id: wireGroup.groupId,
	    name: wireGroup.groupName,
	    year: wireGroup.groupYear,
	    artist,
	}
    })
}

async function gazelleApiQuery(action: string, otherProps: object): Promise<object> {
    const props: string = Object.keys(otherProps)
	.map(key => `&${encodeURIComponent(key)}=${encodeURIComponent(otherProps[key])}`)
	.join('');
    const url =  `${getConfig().gazelle.baseUrl}/ajax.php?action=${action}${props}`;
    debug(`Querying ${url}`)
    const response: needle.NeedleResponse
	= await needle('get', url, null,
		       {
	    json: true,
	    headers: {
		authorization: getConfig().gazelle.authToken,
	    }
	});
    if (response.body.status !== 'success') {
	throw new Error(`Gazelle API returned "status: failure" with message "${response.body.error}"`);
    }

    return response.body.response;
}

export async function groupSearch(opts: BrowseOptions)
: Promise<Gazelle.GroupLite[]> {

    const response = await gazelleApiQuery('browse', {
	searchstr: opts.term || '',
	filelist: opts.filelistTerm || '',
	taglist: (opts.tags || []).join(', '),
	page: opts.page || 1,
	order_by: opts.orderBy,
	order_way: opts.orderAscending ? 'asc' : 'desc',
	year: (opts.fromYear || '') + (opts.toYear ? `-${opts.toYear}` : ''),
	
    }) as Wire.BrowseResult;

    return parseBrowseResult(response);
}

// it would be cool to make a generic function for paging through the results of another function
// that can be paged through, but oh well
export async function groupSearchPaged(opts: BrowseOptions, size: number, offset: number)
: Promise<Gazelle.GroupLite[]> {
    
    const pageSize = getConfig().gazelle.searchPageSize;
    // these page numbers are zero-indexed
    const firstPageNumber = Math.floor(offset / pageSize);
    const lastPageNumber = Math.floor((offset + size - 1) / pageSize);
    const result: Gazelle.GroupLite[] = [];

    // TODO: parallelize the loop
    for (let i = firstPageNumber; i <= lastPageNumber; i++) {
	// gazelle api's page numbers are 1-indexed
	const curResult = await groupSearch({ ...opts, page: i+1 });
	if (curResult.length === 0) {
	    break
	}
	const curPageStart = i*pageSize;
	result.push(...curResult.slice(Math.max(offset - curPageStart, 0),
				       offset + size - curPageStart))
    }

    return result;
}

export async function groupGet(groupId: number): Promise<Gazelle.Group> {

    const response = await gazelleApiQuery('torrentgroup', { id: groupId }) as Wire.TorrentGroupResult;
    return parseTorrentGroupResult(response);
}

// export async function artistGet(gazelleConfig: GazelleConfig, artistId: number) :
// 				Promise<GazelleArtist> {
    
// }

function torrentCompare(compareBy: TorrentSelectionOrderBy,
			t1: Gazelle.Torrent,
			t2: Gazelle.Torrent)
: boolean | void {

    const config = getConfig().torrentSelection;
    switch (compareBy) {
	case 'seeders':
	    if (t1.seeders >= config.seeders) {
		return false;
	    }
	    return t1.seeders < t2.seeders;
	case 'format':
	    return config.formats.indexOf(t1.codec.format) < config.formats.indexOf(t2.codec.format);
	case 'year':
	    return config.preferNewEditions
		? (t1.year < t2.year)
		: (t1.year > t2.year);
	case 'numTracks':
	    return t1.files.length > t2.files.length;
    }
}

export function torrentSelect(torrents: Array<Gazelle.Torrent>): Gazelle.Torrent {
    if (torrents.length < 1) {
	throw new Error('torrentSelect called on empty array')
    }
    const config = getConfig().torrentSelection;
    // first, filter by allowed formats. This supersedes the sort order.
    // TODO: consider adding filtering back in. It's disabled right now
    const candidates =
	torrents//.filter(t => config.formats.some(f => t.format === f))
	.sort((t1, t2) => {
	    // try each comparison strategy in the order the user wants
	    for (let i = 0; i < config.sortOrder.length; i++) {
		const compareResult: boolean | void = torrentCompare(config.sortOrder[i], t1, t2);
		if (typeof compareResult === 'boolean') {
		    return compareResult ? 1 : 0;
		}
	    }
	    // none of the comparisons gave a crap, so they're equal
	    return 0;
	});
    return candidates[0];
}
