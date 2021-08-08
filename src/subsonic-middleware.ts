import Koa from 'koa'
import crypto from 'crypto'
import getConfig from './config'

const serverRestVersion = '1.8.0';

enum SubsonicErrorCode {
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

class SubsonicError extends Error {
    constructor(message: string, code: SubsonicErrorCode) {
	super(message);
	this.code = code;
    }

    code: SubsonicErrorCode;
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
		children.push(value);
	    } else {
		attrs[key] = String(value);
	    }
	})

	if (rootName && children.length > 0) {
	    throw new Error('No attributes allowed on fake root XML element');
	}

	const attrsString: string = Object.keys(attrs).map(key => {
	    const value = attrs[key];
	    return `${key}="${value}"`;
	}).join(' ');
	if (children.length === 0) {
	    return `<${rootName} ${attrsString}/>`;
	}
	
	const childrenString: string = children.map(({ name, value }) => renderXmlHelper(value, name)).join('\n');

	return `<${rootName} ${attrsString}>
${childrenString}
</${rootName}>`;
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + renderXmlHelper(body);
}

function renderResponse(format: SubsonicResponseFormat, body: object): string {
    switch (format) {
	case SubsonicResponseFormat.Xml:
	    return renderXml(body);
	case SubsonicResponseFormat.Json:
	    return JSON.stringify(body)
    }
}

function renderError(format: SubsonicResponseFormat, error: SubsonicError): string {
    return renderResponse(
	format,
	{
	    'subsonic-response': {
		xmlns: 'http://subsonic.org/restapi',
		status: 'failed',
		version: serverRestVersion,
		error: {
		    code: error.code,
		    message: error.message,
		},
	    },
	});
}

function renderOk(format: SubsonicResponseFormat, body: object): string {
    return renderResponse(
	format,
	{
	    'subsonic-response': {
		xmlns: 'https://subsonic.org/restapi',
		status: 'failed',
		version: serverRestVersion,
		...body,
	    }
	}
    )
}

// TODO ts
export default async function subsonicMiddleware(ctx: Koa.Context, next: Koa.Next) {
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
	if (query.v.length || query.c.length || query.u.length || (query.p && query.p.length)) {
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
	    if (query.t.length || query.s.length) {
		throw new SubsonicError('Duplicate single-letter parameters', SubsonicErrorCode.RequiredParameterMissing);
	    }

	    const clientHash = query.t as string;
	    const serverHash = crypto.createHmac('md5', serverPassword + query.s).digest('hex');
	    if (serverHash !== clientHash) {
		throw authError;
	    }
	}
	ctx.subsonicRequest.username = username;

	// if we made it here, authentication was successful.
	await next();

	if (!ctx.subsonicResponse) {
	    throw new SubsonicError('empty response', SubsonicErrorCode.Generic);
	}
	ctx.response.status = 200;
	ctx.response.body = renderOk(ctx.subsonicRequest.format, ctx.subsonicResponse);
    } catch (e) {
	if (!(e instanceof SubsonicError)) {
	    e = new SubsonicError(e.message, SubsonicErrorCode.Generic);
	}
	ctx.response.status = 400; // TODO
	ctx.response.body = renderError(ctx.subsonicRequest.format, e);
    }
}
