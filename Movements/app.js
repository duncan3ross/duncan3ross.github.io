'use strict';

var svg, tooltip, biHiSankey, path, defs, colorScale, highlightColorScale, isTransitioning;

var OPACITY = {
    NODE_DEFAULT: 0.9,
    NODE_FADED: 0.1,
    NODE_HIGHLIGHT: 0.8,
    LINK_DEFAULT: 0.6,
    LINK_FADED: 0.05,
    LINK_HIGHLIGHT: 0.9
  },
  TYPES = ["Data Source", "Measures", "Pillar", "Ranking"],
  TYPE_COLORS = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a"],
  TYPE_HIGHLIGHT_COLORS = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"],
  LINK_COLOR = "#b3b3b3",
  INFLOW_COLOR = "#2E86D1",
  OUTFLOW_COLOR = "#D63028",
  NODE_WIDTH = 36,
  COLLAPSER = {
    RADIUS: NODE_WIDTH / 2,
    SPACING: 2
  },
  OUTER_MARGIN = 10,
  MARGIN = {
    TOP: 2 * (COLLAPSER.RADIUS + OUTER_MARGIN),
    RIGHT: OUTER_MARGIN,
    BOTTOM: OUTER_MARGIN,
    LEFT: OUTER_MARGIN
  },
  TRANSITION_DURATION = 400,
  HEIGHT = 500 - MARGIN.TOP - MARGIN.BOTTOM,
  WIDTH = 1100 - MARGIN.LEFT - MARGIN.RIGHT,
  LAYOUT_INTERATIONS = 100,
  REFRESH_INTERVAL = 7000;

var formatNumber = function (d) {
  var numberFormat = d3.format(",.1f"); // one decimal places
  return numberFormat(d) + "%";
},

formatFlow = function (d) {
  var flowFormat = d3.format(",.1f"); // one decimal places with sign
  return flowFormat(Math.abs(d)) + "%";
},

// Used when temporarily disabling user interractions to allow animations to complete
disableUserInterractions = function (time) {
  isTransitioning = true;
  setTimeout(function(){
    isTransitioning = false;
  }, time);
},

hideTooltip = function () {
  return tooltip.transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", 0);
},

showTooltip = function () {
  return tooltip
    .style("left", d3.event.pageX + "px")
    .style("top", d3.event.pageY + 15 + "px")
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 1);
};

colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS),
highlightColorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_HIGHLIGHT_COLORS),

svg = d3.select("#chart").append("svg")
        .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
        .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
      .append("g")
        .attr("transform", "translate(" + MARGIN.LEFT + "," + MARGIN.TOP + ")");

svg.append("g").attr("id", "links");
svg.append("g").attr("id", "nodes");
svg.append("g").attr("id", "collapsers");

tooltip = d3.select("#chart").append("div").attr("id", "tooltip");

tooltip.style("opacity", 0)
    .append("p")
      .attr("class", "value");

biHiSankey = d3.biHiSankey();

// Set the biHiSankey diagram properties
biHiSankey
  .nodeWidth(NODE_WIDTH)
  .nodeSpacing(10)
  .linkSpacing(0)
  .arrowheadScaleFactor(0.5) // Specifies that 0.5 of the link's stroke WIDTH should be allowed for the marker at the end of the link.
  .size([WIDTH, HEIGHT]);

path = biHiSankey.link().curvature(0.45);

defs = svg.append("defs");

