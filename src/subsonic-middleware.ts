import Koa from 'koa'
import Joi from 'joi'
import { encode } from 'html-entities'
import { createHash } from 'crypto'
import makeDebug from 'debug'

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

type SubsonicResponseFormat = { format: 'xml' } | { format: 'json' } | { format: 'jsonp', callback: string }

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
			return `${key}="${encode(value, { level: 'xml' })}"`;
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
	switch (ctx.query.f) {
		case 'xml':
		case undefined:
			ctx.response.type = 'xml'
			ctx.response.body = renderXml(body);
			break;
		case 'json':
			ctx.response.type = 'json'
			ctx.response.body = JSON.stringify(body)
			break;
		case 'jsonp':
			if (!ctx.query.callback || ctx.query.callback instanceof Array) {
				throw new SubsonicError('callback parameter required', SubsonicErrorCode.RequiredParameterMissing)
			}
			ctx.response.type = 'application/javascript'
			ctx.response.body = `${ctx.query.callback}(${JSON.stringify(body)})`
			break
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

const singleLetterParamsSchema = Joi.object({
	f: Joi.string().equal('xml', 'json', 'jsonp'),
	callback: Joi.string(), // no require at the Joi level because for images and streams some
							// clients still provide f=jsonp
	v: Joi.string().regex(/\d+\.\d+\.\d+/),
	c: Joi.string(),
	u: Joi.string().required(),
	p: Joi.string(),
	t: Joi.string().regex(/^[a-fA-F0-9]{32}$/),
	s: Joi.string(),
})
	.and('s', 't')
	.xor('p', 't')

const requestDebug = makeDebug('gazelle-subsonic:subsonic-request')
const middlewareDebug = makeDebug('gazelle-subsonic:subsonic-middleware')
export async function subsonicMiddleware(ctx: Koa.Context, next: Koa.Next) {
	requestDebug(`Subsonic request incoming to ${ctx.request.originalUrl}`)
	ctx.subsonicRequest = {
		format: { format: 'xml' }
	}

	try {
		const query: NodeJS.Dict<string | string[]> = ctx.request.query;
		const validateError = singleLetterParamsSchema.validate(query, { allowUnknown: true }).error;
		if (validateError) {
			throw new SubsonicError(validateError.message, SubsonicErrorCode.RequiredParameterMissing)
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
				clientPassword = clientPassword.slice(4).match(/../g).map(c => String.fromCharCode(parseInt(c, 16))).join('');
			}
			if (serverPassword !== clientPassword) {
				throw authError;
			}
		} else {
			const clientHash = query.t as string;
			const serverHash = createHash('md5').update(serverPassword + query.s).digest('hex');
			if (serverHash.toLowerCase() !== clientHash.toLowerCase()) {
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
		middlewareDebug(`Error: ${e.message}`)
		renderError(ctx, e);
	}
}
