import Koa from 'koa'
import { escape } from 'html-escaper'
import { createHmac } from 'crypto'
import getConfig from './config.js'

const serverRestVersion = '1.8.0';

export enum SubsonicErrorCode {
    Generic = 0,
    RequiredParameterMissing = 10,
    IncompatibleClientVersion = 20,
    IncompatibleServerVersion = 30,
    WrongAuth = 40,
    OperationNotAuthorized = 50,
    NotFound = 70,
}

enum SubsonicResponseFormat {
    Xml,
    Json,
}

export class SubsonicError extends Error {
    code: SubsonicErrorCode;

    constructor(message: string, code: SubsonicErrorCode) {
	super(message);
	this.code = code;
    }
}

function renderXml(body: object): string {
    // render the xml only, no <?xml crap
    function renderXmlHelper(curBody: object, rootName?: string) {
	// TODO: is this right type annot?
	const attrs: { [key: string]: string } = {};
	const children: Array<{ name: string, value: object }> = [];

	Object.keys(curBody).forEach(key => {
	    const value = curBody[key];
	    if (value instanceof Array) {
		value.forEach(v => children.push({ name: key, value: v }));
	    } else if (typeof value === 'object') {
		children.push({ name: key, value });
	    } else {
		attrs[key] = String(value);
	    }
	})

	if (!rootName && Object.keys(attrs).length > 0) {
	    throw new Error('No attributes allowed on fake root XML element');
	}

	const attrsString: string = Object.keys(attrs).map(key => {
	    const value = attrs[key];
	    return `${key}="${escape(value)}"`;
	}).join(' ');

	if (children.length === 0 && rootName) {
	    return `<${rootName} ${attrsString}/>`;
	}
	
	const childrenString: string = children.map(({ name, value }) => renderXmlHelper(value, name)).join('\n');

	return rootName
	    ? `<${rootName} ${attrsString}>
${childrenString}
</${rootName}>`
	    : childrenString;
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + renderXmlHelper(body);
}

function renderResponse(ctx: Koa.Context, body: object): void {
    switch (ctx.subsonicRequest.format) {
	case SubsonicResponseFormat.Xml:
	    ctx.response.type = 'xml'
	    ctx.response.body = renderXml(body);
	    break;
	case SubsonicResponseFormat.Json:
	    ctx.response.type = 'json'
	    ctx.response.body = JSON.stringify(body)
	    break;
    }
}

function renderError(ctx: Koa.Context, error: SubsonicError): void {
    ctx.response.status = 400;
    renderResponse(
	ctx,
	{
	    'subsonic-response': {
		// TODO: no xmlns for json
		xmlns: 'http://subsonic.org/restapi',
		status: 'failed',
		type: 'gazelle-subsonic',
		version: serverRestVersion,
		error: {
		    code: error.code,
		    message: error.message,
		},
	    },
	});
}

function renderOk(ctx: Koa.Context): void {
    renderResponse(
	ctx,
	{
	    'subsonic-response': {
		xmlns: 'https://subsonic.org/restapi',
		status: 'ok',
		type: 'gazelle-subsonic',
		version: serverRestVersion,
		...ctx.subsonicResponse,
	    }
	}
    )
}

// TODO ts
export async function subsonicMiddleware(ctx: Koa.Context, next: Koa.Next) {
    ctx.subsonicRequest = {
	format: SubsonicResponseFormat.Xml,
    }

    try {
	const query: NodeJS.Dict<string | string[]> = ctx.request.query;
	switch (query.f) {
	    case 'xml':
		ctx.subsonicRequest.format = SubsonicResponseFormat.Xml;
		break;
	    case 'json':
		ctx.subsonicRequest.format = SubsonicResponseFormat.Json;
		break;
	    case undefined:
		break;
	    default:
		throw new SubsonicError('Unknown/unsupported format', SubsonicErrorCode.Generic);
	}

	if (!query.v) {
	    throw new SubsonicError('Missing v parameter', SubsonicErrorCode.RequiredParameterMissing);
	}
	if (!query.c) {
	    throw new SubsonicError('Missing c parameter', SubsonicErrorCode.RequiredParameterMissing);
	}
	if (!query.u) {
	    throw new SubsonicError('Missing u parameter', SubsonicErrorCode.RequiredParameterMissing);
	}
	if (query.v instanceof Array
	    || query.c instanceof Array
	    || query.u instanceof Array
	    || (query.p && query.p instanceof Array)) {
	    throw new SubsonicError('Duplicate single-letter parameters', SubsonicErrorCode.RequiredParameterMissing);
	}
	ctx.subsonicRequest.version = query.v;
	ctx.subsonicRequest.client = query.c

	const authError = new SubsonicError('Incorrect username or password', SubsonicErrorCode.WrongAuth);
	const username = query.u as string;
	let serverPassword: string = getConfig().users[username];
	if (!serverPassword) {
	    throw authError;
	}
	if (query.p) {
	    let clientPassword: string = query.p as string;
	    if (clientPassword.indexOf('enc:') === 0) {
		clientPassword = clientPassword.match(/../g).map(c => String.fromCharCode(parseInt(c, 16))).join('');
	    }
	    if (serverPassword !== clientPassword) {
		throw authError;
	    }
	} else {
	    if (!(query.t && query.s)) {
		throw new SubsonicError('Missing sufficient password parameters', SubsonicErrorCode.RequiredParameterMissing);
	    }
	    if (query.t instanceof Array || query.s instanceof Array) {
		throw new SubsonicError('Duplicate single-letter parameters', SubsonicErrorCode.RequiredParameterMissing);
	    }

	    const clientHash = query.t as string;
	    const serverHash = createHmac('md5', serverPassword + query.s).digest('hex');
	    if (serverHash !== clientHash) {
		throw authError;
	    }
	}
	ctx.subsonicRequest.username = username;

	// if we made it here, authentication was successful.
	await next();

	// suppress our output handling
	if (ctx.subsonicResponse === false) {
	    return;
	}

	if (ctx.subsonicResponse) {
	    renderOk(ctx)
	} else {
	    ctx.response.status = 404;
	    ctx.body = 'Not found/not implemented'
	}
    } catch (e) {
	if (!(e instanceof SubsonicError)) {
	    console.error('Subsonic middleware is handling an unknown error:')
	    console.error(e)
	    e = new SubsonicError(e.message, SubsonicErrorCode.Generic);
	}
	renderError(ctx, e);
    }
}
