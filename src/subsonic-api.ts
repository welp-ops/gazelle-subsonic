import Router from '@koa/router'
import Koa from 'koa'
import Joi from 'joi'

import { subsonicMiddleware, SubsonicError, SubsonicErrorCode } from './subsonic-middleware.js'
import { groupGet, groupSearchPaged, songNamePredicate, codecEstimatedBitRate, codecContentType, BrowseOptions, Gazelle } from './gazelle.js'
import { getTorrentFile, TorrentFileNotFoundError } from './webtorrent.js'

const allRouter = new Router({ prefix: '/rest' });
const apiRouter = new Router();
apiRouter.use(subsonicMiddleware);

//** TYPES

type ArtistId = number;
const artistIdSchema = Joi.string().regex(/^artist-\d+$/)

type GroupId = number;
const groupIdSchema = Joi.string().regex(/^group-\d+$/)

type SongId = {
    groupId: GroupId,
    torrentId: number, // for instant playback, even if group not available
    fileIndex: number,
}
const songIdSchema = Joi.string().regex(/^song-\d+-\d+-\d+$/)

namespace SubSerial {

    export type Song = {
	id: string,
	parent: string,
	title: string,
	album: string,
	artist: string,
	isDir: false,
	coverArt: string,
	duration: number,
	bitRate: number,
	size: number,
	contentType: string,
	isVideo: false,
	path: string,
    }

    export type StandaloneSong = { song: Song }

    export type Album = {
	id: string,
	name: string,
	coverArt: string,
	songCount: number,
	duration: number,
	artist: string,
	artistId: string,
	parent: string, // same as artistId for us
	isDir: true,
    }

    export type StandaloneAlbum = { album: Album & { song: Song[] } }

    type Artist = {
	id: string,
	name: string,
	coverArt: string,
	albumCount: number,
	album?: Array<Album>,
    }

    // search2 and search3
    export type SearchResult = {
	album: Album[],
	song: Song[],
	artist: Artist[],
    }

    export type StandaloneArtist = { artist: Artist }

    // directories seem to have parent ids usually?
    export type StandaloneDirectoryAlbum = { directory: Album & { child: Song[] }}
    export type StandaloneDirectoryArtist = { directory: Artist & { child: Album[] }}

    export type StandaloneAlbumList = { albumList: { album: Album[] }}
    export type StandaloneAlbumList2 = { albumList2: { album: Album[] }}

    export type StandaloneSearch2 = { search2: SearchResult }
    export type StandaloneSearch3 = { search3: SearchResult }
}

// technical information about a song that can be gotten from just the gazelle song
type SerialSongTechnical = {
    title: string,
    isDir: false,
    isVideo: false,
    duration: number,
    bitRate: number,
    size: number,
    contentType: string,
}

//** FUNCTIONS

function parseSongId(songId: string): SongId {
    Joi.assert(songId, songIdSchema);

    const parts = songId.split('-');
    return {
	groupId: parseInt(parts[1]),
	torrentId: parseInt(parts[2]),
	fileIndex: parseInt(parts[3]),
    }
}

function parseArtistId(artistId: string): ArtistId {
    Joi.assert(artistId, artistIdSchema)

    const parts = artistId.split('-');
    return parseInt(parts[1]);
}

function parseGroupId(groupId: string): GroupId {
    Joi.assert(groupId, groupIdSchema);

    const parts = groupId.split('-');
    return parseInt(parts[1]);
}

function parseCoverId(coverId: string): CoverId {
    Joi.assert(coverId, coverIdSchema);

    const parts = coverId.split('-');
    return parseInt(parts[1]);
}

function serializeSongId(songId: SongId): string {
    return `song-${songId.groupId}-${songId.torrentId}-${songId.fileIndex}`
}

function serializeArtistId(artistId: ArtistId): string {
    return `artist-${artistId}`
}

function serializeGroupId(groupId: GroupId): string {
    return `group-${groupId}`
}

function serializeCoverId(coverId: CoverId): string {
    return `cover-${coverId}`
}

