
var RestJS = require("restjs"),
	_ = require("lodash");

if(RestJS.Rest)
	RestJS = RestJS.Rest;

var serializeArray = function(array, prefix){
	var idx, out = [];
	for(idx in array){
		var formatted = (prefix ? prefix : "") + "[]";
		if(prefix && typeof array[idx] === "object")
			formatted = formatted.replace(/\[\]$/i, "[" + idx + "]");
		if(typeof array[idx] === "object" && JSON.stringify(array[idx]) === "{}"){
			continue;
		}
		if(array[idx] instanceof Array)
			out.push(serializeArray(array[idx], formatted));
		else if(typeof array[idx] === "object")
			out.push(serializeObject(array[idx], formatted));
		else
			out.push(encodeURIComponent(formatted) + "=" + encodeURIComponent(array[idx]));
	}
	return out.join("&");
};

var serializeObject = function(obj, prefix) {
	var key, out = [];
	for(key in obj){
		var formatted = prefix ? prefix + "[" + key + "]" : key;
		if(obj[key] instanceof Array){
			if(obj[key].length < 1)
				continue;
			out.push(serializeArray(obj[key], formatted));
		}else if(typeof obj[key] === "object"){
			if(JSON.stringify(obj[key]) === "{}")
				continue;
			out.push(serializeObject(obj[key], formatted));
		}else{
			out.push(encodeURIComponent(formatted) + "=" + encodeURIComponent(obj[key]));
		}
	}
	return out.join("&");
};

var client = new RestJS({ protocol: "http" });

module.exports = function(options, data, callback){
	options = {
		host: options.host || "127.0.0.1",
		port: options.port || 8000,
		method: options.method || "get",
		path: options.path,
		headers: options.headers || {}
	};
	if(options.method.toLowerCase() === "post"){
		data = JSON.stringify(data);
		options.headers = _.extend(options.headers, {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(data)
		});
	}else if(options.method.toLowerCase() === "get" && data && Object.keys(data).length > 0){
		options.path += (options.path.indexOf("?") > -1 ? "&" : "?") + serializeObject(data);
		data = null;
	}
	// server always responds with JSON for these tests
	client.request(options, data, function(error, resp){
		if(error){
			callback(error);
		}else{
			try{
				resp = JSON.parse(resp.body);
			}catch(e){
				return callback(resp.body);
			}
			callback(null, resp);
		}
	});
};
