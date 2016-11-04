

var _ = require("lodash"),
	jwt = require("jsonwebtoken"),
	uuid = require("node-uuid");

var extendSession = function (session, data) {
	_.reduce(data, function (memo, val, key) {
		if (typeof val !== "function" && key !== "id")
			memo[key] = val;
		return memo;
	}, session);
};

var serializeSession = function (session) {
	return _.reduce(session, function (memo, val, key) {
		if (typeof val !== "function" && key !== "id") {
			memo[key] = val;
		}
		return memo;
	}, {});
};

// these are bound to the session
module.exports = function (options, cache) {

	return {

		// create a new session and return the jwt
		create: function (claims, callback) {
			if (typeof claims === "function" && !callback) {
				callback = claims;
				claims = {};
			}
			var self = this;
			var sid = uuid.v4();
			var token = jwt.sign(_.extend({ jti: sid }, claims || {}), options.secret, { algorithm: options.algorithm });
			var maxAge = this.maxAge || options.maxAge;
			delete this.maxAge;
			options.client.setex(options.keyspace + sid, maxAge, JSON.stringify(serializeSession(self)), function (error) {
				self.id = sid;
				cache.set(options.keyspace + sid, JSON.parse(JSON.stringify(self)));
				callback(error, token);
			});
		},

		// update the TTL on a session
		touch: function (callback) {
			if (!this.id) {
				return process.nextTick(function () {
					callback(new Error("Invalid session ID"));
				});
			}
			options.client.expire(options.keyspace + this.id, options.maxAge, callback);
		},

		// update a session's data, update the ttl
		update: function (callback) {
			if (!this.id) {
				return process.nextTick(function () {
					callback(new Error("Invalid session ID"));
				});
			}
			var maxAge = this.maxAge || options.maxAge;
			delete this.maxAge;
			options.client.setex(options.keyspace + this.id, maxAge, JSON.stringify(serializeSession(this)), callback);
			cache.set(options.keyspace + this.id, JSON.parse(JSON.stringify(this)));
		},

		// reload a session data from redis
		reload: function (callback) {
			var self = this;
			if (!this.id) {
				return process.nextTick(function () {
					callback(new Error("Invalid session ID"));
				});
			}

			options.client.get(options.keyspace + self.id, function (error, resp) {
				if (error)
					return callback(error);
				try {
					resp = JSON.parse(resp);
				}catch (e) {
					return callback(e);
				}
				extendSession(self, resp);
				callback();
			});
		},

		// destroy a session
		destroy: function (callback) {
			if (!this.id) {
				return process.nextTick(function () {
					callback(new Error("Invalid session ID"));
				});
			}
			cache.del(options.keyspace + this.id);
			options.client.del(options.keyspace + this.id, callback);
		},

		toJSON: function () {
			var jsonObj = serializeSession(this);
			jsonObj.id = this.id;
			return jsonObj;
		}

	};

};
