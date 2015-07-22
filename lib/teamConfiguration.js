var _ = require('lodash');

module.exports = function (teams) {
	return {
		findTeamFromGroupOrPipeline: function(group, pipeline) {
			var matchingTeam = _.chain(teams).filter(function(team) {
				return _.contains(team.groups, group);
			}).first().value();

			if(!matchingTeam) {
				return;
			}

			return matchingTeam.name;
		}
	};
};
