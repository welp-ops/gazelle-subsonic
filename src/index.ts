import Koa from 'koa';
import subsonicMiddleware from './subsonic-middleware'
import subsonicRouter from './subsonic-api'
import getConfig from './config'

const config = getConfig();

const app = new Koa();

app.use(subsonicMiddleware);
app.use(subsonicRouter.routes());
app.use(subsonicRouter.allowedMethods());

app.listen(config.server.port, config.server.bindIp, () => {
    console.log('Server up.');
});
