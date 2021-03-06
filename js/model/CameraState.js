/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

function copyIfSet(dest, src, prop) {
    if (src.hasOwnProperty(prop)) {
        dest[prop] = src[prop];
    }
}

export var CameraState = {
    opacity: 1.0,
    angle: 0,
    clipped: false,
    clipXOffset: 0,
    clipYOffset: 0,
    clipWidthFactor: 1,
    clipHeightFactor: 1,

    init(svgRoot) {
        this.svgRoot = svgRoot;

        var initialBBox = svgRoot.getBBox();

        // Center coordinates
        this.cx = initialBBox.x + initialBBox.width / 2;
        this.cy = initialBBox.y + initialBBox.height / 2;

        // Dimensions
        this.width = initialBBox.width;
        this.height = initialBBox.height;

        return this;
    },

    initFrom(state) {
        this.svgRoot = state.svgRoot;
        this.cx = state.cx;
        this.cy = state.cy;
        this.width = state.width;
        this.height = state.height;
        this.opacity = state.opacity;
        this.angle = state.angle;
        this.clipped = state.clipped;
        this.clipXOffset = state.clipXOffset;
        this.clipYOffset = state.clipYOffset;
        this.clipWidthFactor = state.clipWidthFactor;
        this.clipHeightFactor = state.clipHeightFactor;
        return this;
    },

    toStorable() {
        return {
            cx: this.cx,
            cy: this.cy,
            width: this.width,
            height: this.height,
            opacity: this.opacity,
            angle: this.angle,
            clipped: this.clipped,
            clipXOffset: this.clipXOffset,
            clipYOffset: this.clipYOffset,
            clipWidthFactor: this.clipWidthFactor,
            clipHeightFactor: this.clipHeightFactor
        };
    },

    toMinimalStorable() {
        return this.toStorable();
    },

    fromStorable(storable) {
        copyIfSet(this, storable, "cx");
        copyIfSet(this, storable, "cy");
        copyIfSet(this, storable, "width");
        copyIfSet(this, storable, "height");
        copyIfSet(this, storable, "opacity");
        copyIfSet(this, storable, "angle");
        copyIfSet(this, storable, "clipped");
        copyIfSet(this, storable, "clipXOffset");
        copyIfSet(this, storable, "clipYOffset");
        copyIfSet(this, storable, "clipWidthFactor");
        copyIfSet(this, storable, "clipHeightFactor");
        return this;
    },

    /*
     * Set the angle of the current camera state.
     * The angle of the current state is normalized
     * in the interval [-180 ; 180]
     */
    setAngle(angle) {
        this.angle = (angle + 180) % 360 - 180;
        return this;
    },

    /*
     * Set the current camera's properties to the given SVG element.
     *
     * Otherwise, the properties of the frame are based on the bounding box
     * of the given element.
     *
     * Parameters:
     *    - svgElement: an element from the SVG DOM
     */
    setAtElement(svgElement, deltaX, deltaY, widthFactor, heightFactor, deltaAngle) {
        deltaX = deltaX || 0;
        deltaY = deltaY || 0;
        widthFactor = widthFactor || 1;
        heightFactor = heightFactor || 1;
        deltaAngle = deltaAngle || 0;

        // Read the raw bounding box of the given SVG element
        var b = svgElement.getBBox();

        // Compute the raw coordinates of the center
        // of the given SVG element
        var c = this.svgRoot.createSVGPoint();
        c.x = b.x + b.width  / 2;
        c.y = b.y + b.height / 2;

        // Find the transform group corresponding to the layer
        // that contains the given element
        var layerGroup = svgElement;
        while (layerGroup.parentNode.parentNode !== this.svgRoot) {
            layerGroup = layerGroup.parentNode;
        }

        // Compute the coordinates of the center of the given SVG element
        // after its current transformation
        var matrix = layerGroup.getCTM().inverse().multiply(svgElement.getCTM());
        c = c.matrixTransform(matrix);

        // Compute the scaling factor applied to the given SVG element
        var scale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);

        // Update the camera to match the bounding box information of the
        // given SVG element after its current transformation
        this.cx     = c.x + deltaX;
        this.cy     = c.y + deltaY;
        this.width  = b.width  * scale * widthFactor;
        this.height = b.height * scale * heightFactor;
        this.angle  = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI + deltaAngle;

        return this;
    },

    resetClipping() {
        this.clipXOffset = this.clipYOffset = 0;
        this.clipWidthFactor = this.clipHeightFactor = 1;
        return this;
    },

    offsetFromElement(svgElement) {
        var cam = Object.create(CameraState).init(this.svgRoot).setAtElement(svgElement);
        return {
            deltaX: this.cx - cam.cx,
            deltaY: this.cy - cam.cy,
            widthFactor: this.width / cam.width,
            heightFactor: this.height / cam.height,
            deltaAngle: this.angle - cam.angle
        };
    }
};
