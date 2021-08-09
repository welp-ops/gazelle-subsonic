import needle from 'needle';

import getConfig from './config.js';

//** TYPES

export type Format = 'FLAC' | 'MP3 320' | 'MP3 V0' | 'MP3 V2' | 'MP3 Other' | 'Other';

type Media = 'Vinyl' | 'CD' | 'WEB' | 'DVD' | 'BD' | 'Soundboard' | 'SACD' | 'DAT' | 'Casette';

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
    // type TorrentLite = {
    // 	torrentId: number,
    // 	artists: ArtistLite[],
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
    // }

    // returned by torrentgroup
    export type Torrent = {
	id: number,
	media: Media,
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
		// torrents: TorrentLite[],
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
namespace Gazelle {

    export type Song = {
	name: string,
	size: number,
    }

    // meant to have enough information to determine which torrent from a group is the best
    export type Torrent = {
	id: number,
	size: number,
	format: Format,
	media: Media,
	year: number,
	snatches: number,
	seeders: number,
	leechers: number,
	songs: Array<Song>,
    }

    export interface GroupLite {
	id: number,
	name: string,
	year: number,
	artistName: string,
    }

    export interface Group extends GroupLite {
	imageUrl: string,
	artist: ArtistLite,
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

    export type SearchResult = {
	numPages: number,
	groups: GroupLite[],
    }
}

//** FUNCTIONS

function parseFormat(gazelleFormat: string, gazelleEncoding: string): Format {
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

// get files, sizes, and filter only to music.
function parseFileList(wireFileList: string): Gazelle.Song[] {
    return wireFileList
	.split('|||')
	.map(file => {
	    const [, fileName, fileSize] = file.match(/(.+){{{(\d+)}}}/);
	    return {
		name: fileName,
		size: parseInt(fileSize),
	    }
	})
	.filter(song => /\.(mp3|flac|aac)$/i.test(song.name))
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
	format: parseFormat(wire.format, wire.encoding),
	songs: parseFileList(wire.fileList),	
    }
}

function parseTorrentGroupResult(wire: Wire.TorrentGroupResult): Gazelle.Group {
    return {
	id: wire.group.id,
	name: wire.group.name,
	year: wire.group.year,
	// TODO: allow customizing artist display
	artistName: wire.group.musicInfo.artists.concat(wire.group.musicInfo.with).map(a => a.name).join(', '),
	artist: wire.group.musicInfo.artists[0],
	imageUrl: wire.group.wikiImage,
	torrent: torrentSelect(wire.torrents.map(w2gTorrent)),
    }
}

function parseBrowseResult(wire: Wire.BrowseResult): Gazelle.SearchResult {
    return {
	groups: wire.results.map(wireGroup => ({
	    id: wireGroup.groupId,
	    name: wireGroup.groupName,
	    year: wireGroup.groupYear,
	    artistName: wireGroup.artist,
	})),
	numPages: wire.pages,
    }
}

async function gazelleApiQuery(action: string, otherProps: object): Promise<object> {
    const props: string = Object.keys(otherProps)
	.map(key => `&${encodeURIComponent(key)}=${encodeURIComponent(otherProps[key])}`)
	.join('');
    const response: needle.NeedleResponse
	= await needle('get', `${getConfig().gazelle.baseUrl}/ajax.php?action=${action}${props}`, null,
		       {
	    json: true,
	    headers: {
		Authorization: getConfig().gazelle.authToken,
	    }
	});
    if (response.body.status !== 'success') {
	throw new Error('Gazelle API returned "status: failure"');
    }

    return response.body.response;
}

export async function groupSearch(term: string,
			     orderBy: SearchOrderBy,
			     orderAscending: boolean = false,
			     page: number = 1)
: Promise<Gazelle.SearchResult> {

    const response = await gazelleApiQuery('browse', {
	searchstr: term,
	page,
	order_by: orderBy,
	order_way: orderAscending ? 'asc' : 'desc'
    }) as Wire.BrowseResult;

    return parseBrowseResult(response);
}

export async function groupGet(groupId: number): Promise<Gazelle.Group> {

    const response = await gazelleApiQuery('torrent', { id: groupId }) as Wire.TorrentGroupResult;
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
	    return config.formats.indexOf(t1.format) < config.formats.indexOf(t2.format);
	case 'year':
	    return config.preferNewEditions
		? (t1.year < t2.year)
		: (t1.year > t2.year);
	case 'numTracks':
	    return t1.songs.length > t2.songs.length;
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
