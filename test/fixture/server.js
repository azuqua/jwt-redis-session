
var	http = require("http"),
	express = require("express"),
	_ = require("lodash"),
	redis = require("redis");

var client, app, server;

module.exports = {

	addRoute: function(path, method, callback){
		app[method](path, callback);
	},

	removeRoute: function(path, method){
		if(method === "all"){
			_.each(app.routes, function(routes, _method){
				_.remove(routes, function(route){
					return route.path === path;
				});
			});
		}else{
			_.remove(app.routes[method], function(route){
				return route.path === path;
			});
		}
	},

	inspect: function(callback){
		return {
			app: app,
			client: client,
			server: server
		};
	},

	start: function(log, setup, callback){
		
		client = redis.createClient(
			process.env.REDIS_PORT || 6379,
			process.env.REDIS_HOST || "127.0.0.1"
		);

		client.on("error", function(e){
			log("Error with redis server!", e);
		});

		app = express();

		app.use(express.urlencoded());
		app.use(express.json());

		setup(app, client, function(port){

			app.use(app.router);

			port = port ? port : 8000;

			server = http.createServer(app);
			server.listen(port, callback);

		});

	},

	end: function(callback){
		client.end();
		server.close(callback);
	}

};

