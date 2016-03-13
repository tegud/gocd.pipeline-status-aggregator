var http = require('http');
var moment = require('moment');
var Promise = require('bluebird');
var _ = require('lodash');

var logger = require('../../logger').forModule('Stage Status');
var eventEmitter = require('../../events');

module.exports = function storeStageStatus(teams, pipelineEvent, apiResponse) {
    return new Promise(function (resolve, reject) {
        resolve();
    });
};
