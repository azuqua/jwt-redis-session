JWT-Redis-Session
=================

JSON Web Token session middleware backed by [Redis](http://redis.io/). This connect middleware module exposes an API surface similar to a [session middleware](https://github.com/expressjs/session#reqsession) module, however instead of using cookies to transport session details this module uses JSON Web Tokens. This is useful for cookie-less clients or for cross service user authentication. 

[Some info on JSON Web Tokens](http://tools.ietf.org/html/draft-ietf-oauth-json-web-token-19#section-3)

# Install

	npm install jwt-redis-session

# Important Notes

Developers are free to use either the JWT claims or redis to store session related data. In many cases when serializing a user's session only the minimal amount of data necessary to uniquely identify the user's session is actually serialized and sent to the client. By default when this module creates a JWT token it will only reserve the "jti" property on the JWT claims object. This property will refer to a UUID that acts as the key in redis for the user's session data. This ensures that by default this module will only serialize the minimal amount of data needed. Any other data stored on the JWT session object throughout the request-response process will be serialized and stored in redis. 

Due to the way JSON Web Tokens work the claims object can only be modified when creating a new token. Because of this by default this module does not attach a TTL to the JWT. Any TTL attached to the JWT cannot be refreshed without regenerating a new JWT so this module instead manages a session's expiration via redis key expirations. Aside from the "jti" property, which this module reserves, developers are free to attach any data to the claims object when creating a new JWT, including a TTL, but need to be aware that any TTL on the claims object will supercede the TTL managed by redis. 

# API Overview

## Initialization

This module supports a few initialization parameters that can be used to support several usage scenarios, including running any number of instances of this middleware module alongside each other.

* **requestKey** - The key name on the request object used to identify the JWT session object. The default for this value is "session". This would interfere with a module such as [express-session](https://github.com/expressjs/session) so developers are free to modify this.
* **requestArg** - The parameter name on the HTTP request that refers to the JWT. The middleware will look for this property in the query string, request body, and headers. The header name will be derived from a camelBack representation of the property name. For example, if the requestArg is "accessToken" (the default) then this instance of the middlware will look for the header name "x-access-token". 
* **keyspace** - The prefix of the keys stored in redis. By default this is "sess:".
* **secret** - The secret key used to encrypt token data.
* **algorithm** - The hashing algorithm to use, the default is "HS256" (SHA-256).
* **client** - The redis client to use to perform redis commands.
* **maxAge** - The maximum age (in seconds) of a session. 

```
var JWTRedisSession = require("jwt-redis-session"),
	express = require("express"),
	redis = require("redis");

var redisClient = redis.createClient(),
	secret = generateSecretKeySomehow(),
	app = express();

app.use(JWTRedisSession({
	client: redisClient,
	secret: secret,
	keyspace: "sess:", 
	maxAge: 86400,
	algorithm: "HS256",
	requestKey: "jwtSession",
	requestArg: "jwtToken"
}));
```

**All examples following this assume the above configuration.**

## Create JWT Session

Create a new JSON Web Token from the provided claims and store any relevant data in redis.

```
var handleRequest = function(req, res){
	User.login(req.param("username"), req.param("password"), function(error, user){

		// this will be stored in redis
		req.jwtSession.user = user.toJSON(); 

		// this will be attached to the JWT
		var claims = {
			iss: "my application name",
			aud: "myapplication.com"
		};

		req.jwtSession.create(claims, function(error, token){
			
			res.json({ token: token });

		});
	});
};
```

## Read JWT Data

The session's UUID, JWT claims, and the JWT itself are all available on the jwtSession object as well. Any of these properties can be used to test for the existence of a valid JWT and session.

```
var handleRequest = function(req, res){
	
	console.log("Request JWT session data: ", 
		req.jwtSession.id, 
		req.jwtSession.claims, 
		req.jwtSession.jwt
	);

	res.json(req.jwtSession.toJSON());

};
```

## Modify Session Data

Any modifications to the jwtSession will be reflected in redis.

```
var handleRequest = function(req, res){
	
	if(req.jwtSession.id){
		
		req.jwtSession.foo = "bar";

		req.jwtSession.update(function(error){
			res.json(req.jwtSession.toJSON());
		});

	}else{
		res.redirect("/login");
	}
};
```

## Reload Session Data

Force a reload of the session data from redis.

```
var handleRequest = function(req, res){
	
	setTimeout(function(){

		req.jwtSession.reload(function(error){
			res.json(req.jwtSession.toJSON());
		});

	}, 5000);

};
```

## Refresh the TTL on a Session

```
var handleRequest = function(req, res){
	
	req.jwtSession.touch(function(error){
		res.json(req.jwtSession.toJSON());
	});

};
```

## Destroy a Session

Remove the session data from redis. The user's JWT may still be valid within its expiration window, but the backing data in redis will no longer exist. This module will not recognize the JWT when this is the case.

```
var handleRequest = function(req, res){
	
	req.jwtSession.destroy(function(error){
		res.redirect("/login");
	});
	
};
```

# Tests

This module uses Mocha/Chai for testing. In order to run the tests a local redis server must be running or the REDIS_HOST and REDIS_PORT environment variables must be set.

	npm install
	grunt test
