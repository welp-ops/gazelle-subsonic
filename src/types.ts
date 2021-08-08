// big boy TODO: add types for the raw responses from the Gazelle API

export type GazelleArtist = {
    id: number,
    name: string,
}

export type GazelleFile = {
    name: string,
    size: number,
}

export type GazelleFormat = 'FLAC' | 'MP3 320' | 'MP3 V0' | 'MP3 V2' | 'MP3 Other' | 'Other';

export type GazelleMedia = 'Vinyl' | 'CD' | 'WEB' | 'DVD' | 'BD' | 'Soundboard' | 'SACD' | 'DAT' | 'Casette';

export interface GazelleTorrent {
    id: number,
    size: number,
    format: GazelleFormat,
    media: GazelleMedia,
    year: number,
    snatches: number,
    seeders: number,
    leechers: number,
    files?: Array<GazelleFile>,
}

export type GazelleTorrentGroup = {
    id: number,
    name: string,
    artist: string,
    year: number
    releaseType: string,
    snatches?: number,
    seeders?: number,
    leechers?: number,
    imageUrl: string,
    // artists: Array<GazelleArtist>,
    torrents: Array<GazelleTorrent>,
}

export type GazelleSearchOrderBy = 'time' | 'year' | 'size' | 'random' | 'snatched' | 'seeders' | 'leechers';

export type GazelleSearchResult = {
    groups: Array<GazelleTorrentGroup>,
    numPages: number,
}

export interface GazelleConfig {
    baseUrl: string, // NO trailing slash
    authToken: string,
    announceKey: string,
}

export type TorrentSelectionOrderBy = 'seeders' | 'format' | 'year' | 'numTracks';

export interface TorrentSelectionConfig {
    sortOrder: Array<TorrentSelectionOrderBy>;
    formats: Array<GazelleFormat>,
    seeders: number | true, // if number, any torrent with at least that many seeders is considered equivalently good. If true, always maximize seeders.
    preferNewEditions: boolean, // If true, prefer newer torrents, else, prefer older ones.
}

export interface ServerConfig {
    bindIp: string,
    port: number,
}

export type AllConfig = {
    gazelle: GazelleConfig,
    torrentSelection: TorrentSelectionConfig,
    server: ServerConfig,
    users: Array<{ [key: string]: string }>,
}
