JWT-Redis-Session
=================

<p>
JSON Web Tokens backed by Redis. This module exposes almost the same <a href="https://github.com/expressjs/session#reqsession">API surface as a generic express 4.x session middleware module</a> with a few changes.
</p> 
<p>
Since cookies are not used with JSON Web Tokens the transmition of the session ID via the JWT can no longer be transparently handled by the middleware. This means that the API surface for the session object must differ slighly from what one would find on <a href="https://github.com/expressjs/session">express-session</a>. Instead of calling req.session.save() to commit session changes as one would with express-session, this module requires that the application developer distinguish between creation and update commands. The difference between the two is that create() will generate a new session with a new ID and JWT while update() will check for and use session ID already on req.session. After being issued a JWT the client will need to send the token with each subsequent request. It can be attached to the request as a part of the body, query string, or headers. In the case of the body or query string the token will be looked up by the key "accessToken". If the token is sent in the headers it will be queried by the name "x-access-token". See below for examples.
</p>
Usage
=====

<pre>
	
	// ... create your express app object elsewhere
	// ... create a redis client elsewhere with auth, etc
	// ... generate or require a secret key elsewhere

	var JWTRedisSession = require("jwt-redis-session");

	app.use(JWTRedisSession({
		client: redisClient,
		secret: secret,
		keyspace: "sess:", // this is the default if not specified
		maxAge: 86400, // session TTL in seconds, this is the default
		algorithm: "HS256" // hashing algorithm to use, this is the default (SHA-256)
	}));

	// create a few CRUD routes on the app to demonstrate session usage
	
	app.get("/session/create", function(req, res){
	
		// check the user's credentials somehow...
		User.login(req.param("username"), req.param("password"), function(error, user){
			if(error)
				return res.status(500).json({ error: error.message || error });
			
			// create a session and send the user their JWT
			req.session.user = user;
			req.session.create(function(err, token){
				if(err)
					res.status(500).json({ error: err.message || err });	
				else
					res.status(200).json({ token: token });
			});	

		});

	});
	
	app.get("/session/read", function(req, res){

		// use the existence of an "id" property on the session to determine if a session exists
		if(req.session.id)
			console.log("Session found!", req.session);
		else
			console.log("Request does not have a session");
		

		// maybe the application is distributed across multiple server instances
		// and another instance does something to the session while this request is waiting...
		
		setTimeout(function(){

			// force a reload of the session from redis
			req.session.reload(function(error){
				if(error)
					res.status(500).json({ error: error.message || error });
				else
					res.json({ session: req.session });
			});

		}, 10000);

	});

	app.get("/session/update", function(req, res){
	
		req.session.foo = "bar";

		// commit the session changes to redis
		req.session.update(function(error){
			if(error)
				res.status(500).json({ error: error.message || error });
			else
				res.json({ session: req.session });
		});

	});

	app.get("/session/destroy", function(req, res){
	
		// the user's JWT will no longer be associated with their session
		req.session.destroy(function(error){
			if(error)
				res.status(500).json({ error: error.message || error });
			else
				res.end();
		});

	});

</pre>
