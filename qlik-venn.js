define([
	"jquery",
	"text!./css/venn.css",
	"js/qlik",
	"./lib/q",
	"./lib/d3.min",
	"./lib/lasso_adj",
	"./lib/senseUtils",
	"./lib/venn.min",
	"./lib/numeral"
], function($, cssContent, qlik, Q) {

	'use strict';
	
	numeral.language('fr', {
		delimiters: {
			thousands: ' ',
			decimal: ','
		},
		abbreviations: {
			thousand: 'k',
			million: 'm',
			billion: 'b',
			trillion: 't'
		},
		ordinal : function (number) {
			return number === 1 ? 'er' : 'ème';
		},
		currency: {
			symbol: '€'
		}
	});
	
	numeral.language('fr');
	
	d3.contextMenu = function (menu, openCallback) {

		// create the div element that will hold the context menu
		d3.selectAll('.d3-context-menu').data([1])
			.enter()
			.append('div')
			.attr('class', 'd3-context-menu');

		// close menu
		d3.select('body').on('click.d3-context-menu', function() {
			d3.select('.d3-context-menu').style('display', 'none');
		});

		// this gets executed when a contextmenu event occurs
		return function(data, index) {
			var elm = this;

			d3.selectAll('.d3-context-menu').html('');
			var list = d3.selectAll('.d3-context-menu').append('ul');
			list.selectAll('li').data(menu).enter()
				.append('li')
				.html(function(d) {
					return (typeof d.title === 'string') ? d.title : d.title(data);
				})
				.on('click', function(d, i) {
					d.action(elm, data, index);
					d3.select('.d3-context-menu').style('display', 'none');
				});

			// the openCallback allows an action to fire before the menu is displayed
			// an example usage would be closing a tooltip
			if (openCallback) {
				if (openCallback(data, index) === false) {
					return;
				}
			}

			// display context menu
			d3.select('.d3-context-menu')
				.style('left', (d3.event.pageX - 2) + 'px')
				.style('top', (d3.event.pageY - 2) + 'px')
				.style('display', 'block');

			d3.event.preventDefault();
			d3.event.stopPropagation();
		};
	};

	$("<style>").html(cssContent).appendTo("head");
	
	return {
		initialProperties : {
			version: 2.0
		},
		definition : {
			type : "items",
			component : "accordion",
			items : {
				dimensions : {
					uses : "dimensions",
					min : 2,
					max: 2
				},
				measures : {
					uses : "measures",
					min : 0,
					max: 1
				},
				sorting : {
					uses : "sorting"
				},
				addons : {
					uses : "addons"
				},
				settings : {
					uses : "settings",
					items : {						
						size : {
							
							
						}
					}
				}
			}
		},
		
		snapshot : {
			canTakeSnapshot : true
		},
		
		paint : function($element, layout) {
			
			createVenn($element, layout, { Q: Q, qlik: qlik, self: this, mId: 1 });

		}
	};
});

function createVenn($element, layout, params) {

	var id = "container_" + layout.qInfo.qId;
	var width = $element.width();
	var height = $element.height();
	
	params.masterDim = layout.qHyperCube.qDimensionInfo[0]; // qFallbackTitle;
	params.slaveDim = layout.qHyperCube.qDimensionInfo[1];
	params.measure = (typeof layout.qHyperCube.qMeasureInfo[0] != 'undefined') ? layout.qHyperCube.qMeasureInfo[0].qFallbackTitle : undefined;
	
	viz(id, width, height, $element, params);

}

