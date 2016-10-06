

var path = require("path"),
	_ = require("lodash"),
	async = require("async"),
	assert = require("chai").assert,
	JWT = require("../index"),
	server = require(path.join(__dirname, "fixture/server")),
	request = require(path.join(__dirname, "fixture/client"));


describe("JWT Redis Session Tests", function(){

	describe("Default JWT usage tests", function(){

		var token = null;

		before(function(done){
			server.start(console.log, function(app, redisClient, callback){
				app.use(JWT({
					client: redisClient,
					secret: "abc123"
				}));
				callback(8000);
			}, done);
		});

		after(function(done){
			server.inspect().client.quit();
			server.end(done);
		});

		it("Should expose session methods to the application", function(done){

			// hmm, setting a name on the function the "normal" way doesnt work...
			var handler = function handler(req, res){
				assert.isObject(req.session, "Request session is an object");
				assert.isFunction(req.session.create, "Session has create function");
				assert.isFunction(req.session.touch, "Session has touch function");
				assert.isFunction(req.session.reload, "Session has reload function");
				assert.isFunction(req.session.update, "Session has update function");
				assert.isFunction(req.session.destroy, "Session has destroy function");
				assert.isFunction(req.session.toJSON, "Session has toJSON function");
				res.json({});
			};

			server.addRoute("/ping", "get", handler);
			request({ path: "/ping", method: "get" }, null, function(error, resp){
				assert.notOk(error, "Ping does not return an error");
				assert.isObject(resp, "Ping response is an object");
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to create a new JWT session", function(done){
			
			var handler = function handler(req, res){
				req.session.create(function(error, token){
					assert.isString(token, "Token is a string");
					assert.notOk(error, "Error is null when creating token");
					res.json({ token: token });
				});
			};

			server.addRoute("/login", "get", handler);
			request({ method: "get", path: "/login" }, null, function(error, resp){
				assert.notOk(error, "Token creation did not return an error");
				assert.isObject(resp, "Response is an object");
				assert.property(resp, "token", "Response contains a token property");
				assert.isString(resp.token, "Token is a string");
				token = resp.token;
				server.removeRoute("/login", "get");
				done();
			});

		});

		it("Should look for the JWT in the query, body, and headers", function(done){

			var handler = function handler(req, res){
				assert.isString(req.session.id, "Session has an ID");
				assert.isString(req.session.jwt, "Session has a JWT");
				res.json({});
			};

			server.addRoute("/ping", "all", handler);

			var testResponse = function(error, resp, callback){
				assert.notOk(error, "No error thrown");
				assert.isObject(resp, "Response is an object");
				assert.deepEqual(resp, {}, "Response is a blank object");
				callback(error);
			};

			async.series([
				function(callback){
					request(
						{ method: "get", path: "/ping" }, 
						{ accessToken: token }, 
						_.partialRight(testResponse, callback)
					);
				},
				function(callback){
					request(
						{ method: "post", path: "/ping" }, 
						{ accessToken: token },
						_.partialRight(testResponse, callback)
					);
				},
				function(callback){
					request(
						{ 
							method: "get", 
							path: "/ping",
							headers: {
								"x-access-token": token
							}
						}, 
						null,
						_.partialRight(testResponse, callback)
					);
				}
			], function(error){
				assert.notOk(error, "Async series did not return an error");
				server.removeRoute("/ping");
				done();
			});
		});

		it("Should expose the correct data to the application", function(done){

			var handler = function handler(req, res){
				assert.isString(req.session.id, "Session has an ID");
				assert.isString(req.session.jwt, "Session has a JWT");
				assert.isObject(req.session.claims, "Session has a claims object");
				res.json({});
			};

			server.addRoute("/ping", "get", handler);
			request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
				assert.notOk(error, "Ping did not return an error");
				assert.isObject(resp, "Ping response is an object");
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to update and reload a session", function(done){

			var handler = function handler(req, res){
				req.session.foo = "bar";
				req.session.update(function(error){
					assert.notOk(error, "No error when updating session");
					req.session.reload(function(err){
						assert.notOk(err, "No error when reloading session");
						assert.property(req.session, "foo", "Session has new foo property");
						res.json(req.session.toJSON());
					});
				});
			};

			server.addRoute("/ping", "get", handler);
			request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
				assert.notOk(error, "Ping did not return an error");
				assert.isObject(resp, "Ping response is an object");
				assert.property(resp, "foo", "Response has new foo property");
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to manually update the TTL on the session", function(done){

			var handler = function handler(req, res){
				req.session.touch(function(error){
					assert.notOk(error, "No error when updating TTL on session");
					res.json({});
				});
			};

			server.addRoute("/ping", "get", handler);
			request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
				assert.notOk(error, "Ping did not return an error");
				assert.isObject(resp, "Ping response is an object");
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to serialize a session", function(done){

			var session = { name: "Don Draper", realName: "Richard Witman" };

			var handler = function handler(req, res){
				_.extend(req.session, session);
				req.session.update(function(error){
					assert.notOk(error, "No error when updating session");
					res.json(req.session.toJSON());
				});
			};

			server.addRoute("/ping", "get", handler);
			request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
				assert.notOk(error, "Ping did not return an error");
				assert.isObject(resp, "Ping response is an object");
				_.each(session, function(val, key){
					assert.property(resp, key, "Response contains key for session property");
					assert.equal(resp[key], session[key], "Response has correct value for key");
				});
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to destroy a session", function(done){

			var handler1 = function handler1(req, res){
				req.session.destroy(function(error){
					assert.notOk(error, "Destroy did not return an error");
					res.json({});
				});
			};
			var handler2 = function handler2(req, res){
				assert.notOk(req.session.id, "Session does not have an ID");
				assert.notOk(req.session.jwt, "Session does not have a JWT");
				res.json(req.session.toJSON());
			};

			server.addRoute("/destroy", "get", handler1);
			server.addRoute("/ping", "get", handler2);

			async.series([
				function(callback){
					request({ method: "get", path: "/destroy" }, { accessToken: token }, function(error, resp){
						assert.notOk(error, "Destroy call did not return an error");
						assert.isObject(resp, "Destroy call returned an object");
						callback(error);
					});
				},
				function(callback){
					request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
						assert.notOk(error, "Ping did not return an error");
						assert.isObject(resp, "Ping returned an object");
						assert.deepEqual(resp, {}, "Ping returned a blank object");
						callback(error);
					});
				}
			], function(error){
				assert.notOk(error, "Async series did not return an error");
				server.removeRoute("/destroy", "get");
				server.removeRoute("/ping", "get");
				done();
			});

		});

	});

	describe("Custom JWT usage tests", function(){

		var customClaims = { foo: "bar" },
			customRequestKey = "jwtSession",
			customArg = "fancyAccessToken",
			customRedisKeyspace = "jwt:";

		var token = null;

		before(function(done){
			server.start(console.log, function(app, redisClient, callback){
				app.use(JWT({
					client: redisClient,
					secret: "abc123",
					requestKey: customRequestKey,
					keyspace: customRedisKeyspace
				}));
				callback(8000);
			}, done);
		});

		after(function(done){
			server.inspect().client.quit();
			server.end(done);
		});

		it("Should allow for a custom requestKey", function(done){
			
			var handler = function handler(req, res){
				assert.property(req, customRequestKey, "Request has custom requestKey property");
				assert.isObject(req[customRequestKey], "Request has custom requestKey object");
				res.json({});
			};

			server.addRoute("/ping", "get", handler);
			request({ method: "get", path: "/ping" }, null, function(error, resp){
				assert.notOk(error, "Ping did not return an error");
				assert.isObject(resp, "Ping returned an object");
				server.removeRoute("/ping", "get");
				done();
			});

		});

		it("Should allow the user to attach custom claims", function(done){

			var claims = {
				frodo: "baggins",
				bilbo: "baggins"
			};

			var handler1 = function handler1(req, res){
				req[customRequestKey].create(claims, function(error, token){
					assert.isString(token, "Token is a string");
					assert.notOk(error, "Error is null when creating token");
					res.json({ token: token });
				});
			};
			var handler2 = function handler2(req, res){
				assert.isObject(req[customRequestKey], "Request object has JWT object");
				assert.isObject(req[customRequestKey].claims, "Request object has JWT claims object");
				_.each(claims, function(val, key){
					assert.ok(req[customRequestKey].claims[key], "Request claims key matches original claims");
					assert.equal(req[customRequestKey].claims[key], val, "Request claims value matches orignal claims value");
				});
				res.json({});
			};

			server.addRoute("/login", "get", handler1);
			server.addRoute("/ping", "get", handler2);

			async.series([
				function(callback){
					request({ method: "get", path: "/login" }, null, function(error, resp){
						assert.notOk(error, "Token creation did not return an error");
						assert.isObject(resp, "Response is an object");
						assert.property(resp, "token", "Response contains a token property");
						assert.isString(resp.token, "Token is a string");
						token = resp.token;
						callback(error);
					});
				},
				function(callback){
					request({ method: "get", path: "/ping" }, { accessToken: token }, function(error, resp){
						assert.notOk(error, "Ping did not return an error");
						assert.isObject(resp, "Ping returned an object");
						callback(error);
					});
				}
			], function(error){
				assert.notOk(error, "Async series did not return error");
				server.removeRoute("/ping", "get");
				server.removeRoute("/login", "get");
				done();
			});

		});

		it("Should allow the user to use a custom request argument name", function(done){

			var testResponse = function(error, resp, callback){
				assert.notOk(error, "No error thrown");
				assert.isObject(resp, "Response is an object");
				assert.deepEqual(resp, {}, "Response is a blank object");
				callback(error);
			};

			var restartServer = function(options, callback){
				server.inspect().client.quit();
				server.end(function(){
					server.start(console.log, function(app, redisClient, cb){
						options.client = redisClient;
						app.use(JWT(options));
						cb(8000);
					}, callback);
				});
			};

			var testData = {};

			var handler1 = function handler1(req, res){
				req.session.create(function(error, token){
					assert.isString(token, "Token is a string");
					assert.notOk(error, "Error is null when creating token");
					res.json({ token: token });
				});
			};
			var handler2 = function handler2(req, res){
				assert.isObject(req.session, "Request object has JWT object");
				assert.isString(req.session.jwt, "Request object found the token");
				res.json({});
			};

			async.series([ 
				function(callback){
					restartServer({
						secret: "abc123",
						requestArg: customArg
					}, callback);
				},
				function(callback){
					server.addRoute("/login", "get", handler1);	
					server.addRoute("/ping", "all", handler2);
					callback();
				},
				function(callback){
					request({ method: "get", path: "/login" }, null, function(error, resp){
						assert.notOk(error, "Token creation did not return an error");
						assert.isObject(resp, "Response is an object");
						assert.property(resp, "token", "Response contains a token property");
						assert.isString(resp.token, "Token is a string");
						token = resp.token;
						testData[customArg] = token;
						callback(error);
					});
				},
				function(callback){
					request({ method: "get", path: "/ping" }, testData, _.partialRight(testResponse, callback));
				},
				function(callback){
					request({ method: "post", path: "/ping" }, testData, _.partialRight(testResponse, callback));
				},
				function(callback){
					request({ 
							method: "get", 
							path: "/ping",
							headers: { "x-fancy-access-token": token }
						}, 
						null,
						_.partialRight(testResponse, callback)
					);
				}
			], function(error){
				assert.notOk(error, "Async waterfall did not return an error");
				server.removeRoute("/login", "get");
				server.removeRoute("/ping");
				restartServer({
					secret: "abc123",
					requestKey: customRequestKey,
					keyspace: customRedisKeyspace
				}, done);
			});

		});

	});

});
