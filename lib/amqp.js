var Promise = require('bluebird');
var amqp = require('amqp');

module.exports = function AmqpListener(handleMessage, logger, config) {
	var connection;
	var connected;

	logger = logger.forModule('AMQP');
	
	logger.logInfo('Initialising Rabbit MQ listener');

	function connectionReady(resolve, reject, connection) {
		if(connected) { 
			return;
		}

		connected = true;
		logger.logInfo('Connected to Rabbit MQ');
		logger.logInfo('Connecting to Queue to Rabbit MQ', { queue: config.queue });

		connection.queue(config.queue, { autoDelete: false }, queueReady.bind(undefined, resolve));
	}

	function queueReady(resolve, queue) {
		logger.logInfo('Connected to Queue');
		logger.logInfo('Binding Queue to exchange.', { exchange: config.exchange, routingKey: config.routing });
		queue.bind(config.exchange, config.routing);
		
		queue.subscribe({ ack: true }, messageReceived.bind(undefined, queue));

		logger.logInfo('Queue connected and bound.');

		resolve();
	}

	function messageReceived(queue, msg) {
		logger.logDebug('Message received', { msg: msg });

		if(!msg.data) {
			logger.logDebug('Message received with no data.', { msg: msg });
			return queue.shift();
		}

		handleMessage(JSON.parse(msg.data.toString('utf-8')));
		queue.shift();
	}

	function startUp(eventEmitter, resolve, reject) {
		var options = { host: config.host };

		if(config.port) {
			options.port = config.port;
		}

		var connection = amqp.createConnection(options);

		logger.logInfo('Connecting to Rabbit MQ', options);

		connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));

		connection.on('error', function(e) {
			logger.logError('Error connecting to RabbitMQ', { message: e.message });
		});

		connection.on('end', function() {
			logger.logError('Rabbit MQ connection lost');
		});
	}

	function start(eventEmitter) {
		return new Promise(startUp.bind(undefined, eventEmitter));
	}

	return {
		start: start
	};
};
