var fs = require('fs');

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

module.exports = function() {
	return {
		load: function() {
			return loadTeams()
				.then(function(results) {
					return new Promise(function(resolve, reject) {
						resolve({
							teams: results[0],
							credentials: results[1]
						});
					})
				});
		}
	};
};
