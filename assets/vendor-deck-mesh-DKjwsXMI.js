import{T as e,_ as t,a as n,f as r,h as i,i as a,x as o}from"./vendor-deck-core-BzBN_-tm.js";import{c as s,d as c,l,o as u,s as d,u as f}from"./vendor-deck-layers-DVEB7Xlh.js";var p={name:`phongMaterial`,firstBindingSlot:0,bindingLayout:[{name:`phongMaterial`,group:3}],dependencies:[f,c],source:d,vs:l,fs:s,defines:{LIGHTING_FRAGMENT:!0},uniformTypes:{unlit:`i32`,ambient:`f32`,diffuse:`f32`,shininess:`f32`,specularColor:`vec3<f32>`},defaultUniforms:{unlit:!1,ambient:.35,diffuse:.6,shininess:32,specularColor:[38.25,38.25,38.25]},getUniforms(e){return{...p.defaultUniforms,...e}}},m=Math.PI/180,h=new Float32Array(16),g=new Float32Array(12);function _(e,t,n){let r=t[0]*m,i=t[1]*m,a=t[2]*m,o=Math.sin(a),s=Math.sin(r),c=Math.sin(i),l=Math.cos(a),u=Math.cos(r),d=Math.cos(i),f=n[0],p=n[1],h=n[2];e[0]=f*d*u,e[1]=f*c*u,e[2]=f*-s,e[3]=p*(-c*l+d*s*o),e[4]=p*(d*l+c*s*o),e[5]=p*u*o,e[6]=h*(c*o+d*s*l),e[7]=h*(-d*o+c*s*l),e[8]=h*u*l}function v(e){return e[0]=e[0],e[1]=e[1],e[2]=e[2],e[3]=e[4],e[4]=e[5],e[5]=e[6],e[6]=e[8],e[7]=e[9],e[8]=e[10],e[9]=e[12],e[10]=e[13],e[11]=e[14],e.subarray(0,12)}var y={size:12,accessor:[`getOrientation`,`getScale`,`getTranslation`,`getTransformMatrix`],shaderAttributes:{instanceModelMatrixCol0:{size:3,elementOffset:0},instanceModelMatrixCol1:{size:3,elementOffset:3},instanceModelMatrixCol2:{size:3,elementOffset:6},instanceTranslation:{size:3,elementOffset:9}},update(e,{startRow:t,endRow:r}){let{data:i,getOrientation:a,getScale:o,getTranslation:s,getTransformMatrix:c}=this.props,l=Array.isArray(c),u=l&&c.length===16,d=Array.isArray(o),f=Array.isArray(a),p=Array.isArray(s),m=u||!l&&!!c(i[0]);m?e.constant=u:e.constant=f&&d&&p;let y=e.value;if(e.constant){let t;m?(h.set(c),t=v(h)):(t=g,_(t,a,o),t.set(s,9)),e.value=new Float32Array(t)}else{let l=t*e.size,{iterable:b,objectInfo:x}=n(i,t,r);for(let e of b){x.index++;let t;if(m)h.set(u?c:c(e,x)),t=v(h);else{t=g;let n=f?a:a(e,x),r=d?o:o(e,x);_(t,n,r),t.set(p?s:s(e,x),9)}y[l++]=t[0],y[l++]=t[1],y[l++]=t[2],y[l++]=t[3],y[l++]=t[4],y[l++]=t[5],y[l++]=t[6],y[l++]=t[7],y[l++]=t[8],y[l++]=t[9],y[l++]=t[10],y[l++]=t[11]}}}};function b(e,t){return t===`cartesian`||t===`meter-offsets`||t==="default"&&!e.isGeospatial}var x=`layout(std140) uniform simpleMeshUniforms {
  float sizeScale;
  bool composeModelMatrix;
  bool hasTexture;
  bool flatShading;
} simpleMesh;
`,S={name:`simpleMesh`,vs:x,fs:x,uniformTypes:{sizeScale:`f32`,composeModelMatrix:`f32`,hasTexture:`f32`,flatShading:`f32`}},C=`#version 300 es
#define SHADER_NAME simple-mesh-layer-vs
in vec3 positions;
in vec3 normals;
in vec3 colors;
in vec2 texCoords;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec3 instanceModelMatrixCol0;
in vec3 instanceModelMatrixCol1;
in vec3 instanceModelMatrixCol2;
in vec3 instanceTranslation;
out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;
out vec4 vColor;
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = texCoords;
geometry.pickingColor = instancePickingColors;
vTexCoord = texCoords;
cameraPosition = project.cameraPosition;
vColor = vec4(colors * instanceColors.rgb, instanceColors.a);
mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);
vec3 pos = (instanceModelMatrix * positions) * simpleMesh.sizeScale + instanceTranslation;
if (simpleMesh.composeModelMatrix) {
DECKGL_FILTER_SIZE(pos, geometry);
normals_commonspace = project_normal(instanceModelMatrix * normals);
geometry.worldPosition += pos;
gl_Position = project_position_to_clipspace(pos + instancePositions, instancePositions64Low, vec3(0.0), position_commonspace);
geometry.position = position_commonspace;
}
else {
pos = project_size(pos);
DECKGL_FILTER_SIZE(pos, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, pos, position_commonspace);
geometry.position = position_commonspace;
normals_commonspace = project_normal(instanceModelMatrix * normals);
}
geometry.normal = normals_commonspace;
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,w=`#version 300 es
#define SHADER_NAME simple-mesh-layer-fs
precision highp float;
uniform sampler2D sampler;
in vec2 vTexCoord;
in vec3 cameraPosition;
in vec3 normals_commonspace;
in vec4 position_commonspace;
in vec4 vColor;
out vec4 fragColor;
void main(void) {
geometry.uv = vTexCoord;
vec3 normal;
if (simpleMesh.flatShading) {
normal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
} else {
normal = normals_commonspace;
}
vec4 color = simpleMesh.hasTexture ? texture(sampler, vTexCoord) : vColor;
DECKGL_FILTER_COLOR(color, geometry);
vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, normal);
fragColor = vec4(lightColor, color.a * layer.opacity);
}
`;function T(e){let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0,s=e.POSITION?e.POSITION.value:[],c=s&&s.length;for(let e=0;e<c;e+=3){let c=s[e],l=s[e+1],u=s[e+2];t=c<t?c:t,n=l<n?l:n,r=u<r?u:r,i=c>i?c:i,a=l>a?l:a,o=u>o?u:o}return[[t,n,r],[i,a,o]]}function E(t){let n=t.positions||t.POSITION;e.assert(n,`no "postions" or "POSITION" attribute in mesh`);let r=n.value.length/n.size,i=t.COLOR_0||t.colors;i||={size:3,value:new Float32Array(r*3).fill(1)};let a=t.NORMAL||t.normals;a||={size:3,value:new Float32Array(r*3).fill(0)};let o=t.TEXCOORD_0||t.texCoords;return o||={size:2,value:new Float32Array(r*2).fill(0)},{positions:n,colors:i,normals:a,texCoords:o}}function D(e){return e instanceof u?(e.attributes=E(e.attributes),e):e.attributes?new u({...e,topology:`triangle-list`,attributes:E(e.attributes)}):new u({topology:`triangle-list`,attributes:E(e)})}var O={mesh:{type:`object`,value:null,async:!0},texture:{type:`image`,value:null,async:!0},sizeScale:{type:`number`,value:1,min:0},_instanced:!0,wireframe:!1,material:!0,getPosition:{type:`accessor`,value:e=>e.position},getColor:{type:`accessor`,value:[0,0,0,255]},getOrientation:{type:`accessor`,value:[0,0,0]},getScale:{type:`accessor`,value:[1,1,1]},getTranslation:{type:`accessor`,value:[0,0,0]},getTransformMatrix:{type:`accessor`,value:[]},textureParameters:{type:`object`,ignore:!0,value:null}},k=class extends a{getShaders(){return super.getShaders({vs:C,fs:w,modules:[i,p,r,S]})}getBounds(){if(this.props._instanced)return super.getBounds();let e=this.state.positionBounds;if(e)return e;let{mesh:t}=this.props;if(!t)return null;if(e=t.header?.boundingBox,!e){let{attributes:n}=D(t);n.POSITION=n.POSITION||n.positions,e=T(n)}return this.state.positionBounds=e,e}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{transition:!0,type:`float64`,fp64:this.use64bitPositions(),size:3,accessor:`getPosition`},instanceColors:{type:`unorm8`,transition:!0,size:this.props.colorFormat.length,accessor:`getColor`,defaultValue:[0,0,0,255]},instanceModelMatrix:y}),this.setState({emptyTexture:this.context.device.createTexture({data:new Uint8Array(4),width:1,height:1})})}updateState(e){super.updateState(e);let{props:t,oldProps:n,changeFlags:r}=e;if(t.mesh!==n.mesh||r.extensionsChanged){if(this.state.positionBounds=null,this.state.model?.destroy(),t.mesh){this.state.model=this.getModel(t.mesh);let e=t.mesh.attributes||t.mesh;this.setState({hasNormals:!!(e.NORMAL||e.normals)})}this.getAttributeManager().invalidateAll()}t.texture!==n.texture&&t.texture instanceof o&&this.setTexture(t.texture),this.state.model&&this.state.model.setTopology(this.props.wireframe?`line-strip`:`triangle-list`)}finalizeState(e){super.finalizeState(e),this.state.emptyTexture.delete()}draw({uniforms:e}){let{model:t}=this.state;if(!t)return;let{viewport:n,renderPass:r}=this.context,{sizeScale:i,coordinateSystem:a,_instanced:o}=this.props,s={sizeScale:i,composeModelMatrix:!o||b(n,a),flatShading:!this.state.hasNormals};t.shaderInputs.setProps({simpleMesh:s}),t.draw(r)}get isLoaded(){return!!(this.state?.model&&super.isLoaded)}getModel(e){let n=new t(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:D(e),isInstanced:!0}),{texture:r}=this.props,{emptyTexture:i}=this.state,a={sampler:r||i,hasTexture:!!r};return n.shaderInputs.setProps({simpleMesh:a}),n}setTexture(e){let{emptyTexture:t,model:n}=this.state;if(n){let r={sampler:e||t,hasTexture:!!e};n.shaderInputs.setProps({simpleMesh:r})}}};k.defaultProps=O,k.layerName=`SimpleMeshLayer`;export{k as t};