var http = require('http');
var moment = require('moment');
var Promise = require('bluebird');
var _ = require('lodash');

var logger = require('../../logger').forModule('Material Link');

module.exports = function storeMaterialLink(teams, pipelineEvent, apiResponse) {
    return new Promise(function (resolve, reject) {
        var buildCauses = pipelineEvent.result.pipeline['build-cause'];

        var baseInformation = {
            '@timestamp': pipelineEvent.result.pipeline.stage['create-time'],
            fullPath: pipelineEvent.result.pipeline.name + '/' + pipelineEvent.result.pipeline.counter + '/' + pipelineEvent.result.pipeline.stage.name + '/' + pipelineEvent.result.pipeline.stage.counter,
            pipeline: {
                group: pipelineEvent.result.pipeline.group,
                name: pipelineEvent.result.pipeline.name,
                counter: pipelineEvent.result.pipeline.counter
            },
            stage: {
                name: pipelineEvent.result.pipeline.stage.name,
                counter: pipelineEvent.result.pipeline.stage.counter
            }
        };

        function material(baseInformation, cause) {
            return _.merge({
                type: cause.material.type,
                changed: cause.changed,
                revision: cause.modifications[0].revision
            }, JSON.parse(JSON.stringify(baseInformation)));
        }

        function materialId(baseInformation, cause) {
            var id = baseInformation.fullPath + '_';

            if(cause.material.type === 'git') {
                id += cause.material['git-configuration'].url + '_';
            }

            id += cause.modifications[0].revision;

            var sanitizedId = id.replace(/[^0-9a-z]/ig, "");

            return { id: sanitizedId };
        }

        function materialConfig(baseInformation, cause) {
            var config = cause[cause.type + '-configuration'];

            return config;
        }

        function materialLag(baseInformation, cause) {
            logger.logInfo('Check if lag calculation relevant', {
                approvedBy: pipelineEvent.result.pipeline.stage['approved-by'],
                stageCounter: pipelineEvent.result.pipeline.stage.counter,
                materialChanged: cause.changed,
                willDoIt: pipelineEvent.result.pipeline.stage['approved-by'] === 'changes' && pipelineEvent.result.pipeline.stage.counter === 1 && cause.changed,
                pipelineTriggeredAt: baseInformation['@timestamp'],
                modifiedTime: cause.modifications[0]['modified-time']
            });

            if(pipelineEvent.result.pipeline.stage['approved-by'] === 'changes' && pipelineEvent.result.pipeline.stage.counter === 1 && cause.changed) {
                try {
                    logger.logInfo('Lag calculation', {
                        pipelineTriggeredAt: baseInformation['@timestamp'],
                        modifiedTime: cause.modifications[0]['modified-time'],
                        diff: moment(baseInformation['@timestamp']).diff(moment(cause.modifications[0]['modified-time']), 'ms')
                    });
                }
                catch (e) {
                    logger.logError('Lag Calculation failed', e);
                }

                return {
                    commitToTriggerInMs: moment(baseInformation['@timestamp']).diff(moment(cause.modifications[0]['modified-time']), 'ms')
                };
            }
        }

        var materialLinks = buildCauses.map(function(cause) {
            return _.merge(material(baseInformation, cause), materialId(baseInformation, cause), materialConfig(baseInformation, cause), materialLag(baseInformation, cause));
        });

        materialLinks.forEach(function(materialLink) {
            var request =  http.request({
                host: 'logs.laterooms.com',
                port: 9200,
                path: '/releases-' + moment().format('YYYY.MM') + '/pipeline-material/' + materialLink.id,
                method: 'PUT'
            }, function(response) {
                if(!/2[0-9]{2}/.exec(response.statusCode)) {
                    return logger.logError('Error saving: [' + materialLink.id + '] ', { statusCode: response.statusCode });
                }

                logger.logInfo('ES document ' + materialLink.id + ' written successfully.');
            });

            request.write(JSON.stringify(materialLink));
            request.end();
        });

        resolve();
    });
};
