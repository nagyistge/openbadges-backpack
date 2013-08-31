var url = require('url');
var express = require('express');
var clientSessions = require('client-sessions');

var paths = require('./paths');
var template = require('./template');
var persona = require('./persona');
var securityHeaders = require('./security-headers');

exports.build = function(options) {
  var app = express();

  app.use(securityHeaders({
    enableHSTS: url.parse(options.origin).protocol == 'https:'
  }));
  app.use(express.static(paths.staticDir));

  app.use(express.bodyParser());
  app.use(clientSessions({
    cookieName: 'session',
    secret: options.cookieSecret,
    duration: options.cookieDuration ||
              24 * 60 * 60 * 1000, // defaults to 1 day
  }));
  app.use(express.csrf());
  template.defineMiddleware(app, {
    debug: options.debug,
    extraTemplateLoaders: options.extraTemplateLoaders
  });
  persona.defineMiddleware(app, {
    jsUrl: options.personaJsUrl
  });

  if (options.debug) require('../test/lib').defineMiddleware(app);
  if (options.defineExtraMiddleware) options.defineExtraMiddleware(app);

  app.use(app.router);

  persona.defineRoutes(app, {
    audience: options.origin,
    defineRoutes: options.personaDefineRoutes
  });

  app.get('/', function(req, res) {
    return res.render('layout.html');
  });

  require('./issue').defineRoutes(app);

  if (options.defineExtraRoutes) options.defineExtraRoutes(app);

  app.use(function(err, req, res, next) {
    if (typeof(err.status) == 'number')
      return res.type('text/plain').send(err.status, err.message);
    process.stderr.write(err.stack);
    res.send(500, 'Sorry, something exploded!');
  });

  return app;
};
