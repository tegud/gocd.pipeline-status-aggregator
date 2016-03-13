var http = require('http');
var moment = require('moment');
var Promise = require('bluebird');
var _ = require('lodash');

var logger = require('../../logger').forModule('Material Link');

module.exports = function storeMaterialLink(teams, pipelineEvent, apiResponse) {
    return new Promise(function (resolve, reject) {
        var buildCauses = pipelineEvent.result.pipeline['build-cause'];
        var calculatePipelineLag = pipelineEvent.result.pipeline.stage['approved-by'] === 'changes' && pipelineEvent.result.pipeline.stage.counter === 1;

        var baseInformation = {
            '@timestamp': pipelineEvent.result.pipeline.stage['create-time'],
            fullPath: pipelineEvent.result.pipeline.name + '/' + pipelineEvent.result.pipeline.counter + '/' + pipelineEvent.result.pipeline.stage.name + '/' + pipelineEvent.result.pipeline.stage.counter,
            pipeline: {
                group: pipelineEvent.result.pipeline.group,
                name: pipelineEvent.result.pipeline.name,
                counter: pipelineEvent.result.pipeline.counter
            },
            stage: {
                name: pipelineEvent.result.pipeline.name,
                counter: pipelineEvent.result.pipeline.counter
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

            return { id: id.replace(/[^a-z]/g, "") };
        }

        function materialConfig(baseInformation, cause) {
            var config = cause[cause.type + '-configuration'];

            return config;
        }

        function materialLag(baseInformation, cause) {
            if(calculatePipelineLag && material.changed) {
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