defs.append("marker")
  .style("fill", LINK_COLOR)
  .attr("id", "arrowHead")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", OUTFLOW_COLOR)
  .attr("id", "arrowHeadInflow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", INFLOW_COLOR)
  .attr("id", "arrowHeadOutlow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

function update () {
  var link, linkEnter, node, nodeEnter, collapser, collapserEnter;

  function dragmove(node) {
    node.x = Math.max(0, Math.min(WIDTH - node.width, d3.event.x));
    node.y = Math.max(0, Math.min(HEIGHT - node.height, d3.event.y));
    d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    biHiSankey.relayout();
    svg.selectAll(".node").selectAll("rect").attr("height", function (d) { return d.height; });
    link.attr("d", path);
  }

  function containChildren(node) {
    node.children.forEach(function (child) {
      child.state = "contained";
      child.parent = this;
      child._parent = null;
      containChildren(child);
    }, node);
  }

  function expand(node) {
    node.state = "expanded";
    node.children.forEach(function (child) {
      child.state = "collapsed";
      child._parent = this;
      child.parent = null;
      containChildren(child);
    }, node);
  }

  function collapse(node) {
    node.state = "collapsed";
    containChildren(node);
  }

  function restoreLinksAndNodes() {
    link
      .style("stroke", LINK_COLOR)
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_DEFAULT);

    node
      .selectAll("rect")
        .style("fill", function (d) {
          d.color = colorScale(d.type.replace(/ .*/, ""));
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
        })
        .style("fill-opacity", OPACITY.NODE_DEFAULT);

    node.filter(function (n) { return n.state === "collapsed"; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.NODE_DEFAULT);
  }

  function showHideChildren(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (node.state === "collapsed") { expand(node); }
    else { collapse(node); }

    biHiSankey.relayout();
    update();
    link.attr("d", path);
    restoreLinksAndNodes();
  }

  function highlightConnected(g) {
    link.filter(function (d) { return d.source === g; })
      .style("marker-end", function () { return 'url(#arrowHeadInflow)'; })
      .style("stroke", OUTFLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);

    link.filter(function (d) { return d.target === g; })
      .style("marker-end", function () { return 'url(#arrowHeadOutlow)'; })
      .style("stroke", INFLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);
  }

  function fadeUnconnected(g) {
    link.filter(function (d) { return d.source !== g && d.target !== g; })
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_FADED);

    node.filter(function (d) {
      return (d.name === g.name) ? false : !biHiSankey.connected(d, g);
    }).transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_FADED);
  }

  link = svg.select("#links").selectAll("path.link")
    .data(biHiSankey.visibleLinks(), function (d) { return d.id; });

  link.transition()
    .duration(TRANSITION_DURATION)
    .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
    .attr("d", path)
    .style("opacity", OPACITY.LINK_DEFAULT);


  link.exit().remove();


  linkEnter = link.enter().append("path")
    .attr("class", "link")
    .style("fill", "none");

  linkEnter.on('mouseenter', function (d) {
    if (!isTransitioning) {
      showTooltip().select(".value").text(function () {
        if (d.direction > 0) {
          return d.source.name + " to " + d.target.name + "\n" + formatNumber(d.value);
        }
        return d.target.name + " from " + d.source.name + "\n" + formatNumber(d.value);
      });

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_HIGHLIGHT);
    }
  });

  linkEnter.on('mouseleave', function () {
    if (!isTransitioning) {
      hideTooltip();

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_DEFAULT);
    }
  });

  linkEnter.sort(function (a, b) { return b.thickness - a.thickness; })
    .classed("leftToRight", function (d) {
      return d.direction > 0;
    })
    .classed("rightToLeft", function (d) {
      return d.direction < 0;
    })
    .style("marker-end", function () {
      return 'url(#arrowHead)';
    })
    .style("stroke", LINK_COLOR)
    .style("opacity", 0)
    .transition()
      .delay(TRANSITION_DURATION)
      .duration(TRANSITION_DURATION)
      .attr("d", path)
      .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
      .style("opacity", OPACITY.LINK_DEFAULT);


  node = svg.select("#nodes").selectAll(".node")
      .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });


  node.transition()
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
    .style("opacity", OPACITY.NODE_DEFAULT)
    .select("rect")
      .style("fill", function (d) {
        d.color = colorScale(d.type.replace(/ .*/, ""));
        return d.color;
      })
      .style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
      .style("stroke-WIDTH", "1px")
      .attr("height", function (d) { return d.height; })
      .attr("width", biHiSankey.nodeWidth());


  node.exit()
    .transition()
      .duration(TRANSITION_DURATION)
      .attr("transform", function (d) {
        var collapsedAncestor, endX, endY;
        collapsedAncestor = d.ancestors.filter(function (a) {
          return a.state === "collapsed";
        })[0];
        endX = collapsedAncestor ? collapsedAncestor.x : d.x;
        endY = collapsedAncestor ? collapsedAncestor.y : d.y;
        return "translate(" + endX + "," + endY + ")";
      })
      .remove();


  nodeEnter = node.enter().append("g").attr("class", "node");

  nodeEnter
    .attr("transform", function (d) {
      var startX = d._parent ? d._parent.x : d.x,
          startY = d._parent ? d._parent.y : d.y;
      return "translate(" + startX + "," + startY + ")";
    })
    .style("opacity", 1e-6)
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_DEFAULT)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeEnter.append("text");
  nodeEnter.append("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
    })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", biHiSankey.nodeWidth());

  node.on("mouseenter", function (g) {
    if (!isTransitioning) {
      restoreLinksAndNodes();
      highlightConnected(g);
      fadeUnconnected(g);

      d3.select(this).select("rect")
        .style("fill", function (d) {
          d.color = d.netFlow > 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(d.color).darker(0.1);
        })
        .style("fill-opacity", OPACITY.LINK_DEFAULT);

      tooltip
        .style("left", g.x + MARGIN.LEFT + "px")
        .style("top", g.y + g.height + MARGIN.TOP + 15 + "px")
        .transition()
          .duration(TRANSITION_DURATION)
          .style("opacity", 1).select(".value")
          .text(function () {
            var additionalInstructions = g.children.length ? "\n(Double click to expand)" : "";
            return g.name + "\n" + g.value/2 + "%" + additionalInstructions;
          });
    }
  });

  node.on("mouseleave", function () {
    if (!isTransitioning) {
      hideTooltip();
      restoreLinksAndNodes();
    }
  });

  node.filter(function (d) { return d.children.length; })
    .on("dblclick", showHideChildren);

  // allow nodes to be dragged to new positions
  node.call(d3.behavior.drag()
    .origin(function (d) { return d; })
    .on("dragstart", function () { this.parentNode.appendChild(this); })
    .on("drag", dragmove));

  // add in the text for the nodes
  node.filter(function (d) { return d.value !== 0; })
    .select("text")
      .attr("x", -6)
      .attr("y", function (d) { return d.height; })
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("transform", null)
      .text(function (d) { return d.name; })
    .filter(function (d) { return d.x < 2 * WIDTH / 3; })
      .attr("x", 6 + biHiSankey.nodeWidth())
      .attr("text-anchor", "start");


  collapser = svg.select("#collapsers").selectAll(".collapser")
    .data(biHiSankey.expandedNodes(), function (d) { return d.id; });


  collapserEnter = collapser.enter().append("g").attr("class", "collapser");

  collapserEnter.append("circle")
    .attr("r", COLLAPSER.RADIUS)
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    });

  collapserEnter
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) {
      return "translate(" + (d.x + d.width / 2) + "," + (d.y + COLLAPSER.RADIUS) + ")";
    });

  collapserEnter.on("dblclick", showHideChildren);

  collapser.select("circle")
    .attr("r", COLLAPSER.RADIUS);

  collapser.transition()
    .delay(TRANSITION_DURATION)
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d, i) {
      return "translate("
        + (COLLAPSER.RADIUS + i * 2 * (COLLAPSER.RADIUS + COLLAPSER.SPACING))
        + ","
        + (-COLLAPSER.RADIUS - OUTER_MARGIN)
        + ")";
    });

  collapser.on("mouseenter", function (g) {
    if (!isTransitioning) {
      showTooltip().select(".value")
        .text(function () {
          return g.name + "\n(Double click to collapse)";
        });

      var highlightColor = highlightColorScale(g.type.replace(/ .*/, ""));

      d3.select(this)
        .style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("circle")
          .style("fill", highlightColor);

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("rect")
          .style("fill", highlightColor);
    }
  });

  collapser.on("mouseleave", function (g) {
    if (!isTransitioning) {
      hideTooltip();
      d3.select(this)
        .style("opacity", OPACITY.NODE_DEFAULT)
        .select("circle")
          .style("fill", function (d) { return d.color; });

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_DEFAULT)
        .select("rect")
          .style("fill", function (d) { return d.color; });
    }
  });

  collapser.exit().remove();

}

