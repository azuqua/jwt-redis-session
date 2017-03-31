

var	_ = require("lodash"),
	jwt = require("jsonwebtoken"),
	debug = require("debug")("jwt-redis-session"),
	utils = require("./utils");

module.exports = function(options){

	if(!options.client || !options.secret)
		throw new Error("Redis client and secret required for JWT Redis Session!");

	options.keepRequestArgHeader = !!options.keepRequestArgHeader;
	options.useCookies = !!options.useCookies;

	options = _.defaults(options, {
		algorithm: "HS256",
		keyspace: "sess:",
		maxAge: 86400,
		requestKey: "session",
		requestArg: "accessToken",
		tokenKey: "jwt",
		keepRequestArgHeader: false,
		useCookies: false
	});

	var requestHeader, SessionUtils = utils(options);

	if(options.keepRequestArgHeader){
		requestHeader = options.requestArg;
	}else{
		requestHeader = _.reduce(options.requestArg.split(""), function(memo, ch){
			return memo + (ch.toUpperCase() === ch ? "-" + ch.toLowerCase() : ch);
		}, "x" + (options.requestArg.charAt(0) === options.requestArg.charAt(0).toUpperCase() ? "" : "-"));
	}

	return function jwtRedisSession(req, res, next){

		req[options.requestKey] = new SessionUtils();

		var token = req.get(requestHeader)
			|| req.query[options.requestArg] 
			|| (req.body && req.body[options.requestArg]);

		if(!token && options.useCookies){
			token = req.cookies[options.requestArg];
		}

		if(token){
			debug("Verifying JWT", token);

			jwt.verify(token, options.secret, function(error, decoded){
				if(error || !decoded.jti)
					return next();

				debug("Verfied JWT", token);

				options.client.get(options.keyspace + decoded.jti, function(err, session){
					if(err || !session)
						return next(); 

					try{
						session = JSON.parse(session);
					}catch(e){
						return next();
					}

					debug("Found JWT session", token, session);

					_.extend(req[options.requestKey], session);
					req[options.requestKey].claims = decoded;
					req[options.requestKey].id = decoded.jti;
					req[options.requestKey][options.tokenKey] = token;
					// Update the TTL
					req[options.requestKey].touch(_.noop);
					next();
				});
			});
		}else{
			next(); 
		}
	};

};
