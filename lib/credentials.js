var fs = require('fs');
var Promise = require('bluebird');

module.exports = function() {
	return {
		load: function() {
			return Promise(function(resolve, reject) {
				fs.readFile(__dirname + '/../credentials.json', 'utf-8', function(err, data) {
					if(err) {
						return reject(err);
					}

					resolve(JSON.parse(data));
				})
			});
		}
	};
};
