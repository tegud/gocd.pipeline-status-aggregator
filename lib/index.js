var logger = require('./logger');
var eventEmitter = require('./events');
var amqp = require('./amqp');
var credentialsLoader = require('./credentials');
var GoClient = require('./gocd');

logger.logInfo('Starting GOCD Pipline Status Aggregator');

function handleMessage(goClient, pipelineEvent) {
	console.log('Recieved message, looking up: ' + pipelineEvent.pipeline.name + ', counter: ' + pipelineEvent.pipeline.counter);

	goClient.getPipelineInstance(pipelineEvent.pipeline.name, pipelineEvent.pipeline.counter);
}

new credentialsLoader().load()
	.then(function(credentials) {
		return new Promise(function(resolve, reject) {
			logger.logInfo('Startup Complete');

			resolve(new GoClient(credentials));
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
