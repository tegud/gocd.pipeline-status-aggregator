var logger = require('./logger');
var eventEmitter = require('./events');
var amqp = require('./amqp');
var credentialsLoader = require('./credentials');
var GoClient = require('./gocd');
var Promise = require('bluebird');

logger.logInfo('Starting GOCD Pipline Status Aggregator');

function handleMessage(goClient, pipelineEvent) {
	var pipelineStatusUpdate = pipelineEvent.result;

	if(pipelineEvent.type !== 'pipelineResult') {
		return;
	}

	console.log('Recieved message, looking up: ' + pipelineStatusUpdate.pipeline.name + ', counter: ' + pipelineStatusUpdate.pipeline.counter);

	goClient.getPipelineInstance(pipelineStatusUpdate.pipeline.name, pipelineStatusUpdate.pipeline.counter);
}

new credentialsLoader().load()
	.then(function(credentials) {
		return new Promise(function(resolve, reject) {
			logger.logInfo('Startup Complete');

			resolve(new GoClient({
				host: 'go.laterooms.com',
				port: 8153
			}, credentials));
		});
	})
	.then(function(goClient) {
		return amqp(handleMessage.bind(undefined, goClient), logger, { 
			"host": "127.0.0.1", 
			"exchange": "river-styx", 
			"routing": "pipelineResult", 
			"queue": "pipelineResult-aggregator" 
		}).start();
	});
