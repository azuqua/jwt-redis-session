

var	_ = require("lodash"),
	jwt = require("jsonwebtoken"),
	utils = require("./utils");

module.exports = function(options){

	if(!options.client || !options.secret)
		throw new Error("Redis client and secret required for JWT Redis Session!");

	options = {
		client: options.client,
		secret: options.secret,
		algorithm: options.algorithm || "HS256",
		keyspace: options.keyspace || "sess:",
		maxAge: options.maxAge || 86400,
		requestKey: options.requestKey || "session",
		requestArg: options.requestArg || "accessToken"
	};

	var SessionUtils = utils(options);

	var requestHeader = _.reduce(options.requestArg.split(""), function(memo, ch){
		return memo + (ch.toUpperCase() === ch ? "-" + ch.toLowerCase() : ch);
	}, "x" + (options.requestArg.charAt(0) === options.requestArg.charAt(0).toUpperCase() ? "" : "-"));

	return function jwtRedisSession(req, res, next){

		req[options.requestKey] = new SessionUtils();

		var token = req.get(requestHeader)
			|| req.query[options.requestArg] 
			|| (req.body && req.body[options.requestArg]);

		if(token){
			jwt.verify(token, options.secret, function(error, decoded){
				if(error || !decoded.jti)
					return next();

				options.client.get(options.keyspace + decoded.jti, function(err, session){
					if(err || !session)
						return next(); 

					try{
						session = JSON.parse(session);
					}catch(e){
						return next();
					}

					_.extend(req[options.requestKey], session);
					req[options.requestKey].claims = decoded;
					req[options.requestKey].id = decoded.jti;
					req[options.requestKey].jwt = token;
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