var exampleNodes = [
 
{"type":"Data Source","id":"ds", "parent":null, "name":"2013"},
    {"type":"Data Source","id":"00", "parent":"ds", "name":"Above 200"},
    {"type":"Data Source","id":"01", "parent":"ds", "name":"201-225"},
    {"type":"Data Source","id":"02", "parent":"ds", "name":"226-250"},
    {"type":"Data Source","id":"03", "parent":"ds", "name":"251-275"},
    {"type":"Data Source","id":"04", "parent":"ds", "name":"276-300"},
    {"type":"Data Source","id":"05", "parent":"ds", "name":"301-350"},
    {"type":"Data Source","id":"06", "parent":"ds", "name":"351-400"},
    {"type":"Data Source","id":"07", "parent":"ds", "name":"401-500"},
    {"type":"Data Source","id":"08", "parent":"ds", "name":"501-600"},
    {"type":"Data Source","id":"09", "parent":"ds", "name":"601+"},
    {"type":"Data Source","id":"000", "parent":"ds", "name":"Unranked"},
{"type":"Measures","id":"m", "parent":null, "name":"2014"},    
    {"type":"Measures","id":"10", "parent":"m", "name":"Above 200"},
    {"type":"Measures","id":"11", "parent":"m", "name":"201-225"},
    {"type":"Measures","id":"12", "parent":"m", "name":"226-250"},
    {"type":"Measures","id":"13", "parent":"m", "name":"251-275"},
    {"type":"Measures","id":"14", "parent":"m", "name":"276-300"},
    {"type":"Measures","id":"15", "parent":"m", "name":"301-350"},
    {"type":"Measures","id":"16", "parent":"m", "name":"351-400"},
    {"type":"Measures","id":"17", "parent":"m", "name":"401-500"},
    {"type":"Measures","id":"18", "parent":"m", "name":"501-600"},
    {"type":"Measures","id":"19", "parent":"m", "name":"601+"},
    {"type":"Measures","id":"111", "parent":"m", "name":"Unranked"},
{"type":"Pillar","id":"p", "parent":null, "name":"Pillar"},
    {"type":"Pillar","id":"20", "parent":"p", "name":"Above 200"},
    {"type":"Pillar","id":"21", "parent":"p", "name":"201-225"},
    {"type":"Pillar","id":"22", "parent":"p", "name":"226-250"},
    {"type":"Pillar","id":"23", "parent":"p", "name":"251-275"},
    {"type":"Pillar","id":"24", "parent":"p", "name":"276-300"},
    {"type":"Pillar","id":"25", "parent":"p", "name":"301-350"},
    {"type":"Pillar","id":"26", "parent":"p", "name":"351-400"},
    {"type":"Pillar","id":"27", "parent":"p", "name":"401-500"},
    {"type":"Pillar","id":"28", "parent":"p", "name":"501-600"},
    {"type":"Pillar","id":"29", "parent":"p", "name":"601+"},
    {"type":"Pillar","id":"222", "parent":"p", "name":"Unranked"}
]

