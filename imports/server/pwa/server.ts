import { WebApp } from 'meteor/webapp';

WebApp.rawConnectHandlers.use((request, response, next) => {
  const path = request.url?.split('?')[0];

  if (path === '/site.webmanifest') {
    response.setHeader(
      'Content-Type',
      'application/manifest+json; charset=utf-8',
    );
  }

  next();
});
