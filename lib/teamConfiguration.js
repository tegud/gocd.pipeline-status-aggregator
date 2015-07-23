var _ = require('lodash');

module.exports = function (config) {
	var teams = config.teams;
	var teamNameLookup = _.reduce(teams, function(teamLookup, team, index) {
		teamLookup[team.name] = index;
	}, {});

	function getEnvironment(environments, group, pipeline) {
		var matchedEnvironment = _.find(environments, function(environment) {
			return _.find(environment.pipelines, function(pipelineRegex) {
				return new RegExp(pipelineRegex, "i").exec(pipeline);
			});
		});

		if(matchedEnvironment) {
			return matchedEnvironment;
		}

		matchedEnvironment = _.find(environments, function(environment) {
			return _.find(environment.groups, function(groupRegex) {
				return new RegExp(groupRegex, "i").exec(group);
			});
		});
	}

	function getEnvironmentFromDefaults(group, pipeline) {
		return getEnvironment(config.defaultEnvironments, group, pipeline);
	}

	return {
		findTeamFromGroupOrPipeline: function(group, pipeline) {
			var matchingTeam = _.chain(teams).filter(function(team) {
				return _.contains(team.groups, group);
			}).first().value();

			if(!matchingTeam) {
				return;
			}

			return matchingTeam.name;
		},
		getEnvironmentForTeam: function (teamName, group, pipeline) {
			var team = teams[teamNameLookup[teamName]];

			if(!team) {
				return getEnvironmentFromDefaults(group, pipeline);
			}

			var matchedEnvironment = getEnvironment(team.environments, group, pipeline);

			if(matchedEnvironment) {
				return matchedEnvironment;
			}

			return getEnvironmentFromDefaults(group, pipeline);
		}
	};
};
