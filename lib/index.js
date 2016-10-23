var _ = require('lodash');
var moment = require('moment');
var http = require('http');
var logger = require('./logger');
var credentialsLoader = require('./config');
var GoClient = require('./gocd');
var TeamConfiguration = require('./teamConfiguration')
var handlers = require('./eventHandlers');

const core = require('./core');

module.exports = function() {
	function start() {
	    return new Promise(resolve => resolve(core.logging.logInfo('Starting GOCD River Styx Aggregator')));
	}

	let goClients;

	return {
		start: () => start()
            .then(() => core.logging.setLogger(require('./logger')))
            .then(() => core.config.setDefault({
                "http-server": { "port": 1234 }
            }))
			.then(() => core.use('rs-http-server', 'rs-amqp-listener', 'rs-amqp-publisher'))
            .then(() => core.config.setMapToModules(config => new Promise(resolve => {
                const mappedConfig = {
                    'http-server': [{ module: 'http-server', port: config['http-server'].port }],
					'amqp-publisher': [{ module: "amqp-publisher", "name": "river_styx", host: config.river_styx.host, exchange: config.river_styx.exchange }],
					'amqp-listener': [{ module: "amqp-listener", "name": "river_styx", host: config.river_styx.host, exchange: config.river_styx.exchange, queue: config.river_styx.queue }]
                };

				goClients = config['go-servers'].reduce((goClients, current) => {
					goClients[current.name] = new GoClient({
						host: current.host,
						port: current.httpPort
					}, {
						username: current.username,
						password: current.password
					});

					return goClients;
				}, {});

                resolve(mappedConfig);
            })))
            .then(() => core.start())
			.then(() => new credentialsLoader().load())
			.then(config => {
				return new Promise(function(resolve, reject) {
					const teams = new TeamConfiguration(config.teams);

					core.events.on('message-in', message => {
						const event = message.data;

						handlers
							.handle(event.type, goClients, teams, event)
							.catch(function(exception) {
								logger.logError('Error whilst handling event: ' + exception.message, { handler: event.type });
							});
					});

					core.logging.logInfo('Completed Start up');
				});
			})
            .catch(err => core.logging.logError('Start up failed', { error: err }))
	};
};
