var expect = require('expect.js');
var TeamConfiguration = require('../lib/teamConfiguration');

describe('Team Configuration', function() {
	describe('findTeamFromGroupOrPipeline', function() {
		it('gets team from matching group name', function() {
			var teamConfiguration = new TeamConfiguration({
				"teams": [
					{
						"name": "HotelDistribution",
						"groups": ["^Hotel\\-Distribution"],
						"environments": [
							{ "environment": "live-accuracy-test", "pipelines": ["^Internal\\.GLR\\-Live\\-Accuracy\\-Tests$"] }
						]
					}
				]
			});

			expect(teamConfiguration.findTeamFromGroupOrPipeline('Hotel-Distribution-Production', '')).to.be('HotelDistribution');
		});	

	});
});