function parseSongsTechnical(codec: Gazelle.Codec, files: Gazelle.File[])
: Array<{ technical: SerialSongTechnical, original: Gazelle.File }> {
    // excludes extension
    function pathFileName(path: string): string {
	return path.substring(path.lastIndexOf('/'), path.lastIndexOf('.'))
    }

    // find a common prefix to all the song names, taking into account that each song may have a
    // different number in its name
    let commonPrefix: string = '';
    if (files.length > 1) {
	commonPrefix = pathFileName(files[0].name)
	for (let i = 1; i < files.length; i++) {
	    const fileName = pathFileName(files[i].name)
	    let newCommonPrefix = ''
	    for (let k = 0; k < fileName.length && k < commonPrefix.length; k++) {
		// possible enhancement: allow variable-length numbers in the common prefix
		if (fileName[k] === commonPrefix[k] || (/\d/.test(fileName[k]) && /\d/.test(commonPrefix[k]))) {
		    newCommonPrefix += fileName[k]
		} else {
		    break
		}
	    }
	    commonPrefix = newCommonPrefix
	}
    }

    return files.map(file => ({
	technical: {
	    title: pathFileName(file.name).slice(commonPrefix.length),
	    size: file.size,
	    bitRate: codecEstimatedBitRate(codec),
	    // round to nearest 30 seconds so it isn't sus
	    duration: Math.max(30, Math.round(file.size*8 / codecEstimatedBitRate(codec) / 30) * 30),
	    contentType: codecContentType(codec),
	    isDir: false,
	    isVideo: false,
	},
	original: file,
    }))
}

function parseGroupLite(group: Gazelle.GroupLite): SubSerial.Album {
    return {
	id: serializeGroupId(group.id),
	name: group.name,
	coverArt: serializeCoverId(group.id),
	songCount: 42,
	duration: 1234,
	artist: group.artist.name,
	artistId: serializeArtistId(group.artist.id),
	parent: serializeArtistId(group.artist.id),
	isDir: true,
    }
}

function makeJoiMiddleware(schema: Joi.ObjectSchema) {
    return async (ctx: Koa.Context, next) => {
	const error = schema.validate(ctx.query, {
	    allowUnknown: true,
	}).error;
	if (error) {
	    throw new SubsonicError(error.message, SubsonicErrorCode.RequiredParameterMissing);
	}
	await next();
    }
}

function defineEndpoint(endpoint: string, schema: Joi.ObjectSchema, handler: (ctx: Koa.Context) => any): void {
    const joiMiddleware = makeJoiMiddleware(schema);
    apiRouter.get(`/${endpoint}`, joiMiddleware, handler);
    apiRouter.get(`/${endpoint}.view`, joiMiddleware, handler);
}

//** ENDPOINTS

const emptySchema = Joi.object({});

defineEndpoint('ping', emptySchema, ctx => ctx.subsonicResponse = {});

defineEndpoint('getLicense', emptySchema, ctx => ctx.subsonicResponse = {
    valid: true,
    email: 'welp@orpheus.network',
    licenseExpires: new Date('2100').toISOString(),
});

const streamQuerySchema = Joi.object({
    id: songIdSchema.required(),
})
async function stream(ctx: Koa.Context) {
    const songId = parseSongId(ctx.query.id as string);

    const file = await getTorrentFile(songId.torrentId, songId.fileIndex, songNamePredicate);
    // TODO: somehow use the codic instead?
    const contentType = songNamePredicate(file.name);
    ctx.response.length = file.length;
    ctx.subsonicResponse = false;
    const stream = file.createReadStream();
    // HACK
    if (!(file as any).done) {
	(file as any)._torrent.done = false;
    }
    ctx.body = stream;
}

defineEndpoint('stream', streamQuerySchema, stream);
defineEndpoint('download', streamQuerySchema, stream);

async function getAlbum(id: GroupId): Promise<{ album: SubSerial.Album, songs: SubSerial.Song[]}> {
    const group = await groupGet(id);
    const artistId = serializeArtistId(group.artist.id);
    const groupId = serializeGroupId(group.id)
    const coverId = serializeCoverId(group.id)

    return {
	album: {
	    id: groupId,
	    name: group.name,
	    coverArt: coverId,
	    songCount: group.torrent.files.length,
	    duration: 1234,
	    artist: group.artist.name,
	    artistId,
	    parent: artistId,
	    isDir: true,
	},
	songs: parseSongsTechnical(group.torrent.codec, group.torrent.files).map((song, i) => ({
	    ...song.technical,
	    id: serializeSongId({ groupId: group.id, torrentId: group.torrent.id, fileIndex: i }),
	    parent: groupId,
	    // TODO: clean up song names more
	    album: groupId,
	    artist: artistId,
	    coverArt: coverId,
	    path: `${group.artist.name}/${group.name}/${song.technical.title}`,
	}))
    }
}

const getAlbumQuerySchema = Joi.object({
    id: groupIdSchema.required(),
})
defineEndpoint('getAlbum', getAlbumQuerySchema, async ctx => {

    const album = await getAlbum(parseGroupId(ctx.query.id as string));
    const response: SubSerial.StandaloneAlbum = {
	album: {
	    ...album.album,
	    song: album.songs,
	}
    }
    ctx.subsonicResponse = response;
})

