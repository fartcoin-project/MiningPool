var zlib = require('zlib');
var redis = require('redis');
var async = require('async');
var Stratum = require('stratum-pool');
var util = require('stratum-pool/lib/util.js');
var moment = require('moment');
const BigNumber = require('bignumber.js');

var os = require('os');

var algos = require('stratum-pool/lib/algoProperties.js');
var paymentprocess = require('./paymentProcessor.js');

const logger = require('./logger.js').getLogger('Stats', 'system');
const loggerFactory = require('./logger.js');


module.exports = function (portalConfig, poolConfigs) {
    logger.info("Starting stats module");

    var _this = this;

    var redisClients = [];
    var redisStats;

    this.statHistory = [];
    this.statPoolHistory = [];

    this.stats = {};
    this.statsString = '';

    this.blocks = {};
    this.blocksString = '';
    this.validBlocks = [];
    this.validBlocksString = ''
    this.mininginfo = {};
    this.mininginfoString = '';

    logger.debug("Setting up statsRedis");
    setupStatsRedis();

    logger.debug("Setting up statHistory");
    gatherStatHistory();

    Object.keys(poolConfigs).forEach(function (coin) {

        var poolConfig = poolConfigs[coin];

        var redisConfig = poolConfig.redis;

        for (var i = 0; i < redisClients.length; i++) {
            var client = redisClients[i];
            if (client.client.port === redisConfig.port && client.client.host === redisConfig.host) {
                client.coins.push(coin);
                return;
            }
        }
        redisClients.push({
            coins: [coin],
            client: redis.createClient(redisConfig.port, redisConfig.host)
        });
    });


    function setupStatsRedis() {
        redisStats = redis.createClient(portalConfig.redis.port, portalConfig.redis.host);
        redisStats.on('error', function (err) {
            logger.error('Redis for stats had an error = %s', JSON.stringify(err));
        });
    }

    function gatherStatHistory() {

        var retentionTime = (((Date.now() / 1000) - portalConfig.website.stats.historicalRetention) | 0).toString();
        redisStats.zrangebyscore(['statHistory', retentionTime, '+inf'], function (err, replies) {
            if (err) {
                logger.error('Error when trying to grab historical stats, err = %s', JSON.stringify(err));
                return;
            }
            for (var i = 0; i < replies.length; i++) {
                _this.statHistory.push(JSON.parse(replies[i]));
            }
            _this.statHistory = _this.statHistory.sort(function (a, b) {
                return a.time - b.time;
            });
            _this.statHistory.forEach(function (stats) {
                addStatPoolHistory(stats);
            });
        });
    }

    function addStatPoolHistory(stats) {
        var data = {
            time: stats.time,
            pools: {}
        };
        for (var pool in stats.pools) {
            data.pools[pool] = {
                hashrate: stats.pools[pool].hashrate,
                workerCount: stats.pools[pool].workerCount,
                blocks: stats.pools[pool].blocks
            }
        }
        _this.statPoolHistory.push(data);
    }


    this.getGlobalStats = function (callback) {

        var statGatherTime = Date.now() / 1000 | 0;

        var allCoinStats = {};

        async.each(redisClients, function (client, callback) {
            var windowTime = (((Date.now() / 1000) - portalConfig.website.stats.hashrateWindow) | 0).toString();
            var redisCommands = [];

            var redisCommandTemplates = [
                ['zremrangebyscore', ':hashrate', '-inf', '(' + windowTime],
                ['zrangebyscore', ':hashrate', windowTime, '+inf'],
                ['hgetall', ':stats'],
                ['scard', ':blocksPending'],
                ['scard', ':blocksConfirmed'],
                ['scard', ':blocksOrphaned'],
                ['smembers', ':blocksPending'],
                ['smembers', ':blocksConfirmed'],
                ['smembers', ':blocksOrphaned'],

            ];

            var commandsPerCoin = redisCommandTemplates.length;

            client.coins.map(function (coin) {
                redisCommandTemplates.map(function (t) {
                    var clonedTemplates = t.slice(0);
                    clonedTemplates[1] = coin + clonedTemplates[1];
                    redisCommands.push(clonedTemplates);
                });
            });


            client.client.multi(redisCommands).exec(function (err, replies) {
                if (err) {
                    logger.error('Error with getting global stats, err = %s', JSON.stringify(err));
                    callback(err);
                } else {
                    // Get block queue status
                    _this.validBlocks = [];
                    var listPending = replies[replies.length - 3]
                    var listConfirmed = replies[replies.length - 2]
                    var listOrphaned = replies[replies.length - 1]
                    _this.parseBlocks(listPending, 'Pending')
                    _this.parseBlocks(listConfirmed, 'Confirmed')
                    _this.parseBlocks(listOrphaned, 'Orphaned')

                    for (var i = 0; i < replies.length; i += commandsPerCoin) {
                        var coinName = client.coins[i / commandsPerCoin | 0];
                        var coinStats = {
                            name: coinName,
                            symbol: poolConfigs[coinName].coin.symbol.toUpperCase(),
                            algorithm: poolConfigs[coinName].coin.algorithm,
                            hashrates: replies[i + 1],
                            poolStats: {
                                validShares: replies[i + 2] ? (replies[i + 2].validShares || 0) : 0,
                                validBlocks: replies[i + 2] ? (replies[i + 2].validBlocks || 0) : 0,
                                invalidShares: replies[i + 2] ? (replies[i + 2].invalidShares || 0) : 0,
                                totalPaid: replies[i + 2] ? (replies[i + 2].totalPaid || 0) : 0
                            },
                            blocks: {
                                pending: replies[i + 3],
                                confirmed: replies[i + 4],
                                orphaned: replies[i + 5]
                            },
                            paymentInterval: _this.getPaymentInterval(poolConfigs[coinName].paymentProcessing.paymentInterval),
                            rewardRecipients: _this.getRewardRecipients(poolConfigs[coinName].rewardRecipients)
                        };
                        allCoinStats[coinStats.name] = (coinStats);
                    }
                    callback()
                }
            });
        }, function (err) {
            if (err) {
                logger.error('Error getting all stats, err = %s', JSON.stringify(err));
                callback();
                return;
            }

            var portalStats = {
                time: statGatherTime,
                global: {
                    workers: 0,
                    hashrate: 0
                },
                algos: {},
                pools: allCoinStats,

            };

            Object.keys(allCoinStats).forEach(function (coin) {
                var coinStats = allCoinStats[coin];
                coinStats.workers = {};
                coinStats.shares = 0;
                coinStats.hashrates.forEach(function (ins) {
                    var parts = ins.split(':');
                    var workerShares = parseFloat(parts[0]);
                    var worker = parts[1];
                    if (workerShares > 0) {
                        coinStats.shares += workerShares;
                        if (worker in coinStats.workers)
                            coinStats.workers[worker].shares += workerShares;
                        else
                            coinStats.workers[worker] = {
                                shares: workerShares,
                                invalidshares: 0,
                                hashrateString: null
                            };
                    } else {
                        if (worker in coinStats.workers)
                            coinStats.workers[worker].invalidshares -= workerShares; // workerShares is negative number!
                        else
                            coinStats.workers[worker] = {
                                shares: 0,
                                invalidshares: -workerShares,
                                hashrateString: null
                            };
                    }
                });

                var shareMultiplier = Math.pow(2, 32) / algos[coinStats.algorithm].multiplier;
                coinStats.hashrate = shareMultiplier * coinStats.shares / portalConfig.website.stats.hashrateWindow;

                coinStats.workerCount = Object.keys(coinStats.workers).length;
                portalStats.global.workers += coinStats.workerCount;

                /* algorithm specific global stats */
                var algo = coinStats.algorithm;
                if (!portalStats.algos.hasOwnProperty(algo)) {
                    portalStats.algos[algo] = {
                        workers: 0,
                        hashrate: 0,
                        hashrateString: null
                    };
                }
                portalStats.algos[algo].hashrate += coinStats.hashrate;
                portalStats.algos[algo].workers += Object.keys(coinStats.workers).length;

                for (var worker in coinStats.workers) {
                    coinStats.workers[worker].hashrateString = _this.getReadableHashRateString(shareMultiplier * coinStats.workers[worker].shares / portalConfig.website.stats.hashrateWindow);
                }

                delete coinStats.hashrates;
                delete coinStats.shares;
                coinStats.hashrateString = _this.getReadableHashRateString(coinStats.hashrate);
            });

            Object.keys(portalStats.algos).forEach(function (algo) {
                var algoStats = portalStats.algos[algo];
                algoStats.hashrateString = _this.getReadableHashRateString(algoStats.hashrate);
            });

            _this.stats = portalStats;
            _this.statsString = JSON.stringify(portalStats);


            _this.statHistory.push(portalStats);
            addStatPoolHistory(portalStats);

            var retentionTime = (((Date.now() / 1000) - portalConfig.website.stats.historicalRetention) | 0);

            for (var i = 0; i < _this.statHistory.length; i++) {
                if (retentionTime < _this.statHistory[i].time) {
                    if (i > 0) {
                        _this.statHistory = _this.statHistory.slice(i);
                        _this.statPoolHistory = _this.statPoolHistory.slice(i);
                    }
                    break;
                }
            }

            redisStats.multi([
                ['zadd', 'statHistory', statGatherTime, _this.statsString],
                ['zremrangebyscore', 'statHistory', '-inf', '(' + retentionTime]
            ]).exec(function (err, replies) {
                if (err)
                    logger.error('Error adding stats to historics, err = %s', JSON.stringify(err));
            });
            callback();
        });

    };

    this.getReadableHashRateString = function (hashrate) {
        var i = -1;
        var byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH'];
        do {
            hashrate = hashrate / 1000;
            i++;
        } while (hashrate > 1000);
        return hashrate.toFixed(2) + byteUnits[i];
    };
    this.getPaymentInterval = function (paymentInterval) {
        console.log('paymentInterval', paymentInterval)
        var i = 0;
        var oneMinutes = 60;
        var oneHours = 60 * oneMinutes;
        var oneDay = 24 * oneHours;
        var times = [oneDay, oneHours, oneMinutes, 1]
        var timeUnits = [0, 0, 0, 0];
        do {
            timeUnits[i] = parseInt(paymentInterval / times[i]);
            paymentInterval = parseInt(paymentInterval % times[i]);
            i++;
        } while (paymentInterval > 0);
        var days = timeUnits[0] == 0 ? '' : timeUnits[0] + ' days'
        var hours = timeUnits[1] == 0 ? '' : timeUnits[1] + ' hours'
        var minutes = timeUnits[2] == 0 ? '' : timeUnits[2] + ' min'
        var seconds = timeUnits[3] == 0 ? '' : timeUnits[3] + ' sec'
        return days + hours + minutes + seconds;
    };
    this.getRewardRecipients = function (rewardRecipients) {
        var poolReward = Object.values(rewardRecipients).reduce((a, b) => a + b, 0);
        return poolReward.toFixed(1) + ' %';
    }
    this.parseBlocks = (blocks, status) => {
        blocks.forEach(element => {
            var data = element.split(':')
            var blockHash = data[0].toString()
            var tx = data[1]
            var blockHeight = data[2]
            var worker = data[3]
            var blockReward = data[4]
            var blockDiff = data[5]
            var time = data[6]
            var validitem = {
                'value': blockReward / 100000000,
                'difficulty': blockDiff,
                'blockHash': blockHash,
                'time': moment.utc(time * 1000).format('Do MMM YYYY, hh:mm:ss [UTC]'),
                'height': blockHeight,
                'status': status,
                'tx': tx,
                'worker': worker
            }
            if (_this.validBlocks.length >= 100) return;
            _this.validBlocks.push(validitem)
        });
    }
    this.getmininginfo = function () {
        var poolOptions = poolConfigs['geekcash'];
        var processingConfig = poolOptions.paymentProcessing;
        var daemon = new Stratum.daemon.interface([processingConfig.daemon], loggerFactory.getLogger('CoinDaemon', 'geekcash'));
        return new Promise((resolve, reject) => {
            daemon.cmd('getmininginfo', [], function (result) {
                if (result.error) {
                    logger.error('Error with getmininginfo info  %s', JSON.stringify(result.error));
                    reject(result.error)
                }
                if (result[0].response) {
                    resolve(JSON.stringify(result[0].response))
                }
                resolve(null)
            })
        })
    }
    // this.getGeekBlockinfo = function () {
    //     var poolOptions = poolConfigs['geekcash'];
    //     var processingConfig = poolOptions.paymentProcessing;
    //     var daemon = new Stratum.daemon.interface([processingConfig.daemon], loggerFactory.getLogger('CoinDaemon', 'geekcash'));
    //     _this.validBlocks= [];
    //     var listblocks = [];
    //     // _this.blocks.listConfirmed.concat(_this.blocks.listPending)
    //     var pendingCount = _this.blocks.listPending.length
    //     _this.blocks.listPending.forEach(element => {
    //         var data = element.split(':')
    //         var blockHash = data[0].toString()
    //         var tx = data[1]
    //         var blockHeight = data[2]
    //         var status = "Pending"
    //         listblocks.push({blockHash,tx,blockHeight, status})
    //     });
    //     _this.blocks.listConfirmed.forEach(element => {
    //         var data = element.split(':')
    //         var blockHash = data[0].toString()
    //         var tx = data[1]
    //         var blockHeight = data[2]
    //         var status = "Confirmed"
    //         listblocks.push({blockHash,tx,blockHeight, status})
    //     });
    //     // sort by blockHeight desc
    //     listblocks.sort(function (a, b) {
    //         return b.blockHeight - a.blockHeight ;
    //       });
    //     var blockslength = listblocks.length
    //     var startIndex = 0
    //     var endIndex =  blockslength >= 100 ? 100 : blockslength
    //     var lsfunc = [];
    //     for (let index = 0; index < endIndex; index++) {
    //         const element = listblocks[index];
    //         var funcCallback = getblock(element,daemon )
    //         lsfunc.push(funcCallback)
    //     }
    //     return lsfunc;
    // };
    // function getblock(element, daemon){
    //     return new Promise((resolve,reject) => {
    //         var blockStatus = element;
    //         var blockHash = element.blockHash
    //         daemon.cmd('getblock', [blockHash], function (result) {

    //             if (result.error) {
    //                 logger.error('Error with getblock processing daemon %s', JSON.stringify(result.error));
    //                 reject();
    //             } else {
    //                 var block = result[0].response
    //                 var difficulty = block.difficulty
    //                 var time = moment.utc(block.time * 1000).format('ddd, Do MMM YYYY, hh:mm:ss [UTC]')
    //                 var txhash = block.tx[0]
    //                 var blockHash = block.hash
    //                 daemon.cmd('getrawtransaction', [txhash, 1], function (result) {
    //                     if (result.error) {
    //                         logger.error('Error with gettxout info  %s', JSON.stringify(result.error));
    //                         reject()
    //                     } else {
    //                         if (result[0].response) {
    //                             var vout = result[0].response.vout
    //                             var amount = vout.map(item => item.value).reduce((prev, next) => prev + next);
    //                             console.log('amount', amount)
    //                             var confirmations = result[0].response.confirmations
    //                             var validitem = {
    //                                 'value': amount,
    //                                 'difficulty': difficulty,
    //                                 'blockHash': blockHash,
    //                                 'time': time,
    //                                 'confirmations': confirmations,
    //                                 'height': block.height,
    //                                 'status': blockStatus.status
    //                             }
    //                             _this.validBlocks.push(validitem)
    //                             resolve()
    //                         } else {  
    //                             reject()
    //                             console.log('gettxout error', result, txhash);
    //                         }
    //                     }
    //                 })
    //             }
    //         });
    //     })

    // }

};