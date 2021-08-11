import Koa from 'koa';
import subsonicRouter from './subsonic-api.js'
import getConfig from './config.js'

const config = getConfig();

const app = new Koa();

app.use(subsonicRouter.routes());
app.use(subsonicRouter.allowedMethods());

app.listen(config.server.port, config.server.bindIp, () => {
	console.log('Gazelle-subsonic is running.');
});
