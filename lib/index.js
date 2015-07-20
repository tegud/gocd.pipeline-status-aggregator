var logger = require('./logger');
var events = require('./events');
var amqp = require('./amqp');
var credentialsLoader = require('./credentials');

logger.logInfo('Starting GOCD Pipline Status Aggregator');

function handleMessage(goClient, pipelineEvent) {
	console.log('Recieved message, looking up: ' + pipelineEvent.pipeline.name + ', counter: ' + pipelineEvent.pipeline.counter);

	goClient.getPipelineInstance(pipelineEvent.pipeline.name, pipelineEvent.pipeline.counter);
}

amqp(events, logger, { 
	"host": "127.0.0.1", 
	"exchange": "river-styx", 
	"routing": "pipelineResult", 
	"queue": "pipelineResult-aggregator" 
}).start()
	.then(credentialsLoader.load)
	.then(function(credentials) {
		logger.logInfo('Startup Complete');

		var goClient = new GoClient(credentials);

		eventEmitter.on('listenerEventReceived', handleMessage.bind(undefined, goClient));
	});
