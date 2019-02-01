var redis = require('redis');
var async = require('async');

var stats = require('./stats.js');


const loggerFactory = require('./logger.js');

const logger = loggerFactory.getLogger('Api', 'system');


module.exports = function(portalConfig, poolConfigs){


    var _this = this;

    var portalStats = this.stats = new stats(portalConfig, poolConfigs);

    this.liveStatConnections = {};

    this.handleApiRequest = async function(req, res, next){
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        switch(req.params.method){
            case 'mininginfo':
            try {
                var mininginfo =  await  portalStats.getmininginfo()
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(mininginfo);
            } catch (err) {
                res.send(400, JSON.stringify({error: err}));
            }
            return;                           
            case 'stats':                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(portalStats.statsString);
                return;
            case 'valid_blocks':
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(portalStats.validBlocks));
                return;
            case 'pool_stats':
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(portalStats.statPoolHistory));
                return;
            case 'live_stats':
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                res.write('\n');
                var uid = Math.random().toString();
                _this.liveStatConnections[uid] = res;
                req.on("close", function() {
                    delete _this.liveStatConnections[uid];
                });

                return;
            default:
                next();
        }
    };


    this.handleAdminApiRequest = function(req, res, next){
        switch(req.params.method){
            case 'pools': {
                res.end(JSON.stringify({result: poolConfigs}));
                return;
            }
            default:
                next();
        }
    };

};