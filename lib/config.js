var fs = require('fs');
var Promise = require('bluebird');

function loadTeams() {
	return new Promise(function(resolve, reject) {
		fs.readFile(__dirname + '/../teams.json', 'utf-8', function(err, data) {
			if(err) {
				return reject(err);
			}

			resolve(JSON.parse(data));
		})
	});
}

function loadCredentials() {
	return new Promise(function(resolve, reject) {
		fs.readFile(__dirname + '/../credentials.json', 'utf-8', function(err, data) {
			if(err) {
				return reject(err);
			}

			resolve(JSON.parse(data));
		})
	});
}

module.exports = function() {
	return {
		load: function() {
			return Promise.all([
					loadTeams(),
					loadCredentials()
				]).then(function(results) {
				return new Promise(function(resolve, reject) {
					resolve({
						teams: teams[0],
						credentials: credentials[1]
					});
				})
			});
		}
	};
};
