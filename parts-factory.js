/*
 PLAN:
 - [X] Use width/height field to generate a single rect pad in a svg
 - [X] Make the svg file downloadable
 - [X] Add smt/tht option
 - [X] Add repeat/interval options
 - [X] Add multi-side options
 - [X] Add round shapes
 - [X] Add holes support
 - [X] Add stencil options
 - [X] Add multi-groups options
 - [X] Add oblong pads
 - [X] Add cut-corner rectangle
 - [X] Add smd-bottom option
 - [X] Add Grid
 - [ ] Add View translation
 - [ ] Add terminals placement (center, top, left, right, bottom, grid)
 - [ ] Add package name / file name
 */

(function() {

    'use strict';

    var Pad = React.createClass({
        render: function () {
            var left = this.props.x - this.props.width * 0.5;
            var right = this.props.x + this.props.width * 0.5;
            var top = this.props.y - this.props.height * 0.5;
            var bottom = this.props.y + this.props.height * 0.5;
            var shape;
            switch (this.props.shape) {
                case "circle":
                    shape = React.createElement("circle", {
                        id: "connector" + this.props.index + "pin",
                        fill: "#f7bd13",
                        stroke: "none",
                        strokeWidth: "0",
                        r: this.props.radius,
                        cx: this.props.x,
                        cy: this.props.y,
                        onClick: this.props.onClick
                    });
                    break;
                case "oblong":
                    var roundRadius = Math.min(this.props.width, this.props.height) * 0.5;
                    var circleTangentLength = (1 - 0.551915024494) * roundRadius;
                    shape = React.createElement("path", {
                        id: "connector" + this.props.index + "pin",
                        fill: "#f7bd13",
                        stroke: "none",
                        strokeWidth: "0",
                        d: [
                            "M", left, top + roundRadius,
                            "C",
                            left, top + circleTangentLength,
                            left + circleTangentLength, top,
                            left + roundRadius, top,
                            "L",
                            right - roundRadius, top,
                            "C",
                            right - circleTangentLength, top,
                            right, top + circleTangentLength,
                            right, top + roundRadius,
                            "L",
                            right, bottom - roundRadius,
                            "C",
                            right, bottom - circleTangentLength,
                            right - circleTangentLength, bottom,
                            right - roundRadius, bottom,
                            "L",
                            left + roundRadius, bottom,
                            "C",
                            left + circleTangentLength, bottom,
                            left, bottom - circleTangentLength,
                            left, bottom - roundRadius,
                            "z"
                        ].join(" "),
                        onClick: this.props.onClick
                    });
                    break;
                case "keyed rectangle":
                    var keySize = Math.min(this.props.keySize, this.props.width, this.props.height);
                    shape = React.createElement("path", {
                        id: "connector" + this.props.index + "pin",
                        fill: "#f7bd13",
                        stroke: "none",
                        strokeWidth: "0",
                        d: [
                            "M", left + keySize, top,
                            "L", right, top,
                            "L", right, bottom,
                            "L", left, bottom,
                            "L", left, top + keySize,
                            "z"
                        ].join(" "),
                        onClick: this.props.onClick
                    });
                    break;
                case "rectangle":
                    shape = React.createElement("rect", {
                        id: "connector" + this.props.index + "pin",
                        fill: "#f7bd13",
                        stroke: "none",
                        strokeWidth: "0",
                        width: this.props.width,
                        height: this.props.height,
                        x: left,
                        y: top,
                        onClick: this.props.onClick
                    });
                    break;
            }

            if (this.props.type === "smd")
                return React.createElement("g", null,
                    shape,
                    React.createElement("rect", {
                        id: "connector" + this.props.index + "terminal",
                        width: 0,
                        height: 0,
                        x: this.props.x - this.props.width * 0.5,
                        y: this.props.y
                    })
                );
            else
                return React.createElement("g", null,
                    shape,
                    React.createElement("circle", {
                        id: "connector" + this.props.index + "pin",
                        fill: "#cc4c4c",
                        stroke: "none",
                        strokeWidth: "0",
                        r: this.props.holeRadius,
                        cx: this.props.x,
                        cy: this.props.y,
                        onClick: this.props.onClick
                    }));
        }
    });

    function supportsLocalStorage() {
        try {
            return 'localStorage' in window && window.localStorage !== null;
        } catch (e) {
            return false;
        }
    }

    function convertPathsToSVGPath(paths) {
        var d = [];
        for (var i = 0; i < paths.length; ++i) {
            var path = paths[i];
            if (path.length) {
                d.push("M");
                for (var j = 0; j < path.length; ++j) {
                    d.push(path[j].x);
                    d.push(path[j].y);
                }
                d.push("z");
            }
        }
        return d.join(" ");
    }

    function addSectionAtTime(segmentSections, t, dLefts, dRights, isStart) {
        if (segmentSections.length) {
            var lastSection = segmentSections[segmentSections.length - 1];
            var comparator = isStart ? Math.min : Math.max;
            if (lastSection.t === t) {
                lastSection.dLeft = comparator(lastSection.dLeft, dLefts[0].d);
                lastSection.dRight = comparator(lastSection.dRight, dRights[0].d);
                return;
            }
        }
        segmentSections.push({t: t, dLeft: dLefts[0].d, dRight: dRights[0].d});
    }

    function convertSectionsToPaths(segmentSections, paths, start, deltaX, deltaY, deltaDot) {
        var currentSegmentSections = [];
        for (var i = 0; i < segmentSections.length; ++i) {
            var section = segmentSections[i];
            if (-section.dLeft >= section.dRight || -section.dRight >= section.dLeft) {
                if (currentSegmentSections.length > 0) {
                    var lastSection = currentSegmentSections[currentSegmentSections.length - 1];
                    currentSegmentSections.push({t: section.t, dLeft: lastSection.dLeft, dRight: lastSection.dRight});
                    convertClosedSectionsToPath(currentSegmentSections, paths, start, deltaX, deltaY, deltaDot);
                    currentSegmentSections = [];
                }
            } else {
                currentSegmentSections.push(section);
            }
        }
        if (currentSegmentSections.length > 0)
            convertClosedSectionsToPath(currentSegmentSections, paths, start, deltaX, deltaY, deltaDot);
    }

    function convertClosedSectionsToPath(segmentSections, paths, start, deltaX, deltaY, deltaDot) {
        var newPath = [];
        var crossX = -deltaY / Math.sqrt(deltaDot);
        var crossY = deltaX / Math.sqrt(deltaDot);
        var section;
        var nextSection;
        for (var i = 0; i < segmentSections.length - 1; ++i) {
            section = segmentSections[i];
            nextSection = segmentSections[i + 1];
            newPath.push({
                x: start.x + deltaX * section.t + crossX * section.dLeft,
                y: start.y + deltaY * section.t + crossY * section.dLeft
            });
            newPath.push({
                x: start.x + deltaX * nextSection.t + crossX * section.dLeft,
                y: start.y + deltaY * nextSection.t + crossY * section.dLeft
            });
        }
        for (i = segmentSections.length - 1; i >= 1; --i) {
            section = segmentSections[i];
            nextSection = segmentSections[i - 1];
            newPath.push({
                x: start.x + deltaX * section.t - crossX * nextSection.dRight,
                y: start.y + deltaY * section.t - crossY * nextSection.dRight
            });
            newPath.push({
                x: start.x + deltaX * nextSection.t - crossX * nextSection.dRight,
                y: start.y + deltaY * nextSection.t - crossY * nextSection.dRight
            });
        }
        paths.push(newPath);
    }

    var SilkScreenElement = React.createClass({
        render: function () {
            var thickness = Math.min(this.props.width * 0.5, this.props.height * 0.5, this.props.thickness);
            var left = this.props.x - (this.props.width - thickness) * 0.5;
            var right = this.props.x + (this.props.width - thickness) * 0.5;
            var top = this.props.y - (this.props.height - thickness) * 0.5;
            var bottom = this.props.y + (this.props.height - thickness) * 0.5;
            var halfThickness = thickness * 0.5;
            var segments = [
                {start: {x: left - halfThickness, y: top}, stop: {x: right - halfThickness, y: top}},
                {start: {x: right + halfThickness, y: bottom}, stop: {x: left + halfThickness, y: bottom}},
                {start: {x: left, y: bottom + halfThickness}, stop: {x: left, y: top + halfThickness}},
                {start: {x: right, y: top - halfThickness}, stop: {x: right, y: bottom - halfThickness}}
            ];
            var paths = [];
            for (var i = 0; i < segments.length; ++i) {
                var start = segments[i].start;
                var stop = segments[i].stop;
                var eventId = 0;
                var events = [];
                var deltaX = stop.x - start.x;
                var deltaY = stop.y - start.y;
                var deltaDot = deltaX * deltaX + deltaY * deltaY;
                if (deltaDot > 0) {
                    for (var j = 0; j < this.props.pads.length; ++j) {
                        var pad = this.props.pads[j];

                        var xMin = pad.x - pad.width * 0.5 - this.props.clearance;
                        var xMax = pad.x + pad.width * 0.5 + this.props.clearance;
                        var yMin = pad.y - pad.height * 0.5 - this.props.clearance;
                        var yMax = pad.y + pad.height * 0.5 + this.props.clearance;

                        var p1X = xMin - start.x;
                        var p1Y = yMin - start.y;
                        var p2X = xMin - start.x;
                        var p2Y = yMax - start.y;
                        var p3X = xMax - start.x;
                        var p3Y = yMin - start.y;
                        var p4X = xMax - start.x;
                        var p4Y = yMax - start.y;

                        var p1Dot = p1X * deltaX + p1Y * deltaY;
                        var p2Dot = p2X * deltaX + p2Y * deltaY;
                        var p3Dot = p3X * deltaX + p3Y * deltaY;
                        var p4Dot = p4X * deltaX + p4Y * deltaY;

                        var p1T = p1Dot / deltaDot;
                        var p2T = p2Dot / deltaDot;
                        var p3T = p3Dot / deltaDot;
                        var p4T = p4Dot / deltaDot;

                        var minT = Math.min(p1T, p2T, p3T, p4T);
                        var maxT = Math.max(p1T, p2T, p3T, p4T);

                        if (minT < 1.0 && maxT > 0.0) {
                            minT = Math.max(0, minT);
                            maxT = Math.min(1, maxT);
                            if (minT !== maxT) {
                                var p1dX = p1X - p1T * deltaX;
                                var p1dY = p1Y - p1T * deltaY;

                                var p2dX = p2X - p2T * deltaX;
                                var p2dY = p2Y - p2T * deltaY;

                                var p3dX = p3X - p3T * deltaX;
                                var p3dY = p3Y - p3T * deltaY;

                                var p4dX = p4X - p4T * deltaX;
                                var p4dY = p4Y - p4T * deltaY;

                                var p1Cross = deltaX * p1dY - deltaY * p1dX;
                                var p2Cross = deltaX * p2dY - deltaY * p2dX;
                                var p3Cross = deltaX * p3dY - deltaY * p3dX;
                                var p4Cross = deltaX * p4dY - deltaY * p4dX;

                                var criterion = halfThickness * Math.sqrt(deltaDot);

                                var leftOrOn = (p1Cross >= -criterion) + (p2Cross >= -criterion) + (p3Cross >= -criterion) + (p4Cross >= -criterion);
                                var rightOnOn = (p1Cross <= criterion) + (p2Cross <= criterion) + (p3Cross <= criterion) + (p4Cross <= criterion);

                                var minD;
                                if (leftOrOn === 4) {
                                    minD = (Math.min(p1Cross, p2Cross, p3Cross, p4Cross)) / Math.sqrt(deltaDot);
                                    if (minD < halfThickness) {
                                        events.push({t: minT, isStart: true, isLeft: true, d: minD, eventId: eventId});
                                        events.push({t: maxT, isStart: false, isLeft: true, eventId: eventId});
                                        ++eventId;
                                    }
                                } else if (rightOnOn === 4) {
                                    minD = -(Math.max(p1Cross, p2Cross, p3Cross, p4Cross)) / Math.sqrt(deltaDot);
                                    if (minD < halfThickness) {
                                        events.push({t: minT, isStart: true, isLeft: false, d: minD, eventId: eventId});
                                        events.push({t: maxT, isStart: false, isLeft: false, eventId: eventId});
                                        ++eventId;
                                    }
                                } else {
                                    events.push({t: minT, isStart: true, isCut: true, eventId: eventId});
                                    events.push({t: maxT, isStart: false, isCut: true, eventId: eventId});
                                    ++eventId;
                                }
                            }
                        }
                    }
                }
                events.sort(function (a, b) {
                    return a.t === b.t ? a.isStart - b.isStart : a.t - b.t;
                });

                var cutCount = 0;
                var dLefts = [{d: halfThickness, eventId: -1}];
                var dRights = [{d: halfThickness, eventId: -1}];
                var segmentSections = [];
                addSectionAtTime(segmentSections, 0.0, dLefts, dRights, false);

                for (var k = 0; k < events.length; ++k) {
                    var event = events[k];
                    if (event.isCut) {
                        if (cutCount === 1 && !event.isStart)
                            addSectionAtTime(segmentSections, event.t, dLefts, dRights, false);
                        if (cutCount === 0 && event.isStart) {
                            addSectionAtTime(segmentSections, event.t, dLefts, dRights, true);
                            convertSectionsToPaths(segmentSections, paths, start, deltaX, deltaY, deltaDot);
                            segmentSections = [];
                        }
                        cutCount += event.isStart ? 1 : -1;
                    } else {
                        var dArray = event.isLeft ? dLefts : dRights;
                        if (event.isStart) {
                            dArray.push({d: event.d, eventId: event.eventId});
                            dArray.sort(function (a, b) {
                                return a.d - b.d;
                            });
                        } else {
                            for (var n = 0; n < dArray.length; ++n)
                                if (dArray[n].eventId === event.eventId) {
                                    dArray.splice(n, 1);
                                    break;
                                }
                        }
                        if (cutCount === 0)
                            addSectionAtTime(segmentSections, event.t, dLefts, dRights, event.isStart);
                    }
                }
                if (segmentSections.length) {
                    addSectionAtTime(segmentSections, 1.0, dLefts, dRights, false);
                    convertSectionsToPaths(segmentSections, paths, start, deltaX, deltaY, deltaDot);
                }
            }

            return React.createElement("path", {
                fill: "#000",
                stroke: "none",
                strokeWidth: 0,
                d: convertPathsToSVGPath(paths)
            });
        }
    });

    var FloatProperty = React.createClass({
        getInitialState: function () {
            return {
                rawValue: (this.props.value === null || this.props.value === undefined) ? "" : this.props.value.toString()
            };
        },
        render: function () {
            return React.createElement("label", null,
                this.props.label,
                React.createElement("input", {
                    type: "number",
                    step: "0.1",
                    className: isNaN(parseFloat(this.state.rawValue)) ? "invalid" : "",
                    value: this.state.rawValue,
                    onChange: this.onChange,
                    onBlur: this.onBlur
                }));
        },
        onChange: function (e) {
            var callback;
            var parsedValue = parseFloat(e.target.value);
            if (!isNaN(parsedValue) && parsedValue !== this.props.value)
                callback = this.props.onChange.bind(this, parsedValue);
            this.setState({rawValue: e.target.value}, callback);
        },
        onBlur: function () {
            this.setState({rawValue: this.props.value.toString()});
        },
        componentWillReceiveProps: function (newProps) {
            if (parseFloat(this.state.rawValue) !== newProps.value)
                this.setState({rawValue: newProps.value.toString()});
        }
    });

    var EnumProperty = React.createClass({
        render: function () {
            function createOption(option) {
                return React.createElement("option", {
                        key: option.value,
                        value: option.value
                    },
                    option.label);
            }

            return React.createElement("label", null,
                this.props.label,
                React.createElement("select", {
                        value: this.props.value,
                        onChange: this.onChange
                    },
                    this.props.options.map(createOption)));
        },
        onChange: function (e) {
            this.props.onChange(e.target.value);
        }
    });

    var PadGroup = React.createClass({
        render: function () {
            return React.createElement("div", {className: "parts-group-properties"},
                React.createElement("button", {onClick: this.props.remove}, "Remove"),
                React.createElement(EnumProperty, {
                    label: "Type",
                    options: [
                        {value: "smd", label: "SMD"},
                        {value: "tht", label: "THT"}],
                    onChange: this.props.setType,
                    value: this.props.type
                }),
                this.props.type === "tht" ? null : React.createElement(EnumProperty, {
                    label: "Layer",
                    options: [
                        {value: "top", label: "Top"},
                        {value: "bottom", label: "Bottom"}],
                    onChange: this.props.setLayer,
                    value: this.props.layer
                }),
                React.createElement(EnumProperty, {
                    label: "Sides",
                    options: [
                        {value: "single", label: "Single"},
                        {value: "double", label: "Double"},
                        {value: "quad", label: "Quad"}],
                    onChange: this.props.setSides,
                    value: this.props.sides
                }),
                this.props.sides === "quad" ? null : React.createElement(EnumProperty, {
                    label: "Orientation",
                    options: [
                        {value: "horizontal", label: "Horizontal"},
                        {value: "vertical", label: "Vertical"}],
                    onChange: this.props.setOrientation,
                    value: this.props.orientation
                }),
                this.props.sides === "single" ? null : React.createElement(FloatProperty, {
                    label: "Sides Distance",
                    onChange: this.props.setSidesDistance,
                    value: this.props.sidesDistance
                }),
                React.createElement(EnumProperty, {
                    label: "Shape",
                    options: [
                        {value: "circle", label: "Circle"},
                        {value: "oblong", label: "Oblong"},
                        {value: "rectangle", label: "Rectangle"},
                        {value: "keyed rectangle", label: "Keyed Rectangle"}],
                    onChange: this.props.setShape,
                    value: this.props.shape
                }),
                this.props.shape !== "circle" ? null : React.createElement(FloatProperty, {
                    label: "Radius",
                    onChange: this.props.setRadius,
                    value: this.props.radius
                }),
                this.props.shape === "circle" ? null : React.createElement(FloatProperty, {
                    label: "Width",
                    onChange: this.props.setWidth,
                    value: this.props.width
                }),
                this.props.shape === "circle" ? null : React.createElement(FloatProperty, {
                    label: "Height",
                    onChange: this.props.setHeight,
                    value: this.props.height
                }),
                this.props.shape !== "keyed rectangle" ? null : React.createElement(FloatProperty, {
                    label: "Key Size",
                    onChange: this.props.setKeySize,
                    value: this.props.keySize
                }),
                this.props.type === "smd" ? null : React.createElement(FloatProperty, {
                    label: "Hole Radius",
                    onChange: this.props.setHoleRadius,
                    value: this.props.holeRadius
                }),
                React.createElement(FloatProperty, {
                    label: "Repeat",
                    onChange: this.props.setRepeatCount,
                    value: this.props.repeatCount
                }),
                this.props.repeatCount <= 1 ? null : React.createElement(FloatProperty, {
                    label: "Interval",
                    onChange: this.props.setRepeatInterval,
                    value: this.props.repeatInterval
                }));
        }
    });

    var Part = React.createClass({
        getDefaultInitialState: function () {
            return {
                version: 0,
                selectedGroup: 0,
                zoom: 1,
                grid: {
                    size: 1
                },
                groups: [
                    {
                        type: "smd",
                        layer: "top",
                        sides: "quad",
                        shape: "rectangle",
                        orientation: "horizontal",
                        sidesDistance: 12,
                        radius: 1,
                        keySize: 0.2,
                        width: 1,
                        height: 2,
                        holeRadius: 0.5,
                        repeatCount: 10,
                        repeatInterval: 2
                    }
                ],
                silkScreenElements: [
                    {
                        width: 25,
                        height: 25,
                        thickness: 1,
                        clearance: 0.2
                    }
                ]
            };
        },
        getInitialState: function () {
            var initialState = this.getDefaultInitialState();
            if (supportsLocalStorage()) {
                var storedData = localStorage["parts-factory.data"];
                if (storedData !== undefined && storedData !== null) {
                    try {
                        // TODO: merge this with default state or properly handle version migration
                        initialState = JSON.parse(storedData);
                    } catch (e) {
                        if ('console' in window)
                            console.error(e);
                    }
                }
            }
            return initialState;
        },
        componentWillUpdate: function (newProps, newState) {
            function flatten(obj) {
                if (typeof obj === "object") {
                    if (Object.prototype.toString.call(obj) === "[object Array]") {
                        return obj.map(flatten);
                    } else {
                        var result = {};
                        for (var key in obj)
                            //noinspection JSUnfilteredForInLoop
                            if (typeof(obj[key] !== "function"))
                            //noinspection JSUnfilteredForInLoop
                                result[key] = flatten(obj[key]);
                        return result;
                    }
                } else
                    return obj;
            }

            if (supportsLocalStorage())
                setTimeout(function() {
                    localStorage["parts-factory.data"] = JSON.stringify(flatten(newState));
                }, 0);
        },
        componentWillMount: function() {
            this.storageListener = window.addEventListener("storage", this.onStorageChange, false);
        },
        componentWillUnmount: function() {
            window.removeEventListener("storage", this.storageListener, false);
            this.storageListener = null;
        },
        onStorageChange: function(storageEvent) {
            if (storageEvent.key === "parts-factory.data") {
                var newState = JSON.parse(storageEvent.newValue);
                if (newState.version > this.state.version)
                    this.setState(newState);
            }
        },
        setVersionedState: function (newState) {
            newState.version = (this.state.version || 0) + 1;
            this.setState(newState);
        },
        zoom: function (e) {
            this.setVersionedState({zoom: Math.max(1, this.state.zoom - 0.1 * e.deltaY)});
            e.preventDefault();
        },
        setGridSize: function (size) {
            this.setVersionedState({grid: {size: size}});
        },
        setGroupState: function (index) {
            var newGroups = this.state.groups.slice();
            newGroups[index] = Object.create(newGroups[index]);
            for (var i = 2; i < arguments.length; i += 2)
                newGroups[index][arguments[i - 1]] = arguments[i];
            this.setVersionedState({groups: newGroups});
        },
        setSilkScreenElementState: function (index) {
            var newElements = this.state.silkScreenElements.slice();
            newElements[index] = Object.create(newElements[index]);
            for (var i = 2; i < arguments.length; i += 2)
                newElements[index][arguments[i - 1]] = arguments[i];
            this.setVersionedState({silkScreenElements: newElements});
        },
        setShape: function (group, shape) {
            if (shape !== this.state.groups[group].shape) {
                if (shape === "circle") {
                    this.setGroupState(group,
                        "shape", shape,
                        "radius", 0.5 * Math.min(this.state.groups[group].width, this.state.groups[group].height));
                } else if (this.state.groups[group].shape === "circle") {
                    this.setGroupState(group,
                        "shape", shape,
                        "width", this.state.groups[group].radius * 2,
                        "height", this.state.groups[group].radius * 2);
                } else
                    this.setGroupState(group, "shape", shape);
            } else
                this.setGroupState(group, "shape", shape);
        },
        setRadius: function (group, radius) {
            this.setGroupState(group, "radius", radius);
        },
        setKeySize: function (group, keySize) {
            this.setGroupState(group, "keySize", keySize);
        },
        setWidth: function (group, width) {
            this.setGroupState(group, "width", width);
        },
        setHeight: function (group, height) {
            this.setGroupState(group, "height", height);
        },
        setHoleRadius: function (group, holeRadius) {
            this.setGroupState(group, "holeRadius", holeRadius);
        },
        setRepeatCount: function (group, repeatCount) {
            this.setGroupState(group, "repeatCount", repeatCount);
        },
        setRepeatInterval: function (group, repeatInterval) {
            this.setGroupState(group, "repeatInterval", repeatInterval);
        },
        setType: function (group, type) {
            this.setGroupState(group, "type", type);
        },
        setLayer: function (group, layer) {
            this.setGroupState(group, "layer", layer);
        },
        setSides: function (group, sides) {
            if (this.state.groups[group].orientation === "vertical" && (sides === "quad" || this.state.groups[group].sides === "quad"))
                this.setGroupState(group,
                    "sides", sides,
                    "width", this.state.groups[group].height,
                    "height", this.state.groups[group].width);
            else
                this.setGroupState(group, "sides", sides);
        },
        setOrientation: function (group, orientation) {
            if (orientation !== this.state.groups[group].orientation)
                this.setGroupState(group,
                    "orientation", orientation,
                    "width", this.state.groups[group].height,
                    "height", this.state.groups[group].width);
        },
        setSidesDistance: function (group, sidesDistance) {
            this.setGroupState(group, "sidesDistance", sidesDistance);
        },
        addGroup: function () {
            var newGroups = this.state.groups.slice();
            newGroups.push(this.getDefaultInitialState().groups[0]);
            this.setVersionedState({groups: newGroups});
        },
        removeGroup: function (groupIndex) {
            var newGroups = this.state.groups.slice();
            newGroups.splice(groupIndex, 1);
            this.setVersionedState({groups: newGroups});
        },
        setSilkScreenElementWidth: function (index, width) {
            this.setSilkScreenElementState(index, "width", width);
        },
        setSilkScreenElementHeight: function (index, height) {
            this.setSilkScreenElementState(index, "height", height);
        },
        setSilkScreenElementThickness: function (index, thickness) {
            this.setSilkScreenElementState(index, "thickness", thickness);
        },
        setSilkScreenElementClearance: function (index, clearance) {
            this.setSilkScreenElementState(index, "clearance", clearance);
        },
        addSilkScreenElement: function () {
            var newElements = this.state.silkScreenElements.slice();
            newElements.push(this.getDefaultInitialState().silkScreenElements[0]);
            this.setVersionedState({silkScreenElements: newElements});
        },
        removeSilkScreenElement: function (index) {
            var newElements = this.state.silkScreenElements.slice();
            newElements.splice(index, 1);
            this.setVersionedState({silkScreenElements: newElements});
        },
        downloadPart: function () {
            var svgContent = React.renderToStaticMarkup(this.renderSVG("file"));
            svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            var linkElement = document.createElement('a');
            linkElement.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svgContent));
            linkElement.setAttribute('download', 'part.svg');
            if (document.createEvent) {
                var clickEvent = document.createEvent('MouseEvents');
                clickEvent.initEvent('click', true, true);
                linkElement.dispatchEvent(clickEvent);
            } else {
                linkElement.click();
            }
        },
        render: function () {
            var size = this.getSize();
            return React.createElement("div", {className: "parts-factory"},
                React.createElement("div", {className: "parts-properties-panel"},
                    React.createElement("div", {className: "parts-properties-header"},
                        React.createElement("h1", null, "Parts Factory"),
                        React.createElement("div", {className: "parts-properties-actions"},
                            React.createElement("button", {onClick: this.addGroup}, "Add Pad Group"),
                            React.createElement("button", {onClick: this.addSilkScreenElement}, "Add Silk Screen Element"),
                            React.createElement("button", {onClick: this.downloadPart}, "Download"))),
                    React.createElement("div", {className: "parts-properties-content"},
                        React.createElement(FloatProperty, {
                            label: "Grid Size",
                            onChange: this.setGridSize,
                            value: this.state.grid.size
                        }),
                        this.state.groups.map(function (group, groupIndex) {
                            return React.createElement(PadGroup, {
                                key: "group" + groupIndex,
                                type: group.type,
                                layer: group.layer,
                                sides: group.sides,
                                orientation: group.orientation,
                                sidesDistance: group.sidesDistance,
                                shape: group.shape,
                                radius: group.radius,
                                keySize: group.keySize,
                                width: group.width,
                                height: group.height,
                                holeRadius: group.holeRadius,
                                repeatCount: group.repeatCount,
                                repeatInterval: group.repeatInterval,
                                setType: this.setType.bind(this, groupIndex),
                                setLayer: this.setLayer.bind(this, groupIndex),
                                setSides: this.setSides.bind(this, groupIndex),
                                setOrientation: this.setOrientation.bind(this, groupIndex),
                                setSidesDistance: this.setSidesDistance.bind(this, groupIndex),
                                setShape: this.setShape.bind(this, groupIndex),
                                setRadius: this.setRadius.bind(this, groupIndex),
                                setKeySize: this.setKeySize.bind(this, groupIndex),
                                setWidth: this.setWidth.bind(this, groupIndex),
                                setHeight: this.setHeight.bind(this, groupIndex),
                                setHoleRadius: this.setHoleRadius.bind(this, groupIndex),
                                setRepeatCount: this.setRepeatCount.bind(this, groupIndex),
                                setRepeatInterval: this.setRepeatInterval.bind(this, groupIndex),
                                remove: this.removeGroup.bind(this, groupIndex)
                            });
                        }, this),
                        this.state.silkScreenElements.map(function (silkScreenElement, index) {
                            return React.createElement("div", {
                                    className: "parts-silkscreen-properties",
                                    key: "silk" + index
                                },
                                React.createElement("button", {onClick: this.removeSilkScreenElement.bind(this, index)}, "Remove"),
                                React.createElement(FloatProperty, {
                                    label: "Width",
                                    onChange: this.setSilkScreenElementWidth.bind(this, index),
                                    value: silkScreenElement.width
                                }),
                                React.createElement(FloatProperty, {
                                    label: "Height",
                                    onChange: this.setSilkScreenElementHeight.bind(this, index),
                                    value: silkScreenElement.height
                                }),
                                React.createElement(FloatProperty, {
                                    label: "Thickness",
                                    onChange: this.setSilkScreenElementThickness.bind(this, index),
                                    value: silkScreenElement.thickness
                                }),
                                React.createElement(FloatProperty, {
                                    label: "Clearance",
                                    onChange: this.setSilkScreenElementClearance.bind(this, index),
                                    value: silkScreenElement.clearance
                                }));
                        }, this),
                        React.createElement("p", null, "Selected group: " + this.state.selectedGroup))),
                React.createElement("div", {
                        className: "preview",
                        title: "Total size: " + size.width + "x" + size.height + "mm",
                        onWheel: this.zoom
                    },
                    React.createElement("div", {
                            className: "preview-zoom-area",
                            style: {transform: "scale(" + this.state.zoom + ")"}
                        },
                        this.renderSVG("screen"))));
        },
        selectGroup: function (groupIndex) {
            this.setVersionedState({selectedGroup: groupIndex});
        },
        getSize: function () {
            var width = 0;
            var height = 0;
            for (var i = 0; i < this.state.groups.length; ++i) {
                var groupSize = this.getGroupSize(this.state.groups[i]);
                width = Math.max(width, groupSize.width);
                height = Math.max(height, groupSize.height);
            }
            for (i = 0; i < this.state.silkScreenElements.length; ++i) {
                width = Math.max(width, this.state.silkScreenElements[i].width);
                height = Math.max(height, this.state.silkScreenElements[i].height);
            }
            return {width: width, height: height};
        },
        getGroupSize: function (group) {
            var intervalX = group.orientation === "horizontal" ? group.repeatInterval : 0;
            var intervalY = group.orientation === "horizontal" ? 0 : group.repeatInterval;
            var padWidth = group.shape === "circle" ? group.radius * 2 : group.width;
            var padHeight = group.shape === "circle" ? group.radius * 2 : group.height;
            if (group.type === "tht") {
                padWidth = Math.max(padWidth, group.holeRadius * 2);
                padHeight = Math.max(padHeight, group.holeRadius * 2);
            }
            var width = (group.repeatCount - 1) * intervalX + padWidth;
            var height = (group.repeatCount - 1 ) * intervalY + padHeight;
            if (group.sides !== "single") {
                if (group.orientation === "horizontal")
                    height += 2 * group.sidesDistance;
                else
                    width += 2 * group.sidesDistance;
                if (group.sides === "quad") {
                    width = Math.max(width, height);
                    //noinspection JSSuspiciousNameCombination
                    height = width;
                }
            }
            return {width: width, height: height};
        },
        renderSVG: function (target) {
            var size = this.getSize();
            var smdTopPads = [];
            var smdBottomPads = [];
            var thtPads = [];
            var startIndex = 0;
            var allPads = [];
            for (var i = 0; i < this.state.groups.length; ++i) {
                var group = this.state.groups[i];
                var padList = this.getGroupPadList(group, size.width * 0.5, size.height * 0.5);
                var onClick = this.selectGroup.bind(this, i);
                var targetPads = group.type === "smd" ? (group.layer === "top" ? smdTopPads : smdBottomPads) : thtPads;
                padList.forEach(function (pad) {
                    allPads.push(pad);
                    targetPads.push(React.createElement(Pad, {
                        onClick: onClick,
                        key: startIndex,
                        type: group.type,
                        holeRadius: group.holeRadius,
                        index: startIndex,
                        shape: group.shape,
                        radius: group.radius,
                        keySize: group.keySize,
                        width: pad.width,
                        height: pad.height,
                        x: pad.x,
                        y: pad.y
                    }));
                    ++startIndex;
                });
            }
            return React.createElement("svg", {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: size.width + "mm",
                    height: size.height + "mm",
                    viewBox: "0 0 " + size.width + " " + size.height
                },
                target === "file" ? null : React.createElement("defs", null,
                    React.createElement("pattern", {
                            id: "grid",
                            x: 0,
                            y: 0,
                            width: this.state.grid.size,
                            height: this.state.grid.size,
                            patternUnits: "userSpaceOnUse",
                            patternContentUnits: "userSpaceOnUse"
                        },
                        React.createElement("rect", {
                            x: 0,
                            y: 0,
                            width: this.state.grid.size,
                            height: this.state.grid.size,
                            fill: "none",
                            stroke: "rgba(255, 255, 255, 0.2)",
                            strokeWidth: 0.01
                        }))),
                smdTopPads.length + thtPads.length === 0 ? null : React.createElement("g", {"id": "copper1"},
                    thtPads.length === 0 ? null : React.createElement("g", {"id": "copper0"}, thtPads),
                    smdTopPads),
                smdBottomPads.length === 0 ? null : React.createElement("g", {"id": "copper0"}, smdBottomPads),
                this.state.silkScreenElements.length === 0 ? null : React.createElement("g", {"id": "silkscreen"},
                    this.state.silkScreenElements.map(function (silkScreenElement, index) {
                        return React.createElement(SilkScreenElement, {
                            key: index,
                            width: silkScreenElement.width,
                            height: silkScreenElement.height,
                            x: size.width * 0.5,
                            y: size.height * 0.5,
                            clearance: silkScreenElement.clearance,
                            thickness: silkScreenElement.thickness,
                            pads: allPads
                        });
                    })),
                // XXX: this kills the onclick...
                target === "file" ? null : React.createElement("rect", {
                    x: 0,
                    y: 0,
                    width: size.width,
                    height: size.height,
                    pointerEvents: "none",
                    fill: "url(#grid)"
                })
            );
        },
        getGroupPadList: function (group, centerX, centerY) {
            var padList = [];

            function addList(width, height, centerX, centerY, intervalX, intervalY) {
                var x = centerX - ((group.repeatCount - 1) * intervalX) * 0.5;
                var y = centerY - ((group.repeatCount - 1) * intervalY) * 0.5;
                for (var i = 0; i < group.repeatCount; ++i) {
                    padList.push({
                        x: x,
                        y: y,
                        width: group.shape === "circle" ? group.radius * 2 : width,
                        height: group.shape === "circle" ? group.radius * 2 : height
                    });
                    x += intervalX;
                    y += intervalY;
                }
            }

            switch (group.sides) {
                case "single":
                    if (group.orientation === "horizontal")
                        addList(group.width, group.height, centerX, centerY, group.repeatInterval, 0);
                    else
                        addList(group.width, group.height, centerX, centerY, 0, group.repeatInterval);
                    break;
                case "double":
                    if (group.orientation === "horizontal") {
                        addList(group.width, group.height, centerX, centerY - group.sidesDistance, -group.repeatInterval, 0);
                        addList(group.width, group.height, centerX, centerY + group.sidesDistance, group.repeatInterval, 0);
                    } else {
                        addList(group.width, group.height, centerX - group.sidesDistance, centerY, 0, group.repeatInterval);
                        addList(group.width, group.height, centerX + group.sidesDistance, centerY, 0, -group.repeatInterval);
                    }
                    break;
                case "quad":
                    //noinspection JSSuspiciousNameCombination
                    addList(group.height, group.width, centerX - group.sidesDistance, centerY, 0, group.repeatInterval);
                    addList(group.width, group.height, centerX, centerY + group.sidesDistance, group.repeatInterval, 0);
                    //noinspection JSSuspiciousNameCombination
                    addList(group.height, group.width, centerX + group.sidesDistance, centerY, 0, -group.repeatInterval);
                    addList(group.width, group.height, centerX, centerY - group.sidesDistance, -group.repeatInterval, 0);
            }
            return padList;
        }
    });

    React.render(
        React.createElement(Part, null),
        document.getElementById("parts-factory"));

})();