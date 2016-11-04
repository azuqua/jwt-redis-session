

var	_ = require("lodash"),
	jwt = require("jsonwebtoken"),
	utils = require("./utils"),
	LRU = require('lru-cache');

module.exports = function (options) {

	if (!options.client || !options.secret)
		throw new Error("Redis client and secret required for jwtRedisSession!");

	options = {
		client: options.client,
		secret: options.secret,
		algorithm: options.algorithm || "HS256",
		keyspace: options.keyspace || "sess:",
		maxAge: options.maxAge || 86400,
		requestKey: options.requestKey || "session",
		requestArg: options.requestArg || "accessToken"
	};

	var sessionCache = LRU({
		max: 500,
		length: function (n, key) { return n * 2 + key.length; },
		maxAge: 1000 * 60 * 60 * 24
	});

	var sessionMethods = utils(options, sessionCache);

	var requestHeader = _.reduce(options.requestArg.split(""), function (memo, ch) {
		return memo + (ch.toUpperCase() === ch ? "-" + ch.toLowerCase() : ch);
	}, "x" + (options.requestArg.charAt(0) === options.requestArg.charAt(0).toUpperCase() ? "" : "-"));

	return function (req, res, next) {

		req[options.requestKey] = {};

		_.extend(req[options.requestKey], sessionMethods);

		var token = req.params[options.requestArg] || req.get(requestHeader) || req.query[options.requestArg] || req.cookies[options.requestArg];

		if (token) {
			jwt.verify(token, options.secret, function (error, decoded) {
				if (error || !decoded.jti)
					return next();

				var sessionData = null;
				if (!sessionCache.has(options.keyspace + decoded.jti)) {
					options.client.get(options.keyspace + decoded.jti, function (err, session) {
						if (err || !session)
							return next();

						try {
							sessionData = JSON.parse(session);
							sessionData.id = decoded.jti;
							sessionCache.set(options.keyspace + decoded.jti, sessionData);
						} catch (e) {
							return next();
						}
						continueWithSessionValidation();
					});
				} else {
					sessionData = sessionCache.get(options.keyspace + decoded.jti);
					continueWithSessionValidation();
				}

				function continueWithSessionValidation() {
					_.extend(req[options.requestKey], sessionData);
					req[options.requestKey].claims = decoded;
					req[options.requestKey].id = decoded.jti;
					req[options.requestKey].jwt = token;
					// Update the TTL
					req[options.requestKey].touch(_.noop);
					next();
				}
			});
		}else {
			next();
		}
	};

};