var viz = function (id, width, height, $element, params) {
	
	var app = params.qlik.currApp();
	var Q = params.Q;
	
	var cubeDef = {
		qDimensions : [
			{ qDef : {qFieldDefs : [ params.masterDim.qGroupFieldDefs[0] ]}}
		],
		qInitialDataFetch: [{qHeight: 8, qWidth: 1}]
	};
	
	var steps = Q();
	
	steps.then(function() {
		
		if($element.data('error') == 'true')
			$element.html('');
		
		$element.data('error') == 'false'
		
	}).then(function() {
		
		var createCubeDef = Q.defer();
		app.createCube(cubeDef, function(reply) {
			createCubeDef.resolve(reply);
		});
		return createCubeDef.promise;
		
	}).then(function(reply) {
		
		var retVal = [];
		var sets = [];
			
		if(
			(reply.qHyperCube.qDimensionInfo[0].qStateCounts.qSelected ||
			reply.qHyperCube.qDimensionInfo[0].qStateCounts.qOption) > 8
		) {
			
			return Q.reject('Too many values for ' + params.masterDim.qGroupFieldDefs[0]);
			
		} else {
			
			var dimValues = {};
			
			reply.qHyperCube.qDataPages[0].qMatrix.forEach(function(item, index) {
				dimValues[index] = item[0];
			});
			
			var combsDef = combinaisons(
			
				reply.qHyperCube.qDataPages[0].qMatrix.map(function(item, index) {
					return index;
				})
				
			).map(function(comb, index) {
				
				return {
					
					comb: comb,
					index: index,
					
					countComb: generateSetAnalysis(
						comb,
						dimValues,
						params.masterDim.qGroupFieldDefs[0],
						params.slaveDim.qGroupFieldDefs[0],
						false
					),
				
					countCombExclude: generateSetAnalysis(
						comb,
						dimValues,
						params.masterDim.qGroupFieldDefs[0],
						params.slaveDim.qGroupFieldDefs[0],
						true
					)
				};
				
			}).map(function(combSA) {
				
				return {
					
					comb: combSA.comb,
					index: combSA.index,
					size: {
						qValueExpression : '=Count({' + combSA.countComb + '}  DISTINCT [' + params.slaveDim.qGroupFieldDefs[0] + '])'
					},
					sizeExcl: {
						qValueExpression : '=Count({' + combSA.countCombExclude + '}  DISTINCT [' + params.slaveDim.qGroupFieldDefs[0] + '])'
					}
					
				};
				
			});
			
			
			var combsDeferred = Q.defer();
			var expr = app.createGenericObject({ combsDef: combsDef }, function(combsReply) {
				
				combsDeferred.resolve(combsReply.combsDef.map(function(combReply) {
					
					return {
						sets: combReply.comb,
						label: (combReply.comb.length == 1) ? dimValues[combReply.comb[0]].qText + ((combReply.sizeExcl) ? '<br>' + numeral(combReply.sizeExcl).format('0,0[.]0a') : '') : ((combReply.sizeExcl != 0) ? numeral(combReply.sizeExcl).format('0,0[.]0a') : ''),
						labels: combReply.comb.map(function(item) { return dimValues[item]; }),
						size: combReply.size,
						sizeExcl: combReply.sizeExcl,
						dimValues: dimValues
					}
					
				}));
				
				app.destroySessionObject(combsReply.qInfo.qId);
				
			});
			
			return combsDeferred.promise;
			
		}
		
		
	}).then(function(sets) {
		
		drawVenn(id, width, height, $element, sets, params);
		$element.data('error', 'false');
		
	}, function(message) {
		
		$element.html(message);
		$element.data('error', 'true');
		
	})	
}

function sameElements(a, b) {
	var hash = function(x) {
		return typeof x + (typeof x == "object" ? a.indexOf(x) : x);
	}
	return a.map(hash).sort().join() == b.map(hash).sort().join();
}
	
function combinaisons(a) {
	var fn = function(n, src, got, all) {
		if (n == 0) {
			if (got.length > 0) {
				all[all.length] = got;
			}
			return;
		}
		for (var j = 0; j < src.length; j++) {
			fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
		}
		return;
	}
	var all = [];
	for (var i=0; i < a.length; i++) {
		fn(i, a, [], all);
	}
	all.push(a);
	return all;
}

function drawVenn(id, width, height, $element, sets, params) {
	
	var app = params.qlik.currApp();
	var Q = params.Q;

	$element.append($('<div />').attr({ "id": id }).css({ height: height, width: width }))

	var chart = venn.VennDiagram()
		.width(width)
		.height(height);

	var div = d3.select("#" + id)
	
	try {
		div.datum(sets).call(chart);
	} catch(e) {
		$element.html('Not possible to draw venn diagram!');
		$element.data('error', 'true');
	}
	
	$("div.venntooltip").remove();
	
	var tooltip = d3.select("body").append("div")
		.attr("class", "venntooltip");
		

	div.selectAll("path")
		.style("stroke-opacity", 0)
		.style("stroke", "#fff")
		.style("stroke-width", 0)

	div.selectAll("g")
		
		.on("click", function(d) {
			
			if(d.size > d.sizeExcl) {
			
				var menu = [
					{
						title: 'Select all (' + numeral(d.size).format('0,0[.]0a') + ')',
						action: function(elm, d, i) {
							vennSelect(d, 0, $element, sets, params);
						}
					},
					{
						title: 'Select only (' + numeral(d.sizeExcl).format('0,0[.]0a') + ')',
						action: function(elm, d, i) {
							vennSelect(d, 1, $element, sets, params);
						}
					}
				]
				
				d3.contextMenu(menu)(d);
			
			} else {
				
				vennSelect(d, 0, $element, sets, params);
				
			}
			
		})
	
		.on("mouseover", function(d, i) {
			
			// sort all the areas relative to the current item
			venn.sortAreas(div, d);

			// Display a tooltip with the current size
			tooltip.transition().duration(400).style("opacity", .9);
			tooltip.html(
				sets.filter(function(fItem) {
					return sameElements(d.sets, fItem.sets)
				})[0].labels.map(function(label) { return label.qText; }).join('<br />') + '<br /><br />' +
				((d.size > d.sizeExcl) ? (
					numeral(d.size).format('0,0[.]0a') + " " + params.slaveDim.qFallbackTitle + '(s) total<br />' +
					numeral(d.sizeExcl).format('0,0[.]0a') + " " + params.slaveDim.qFallbackTitle + '(s) only'
				) : (
					d.size + " " + params.slaveDim.qFallbackTitle + '(s)'
				))
			);

			// highlight the current path
			var selection = d3.select(this).transition("tooltip").duration(400);
			selection.select("path")
				.style("stroke-width", 3)
				.style("fill-opacity", d.sets.length == 1 ? .4 : .1)
				.style("stroke-opacity", 1);
				
		})
		
		.on("mousemove", function(d) {
			
			tooltip.style("left", (d3.event.pageX) + "px")
				   .style("top", (d3.event.pageY + 28) + "px");
		})

		.on("mouseout", function(d, i) {
			tooltip.transition().duration(400).style("opacity", 0);
			var selection = d3.select(this).transition("tooltip").duration(400);
			selection.select("path")
				.style("stroke-width", 0)
				.style("fill-opacity", d.sets.length == 1 ? .25 : .0)
				.style("stroke-opacity", 0);
		});

}


