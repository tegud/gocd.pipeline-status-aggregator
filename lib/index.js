var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var http = require('http');
var logger = require('./logger');
var eventEmitter = require('./events');
var amqpListener = require('./amqp');
var amqpPublisher = require('./amqpPublisher');
var credentialsLoader = require('./config');
var GoClient = require('./gocd');
var TeamConfiguration = require('./teamConfiguration')
var handlers = require('./eventHandlers');

logger.logInfo('Starting GOCD Pipline Status Aggregator');

var publisher = new amqpPublisher(logger, { 
	"host": "127.0.0.1", 
	"exchange": "river-styx"
});

function handleMessage(goClient, teams, event) {
	handlers
		.handle(event.type, goClient, teams, event)
		.catch(function(exception) {
			logger.logError('Error whilst handling event: ' + exception.message, { handler: event.type });
		});
}

eventEmitter.on('river_styx_event', function(event) {
	publisher.publish(event.type, _.merge(event, {
    	origin: 'pentlrges03'
	}));
});

new credentialsLoader().load()
	.then(function(config) {
		return new Promise(function(resolve, reject) {
			logger.logInfo('Startup Complete');

			var goClient = new GoClient({
				host: 'go.laterooms.com',
				port: 8153
			}, config.credentials);
			var teams = new TeamConfiguration(config.teams);

			resolve(handleMessage.bind(undefined, goClient, teams));
		});
	})
	.then(function(handleMessage) {
		return new amqpListener(handleMessage, logger, { 
			"host": "127.0.0.1", 
			"exchange": "river-styx", 
			"routing": "pipelineResult", 
			"queue": "pipelineResult-aggregator" 
		}).start();
	})
	.then(function() {
		return publisher.start();
	});
