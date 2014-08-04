

var	_ = require("underscore"),
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
		maxAge: options.maxAge || 86400
	};

	var sessionMethods = utils(options);

	return function(req, res, next){

		req.session = {};

		_.extend(req.session, sessionMethods);

		console.log("req.session after methods ", req.session, typeof req.session.save);

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

					_.extend(req.session, session);
					req.session.id = decoded.iss;
					console.log("req.session after getting redis data ", req.session);

					req.session.touch(); // update the TTL
					next();
				});
			});
		}else{
			next(); 
		}
	};

};
