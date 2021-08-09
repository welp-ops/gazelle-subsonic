import Router from '@koa/router'
import Koa from 'koa'
import Joi from 'joi'

import { subsonicMiddleware, SubsonicError, SubsonicErrorCode } from './subsonic-middleware.js'
import { groupGet } from './gazelle.js'
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

    export type StandaloneArtist = { artist: Artist }

    // directories seem to have parent ids usually?
    export type StandaloneDirectoryAlbum = { directory: Album & { child: Song[] }}
    export type StandaloneDirectoryArtist = { directory: Artist & { child: Album[] }}
}

//** FUNCTIONS

export function parseSongId(songId: string): SongId {
    Joi.assert(songId, songIdSchema);

    const parts = songId.split('-');
    return {
	groupId: parseInt(parts[1]),
	torrentId: parseInt(parts[2]),
	fileIndex: parseInt(parts[3]),
    }
}

export function parseArtistId(artistId: string): ArtistId {
    Joi.assert(artistId, artistIdSchema)

    const parts = artistId.split('-');
    return parseInt(parts[1]);
}

export function parseGroupId(groupId: string): GroupId {
    Joi.assert(groupId, groupIdSchema);

    const parts = groupId.split('-');
    return parseInt(parts[1]);
}

export function serializeSongId(songId: SongId): string {
    return `song-${songId.groupId}-${songId.torrentId}-${songId.fileIndex}`
}

export function serializeArtistId(artistId: ArtistId): string {
    return `artist-${artistId}`
}

export function serializeGroupId(groupId: GroupId): string {
    return `group-${groupId}`
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

    const file = await getTorrentFile(songId.torrentId, songId.fileIndex);
    if (/\.(mp3|aac)$/i.test(file.name)) {
	ctx.response.type = 'audio/mpeg';
    } else if (/\.flac$/i.test(file.name)) {
	ctx.response.type = 'audio/flac';
    }
    ctx.response.length = file.length;
    ctx.subsonicResponse = false;
    ctx.body = file.createReadStream();
}

defineEndpoint('stream', streamQuerySchema, stream);
defineEndpoint('download', streamQuerySchema, stream);

async function getAlbum(id: GroupId): Promise<{ album: SubSerial.Album, songs: SubSerial.Song[]}> {
    const group = await groupGet(id);
    const artistId = serializeArtistId(group.artist.id);
    const groupId = serializeGroupId(group.id)

    return {
	album: {
	    id: groupId,
	    name: group.name,
	    coverArt: 'TODO',
	    songCount: group.torrent.songs.length,
	    duration: 1234,
	    artist: group.artistName,
	    artistId,
	    parent: artistId,
	    isDir: true,
	},
	songs: group.torrent.songs.map((song, i) => ({
	    id: serializeSongId({ groupId: group.id, torrentId: group.torrent.id, fileIndex: i }),
	    parent: groupId,
	    // TODO: clean up song names more
	    title: song.name,
	    album: groupId,
	    artist: artistId,
	    coverArt: 'TODO',
	    duration: 1234,
	    bitRate: 1234,
	    size: song.size,
	    contentType: 'TODO',
	    path: `${group.artist.name}/${group.name}/${song.name.slice(song.name.lastIndexOf('/')+1)}`,
	    isVideo: false,
	    isDir: false,
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

allRouter.use(apiRouter.routes());
allRouter.use(apiRouter.allowedMethods());

export default allRouter;
