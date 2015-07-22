var _ = require('lodash');

module.exports = function (teams) {
	return {
		findTeamFromGroupOrPipeline: function(group, pipeline) {
			return _.chain(teams).filter(function(team) {
				return _.contains(team.groups, group);
			}).first().value();
		}
	};
};
