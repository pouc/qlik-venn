define([
	"jquery",
	"text!./css/venn.css",
	"js/qlik",
	"./lib/q",
	"./lib/d3.min",
	"./lib/lasso_adj",
	"./lib/senseUtils",
	"./lib/venn.min"
], function($, cssContent, qlik, Q) {

	'use strict';
	
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
							
					}
				}
			}
		},
		
		snapshot : {
			canTakeSnapshot : true
		},
		
		paint : function($element, layout) {
			
			createVenn($element, layout, { Q: Q, qlik: qlik, self: this });

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
		qMeasures : [
			{ qDef : {qDef : "COUNT(DISTINCT [" + params.slaveDim.qGroupFieldDefs[0] + "])", qLabel :""}}
		],
		qInitialDataFetch: [{qHeight: 8, qWidth: 2}]
	};
	
	var steps = Q();
	
	steps.then(function() {
		
		$element.html('');
		
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
			
			reply.qHyperCube.qDataPages[0].qMatrix.forEach(function(item, index) {

				var comb = [ index ];
			
				var countCombExclude = generateSetAnalysis(
					comb,
					dimValues,
					params.masterDim.qGroupFieldDefs[0],
					params.slaveDim.qGroupFieldDefs[0],
					true
				)
				
				var exprDef = {
					sizeExcl: {
						qValueExpression : '=Count({' + countCombExclude + '}  DISTINCT [' + params.slaveDim.qGroupFieldDefs[0] + '])'
					}
				};
				
				var createGODef = Q.defer();
				var expr = app.createGenericObject(exprDef, function(combReply) {

					createGODef.resolve({ sets: comb, label: item[0].qText + ' (' + combReply.sizeExcl + ')', labels: comb.map(function(item) { return dimValues[item]; }), size: item[1].qNum, sizeExcl: combReply.sizeExcl, dimValues: dimValues });
					app.destroySessionObject(combReply.qInfo.qId);
					
				});
				
				retVal.push(createGODef.promise);

			})
			
			var combs = combinaisons(
					reply.qHyperCube.qDataPages[0].qMatrix.map(function(item, index) {
						return index;
					})
				)
				.filter(function(item) {
					return item.length > 1;
				});

			combs.forEach(function(comb, index) {
				
				var countComb = generateSetAnalysis(
					comb,
					dimValues,
					params.masterDim.qGroupFieldDefs[0],
					params.slaveDim.qGroupFieldDefs[0],
					false
				);
				
				var countCombExclude = generateSetAnalysis(
					comb,
					dimValues,
					params.masterDim.qGroupFieldDefs[0],
					params.slaveDim.qGroupFieldDefs[0],
					true
				)

				var exprDef = {
					size: {
						qValueExpression : '=Count({' + countComb + '}  DISTINCT [' + params.slaveDim.qGroupFieldDefs[0] + '])'
					},
					sizeExcl: {
						qValueExpression : '=Count({' + countCombExclude + '}  DISTINCT [' + params.slaveDim.qGroupFieldDefs[0] + '])'
					}
				};
				
				var createGODef = Q.defer();
				var expr = app.createGenericObject(exprDef, function(combReply) {

					createGODef.resolve({ sets: comb, label: '' + combReply.sizeExcl, labels: comb.map(function(item) { return dimValues[item]; }), size: combReply.size, sizeExcl: combReply.sizeExcl, dimValues: dimValues });
					app.destroySessionObject(combReply.qInfo.qId);
					
				});
				
				retVal.push(createGODef.promise);
			})

		}
		
		app.destroySessionObject(reply.qInfo.qId);
		
		return Q.all(retVal).then(function(combSets) {
			
			combSets.forEach(function(item) {
				sets.push(item);
			})
			
			return sets;
			
		})
		
		
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
		.on("mousewheel", function() {
			
			/*div.selectAll("g").sort(function (a, b) {
				
				return b.size - a.size;
			});*/
			
		})
		
		.on("click", function(d) {
			
			if(d.size > d.sizeExcl) {
			
				var menu = [
					{
						title: 'Select all (' + d.size + ')',
						action: function(elm, d, i) {
							vennSelect(d, 0, $element, sets, params);
						}
					},
					{
						title: 'Select only (' + d.sizeExcl + ')',
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
					d.size + " " + params.slaveDim.qFallbackTitle + '(s) total<br />' +
					d.sizeExcl + " " + params.slaveDim.qFallbackTitle + '(s) only'
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
			qInitialDataFetch: [{qHeight: 1000, qWidth: 2}]
		};
		
		var steps = Q();

		steps.then(function() {
			
			var createCubeDef = Q.defer();
			app.createCube(cubeDef, function(reply) {
				createCubeDef.resolve(reply);
			});
			return createCubeDef.promise;
			
		}).then(function(reply) {
			
			var pageDef = Q.defer();
			senseUtils.pageExtensionData(params.self, $element, reply, function($el, layout, bigMatrix, me) {
				pageDef.resolve(bigMatrix);
			});
			return pageDef.promise;
			
		}).then(function(bigMatrix) {
			
			params.self.backendApi.selectValues(1, bigMatrix.map(function(item) {
				return item[0].qElemNumber;
			}), false);
			
		}, function(message) {

			console.log(message);
			
		});
		
	}
	
}
