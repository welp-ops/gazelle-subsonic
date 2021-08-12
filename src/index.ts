import Koa from 'koa';
import subsonicRouter from './subsonic-api.js'
import getConfig from './config.js'

const config = getConfig();

const app = new Koa();

// CORS
app.use(async (ctx, next) => {
	const corsOrigins = getConfig().server.corsOrigins
	if (corsOrigins === '*') {
		ctx.set('Access-Control-Allow-Origin', '*');
	} else if (corsOrigins instanceof Array) {
		ctx.set('Vary', 'Origin')
		if (corsOrigins.includes(ctx.get('Origin'))) {
			ctx.set('Access-Control-Allow-Origin', ctx.get('Origin'))
		}
	}
	ctx.set('Access-Control-Max-Age', '30') // config changes visible after just 30 seconds
	ctx.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
	ctx.set('Access-Control-Allow-Headers', 'Content-Type, Content-Length')
	await next()
})

app.use(subsonicRouter.routes());
app.use(subsonicRouter.allowedMethods());

app.listen(config.server.port, config.server.bindIp, () => {
	console.log('Gazelle-subsonic is running.');
});
