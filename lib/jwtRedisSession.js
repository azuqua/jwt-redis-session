

var	_ = require("lodash"),
	jwt = require("jsonwebtoken"),
	utils = require("./utils");

module.exports = function(options){

	if(!options.client || !options.secret)
		throw new Error("Redis client and secret required for jwtRedisSession!");

	options = {
		client: options.client,
		secret: options.secret,
		algorithm: options.algorithm || "HS256",
		keyspace: options.keyspace || "sess:",
		maxAge: options.maxAge || 86400,
		requestKey: options.requestKey || "session"
	};

	var sessionMethods = utils(options);

	return function(req, res, next){

		req[options.requestKey] = {};

		_.extend(req[options.requestKey], sessionMethods);

		var token = (req.body && req.body.accessToken) 
			|| (req.query && req.query.accessToken) 
			|| req.get("x-access-token");

		if(token){
			jwt.verify(token, options.secret, function(error, decoded){
				if(error || !decoded.iss)
					return next();

				options.client.get(options.keyspace + decoded.iss, function(err, session){
					if(err || !session)
						return next(); 

					try{
						session = JSON.parse(session);
					}catch(e){
						return next();
					}

					_.extend(req[options.requestKey], session);
					req[options.requestKey].claims = decoded;
					req[options.requestKey].id = decoded.iss;
					req[options.requestKey].jwt = token;
					req[options.requestKey].touch(); // update the TTL
					next();
				});
			});
		}else{
			next(); 
		}
	};

};
