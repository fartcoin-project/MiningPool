(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define('/charts/chartist', ['jquery', 'Site', 'moment'], factory);
  } else if (typeof exports !== "undefined") {
    factory(require('jquery'), require('Site'), require('monent'));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.jQuery, global.Site, global.moment);
    global.chartsChartist = mod.exports;
  }
})(this, function (_jquery, _Site, _moment) {
  'use strict';

  var _jquery2 = babelHelpers.interopRequireDefault(_jquery);

  (0, _jquery2.default)(document).ready(function ($$$1) {
    (0, _Site.run)();
  });
  var poolWorkerData;
  var poolHashrateData;
  var poolBlockData;
  // var poolBlockPending;

  var poolWorkerChart;
  var poolHashrateChart;
  var poolBlockChart;

  var statData;
  var poolKeys;
  // var datatable = []
  $.getJSON('/api/pool_stats', function (data) {
    statData = data;
    (function () {
      var pools = {};
      var pName = 'geekcash';
      for (var i = 0; i < statData.length; i++) {
        var time = statData[i].time * 1000;

        var a = pools[pName] = (pools[pName] || {
          hashrate: [],
          workers: [],
          blocks: [],
          listPending: []
        });
        if (pName in statData[i].pools) {
          a.hashrate.push({
            x: time,
            y: statData[i].pools[pName].hashrate
          });
          a.workers.push([time, statData[i].pools[pName].workerCount]);
          a.blocks.push({
            x: time,
            y: statData[i].pools[pName].blocks.pending
          })
        } else {
          a.hashrate.push({
            x: time,
            y: 0
          });
          a.workers.push([time, 0]);
          a.blocks.push({
            x: time,
            y: 0
          })
        }
      }
      poolWorkerData = [];
      poolHashrateData = [];
      poolBlockData = [];

      poolWorkerData.push({
        key: pName,
        values: pools[pName].workers
      });
      poolHashrateData.push({
        key: pName,
        values: pools[pName].hashrate
      });
      poolBlockData.push({
        key: pName,
        values: pools[pName].blocks
      });
      var tooltip1Options = {
        currency: undefined, //accepts '£', '$', '€', etc.
        //e.g. 4000 => €4,000
        tooltipFnc: undefined, //accepts function
        //build custom tooltip
        transformTooltipTextFnc: function (value) {
          var data = value.split(',')
          var date = _moment.utc(Number(data[0])).format('MMM D hh:mm')
          var hashrate = getReadableHashRateString(data[1])
          var display = `${date} UTC: ${hashrate}`
          return (display);
        },
        // transform tooltip text
        class: undefined, // accecpts 'class1', 'class1 class2', etc.
        //adds class(es) to tooltip wrapper
        anchorToPoint: false, //accepts true or false
        //tooltips do not follow mouse movement -- they are anchored to the point / bar.
        appendToBody: false //accepts true or false
        //appends tooltips to body instead of chart container
      };
      var tooltip2Options = {
        transformTooltipTextFnc: function (value) {
          var data = value.split(',')
          var date = _moment.utc(Number(data[0])).format('MMM D hh:mm')
          var hashrate = data[1]
          var display = `${date} UTC: ${hashrate}`
          return (display);
        }
      };
      var hashrateChart = new Chartist.Line('#hashRateChart', {
        series: [{
          color: Config.colors("white", 500),
          data: poolHashrateData[0].values,
          name: 'Hashrate'
        }]
      }, {
        showPoint: true,
        fullWidth: true,
        chartPadding: {
          right: 20
        },
        plugins: [Chartist.plugins.tooltip(tooltip1Options)],
        axisX: {
          type: Chartist.FixedScaleAxis,
          divisor: 12,
          labelInterpolationFnc: function (value) {
            return _moment.utc(value).format("MMM D hh:mm");
          }
        },

        axisY: {
          divisor: 8,
          // Lets offset the chart a bit from the labels
          offset: 60,
          // The label interpolation function enables you to modify the values
          // used for the labels on each axis. Here we are converting the
          // values into million pound.
          labelInterpolationFnc: function (value) {
            return getReadableHashRateString(value);
          }
        }
      });
      var char = new Chartist.Line('#blockPendingChart', {
        // labels: ['1', '2', '3', '4', '5', '6'],
        series: [{
          color: Config.colors("red", 500),
          data: poolBlockData[0].values,
          name: 'Blocks pending'
        }]
      }, {
        showPoint: true,
        fullWidth: true,
        chartPadding: {
          right: 20
        },
        plugins: [Chartist.plugins.tooltip(tooltip2Options)],
        axisX: {
          type: Chartist.FixedScaleAxis,
          divisor: 12,
          labelInterpolationFnc: function (value) {
            return _moment.utc(value).format('MMM D hh:mm')
          }
        },
        axisY: {
          divisor: 8,
          minimum: 0,
          offset: 60,
          labelInterpolationFnc: function (value) {
            return value;
          }
        }
      });
    })()
  });
});


function getReadableHashRateString(hashrate) {
  var i = -1;
  var byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH'];
  do {
    hashrate = hashrate / 1024;
    i++;
  } while (hashrate > 1024);
  return Math.round(hashrate) + byteUnits[i];
}

function timeOfDayFormat(timestamp) {
  var dStr = d3.time.format('%I:%M %p')(new Date(timestamp));
  if (dStr.indexOf('0') === 0) dStr = dStr.slice(1);
  return dStr;
}