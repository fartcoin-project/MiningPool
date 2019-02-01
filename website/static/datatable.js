(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define('/tables/datatable', ['jquery', 'Site'], factory);
    } else if (typeof exports !== "undefined") {
        factory(require('jquery'), require('Site'));
    } else {
        var mod = {
            exports: {}
        };
        factory(global.jQuery, global.Site);
        global.tablesDatatable = mod.exports;
    }
})(this, function (_jquery, _Site) {
    'use strict';
    var _jquery2 = babelHelpers.interopRequireDefault(_jquery);

    (0, _jquery2.default)(document).ready(function ($$$1) {
        (0, _Site.run)();
    });

    $.getJSON('/api/valid_blocks', function (data) {
        data.sort(function (a, b) {
            return b.height - a.height;
        });
        // Remove old dataTable
        var table = $("#blockInfoTable").dataTable();
        table.fnDestroy();
        $("#blockTableBody").empty();
        // Update table by new data
        for (var i = 0; i < data.length; i++) {
            var tr;
            tr = $('<tr/>');
            tr.append("<td>" + Math.round(data[i].value, 0) + "</td>");
            tr.append("<td>" + Math.round(data[i].difficulty * 100000) / 100000 + "</td>");
            tr.append(
                `<td>  <a href="https://explorer.geekcash.org/block/${data[i].blockHash}">${data[i].blockHash.substring(0, 30)}...</a></td>`
            );
            tr.append("<td>" + data[i].time + "</td>");
            var status = data[i].status
            var style = status == "Pending" ? "style=\" color: #CF6754;\"" : "style=\" color: #7EA550;\""

            tr.append(`<td ${style}>` + status + "</td>");
            $('#blockTableBody').append(tr);
        }
        $("#blockInfoTable").dataTable({
            
            searching: false,
            ordering: false,
            lengthChange: false
            
        }).fnDraw();;
        // Remove default sort asc css icon
        $("#blockInfoTable>thead>tr>th.sorting_asc").removeClass("sorting_asc");
    })
});