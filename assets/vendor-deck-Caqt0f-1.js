var e=1e-6,t=typeof Float32Array<`u`?Float32Array:Array;Math.PI/180;function n(){let e=new t(3);return t!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e}function r(e){let t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)}function i(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e}function a(e,t){let n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)}function o(e){let t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r}function s(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e}function c(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function l(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[0],s=n[1],c=n[2];return e[0]=i*c-a*s,e[1]=a*o-r*c,e[2]=r*s-i*o,e}function u(e,t,n,r){let i=t[0],a=t[1],o=t[2];return e[0]=i+r*(n[0]-i),e[1]=a+r*(n[1]-a),e[2]=o+r*(n[2]-o),e}function d(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[3]*r+n[7]*i+n[11]*a+n[15];return o||=1,e[0]=(n[0]*r+n[4]*i+n[8]*a+n[12])/o,e[1]=(n[1]*r+n[5]*i+n[9]*a+n[13])/o,e[2]=(n[2]*r+n[6]*i+n[10]*a+n[14])/o,e}function f(e,t,n){let r=t[0],i=t[1],a=t[2];return e[0]=r*n[0]+i*n[3]+a*n[6],e[1]=r*n[1]+i*n[4]+a*n[7],e[2]=r*n[2]+i*n[5]+a*n[8],e}function p(e,t,n){let r=n[0],i=n[1],a=n[2],o=n[3],s=t[0],c=t[1],l=t[2],u=i*l-a*c,d=a*s-r*l,f=r*c-i*s,p=i*f-a*d,m=a*u-r*f,h=r*d-i*u,g=o*2;return u*=g,d*=g,f*=g,p*=2,m*=2,h*=2,e[0]=s+u+p,e[1]=c+d+m,e[2]=l+f+h,e}function m(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[0],a[1]=i[1]*Math.cos(r)-i[2]*Math.sin(r),a[2]=i[1]*Math.sin(r)+i[2]*Math.cos(r),e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function h(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[2]*Math.sin(r)+i[0]*Math.cos(r),a[1]=i[1],a[2]=i[2]*Math.cos(r)-i[0]*Math.sin(r),e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function g(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[0]*Math.cos(r)-i[1]*Math.sin(r),a[1]=i[0]*Math.sin(r)+i[1]*Math.cos(r),a[2]=i[2],e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function _(e,t){let n=e[0],r=e[1],i=e[2],a=t[0],o=t[1],s=t[2],l=Math.sqrt((n*n+r*r+i*i)*(a*a+o*o+s*s)),u=l&&c(e,t)/l;return Math.acos(Math.min(Math.max(u,-1),1))}var v=i,y=a,b=r,x=o;(function(){let e=n();return function(t,n,r,i,a,o){let s,c;for(n||=3,r||=0,c=i?Math.min(i*n+r,t.length):t.length,s=r;s<c;s+=n)e[0]=t[s],e[1]=t[s+1],e[2]=t[s+2],a(e,e,o),t[s]=e[0],t[s+1]=e[1],t[s+2]=e[2];return t}})();function S(e,t,n){if(e===t)return!0;if(!n||!e||!t)return!1;if(Array.isArray(e)){if(!Array.isArray(t)||e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!S(e[r],t[r],n-1))return!1;return!0}if(Array.isArray(t))return!1;if(typeof e==`object`&&typeof t==`object`){let r=Object.keys(e),i=Object.keys(t);if(r.length!==i.length)return!1;for(let i of r)if(!t.hasOwnProperty(i)||!S(e[i],t[i],n-1))return!1;return!0}return!1}function C(e,t){if(!t)return e;let n={...e,...t};if(`defines`in t&&(n.defines={...e.defines,...t.defines}),`modules`in t&&(n.modules=(e.modules||[]).concat(t.modules),t.modules.some(e=>e.name===`project64`))){let e=n.modules.findIndex(e=>e.name===`project32`);e>=0&&n.modules.splice(e,1)}if(`inject`in t)if(!e.inject)n.inject=t.inject;else{let r={...e.inject};for(let e in t.inject)r[e]=(r[e]||``)+t.inject[e];n.inject=r}return n}var w=class{static get componentName(){return Object.prototype.hasOwnProperty.call(this,`extensionName`)?this.extensionName:``}constructor(e){e&&(this.opts=e)}equals(e){return this===e?!0:this.constructor===e.constructor&&S(this.opts,e.opts,1)}getShaders(e){return null}getSubLayerProps(e){let{defaultProps:t}=e.constructor,n={updateTriggers:{}};for(let e in t)if(e in this.props){let r=t[e],i=this.props[e];n[e]=i,r&&r.type===`accessor`&&(n.updateTriggers[e]=this.props.updateTriggers[e],typeof i==`function`&&(n[e]=this.getSubLayerAccessor(i)))}return n}initializeState(e,t){}updateState(e,t){}onNeedsRedraw(e){}getNeedsPickingBuffer(e){return!1}draw(e,t){}finalizeState(e,t){}};w.defaultProps={},w.extensionName=`LayerExtension`;var T={inject:{"vs:#decl":`
in vec2 instanceDashArrays;
#ifdef HIGH_PRECISION_DASH
in float instanceDashOffsets;
#endif
out vec2 vDashArray;
out float vDashOffset;
`,"vs:#main-end":`
vDashArray = instanceDashArrays;
#ifdef HIGH_PRECISION_DASH
vDashOffset = instanceDashOffsets / width.x;
#else
vDashOffset = 0.0;
#endif
`,"fs:#decl":`
layout(std140) uniform pathStyleUniforms {
float dashAlignMode;
bool dashGapPickable;
} pathStyle;
in vec2 vDashArray;
in float vDashOffset;
`,"fs:#main-start":`
float solidLength = vDashArray.x;
float gapLength = vDashArray.y;
float unitLength = solidLength + gapLength;
float offset;
if (unitLength > 0.0) {
if (pathStyle.dashAlignMode == 0.0) {
offset = vDashOffset;
} else {
unitLength = vPathLength / round(vPathLength / unitLength);
offset = solidLength / 2.0;
}
float unitOffset = mod(vPathPosition.y + offset, unitLength);
if (gapLength > 0.0 && unitOffset > solidLength) {
if (path.capType <= 0.5) {
if (!(pathStyle.dashGapPickable && bool(picking.isActive))) {
discard;
}
} else {
float distToEnd = length(vec2(
min(unitOffset - solidLength, unitLength - unitOffset),
vPathPosition.x
));
if (distToEnd > 1.0) {
if (!(pathStyle.dashGapPickable && bool(picking.isActive))) {
discard;
}
}
}
}
}
`}},E={inject:{"vs:#decl":`
in vec2 instanceDashArrays;
out vec2 vDashArray;
`,"vs:#main-end":`
vDashArray = instanceDashArrays;
`,"fs:#decl":`
layout(std140) uniform pathStyleUniforms {
bool dashGapPickable;
} pathStyle;
in vec2 vDashArray;
#define PI 3.141592653589793
`,"fs:#main-start":`
bool inDashGap = false;
float dashUnitLength = vDashArray.x + vDashArray.y;
if (dashUnitLength > 0.0 && scatterplot.stroked > 0.5) {
float _distToCenter = length(unitPosition) * outerRadiusPixels;
float innerRadius = innerUnitRadius * outerRadiusPixels;
if (_distToCenter >= innerRadius) {
float strokeWidth = (1.0 - innerUnitRadius) * outerRadiusPixels;
float midStrokeRadius = (innerUnitRadius + 1.0) * 0.5 * outerRadiusPixels;
float angle = atan(unitPosition.y, unitPosition.x) + PI;
float circumference = 2.0 * PI * midStrokeRadius;
float posAlongStroke = (angle / (2.0 * PI)) * circumference / strokeWidth;
float unitOffset = mod(posAlongStroke, dashUnitLength);
if (unitOffset > vDashArray.x) {
if (scatterplot.filled > 0.5) {
inDashGap = true;
} else {
if (!(pathStyle.dashGapPickable && bool(picking.isActive))) {
discard;
}
}
}
}
}
`,"fs:#main-end":`
if (inDashGap) {
float alphaFactor = fragColor.a / max(vLineColor.a, 0.001);
fragColor = vec4(vFillColor.rgb, vFillColor.a * alphaFactor);
fragColor = picking_filterPickingColor(fragColor);
fragColor = picking_filterHighlightColor(fragColor);
}
`}},D={inject:{"vs:#decl":`
in vec2 instanceDashArrays;
out vec2 vDashArray;
`,"vs:#main-end":`
vDashArray = instanceDashArrays;
`,"fs:#decl":`
layout(std140) uniform pathStyleUniforms {
bool dashGapPickable;
} pathStyle;
in vec2 vDashArray;
#define PI 3.141592653589793
float getPerimeterPosition(vec2 fragUV, vec2 dims, vec4 radii, float lineWidth) {
float width = dims.x;
float height = dims.y;
float maxRadius = min(width, height) * 0.5;
float rBL = min(radii.w, maxRadius);
float rTL = min(radii.z, maxRadius);
float rTR = min(radii.x, maxRadius);
float rBR = min(radii.y, maxRadius);
vec2 p = fragUV * dims;
float leftLen = height - rBL - rTL;
float topLen = width - rTL - rTR;
float rightLen = height - rTR - rBR;
float bottomLen = width - rBR - rBL;
float arcBL = PI * 0.5 * rBL;
float arcTL = PI * 0.5 * rTL;
float arcTR = PI * 0.5 * rTR;
float arcBR = PI * 0.5 * rBR;
float pos = 0.0;
float distLeft = p.x;
float distRight = width - p.x;
float distBottom = p.y;
float distTop = height - p.y;
float minDist = min(min(distLeft, distRight), min(distBottom, distTop));
if (p.x < rBL && p.y < rBL) {
vec2 c = vec2(rBL, rBL);
vec2 d = p - c;
float angle = atan(-d.x, -d.y);
pos = angle / (PI * 0.5) * arcBL;
} else if (p.x < rTL && p.y > height - rTL) {
vec2 c = vec2(rTL, height - rTL);
vec2 d = p - c;
float angle = atan(d.y, -d.x);
pos = arcBL + leftLen + angle / (PI * 0.5) * arcTL;
} else if (p.x > width - rTR && p.y > height - rTR) {
vec2 c = vec2(width - rTR, height - rTR);
vec2 d = p - c;
float angle = atan(d.x, d.y);
pos = arcBL + leftLen + arcTL + topLen + angle / (PI * 0.5) * arcTR;
} else if (p.x > width - rBR && p.y < rBR) {
vec2 c = vec2(width - rBR, rBR);
vec2 d = p - c;
float angle = atan(-d.y, d.x);
pos = arcBL + leftLen + arcTL + topLen + arcTR + rightLen + angle / (PI * 0.5) * arcBR;
} else if (minDist == distLeft) {
pos = arcBL + clamp(p.y - rBL, 0.0, leftLen);
} else if (minDist == distTop) {
pos = arcBL + leftLen + arcTL + clamp(p.x - rTL, 0.0, topLen);
} else if (minDist == distRight) {
pos = arcBL + leftLen + arcTL + topLen + arcTR + clamp(height - rTR - p.y, 0.0, rightLen);
} else {
pos = arcBL + leftLen + arcTL + topLen + arcTR + rightLen + arcBR + clamp(width - rBR - p.x, 0.0, bottomLen);
}
return pos / lineWidth;
}
float getRectPerimeterPosition(vec2 fragUV, vec2 dims, float lineWidth) {
float width = dims.x;
float height = dims.y;
float distLeft = fragUV.x * width;
float distRight = (1.0 - fragUV.x) * width;
float distBottom = fragUV.y * height;
float distTop = (1.0 - fragUV.y) * height;
float minDist = min(min(distLeft, distRight), min(distBottom, distTop));
float pos = 0.0;
if (minDist == distLeft) {
pos = fragUV.y * height;
} else if (minDist == distTop) {
pos = height + fragUV.x * width;
} else if (minDist == distRight) {
pos = height + width + (1.0 - fragUV.y) * height;
} else {
pos = 2.0 * height + width + (1.0 - fragUV.x) * width;
}
return pos / lineWidth;
}
`,"fs:#main-start":`
bool inDashGap = false;
float dashUnitLength = vDashArray.x + vDashArray.y;
if (dashUnitLength > 0.0 && textBackground.stroked) {
float distToEdge;
bool hasRoundedCorners = textBackground.borderRadius != vec4(0.0);
if (hasRoundedCorners) {
distToEdge = round_rect(uv, dimensions, textBackground.borderRadius);
} else {
distToEdge = rect(uv, dimensions);
}
if (distToEdge <= vLineWidth && distToEdge >= 0.0) {
float posAlongStroke;
if (hasRoundedCorners) {
posAlongStroke = getPerimeterPosition(uv, dimensions, textBackground.borderRadius, vLineWidth);
} else {
posAlongStroke = getRectPerimeterPosition(uv, dimensions, vLineWidth);
}
float unitOffset = mod(posAlongStroke, dashUnitLength);
if (unitOffset > vDashArray.x) {
if (vFillColor.a > 0.0) {
inDashGap = true;
} else {
if (!(pathStyle.dashGapPickable && bool(picking.isActive))) {
discard;
}
}
}
}
}
`,"fs:#main-end":`
if (inDashGap) {
float alphaFactor = fragColor.a / max(vLineColor.a, 0.001);
fragColor = vec4(vFillColor.rgb, vFillColor.a * alphaFactor);
fragColor = picking_filterPickingColor(fragColor);
fragColor = picking_filterHighlightColor(fragColor);
}
`}},O={inject:{"vs:#decl":`
in float instanceOffsets;
`,"vs:DECKGL_FILTER_SIZE":`
float offsetWidth = abs(instanceOffsets * 2.0) + 1.0;
size *= offsetWidth;
`,"vs:#main-end":`
float offsetWidth = abs(instanceOffsets * 2.0) + 1.0;
float offsetDir = sign(instanceOffsets);
vPathPosition.x = (vPathPosition.x + offsetDir) * offsetWidth - offsetDir;
vPathPosition.y *= offsetWidth;
vPathLength *= offsetWidth;
`,"fs:#main-start":`
float isInside;
isInside = step(-1.0, vPathPosition.x) * step(vPathPosition.x, 1.0);
if (isInside == 0.0) {
discard;
}
`}},k={getDashArray:{type:`accessor`,value:[0,0]},getOffset:{type:`accessor`,value:0},dashJustified:!1,dashGapPickable:!1},A=class extends w{constructor({dash:e=!1,offset:t=!1,highPrecisionDash:n=!1}={}){super({dash:e||n,offset:t,highPrecisionDash:n})}getLayerType(e){if(`pathTesselator`in e.state)return`path`;let t=e.constructor.layerName;return t===`ScatterplotLayer`?`scatterplot`:t===`TextBackgroundLayer`?`textBackground`:null}isEnabled(e){return this.getLayerType(e)!==null}getShaders(e){let t=e.getLayerType(this);if(!t)return null;if(t===`scatterplot`||t===`textBackground`)return e.opts.dash?{modules:[{name:`pathStyle`,inject:t===`scatterplot`?E.inject:D.inject,uniformTypes:{dashGapPickable:`i32`}}]}:null;let n={},r={};e.opts.dash&&(n=C(n,T),e.opts.highPrecisionDash&&(r.HIGH_PRECISION_DASH=!0)),e.opts.offset&&(n=C(n,O));let{inject:i}=n;return{modules:[{name:`pathStyle`,inject:i,uniformTypes:{dashAlignMode:`f32`,dashGapPickable:`i32`}}],defines:r}}initializeState(e,t){let n=this.getAttributeManager(),r=t.getLayerType(this);!n||!r||(t.opts.dash&&n.addInstanced({instanceDashArrays:{size:2,accessor:`getDashArray`},...r===`path`&&t.opts.highPrecisionDash?{instanceDashOffsets:{size:1,accessor:`getPath`,transform:t.getDashOffsets.bind(this)}}:{}}),r===`path`&&t.opts.offset&&n.addInstanced({instanceOffsets:{size:1,accessor:`getOffset`}}))}updateState(e,t){if(t.isEnabled(this)&&t.opts.dash){let e=t.getLayerType(this);if(e===`scatterplot`||e===`textBackground`){let e={dashGapPickable:!!this.props.dashGapPickable};this.setShaderModuleProps({pathStyle:e})}else{let e={dashAlignMode:+!!this.props.dashJustified,dashGapPickable:!!this.props.dashGapPickable};this.setShaderModuleProps({pathStyle:e})}}}getDashOffsets(e){let t=[0],n=this.props.positionFormat===`XY`?2:3,r=Array.isArray(e[0]),i=r?e.length:e.length/n,a,o;for(let s=0;s<i-1;s++)a=r?e[s]:e.slice(s*n,s*n+n),a=this.projectPosition(a),s>0&&(t[s]=t[s-1]+y(o,a)),o=a;return t[i-1]=0,t}};A.defaultProps=k,A.extensionName=`PathStyleExtension`;export{t as _,l as a,s as c,g as d,x as f,p as g,d as h,_ as i,m as l,f as m,C as n,b as o,v as p,S as r,u as s,A as t,h as u,e as v};