function generateSetAnalysis(set, dimValues, masterDim, slaveDim, exclude) {
	
	var count = set.map(function(item) {
		return dimValues[item].qText;
	}).map(function(item) {
		return '<[' + slaveDim + ']=P({<[' + masterDim + '] = {"' + item + '"}>} [' + slaveDim + '])>'
	})
	
	if(exclude) {
		
		Object.keys(dimValues).map(function(item) {
			return parseInt(item);
		}).filter(function(item) {
			return set.indexOf(item) == -1;;
		}).map(function(item) {
			return dimValues[item].qText;
		}).map(function(item) {
			return '<[' + slaveDim + ']=E({<[' + masterDim + '] = {"' + item + '"}>} [' + slaveDim + '])>'
		}).forEach(function(item) {
			count.push(item);
		})
		
	}
	
	return count.join(' * ');
	
}


function vennSelect(d, mode, $element, sets, params) {
	
	var app = params.qlik.currApp();
	var Q = params.Q;
	
	var filterSet = sets.filter(function(fItem) {
		return sameElements(d.sets, fItem.sets)
	})[0];
	
	if(typeof filterSet != 'undefined') {
		
		var dimValues = filterSet.dimValues;
		
		var countSetAnalysis = generateSetAnalysis(
			filterSet.sets,
			dimValues,
			params.masterDim.qGroupFieldDefs[0],
			params.slaveDim.qGroupFieldDefs[0],
			mode == 1
		);

		var cubeDef = {
			qDimensions: [
				{ qDef: {qFieldDefs: [ params.slaveDim.qGroupFieldDefs[0] ]}, qNullSuppression: true }
			], 
			qMeasures: [
				{ qDef: {qDef: '=Count({' + countSetAnalysis + '}  DISTINCT [' + params.masterDim.qGroupFieldDefs[0] + '])', qLabel: ""}}
			],
			qInitialDataFetch: [{qHeight: 0, qWidth: 2}]
		};
		
		var steps = Q();

		steps.then(function() {

			var msg = {
				"method":"CreateSessionObject",
				"handle": 1,
				"params":[{
						"qHyperCubeDef": cubeDef,
						"qInfo":{ "qType":"mashup", "qId": "MULFT" + params.mId++ }
				}],
				"jsonrpc":"2.0"
			}
			
			return params.self.backendApi.model.session.rpc(msg).then(function(d) { return d.result; });

			
		}).then(function(reply) {
			
			var msg = {
				"method": "GetLayout",
				"handle": reply.qReturn.qHandle,
				"params": [],
				"delta": true,
				"jsonrpc": "2.0"
			}
			
			return Q.all([
				reply.qReturn.qHandle,
				params.self.backendApi.model.session.rpc(msg).then(function(d) { return d.result; })
			])
			
		}).then(function(reply) {
			
			var handle = reply[0];
			var layout = reply[1].qLayout[0].value;
			
			var columns = layout.qHyperCube.qSize.qcx;
			var totalheight = layout.qHyperCube.qSize.qcy;		
			var pageheight = Math.floor(10000 / columns);
			var numberOfPages = Math.ceil(totalheight / pageheight);
						
			var pages = Array.apply(null, Array(numberOfPages)).map(function(data, index) {

				var msg = {
					"method": "GetHyperCubeData",
					"handle": handle,
					"params":[
						"/qHyperCubeDef", 
						[{
							qTop: (pageheight * index),
							qLeft: 0,
							qWidth: columns,
							qHeight: pageheight
						}]
					], 
					"jsonrpc":"2.0"
				}

				return params.self.backendApi.model.session.rpc(msg).then(function(d) { return d.result; });
				
			}, this);

			return Q.all(pages);
			
		}).then(function(reply) {
			
			var selectionArray = reply.map(function(page) {
				return page.qDataPages[0].qMatrix.map(function(row) {
					return row[0].qElemNumber;
				})
			})

			params.self.backendApi.selectValues(1, [].concat.apply([], selectionArray), false);
			
		}, function(message) {

			console.log(message);
			
		});
		
	}
	
}
