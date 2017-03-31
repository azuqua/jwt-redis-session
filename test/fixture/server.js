
var	http = require("http"),
	express = require("express"),
	bodyParser = require("body-parser"),
	_ = require("lodash"),
	redis = require("fakeredis");

var redisClient, client, app, server;

module.exports = {

	addRoute: function(path, method, callback){
		callback.name = callback.name;
		app[method](path, callback);
	},

	removeRoute: function(path, method){
		app._router.stack = _.reject(app._router.stack, function(route){
			return route.route && route.route.path === path 
				&& (method ? route.route.methods[method] : true);
		});
	},

	inspect: function(callback){
		return {
			app: app,
			client: client,
			server: server
		};
	},

	start: function(log, setup, callback){
		if(redisClient){
			client = redisClient;
		}else{
			client = redis.createClient(
				process.env.REDIS_PORT || 6379,
				process.env.REDIS_HOST || "127.0.0.1"
			);
			redisClient = client;
		}

		app = express();

		app.use(bodyParser.urlencoded({ extended: false }));
		app.use(bodyParser.json());

		setup(app, client, function(port){

			port = port ? port : 8000;

			server = http.createServer(app);
			server.listen(port, callback);

		});

	},

	end: function(callback){
		server.close(callback);
	}

};