var exampleLinks = [
{"source":"00", "target":"10", "value":"10"},
{"source":"01", "target":"10", "value":"10"},
{"source":"02", "target":"10", "value":"10"},
{"source":"03", "target":"10", "value":"10"},
{"source":"04", "target":"10", "value":"10"},
{"source":"05", "target":"10", "value":"10"},
{"source":"06", "target":"10", "value":"10"},
{"source":"07", "target":"10", "value":"10"},
{"source":"08", "target":"10", "value":"10"},
{"source":"09", "target":"10", "value":"10"},
{"source":"000", "target":"10", "value":"10"},
{"source":"00", "target":"11", "value":"10"},
{"source":"01", "target":"11", "value":"10"},
{"source":"02", "target":"11", "value":"10"},
{"source":"03", "target":"11", "value":"10"},
{"source":"04", "target":"11", "value":"10"},
{"source":"05", "target":"11", "value":"10"},
{"source":"06", "target":"11", "value":"10"},
{"source":"07", "target":"11", "value":"10"},
{"source":"08", "target":"11", "value":"10"},
{"source":"09", "target":"11", "value":"10"},
{"source":"000", "target":"11", "value":"10"},
{"source":"00", "target":"12", "value":"10"},
{"source":"01", "target":"12", "value":"10"},
{"source":"02", "target":"12", "value":"10"},
{"source":"03", "target":"12", "value":"10"},
{"source":"04", "target":"12", "value":"10"},
{"source":"05", "target":"12", "value":"10"},
{"source":"06", "target":"12", "value":"10"},
{"source":"07", "target":"12", "value":"10"},
{"source":"08", "target":"12", "value":"10"},
{"source":"09", "target":"12", "value":"10"},
{"source":"000", "target":"12", "value":"10"},
{"source":"00", "target":"13", "value":"10"},
{"source":"01", "target":"13", "value":"10"},
{"source":"02", "target":"13", "value":"10"},
{"source":"03", "target":"13", "value":"10"},
{"source":"04", "target":"13", "value":"10"},
{"source":"05", "target":"13", "value":"10"},
{"source":"06", "target":"13", "value":"10"},
{"source":"07", "target":"13", "value":"10"},
{"source":"08", "target":"13", "value":"10"},
{"source":"09", "target":"13", "value":"10"},
{"source":"000", "target":"13", "value":"10"},
{"source":"00", "target":"14", "value":"10"},
{"source":"01", "target":"14", "value":"10"},
{"source":"02", "target":"14", "value":"10"},
{"source":"03", "target":"14", "value":"10"},
{"source":"04", "target":"14", "value":"10"},
{"source":"05", "target":"14", "value":"10"},
{"source":"06", "target":"14", "value":"10"},
{"source":"07", "target":"14", "value":"10"},
{"source":"08", "target":"14", "value":"10"},
{"source":"09", "target":"14", "value":"10"},
{"source":"000", "target":"14", "value":"10"},
{"source":"00", "target":"15", "value":"10"},
{"source":"01", "target":"15", "value":"10"},
{"source":"02", "target":"15", "value":"10"},
{"source":"03", "target":"15", "value":"10"},
{"source":"04", "target":"15", "value":"10"},
{"source":"05", "target":"15", "value":"10"},
{"source":"06", "target":"15", "value":"10"},
{"source":"07", "target":"15", "value":"10"},
{"source":"08", "target":"15", "value":"10"},
{"source":"09", "target":"15", "value":"10"},
{"source":"000", "target":"15", "value":"10"},
{"source":"00", "target":"16", "value":"10"},
{"source":"01", "target":"16", "value":"10"},
{"source":"02", "target":"16", "value":"10"},
{"source":"03", "target":"16", "value":"10"},
{"source":"04", "target":"16", "value":"10"},
{"source":"05", "target":"16", "value":"10"},
{"source":"06", "target":"16", "value":"10"},
{"source":"07", "target":"16", "value":"10"},
{"source":"08", "target":"16", "value":"10"},
{"source":"09", "target":"16", "value":"10"},
{"source":"000", "target":"16", "value":"10"},
{"source":"00", "target":"17", "value":"10"},
{"source":"01", "target":"17", "value":"10"},
{"source":"02", "target":"17", "value":"10"},
{"source":"03", "target":"17", "value":"10"},
{"source":"04", "target":"17", "value":"10"},
{"source":"05", "target":"17", "value":"10"},
{"source":"06", "target":"17", "value":"10"},
{"source":"07", "target":"17", "value":"10"},
{"source":"08", "target":"17", "value":"10"},
{"source":"09", "target":"17", "value":"10"},
{"source":"000", "target":"17", "value":"10"},
{"source":"00", "target":"18", "value":"10"},
{"source":"01", "target":"18", "value":"10"},
{"source":"02", "target":"18", "value":"10"},
{"source":"03", "target":"18", "value":"10"},
{"source":"04", "target":"18", "value":"10"},
{"source":"05", "target":"18", "value":"10"},
{"source":"06", "target":"18", "value":"10"},
{"source":"07", "target":"18", "value":"10"},
{"source":"08", "target":"18", "value":"10"},
{"source":"09", "target":"18", "value":"10"},
{"source":"000", "target":"18", "value":"10"},
{"source":"00", "target":"19", "value":"10"},
{"source":"01", "target":"19", "value":"10"},
{"source":"02", "target":"19", "value":"10"},
{"source":"03", "target":"19", "value":"10"},
{"source":"04", "target":"19", "value":"10"},
{"source":"05", "target":"19", "value":"10"},
{"source":"06", "target":"19", "value":"10"},
{"source":"07", "target":"19", "value":"10"},
{"source":"08", "target":"19", "value":"10"},
{"source":"09", "target":"19", "value":"10"},
{"source":"000", "target":"19", "value":"10"},
{"source":"00", "target":"111", "value":"10"},
{"source":"01", "target":"111", "value":"10"},
{"source":"02", "target":"111", "value":"10"},
{"source":"03", "target":"111", "value":"10"},
{"source":"04", "target":"111", "value":"10"},
{"source":"05", "target":"111", "value":"10"},
{"source":"06", "target":"111", "value":"10"},
{"source":"07", "target":"111", "value":"10"},
{"source":"08", "target":"111", "value":"10"},
{"source":"09", "target":"111", "value":"10"},
{"source":"000", "target":"111", "value":"10"},
{"source":"10", "target":"20", "value":"10"},
{"source":"11", "target":"20", "value":"10"},
{"source":"12", "target":"20", "value":"10"},
{"source":"13", "target":"20", "value":"10"},
{"source":"14", "target":"20", "value":"10"},
{"source":"15", "target":"20", "value":"10"},
{"source":"16", "target":"20", "value":"10"},
{"source":"17", "target":"20", "value":"10"},
{"source":"18", "target":"20", "value":"10"},
{"source":"19", "target":"20", "value":"10"},
{"source":"111", "target":"20", "value":"10"},
{"source":"10", "target":"21", "value":"10"},
{"source":"11", "target":"21", "value":"10"},
{"source":"12", "target":"21", "value":"10"},
{"source":"13", "target":"21", "value":"10"},
{"source":"14", "target":"21", "value":"10"},
{"source":"15", "target":"21", "value":"10"},
{"source":"16", "target":"21", "value":"10"},
{"source":"17", "target":"21", "value":"10"},
{"source":"18", "target":"21", "value":"10"},
{"source":"19", "target":"21", "value":"10"},
{"source":"111", "target":"21", "value":"10"},
{"source":"10", "target":"22", "value":"10"},
{"source":"11", "target":"22", "value":"10"},
{"source":"12", "target":"22", "value":"10"},
{"source":"13", "target":"22", "value":"10"},
{"source":"14", "target":"22", "value":"10"},
{"source":"15", "target":"22", "value":"10"},
{"source":"16", "target":"22", "value":"10"},
{"source":"17", "target":"22", "value":"10"},
{"source":"18", "target":"22", "value":"10"},
{"source":"19", "target":"22", "value":"10"},
{"source":"111", "target":"22", "value":"10"},
{"source":"10", "target":"23", "value":"10"},
{"source":"11", "target":"23", "value":"10"},
{"source":"12", "target":"23", "value":"10"},
{"source":"13", "target":"23", "value":"10"},
{"source":"14", "target":"23", "value":"10"},
{"source":"15", "target":"23", "value":"10"},
{"source":"16", "target":"23", "value":"10"},
{"source":"17", "target":"23", "value":"10"},
{"source":"18", "target":"23", "value":"10"},
{"source":"19", "target":"23", "value":"10"},
{"source":"111", "target":"23", "value":"10"},
{"source":"10", "target":"24", "value":"10"},
{"source":"11", "target":"24", "value":"10"},
{"source":"12", "target":"24", "value":"10"},
{"source":"13", "target":"24", "value":"10"},
{"source":"14", "target":"24", "value":"10"},
{"source":"15", "target":"24", "value":"10"},
{"source":"16", "target":"24", "value":"10"},
{"source":"17", "target":"24", "value":"10"},
{"source":"18", "target":"24", "value":"10"},
{"source":"19", "target":"24", "value":"10"},
{"source":"111", "target":"24", "value":"10"},
{"source":"10", "target":"25", "value":"10"},
{"source":"11", "target":"25", "value":"10"},
{"source":"12", "target":"25", "value":"10"},
{"source":"13", "target":"25", "value":"10"},
{"source":"14", "target":"25", "value":"10"},
{"source":"15", "target":"25", "value":"10"},
{"source":"16", "target":"25", "value":"10"},
{"source":"17", "target":"25", "value":"10"},
{"source":"18", "target":"25", "value":"10"},
{"source":"19", "target":"25", "value":"10"},
{"source":"111", "target":"25", "value":"10"},
{"source":"10", "target":"26", "value":"10"},
{"source":"11", "target":"26", "value":"10"},
{"source":"12", "target":"26", "value":"10"},
{"source":"13", "target":"26", "value":"10"},
{"source":"14", "target":"26", "value":"10"},
{"source":"15", "target":"26", "value":"10"},
{"source":"16", "target":"26", "value":"10"},
{"source":"17", "target":"26", "value":"10"},
{"source":"18", "target":"26", "value":"10"},
{"source":"19", "target":"26", "value":"10"},
{"source":"111", "target":"26", "value":"10"},
{"source":"10", "target":"27", "value":"10"},
{"source":"11", "target":"27", "value":"10"},
{"source":"12", "target":"27", "value":"10"},
{"source":"13", "target":"27", "value":"10"},
{"source":"14", "target":"27", "value":"10"},
{"source":"15", "target":"27", "value":"10"},
{"source":"16", "target":"27", "value":"10"},
{"source":"17", "target":"27", "value":"10"},
{"source":"18", "target":"27", "value":"10"},
{"source":"19", "target":"27", "value":"10"},
{"source":"111", "target":"27", "value":"10"},
{"source":"10", "target":"28", "value":"10"},
{"source":"11", "target":"28", "value":"10"},
{"source":"12", "target":"28", "value":"10"},
{"source":"13", "target":"28", "value":"10"},
{"source":"14", "target":"28", "value":"10"},
{"source":"15", "target":"28", "value":"10"},
{"source":"16", "target":"28", "value":"10"},
{"source":"17", "target":"28", "value":"10"},
{"source":"18", "target":"28", "value":"10"},
{"source":"19", "target":"28", "value":"10"},
{"source":"111", "target":"28", "value":"10"},
{"source":"10", "target":"29", "value":"10"},
{"source":"11", "target":"29", "value":"10"},
{"source":"12", "target":"29", "value":"10"},
{"source":"13", "target":"29", "value":"10"},
{"source":"14", "target":"29", "value":"10"},
{"source":"15", "target":"29", "value":"10"},
{"source":"16", "target":"29", "value":"10"},
{"source":"17", "target":"29", "value":"10"},
{"source":"18", "target":"29", "value":"10"},
{"source":"19", "target":"29", "value":"10"},
{"source":"111", "target":"29", "value":"10"},
{"source":"10", "target":"222", "value":"10"},
{"source":"11", "target":"222", "value":"10"},
{"source":"12", "target":"222", "value":"10"},
{"source":"13", "target":"222", "value":"10"},
{"source":"14", "target":"222", "value":"10"},
{"source":"15", "target":"222", "value":"10"},
{"source":"16", "target":"222", "value":"10"},
{"source":"17", "target":"222", "value":"10"},
{"source":"18", "target":"222", "value":"10"},
{"source":"19", "target":"222", "value":"10"},
{"source":"111", "target":"222", "value":"10"}
]

biHiSankey
  .nodes(exampleNodes)
  .links(exampleLinks)
  .initializeNodes(function (node) {
    node.state = node.parent ? "contained" : "collapsed";
  })
  .layout(LAYOUT_INTERATIONS);

disableUserInterractions(2 * TRANSITION_DURATION);

update();