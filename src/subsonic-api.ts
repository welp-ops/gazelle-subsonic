import Router from '@koa/router'

const theRouter = new Router({ prefix: '/rest' });
theRouter.get('/')

export default theRouter;