const getMusicDirectoryQuerySchema = Joi.object({
    id: Joi.alternatives().try(groupIdSchema, artistIdSchema).required(),
})
defineEndpoint('getMusicDirectory', getMusicDirectoryQuerySchema, async ctx => {

    if (!groupIdSchema.validate(ctx.query.id).error) {
	// group
	const album = await getAlbum(parseGroupId(ctx.query.id as string));
	// just shuffle it around into the format we want
	const result: SubSerial.StandaloneDirectoryAlbum = {
	    directory: {
		...album.album,
		child: album.songs,
	    }
	};
	ctx.subsonicResponse = result;
    } else {
	// artist
	// TODO
    }
})

const getAlbumListQuerySchema = Joi.object({
    type: Joi.string().equal('random', 'newest', 'highest', 'frequent', 'recent', 'alphabeticalByName', 'alphabeticalByArtist', 'starred', 'byYear', 'byGenre').required(),
    size: Joi.number().max(250),
    offset: Joi.number(),
    fromYear: Joi.number()
	.when('type', {is: Joi.equal('byYear'), then: Joi.required(), otherwise: Joi.forbidden()}),
    toYear: Joi.number()
	.when('type', {is: Joi.equal('byYear'), then: Joi.required(), otherwise: Joi.forbidden()}),
    genre: Joi.string()
	.when('type', {is: Joi.equal('genre'), then: Joi.required(), otherwise: Joi.forbidden()}),
})

async function getAlbumList(ctx: Koa.Context): Promise<SubSerial.Album[]> {
    let opts: BrowseOptions = {
	orderBy: 'seeders',
    };

    switch (ctx.query.type) {
	case 'random':
	    opts.orderBy = 'random';
	    break;
	case 'newest':
	    opts.orderBy = 'year';
	    break;
	case 'highest': // TODO: implement rating
	    opts.orderBy = 'snatched';
	    break;
	case 'frequent': // TODO: implement scrobbling
	    opts.orderBy = 'seeders';
	    break;
	case 'recent':
	    opts.orderBy = 'time';
	    break;
	case 'starred':
	    opts.orderBy = 'snatched';
	    break;
	case 'year':
	    opts.fromYear = parseInt(ctx.query.fromYear as string)
	    opts.toYear = parseInt(ctx.query.toYear as string)
	    break;
	case 'genre':
	    opts.tags = [(ctx.query.genre as string).replace(' ', '.')] // TODO: genre stuff in general
	    break;
    }

    const size = ctx.query.size ? parseInt(ctx.query.size as string) : 10;
    const offset = ctx.query.offset ? parseInt(ctx.query.offset as string) : 0;
    const searchResult = await groupSearchPaged(opts, size, offset);
    return searchResult.map(parseGroupLite);
}

defineEndpoint('getAlbumList', getAlbumListQuerySchema, async ctx => {
    const response: SubSerial.StandaloneAlbumList = {
	albumList: {
	    album: await getAlbumList(ctx),
	}
    }
    ctx.subsonicResponse = response;
})
defineEndpoint('getAlbumList2', getAlbumListQuerySchema, async ctx => {
    const response: SubSerial.StandaloneAlbumList2 = {
	albumList2: {
	    album: await getAlbumList(ctx),
	}
    }
    ctx.subsonicResponse = response;
})

const search2QuerySchema = Joi.object({
    query: Joi.string().required(),
    artistCount: Joi.number(),
    artistOffset: Joi.number(),
    albumCount: Joi.number(),
    albumOffset: Joi.number(),
    songCount: Joi.number(),
    songOffset: Joi.number(),
})
async function search2(ctx: Koa.Context): Promise<SubSerial.SearchResult> {
    return {
	// TODO: customizable order
	album: (await groupSearchPaged({ term: ctx.query.query as string, orderBy: 'seeders' },
				       parseInt(ctx.query.albumCount as string) || 20,
				       parseInt(ctx.query.albumOffset as string) || 0))
		   .map(parseGroupLite),
	song: [],
	artist: [],
    }
}

defineEndpoint('search2', search2QuerySchema, async ctx => {
    const response: SubSerial.StandaloneSearch2 = {
	search2: await search2(ctx),
    }
    ctx.subsonicResponse = response;
});
defineEndpoint('search3', search2QuerySchema, async ctx => {
    const response: SubSerial.StandaloneSearch3 = {
	search3: await search2(ctx),
    }
    ctx.subsonicResponse = response;
});

const getCoverArtQuerySchema = Joi.object({
    id: coverIdSchema,
})
defineEndpoint('getCoverArt', getCoverArtQuerySchema, async ctx => {
    // TODO: figure out a better way to do cover art

})

// yes, these have to go at the bottom
allRouter.use(apiRouter.routes());
allRouter.use(apiRouter.allowedMethods());

export default allRouter;
