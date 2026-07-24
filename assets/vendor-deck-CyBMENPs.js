import{n as e}from"./rolldown-runtime-QTnfLwEv.js";var t=globalThis;globalThis.document;var n=globalThis.process||{};globalThis.console;var r=globalThis.navigator||{};function i(e){if(typeof window<`u`&&window.process?.type===`renderer`||typeof process<`u`&&process.versions?.electron)return!0;let t=typeof navigator<`u`&&navigator.userAgent,n=e||t;return!!(n&&n.indexOf(`Electron`)>=0)}function a(){return!(typeof process==`object`&&String(process)===`[object process]`&&!process?.browser)||i()}function o(e){return!e&&!a()?`Node`:i(e)?`Electron`:(e||r.userAgent||``).indexOf(`Edge`)>-1?`Edge`:globalThis.chrome?`Chrome`:globalThis.safari?`Safari`:globalThis.mozInnerScreenX?`Firefox`:`Unknown`}var s=`4.1.1`;function c(e,t){if(!e)throw Error(t||`Assertion failed`)}function l(e){if(!e)return 0;let t;switch(typeof e){case`number`:t=e;break;case`object`:t=e.logLevel||e.priority||0;break;default:return 0}return c(Number.isFinite(t)&&t>=0),t}function u(e){let{logLevel:t,message:n}=e;e.logLevel=l(t);let r=e.args?Array.from(e.args):[];for(;r.length&&r.shift()!==n;);switch(typeof t){case`string`:case`function`:n!==void 0&&r.unshift(n),e.message=t;break;case`object`:Object.assign(e,t);break;default:}typeof e.message==`function`&&(e.message=e.message());let i=typeof e.message;return c(i===`string`||i===`object`),Object.assign(e,{args:r},e.opts)}var d=()=>{},f=class{constructor({level:e=0}={}){this.userData={},this._onceCache=new Set,this._level=e}set level(e){this.setLevel(e)}get level(){return this.getLevel()}setLevel(e){return this._level=e,this}getLevel(){return this._level}warn(e,...t){return this._log(`warn`,0,e,t,{once:!0})}error(e,...t){return this._log(`error`,0,e,t)}log(e,t,...n){return this._log(`log`,e,t,n)}info(e,t,...n){return this._log(`info`,e,t,n)}once(e,t,...n){return this._log(`once`,e,t,n,{once:!0})}_log(e,t,n,r,i={}){let a=u({logLevel:t,message:n,args:this._buildArgs(t,n,r),opts:i});return this._createLogFunction(e,a,i)}_buildArgs(e,t,n){return[e,t,...n]}_createLogFunction(e,t,n){if(!this._shouldLog(t.logLevel))return d;let r=this._getOnceTag(n.tag??t.tag??t.message);if((n.once||t.once)&&r!==void 0){if(this._onceCache.has(r))return d;this._onceCache.add(r)}return this._emit(e,t)}_shouldLog(e){return this.getLevel()>=l(e)}_getOnceTag(e){if(e!==void 0)try{return typeof e==`string`?e:String(e)}catch{return}}};function p(e){try{let t=window[e],n=`__storage_test__`;return t.setItem(n,n),t.removeItem(n),t}catch{return null}}var m=class{constructor(e,t,n=`sessionStorage`){this.storage=p(n),this.id=e,this.config=t,this._loadConfiguration()}getConfiguration(){return this.config}setConfiguration(e){if(Object.assign(this.config,e),this.storage){let e=JSON.stringify(this.config);this.storage.setItem(this.id,e)}}_loadConfiguration(){let e={};if(this.storage){let t=this.storage.getItem(this.id);e=t?JSON.parse(t):{}}return Object.assign(this.config,e),this}};function h(e){let t;return t=e<10?`${e.toFixed(2)}ms`:e<100?`${e.toFixed(1)}ms`:e<1e3?`${e.toFixed(0)}ms`:`${(e/1e3).toFixed(2)}s`,t}function g(e,t=8){let n=Math.max(t-e.length,0);return`${` `.repeat(n)}${e}`}var _;(function(e){e[e.BLACK=30]=`BLACK`,e[e.RED=31]=`RED`,e[e.GREEN=32]=`GREEN`,e[e.YELLOW=33]=`YELLOW`,e[e.BLUE=34]=`BLUE`,e[e.MAGENTA=35]=`MAGENTA`,e[e.CYAN=36]=`CYAN`,e[e.WHITE=37]=`WHITE`,e[e.BRIGHT_BLACK=90]=`BRIGHT_BLACK`,e[e.BRIGHT_RED=91]=`BRIGHT_RED`,e[e.BRIGHT_GREEN=92]=`BRIGHT_GREEN`,e[e.BRIGHT_YELLOW=93]=`BRIGHT_YELLOW`,e[e.BRIGHT_BLUE=94]=`BRIGHT_BLUE`,e[e.BRIGHT_MAGENTA=95]=`BRIGHT_MAGENTA`,e[e.BRIGHT_CYAN=96]=`BRIGHT_CYAN`,e[e.BRIGHT_WHITE=97]=`BRIGHT_WHITE`})(_||={});var v=10;function y(e){return typeof e==`string`?(e=e.toUpperCase(),_[e]||_.WHITE):e}function b(e,t,n){return!a&&typeof e==`string`&&(t&&(e=`\u001b[${y(t)}m${e}\u001b[39m`),n&&(e=`\u001b[${y(n)+v}m${e}\u001b[49m`)),e}function x(e,t=[`constructor`]){let n=Object.getPrototypeOf(e),r=Object.getOwnPropertyNames(n),i=e;for(let n of r){let r=i[n];typeof r==`function`&&(t.find(e=>n===e)||(i[n]=r.bind(e)))}}function S(){let e;if(a()&&t.performance)e=t?.performance?.now?.();else if(`hrtime`in n){let t=n?.hrtime?.();e=t[0]*1e3+t[1]/1e6}else e=Date.now();return e}var C={debug:a()&&console.debug||console.log,log:console.log,info:console.info,warn:console.warn,error:console.error},w={enabled:!0,level:0},T=class extends f{constructor({id:e}={id:``}){super({level:0}),this.VERSION=s,this._startTs=S(),this._deltaTs=S(),this.userData={},this.LOG_THROTTLE_TIMEOUT=0,this.id=e,this.userData={},this._storage=new m(`__probe-${this.id}__`,{[this.id]:w}),this.timeStamp(`${this.id} started`),x(this),Object.seal(this)}isEnabled(){return this._getConfiguration().enabled}getLevel(){return this._getConfiguration().level}getTotal(){return Number((S()-this._startTs).toPrecision(10))}getDelta(){return Number((S()-this._deltaTs).toPrecision(10))}set priority(e){this.level=e}get priority(){return this.level}getPriority(){return this.level}enable(e=!0){return this._updateConfiguration({enabled:e}),this}setLevel(e){return this._updateConfiguration({level:e}),this}get(e){return this._getConfiguration()[e]}set(e,t){this._updateConfiguration({[e]:t})}settings(){console.table?console.table(this._storage.config):console.log(this._storage.config)}assert(e,t){if(!e)throw Error(t||`Assertion failed`)}warn(e,...t){return this._log(`warn`,0,e,t,{method:C.warn,once:!0})}error(e,...t){return this._log(`error`,0,e,t,{method:C.error})}deprecated(e,t){return this.warn(`\`${e}\` is deprecated and will be removed \
in a later version. Use \`${t}\` instead`)}removed(e,t){return this.error(`\`${e}\` has been removed. Use \`${t}\` instead`)}probe(e,t,...n){return this._log(`log`,e,t,n,{method:C.log,time:!0,once:!0})}log(e,t,...n){return this._log(`log`,e,t,n,{method:C.debug})}info(e,t,...n){return this._log(`info`,e,t,n,{method:console.info})}once(e,t,...n){return this._log(`once`,e,t,n,{method:C.debug||C.info,once:!0})}table(e,t,n){return t?this._log(`table`,e,t,n&&[n]||[],{method:console.table||d,tag:D(t)}):d}time(e,t){return this._log(`time`,e,t,[],{method:console.time?console.time:console.info})}timeEnd(e,t){return this._log(`time`,e,t,[],{method:console.timeEnd?console.timeEnd:console.info})}timeStamp(e,t){return this._log(`time`,e,t,[],{method:console.timeStamp||d})}group(e,t,n={collapsed:!1}){let r=(n.collapsed?console.groupCollapsed:console.group)||console.info;return this._log(`group`,e,t,[],{method:r})}groupCollapsed(e,t,n={}){return this.group(e,t,Object.assign({},n,{collapsed:!0}))}groupEnd(e){return this._log(`groupEnd`,e,``,[],{method:console.groupEnd||d})}withGroup(e,t,n){this.group(e,t)();try{n()}finally{this.groupEnd(e)()}}trace(){console.trace&&console.trace()}_shouldLog(e){return this.isEnabled()&&super._shouldLog(e)}_emit(e,t){let n=t.method;c(n),t.total=this.getTotal(),t.delta=this.getDelta(),this._deltaTs=S();let r=E(this.id,t.message,t);return n.bind(console,r,...t.args)}_getConfiguration(){return this._storage.config[this.id]||this._updateConfiguration(w),this._storage.config[this.id]}_updateConfiguration(e){let t=this._storage.config[this.id]||{...w};this._storage.setConfiguration({[this.id]:{...t,...e}})}};T.VERSION=s;function E(e,t,n){if(typeof t==`string`){let r=n.time?g(h(n.total)):``;t=n.time?`${e}: ${r}  ${t}`:`${e}: ${t}`,t=b(t,n.color,n.background)}return t}function D(e){for(let t in e)for(let n in e[t])return n||`untitled`;return`empty`}globalThis.probe={};var ee=new T({id:`@probe.gl/log`}),O=new T({id:`deck`}),k;(function(e){e[e.Start=1]=`Start`,e[e.Move=2]=`Move`,e[e.End=4]=`End`,e[e.Cancel=8]=`Cancel`})(k||={});var A;(function(e){e[e.None=0]=`None`,e[e.Left=1]=`Left`,e[e.Right=2]=`Right`,e[e.Up=4]=`Up`,e[e.Down=8]=`Down`,e[e.Horizontal=3]=`Horizontal`,e[e.Vertical=12]=`Vertical`,e[e.All=15]=`All`})(A||={});var j;(function(e){e[e.Possible=1]=`Possible`,e[e.Began=2]=`Began`,e[e.Changed=4]=`Changed`,e[e.Ended=8]=`Ended`,e[e.Recognized=8]=`Recognized`,e[e.Cancelled=16]=`Cancelled`,e[e.Failed=32]=`Failed`})(j||={});var te=`auto`,ne=`manipulation`,re=`none`,ie=`pan-x`,ae=`pan-y`;function oe(e){if(e.includes(`none`))return re;let t=e.includes(ie),n=e.includes(ae);return t&&n?re:t||n?t?ie:ae:e.includes(`manipulation`)?ne:te}var se=class{constructor(e,t){this.actions=``,this.manager=e,this.set(t)}set(e){e===`compute`&&(e=this.compute()),this.manager.element&&(this.manager.element.style.touchAction=e,this.actions=e)}update(){this.set(this.manager.options.touchAction)}compute(){let e=[];for(let t of this.manager.recognizers)t.options.enable&&(e=e.concat(t.getTouchAction()));return oe(e.join(` `))}};function ce(e){return e.trim().split(/\s+/g)}function le(e,t,n){if(e)for(let r of ce(t))e.addEventListener(r,n,!1)}function ue(e,t,n){if(e)for(let r of ce(t))e.removeEventListener(r,n,!1)}function de(e){return(e.ownerDocument||e).defaultView}function fe(e,t){let n=e;for(;n;){if(n===t)return!0;n=n.parentNode}return!1}function pe(e){let t=e.length;if(t===1)return{x:Math.round(e[0].clientX),y:Math.round(e[0].clientY)};let n=0,r=0,i=0;for(;i<t;)n+=e[i].clientX,r+=e[i].clientY,i++;return{x:Math.round(n/t),y:Math.round(r/t)}}function me(e){let t=[],n=0;for(;n<e.pointers.length;)t[n]={clientX:Math.round(e.pointers[n].clientX),clientY:Math.round(e.pointers[n].clientY)},n++;return{timeStamp:Date.now(),pointers:t,center:pe(t),deltaX:e.deltaX,deltaY:e.deltaY}}function he(e,t){let n=t.x-e.x,r=t.y-e.y;return Math.sqrt(n*n+r*r)}function ge(e,t){let n=t.clientX-e.clientX,r=t.clientY-e.clientY;return Math.sqrt(n*n+r*r)}function _e(e,t){let n=t.x-e.x,r=t.y-e.y;return Math.atan2(r,n)*180/Math.PI}function ve(e,t){let n=t.clientX-e.clientX,r=t.clientY-e.clientY;return Math.atan2(r,n)*180/Math.PI}function ye(e,t){return e===t?A.None:Math.abs(e)>=Math.abs(t)?e<0?A.Left:A.Right:t<0?A.Up:A.Down}function be(e,t){let n=t.center,r=e.offsetDelta,i=e.prevDelta,a=e.prevInput;return(t.eventType===k.Start||a?.eventType===k.End)&&(i=e.prevDelta={x:a?.deltaX||0,y:a?.deltaY||0},r=e.offsetDelta={x:n.x,y:n.y}),{deltaX:i.x+(n.x-r.x),deltaY:i.y+(n.y-r.y)}}function xe(e,t,n){return{x:t/e||0,y:n/e||0}}function Se(e,t){return ge(t[0],t[1])/ge(e[0],e[1])}function Ce(e,t){return ve(t[1],t[0])-ve(e[1],e[0])}function we(e,t){let n=e.lastInterval||t,r=t.timeStamp-n.timeStamp,i,a,o,s;if(t.eventType!==k.Cancel&&(r>25||n.velocity===void 0)){let c=t.deltaX-n.deltaX,l=t.deltaY-n.deltaY,u=xe(r,c,l);a=u.x,o=u.y,i=Math.abs(u.x)>Math.abs(u.y)?u.x:u.y,s=ye(c,l),e.lastInterval=t}else i=n.velocity,a=n.velocityX,o=n.velocityY,s=n.direction;t.velocity=i,t.velocityX=a,t.velocityY=o,t.direction=s}function Te(e,t){let{session:n}=e,{pointers:r}=t,{length:i}=r;n.firstInput||=me(t),i>1&&!n.firstMultiple?n.firstMultiple=me(t):i===1&&(n.firstMultiple=!1);let{firstInput:a,firstMultiple:o}=n,s=o?o.center:a.center,c=t.center=pe(r);t.timeStamp=Date.now(),t.deltaTime=t.timeStamp-a.timeStamp,t.angle=_e(s,c),t.distance=he(s,c);let{deltaX:l,deltaY:u}=be(n,t);t.deltaX=l,t.deltaY=u,t.offsetDirection=ye(t.deltaX,t.deltaY);let d=xe(t.deltaTime,t.deltaX,t.deltaY);t.overallVelocityX=d.x,t.overallVelocityY=d.y,t.overallVelocity=Math.abs(d.x)>Math.abs(d.y)?d.x:d.y,t.scale=o?Se(o.pointers,r):1,t.rotation=o?Ce(o.pointers,r):0,t.maxPointers=n.prevInput?t.pointers.length>n.prevInput.maxPointers?t.pointers.length:n.prevInput.maxPointers:t.pointers.length;let f=e.element;return fe(t.srcEvent.target,f)&&(f=t.srcEvent.target),t.target=f,we(n,t),t}function Ee(e,t,n){let r=n.pointers.length,i=n.changedPointers.length,a=t&k.Start&&r-i===0,o=t&(k.End|k.Cancel)&&r-i===0;n.isFirst=!!a,n.isFinal=!!o,a&&(e.session={}),n.eventType=t;let s=Te(e,n);e.emit(`hammer.input`,s),e.recognize(s),e.session.prevInput=s}var De=class{constructor(e){this.evEl=``,this.evWin=``,this.evTarget=``,this.domHandler=e=>{this.manager.options.enable&&this.handler(e)},this.manager=e,this.element=e.element,this.target=e.options.inputTarget||e.element}callback(e,t){Ee(this.manager,e,t)}init(){le(this.element,this.evEl,this.domHandler),le(this.target,this.evTarget,this.domHandler),le(de(this.element),this.evWin,this.domHandler)}destroy(){ue(this.element,this.evEl,this.domHandler),ue(this.target,this.evTarget,this.domHandler),ue(de(this.element),this.evWin,this.domHandler)}},Oe={pointerdown:k.Start,pointermove:k.Move,pointerup:k.End,pointercancel:k.Cancel,pointerout:k.Cancel},ke=`pointerdown`,Ae=`pointermove pointerup pointercancel`,je=class extends De{constructor(e){super(e),this.evEl=ke,this.evWin=Ae,this.store=this.manager.session.pointerEvents=[],this.init()}handler(e){let{store:t}=this,n=!1,r=Oe[e.type],i=e.pointerType,a=i===`touch`,o=t.findIndex(t=>t.pointerId===e.pointerId);r&k.Start&&(e.buttons||a)?o<0&&(t.push(e),o=t.length-1):r&(k.End|k.Cancel)&&(n=!0),!(o<0)&&(t[o]=e,this.callback(r,{pointers:t,changedPointers:[e],eventType:r,pointerType:i,srcEvent:e}),n&&t.splice(o,1))}},Me=[``,`webkit`,`Moz`,`MS`,`ms`,`o`];function Ne(e,t){let n=t[0].toUpperCase()+t.slice(1);for(let r of Me){let i=r?r+n:t;if(i in e)return i}}var Pe=1,Fe=2,Ie={touchAction:`compute`,enable:!0,inputTarget:null,cssProps:{userSelect:`none`,userDrag:`none`,touchCallout:`none`,tapHighlightColor:`rgba(0,0,0,0)`}},Le=class{constructor(e,t){this.options={...Ie,...t,cssProps:{...Ie.cssProps,...t.cssProps},inputTarget:t.inputTarget||e},this.handlers={},this.session={},this.recognizers=[],this.oldCssProps={},this.element=e,this.input=new je(this),this.touchAction=new se(this,this.options.touchAction),this.toggleCssProps(!0)}set(e){return Object.assign(this.options,e),e.touchAction&&this.touchAction.update(),e.inputTarget&&(this.input.destroy(),this.input.target=e.inputTarget,this.input.init()),this}stop(e){this.session.stopped=e?Fe:Pe}recognize(e){let{session:t}=this;if(t.stopped)return;this.session.prevented&&e.srcEvent.preventDefault();let n,{recognizers:r}=this,{curRecognizer:i}=t;(!i||i&&i.state&j.Recognized)&&(i=t.curRecognizer=null);let a=0;for(;a<r.length;)n=r[a],t.stopped!==Fe&&(!i||n===i||n.canRecognizeWith(i))?n.recognize(e):n.reset(),!i&&n.state&(j.Began|j.Changed|j.Ended)&&(i=t.curRecognizer=n),a++}get(e){let{recognizers:t}=this;for(let n=0;n<t.length;n++)if(t[n].options.event===e)return t[n];return null}add(e){if(Array.isArray(e)){for(let t of e)this.add(t);return this}let t=this.get(e.options.event);return t&&this.remove(t),this.recognizers.push(e),e.manager=this,this.touchAction.update(),e}remove(e){if(Array.isArray(e)){for(let t of e)this.remove(t);return this}let t=typeof e==`string`?this.get(e):e;if(t){let{recognizers:e}=this,n=e.indexOf(t);n!==-1&&(e.splice(n,1),this.touchAction.update())}return this}on(e,t){if(!e||!t)return;let{handlers:n}=this;for(let r of ce(e))n[r]=n[r]||[],n[r].push(t)}off(e,t){if(!e)return;let{handlers:n}=this;for(let r of ce(e))t?n[r]&&n[r].splice(n[r].indexOf(t),1):delete n[r]}emit(e,t){let n=this.handlers[e]&&this.handlers[e].slice();if(!n||!n.length)return;let r=t;r.type=e,r.preventDefault=function(){t.srcEvent.preventDefault()};let i=0;for(;i<n.length;)n[i](r),i++}destroy(){this.toggleCssProps(!1),this.handlers={},this.session={},this.input.destroy(),this.element=null}toggleCssProps(e){let{element:t}=this;if(t){for(let[n,r]of Object.entries(this.options.cssProps)){let i=Ne(t.style,n);e?(this.oldCssProps[i]=t.style[i],t.style[i]=r):t.style[i]=this.oldCssProps[i]||``}e||(this.oldCssProps={})}}},Re=1;function ze(){return Re++}function Be(e){return e&j.Cancelled?`cancel`:e&j.Ended?`end`:e&j.Changed?`move`:e&j.Began?`start`:``}var Ve=class{constructor(e){this.options=e,this.id=ze(),this.state=j.Possible,this.simultaneous={},this.requireFail=[]}set(e){return Object.assign(this.options,e),this.manager.touchAction.update(),this}recognizeWith(e){if(Array.isArray(e)){for(let t of e)this.recognizeWith(t);return this}let t;if(typeof e==`string`){if(t=this.manager.get(e),!t)throw Error(`Cannot find recognizer ${e}`)}else t=e;let{simultaneous:n}=this;return n[t.id]||(n[t.id]=t,t.recognizeWith(this)),this}dropRecognizeWith(e){if(Array.isArray(e)){for(let t of e)this.dropRecognizeWith(t);return this}let t;return t=typeof e==`string`?this.manager.get(e):e,t&&delete this.simultaneous[t.id],this}requireFailure(e){if(Array.isArray(e)){for(let t of e)this.requireFailure(t);return this}let t;if(typeof e==`string`){if(t=this.manager.get(e),!t)throw Error(`Cannot find recognizer ${e}`)}else t=e;let{requireFail:n}=this;return n.indexOf(t)===-1&&(n.push(t),t.requireFailure(this)),this}dropRequireFailure(e){if(Array.isArray(e)){for(let t of e)this.dropRequireFailure(t);return this}let t;if(t=typeof e==`string`?this.manager.get(e):e,t){let e=this.requireFail.indexOf(t);e>-1&&this.requireFail.splice(e,1)}return this}hasRequireFailures(){return!!this.requireFail.find(e=>e.options.enable)}canRecognizeWith(e){return!!this.simultaneous[e.id]}emit(e){if(!e)return;let{state:t}=this;t<j.Ended&&this.manager.emit(this.options.event+Be(t),e),this.manager.emit(this.options.event,e),e.additionalEvent&&this.manager.emit(e.additionalEvent,e),t>=j.Ended&&this.manager.emit(this.options.event+Be(t),e)}tryEmit(e){this.canEmit()?this.emit(e):this.state=j.Failed}canEmit(){let e=0;for(;e<this.requireFail.length;){if(!(this.requireFail[e].state&(j.Failed|j.Possible)))return!1;e++}return!0}recognize(e){let t={...e};if(!this.options.enable){this.reset(),this.state=j.Failed;return}this.state&(j.Recognized|j.Cancelled|j.Failed)&&(this.state=j.Possible),this.state=this.process(t),this.state&(j.Began|j.Changed|j.Ended|j.Cancelled)&&this.tryEmit(t)}getEventNames(){return[this.options.event]}reset(){}},He=class extends Ve{attrTest(e){let t=this.options.pointers;return t===0||e.pointers.length===t}process(e){let{state:t}=this,{eventType:n}=e,r=t&(j.Began|j.Changed),i=this.attrTest(e);return r&&(n&k.Cancel||!i)?t|j.Cancelled:r||i?n&k.End?t|j.Ended:t&j.Began?t|j.Changed:j.Began:j.Failed}},Ue=class extends Ve{constructor(e={}){super({enable:!0,event:`tap`,pointers:1,taps:1,interval:300,time:250,threshold:9,posThreshold:10,...e}),this.pTime=null,this.pCenter=null,this._timer=null,this._input=null,this.count=0}getTouchAction(){return[ne]}process(e){let{options:t}=this,n=e.pointers.length===t.pointers,r=e.distance<t.threshold,i=e.deltaTime<t.time;if(this.reset(),e.eventType&k.Start&&this.count===0)return this.failTimeout();if(r&&i&&n){if(e.eventType!==k.End)return this.failTimeout();let n=this.pTime?e.timeStamp-this.pTime<t.interval:!0,r=!this.pCenter||he(this.pCenter,e.center)<t.posThreshold;if(this.pTime=e.timeStamp,this.pCenter=e.center,!r||!n?this.count=1:this.count+=1,this._input=e,this.count%t.taps===0)return this.hasRequireFailures()?(this._timer=setTimeout(()=>{this.state=j.Recognized,this.tryEmit(this._input)},t.interval),j.Began):j.Recognized}return j.Failed}failTimeout(){return this._timer=setTimeout(()=>{this.state=j.Failed},this.options.interval),j.Failed}reset(){clearTimeout(this._timer)}emit(e){this.state===j.Recognized&&(e.tapCount=this.count,this.manager.emit(this.options.event,e))}},We=[``,`start`,`move`,`end`,`cancel`,`up`,`down`,`left`,`right`],Ge=class extends He{constructor(e={}){super({enable:!0,pointers:1,event:`pan`,threshold:10,direction:A.All,...e}),this.pX=null,this.pY=null}getTouchAction(){let{options:{direction:e}}=this,t=[];return e&A.Horizontal&&t.push(ae),e&A.Vertical&&t.push(ie),t}getEventNames(){return We.map(e=>this.options.event+e)}directionTest(e){let{options:t}=this,n=!0,{distance:r}=e,{direction:i}=e,a=e.deltaX,o=e.deltaY;return i&t.direction||(t.direction&A.Horizontal?(i=a===0?A.None:a<0?A.Left:A.Right,n=a!==this.pX,r=Math.abs(e.deltaX)):(i=o===0?A.None:o<0?A.Up:A.Down,n=o!==this.pY,r=Math.abs(e.deltaY))),e.direction=i,n&&r>t.threshold&&!!(i&t.direction)}attrTest(e){return super.attrTest(e)&&(!!(this.state&j.Began)||!(this.state&j.Began)&&this.directionTest(e))}emit(e){this.pX=e.deltaX,this.pY=e.deltaY;let t=A[e.direction].toLowerCase();t&&(e.additionalEvent=this.options.event+t),super.emit(e)}},Ke=[``,`start`,`move`,`end`,`cancel`,`in`,`out`],qe=class extends He{constructor(e={}){super({enable:!0,event:`pinch`,threshold:0,pointers:2,...e})}getTouchAction(){return[re]}getEventNames(){return Ke.map(e=>this.options.event+e)}attrTest(e){return super.attrTest(e)&&(Math.abs(e.scale-1)>this.options.threshold||!!(this.state&j.Began))}emit(e){if(e.scale!==1){let t=e.scale<1?`in`:`out`;e.additionalEvent=this.options.event+t}super.emit(e)}},Je=class{constructor(e,t,n){this.element=e,this.callback=t,this.options=n}},Ye=typeof navigator<`u`&&navigator.userAgent?navigator.userAgent.toLowerCase():``;typeof window<`u`||global;var Xe=Ye.indexOf(`firefox`)!==-1,Ze=4.000244140625,Qe=40,$e=.25,et=class extends Je{constructor(e,t,n){super(e,t,{enable:!0,...n}),this.handleEvent=e=>{if(!this.options.enable)return;let t=e.deltaY;globalThis.WheelEvent&&(Xe&&e.deltaMode===globalThis.WheelEvent.DOM_DELTA_PIXEL&&(t/=globalThis.devicePixelRatio),e.deltaMode===globalThis.WheelEvent.DOM_DELTA_LINE&&(t*=Qe)),t!==0&&t%Ze===0&&(t=Math.floor(t/Ze)),e.shiftKey&&t&&(t*=$e),this.callback({type:`wheel`,center:{x:e.clientX,y:e.clientY},delta:-t,srcEvent:e,pointerType:`mouse`,target:e.target})},e.addEventListener(`wheel`,this.handleEvent,{passive:!1})}destroy(){this.element.removeEventListener(`wheel`,this.handleEvent)}enableEventType(e,t){e===`wheel`&&(this.options.enable=t)}},tt=[`mousedown`,`mousemove`,`mouseup`,`mouseover`,`mouseout`,`mouseleave`],nt=class extends Je{constructor(e,t,n){super(e,t,{enable:!0,...n}),this.handleEvent=e=>{this.handleOverEvent(e),this.handleOutEvent(e),this.handleEnterEvent(e),this.handleLeaveEvent(e),this.handleMoveEvent(e)},this.pressed=!1;let{enable:r}=this.options;this.enableMoveEvent=r,this.enableLeaveEvent=r,this.enableEnterEvent=r,this.enableOutEvent=r,this.enableOverEvent=r,tt.forEach(t=>e.addEventListener(t,this.handleEvent))}destroy(){tt.forEach(e=>this.element.removeEventListener(e,this.handleEvent))}enableEventType(e,t){switch(e){case`pointermove`:this.enableMoveEvent=t;break;case`pointerover`:this.enableOverEvent=t;break;case`pointerout`:this.enableOutEvent=t;break;case`pointerenter`:this.enableEnterEvent=t;break;case`pointerleave`:this.enableLeaveEvent=t;break;default:}}handleOverEvent(e){this.enableOverEvent&&e.type===`mouseover`&&this._emit(`pointerover`,e)}handleOutEvent(e){this.enableOutEvent&&e.type===`mouseout`&&this._emit(`pointerout`,e)}handleEnterEvent(e){this.enableEnterEvent&&e.type===`mouseenter`&&this._emit(`pointerenter`,e)}handleLeaveEvent(e){this.enableLeaveEvent&&e.type===`mouseleave`&&this._emit(`pointerleave`,e)}handleMoveEvent(e){if(this.enableMoveEvent)switch(e.type){case`mousedown`:e.button>=0&&(this.pressed=!0);break;case`mousemove`:e.buttons===0&&(this.pressed=!1),this.pressed||this._emit(`pointermove`,e);break;case`mouseup`:this.pressed=!1;break;default:}}_emit(e,t){this.callback({type:e,center:{x:t.clientX,y:t.clientY},srcEvent:t,pointerType:`mouse`,target:t.target})}},rt=[`keydown`,`keyup`],it=class extends Je{constructor(e,t,n){super(e,t,{enable:!0,tabIndex:0,...n}),this.handleEvent=e=>{let t=e.target||e.srcElement;t.tagName===`INPUT`&&t.type===`text`||t.tagName===`TEXTAREA`||(this.enableDownEvent&&e.type===`keydown`&&this.callback({type:`keydown`,srcEvent:e,key:e.key,target:e.target}),this.enableUpEvent&&e.type===`keyup`&&this.callback({type:`keyup`,srcEvent:e,key:e.key,target:e.target}))},this.enableDownEvent=this.options.enable,this.enableUpEvent=this.options.enable,e.tabIndex=this.options.tabIndex,e.style.outline=`none`,rt.forEach(t=>e.addEventListener(t,this.handleEvent))}destroy(){rt.forEach(e=>this.element.removeEventListener(e,this.handleEvent))}enableEventType(e,t){e===`keydown`&&(this.enableDownEvent=t),e===`keyup`&&(this.enableUpEvent=t)}},at=class extends Je{constructor(e,t,n){super(e,t,n),this.handleEvent=e=>{this.options.enable&&this.callback({type:`contextmenu`,center:{x:e.clientX,y:e.clientY},srcEvent:e,pointerType:`mouse`,target:e.target})},e.addEventListener(`contextmenu`,this.handleEvent)}destroy(){this.element.removeEventListener(`contextmenu`,this.handleEvent)}enableEventType(e,t){e===`contextmenu`&&(this.options.enable=t)}},ot=1,st=2,ct=4,lt={pointerdown:ot,pointermove:st,pointerup:ct,mousedown:ot,mousemove:st,mouseup:ct},ut=0,dt=1,ft=2,pt=1,mt=2,ht=4;function gt(e){let t=lt[e.srcEvent.type];if(!t)return null;let{buttons:n,button:r}=e.srcEvent,i=!1,a=!1,o=!1;return t===st?(i=!!(n&pt),a=!!(n&ht),o=!!(n&mt)):(i=r===ut,a=r===dt,o=r===ft),{leftButton:i,middleButton:a,rightButton:o}}function _t(e,t){let n=e.center;if(!n)return null;let r=t.getBoundingClientRect(),i=r.width/t.offsetWidth||1,a=r.height/t.offsetHeight||1;return{center:n,offsetCenter:{x:(n.x-r.left-t.clientLeft)/i,y:(n.y-r.top-t.clientTop)/a}}}var vt={srcElement:`root`,priority:0},yt=class{constructor(e,t){this.handleEvent=e=>{if(this.isEmpty())return;let t=this._normalizeEvent(e),n=e.srcEvent.target;for(;n&&n!==t.rootElement;){if(this._emit(t,n),t.handled)return;n=n.parentNode}this._emit(t,`root`)},this.eventManager=e,this.recognizerName=t,this.handlers=[],this.handlersByElement=new Map,this._active=!1}isEmpty(){return!this._active}add(e,t,n,r=!1,i=!1){let{handlers:a,handlersByElement:o}=this,s={...vt,...n},c=o.get(s.srcElement);c||(c=[],o.set(s.srcElement,c));let l={type:e,handler:t,srcElement:s.srcElement,priority:s.priority};r&&(l.once=!0),i&&(l.passive=!0),a.push(l),this._active=this._active||!l.passive;let u=c.length-1;for(;u>=0&&!(c[u].priority>=l.priority);)u--;c.splice(u+1,0,l)}remove(e,t){let{handlers:n,handlersByElement:r}=this;for(let i=n.length-1;i>=0;i--){let a=n[i];if(a.type===e&&a.handler===t){n.splice(i,1);let e=r.get(a.srcElement);e.splice(e.indexOf(a),1),e.length===0&&r.delete(a.srcElement)}}this._active=n.some(e=>!e.passive)}_emit(e,t){let n=this.handlersByElement.get(t);if(n){let t=!1,r=()=>{e.handled=!0},i=()=>{e.handled=!0,t=!0},a=[];for(let o=0;o<n.length;o++){let{type:s,handler:c,once:l}=n[o];if(c({...e,type:s,stopPropagation:r,stopImmediatePropagation:i}),l&&a.push(n[o]),t)break}for(let e=0;e<a.length;e++){let{type:t,handler:n}=a[e];this.remove(t,n)}}}_normalizeEvent(e){let t=this.eventManager.getElement();return{...e,...gt(e),..._t(e,t),preventDefault:()=>{e.srcEvent.preventDefault()},stopImmediatePropagation:null,stopPropagation:null,handled:!1,rootElement:t}}};function bt(e){if(`recognizer`in e)return e;let t,n=Array.isArray(e)?[...e]:[e];return t=typeof n[0]==`function`?new(n.shift())(n.shift()||{}):n.shift(),{recognizer:t,recognizeWith:typeof n[0]==`string`?[n[0]]:n[0],requireFailure:typeof n[1]==`string`?[n[1]]:n[1]}}var xt=class{constructor(e=null,t={}){if(this._onBasicInput=e=>{this.manager.emit(e.srcEvent.type,e)},this._onOtherEvent=e=>{this.manager.emit(e.type,e)},this.options={recognizers:[],events:{},touchAction:`compute`,tabIndex:0,cssProps:{},...t},this.events=new Map,this.element=e,e){this.manager=new Le(e,this.options);for(let e of this.options.recognizers){let{recognizer:t,recognizeWith:n,requireFailure:r}=bt(e);this.manager.add(t),n&&t.recognizeWith(n),r&&t.requireFailure(r)}this.manager.on(`hammer.input`,this._onBasicInput),this.wheelInput=new et(e,this._onOtherEvent,{enable:!1}),this.moveInput=new nt(e,this._onOtherEvent,{enable:!1}),this.keyInput=new it(e,this._onOtherEvent,{enable:!1,tabIndex:t.tabIndex}),this.contextmenuInput=new at(e,this._onOtherEvent,{enable:!1}),this.on(this.options.events)}}getElement(){return this.element}destroy(){this.element&&(this.wheelInput.destroy(),this.moveInput.destroy(),this.keyInput.destroy(),this.contextmenuInput.destroy(),this.manager.destroy())}on(e,t,n){this._addEventHandler(e,t,n,!1)}once(e,t,n){this._addEventHandler(e,t,n,!0)}watch(e,t,n){this._addEventHandler(e,t,n,!1,!0)}off(e,t){this._removeEventHandler(e,t)}_toggleRecognizer(e,t){let{manager:n}=this;if(!n)return;let r=n.get(e);r&&(r.set({enable:t}),n.touchAction.update()),this.wheelInput?.enableEventType(e,t),this.moveInput?.enableEventType(e,t),this.keyInput?.enableEventType(e,t),this.contextmenuInput?.enableEventType(e,t)}_addEventHandler(e,t,n,r,i){if(typeof e!=`string`){n=t;for(let[t,a]of Object.entries(e))this._addEventHandler(t,a,n,r,i);return}let{manager:a,events:o}=this;if(!a)return;let s=o.get(e);if(!s){let t=this._getRecognizerName(e)||e;s=new yt(this,t),o.set(e,s),a&&a.on(e,s.handleEvent)}s.add(e,t,n,r,i),s.isEmpty()||this._toggleRecognizer(s.recognizerName,!0)}_removeEventHandler(e,t){if(typeof e!=`string`){for(let[t,n]of Object.entries(e))this._removeEventHandler(t,n);return}let{events:n}=this,r=n.get(e);if(r&&(r.remove(e,t),r.isEmpty())){let{recognizerName:e}=r,t=!1;for(let r of n.values())if(r.recognizerName===e&&!r.isEmpty()){t=!0;break}t||this._toggleRecognizer(e,!1)}}_getRecognizerName(e){return this.manager.recognizers.find(t=>t.getEventNames().includes(e))?.options.event}},St={DEFAULT:`default`,LNGLAT:`lnglat`,METER_OFFSETS:`meter-offsets`,LNGLAT_OFFSETS:`lnglat-offsets`,CARTESIAN:`cartesian`};Object.defineProperty(St,"IDENTITY",{get:()=>(O.deprecated(`COORDINATE_SYSTEM.IDENTITY`,`COORDINATE_SYSTEM.CARTESIAN`)(),St.CARTESIAN)});var Ct={WEB_MERCATOR:1,GLOBE:2,WEB_MERCATOR_AUTO_OFFSET:4,IDENTITY:0},wt={common:0,meters:1,pixels:2},Tt={click:`onClick`,dblclick:`onClick`,panstart:`onDragStart`,panmove:`onDrag`,panend:`onDragEnd`},Et={multipan:[Ge,{threshold:10,direction:A.Vertical,pointers:2}],pinch:[qe,{},null,[`multipan`]],pan:[Ge,{threshold:1},[`pinch`],[`multipan`]],dblclick:[Ue,{event:`dblclick`,taps:2}],click:[Ue,{event:`click`},null,[`dblclick`]]};function Dt(){let e;if(typeof window<`u`&&window.performance)e=window.performance.now();else if(typeof process<`u`&&process.hrtime){let t=process.hrtime();e=t[0]*1e3+t[1]/1e6}else e=Date.now();return e}var Ot=class{constructor(e,t){this.sampleSize=1,this.time=0,this.count=0,this.samples=0,this.lastTiming=0,this.lastSampleTime=0,this.lastSampleCount=0,this._count=0,this._time=0,this._samples=0,this._startTime=0,this._timerPending=!1,this.name=e,this.type=t,this.reset()}reset(){return this.time=0,this.count=0,this.samples=0,this.lastTiming=0,this.lastSampleTime=0,this.lastSampleCount=0,this._count=0,this._time=0,this._samples=0,this._startTime=0,this._timerPending=!1,this}setSampleSize(e){return this.sampleSize=e,this}incrementCount(){return this.addCount(1),this}decrementCount(){return this.subtractCount(1),this}addCount(e){return this._count+=e,this._samples++,this._checkSampling(),this}subtractCount(e){return this._count-=e,this._samples++,this._checkSampling(),this}addTime(e){return this._time+=e,this.lastTiming=e,this._samples++,this._checkSampling(),this}timeStart(){return this._startTime=Dt(),this._timerPending=!0,this}timeEnd(){return this._timerPending?(this.addTime(Dt()-this._startTime),this._timerPending=!1,this._checkSampling(),this):this}getSampleAverageCount(){return this.sampleSize>0?this.lastSampleCount/this.sampleSize:0}getSampleAverageTime(){return this.sampleSize>0?this.lastSampleTime/this.sampleSize:0}getSampleHz(){return this.lastSampleTime>0?this.sampleSize/(this.lastSampleTime/1e3):0}getAverageCount(){return this.samples>0?this.count/this.samples:0}getAverageTime(){return this.samples>0?this.time/this.samples:0}getHz(){return this.time>0?this.samples/(this.time/1e3):0}_checkSampling(){this._samples===this.sampleSize&&(this.lastSampleTime=this._time,this.lastSampleCount=this._count,this.count+=this._count,this.time+=this._time,this.samples+=this._samples,this._time=0,this._count=0,this._samples=0)}},kt=class{constructor(e){this.stats={},this.id=e.id,this.stats={},this._initializeStats(e.stats),Object.seal(this)}get(e,t=`count`){return this._getOrCreate({name:e,type:t})}get size(){return Object.keys(this.stats).length}reset(){for(let e of Object.values(this.stats))e.reset();return this}forEach(e){for(let t of Object.values(this.stats))e(t)}getTable(){let e={};return this.forEach(t=>{e[t.name]={time:t.time||0,count:t.count||0,average:t.getAverageTime()||0,hz:t.getHz()||0}}),e}_initializeStats(e=[]){e.forEach(e=>this._getOrCreate(e))}_getOrCreate(e){let{name:t,type:n}=e,r=this.stats[t];return r||(r=e instanceof Ot?e:new Ot(t,n),this.stats[t]=r),r}},At=`GPU Time and Memory`,jt=[`Adapter`,`GPU`,`GPU Type`,`GPU Backend`,`Frame Rate`,`CPU Time`,`GPU Time`,`GPU Memory`,`Buffer Memory`,`Texture Memory`,`Referenced Buffer Memory`,`Referenced Texture Memory`,`Swap Chain Texture`],Mt=new WeakMap,Nt=new WeakMap,Pt=new class{stats=new Map;getStats(e){return this.get(e)}get(e){this.stats.has(e)||this.stats.set(e,new kt({id:e}));let t=this.stats.get(e);return e===At&&Ft(t,jt),t}};function Ft(e,t){let n=e.stats,r=!1;for(let i of t)n[i]||(e.get(i),r=!0);let i=Object.keys(n).length,a=Mt.get(e);if(!r&&a?.orderedStatNames===t&&a.statCount===i)return;let o={},s=Nt.get(t);s||(s=new Set(t),Nt.set(t,s));for(let e of t)n[e]&&(o[e]=n[e]);for(let[e,t]of Object.entries(n))s.has(e)||(o[e]=t);for(let e of Object.keys(n))delete n[e];Object.assign(n,o),Mt.set(e,{orderedStatNames:t,statCount:i})}var M=new T({id:`luma.gl`}),It={};function Lt(e=`id`){return It[e]=It[e]||1,`${e}-${It[e]++}`}var Rt=`cpu-hotspot-profiler`,zt=`GPU Resource Counts`,Bt=`Resource Counts`,Vt=`GPU Time and Memory`,Ht=[`Resources`,`Buffers`,`Textures`,`Samplers`,`TextureViews`,`Framebuffers`,`QuerySets`,`Shaders`,`RenderPipelines`,`ComputePipelines`,`PipelineLayouts`,`VertexArrays`,`RenderPasss`,`ComputePasss`,`CommandEncoders`,`CommandBuffers`],Ut=[`Resources`,`Buffers`,`Textures`,`Samplers`,`TextureViews`,`Framebuffers`,`QuerySets`,`Shaders`,`RenderPipelines`,`SharedRenderPipelines`,`ComputePipelines`,`PipelineLayouts`,`VertexArrays`,`RenderPasss`,`ComputePasss`,`CommandEncoders`,`CommandBuffers`],Wt=Ht.flatMap(e=>[`${e} Created`,`${e} Active`]),Gt=Ut.flatMap(e=>[`${e} Created`,`${e} Active`]),Kt=new WeakMap,qt=new WeakMap,N=class{static defaultProps={id:`undefined`,handle:void 0,userData:void 0};toString(){return`${this[Symbol.toStringTag]||this.constructor.name}:"${this.id}"`}id;props;userData={};_device;destroyed=!1;allocatedBytes=0;allocatedBytesName=null;_attachedResources=new Set;constructor(e,t,n){if(!e)throw Error(`no device`);this._device=e,this.props=Jt(t,n);let r=this.props.id===`undefined`?Lt(this[Symbol.toStringTag]):this.props.id;this.props.id=r,this.id=r,this.userData=this.props.userData||{},this.addStats()}destroy(){this.destroyed||this.destroyResource()}delete(){return this.destroy(),this}getProps(){return this.props}attachResource(e){this._attachedResources.add(e)}detachResource(e){this._attachedResources.delete(e)}destroyAttachedResource(e){this._attachedResources.delete(e)&&e.destroy()}destroyAttachedResources(){for(let e of this._attachedResources)e.destroy();this._attachedResources=new Set}destroyResource(){this.destroyed||=(this.destroyAttachedResources(),this.removeStats(),!0)}removeStats(){let e=Zt(this._device),t=e?Qt():0,n=[this._device.statsManager.getStats(zt),this._device.statsManager.getStats(Bt)],r=Xt(this._device);for(let e of n)Yt(e,r);let i=this.getStatsName();for(let e of n)e.get(`Resources Active`).decrementCount(),e.get(`${i}s Active`).decrementCount();e&&(e.statsBookkeepingCalls=(e.statsBookkeepingCalls||0)+1,e.statsBookkeepingTimeMs=(e.statsBookkeepingTimeMs||0)+(Qt()-t))}trackAllocatedMemory(e,t=this.getStatsName()){let n=Zt(this._device),r=n?Qt():0,i=this._device.statsManager.getStats(Vt);this.allocatedBytes>0&&this.allocatedBytesName&&(i.get(`GPU Memory`).subtractCount(this.allocatedBytes),i.get(`${this.allocatedBytesName} Memory`).subtractCount(this.allocatedBytes)),i.get(`GPU Memory`).addCount(e),i.get(`${t} Memory`).addCount(e),n&&(n.statsBookkeepingCalls=(n.statsBookkeepingCalls||0)+1,n.statsBookkeepingTimeMs=(n.statsBookkeepingTimeMs||0)+(Qt()-r)),this.allocatedBytes=e,this.allocatedBytesName=t}trackReferencedMemory(e,t=this.getStatsName()){this.trackAllocatedMemory(e,`Referenced ${t}`)}trackDeallocatedMemory(e=this.getStatsName()){if(this.allocatedBytes===0){this.allocatedBytesName=null;return}let t=Zt(this._device),n=t?Qt():0,r=this._device.statsManager.getStats(Vt);r.get(`GPU Memory`).subtractCount(this.allocatedBytes),r.get(`${this.allocatedBytesName||e} Memory`).subtractCount(this.allocatedBytes),t&&(t.statsBookkeepingCalls=(t.statsBookkeepingCalls||0)+1,t.statsBookkeepingTimeMs=(t.statsBookkeepingTimeMs||0)+(Qt()-n)),this.allocatedBytes=0,this.allocatedBytesName=null}trackDeallocatedReferencedMemory(e=this.getStatsName()){this.trackDeallocatedMemory(`Referenced ${e}`)}addStats(){let e=this.getStatsName(),t=Zt(this._device),n=t?Qt():0,r=[this._device.statsManager.getStats(zt),this._device.statsManager.getStats(Bt)],i=Xt(this._device);for(let e of r)Yt(e,i);for(let t of r)t.get(`Resources Created`).incrementCount(),t.get(`Resources Active`).incrementCount(),t.get(`${e}s Created`).incrementCount(),t.get(`${e}s Active`).incrementCount();t&&(t.statsBookkeepingCalls=(t.statsBookkeepingCalls||0)+1,t.statsBookkeepingTimeMs=(t.statsBookkeepingTimeMs||0)+(Qt()-n)),$t(this._device,e)}getStatsName(){return en(this)}};function Jt(e,t){let n={...t};for(let t in e)e[t]!==void 0&&(n[t]=e[t]);return n}function Yt(e,t){let n=e.stats,r=!1;for(let i of t)n[i]||(e.get(i),r=!0);let i=Object.keys(n).length,a=Kt.get(e);if(!r&&a?.orderedStatNames===t&&a.statCount===i)return;let o={},s=qt.get(t);s||(s=new Set(t),qt.set(t,s));for(let e of t)n[e]&&(o[e]=n[e]);for(let[e,t]of Object.entries(n))s.has(e)||(o[e]=t);for(let e of Object.keys(n))delete n[e];Object.assign(n,o),Kt.set(e,{orderedStatNames:t,statCount:i})}function Xt(e){return e.type===`webgl`?Gt:Wt}function Zt(e){let t=e.userData[Rt];return t?.enabled?t:null}function Qt(){return globalThis.performance?.now?.()??Date.now()}function $t(e,t){let n=Zt(e);if(!(!n||!n.activeDefaultFramebufferAcquireDepth))switch(n.transientCanvasResourceCreates=(n.transientCanvasResourceCreates||0)+1,t){case`Texture`:n.transientCanvasTextureCreates=(n.transientCanvasTextureCreates||0)+1;break;case`TextureView`:n.transientCanvasTextureViewCreates=(n.transientCanvasTextureViewCreates||0)+1;break;case`Sampler`:n.transientCanvasSamplerCreates=(n.transientCanvasSamplerCreates||0)+1;break;case`Framebuffer`:n.transientCanvasFramebufferCreates=(n.transientCanvasFramebufferCreates||0)+1;break;default:break}}function en(e){let t=Object.getPrototypeOf(e);for(;t;){let n=Object.getPrototypeOf(t);if(!n||n===N.prototype)return tn(t)||e[Symbol.toStringTag]||e.constructor.name;t=n}return e[Symbol.toStringTag]||e.constructor.name}function tn(e){let t=Object.getOwnPropertyDescriptor(e,Symbol.toStringTag);return typeof t?.get==`function`?t.get.call(e):typeof t?.value==`string`?t.value:null}var P=class e extends N{static INDEX=16;static VERTEX=32;static UNIFORM=64;static STORAGE=128;static INDIRECT=256;static QUERY_RESOLVE=512;static MAP_READ=1;static MAP_WRITE=2;static COPY_SRC=4;static COPY_DST=8;get[Symbol.toStringTag](){return`Buffer`}usage;indexType;updateTimestamp;constructor(t,n){let r={...n};(n.usage||0)&e.INDEX&&!n.indexType&&(n.data instanceof Uint32Array?r.indexType=`uint32`:n.data instanceof Uint16Array?r.indexType=`uint16`:n.data instanceof Uint8Array&&(r.indexType=`uint8`)),delete r.data,super(t,r,e.defaultProps),this.usage=r.usage||0,this.indexType=r.indexType,this.updateTimestamp=t.incrementTimestamp()}clone(e){return this.device.createBuffer({...this.props,...e})}static DEBUG_DATA_MAX_LENGTH=32;debugData=new ArrayBuffer(0);_setDebugData(t,n,r){let i=null,a;ArrayBuffer.isView(t)?(i=t,a=t.buffer):a=t;let o=Math.min(t?t.byteLength:r,e.DEBUG_DATA_MAX_LENGTH);if(a===null)this.debugData=new ArrayBuffer(o);else{let e=Math.min(i?.byteOffset||0,a.byteLength),t=Math.max(0,a.byteLength-e),n=Math.min(o,t);this.debugData=new Uint8Array(a,e,n).slice().buffer}}static defaultProps={...N.defaultProps,usage:0,byteLength:0,byteOffset:0,data:null,indexType:`uint16`,onMapped:void 0}},nn=new class{getDataTypeInfo(e){let[t,n,r]=rn[e],i=e.includes(`norm`);return{signedType:t,primitiveType:n,byteLength:r,normalized:i,integer:!i&&!e.startsWith(`float`),signed:e.startsWith(`s`)}}getNormalizedDataType(e){let t=e;switch(t){case`uint8`:return`unorm8`;case`sint8`:return`snorm8`;case`uint16`:return`unorm16`;case`sint16`:return`snorm16`;default:return t}}alignTo(e,t){switch(t){case 1:return e;case 2:return e+e%2;default:return e+(4-e%4)%4}}getDataType(e){let t=ArrayBuffer.isView(e)?e.constructor:e;if(t===Uint8ClampedArray)return`uint8`;let n=Object.values(rn).find(e=>t===e[4]);if(!n)throw Error(t.name);return n[0]}getTypedArrayConstructor(e){let[,,,,t]=rn[e];return t}},rn={uint8:[`uint8`,`u32`,1,!1,Uint8Array],sint8:[`sint8`,`i32`,1,!1,Int8Array],unorm8:[`uint8`,`f32`,1,!0,Uint8Array],snorm8:[`sint8`,`f32`,1,!0,Int8Array],uint16:[`uint16`,`u32`,2,!1,Uint16Array],sint16:[`sint16`,`i32`,2,!1,Int16Array],unorm16:[`uint16`,`u32`,2,!0,Uint16Array],snorm16:[`sint16`,`i32`,2,!0,Int16Array],float16:[`float16`,`f16`,2,!1,Uint16Array],float32:[`float32`,`f32`,4,!1,Float32Array],uint32:[`uint32`,`u32`,4,!1,Uint32Array],sint32:[`sint32`,`i32`,4,!1,Int32Array]},an=new class{getVertexFormatInfo(e){let t;e.endsWith(`-webgl`)&&(e.replace(`-webgl`,``),t=!0);let[n,r]=e.split(`x`),i=n,a=r?parseInt(r):1,o=nn.getDataTypeInfo(i),s={type:i,components:a,byteLength:o.byteLength*a,integer:o.integer,signed:o.signed,normalized:o.normalized};return t&&(s.webglOnly=!0),s}makeVertexFormat(e,t,n){let r=n?nn.getNormalizedDataType(e):e;switch(r){case`unorm8`:return t===1?`unorm8`:t===3?`unorm8x3-webgl`:`${r}x${t}`;case`snorm8`:return t===1?`snorm8`:t===3?`snorm8x3-webgl`:`${r}x${t}`;case`uint8`:case`sint8`:if(t===1||t===3)throw Error(`size: ${t}`);return`${r}x${t}`;case`uint16`:return t===1?`uint16`:t===3?`uint16x3-webgl`:`${r}x${t}`;case`sint16`:return t===1?`sint16`:t===3?`sint16x3-webgl`:`${r}x${t}`;case`unorm16`:return t===1?`unorm16`:t===3?`unorm16x3-webgl`:`${r}x${t}`;case`snorm16`:return t===1?`snorm16`:t===3?`snorm16x3-webgl`:`${r}x${t}`;case`float16`:if(t===1||t===3)throw Error(`size: ${t}`);return`${r}x${t}`;default:return t===1?r:`${r}x${t}`}}getVertexFormatFromAttribute(e,t,n){if(!t||t>4)throw Error(`size ${t}`);let r=t,i=nn.getDataType(e);return this.makeVertexFormat(i,r,n)}getCompatibleVertexFormat(e){let t;switch(e.primitiveType){case`f32`:t=`float32`;break;case`i32`:t=`sint32`;break;case`u32`:t=`uint32`;break;case`f16`:return e.components<=2?`float16x2`:`float16x4`}return e.components===1?t:`${t}x${e.components}`}},on=`texture-compression-bc`,F=`texture-compression-astc`,sn=`texture-compression-etc2`,cn=`texture-compression-etc1-webgl`,ln=`texture-compression-pvrtc-webgl`,un=`texture-compression-atc-webgl`,dn=`float32-renderable-webgl`,fn=`float16-renderable-webgl`,pn=`rgb9e5ufloat-renderable-webgl`,mn=`snorm8-renderable-webgl`,hn=`norm16-webgl`,gn=`norm16-renderable-webgl`,_n=`snorm16-renderable-webgl`,vn=`float32-filterable`,yn=`float16-filterable-webgl`;function bn(e){let t=wn[e];if(!t)throw Error(`Unsupported texture format ${e}`);return t}function xn(){return wn}var Sn={r8unorm:{},rg8unorm:{},"rgb8unorm-webgl":{},rgba8unorm:{},"rgba8unorm-srgb":{},r8snorm:{render:mn},rg8snorm:{render:mn},"rgb8snorm-webgl":{},rgba8snorm:{render:mn},r8uint:{},rg8uint:{},rgba8uint:{},r8sint:{},rg8sint:{},rgba8sint:{},bgra8unorm:{},"bgra8unorm-srgb":{},r16unorm:{f:hn,render:gn},rg16unorm:{f:hn,render:gn},"rgb16unorm-webgl":{f:hn,render:!1},rgba16unorm:{f:hn,render:gn},r16snorm:{f:hn,render:_n},rg16snorm:{f:hn,render:_n},"rgb16snorm-webgl":{f:hn,render:!1},rgba16snorm:{f:hn,render:_n},r16uint:{},rg16uint:{},rgba16uint:{},r16sint:{},rg16sint:{},rgba16sint:{},r16float:{render:fn,filter:`float16-filterable-webgl`},rg16float:{render:fn,filter:yn},rgba16float:{render:fn,filter:yn},r32uint:{},rg32uint:{},rgba32uint:{},r32sint:{},rg32sint:{},rgba32sint:{},r32float:{render:dn,filter:vn},rg32float:{render:!1,filter:vn},"rgb32float-webgl":{render:dn,filter:vn},rgba32float:{render:dn,filter:vn},"rgba4unorm-webgl":{channels:`rgba`,bitsPerChannel:[4,4,4,4],packed:!0},"rgb565unorm-webgl":{channels:`rgb`,bitsPerChannel:[5,6,5,0],packed:!0},"rgb5a1unorm-webgl":{channels:`rgba`,bitsPerChannel:[5,5,5,1],packed:!0},rgb9e5ufloat:{channels:`rgb`,packed:!0,render:pn},rg11b10ufloat:{channels:`rgb`,bitsPerChannel:[11,11,10,0],packed:!0,p:1,render:dn},rgb10a2unorm:{channels:`rgba`,bitsPerChannel:[10,10,10,2],packed:!0,p:1},rgb10a2uint:{channels:`rgba`,bitsPerChannel:[10,10,10,2],packed:!0,p:1},stencil8:{attachment:`stencil`,bitsPerChannel:[8,0,0,0],dataType:`uint8`},depth16unorm:{attachment:`depth`,bitsPerChannel:[16,0,0,0],dataType:`uint16`},depth24plus:{attachment:`depth`,bitsPerChannel:[24,0,0,0],dataType:`uint32`},depth32float:{attachment:`depth`,bitsPerChannel:[32,0,0,0],dataType:`float32`},"depth24plus-stencil8":{attachment:`depth-stencil`,bitsPerChannel:[24,8,0,0],packed:!0},"depth32float-stencil8":{attachment:`depth-stencil`,bitsPerChannel:[32,8,0,0],packed:!0}},Cn={"bc1-rgb-unorm-webgl":{f:on},"bc1-rgb-unorm-srgb-webgl":{f:on},"bc1-rgba-unorm":{f:on},"bc1-rgba-unorm-srgb":{f:on},"bc2-rgba-unorm":{f:on},"bc2-rgba-unorm-srgb":{f:on},"bc3-rgba-unorm":{f:on},"bc3-rgba-unorm-srgb":{f:on},"bc4-r-unorm":{f:on},"bc4-r-snorm":{f:on},"bc5-rg-unorm":{f:on},"bc5-rg-snorm":{f:on},"bc6h-rgb-ufloat":{f:on},"bc6h-rgb-float":{f:on},"bc7-rgba-unorm":{f:on},"bc7-rgba-unorm-srgb":{f:on},"etc2-rgb8unorm":{f:sn},"etc2-rgb8unorm-srgb":{f:sn},"etc2-rgb8a1unorm":{f:sn},"etc2-rgb8a1unorm-srgb":{f:sn},"etc2-rgba8unorm":{f:sn},"etc2-rgba8unorm-srgb":{f:sn},"eac-r11unorm":{f:sn},"eac-r11snorm":{f:sn},"eac-rg11unorm":{f:sn},"eac-rg11snorm":{f:sn},"astc-4x4-unorm":{f:F},"astc-4x4-unorm-srgb":{f:F},"astc-5x4-unorm":{f:F},"astc-5x4-unorm-srgb":{f:F},"astc-5x5-unorm":{f:F},"astc-5x5-unorm-srgb":{f:F},"astc-6x5-unorm":{f:F},"astc-6x5-unorm-srgb":{f:F},"astc-6x6-unorm":{f:F},"astc-6x6-unorm-srgb":{f:F},"astc-8x5-unorm":{f:F},"astc-8x5-unorm-srgb":{f:F},"astc-8x6-unorm":{f:F},"astc-8x6-unorm-srgb":{f:F},"astc-8x8-unorm":{f:F},"astc-8x8-unorm-srgb":{f:F},"astc-10x5-unorm":{f:F},"astc-10x5-unorm-srgb":{f:F},"astc-10x6-unorm":{f:F},"astc-10x6-unorm-srgb":{f:F},"astc-10x8-unorm":{f:F},"astc-10x8-unorm-srgb":{f:F},"astc-10x10-unorm":{f:F},"astc-10x10-unorm-srgb":{f:F},"astc-12x10-unorm":{f:F},"astc-12x10-unorm-srgb":{f:F},"astc-12x12-unorm":{f:F},"astc-12x12-unorm-srgb":{f:F},"pvrtc-rgb4unorm-webgl":{f:ln},"pvrtc-rgba4unorm-webgl":{f:ln},"pvrtc-rgb2unorm-webgl":{f:ln},"pvrtc-rgba2unorm-webgl":{f:ln},"etc1-rbg-unorm-webgl":{f:cn},"atc-rgb-unorm-webgl":{f:un},"atc-rgba-unorm-webgl":{f:un},"atc-rgbai-unorm-webgl":{f:un}},wn={...Sn,...Cn},Tn=/^(r|rg|rgb|rgba|bgra)([0-9]*)([a-z]*)(-srgb)?(-webgl)?$/,En=[`rgb`,`rgba`,`bgra`],Dn=[`depth`,`stencil`],On=[`bc1`,`bc2`,`bc3`,`bc4`,`bc5`,`bc6`,`bc7`,`etc1`,`etc2`,`eac`,`atc`,`astc`,`pvrtc`],kn=new class{isColor(e){return En.some(t=>e.startsWith(t))}isDepthStencil(e){return Dn.some(t=>e.startsWith(t))}isCompressed(e){return On.some(t=>e.startsWith(t))}getInfo(e){return Mn(e)}getCapabilities(e){return jn(e)}computeMemoryLayout(e){return An(e)}};function An({format:e,width:t,height:n,depth:r,byteAlignment:i}){let{bytesPerPixel:a,bytesPerBlock:o=a,blockWidth:s=1,blockHeight:c=1,compressed:l=!1}=kn.getInfo(e),u=l?Math.ceil(t/s):t,d=l?Math.ceil(n/c):n,f=u*o,p=Math.ceil(f/i)*i,m=d,h=p*m*r;return{bytesPerPixel:a,bytesPerRow:p,rowsPerImage:m,depthOrArrayLayers:r,bytesPerImage:p*m,byteLength:h}}function jn(e){let t=bn(e),n={format:e,create:t.f??!0,render:t.render??!0,filter:t.filter??!0,blend:t.blend??!0,store:t.store??!0},r=Mn(e),i=e.startsWith(`depth`)||e.startsWith(`stencil`),a=r?.signed,o=r?.integer,s=r?.webgl,c=!!r?.compressed;return n.render&&=!i&&!c,n.filter&&=!i&&!a&&!o&&!s,n}function Mn(e){let t=Nn(e);if(kn.isCompressed(e)){t.channels=`rgb`,t.components=3,t.bytesPerPixel=1,t.srgb=!1,t.compressed=!0,t.bytesPerBlock=Fn(e);let n=Pn(e);n&&(t.blockWidth=n.blockWidth,t.blockHeight=n.blockHeight)}let n=t.packed?null:Tn.exec(e);if(n){let[,r,i,a,o,s]=n,c=`${a}${i}`,l=nn.getDataTypeInfo(c),u=l.byteLength*8,d=r?.length??1,f=[u,d>=2?u:0,d>=3?u:0,d>=4?u:0];t={format:e,attachment:t.attachment,dataType:l.signedType,components:d,channels:r,integer:l.integer,signed:l.signed,normalized:l.normalized,bitsPerChannel:f,bytesPerPixel:l.byteLength*d,packed:t.packed,srgb:t.srgb},s===`-webgl`&&(t.webgl=!0),o===`-srgb`&&(t.srgb=!0)}return e.endsWith(`-webgl`)&&(t.webgl=!0),e.endsWith(`-srgb`)&&(t.srgb=!0),t}function Nn(e){let t=bn(e),n=t.bytesPerPixel||1,r=t.bitsPerChannel||[8,8,8,8];return delete t.bitsPerChannel,delete t.bytesPerPixel,delete t.f,delete t.render,delete t.filter,delete t.blend,delete t.store,{...t,format:e,attachment:t.attachment||`color`,channels:t.channels||`r`,components:t.components||t.channels?.length||1,bytesPerPixel:n,bitsPerChannel:r,dataType:t.dataType||`uint8`,srgb:t.srgb??!1,packed:t.packed??!1,webgl:t.webgl??!1,integer:t.integer??!1,signed:t.signed??!1,normalized:t.normalized??!1,compressed:t.compressed??!1}}function Pn(e){let t=/.*-(\d+)x(\d+)-.*/.exec(e);if(t){let[,e,n]=t;return{blockWidth:Number(e),blockHeight:Number(n)}}return e.startsWith(`bc`)||e.startsWith(`etc1`)||e.startsWith(`etc2`)||e.startsWith(`eac`)||e.startsWith(`atc`)||e.startsWith(`pvrtc-rgb4`)||e.startsWith(`pvrtc-rgba4`)?{blockWidth:4,blockHeight:4}:e.startsWith(`pvrtc-rgb2`)||e.startsWith(`pvrtc-rgba2`)?{blockWidth:8,blockHeight:4}:null}function Fn(e){return e.startsWith(`bc1`)||e.startsWith(`bc4`)||e.startsWith(`etc1`)||e.startsWith(`etc2-rgb8`)||e.startsWith(`etc2-rgb8a1`)||e.startsWith(`eac-r11`)||e===`atc-rgb-unorm-webgl`?8:e.startsWith(`bc2`)||e.startsWith(`bc3`)||e.startsWith(`bc5`)||e.startsWith(`bc6h`)||e.startsWith(`bc7`)||e.startsWith(`etc2-rgba8`)||e.startsWith(`eac-rg11`)||e.startsWith(`astc`)||e===`atc-rgba-unorm-webgl`||e===`atc-rgbai-unorm-webgl`?16:e.startsWith(`pvrtc`)?8:16}function In(e){return typeof ImageData<`u`&&e instanceof ImageData||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLVideoElement<`u`&&e instanceof HTMLVideoElement||typeof VideoFrame<`u`&&e instanceof VideoFrame||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof OffscreenCanvas<`u`&&e instanceof OffscreenCanvas}function Ln(e){if(typeof ImageData<`u`&&e instanceof ImageData||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof OffscreenCanvas<`u`&&e instanceof OffscreenCanvas)return{width:e.width,height:e.height};if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement)return{width:e.naturalWidth,height:e.naturalHeight};if(typeof HTMLVideoElement<`u`&&e instanceof HTMLVideoElement)return{width:e.videoWidth,height:e.videoHeight};if(typeof VideoFrame<`u`&&e instanceof VideoFrame)return{width:e.displayWidth,height:e.displayHeight};throw Error(`Unknown image type`)}var Rn=class{};function zn(e,t){return[Bn(e),...t.map(Bn).filter(e=>e!==void 0)].filter(e=>e!==void 0)}function Bn(e){if(e!==void 0){if(e===null||typeof e==`string`||typeof e==`number`||typeof e==`boolean`)return e;if(e instanceof Error)return e.message;if(Array.isArray(e))return e.map(Bn);if(typeof e==`object`){if(Vn(e)){let t=String(e);if(t!==`[object Object]`)return t}return Hn(e)?Un(e):e.constructor?.name||`Object`}return String(e)}}function Vn(e){return`toString`in e&&typeof e.toString==`function`&&e.toString!==Object.prototype.toString}function Hn(e){return`message`in e&&`type`in e}function Un(e){let t=typeof e.type==`string`?e.type:`message`,n=typeof e.message==`string`?e.message:``,r=typeof e.lineNum==`number`?e.lineNum:null,i=typeof e.linePos==`number`?e.linePos:null;return`${t}${r!==null&&i!==null?` @ ${r}:${i}`:r===null?``:` @ ${r}`}: ${n}`.trim()}var Wn=class{features;disabledFeatures;constructor(e=[],t){this.features=new Set(e),this.disabledFeatures=t||{}}*[Symbol.iterator](){yield*this.features}has(e){return!this.disabledFeatures?.[e]&&this.features.has(e)}},Gn=class e{static defaultProps={id:null,powerPreference:`high-performance`,failIfMajorPerformanceCaveat:!1,createCanvasContext:void 0,webgl:{},onError:(e,t)=>{},onResize:(e,t)=>{let[n,r]=e.getDevicePixelSize();M.log(1,`${e} resized => ${n}x${r}px`)()},onPositionChange:(e,t)=>{let[n,r]=e.getPosition();M.log(1,`${e} repositioned => ${n},${r}`)()},onVisibilityChange:e=>M.log(1,`${e} Visibility changed ${e.isVisible}`)(),onDevicePixelRatioChange:(e,t)=>M.log(1,`${e} DPR changed ${t.oldRatio} => ${e.devicePixelRatio}`)(),debug:qn(),debugGPUTime:!1,debugShaders:M.get(`debug-shaders`)||void 0,debugFramebuffers:!!M.get(`debug-framebuffers`),debugFactories:!!M.get(`debug-factories`),debugWebGL:!!M.get(`debug-webgl`),debugSpectorJS:void 0,debugSpectorJSUrl:void 0,_reuseDevices:!1,_requestMaxLimits:!0,_cacheShaders:!0,_destroyShaders:!1,_cachePipelines:!0,_sharePipelines:!0,_destroyPipelines:!1,_initializeFeatures:!0,_disabledFeatures:{"compilation-status-async-webgl":!0},_handle:void 0};get[Symbol.toStringTag](){return`Device`}toString(){return`Device(${this.id})`}id;props;userData={};statsManager=Pt;_factories={};timestamp=0;_reused=!1;_moduleData={};_textureCaps={};_debugGPUTimeQuery=null;constructor(t){this.props={...e.defaultProps,...t},this.id=this.props.id||Lt(this[Symbol.toStringTag].toLowerCase())}getVertexFormatInfo(e){return an.getVertexFormatInfo(e)}isVertexFormatSupported(e){return!0}getTextureFormatInfo(e){return kn.getInfo(e)}getTextureFormatCapabilities(e){let t=this._textureCaps[e];if(!t){let n=this._getDeviceTextureFormatCapabilities(e);t=this._getDeviceSpecificTextureFormatCapabilities(n),this._textureCaps[e]=t}return t}getMipLevelCount(e,t,n=1){return 1+Math.floor(Math.log2(Math.max(e,t,n)))}isExternalImage(e){return In(e)}getExternalImageSize(e){return Ln(e)}isTextureFormatSupported(e){return this.getTextureFormatCapabilities(e).create}isTextureFormatFilterable(e){return this.getTextureFormatCapabilities(e).filter}isTextureFormatRenderable(e){return this.getTextureFormatCapabilities(e).render}isTextureFormatCompressed(e){return kn.isCompressed(e)}getSupportedCompressedTextureFormats(){let e=[];for(let t of Object.keys(xn()))this.isTextureFormatCompressed(t)&&this.isTextureFormatSupported(t)&&e.push(t);return e}pushDebugGroup(e){this.commandEncoder.pushDebugGroup(e)}popDebugGroup(){this.commandEncoder?.popDebugGroup()}insertDebugMarker(e){this.commandEncoder?.insertDebugMarker(e)}loseDevice(){return!1}incrementTimestamp(){return this.timestamp++}reportError(e,t,...n){if(!this.props.onError(e,t)){let r=zn(t,n);return M.error(this.type===`webgl`?`%cWebGL`:`%cWebGPU`,`color: white; background: red; padding: 2px 6px; border-radius: 3px;`,e.message,...r)}return()=>{}}debug(){if(this.props.debug)debugger;else M.once(0,`'Type luma.log.set({debug: true}) in console to enable debug breakpoints',
or create a device with the 'debug: true' prop.`)()}getDefaultCanvasContext(){if(!this.canvasContext)throw Error(`Device has no default CanvasContext. See props.createCanvasContext`);return this.canvasContext}createFence(){throw Error(`createFence() not implemented`)}beginRenderPass(e){return this.commandEncoder.beginRenderPass(e)}beginComputePass(e){return this.commandEncoder.beginComputePass(e)}generateMipmapsWebGPU(e){throw Error(`not implemented`)}_createSharedRenderPipelineWebGL(e){throw Error(`_createSharedRenderPipelineWebGL() not implemented`)}_createBindGroupLayoutWebGPU(e,t){throw Error(`_createBindGroupLayoutWebGPU() not implemented`)}_createBindGroupWebGPU(e,t,n,r,i){throw Error(`_createBindGroupWebGPU() not implemented`)}_supportsDebugGPUTime(){return this.features.has(`timestamp-query`)&&!!(this.props.debug||this.props.debugGPUTime)}_enableDebugGPUTime(e=256){if(!this._supportsDebugGPUTime())return null;if(this._debugGPUTimeQuery)return this._debugGPUTimeQuery;try{this._debugGPUTimeQuery=this.createQuerySet({type:`timestamp`,count:e}),this.commandEncoder=this.createCommandEncoder({id:this.commandEncoder.props.id,timeProfilingQuerySet:this._debugGPUTimeQuery})}catch{this._debugGPUTimeQuery=null}return this._debugGPUTimeQuery}_disableDebugGPUTime(){this._debugGPUTimeQuery&&=(this.commandEncoder.getTimeProfilingQuerySet()===this._debugGPUTimeQuery&&(this.commandEncoder=this.createCommandEncoder({id:this.commandEncoder.props.id})),this._debugGPUTimeQuery.destroy(),null)}_isDebugGPUTimeEnabled(){return this._debugGPUTimeQuery!==null}getCanvasContext(){return this.getDefaultCanvasContext()}readPixelsToArrayWebGL(e,t){throw Error(`not implemented`)}readPixelsToBufferWebGL(e,t){throw Error(`not implemented`)}setParametersWebGL(e){throw Error(`not implemented`)}getParametersWebGL(e){throw Error(`not implemented`)}withParametersWebGL(e,t){throw Error(`not implemented`)}clearWebGL(e){throw Error(`not implemented`)}resetWebGL(){throw Error(`not implemented`)}getModuleData(e){return this._moduleData[e]||={},this._moduleData[e]}static _getCanvasContextProps(e){return e.createCanvasContext===!0?{}:e.createCanvasContext}_getDeviceTextureFormatCapabilities(e){let t=kn.getCapabilities(e),n=e=>(typeof e==`string`?this.features.has(e):e)??!0,r=n(t.create);return{format:e,create:r,render:r&&n(t.render),filter:r&&n(t.filter),blend:r&&n(t.blend),store:r&&n(t.store)}}_normalizeBufferProps(e){(e instanceof ArrayBuffer||ArrayBuffer.isView(e))&&(e={data:e});let t={...e};if((e.usage||0)&P.INDEX&&(e.indexType||(e.data instanceof Uint32Array?t.indexType=`uint32`:e.data instanceof Uint16Array?t.indexType=`uint16`:e.data instanceof Uint8Array&&(t.data=new Uint16Array(e.data),t.indexType=`uint16`)),!t.indexType))throw Error(`indices buffer content must be of type uint16 or uint32`);return t}};function Kn(e,t){return e==null?t===void 0?!1:t!==`production`:!!e}function qn(){return Kn(M.get(`debug`),Jn())}function Jn(){let e=globalThis.process;if(e?.env)return e.env.NODE_ENV}var Yn=class{props;_resizeObserver;_intersectionObserver;_observeDevicePixelRatioTimeout=null;_observeDevicePixelRatioMediaQuery=null;_handleDevicePixelRatioChange=()=>this._refreshDevicePixelRatio();_trackPositionInterval=null;_started=!1;get started(){return this._started}constructor(e){this.props=e}start(){if(!(this._started||!this.props.canvas)){this._started=!0,this._intersectionObserver||=new IntersectionObserver(e=>this.props.onIntersection(e)),this._resizeObserver||=new ResizeObserver(e=>this.props.onResize(e)),this._intersectionObserver.observe(this.props.canvas);try{this._resizeObserver.observe(this.props.canvas,{box:`device-pixel-content-box`})}catch{this._resizeObserver.observe(this.props.canvas,{box:`content-box`})}this._observeDevicePixelRatioTimeout=setTimeout(()=>this._refreshDevicePixelRatio(),0),this.props.trackPosition&&this._trackPosition()}}stop(){this._started&&(this._started=!1,this._observeDevicePixelRatioTimeout&&=(clearTimeout(this._observeDevicePixelRatioTimeout),null),this._observeDevicePixelRatioMediaQuery&&=(this._observeDevicePixelRatioMediaQuery.removeEventListener(`change`,this._handleDevicePixelRatioChange),null),this._trackPositionInterval&&=(clearInterval(this._trackPositionInterval),null),this._resizeObserver?.disconnect(),this._intersectionObserver?.disconnect())}_refreshDevicePixelRatio(){this._started&&(this.props.onDevicePixelRatioChange(),this._observeDevicePixelRatioMediaQuery?.removeEventListener(`change`,this._handleDevicePixelRatioChange),this._observeDevicePixelRatioMediaQuery=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`),this._observeDevicePixelRatioMediaQuery.addEventListener(`change`,this._handleDevicePixelRatioChange,{once:!0}))}_trackPosition(e=100){this._trackPositionInterval||=setInterval(()=>{this._started?this.props.onPositionChange():this._trackPositionInterval&&=(clearInterval(this._trackPositionInterval),null)},e)}};function Xn(){let e,t;return{promise:new Promise((n,r)=>{e=n,t=r}),resolve:e,reject:t}}function Zn(e,t){if(!e){let e=Error(t??`luma.gl assertion failed.`);throw Error.captureStackTrace?.(e,Zn),e}}function Qn(e,t){return Zn(e,t),e}var $n=class e{static isHTMLCanvas(e){return typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement}static isOffscreenCanvas(e){return typeof OffscreenCanvas<`u`&&e instanceof OffscreenCanvas}static defaultProps={id:void 0,canvas:null,width:800,height:600,useDevicePixels:!0,autoResize:!0,container:null,visible:!0,alphaMode:`opaque`,colorSpace:`srgb`,trackPosition:!1};id;props;canvas;htmlCanvas;offscreenCanvas;type;initialized;isInitialized=!1;isVisible=!0;cssWidth;cssHeight;devicePixelRatio;devicePixelWidth;devicePixelHeight;drawingBufferWidth;drawingBufferHeight;_initializedResolvers=Xn();_canvasObserver;_position=[0,0];destroyed=!1;_needsDrawingBufferResize=!0;toString(){return`${this[Symbol.toStringTag]}(${this.id})`}constructor(t){this.props={...e.defaultProps,...t},t=this.props,this.initialized=this._initializedResolvers.promise,a()?t.canvas?typeof t.canvas==`string`?this.canvas=tr(t.canvas):this.canvas=t.canvas:this.canvas=nr(t):this.canvas={width:t.width||1,height:t.height||1},e.isHTMLCanvas(this.canvas)?(this.id=t.id||this.canvas.id,this.type=`html-canvas`,this.htmlCanvas=this.canvas):e.isOffscreenCanvas(this.canvas)?(this.id=t.id||`offscreen-canvas`,this.type=`offscreen-canvas`,this.offscreenCanvas=this.canvas):(this.id=t.id||`node-canvas-context`,this.type=`node`),this.cssWidth=this.htmlCanvas?.clientWidth||this.canvas.width,this.cssHeight=this.htmlCanvas?.clientHeight||this.canvas.height,this.devicePixelWidth=this.canvas.width,this.devicePixelHeight=this.canvas.height,this.drawingBufferWidth=this.canvas.width,this.drawingBufferHeight=this.canvas.height,this.devicePixelRatio=globalThis.devicePixelRatio||1,this._position=[0,0],this._canvasObserver=new Yn({canvas:this.htmlCanvas,trackPosition:this.props.trackPosition,onResize:e=>this._handleResize(e),onIntersection:e=>this._handleIntersection(e),onDevicePixelRatioChange:()=>this._observeDevicePixelRatio(),onPositionChange:()=>this.updatePosition()})}destroy(){this.destroyed||(this.destroyed=!0,this._stopObservers(),this.device=null)}setProps(e){return`useDevicePixels`in e&&(this.props.useDevicePixels=e.useDevicePixels||!1,this._updateDrawingBufferSize()),this}getCurrentFramebuffer(e){return this._resizeDrawingBufferIfNeeded(),this._getCurrentFramebuffer(e)}getCSSSize(){return[this.cssWidth,this.cssHeight]}getPosition(){return this._position}getDevicePixelSize(){return[this.devicePixelWidth,this.devicePixelHeight]}getDrawingBufferSize(){return[this.drawingBufferWidth,this.drawingBufferHeight]}getMaxDrawingBufferSize(){let e=this.device.limits.maxTextureDimension2D;return[e,e]}setDrawingBufferSize(e,t){e=Math.floor(e),t=Math.floor(t),!(this.drawingBufferWidth===e&&this.drawingBufferHeight===t)&&(this.drawingBufferWidth=e,this.drawingBufferHeight=t,this._needsDrawingBufferResize=!0)}getDevicePixelRatio(){return typeof window<`u`&&window.devicePixelRatio||1}cssToDevicePixels(e,t=!0){let n=this.cssToDeviceRatio(),[r,i]=this.getDrawingBufferSize();return rr(e,n,r,i,t)}getPixelSize(){return this.getDevicePixelSize()}getAspect(){let[e,t]=this.getDrawingBufferSize();return e>0&&t>0?e/t:1}cssToDeviceRatio(){try{let[e]=this.getDrawingBufferSize(),[t]=this.getCSSSize();return t?e/t:1}catch{return 1}}resize(e){this.setDrawingBufferSize(e.width,e.height)}_setAutoCreatedCanvasId(e){this.htmlCanvas?.id===`lumagl-auto-created-canvas`&&(this.htmlCanvas.id=e)}_startObservers(){this.destroyed||this._canvasObserver.start()}_stopObservers(){this._canvasObserver.stop()}_handleIntersection(e){if(this.destroyed)return;let t=e.find(e=>e.target===this.canvas);if(!t)return;let n=t.isIntersecting;this.isVisible!==n&&(this.isVisible=n,this.device.props.onVisibilityChange(this))}_handleResize(e){if(this.destroyed)return;let t=e.find(e=>e.target===this.canvas);if(!t)return;let n=Qn(t.contentBoxSize?.[0]);this.cssWidth=n.inlineSize,this.cssHeight=n.blockSize;let r=this.getDevicePixelSize(),i=t.devicePixelContentBoxSize?.[0]?.inlineSize||n.inlineSize*devicePixelRatio,a=t.devicePixelContentBoxSize?.[0]?.blockSize||n.blockSize*devicePixelRatio,[o,s]=this.getMaxDrawingBufferSize();this.devicePixelWidth=Math.max(1,Math.min(i,o)),this.devicePixelHeight=Math.max(1,Math.min(a,s)),this._updateDrawingBufferSize(),this.device.props.onResize(this,{oldPixelSize:r})}_updateDrawingBufferSize(){if(this.props.autoResize)if(typeof this.props.useDevicePixels==`number`){let e=this.props.useDevicePixels;this.setDrawingBufferSize(this.cssWidth*e,this.cssHeight*e)}else this.props.useDevicePixels?this.setDrawingBufferSize(this.devicePixelWidth,this.devicePixelHeight):this.setDrawingBufferSize(this.cssWidth,this.cssHeight);this._initializedResolvers.resolve(),this.isInitialized=!0,this.updatePosition()}_resizeDrawingBufferIfNeeded(){this._needsDrawingBufferResize&&(this._needsDrawingBufferResize=!1,(this.drawingBufferWidth!==this.canvas.width||this.drawingBufferHeight!==this.canvas.height)&&(this.canvas.width=this.drawingBufferWidth,this.canvas.height=this.drawingBufferHeight,this._configureDevice()))}_observeDevicePixelRatio(){if(this.destroyed||!this._canvasObserver.started)return;let e=this.devicePixelRatio;this.devicePixelRatio=window.devicePixelRatio,this.updatePosition(),this.device.props.onDevicePixelRatioChange?.(this,{oldRatio:e})}updatePosition(){if(this.destroyed)return;let e=this.htmlCanvas?.getBoundingClientRect();if(e){let t=[e.left,e.top];if(this._position??=t,t[0]!==this._position[0]||t[1]!==this._position[1]){let e=this._position;this._position=t,this.device.props.onPositionChange?.(this,{oldPosition:e})}}}};function er(e){if(typeof e==`string`){let t=document.getElementById(e);if(!t)throw Error(`${e} is not an HTML element`);return t}return e||document.body}function tr(e){let t=document.getElementById(e);if(!$n.isHTMLCanvas(t))throw Error(`Object is not a canvas element`);return t}function nr(e){let{width:t,height:n}=e,r=document.createElement(`canvas`);r.id=Lt(`lumagl-auto-created-canvas`),r.width=t||1,r.height=n||1,r.style.width=Number.isFinite(t)?`${t}px`:`100%`,r.style.height=Number.isFinite(n)?`${n}px`:`100%`,e?.visible||(r.style.visibility=`hidden`);let i=er(e?.container||null);return i.insertBefore(r,i.firstChild),r}function rr(e,t,n,r,i){let a=e,o=ir(a[0],t,n),s=ar(a[1],t,r,i),c=ir(a[0]+1,t,n),l=c===n-1?c:c-1;c=ar(a[1]+1,t,r,i);let u;return i?(c=c===0?c:c+1,u=s,s=c):u=c===r-1?c:c-1,{x:o,y:s,width:Math.max(l-o+1,1),height:Math.max(u-s+1,1)}}function ir(e,t,n){return Math.min(Math.round(e*t),n-1)}function ar(e,t,n,r){return r?Math.max(0,n-1-Math.round(e*t)):Math.min(Math.round(e*t),n-1)}var or=class extends $n{static defaultProps=$n.defaultProps},sr=class extends $n{},cr=class e extends N{static defaultProps={...N.defaultProps,type:`color-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`nearest`,minFilter:`nearest`,mipmapFilter:`none`,lodMinClamp:0,lodMaxClamp:32,compare:`less-equal`,maxAnisotropy:1};get[Symbol.toStringTag](){return`Sampler`}constructor(t,n){n=e.normalizeProps(t,n),super(t,n,e.defaultProps)}static normalizeProps(e,t){return t}},lr={"1d":`1d`,"2d":`2d`,"2d-array":`2d`,cube:`2d`,"cube-array":`2d`,"3d":`3d`},I=class e extends N{static SAMPLE=4;static STORAGE=8;static RENDER=16;static COPY_SRC=1;static COPY_DST=2;static TEXTURE=4;static RENDER_ATTACHMENT=16;dimension;baseDimension;format;width;height;depth;mipLevels;samples;byteAlignment;ready=Promise.resolve(this);isReady=!0;updateTimestamp;get[Symbol.toStringTag](){return`Texture`}toString(){return`Texture(${this.id},${this.format},${this.width}x${this.height})`}constructor(t,n,r){if(n=e.normalizeProps(t,n),super(t,n,e.defaultProps),this.dimension=this.props.dimension,this.baseDimension=lr[this.dimension],this.format=this.props.format,this.width=this.props.width,this.height=this.props.height,this.depth=this.props.depth,this.mipLevels=this.props.mipLevels,this.samples=this.props.samples||1,this.dimension===`cube`&&(this.depth=6),this.props.width===void 0||this.props.height===void 0)if(t.isExternalImage(n.data)){let e=t.getExternalImageSize(n.data);this.width=e?.width||1,this.height=e?.height||1}else this.width=1,this.height=1,(this.props.width===void 0||this.props.height===void 0)&&M.warn(`${this} created with undefined width or height. This is deprecated. Use DynamicTexture instead.`)();this.byteAlignment=r?.byteAlignment||1,this.updateTimestamp=t.incrementTimestamp()}clone(e){return this.device.createTexture({...this.props,...e})}setSampler(e){this.sampler=e instanceof cr?e:this.device.createSampler(e)}copyImageData(e){let{data:t,depth:n,...r}=e;this.writeData(t,{...r,depthOrArrayLayers:r.depthOrArrayLayers??n})}computeMemoryLayout(e={}){let{width:t=this.width,height:n=this.height,depthOrArrayLayers:r=this.depth}=this._normalizeTextureReadOptions(e),{format:i,byteAlignment:a}=this;return kn.computeMemoryLayout({format:i,width:t,height:n,depth:r,byteAlignment:a})}readBuffer(e,t){throw Error(`readBuffer not implemented`)}readDataAsync(e){throw Error(`readBuffer not implemented`)}writeBuffer(e,t){throw Error(`readBuffer not implemented`)}writeData(e,t){throw Error(`readBuffer not implemented`)}readDataSyncWebGL(e){throw Error(`readDataSyncWebGL not available`)}generateMipmapsWebGL(){throw Error(`generateMipmapsWebGL not available`)}static normalizeProps(e,t){let n={...t},{width:r,height:i}=n;return typeof r==`number`&&(n.width=Math.max(1,Math.ceil(r))),typeof i==`number`&&(n.height=Math.max(1,Math.ceil(i))),n}_initializeData(e){this.device.isExternalImage(e)?this.copyExternalImage({image:e,width:this.width,height:this.height,depth:this.depth,mipLevel:0,x:0,y:0,z:0,aspect:`all`,colorSpace:`srgb`,premultipliedAlpha:!1,flipY:!1}):e&&this.copyImageData({data:e,mipLevel:0,x:0,y:0,z:0,aspect:`all`})}_normalizeCopyImageDataOptions(e){let{data:t,depth:n,...r}=e,i=this._normalizeTextureWriteOptions({...r,depthOrArrayLayers:r.depthOrArrayLayers??n});return{data:t,depth:i.depthOrArrayLayers,...i}}_normalizeCopyExternalImageOptions(t){let n=e._omitUndefined(t),r=n.mipLevel??0,i=this._getMipLevelSize(r),a=this.device.getExternalImageSize(t.image),o={...e.defaultCopyExternalImageOptions,...i,...a,...n};return o.width=Math.min(o.width,i.width-o.x),o.height=Math.min(o.height,i.height-o.y),o.depth=Math.min(o.depth,i.depthOrArrayLayers-o.z),o}_normalizeTextureReadOptions(t){let n=e._omitUndefined(t),r=n.mipLevel??0,i=this._getMipLevelSize(r),a={...e.defaultTextureReadOptions,...i,...n};return a.width=Math.min(a.width,i.width-a.x),a.height=Math.min(a.height,i.height-a.y),a.depthOrArrayLayers=Math.min(a.depthOrArrayLayers,i.depthOrArrayLayers-a.z),a}_getSupportedColorReadOptions(e){let t=this._normalizeTextureReadOptions(e),n=kn.getInfo(this.format);switch(this._validateColorReadAspect(t),this._validateColorReadFormat(n),this.dimension){case`2d`:case`cube`:case`cube-array`:case`2d-array`:case`3d`:return t;default:throw Error(`${this} color readback does not support ${this.dimension} textures`)}}_validateColorReadAspect(e){if(e.aspect!==`all`)throw Error(`${this} color readback only supports aspect 'all'`)}_validateColorReadFormat(e){if(e.compressed)throw Error(`${this} color readback does not support compressed formats (${this.format})`);switch(e.attachment){case`color`:return;case`depth`:throw Error(`${this} color readback does not support depth formats (${this.format})`);case`stencil`:throw Error(`${this} color readback does not support stencil formats (${this.format})`);case`depth-stencil`:throw Error(`${this} color readback does not support depth-stencil formats (${this.format})`);default:throw Error(`${this} color readback does not support format ${this.format}`)}}_normalizeTextureWriteOptions(t){let n=e._omitUndefined(t),r=n.mipLevel??0,i=this._getMipLevelSize(r),a={...e.defaultTextureWriteOptions,...i,...n};a.width=Math.min(a.width,i.width-a.x),a.height=Math.min(a.height,i.height-a.y),a.depthOrArrayLayers=Math.min(a.depthOrArrayLayers,i.depthOrArrayLayers-a.z);let o=kn.computeMemoryLayout({format:this.format,width:a.width,height:a.height,depth:a.depthOrArrayLayers,byteAlignment:this.byteAlignment}),s=o.bytesPerPixel*a.width;if(a.bytesPerRow=n.bytesPerRow??o.bytesPerRow,a.rowsPerImage=n.rowsPerImage??a.height,a.bytesPerRow<s)throw Error(`bytesPerRow (${a.bytesPerRow}) must be at least ${s} for ${this.format}`);if(a.rowsPerImage<a.height)throw Error(`rowsPerImage (${a.rowsPerImage}) must be at least ${a.height} for ${this.format}`);let c=this.device.getTextureFormatInfo(this.format).bytesPerPixel;if(c&&a.bytesPerRow%c!==0)throw Error(`bytesPerRow (${a.bytesPerRow}) must be a multiple of bytesPerPixel (${c}) for ${this.format}`);return a}_getMipLevelSize(e){return{width:Math.max(1,this.width>>e),height:this.baseDimension===`1d`?1:Math.max(1,this.height>>e),depthOrArrayLayers:this.dimension===`3d`?Math.max(1,this.depth>>e):this.depth}}getAllocatedByteLength(){let e=0;for(let t=0;t<this.mipLevels;t++){let{width:n,height:r,depthOrArrayLayers:i}=this._getMipLevelSize(t);e+=kn.computeMemoryLayout({format:this.format,width:n,height:r,depth:i,byteAlignment:1}).byteLength}return e*this.samples}static _omitUndefined(e){return Object.fromEntries(Object.entries(e).filter(([,e])=>e!==void 0))}static defaultProps={...N.defaultProps,data:null,dimension:`2d`,format:`rgba8unorm`,usage:e.SAMPLE|e.RENDER|e.COPY_DST,width:void 0,height:void 0,depth:1,mipLevels:1,samples:void 0,sampler:{},view:void 0};static defaultCopyDataOptions={data:void 0,byteOffset:0,bytesPerRow:void 0,rowsPerImage:void 0,width:void 0,height:void 0,depthOrArrayLayers:void 0,depth:1,mipLevel:0,x:0,y:0,z:0,aspect:`all`};static defaultCopyExternalImageOptions={image:void 0,sourceX:0,sourceY:0,width:void 0,height:void 0,depth:1,mipLevel:0,x:0,y:0,z:0,aspect:`all`,colorSpace:`srgb`,premultipliedAlpha:!1,flipY:!1};static defaultTextureReadOptions={x:0,y:0,z:0,width:void 0,height:void 0,depthOrArrayLayers:1,mipLevel:0,aspect:`all`};static defaultTextureWriteOptions={byteOffset:0,bytesPerRow:void 0,rowsPerImage:void 0,x:0,y:0,z:0,width:void 0,height:void 0,depthOrArrayLayers:1,mipLevel:0,aspect:`all`}},ur=class e extends N{get[Symbol.toStringTag](){return`TextureView`}constructor(t,n){super(t,n,e.defaultProps)}static defaultProps={...N.defaultProps,format:void 0,dimension:void 0,aspect:`all`,baseMipLevel:0,mipLevelCount:void 0,baseArrayLayer:0,arrayLayerCount:void 0}};function dr(e,t,n){let r=``,i=t.split(/\r?\n/),a=e.slice().sort((e,t)=>e.lineNum-t.lineNum);switch(n?.showSourceCode||`no`){case`all`:let t=0;for(let e=1;e<=i.length;e++){let o=i[e-1],s=a[t];for(o&&s&&(r+=mr(o,e,n));a.length>t&&s.lineNum===e;){let e=a[t++];e&&(r+=fr(e,i,e.lineNum,{...n,inlineSource:!1}))}}for(;a.length>t;){let e=a[t++];e&&(r+=fr(e,[],0,{...n,inlineSource:!1}))}return r;case`issues`:case`no`:for(let t of e)r+=fr(t,i,t.lineNum,{inlineSource:n?.showSourceCode!==`no`});return r}}function fr(e,t,n,r){if(r?.inlineSource)return`
${pr(t,n)}${e.linePos>0?`${` `.repeat(e.linePos+5)}^^^\n`:``}${e.type.toUpperCase()}: ${e.message}

`;let i=e.type===`error`?`red`:`orange`;return r?.html?`<div class='luma-compiler-log-${e.type}' style="color:${i};"><b> ${e.type.toUpperCase()}: ${e.message}</b></div>`:`${e.type.toUpperCase()}: ${e.message}`}function pr(e,t,n){let r=``;for(let i=t-2;i<=t;i++){let a=e[i-1];a!==void 0&&(r+=mr(a,t,n))}return r}function mr(e,t,n){let r=n?.html?gr(e):e;return`${hr(String(t),4)}: ${r}${n?.html?`<br/>`:`
`}`}function hr(e,t){let n=``;for(let r=e.length;r<t;++r)n+=` `;return n+e}function gr(e){return e.replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`).replaceAll(`'`,`&#039;`)}var _r=class e extends N{get[Symbol.toStringTag](){return`Shader`}stage;source;compilationStatus=`pending`;constructor(t,n){n={...n,debugShaders:n.debugShaders||t.props.debugShaders||`errors`},super(t,{id:vr(n),...n},e.defaultProps),this.stage=this.props.stage,this.source=this.props.source}getCompilationInfoSync(){return null}getTranslatedSource(){return null}async debugShader(){let e=this.props.debugShaders;switch(e){case`never`:return;case`errors`:if(this.compilationStatus===`success`)return;break;case`warnings`:case`always`:break}let t=await this.getCompilationInfo();e===`warnings`&&t?.length===0||this._displayShaderLog(t,this.id)}_displayShaderLog(e,t){if(typeof document>`u`||!document?.createElement)return;let n=t,r=`${this.stage} shader "${n}"`,i=dr(e,this.source,{showSourceCode:`all`,html:!0}),a=this.getTranslatedSource(),o=document.createElement(`div`);o.innerHTML=`\
<h1>Compilation error in ${r}</h1>
<div style="display:flex;position:fixed;top:10px;right:20px;gap:2px;">
<button id="copy">Copy source</button><br/>
<button id="close">Close</button>
</div>
<code><pre>${i}</pre></code>`,a&&(o.innerHTML+=`<br /><h1>Translated Source</h1><br /><br /><code><pre>${a}</pre></code>`),o.style.top=`0`,o.style.left=`0`,o.style.background=`white`,o.style.position=`fixed`,o.style.zIndex=`9999`,o.style.maxWidth=`100vw`,o.style.maxHeight=`100vh`,o.style.overflowY=`auto`,document.body.appendChild(o),o.querySelector(`.luma-compiler-log-error`)?.scrollIntoView(),o.querySelector(`button#close`).onclick=()=>{o.remove()},o.querySelector(`button#copy`).onclick=()=>{navigator.clipboard.writeText(this.source)}}static defaultProps={...N.defaultProps,language:`auto`,stage:void 0,source:``,sourceMap:null,entryPoint:`main`,debugShaders:void 0}};function vr(e){return yr(e.source)||e.id||Lt(`unnamed ${e.stage}-shader`)}function yr(e,t=`unnamed`){return/#define[\s*]SHADER_NAME[\s*]([A-Za-z0-9_-]+)[\s*]/.exec(e)?.[1]??t}var br=class e extends N{get[Symbol.toStringTag](){return`Framebuffer`}width;height;constructor(t,n={}){super(t,n,e.defaultProps),this.width=this.props.width,this.height=this.props.height}clone(e){let t=this.colorAttachments.map(t=>t.texture.clone(e)),n=this.depthStencilAttachment&&this.depthStencilAttachment.texture.clone(e);return this.device.createFramebuffer({...this.props,...e,colorAttachments:t,depthStencilAttachment:n})}resize(e){let t=!e;if(e){let[n,r]=Array.isArray(e)?e:[e.width,e.height];t=t||r!==this.height||n!==this.width,this.width=n,this.height=r}t&&(M.log(2,`Resizing framebuffer ${this.id} to ${this.width}x${this.height}`)(),this.resizeAttachments(this.width,this.height))}autoCreateAttachmentTextures(){if(this.props.colorAttachments.length===0&&!this.props.depthStencilAttachment)throw Error(`Framebuffer has noattachments`);this.colorAttachments=this.props.colorAttachments.map((e,t)=>{if(typeof e==`string`){let n=this.createColorTexture(e,t);return this.attachResource(n),n.view}return e instanceof I?e.view:e});let e=this.props.depthStencilAttachment;if(e)if(typeof e==`string`){let t=this.createDepthStencilTexture(e);this.attachResource(t),this.depthStencilAttachment=t.view}else e instanceof I?this.depthStencilAttachment=e.view:this.depthStencilAttachment=e}createColorTexture(e,t){return this.device.createTexture({id:`${this.id}-color-attachment-${t}`,usage:I.RENDER_ATTACHMENT,format:e,width:this.width,height:this.height,sampler:{magFilter:`linear`,minFilter:`linear`}})}createDepthStencilTexture(e){return this.device.createTexture({id:`${this.id}-depth-stencil-attachment`,usage:I.RENDER_ATTACHMENT,format:e,width:this.width,height:this.height})}resizeAttachments(e,t){if(this.colorAttachments.forEach((n,r)=>{let i=n.texture.clone({width:e,height:t});this.destroyAttachedResource(n),this.colorAttachments[r]=i.view,this.attachResource(i.view)}),this.depthStencilAttachment){let n=this.depthStencilAttachment.texture.clone({width:e,height:t});this.destroyAttachedResource(this.depthStencilAttachment),this.depthStencilAttachment=n.view,this.attachResource(n)}this.updateAttachments()}static defaultProps={...N.defaultProps,width:1,height:1,colorAttachments:[],depthStencilAttachment:null}},xr=class e extends N{get[Symbol.toStringTag](){return`RenderPipeline`}shaderLayout;bufferLayout;linkStatus=`pending`;hash=``;sharedRenderPipeline=null;get isPending(){return this.linkStatus===`pending`||this.vs.compilationStatus===`pending`||this.fs?.compilationStatus===`pending`}get isErrored(){return this.linkStatus===`error`||this.vs.compilationStatus===`error`||this.fs?.compilationStatus===`error`}constructor(t,n){super(t,n,e.defaultProps),this.shaderLayout=this.props.shaderLayout,this.bufferLayout=this.props.bufferLayout||[],this.sharedRenderPipeline=this.props._sharedRenderPipeline||null}static defaultProps={...N.defaultProps,vs:null,vertexEntryPoint:`vertexMain`,vsConstants:{},fs:null,fragmentEntryPoint:`fragmentMain`,fsConstants:{},shaderLayout:null,bufferLayout:[],topology:`triangle-list`,colorAttachmentFormats:void 0,depthStencilAttachmentFormat:void 0,parameters:{},varyings:void 0,bufferMode:void 0,disableWarnings:!1,_sharedRenderPipeline:void 0,bindings:void 0,bindGroups:void 0}},Sr=class extends N{get[Symbol.toStringTag](){return`SharedRenderPipeline`}constructor(e,t){super(e,t,{...N.defaultProps,handle:void 0,vs:void 0,fs:void 0,varyings:void 0,bufferMode:void 0})}},Cr=class e extends N{get[Symbol.toStringTag](){return`ComputePipeline`}hash=``;shaderLayout;constructor(t,n){super(t,n,e.defaultProps),this.shaderLayout=n.shaderLayout}static defaultProps={...N.defaultProps,shader:void 0,entryPoint:void 0,constants:{},shaderLayout:void 0}},wr=class e{static defaultProps={...xr.defaultProps};static getDefaultPipelineFactory(t){let n=t.getModuleData(`@luma.gl/core`);return n.defaultPipelineFactory||=new e(t),n.defaultPipelineFactory}device;_hashCounter=0;_hashes={};_renderPipelineCache={};_computePipelineCache={};_sharedRenderPipelineCache={};get[Symbol.toStringTag](){return`PipelineFactory`}toString(){return`PipelineFactory(${this.device.id})`}constructor(e){this.device=e}createRenderPipeline(e){if(!this.device.props._cachePipelines)return this.device.createRenderPipeline(e);let t={...xr.defaultProps,...e},n=this._renderPipelineCache,r=this._hashRenderPipeline(t),i=n[r]?.resource;if(i)n[r].useCount++,this.device.props.debugFactories&&M.log(3,`${this}: ${n[r].resource} reused, count=${n[r].useCount}, (id=${e.id})`)();else{let e=this.device.type===`webgl`&&this.device.props._sharePipelines?this.createSharedRenderPipeline(t):void 0;i=this.device.createRenderPipeline({...t,id:t.id?`${t.id}-cached`:Lt(`unnamed-cached`),_sharedRenderPipeline:e}),i.hash=r,n[r]={resource:i,useCount:1},this.device.props.debugFactories&&M.log(3,`${this}: ${i} created, count=${n[r].useCount}`)()}return i}createComputePipeline(e){if(!this.device.props._cachePipelines)return this.device.createComputePipeline(e);let t={...Cr.defaultProps,...e},n=this._computePipelineCache,r=this._hashComputePipeline(t),i=n[r]?.resource;return i?(n[r].useCount++,this.device.props.debugFactories&&M.log(3,`${this}: ${n[r].resource} reused, count=${n[r].useCount}, (id=${e.id})`)()):(i=this.device.createComputePipeline({...t,id:t.id?`${t.id}-cached`:void 0}),i.hash=r,n[r]={resource:i,useCount:1},this.device.props.debugFactories&&M.log(3,`${this}: ${i} created, count=${n[r].useCount}`)()),i}release(e){if(!this.device.props._cachePipelines){e.destroy();return}let t=this._getCache(e),n=e.hash;t[n].useCount--,t[n].useCount===0?(this._destroyPipeline(e),this.device.props.debugFactories&&M.log(3,`${this}: ${e} released and destroyed`)()):t[n].useCount<0?(M.error(`${this}: ${e} released, useCount < 0, resetting`)(),t[n].useCount=0):this.device.props.debugFactories&&M.log(3,`${this}: ${e} released, count=${t[n].useCount}`)()}createSharedRenderPipeline(e){let t=this._hashSharedRenderPipeline(e),n=this._sharedRenderPipelineCache[t];return n||(n={resource:this.device._createSharedRenderPipelineWebGL(e),useCount:0},this._sharedRenderPipelineCache[t]=n),n.useCount++,n.resource}releaseSharedRenderPipeline(e){if(!e.sharedRenderPipeline)return;let t=this._hashSharedRenderPipeline(e.sharedRenderPipeline.props),n=this._sharedRenderPipelineCache[t];n&&(n.useCount--,n.useCount===0&&(n.resource.destroy(),delete this._sharedRenderPipelineCache[t]))}_destroyPipeline(e){let t=this._getCache(e);return this.device.props._destroyPipelines?(delete t[e.hash],e.destroy(),e instanceof xr&&this.releaseSharedRenderPipeline(e),!0):!1}_getCache(e){let t;if(e instanceof Cr&&(t=this._computePipelineCache),e instanceof xr&&(t=this._renderPipelineCache),!t)throw Error(`${this}`);if(!t[e.hash])throw Error(`${this}: ${e} matched incorrect entry`);return t}_hashComputePipeline(e){let{type:t}=this.device;return`${t}/C/${this._getHash(e.shader.source)}SL${this._getHash(JSON.stringify(e.shaderLayout))}`}_hashRenderPipeline(e){let t=e.vs?this._getHash(e.vs.source):0,n=e.fs?this._getHash(e.fs.source):0,r=this._getWebGLVaryingHash(e),i=this._getHash(JSON.stringify(e.shaderLayout)),a=this._getHash(JSON.stringify(e.bufferLayout)),{type:o}=this.device;switch(o){case`webgl`:let s=this._getHash(JSON.stringify(e.parameters));return`${o}/R/${t}/${n}V${r}T${e.topology}P${s}SL${i}BL${a}`;default:let c=this._getHash(JSON.stringify({vertexEntryPoint:e.vertexEntryPoint,fragmentEntryPoint:e.fragmentEntryPoint})),l=this._getHash(JSON.stringify(e.parameters)),u=this._getWebGPUAttachmentHash(e);return`${o}/R/${t}/${n}V${r}T${e.topology}EP${c}P${l}SL${i}BL${a}A${u}`}}_hashSharedRenderPipeline(e){return`webgl/S/${e.vs?this._getHash(e.vs.source):0}/${e.fs?this._getHash(e.fs.source):0}V${this._getWebGLVaryingHash(e)}`}_getHash(e){return this._hashes[e]===void 0&&(this._hashes[e]=this._hashCounter++),this._hashes[e]}_getWebGLVaryingHash(e){let{varyings:t=[],bufferMode:n=null}=e;return this._getHash(JSON.stringify({varyings:t,bufferMode:n}))}_getWebGPUAttachmentHash(e){let t=e.colorAttachmentFormats??[this.device.preferredColorFormat],n=e.parameters?.depthWriteEnabled?e.depthStencilAttachmentFormat||this.device.preferredDepthFormat:null;return this._getHash(JSON.stringify({colorAttachmentFormats:t,depthStencilAttachmentFormat:n}))}},Tr=class e{static defaultProps={..._r.defaultProps};static getDefaultShaderFactory(t){let n=t.getModuleData(`@luma.gl/core`);return n.defaultShaderFactory||=new e(t),n.defaultShaderFactory}device;_cache={};get[Symbol.toStringTag](){return`ShaderFactory`}toString(){return`${this[Symbol.toStringTag]}(${this.device.id})`}constructor(e){this.device=e}createShader(e){if(!this.device.props._cacheShaders)return this.device.createShader(e);let t=this._hashShader(e),n=this._cache[t];if(n)n.useCount++,this.device.props.debugFactories&&M.log(3,`${this}: Reusing shader ${n.resource.id} count=${n.useCount}`)();else{let r=this.device.createShader({...e,id:e.id?`${e.id}-cached`:void 0});this._cache[t]=n={resource:r,useCount:1},this.device.props.debugFactories&&M.log(3,`${this}: Created new shader ${r.id}`)()}return n.resource}release(e){if(!this.device.props._cacheShaders){e.destroy();return}let t=this._hashShader(e),n=this._cache[t];if(n)if(n.useCount--,n.useCount===0)this.device.props._destroyShaders&&(delete this._cache[t],n.resource.destroy(),this.device.props.debugFactories&&M.log(3,`${this}: Releasing shader ${e.id}, destroyed`)());else if(n.useCount<0)throw Error(`ShaderFactory: Shader ${e.id} released too many times`);else this.device.props.debugFactories&&M.log(3,`${this}: Releasing shader ${e.id} count=${n.useCount}`)()}_hashShader(e){return`${e.stage}:${e.source}`}},Er=class e extends N{static defaultClearColor=[0,0,0,1];static defaultClearDepth=1;static defaultClearStencil=0;get[Symbol.toStringTag](){return`RenderPass`}constructor(t,n){n=e.normalizeProps(t,n),super(t,n,e.defaultProps)}static normalizeProps(e,t){return t}static defaultProps={...N.defaultProps,framebuffer:null,parameters:void 0,clearColor:e.defaultClearColor,clearColors:void 0,clearDepth:e.defaultClearDepth,clearStencil:e.defaultClearStencil,depthReadOnly:!1,stencilReadOnly:!1,discard:!1,occlusionQuerySet:void 0,timestampQuerySet:void 0,beginTimestampIndex:void 0,endTimestampIndex:void 0}},Dr=class e extends N{get[Symbol.toStringTag](){return`CommandEncoder`}_timeProfilingQuerySet=null;_timeProfilingSlotCount=0;_gpuTimeMs;constructor(t,n){super(t,n,e.defaultProps),this._timeProfilingQuerySet=n.timeProfilingQuerySet??null,this._timeProfilingSlotCount=0,this._gpuTimeMs=void 0}async resolveTimeProfilingQuerySet(){if(this._gpuTimeMs=void 0,!this._timeProfilingQuerySet)return;let e=Math.floor(this._timeProfilingSlotCount/2);if(e<=0)return;let t=e*2,n=await this._timeProfilingQuerySet.readResults({firstQuery:0,queryCount:t}),r=0n;for(let e=0;e<t;e+=2)r+=n[e+1]-n[e];this._gpuTimeMs=Number(r)/1e6}getTimeProfilingSlotCount(){return this._timeProfilingSlotCount}getTimeProfilingQuerySet(){return this._timeProfilingQuerySet}_applyTimeProfilingToPassProps(e){let t=e||{};if(!this._supportsTimestampQueries()||!this._timeProfilingQuerySet||t.timestampQuerySet!==void 0||t.beginTimestampIndex!==void 0||t.endTimestampIndex!==void 0)return t;let n=this._timeProfilingSlotCount;return n+1>=this._timeProfilingQuerySet.props.count?t:(this._timeProfilingSlotCount+=2,{...t,timestampQuerySet:this._timeProfilingQuerySet,beginTimestampIndex:n,endTimestampIndex:n+1})}_supportsTimestampQueries(){return this.device.features.has(`timestamp-query`)}static defaultProps={...N.defaultProps,measureExecutionTime:void 0,timeProfilingQuerySet:void 0}},Or=class e extends N{get[Symbol.toStringTag](){return`CommandBuffer`}constructor(t,n){super(t,n,e.defaultProps)}static defaultProps={...N.defaultProps}};function kr(e){let t=Rr[Pr(e)];if(!t)throw Error(`Unsupported variable shader type: ${e}`);return t}function Ar(e){let t=Lr[Nr(e)];if(!t)throw Error(`Unsupported attribute shader type: ${e}`);let[n,r]=t,i=n===`i32`||n===`u32`,a=n!==`u32`;return{primitiveType:n,components:r,byteLength:Ir[n]*r,integer:i,signed:a}}var jr=class{getVariableShaderTypeInfo(e){return kr(e)}getAttributeShaderTypeInfo(e){return Ar(e)}makeShaderAttributeType(e,t){return Mr(e,t)}resolveAttributeShaderTypeAlias(e){return Nr(e)}resolveVariableShaderTypeAlias(e){return Pr(e)}};function Mr(e,t){return t===1?e:`vec${t}<${e}>`}function Nr(e){return zr[e]||e}function Pr(e){return Br[e]||e}var Fr=new jr,Ir={f32:4,f16:2,i32:4,u32:4},Lr={f32:[`f32`,1],"vec2<f32>":[`f32`,2],"vec3<f32>":[`f32`,3],"vec4<f32>":[`f32`,4],f16:[`f16`,1],"vec2<f16>":[`f16`,2],"vec3<f16>":[`f16`,3],"vec4<f16>":[`f16`,4],i32:[`i32`,1],"vec2<i32>":[`i32`,2],"vec3<i32>":[`i32`,3],"vec4<i32>":[`i32`,4],u32:[`u32`,1],"vec2<u32>":[`u32`,2],"vec3<u32>":[`u32`,3],"vec4<u32>":[`u32`,4]},Rr={f32:{type:`f32`,components:1},f16:{type:`f16`,components:1},i32:{type:`i32`,components:1},u32:{type:`u32`,components:1},"vec2<f32>":{type:`f32`,components:2},"vec3<f32>":{type:`f32`,components:3},"vec4<f32>":{type:`f32`,components:4},"vec2<f16>":{type:`f16`,components:2},"vec3<f16>":{type:`f16`,components:3},"vec4<f16>":{type:`f16`,components:4},"vec2<i32>":{type:`i32`,components:2},"vec3<i32>":{type:`i32`,components:3},"vec4<i32>":{type:`i32`,components:4},"vec2<u32>":{type:`u32`,components:2},"vec3<u32>":{type:`u32`,components:3},"vec4<u32>":{type:`u32`,components:4},"mat2x2<f32>":{type:`f32`,components:4},"mat2x3<f32>":{type:`f32`,components:6},"mat2x4<f32>":{type:`f32`,components:8},"mat3x2<f32>":{type:`f32`,components:6},"mat3x3<f32>":{type:`f32`,components:9},"mat3x4<f32>":{type:`f32`,components:12},"mat4x2<f32>":{type:`f32`,components:8},"mat4x3<f32>":{type:`f32`,components:12},"mat4x4<f32>":{type:`f32`,components:16},"mat2x2<f16>":{type:`f16`,components:4},"mat2x3<f16>":{type:`f16`,components:6},"mat2x4<f16>":{type:`f16`,components:8},"mat3x2<f16>":{type:`f16`,components:6},"mat3x3<f16>":{type:`f16`,components:9},"mat3x4<f16>":{type:`f16`,components:12},"mat4x2<f16>":{type:`f16`,components:8},"mat4x3<f16>":{type:`f16`,components:12},"mat4x4<f16>":{type:`f16`,components:16},"mat2x2<i32>":{type:`i32`,components:4},"mat2x3<i32>":{type:`i32`,components:6},"mat2x4<i32>":{type:`i32`,components:8},"mat3x2<i32>":{type:`i32`,components:6},"mat3x3<i32>":{type:`i32`,components:9},"mat3x4<i32>":{type:`i32`,components:12},"mat4x2<i32>":{type:`i32`,components:8},"mat4x3<i32>":{type:`i32`,components:12},"mat4x4<i32>":{type:`i32`,components:16},"mat2x2<u32>":{type:`u32`,components:4},"mat2x3<u32>":{type:`u32`,components:6},"mat2x4<u32>":{type:`u32`,components:8},"mat3x2<u32>":{type:`u32`,components:6},"mat3x3<u32>":{type:`u32`,components:9},"mat3x4<u32>":{type:`u32`,components:12},"mat4x2<u32>":{type:`u32`,components:8},"mat4x3<u32>":{type:`u32`,components:12},"mat4x4<u32>":{type:`u32`,components:16}},zr={vec2i:`vec2<i32>`,vec3i:`vec3<i32>`,vec4i:`vec4<i32>`,vec2u:`vec2<u32>`,vec3u:`vec3<u32>`,vec4u:`vec4<u32>`,vec2f:`vec2<f32>`,vec3f:`vec3<f32>`,vec4f:`vec4<f32>`,vec2h:`vec2<f16>`,vec3h:`vec3<f16>`,vec4h:`vec4<f16>`},Br={vec2i:`vec2<i32>`,vec3i:`vec3<i32>`,vec4i:`vec4<i32>`,vec2u:`vec2<u32>`,vec3u:`vec3<u32>`,vec4u:`vec4<u32>`,vec2f:`vec2<f32>`,vec3f:`vec3<f32>`,vec4f:`vec4<f32>`,vec2h:`vec2<f16>`,vec3h:`vec3<f16>`,vec4h:`vec4<f16>`,mat2x2f:`mat2x2<f32>`,mat2x3f:`mat2x3<f32>`,mat2x4f:`mat2x4<f32>`,mat3x2f:`mat3x2<f32>`,mat3x3f:`mat3x3<f32>`,mat3x4f:`mat3x4<f32>`,mat4x2f:`mat4x2<f32>`,mat4x3f:`mat4x3<f32>`,mat4x4f:`mat4x4<f32>`,mat2x2i:`mat2x2<i32>`,mat2x3i:`mat2x3<i32>`,mat2x4i:`mat2x4<i32>`,mat3x2i:`mat3x2<i32>`,mat3x3i:`mat3x3<i32>`,mat3x4i:`mat3x4<i32>`,mat4x2i:`mat4x2<i32>`,mat4x3i:`mat4x3<i32>`,mat4x4i:`mat4x4<i32>`,mat2x2u:`mat2x2<u32>`,mat2x3u:`mat2x3<u32>`,mat2x4u:`mat2x4<u32>`,mat3x2u:`mat3x2<u32>`,mat3x3u:`mat3x3<u32>`,mat3x4u:`mat3x4<u32>`,mat4x2u:`mat4x2<u32>`,mat4x3u:`mat4x3<u32>`,mat4x4u:`mat4x4<u32>`,mat2x2h:`mat2x2<f16>`,mat2x3h:`mat2x3<f16>`,mat2x4h:`mat2x4<f16>`,mat3x2h:`mat3x2<f16>`,mat3x3h:`mat3x3<f16>`,mat3x4h:`mat3x4<f16>`,mat4x2h:`mat4x2<f16>`,mat4x3h:`mat4x3<f16>`,mat4x4h:`mat4x4<f16>`};function Vr(e,t){let n={};for(let r of e.attributes){let i=Ur(e,t,r.name);i&&(n[r.name]=i)}return n}function Hr(e,t,n=16){let r=Vr(e,t),i=Array(n).fill(null);for(let e of Object.values(r))i[e.location]=e;return i}function Ur(e,t,n){let r=Wr(e,n),i=Gr(t,n);if(!r)return null;let a=Fr.getAttributeShaderTypeInfo(r.type),o=an.getCompatibleVertexFormat(a),s=i?.vertexFormat||o,c=an.getVertexFormatInfo(s);return{attributeName:i?.attributeName||r.name,bufferName:i?.bufferName||r.name,location:r.location,shaderType:r.type,primitiveType:a.primitiveType,shaderComponents:a.components,vertexFormat:s,bufferDataType:c.type,bufferComponents:c.components,normalized:c.normalized,integer:a.integer,stepMode:i?.stepMode||r.stepMode||`vertex`,byteOffset:i?.byteOffset||0,byteStride:i?.byteStride||0}}function Wr(e,t){let n=e.attributes.find(e=>e.name===t);return n||M.warn(`shader layout attribute "${t}" not present in shader`),n||null}function Gr(e,t){Kr(e);let n=qr(e,t);return n||(n=Jr(e,t),n)?n:(M.warn(`layout for attribute "${t}" not present in buffer layout`),null)}function Kr(e){for(let t of e)(t.attributes&&t.format||!t.attributes&&!t.format)&&M.warn(`BufferLayout ${name} must have either 'attributes' or 'format' field`)}function qr(e,t){for(let n of e)if(n.format&&n.name===t)return{attributeName:n.name,bufferName:t,stepMode:n.stepMode,vertexFormat:n.format,byteOffset:0,byteStride:n.byteStride||0};return null}function Jr(e,t){for(let n of e){let e=n.byteStride;if(typeof n.byteStride!=`number`)for(let t of n.attributes||[]){let n=an.getVertexFormatInfo(t.format);e+=n.byteLength}let r=n.attributes?.find(e=>e.attribute===t);if(r)return{attributeName:r.attribute,bufferName:n.name,stepMode:n.stepMode,vertexFormat:r.format,byteOffset:r.byteOffset,byteStride:e}}return null}var Yr=class e extends N{static defaultProps={...N.defaultProps,shaderLayout:void 0,bufferLayout:[]};get[Symbol.toStringTag](){return`VertexArray`}maxVertexAttributes;attributeInfos;indexBuffer=null;attributes;constructor(t,n){super(t,n,e.defaultProps),this.maxVertexAttributes=t.limits.maxVertexAttributes,this.attributes=Array(this.maxVertexAttributes).fill(null),this.attributeInfos=Hr(n.shaderLayout,n.bufferLayout,this.maxVertexAttributes)}setConstantWebGL(e,t){this.device.reportError(Error(`constant attributes not supported`),this)()}},Xr=class e extends N{static defaultProps={...N.defaultProps,layout:void 0,buffers:{}};get[Symbol.toStringTag](){return`TransformFeedback`}constructor(t,n){super(t,n,e.defaultProps)}},Zr=class e extends N{get[Symbol.toStringTag](){return`QuerySet`}constructor(t,n){super(t,n,e.defaultProps)}static defaultProps={...N.defaultProps,type:void 0,count:void 0}},Qr=class e extends N{static defaultProps={...N.defaultProps};get[Symbol.toStringTag](){return`Fence`}constructor(t,n={}){super(t,n,e.defaultProps)}};function $r(e,t){switch(t){case 1:return e;case 2:return e+e%2;default:return e+(4-e%4)%4}}function ei(e){let[,,,,t]=ti[e];return t}var ti={uint8:[`uint8`,`u32`,1,!1,Uint8Array],sint8:[`sint8`,`i32`,1,!1,Int8Array],unorm8:[`uint8`,`f32`,1,!0,Uint8Array],snorm8:[`sint8`,`f32`,1,!0,Int8Array],uint16:[`uint16`,`u32`,2,!1,Uint16Array],sint16:[`sint16`,`i32`,2,!1,Int16Array],unorm16:[`uint16`,`u32`,2,!0,Uint16Array],snorm16:[`sint16`,`i32`,2,!0,Int16Array],float16:[`float16`,`f16`,2,!1,Uint16Array],float32:[`float32`,`f32`,4,!1,Float32Array],uint32:[`uint32`,`u32`,4,!1,Uint32Array],sint32:[`sint32`,`i32`,4,!1,Int32Array]};function ni(e,t={}){let n={...e},r=t.layout??`std140`,i={},a=0;for(let[e,t]of Object.entries(n))a=ai(i,e,t,a,r);return a=$r(a,si(n,r)),{layout:r,byteLength:a*4,uniformTypes:n,fields:i}}function ri(e,t){let n=Pr(e),r=kr(n),i=/^mat(\d)x(\d)<.+>$/.exec(n);if(i){let e=Number(i[1]),a=Number(i[2]),o=ci(a,n,r.type,t),s=di(o.size,o.alignment,t);return{alignment:o.alignment,size:e*s,components:e*a,columns:e,rows:a,columnStride:s,shaderType:n,type:r.type}}let a=/^vec(\d)<.+>$/.exec(n);return a?ci(Number(a[1]),n,r.type,t):{alignment:1,size:1,components:1,columns:1,rows:1,columnStride:1,shaderType:n,type:r.type}}function ii(e){return!!e&&typeof e==`object`&&!Array.isArray(e)}function ai(e,t,n,r,i){if(typeof n==`string`){let a=ri(n,i),o=$r(r,a.alignment);return e[t]={offset:o,...a},o+a.size}if(Array.isArray(n)){if(Array.isArray(n[0]))throw Error(`Nested arrays are not supported for ${t}`);let a=n[0],o=n[1],s=li(a,i),c=$r(r,si(n,i));for(let n=0;n<o;n++)ai(e,`${t}[${n}]`,a,c+n*s,i);return c+s*o}if(ii(n)){let a=si(n,i),o=$r(r,a);for(let[r,a]of Object.entries(n))o=ai(e,`${t}.${r}`,a,o,i);return $r(o,a)}throw Error(`Unsupported CompositeShaderType for ${t}`)}function oi(e,t){if(typeof e==`string`)return ri(e,t).size;if(Array.isArray(e)){let n=e[0],r=e[1];if(Array.isArray(n))throw Error(`Nested arrays are not supported`);return li(n,t)*r}let n=0;for(let r of Object.values(e)){let e=r;n=$r(n,si(e,t)),n+=oi(e,t)}return $r(n,si(e,t))}function si(e,t){if(typeof e==`string`)return ri(e,t).alignment;if(Array.isArray(e)){let n=e[0],r=si(n,t);return fi(t)?Math.max(r,4):r}let n=1;for(let r of Object.values(e)){let e=si(r,t);n=Math.max(n,e)}return pi(t)?Math.max(n,4):n}function ci(e,t,n,r){return{alignment:e===2?2:4,size:e===3?3:e,components:e,columns:1,rows:e,columnStride:e===3?3:e,shaderType:t,type:n}}function li(e,t){return ui(oi(e,t),si(e,t),t)}function ui(e,t,n){return $r(e,fi(n)?4:t)}function di(e,t,n){return n===`std140`?4:$r(e,t)}function fi(e){return e===`std140`||e===`wgsl-uniform`}function pi(e){return e===`std140`||e===`wgsl-uniform`}function mi(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function hi(e){return Array.isArray(e)?e.length===0||typeof e[0]==`number`:mi(e)}var gi=128;function _i(e,t,n=16){if(e===t)return!0;let r=e,i=t;if(!hi(r)||!hi(i)||r.length!==i.length)return!1;let a=Math.min(n,gi);if(r.length>a)return!1;for(let e=0;e<r.length;++e)if(i[e]!==r[e])return!1;return!0}function vi(e){return hi(e)?e.slice():e}var yi=class{name;uniforms={};modifiedUniforms={};modified=!0;bindingLayout={};needsRedraw=`initialized`;constructor(e){if(this.name=e?.name||`unnamed`,e?.name&&e?.shaderLayout){let t=e?.shaderLayout.bindings?.find(t=>t.type===`uniform`&&t.name===e?.name);if(!t)throw Error(e?.name);let n=t;for(let e of n.uniforms||[])this.bindingLayout[e.name]=e}}setUniforms(e){for(let[t,n]of Object.entries(e))this._setUniform(t,n),this.needsRedraw||this.setNeedsRedraw(`${this.name}.${t}=${n}`)}setNeedsRedraw(e){this.needsRedraw=this.needsRedraw||e}getAllUniforms(){return this.modifiedUniforms={},this.needsRedraw=!1,this.uniforms||{}}_setUniform(e,t){_i(this.uniforms[e],t)||(this.uniforms[e]=vi(t),this.modifiedUniforms[e]=!0,this.modified=!0)}},bi;function xi(e){return(!bi||bi.byteLength<e)&&(bi=new ArrayBuffer(e)),bi}function Si(e,t){return new e(xi(e.BYTES_PER_ELEMENT*t),0,t)}var Ci=class{layout;constructor(e){this.layout=e}has(e){return!!this.layout.fields[e]}get(e){let t=this.layout.fields[e];return t?{offset:t.offset,size:t.size}:void 0}getFlatUniformValues(e){let t={};for(let[n,r]of Object.entries(e)){let e=this.layout.uniformTypes[n];e?this._flattenCompositeValue(t,n,e,r):this.layout.fields[n]&&(t[n]=r)}return t}getData(e){let t=xi(this.layout.byteLength);new Uint8Array(t,0,this.layout.byteLength).fill(0);let n={i32:new Int32Array(t),u32:new Uint32Array(t),f32:new Float32Array(t),f16:new Uint16Array(t)},r=this.getFlatUniformValues(e);for(let[e,t]of Object.entries(r))this._writeLeafValue(n,e,t);return new Uint8Array(t,0,this.layout.byteLength)}_flattenCompositeValue(e,t,n,r){if(r!==void 0){if(typeof n==`string`||this.layout.fields[t]){e[t]=r;return}if(Array.isArray(n)){let i=n[0],a=n[1];if(Array.isArray(i))throw Error(`Nested arrays are not supported for ${t}`);if(typeof i==`string`&&hi(r)){this._flattenPackedArray(e,t,i,a,r);return}if(!Array.isArray(r)){M.warn(`Unsupported uniform array value for ${t}:`,r)();return}for(let n=0;n<Math.min(r.length,a);n++){let a=r[n];a!==void 0&&this._flattenCompositeValue(e,`${t}[${n}]`,i,a)}return}if(ii(n)&&wi(r)){for(let[i,a]of Object.entries(r)){if(a===void 0)continue;let r=`${t}.${i}`;this._flattenCompositeValue(e,r,n[i],a)}return}M.warn(`Unsupported uniform value for ${t}:`,r)()}}_flattenPackedArray(e,t,n,r,i){let a=i,o=ri(n,this.layout.layout).components;for(let n=0;n<r;n++){let r=n*o;if(r>=a.length)break;o===1?e[`${t}[${n}]`]=Number(a[r]):e[`${t}[${n}]`]=Ti(i,r,r+o)}}_writeLeafValue(e,t,n){let r=this.layout.fields[t];if(!r){M.warn(`Uniform ${t} not found in layout`)();return}let{type:i,components:a,columns:o,rows:s,offset:c,columnStride:l}=r,u=e[i];if(a===1){u[c]=Number(n);return}let d=n;if(o===1){for(let e=0;e<a;e++)u[c+e]=Number(d[e]??0);return}let f=0;for(let e=0;e<o;e++){let t=c+e*l;for(let e=0;e<s;e++)u[t+e]=Number(d[f++]??0)}}};function wi(e){return!!e&&typeof e==`object`&&!Array.isArray(e)&&!ArrayBuffer.isView(e)}function Ti(e,t,n){return Array.prototype.slice.call(e,t,n)}var Ei=1024,Di=class{device;uniformBlocks=new Map;shaderBlockLayouts=new Map;shaderBlockWriters=new Map;uniformBuffers=new Map;constructor(e,t){this.device=e;for(let[n,r]of Object.entries(t)){let t=n,i=ni(r.uniformTypes??{},{layout:r.layout??Oi(e)}),a=new Ci(i);this.shaderBlockLayouts.set(t,i),this.shaderBlockWriters.set(t,a);let o=new yi({name:n});o.setUniforms(a.getFlatUniformValues(r.defaultUniforms||{})),this.uniformBlocks.set(t,o)}}destroy(){for(let e of this.uniformBuffers.values())e.destroy()}setUniforms(e){for(let[t,n]of Object.entries(e)){let e=t,r=this.shaderBlockWriters.get(e)?.getFlatUniformValues(n||{});this.uniformBlocks.get(e)?.setUniforms(r||{})}this.updateUniformBuffers()}getUniformBufferByteLength(e){let t=this.shaderBlockLayouts.get(e)?.byteLength||0;return Math.max(t,Ei)}getUniformBufferData(e){let t=this.uniformBlocks.get(e)?.getAllUniforms()||{};return this.shaderBlockWriters.get(e)?.getData(t)||new Uint8Array}createUniformBuffer(e,t){t&&this.setUniforms(t);let n=this.getUniformBufferByteLength(e),r=this.device.createBuffer({usage:P.UNIFORM|P.COPY_DST,byteLength:n}),i=this.getUniformBufferData(e);return r.write(i),r}getManagedUniformBuffer(e){if(!this.uniformBuffers.get(e)){let t=this.getUniformBufferByteLength(e),n=this.device.createBuffer({usage:P.UNIFORM|P.COPY_DST,byteLength:t});this.uniformBuffers.set(e,n)}return this.uniformBuffers.get(e)}updateUniformBuffers(){let e=!1;for(let t of this.uniformBlocks.keys()){let n=this.updateUniformBuffer(t);e||=n}return e&&M.log(3,`UniformStore.updateUniformBuffers(): ${e}`)(),e}updateUniformBuffer(e){let t=this.uniformBlocks.get(e),n=this.uniformBuffers.get(e),r=!1;if(n&&t?.needsRedraw){r||=t.needsRedraw;let i=this.getUniformBufferData(e);n=this.uniformBuffers.get(e),n?.write(i);let a=this.uniformBlocks.get(e)?.getAllUniforms();M.log(4,`Writing to uniform buffer ${String(e)}`,i,a)()}return r}};function Oi(e){return e.type===`webgpu`?`wgsl-uniform`:`std140`}function ki(e,t,n){let r=e.bindings.find(e=>e.name===t||`${e.name.toLocaleLowerCase()}uniforms`===t.toLocaleLowerCase());return!r&&!n?.ignoreWarnings&&M.warn(`Binding ${t} not set: Not found in shader layout.`)(),r||null}function Ai(e,t){if(!t)return{};if(Mi(t))return Object.fromEntries(Object.entries(t).map(([e,t])=>[Number(e),{...t}]));let n={};for(let[r,i]of Object.entries(t)){let t=ki(e,r)?.group??0;n[t]||={},n[t][r]=i}return n}function ji(e){let t={};for(let n of Object.values(e))Object.assign(t,n);return t}function Mi(e){let t=Object.keys(e);return t.length>0&&t.every(e=>/^\d+$/.test(e))}function Ni(e,t){if(!e){let e=Error(t||`shadertools: assertion failed.`);throw Error.captureStackTrace?.(e,Ni),e}}var Pi={number:{type:`number`,validate(e,t){return Number.isFinite(e)&&typeof t==`object`&&(t.max===void 0||e<=t.max)&&(t.min===void 0||e>=t.min)}},array:{type:`array`,validate(e,t){return Array.isArray(e)||ArrayBuffer.isView(e)}}};function Fi(e){let t={};for(let[n,r]of Object.entries(e))t[n]=Ii(r);return t}function Ii(e){let t=Li(e);if(t!==`object`)return{value:e,...Pi[t],type:t};if(typeof e==`object`)return e?e.type===void 0?e.value===void 0?{type:`object`,value:e}:(t=Li(e.value),{...e,...Pi[t],type:t}):{...e,...Pi[e.type],type:e.type}:{type:`object`,value:null};throw Error(`props`)}function Li(e){return Array.isArray(e)||ArrayBuffer.isView(e)?`array`:typeof e}var Ri={vertex:`#ifdef MODULE_LOGDEPTH
  logdepth_adjustPosition(gl_Position);
#endif
`,fragment:`#ifdef MODULE_MATERIAL
  fragColor = material_filterColor(fragColor);
#endif

#ifdef MODULE_LIGHTING
  fragColor = lighting_filterColor(fragColor);
#endif

#ifdef MODULE_FOG
  fragColor = fog_filterColor(fragColor);
#endif

#ifdef MODULE_PICKING
  fragColor = picking_filterHighlightColor(fragColor);
  fragColor = picking_filterPickingColor(fragColor);
#endif

#ifdef MODULE_LOGDEPTH
  logdepth_setFragDepth();
#endif
`},zi=/void\s+main\s*\([^)]*\)\s*\{\n?/,Bi=/}\n?[^{}]*$/,Vi=[],Hi=`__LUMA_INJECT_DECLARATIONS__`;function Ui(e){let t={vertex:{},fragment:{}};for(let n in e){let r=e[n],i=Wi(n);typeof r==`string`&&(r={order:0,injection:r}),t[i][n]=r}return t}function Wi(e){let t=e.slice(0,2);switch(t){case`vs`:return`vertex`;case`fs`:return`fragment`;default:throw Error(t)}}function Gi(e,t,n,r=!1){let i=t===`vertex`;for(let t in n){let r=n[t];r.sort((e,t)=>e.order-t.order),Vi.length=r.length;for(let e=0,t=r.length;e<t;++e)Vi[e]=r[e].injection;let a=`${Vi.join(`
`)}\n`;switch(t){case`vs:#decl`:i&&(e=e.replace(Hi,a));break;case`vs:#main-start`:i&&(e=e.replace(zi,e=>e+a));break;case`vs:#main-end`:i&&(e=e.replace(Bi,e=>a+e));break;case`fs:#decl`:i||(e=e.replace(Hi,a));break;case`fs:#main-start`:i||(e=e.replace(zi,e=>e+a));break;case`fs:#main-end`:i||(e=e.replace(Bi,e=>a+e));break;default:e=e.replace(t,e=>e+a)}}return e=e.replace(Hi,``),r&&(e=e.replace(/\}\s*$/,e=>e+Ri[t])),e}function Ki(e){e.map(e=>qi(e))}function qi(e){if(e.instance)return;Ki(e.dependencies||[]);let{propTypes:t={},deprecations:n=[],inject:r={}}=e,i={normalizedInjections:Ui(r),parsedDeprecations:Yi(n)};t&&(i.propValidators=Fi(t)),e.instance=i;let a={};t&&(a=Object.entries(t).reduce((e,[t,n])=>{let r=n?.value;return r&&(e[t]=r),e},{})),e.defaultUniforms={...e.defaultUniforms,...a}}function Ji(e,t,n){e.deprecations?.forEach(e=>{e.regex?.test(t)&&(e.deprecated?n.deprecated(e.old,e.new)():n.removed(e.old,e.new)())})}function Yi(e){return e.forEach(e=>{switch(e.type){case`function`:e.regex=RegExp(`\\b${e.old}\\(`);break;default:e.regex=RegExp(`${e.type} ${e.old};`)}}),e}function Xi(e){Ki(e);let t={},n={};Zi({modules:e,level:0,moduleMap:t,moduleDepth:n});let r=Object.keys(n).sort((e,t)=>n[t]-n[e]).map(e=>t[e]);return Ki(r),r}function Zi(e){let{modules:t,level:n,moduleMap:r,moduleDepth:i}=e;if(n>=5)throw Error(`Possible loop in shader dependency graph`);for(let e of t)r[e.name]=e,(i[e.name]===void 0||i[e.name]<n)&&(i[e.name]=n);for(let e of t)e.dependencies&&Zi({modules:e.dependencies,level:n+1,moduleMap:r,moduleDepth:i})}function Qi(e){switch(e?.gpu.toLowerCase()){case`apple`:return`#define APPLE_GPU
// Apple optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;case`nvidia`:return`#define NVIDIA_GPU
// Nvidia optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
`;case`intel`:return`#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;case`amd`:return`#define AMD_GPU
`;default:return`#define DEFAULT_GPU
// Prevent driver from optimizing away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Headless Chrome's software shader 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// If the GPU doesn't have full 32 bits precision, will causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`}}function $i(e,t){if(Number(e.match(/^#version[ \t]+(\d+)/m)?.[1]||100)!==300)throw Error(`luma.gl v9 only supports GLSL 3.00 shader sources`);switch(t){case`vertex`:return e=ra(e,ta),e;case`fragment`:return e=ra(e,na),e;default:throw Error(t)}}var ea=[[/^(#version[ \t]+(100|300[ \t]+es))?[ \t]*\n/,`#version 300 es
`],[/\btexture(2D|2DProj|Cube)Lod(EXT)?\(/g,`textureLod(`],[/\btexture(2D|2DProj|Cube)(EXT)?\(/g,`texture(`]],ta=[...ea,[ia(`attribute`),`in $1`],[ia(`varying`),`out $1`]],na=[...ea,[ia(`varying`),`in $1`]];function ra(e,t){for(let[n,r]of t)e=e.replace(n,r);return e}function ia(e){return RegExp(`\\b${e}[ \\t]+(\\w+[ \\t]+\\w+(\\[\\w+\\])?;)`,`g`)}var aa=/^(?:uniform\s+)?(?:(?:lowp|mediump|highp)\s+)?[A-Za-z0-9_]+(?:<[^>]+>)?\s+([A-Za-z0-9_]+)(?:\s*\[[^\]]+\])?\s*;/,oa=/((?:layout\s*\([^)]*\)\s*)*)uniform\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}\s*([A-Za-z_][A-Za-z0-9_]*)?\s*;/g;function sa(e){return`${e.name}Uniforms`}function ca(e,t){let n=t===`wgsl`?e.source:t===`vertex`?e.vs:e.fs;if(!n)return null;let r=sa(e);return pa(n,t===`wgsl`?`wgsl`:`glsl`,r)}function la(e,t){let n=Object.keys(e.uniformTypes||{});if(!n.length)return null;let r=ca(e,t);return r?{moduleName:e.name,uniformBlockName:sa(e),stage:t,expectedUniformNames:n,actualUniformNames:r,matches:ga(n,r)}:null}function ua(e,t,n={}){let r=la(e,t);if(!r||r.matches)return r;let i=_a(r);return n.log?.error?.(i,r)(),n.throwOnError!==!1&&Ni(!1,i),r}function da(e){let t=[],n=va(e);for(let e of n.matchAll(oa)){let n=e[1]?.trim()||null;t.push({blockName:e[2],body:e[3],instanceName:e[4]||null,layoutQualifier:n,hasLayoutQualifier:!!n,isStd140:!!(n&&/\blayout\s*\([^)]*\bstd140\b[^)]*\)/.exec(n))})}return t}function fa(e,t,n,r){let i=da(e).filter(e=>!e.isStd140),a=new Set;for(let e of i){if(a.has(e.blockName))continue;a.add(e.blockName);let i=r?.label?`${r.label} `:``,o=e.hasLayoutQualifier?`declares ${ya(e.layoutQualifier)} instead of layout(std140)`:`does not declare layout(std140)`,s=`${i}${t} shader uniform block ${e.blockName} ${o}. luma.gl host-side shader block packing assumes explicit layout(std140) for GLSL uniform blocks. Add \`layout(std140)\` to the block declaration.`;n?.warn?.(s,e)()}return i}function pa(e,t,n){let r=t===`wgsl`?ma(e,n):ha(e,n);if(!r)return null;let i=[];for(let e of r.split(`
`)){let n=e.replace(/\/\/.*$/,``).trim();if(!n||n.startsWith(`#`))continue;let r=t===`wgsl`?n.match(/^([A-Za-z0-9_]+)\s*:/):n.match(aa);r&&i.push(r[1])}return i}function ma(e,t){let n=RegExp(`\\bstruct\\s+${t}\\b`,`m`).exec(e);if(!n)return null;let r=e.indexOf(`{`,n.index);if(r<0)return null;let i=0;for(let t=r;t<e.length;t++){let n=e[t];if(n===`{`){i++;continue}if(n===`}`&&(i--,i===0))return e.slice(r+1,t)}return null}function ha(e,t){return da(e).find(e=>e.blockName===t)?.body||null}function ga(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function _a(e){let{expectedUniformNames:t,actualUniformNames:n}=e,r=t.filter(e=>!n.includes(e)),i=n.filter(e=>!t.includes(e)),a=[`Expected ${t.length} fields, found ${n.length}.`],o=ba(t,n);return o&&a.push(o),r.length&&a.push(`Missing from shader block (${r.length}): ${xa(r)}.`),i.length&&a.push(`Unexpected in shader block (${i.length}): ${xa(i)}.`),t.length<=12&&n.length<=12&&(r.length||i.length)&&(a.push(`Expected: ${t.join(`, `)}.`),a.push(`Actual: ${n.join(`, `)}.`)),`${e.moduleName}: ${e.stage} shader uniform block ${e.uniformBlockName} does not match module.uniformTypes. ${a.join(` `)}`}function va(e){return e.replace(/\/\*[\s\S]*?\*\//g,``).replace(/\/\/.*$/gm,``)}function ya(e){return e.replace(/\s+/g,` `).trim()}function ba(e,t){let n=Math.min(e.length,t.length);for(let r=0;r<n;r++)if(e[r]!==t[r])return`First mismatch at field ${r+1}: expected ${e[r]}, found ${t[r]}.`;return e.length>t.length?`Shader block ends after field ${t.length}; expected next field ${e[t.length]}.`:t.length>e.length?`Shader block has extra field ${t.length}: ${t[e.length]}.`:null}function xa(e,t=8){if(e.length<=t)return e.join(`, `);let n=e.length-t;return`${e.slice(0,t).join(`, `)}, ... (${n} more)`}function Sa(e,t){let n=``;for(let r in e){let i=e[r];if(n+=`void ${i.signature} {\n`,i.header&&(n+=`  ${i.header}`),t[r]){let e=t[r];e.sort((e,t)=>e.order-t.order);for(let t of e)n+=`  ${t.injection}\n`}i.footer&&(n+=`  ${i.footer}`),n+=`}
`}return n}function Ca(e){let t={vertex:{},fragment:{}};for(let n of e){let e,r;typeof n==`string`?(e={},r=n):(e=n,r=e.hook),r=r.trim();let[i,a]=r.split(`:`),o=r.replace(/\(.+/,``),s=Object.assign(e,{signature:a});switch(i){case`vs`:t.vertex[o]=s;break;case`fs`:t.fragment[o]=s;break;default:throw Error(i)}}return t}function wa(e,t){return{name:Ta(e,t),language:`glsl`,version:Ea(e)}}function Ta(e,t=`unnamed`){let n=/#define[^\S\r\n]*SHADER_NAME[^\S\r\n]*([A-Za-z0-9_-]+)\s*/.exec(e);return n?n[1]:t}function Ea(e){let t=100,n=e.match(/[^\s]+/g);if(n&&n.length>=2&&n[0]===`#version`){let e=parseInt(n[1],10);Number.isFinite(e)&&(t=e)}if(t!==100&&t!==300)throw Error(`Invalid GLSL version ${t}`);return t}var Da=`(?:var<\\s*(uniform|storage(?:\\s*,\\s*[A-Za-z_][A-Za-z0-9_]*)?)\\s*>|var)\\s+([A-Za-z_][A-Za-z0-9_]*)`,Oa=`\\s*`,ka=[RegExp(`@binding\\(\\s*(auto|\\d+)\\s*\\)${Oa}@group\\(\\s*(\\d+)\\s*\\)${Oa}${Da}`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Oa}@binding\\(\\s*(auto|\\d+)\\s*\\)${Oa}${Da}`,`g`)],Aa=[RegExp(`@binding\\(\\s*(auto|\\d+)\\s*\\)${Oa}@group\\(\\s*(\\d+)\\s*\\)${Oa}${Da}`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Oa}@binding\\(\\s*(auto|\\d+)\\s*\\)${Oa}${Da}`,`g`)],ja=[RegExp(`@binding\\(\\s*(\\d+)\\s*\\)${Oa}@group\\(\\s*(\\d+)\\s*\\)${Oa}${Da}`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Oa}@binding\\(\\s*(\\d+)\\s*\\)${Oa}${Da}`,`g`)],Ma=[RegExp(`@binding\\(\\s*(auto)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)\\s*${Da}`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(auto)\\s*\\)\\s*${Da}`,`g`),RegExp(`@binding\\(\\s*(auto)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)(?:[\\s\\n\\r]*@[A-Za-z_][^\\n\\r]*)*[\\s\\n\\r]*${Da}`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(auto)\\s*\\)(?:[\\s\\n\\r]*@[A-Za-z_][^\\n\\r]*)*[\\s\\n\\r]*${Da}`,`g`)];function Na(e){let t=e.split(``),n=0,r=0,i=!1,a=!1,o=!1;for(;n<e.length;){let s=e[n],c=e[n+1];if(a){o?o=!1:s===`\\`?o=!0:s===`"`&&(a=!1),n++;continue}if(i){s===`
`||s===`\r`?i=!1:t[n]=` `,n++;continue}if(r>0){if(s===`/`&&c===`*`){t[n]=` `,t[n+1]=` `,r++,n+=2;continue}if(s===`*`&&c===`/`){t[n]=` `,t[n+1]=` `,r--,n+=2;continue}s!==`
`&&s!==`\r`&&(t[n]=` `),n++;continue}if(s===`"`){a=!0,n++;continue}if(s===`/`&&c===`/`){t[n]=` `,t[n+1]=` `,i=!0,n+=2;continue}if(s===`/`&&c===`*`){t[n]=` `,t[n+1]=` `,r=1,n+=2;continue}n++}return t.join(``)}function Pa(e,t){let n=Na(e),r=[];for(let i of t){i.lastIndex=0;let a;for(a=i.exec(n);a;){let o=i===t[0],s=a.index,c=a[0].length;r.push({match:e.slice(s,s+c),index:s,length:c,bindingToken:a[o?1:2],groupToken:a[o?2:1],accessDeclaration:a[3]?.trim(),name:a[4]}),a=i.exec(n)}}return r.sort((e,t)=>e.index-t.index)}function Fa(e,t,n){let r=Pa(e,t);if(!r.length)return e;let i=``,a=0;for(let t of r)i+=e.slice(a,t.index),i+=n(t),a=t.index+t.length;return i+=e.slice(a),i}function Ia(e){return/@binding\(\s*auto\s*\)/.test(Na(e))}function La(e,t){return Pa(e,t===ka||t===Aa?Ma:t).find(e=>e.bindingToken===`auto`)}var Ra=[RegExp(`@binding\\(\\s*(\\d+)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)\\s*${Da}\\s*:\\s*([^;]+);`,`g`),RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(\\d+)\\s*\\)\\s*${Da}\\s*:\\s*([^;]+);`,`g`)];function za(e,t=[]){let n=Na(e),r=new Map;for(let e of t)r.set(Va(e.name,e.group,e.location),e.moduleName);let i=[];for(let e of Ra){e.lastIndex=0;let t;for(t=e.exec(n);t;){let a=e===Ra[0],o=Number(t[a?1:2]),s=Number(t[a?2:1]),c=t[3]?.trim(),l=t[4],u=t[5].trim(),d=r.get(Va(l,s,o));i.push(Ba({name:l,group:s,binding:o,owner:d?`module`:`application`,moduleName:d,accessDeclaration:c,resourceType:u})),t=e.exec(n)}}return i.sort((e,t)=>e.group===t.group?e.binding===t.binding?e.name.localeCompare(t.name):e.binding-t.binding:e.group-t.group)}function Ba(e){let t={name:e.name,group:e.group,binding:e.binding,owner:e.owner,kind:`unknown`,moduleName:e.moduleName,resourceType:e.resourceType};if(e.accessDeclaration){let n=e.accessDeclaration.split(`,`).map(e=>e.trim());if(n[0]===`uniform`)return{...t,kind:`uniform`,access:`uniform`};if(n[0]===`storage`){let e=n[1]||`read_write`;return{...t,kind:e===`read`?`read-only-storage`:`storage`,access:e}}}return e.resourceType===`sampler`||e.resourceType===`sampler_comparison`?{...t,kind:`sampler`,samplerKind:e.resourceType===`sampler_comparison`?`comparison`:`filtering`}:e.resourceType.startsWith(`texture_storage_`)?{...t,kind:`storage-texture`,access:Wa(e.resourceType),viewDimension:Ha(e.resourceType)}:e.resourceType.startsWith(`texture_`)?{...t,kind:`texture`,viewDimension:Ha(e.resourceType),sampleType:Ua(e.resourceType),multisampled:e.resourceType.startsWith(`texture_multisampled_`)}:t}function Va(e,t,n){return`${t}:${n}:${e}`}function Ha(e){if(e.includes(`cube_array`))return`cube-array`;if(e.includes(`2d_array`))return`2d-array`;if(e.includes(`cube`))return`cube`;if(e.includes(`3d`))return`3d`;if(e.includes(`2d`))return`2d`;if(e.includes(`1d`))return`1d`}function Ua(e){if(e.startsWith(`texture_depth_`))return`depth`;if(e.includes(`<i32>`))return`sint`;if(e.includes(`<u32>`))return`uint`;if(e.includes(`<f32>`))return`float`}function Wa(e){return/,\s*([A-Za-z_][A-Za-z0-9_]*)\s*>$/.exec(e)?.[1]}var Ga=`\n\n${Hi}\n`,Ka=100,qa=`precision highp float;
`;function Ja(e){let t=Xi(e.modules||[]),{source:n,bindingAssignments:r}=Xa(e.platformInfo,{...e,source:e.source,stage:`vertex`,modules:t});return{source:n,getUniforms:Qa(t),bindingAssignments:r,bindingTable:za(n,r)}}function Ya(e){let{vs:t,fs:n}=e,r=Xi(e.modules||[]);return{vs:Za(e.platformInfo,{...e,source:t,stage:`vertex`,modules:r}),fs:Za(e.platformInfo,{...e,source:n,stage:`fragment`,modules:r}),getUniforms:Qa(r)}}function Xa(e,t){let{source:n,stage:r,modules:i,hookFunctions:a=[],inject:o={},log:s}=t;Ni(typeof n==`string`,`shader source must be a string`);let c=n,l=``,u=Ca(a),d={},f={},p={};for(let e in o){let t=typeof o[e]==`string`?{injection:o[e],order:0}:o[e],n=/^(v|f)s:(#)?([\w-]+)$/.exec(e);if(n){let r=n[2],i=n[3];r?i===`decl`?f[e]=[t]:p[e]=[t]:d[e]=[t]}else p[e]=[t]}let m=i,h=no(c),g=to(h.source),_=oo(m,t._bindingRegistry,g),v=[];for(let e of m){s&&Ji(e,c,s);let n=ro(eo(e,`wgsl`,s),e,{usedBindingsByGroup:g,bindingRegistry:t._bindingRegistry,reservedBindingKeysByGroup:_});v.push(...n.bindingAssignments);let i=n.source;l+=i;let a=e.injections?.[r]||{};for(let e in a){let t=/^(v|f)s:#([\w-]+)$/.exec(e);if(t){let n=t[2]===`decl`?f:p;n[e]=n[e]||[],n[e].push(a[e])}else d[e]=d[e]||[],d[e].push(a[e])}}return l+=Ga,l=Gi(l,r,f),l+=Sa(u[r],d),l+=go(v),l+=h.source,l=Gi(l,r,p),ho(l),{source:l,bindingAssignments:v}}function Za(e,t){let{source:n,stage:r,language:i=`glsl`,modules:a,defines:o={},hookFunctions:s=[],inject:c={},prologue:l=!0,log:u}=t;Ni(typeof n==`string`,`shader source must be a string`);let d=i===`glsl`?wa(n).version:-1,f=e.shaderLanguageVersion,p=d===100?`#version 100`:`#version 300 es`,m=n.split(`
`).slice(1).join(`
`),h={};a.forEach(e=>{Object.assign(h,e.defines)}),Object.assign(h,o);let g=``;switch(i){case`wgsl`:break;case`glsl`:g=l?`\
${p}

// ----- PROLOGUE -------------------------
${`#define SHADER_TYPE_${r.toUpperCase()}`}

${Qi(e)}
${r===`fragment`?qa:``}

// ----- APPLICATION DEFINES -------------------------

${$a(h)}

`:`${p}
`;break}let _=Ca(s),v={},y={},b={};for(let e in c){let t=typeof c[e]==`string`?{injection:c[e],order:0}:c[e],n=/^(v|f)s:(#)?([\w-]+)$/.exec(e);if(n){let r=n[2],i=n[3];r?i===`decl`?y[e]=[t]:b[e]=[t]:v[e]=[t]}else b[e]=[t]}for(let e of a){u&&Ji(e,m,u);let t=eo(e,r,u);g+=t;let n=e.instance?.normalizedInjections[r]||{};for(let e in n){let t=/^(v|f)s:#([\w-]+)$/.exec(e);if(t){let r=t[2]===`decl`?y:b;r[e]=r[e]||[],r[e].push(n[e])}else v[e]=v[e]||[],v[e].push(n[e])}}return g+=`// ----- MAIN SHADER SOURCE -------------------------`,g+=Ga,g=Gi(g,r,y),g+=Sa(_[r],v),g+=m,g=Gi(g,r,b),i===`glsl`&&d!==f&&(g=$i(g,r)),i===`glsl`&&fa(g,r,u),g.trim()}function Qa(e){return function(t){let n={};for(let r of e){let e=r.getUniforms?.(t,n);Object.assign(n,e)}return n}}function $a(e={}){let t=``;for(let n in e){let r=e[n];(r||Number.isFinite(r))&&(t+=`#define ${n.toUpperCase()} ${e[n]}\n`)}return t}function eo(e,t,n){let r;switch(t){case`vertex`:r=e.vs||``;break;case`fragment`:r=e.fs||``;break;case`wgsl`:r=e.source||``;break;default:Ni(!1)}if(!e.name)throw Error(`Shader module must have a name`);ua(e,t,{log:n});let i=e.name.toUpperCase().replace(/[^0-9a-z]/gi,`_`),a=`\
// ----- MODULE ${e.name} ---------------

`;return t!==`wgsl`&&(a+=`#define MODULE_${i}\n`),a+=`${r}\n`,a}function to(e){let t=new Map;for(let n of Pa(e,ja)){let e=Number(n.bindingToken),r=Number(n.groupToken);lo(r,e,n.name),fo(t,r,e,`application binding "${n.name}"`)}return t}function no(e){let t=Pa(e,Aa),n=new Map;for(let e of t){if(e.bindingToken===`auto`)continue;let t=Number(e.bindingToken),r=Number(e.groupToken);lo(r,t,e.name),fo(n,r,t,`application binding "${e.name}"`)}let r={sawSupportedBindingDeclaration:t.length>0},i=Fa(e,Aa,e=>ao(e,n,r));if(Ia(e)&&!r.sawSupportedBindingDeclaration)throw Error(`Unsupported @binding(auto) declaration form in application WGSL. Use adjacent "@group(N)" and "@binding(auto)" decorators followed by a bindable "var" declaration.`);return{source:i}}function ro(e,t,n){let r=[],i={sawSupportedBindingDeclaration:Pa(e,ka).length>0,nextHintedBindingLocation:typeof t.firstBindingSlot==`number`?t.firstBindingSlot:null},a=Fa(e,ka,e=>io(e,{module:t,context:n,bindingAssignments:r,relocationState:i}));if(Ia(e)&&!i.sawSupportedBindingDeclaration)throw Error(`Unsupported @binding(auto) declaration form in module "${t.name}". Use adjacent "@group(N)" and "@binding(auto)" decorators followed by a bindable "var" declaration.`);return{source:a,bindingAssignments:r}}function io(e,t){let{module:n,context:r,bindingAssignments:i,relocationState:a}=t,{match:o,bindingToken:s,groupToken:c,name:l}=e,u=Number(c);if(s===`auto`){let e=_o(u,n.name,l),t=r.bindingRegistry?.get(e),s=t===void 0?a.nextHintedBindingLocation===null?po(u,r.usedBindingsByGroup):po(u,r.usedBindingsByGroup,a.nextHintedBindingLocation):t;return uo(n.name,u,s,l),t!==void 0&&so(r.reservedBindingKeysByGroup,u,s,e)?(i.push({moduleName:n.name,name:l,group:u,location:s}),o.replace(/@binding\(\s*auto\s*\)/,`@binding(${s})`)):(fo(r.usedBindingsByGroup,u,s,`module "${n.name}" binding "${l}"`),r.bindingRegistry?.set(e,s),i.push({moduleName:n.name,name:l,group:u,location:s}),a.nextHintedBindingLocation!==null&&t===void 0&&(a.nextHintedBindingLocation=s+1),o.replace(/@binding\(\s*auto\s*\)/,`@binding(${s})`))}let d=Number(s);return uo(n.name,u,d,l),fo(r.usedBindingsByGroup,u,d,`module "${n.name}" binding "${l}"`),i.push({moduleName:n.name,name:l,group:u,location:d}),o}function ao(e,t,n){let{match:r,bindingToken:i,groupToken:a,name:o}=e,s=Number(a);if(i===`auto`){let e=mo(s,t);return lo(s,e,o),fo(t,s,e,`application binding "${o}"`),r.replace(/@binding\(\s*auto\s*\)/,`@binding(${e})`)}return n.sawSupportedBindingDeclaration=!0,r}function oo(e,t,n){let r=new Map;if(!t)return r;for(let i of e)for(let e of co(i)){let a=_o(e.group,i.name,e.name),o=t.get(a);if(o!==void 0){let t=r.get(e.group)||new Map,i=t.get(o);if(i&&i!==a)throw Error(`Duplicate WGSL binding reservation for modules "${i}" and "${a}": group ${e.group}, binding ${o}.`);fo(n,e.group,o,`registered module binding "${a}"`),t.set(o,a),r.set(e.group,t)}}return r}function so(e,t,n,r){let i=e.get(t);if(!i)return!1;let a=i.get(n);if(!a)return!1;if(a!==r)throw Error(`Registered module binding "${r}" collided with "${a}": group ${t}, binding ${n}.`);return!0}function co(e){let t=[],n=e.source||``;for(let e of Pa(n,ka))t.push({name:e.name,group:Number(e.groupToken)});return t}function lo(e,t,n){if(e===0&&t>=Ka)throw Error(`Application binding "${n}" in group 0 uses reserved binding ${t}. Application-owned explicit group-0 bindings must stay below ${Ka}.`)}function uo(e,t,n,r){if(t===0&&n<Ka)throw Error(`Module "${e}" binding "${r}" in group 0 uses reserved application binding ${n}. Module-owned explicit group-0 bindings must be ${Ka} or higher.`)}function fo(e,t,n,r){let i=e.get(t)||new Set;if(i.has(n))throw Error(`Duplicate WGSL binding assignment for ${r}: group ${t}, binding ${n}.`);i.add(n),e.set(t,i)}function po(e,t,n){let r=t.get(e)||new Set,i=n??(e===0?Ka:r.size>0?Math.max(...r)+1:0);for(;r.has(i);)i++;return i}function mo(e,t){let n=t.get(e)||new Set,r=0;for(;n.has(r);)r++;return r}function ho(e){let t=La(e,ka);if(!t)return;let n=vo(e,t.index);throw n?Error(`Unresolved @binding(auto) for module "${n}" binding "${t.name}" remained in assembled WGSL source.`):yo(e,t.index)?Error(`Unresolved @binding(auto) for application binding "${t.name}" remained in assembled WGSL source.`):Error(`Unresolved @binding(auto) remained in assembled WGSL source near "${bo(t.match)}".`)}function go(e){if(e.length===0)return``;let t=`// ----- MODULE WGSL BINDING ASSIGNMENTS ---------------
`;for(let n of e)t+=`// ${n.moduleName}.${n.name} -> @group(${n.group}) @binding(${n.location})\n`;return t+=`
`,t}function _o(e,t,n){return`${e}:${t}:${n}`}function vo(e,t){let n=/^\/\/ ----- MODULE ([^\n]+) ---------------$/gm,r,i;for(i=n.exec(e);i&&i.index<=t;)r=i[1],i=n.exec(e);return r}function yo(e,t){let n=e.indexOf(Ga);return n>=0?t>n:!0}function bo(e){return e.replace(/\s+/g,` `).trim()}var xo=`([a-zA-Z_][a-zA-Z0-9_]*)`,So=RegExp(`^\\s*\\#\\s*ifdef\\s*${xo}\\s*$`),Co=RegExp(`^\\s*\\#\\s*ifndef\\s*${xo}\\s*(?:\\/\\/.*)?$`),wo=/^\s*\#\s*else\s*(?:\/\/.*)?$/,To=/^\s*\#\s*endif\s*$/,Eo=RegExp(`^\\s*\\#\\s*ifdef\\s*${xo}\\s*(?:\\/\\/.*)?$`),Do=/^\s*\#\s*endif\s*(?:\/\/.*)?$/;function Oo(e,t){let n=e.split(`
`),r=[],i=[],a=!0;for(let e of n){let n=e.match(Eo)||e.match(So),o=e.match(Co),s=e.match(wo),c=e.match(Do)||e.match(To);if(n||o){let e=(n||o)?.[1],r=!!t?.defines?.[e],s=n?r:!r,c=a&&s;i.push({parentActive:a,branchTaken:s,active:c}),a=c}else if(s){let e=i[i.length-1];if(!e)throw Error(`Encountered #else without matching #ifdef or #ifndef`);e.active=e.parentActive&&!e.branchTaken,e.branchTaken=!0,a=e.active}else c?(i.pop(),a=i.length?i[i.length-1].active:!0):a&&r.push(e)}if(i.length>0)throw Error(`Unterminated conditional block in shader source`);return r.join(`
`)}var ko=class e{static defaultShaderAssembler;_hookFunctions=[];_defaultModules=[];_wgslBindingRegistry=new Map;static getDefaultShaderAssembler(){return e.defaultShaderAssembler=e.defaultShaderAssembler||new e,e.defaultShaderAssembler}addDefaultModule(e){this._defaultModules.find(t=>t.name===(typeof e==`string`?e:e.name))||this._defaultModules.push(e)}removeDefaultModule(e){let t=typeof e==`string`?e:e.name;this._defaultModules=this._defaultModules.filter(e=>e.name!==t)}addShaderHook(e,t){t&&(e=Object.assign(t,{hook:e})),this._hookFunctions.push(e)}assembleWGSLShader(e){let t=this._getModuleList(e.modules),n=this._hookFunctions,{source:r,getUniforms:i,bindingAssignments:a}=Ja({...e,source:e.source,_bindingRegistry:this._wgslBindingRegistry,modules:t,hookFunctions:n}),o={...t.reduce((e,t)=>(Object.assign(e,t.defines),e),{}),...e.defines},s=e.platformInfo.shaderLanguage===`wgsl`?Oo(r,{defines:o}):r;return{source:s,getUniforms:i,modules:t,bindingAssignments:a,bindingTable:za(s,a)}}assembleGLSLShaderPair(e){let t=this._getModuleList(e.modules),n=this._hookFunctions;return{...Ya({...e,vs:e.vs,fs:e.fs,modules:t,hookFunctions:n}),modules:t}}_getModuleList(e=[]){let t=Array(this._defaultModules.length+e.length),n={},r=0;for(let e=0,i=this._defaultModules.length;e<i;++e){let i=this._defaultModules[e],a=i.name;t[r++]=i,n[a]=!0}for(let i=0,a=e.length;i<a;++i){let a=e[i],o=a.name;n[o]||(t[r++]=a,n[o]=!0)}return t.length=r,Ki(t),t}},Ao=`#version 300 es
out vec4 transform_output;
void main() {
  transform_output = vec4(0);
}`;function jo(e){let{input:t,inputChannels:n,output:r}=e||{};if(!t)return Ao;if(!n)throw Error(`inputChannels`);return`\
#version 300 es
in ${Mo(n)} ${t};
out vec4 ${r};
void main() {
  ${r} = ${No(t,n)};
}`}function Mo(e){switch(e){case 1:return`float`;case 2:return`vec2`;case 3:return`vec3`;case 4:return`vec4`;default:throw Error(`invalid channels: ${e}`)}}function No(e,t){switch(t){case 1:return`vec4(${e}, 0.0, 0.0, 1.0)`;case 2:return`vec4(${e}, 0.0, 1.0)`;case 3:return`vec4(${e}, 1.0)`;case 4:return e;default:throw Error(`invalid channels: ${t}`)}}function Po(e,t=!0){return e??t}function Fo(e=[0,0,0],t=!0){return t?e.map(e=>e/255):[...e]}function Io(e,t=!0){let n=Fo(e.slice(0,3),t),r=Number.isFinite(e[3]),i=r?e[3]:1;return[n[0],n[1],n[2],t&&r?i/255:i]}var Lo={name:`fp32`,vs:`#ifdef LUMA_FP32_TAN_PRECISION_WORKAROUND

// All these functions are for substituting tan() function from Intel GPU only
const float TWO_PI = 6.2831854820251465;
const float PI_2 = 1.5707963705062866;
const float PI_16 = 0.1963495463132858;

const float SIN_TABLE_0 = 0.19509032368659973;
const float SIN_TABLE_1 = 0.3826834261417389;
const float SIN_TABLE_2 = 0.5555702447891235;
const float SIN_TABLE_3 = 0.7071067690849304;

const float COS_TABLE_0 = 0.9807852506637573;
const float COS_TABLE_1 = 0.9238795042037964;
const float COS_TABLE_2 = 0.8314695954322815;
const float COS_TABLE_3 = 0.7071067690849304;

const float INVERSE_FACTORIAL_3 = 1.666666716337204e-01; // 1/3!
const float INVERSE_FACTORIAL_5 = 8.333333767950535e-03; // 1/5!
const float INVERSE_FACTORIAL_7 = 1.9841270113829523e-04; // 1/7!
const float INVERSE_FACTORIAL_9 = 2.75573188446287533e-06; // 1/9!

float sin_taylor_fp32(float a) {
  float r, s, t, x;

  if (a == 0.0) {
    return 0.0;
  }

  x = -a * a;
  s = a;
  r = a;

  r = r * x;
  t = r * INVERSE_FACTORIAL_3;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_5;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_7;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_9;
  s = s + t;

  return s;
}

void sincos_taylor_fp32(float a, out float sin_t, out float cos_t) {
  if (a == 0.0) {
    sin_t = 0.0;
    cos_t = 1.0;
  }
  sin_t = sin_taylor_fp32(a);
  cos_t = sqrt(1.0 - sin_t * sin_t);
}

float tan_taylor_fp32(float a) {
    float sin_a;
    float cos_a;

    if (a == 0.0) {
        return 0.0;
    }

    // 2pi range reduction
    float z = floor(a / TWO_PI);
    float r = a - TWO_PI * z;

    float t;
    float q = floor(r / PI_2 + 0.5);
    int j = int(q);

    if (j < -2 || j > 2) {
        return 1.0 / 0.0;
    }

    t = r - PI_2 * q;

    q = floor(t / PI_16 + 0.5);
    int k = int(q);
    int abs_k = int(abs(float(k)));

    if (abs_k > 4) {
        return 1.0 / 0.0;
    } else {
        t = t - PI_16 * q;
    }

    float u = 0.0;
    float v = 0.0;

    float sin_t, cos_t;
    float s, c;
    sincos_taylor_fp32(t, sin_t, cos_t);

    if (k == 0) {
        s = sin_t;
        c = cos_t;
    } else {
        if (abs(float(abs_k) - 1.0) < 0.5) {
            u = COS_TABLE_0;
            v = SIN_TABLE_0;
        } else if (abs(float(abs_k) - 2.0) < 0.5) {
            u = COS_TABLE_1;
            v = SIN_TABLE_1;
        } else if (abs(float(abs_k) - 3.0) < 0.5) {
            u = COS_TABLE_2;
            v = SIN_TABLE_2;
        } else if (abs(float(abs_k) - 4.0) < 0.5) {
            u = COS_TABLE_3;
            v = SIN_TABLE_3;
        }
        if (k > 0) {
            s = u * sin_t + v * cos_t;
            c = u * cos_t - v * sin_t;
        } else {
            s = u * sin_t - v * cos_t;
            c = u * cos_t + v * sin_t;
        }
    }

    if (j == 0) {
        sin_a = s;
        cos_a = c;
    } else if (j == 1) {
        sin_a = c;
        cos_a = -s;
    } else if (j == -1) {
        sin_a = -c;
        cos_a = s;
    } else {
        sin_a = -s;
        cos_a = -c;
    }
    return sin_a / cos_a;
}
#endif

float tan_fp32(float a) {
#ifdef LUMA_FP32_TAN_PRECISION_WORKAROUND
  return tan_taylor_fp32(a);
#else
  return tan(a);
#endif
}
`};function Ro(e,t=[],n=0){let r=Math.fround(e),i=e-r;return t[n]=r,t[n+1]=i,t}function zo(e){return e-Math.fround(e)}function Bo(e){let t=new Float32Array(32);for(let n=0;n<4;++n)for(let r=0;r<4;++r){let i=n*4+r;Ro(e[r*4+n],t,i*2)}return t}var Vo=`
layout(std140) uniform fp64arithmeticUniforms {
  uniform float ONE;
  uniform float SPLIT;
} fp64;

/*
About LUMA_FP64_CODE_ELIMINATION_WORKAROUND

The purpose of this workaround is to prevent shader compilers from
optimizing away necessary arithmetic operations by swapping their sequences
or transform the equation to some 'equivalent' form.

These helpers implement Dekker/Veltkamp-style error tracking. If the compiler
folds constants or reassociates the arithmetic, the high/low split can stop
tracking the rounding error correctly. That failure mode tends to look fine in
simple coordinate setup, but then breaks down inside iterative arithmetic such
as fp64 Mandelbrot loops.

The method is to multiply an artifical variable, ONE, which will be known to
the compiler to be 1 only at runtime. The whole expression is then represented
as a polynomial with respective to ONE. In the coefficients of all terms, only one a
and one b should appear

err = (a + b) * ONE^6 - a * ONE^5 - (a + b) * ONE^4 + a * ONE^3 - b - (a + b) * ONE^2 + a * ONE
*/

float prevent_fp64_optimization(float value) {
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  return value + fp64.ONE * 0.0;
#else
  return value;
#endif
}

// Divide float number to high and low floats to extend fraction bits
vec2 split(float a) {
  // Keep SPLIT as a runtime uniform so the compiler cannot fold the Dekker
  // split into a constant expression and reassociate the recovery steps.
  float split = prevent_fp64_optimization(fp64.SPLIT);
  float t = prevent_fp64_optimization(a * split);
  float temp = t - a;
  float a_hi = t - temp;
  float a_lo = a - a_hi;
  return vec2(a_hi, a_lo);
}

// Divide float number again when high float uses too many fraction bits
vec2 split2(vec2 a) {
  vec2 b = split(a.x);
  b.y += a.y;
  return b;
}

// Special sum operation when a > b
vec2 quickTwoSum(float a, float b) {
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float sum = (a + b) * fp64.ONE;
  float err = b - (sum - a) * fp64.ONE;
#else
  float sum = a + b;
  float err = b - (sum - a);
#endif
  return vec2(sum, err);
}

// General sum operation
vec2 twoSum(float a, float b) {
  float s = (a + b);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float v = (s * fp64.ONE - a) * fp64.ONE;
  float err = (a - (s - v) * fp64.ONE) * fp64.ONE * fp64.ONE * fp64.ONE + (b - v);
#else
  float v = s - a;
  float err = (a - (s - v)) + (b - v);
#endif
  return vec2(s, err);
}

vec2 twoSub(float a, float b) {
  float s = (a - b);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float v = (s * fp64.ONE - a) * fp64.ONE;
  float err = (a - (s - v) * fp64.ONE) * fp64.ONE * fp64.ONE * fp64.ONE - (b + v);
#else
  float v = s - a;
  float err = (a - (s - v)) - (b + v);
#endif
  return vec2(s, err);
}

vec2 twoSqr(float a) {
  float prod = a * a;
  vec2 a_fp64 = split(a);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float err = ((a_fp64.x * a_fp64.x - prod) * fp64.ONE + 2.0 * a_fp64.x *
    a_fp64.y * fp64.ONE * fp64.ONE) + a_fp64.y * a_fp64.y * fp64.ONE * fp64.ONE * fp64.ONE;
#else
  float err = ((a_fp64.x * a_fp64.x - prod) + 2.0 * a_fp64.x * a_fp64.y) + a_fp64.y * a_fp64.y;
#endif
  return vec2(prod, err);
}

vec2 twoProd(float a, float b) {
  float prod = a * b;
  vec2 a_fp64 = split(a);
  vec2 b_fp64 = split(b);
  // twoProd is especially sensitive because mul_fp64 and div_fp64 both depend
  // on the split terms and cross terms staying in the original evaluation
  // order. If the compiler folds or reassociates them, the low part tends to
  // collapse to zero or NaN on some drivers.
  float highProduct = prevent_fp64_optimization(a_fp64.x * b_fp64.x);
  float crossProduct1 = prevent_fp64_optimization(a_fp64.x * b_fp64.y);
  float crossProduct2 = prevent_fp64_optimization(a_fp64.y * b_fp64.x);
  float lowProduct = prevent_fp64_optimization(a_fp64.y * b_fp64.y);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float err1 = (highProduct - prod) * fp64.ONE;
  float err2 = crossProduct1 * fp64.ONE * fp64.ONE;
  float err3 = crossProduct2 * fp64.ONE * fp64.ONE * fp64.ONE;
  float err4 = lowProduct * fp64.ONE * fp64.ONE * fp64.ONE * fp64.ONE;
#else
  float err1 = highProduct - prod;
  float err2 = crossProduct1;
  float err3 = crossProduct2;
  float err4 = lowProduct;
#endif
  float err = ((err1 + err2) + err3) + err4;
  return vec2(prod, err);
}

vec2 sum_fp64(vec2 a, vec2 b) {
  vec2 s, t;
  s = twoSum(a.x, b.x);
  t = twoSum(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  s = quickTwoSum(s.x, s.y);
  return s;
}

vec2 sub_fp64(vec2 a, vec2 b) {
  vec2 s, t;
  s = twoSub(a.x, b.x);
  t = twoSub(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  s = quickTwoSum(s.x, s.y);
  return s;
}

vec2 mul_fp64(vec2 a, vec2 b) {
  vec2 prod = twoProd(a.x, b.x);
  // y component is for the error
  prod.y += a.x * b.y;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  prod.y += a.y * b.x;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  return prod;
}

vec2 div_fp64(vec2 a, vec2 b) {
  float xn = 1.0 / b.x;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  vec2 yn = mul_fp64(a, vec2(xn, 0));
#else
  vec2 yn = a * xn;
#endif
  float diff = (sub_fp64(a, mul_fp64(b, yn))).x;
  vec2 prod = twoProd(xn, diff);
  return sum_fp64(yn, prod);
}

vec2 sqrt_fp64(vec2 a) {
  if (a.x == 0.0 && a.y == 0.0) return vec2(0.0, 0.0);
  if (a.x < 0.0) return vec2(0.0 / 0.0, 0.0 / 0.0);

  float x = 1.0 / sqrt(a.x);
  float yn = a.x * x;
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  vec2 yn_sqr = twoSqr(yn) * fp64.ONE;
#else
  vec2 yn_sqr = twoSqr(yn);
#endif
  float diff = sub_fp64(a, yn_sqr).x;
  vec2 prod = twoProd(x * 0.5, diff);
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  return sum_fp64(split(yn), prod);
#else
  return sum_fp64(vec2(yn, 0.0), prod);
#endif
}
`,Ho={name:`fp64arithmetic`,source:`struct Fp64ArithmeticUniforms {
  ONE: f32,
  SPLIT: f32,
};

@group(0) @binding(auto) var<uniform> fp64arithmetic : Fp64ArithmeticUniforms;

fn fp64_nan(seed: f32) -> f32 {
  let nanBits = 0x7fc00000u | select(0u, 1u, seed < 0.0);
  return bitcast<f32>(nanBits);
}

fn fp64_runtime_zero() -> f32 {
  return fp64arithmetic.ONE * 0.0;
}

fn prevent_fp64_optimization(value: f32) -> f32 {
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  return value + fp64_runtime_zero();
#else
  return value;
#endif
}

fn split(a: f32) -> vec2f {
  let splitValue = prevent_fp64_optimization(fp64arithmetic.SPLIT + fp64_runtime_zero());
  let t = prevent_fp64_optimization(a * splitValue);
  let temp = prevent_fp64_optimization(t - a);
  let aHi = prevent_fp64_optimization(t - temp);
  let aLo = prevent_fp64_optimization(a - aHi);
  return vec2f(aHi, aLo);
}

fn split2(a: vec2f) -> vec2f {
  var b = split(a.x);
  b.y = b.y + a.y;
  return b;
}

fn quickTwoSum(a: f32, b: f32) -> vec2f {
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let sum = prevent_fp64_optimization((a + b) * fp64arithmetic.ONE);
  let err = prevent_fp64_optimization(b - (sum - a) * fp64arithmetic.ONE);
#else
  let sum = prevent_fp64_optimization(a + b);
  let err = prevent_fp64_optimization(b - (sum - a));
#endif
  return vec2f(sum, err);
}

fn twoSum(a: f32, b: f32) -> vec2f {
  let s = prevent_fp64_optimization(a + b);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let v = prevent_fp64_optimization((s * fp64arithmetic.ONE - a) * fp64arithmetic.ONE);
  let err =
    prevent_fp64_optimization((a - (s - v) * fp64arithmetic.ONE) *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE) +
    prevent_fp64_optimization(b - v);
#else
  let v = prevent_fp64_optimization(s - a);
  let err = prevent_fp64_optimization(a - (s - v)) + prevent_fp64_optimization(b - v);
#endif
  return vec2f(s, err);
}

fn twoSub(a: f32, b: f32) -> vec2f {
  let s = prevent_fp64_optimization(a - b);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let v = prevent_fp64_optimization((s * fp64arithmetic.ONE - a) * fp64arithmetic.ONE);
  let err =
    prevent_fp64_optimization((a - (s - v) * fp64arithmetic.ONE) *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE) -
    prevent_fp64_optimization(b + v);
#else
  let v = prevent_fp64_optimization(s - a);
  let err = prevent_fp64_optimization(a - (s - v)) - prevent_fp64_optimization(b + v);
#endif
  return vec2f(s, err);
}

fn twoSqr(a: f32) -> vec2f {
  let prod = prevent_fp64_optimization(a * a);
  let aFp64 = split(a);
  let highProduct = prevent_fp64_optimization(aFp64.x * aFp64.x);
  let crossProduct = prevent_fp64_optimization(2.0 * aFp64.x * aFp64.y);
  let lowProduct = prevent_fp64_optimization(aFp64.y * aFp64.y);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let err =
    (prevent_fp64_optimization(highProduct - prod) * fp64arithmetic.ONE +
      crossProduct * fp64arithmetic.ONE * fp64arithmetic.ONE) +
    lowProduct * fp64arithmetic.ONE * fp64arithmetic.ONE * fp64arithmetic.ONE;
#else
  let err = ((prevent_fp64_optimization(highProduct - prod) + crossProduct) + lowProduct);
#endif
  return vec2f(prod, err);
}

fn twoProd(a: f32, b: f32) -> vec2f {
  let prod = prevent_fp64_optimization(a * b);
  let aFp64 = split(a);
  let bFp64 = split(b);
  let highProduct = prevent_fp64_optimization(aFp64.x * bFp64.x);
  let crossProduct1 = prevent_fp64_optimization(aFp64.x * bFp64.y);
  let crossProduct2 = prevent_fp64_optimization(aFp64.y * bFp64.x);
  let lowProduct = prevent_fp64_optimization(aFp64.y * bFp64.y);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let err1 = (highProduct - prod) * fp64arithmetic.ONE;
  let err2 = crossProduct1 * fp64arithmetic.ONE * fp64arithmetic.ONE;
  let err3 = crossProduct2 * fp64arithmetic.ONE * fp64arithmetic.ONE * fp64arithmetic.ONE;
  let err4 =
    lowProduct *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE;
#else
  let err1 = highProduct - prod;
  let err2 = crossProduct1;
  let err3 = crossProduct2;
  let err4 = lowProduct;
#endif
  let err12InputA = prevent_fp64_optimization(err1);
  let err12InputB = prevent_fp64_optimization(err2);
  let err12 = prevent_fp64_optimization(err12InputA + err12InputB);
  let err123InputA = prevent_fp64_optimization(err12);
  let err123InputB = prevent_fp64_optimization(err3);
  let err123 = prevent_fp64_optimization(err123InputA + err123InputB);
  let err1234InputA = prevent_fp64_optimization(err123);
  let err1234InputB = prevent_fp64_optimization(err4);
  let err = prevent_fp64_optimization(err1234InputA + err1234InputB);
  return vec2f(prod, err);
}

fn sum_fp64(a: vec2f, b: vec2f) -> vec2f {
  var s = twoSum(a.x, b.x);
  let t = twoSum(a.y, b.y);
  s.y = prevent_fp64_optimization(s.y + t.x);
  s = quickTwoSum(s.x, s.y);
  s.y = prevent_fp64_optimization(s.y + t.y);
  s = quickTwoSum(s.x, s.y);
  return s;
}

fn sub_fp64(a: vec2f, b: vec2f) -> vec2f {
  var s = twoSub(a.x, b.x);
  let t = twoSub(a.y, b.y);
  s.y = prevent_fp64_optimization(s.y + t.x);
  s = quickTwoSum(s.x, s.y);
  s.y = prevent_fp64_optimization(s.y + t.y);
  s = quickTwoSum(s.x, s.y);
  return s;
}

fn mul_fp64(a: vec2f, b: vec2f) -> vec2f {
  var prod = twoProd(a.x, b.x);
  let crossProduct1 = prevent_fp64_optimization(a.x * b.y);
  prod.y = prevent_fp64_optimization(prod.y + crossProduct1);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  let crossProduct2 = prevent_fp64_optimization(a.y * b.x);
  prod.y = prevent_fp64_optimization(prod.y + crossProduct2);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  return prod;
}

fn div_fp64(a: vec2f, b: vec2f) -> vec2f {
  let xn = prevent_fp64_optimization(1.0 / b.x);
  let yn = mul_fp64(a, vec2f(xn, fp64_runtime_zero()));
  let diff = prevent_fp64_optimization(sub_fp64(a, mul_fp64(b, yn)).x);
  let prod = twoProd(xn, diff);
  return sum_fp64(yn, prod);
}

fn sqrt_fp64(a: vec2f) -> vec2f {
  if (a.x == 0.0 && a.y == 0.0) {
    return vec2f(0.0, 0.0);
  }
  if (a.x < 0.0) {
    let nanValue = fp64_nan(a.x);
    return vec2f(nanValue, nanValue);
  }

  let x = prevent_fp64_optimization(1.0 / sqrt(a.x));
  let yn = prevent_fp64_optimization(a.x * x);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let ynSqr = twoSqr(yn) * fp64arithmetic.ONE;
#else
  let ynSqr = twoSqr(yn);
#endif
  let diff = prevent_fp64_optimization(sub_fp64(a, ynSqr).x);
  let prod = twoProd(prevent_fp64_optimization(x * 0.5), diff);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  return sum_fp64(split(yn), prod);
#else
  return sum_fp64(vec2f(yn, 0.0), prod);
#endif
}
`,fs:Vo,vs:Vo,defaultUniforms:{ONE:1,SPLIT:4097},uniformTypes:{ONE:`f32`,SPLIT:`f32`},fp64ify:Ro,fp64LowPart:zo,fp64ifyMatrix4:Bo},Uo={props:{},uniforms:{},name:`picking`,uniformTypes:{isActive:`f32`,isAttribute:`f32`,isHighlightActive:`f32`,useByteColors:`f32`,highlightedObjectColor:`vec3<f32>`,highlightColor:`vec4<f32>`},defaultUniforms:{isActive:!1,isAttribute:!1,isHighlightActive:!1,useByteColors:!0,highlightedObjectColor:[0,0,0],highlightColor:[0,1,1,1]},vs:`layout(std140) uniform pickingUniforms {
  float isActive;
  float isAttribute;
  float isHighlightActive;
  float useByteColors;
  vec3 highlightedObjectColor;
  vec4 highlightColor;
} picking;

out vec4 picking_vRGBcolor_Avalid;

// Normalize unsigned byte color to 0-1 range
vec3 picking_normalizeColor(vec3 color) {
  return picking.useByteColors > 0.5 ? color / 255.0 : color;
}

// Normalize unsigned byte color to 0-1 range
vec4 picking_normalizeColor(vec4 color) {
  return picking.useByteColors > 0.5 ? color / 255.0 : color;
}

bool picking_isColorZero(vec3 color) {
  return dot(color, vec3(1.0)) < 0.00001;
}

bool picking_isColorValid(vec3 color) {
  return dot(color, vec3(1.0)) > 0.00001;
}

// Check if this vertex is highlighted 
bool isVertexHighlighted(vec3 vertexColor) {
  vec3 highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
  return
    bool(picking.isHighlightActive) && picking_isColorZero(abs(vertexColor - highlightedObjectColor));
}

// Set the current picking color
void picking_setPickingColor(vec3 pickingColor) {
  pickingColor = picking_normalizeColor(pickingColor);

  if (bool(picking.isActive)) {
    // Use alpha as the validity flag. If pickingColor is [0, 0, 0] fragment is non-pickable
    picking_vRGBcolor_Avalid.a = float(picking_isColorValid(pickingColor));

    if (!bool(picking.isAttribute)) {
      // Stores the picking color so that the fragment shader can render it during picking
      picking_vRGBcolor_Avalid.rgb = pickingColor;
    }
  } else {
    // Do the comparison with selected item color in vertex shader as it should mean fewer compares
    picking_vRGBcolor_Avalid.a = float(isVertexHighlighted(pickingColor));
  }
}

void picking_setPickingAttribute(float value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.r = value;
  }
}

void picking_setPickingAttribute(vec2 value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.rg = value;
  }
}

void picking_setPickingAttribute(vec3 value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.rgb = value;
  }
}
`,fs:`layout(std140) uniform pickingUniforms {
  float isActive;
  float isAttribute;
  float isHighlightActive;
  float useByteColors;
  vec3 highlightedObjectColor;
  vec4 highlightColor;
} picking;

in vec4 picking_vRGBcolor_Avalid;

/*
 * Returns highlight color if this item is selected.
 */
vec4 picking_filterHighlightColor(vec4 color) {
  // If we are still picking, we don't highlight
  if (picking.isActive > 0.5) {
    return color;
  }

  bool selected = bool(picking_vRGBcolor_Avalid.a);

  if (selected) {
    // Blend in highlight color based on its alpha value
    float highLightAlpha = picking.highlightColor.a;
    float blendedAlpha = highLightAlpha + color.a * (1.0 - highLightAlpha);
    float highLightRatio = highLightAlpha / blendedAlpha;

    vec3 blendedRGB = mix(color.rgb, picking.highlightColor.rgb, highLightRatio);
    return vec4(blendedRGB, blendedAlpha);
  } else {
    return color;
  }
}

/*
 * Returns picking color if picking enabled else unmodified argument.
 */
vec4 picking_filterPickingColor(vec4 color) {
  if (bool(picking.isActive)) {
    if (picking_vRGBcolor_Avalid.a == 0.0) {
      discard;
    }
    return picking_vRGBcolor_Avalid;
  }
  return color;
}

/*
 * Returns picking color if picking is enabled if not
 * highlight color if this item is selected, otherwise unmodified argument.
 */
vec4 picking_filterColor(vec4 color) {
  vec4 highlightColor = picking_filterHighlightColor(color);
  return picking_filterPickingColor(highlightColor);
}
`,getUniforms:Wo};function Wo(e={},t){let n={},r=Po(e.useByteColors,!0);return e.highlightedObjectColor===void 0||(e.highlightedObjectColor===null?n.isHighlightActive=!1:(n.isHighlightActive=!0,n.highlightedObjectColor=e.highlightedObjectColor.slice(0,3))),e.highlightColor&&(n.highlightColor=Io(e.highlightColor,r)),e.isActive!==void 0&&(n.isActive=!!e.isActive,n.isAttribute=!!e.isAttribute),e.useByteColors!==void 0&&(n.useByteColors=!!e.useByteColors),n}var Go=1/Math.PI*180,Ko=1/180*Math.PI;globalThis.mathgl=globalThis.mathgl||{config:{EPSILON:1e-12,debug:!1,precision:4,printTypes:!1,printDegrees:!1,printRowMajor:!0,_cartographicRadians:!1}};var L=globalThis.mathgl.config;function qo(e,{precision:t=L.precision}={}){return e=ns(e),`${parseFloat(e.toPrecision(t))}`}function Jo(e){return Array.isArray(e)||ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Yo(e){return Zo(e)}function Xo(e){return Qo(e)}function Zo(e,t){return is(e,e=>e*Ko,t)}function Qo(e,t){return is(e,e=>e*Go,t)}function $o(e,t,n){return is(e,e=>Math.max(t,Math.min(n,e)))}function es(e,t,n){return Jo(e)?e.map((e,r)=>es(e,t[r],n)):n*t+(1-n)*e}function ts(e,t,n){let r=L.EPSILON;n&&(L.EPSILON=n);try{if(e===t)return!0;if(Jo(e)&&Jo(t)){if(e.length!==t.length)return!1;for(let n=0;n<e.length;++n)if(!ts(e[n],t[n]))return!1;return!0}return e&&e.equals?e.equals(t):t&&t.equals?t.equals(e):typeof e==`number`&&typeof t==`number`?Math.abs(e-t)<=L.EPSILON*Math.max(1,Math.abs(e),Math.abs(t)):!1}finally{L.EPSILON=r}}function ns(e){return Math.round(e/L.EPSILON)*L.EPSILON}function rs(e){return e.clone?e.clone():Array(e.length)}function is(e,t,n){if(Jo(e)){let r=e;n||=rs(r);for(let i=0;i<n.length&&i<r.length;++i){let r=typeof e==`number`?e:e[i];n[i]=t(r,i,n)}return n}return t(e)}var as=class extends Array{clone(){return new this.constructor().copy(this)}fromArray(e,t=0){for(let n=0;n<this.ELEMENTS;++n)this[n]=e[n+t];return this.check()}toArray(e=[],t=0){for(let n=0;n<this.ELEMENTS;++n)e[t+n]=this[n];return e}toObject(e){return e}from(e){return Array.isArray(e)?this.copy(e):this.fromObject(e)}to(e){return e===this?this:Jo(e)?this.toArray(e):this.toObject(e)}toTarget(e){return e?this.to(e):this}toFloat32Array(){return new Float32Array(this)}toString(){return this.formatString(L)}formatString(e){let t=``;for(let n=0;n<this.ELEMENTS;++n)t+=(n>0?`, `:``)+qo(this[n],e);return`${e.printTypes?this.constructor.name:``}[${t}]`}equals(e){if(!e||this.length!==e.length)return!1;for(let t=0;t<this.ELEMENTS;++t)if(!ts(this[t],e[t]))return!1;return!0}exactEquals(e){if(!e||this.length!==e.length)return!1;for(let t=0;t<this.ELEMENTS;++t)if(this[t]!==e[t])return!1;return!0}negate(){for(let e=0;e<this.ELEMENTS;++e)this[e]=-this[e];return this.check()}lerp(e,t,n){if(n===void 0)return this.lerp(this,e,t);for(let r=0;r<this.ELEMENTS;++r){let i=e[r],a=typeof t==`number`?t:t[r];this[r]=i+n*(a-i)}return this.check()}min(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=Math.min(e[t],this[t]);return this.check()}max(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=Math.max(e[t],this[t]);return this.check()}clamp(e,t){for(let n=0;n<this.ELEMENTS;++n)this[n]=Math.min(Math.max(this[n],e[n]),t[n]);return this.check()}add(...e){for(let t of e)for(let e=0;e<this.ELEMENTS;++e)this[e]+=t[e];return this.check()}subtract(...e){for(let t of e)for(let e=0;e<this.ELEMENTS;++e)this[e]-=t[e];return this.check()}scale(e){if(typeof e==`number`)for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;else for(let t=0;t<this.ELEMENTS&&t<e.length;++t)this[t]*=e[t];return this.check()}multiplyByScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;return this.check()}check(){if(L.debug&&!this.validate())throw Error(`math.gl: ${this.constructor.name} some fields set to invalid numbers'`);return this}validate(){let e=this.length===this.ELEMENTS;for(let t=0;t<this.ELEMENTS;++t)e&&=Number.isFinite(this[t]);return e}sub(e){return this.subtract(e)}setScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=e;return this.check()}addScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]+=e;return this.check()}subScalar(e){return this.addScalar(-e)}multiplyScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;return this.check()}divideScalar(e){return this.multiplyByScalar(1/e)}clampScalar(e,t){for(let n=0;n<this.ELEMENTS;++n)this[n]=Math.min(Math.max(this[n],e),t);return this.check()}get elements(){return this}};function os(e,t){if(e.length!==t)return!1;for(let t=0;t<e.length;++t)if(!Number.isFinite(e[t]))return!1;return!0}function R(e){if(!Number.isFinite(e))throw Error(`Invalid number ${JSON.stringify(e)}`);return e}function ss(e,t,n=``){if(L.debug&&!os(e,t))throw Error(`math.gl: ${n} some fields set to invalid numbers'`);return e}function cs(e,t){if(!e)throw Error(`math.gl assertion ${t}`)}var ls=class extends as{get x(){return this[0]}set x(e){this[0]=R(e)}get y(){return this[1]}set y(e){this[1]=R(e)}len(){return Math.sqrt(this.lengthSquared())}magnitude(){return this.len()}lengthSquared(){let e=0;for(let t=0;t<this.ELEMENTS;++t)e+=this[t]*this[t];return e}magnitudeSquared(){return this.lengthSquared()}distance(e){return Math.sqrt(this.distanceSquared(e))}distanceSquared(e){let t=0;for(let n=0;n<this.ELEMENTS;++n){let r=this[n]-e[n];t+=r*r}return R(t)}dot(e){let t=0;for(let n=0;n<this.ELEMENTS;++n)t+=this[n]*e[n];return R(t)}normalize(){let e=this.magnitude();if(e!==0)for(let t=0;t<this.ELEMENTS;++t)this[t]/=e;return this.check()}multiply(...e){for(let t of e)for(let e=0;e<this.ELEMENTS;++e)this[e]*=t[e];return this.check()}divide(...e){for(let t of e)for(let e=0;e<this.ELEMENTS;++e)this[e]/=t[e];return this.check()}lengthSq(){return this.lengthSquared()}distanceTo(e){return this.distance(e)}distanceToSquared(e){return this.distanceSquared(e)}getComponent(e){return cs(e>=0&&e<this.ELEMENTS,`index is out of range`),R(this[e])}setComponent(e,t){return cs(e>=0&&e<this.ELEMENTS,`index is out of range`),this[e]=t,this.check()}addVectors(e,t){return this.copy(e).add(t)}subVectors(e,t){return this.copy(e).subtract(t)}multiplyVectors(e,t){return this.copy(e).multiply(t)}addScaledVector(e,t){return this.add(new this.constructor(e).multiplyScalar(t))}},us=typeof Float32Array<`u`?Float32Array:Array;Math.PI/180;function ds(){let e=new us(2);return us!=Float32Array&&(e[0]=0,e[1]=0),e}function fs(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e}function ps(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e}function ms(e,t){return e[0]=-t[0],e[1]=-t[1],e}function hs(e,t,n,r){let i=t[0],a=t[1];return e[0]=i+r*(n[0]-i),e[1]=a+r*(n[1]-a),e}function gs(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e}function _s(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i+n[4],e[1]=n[1]*r+n[3]*i+n[5],e}function vs(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[3]*i+n[6],e[1]=n[1]*r+n[4]*i+n[7],e}function ys(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[4]*i+n[12],e[1]=n[1]*r+n[5]*i+n[13],e}var bs=ps;(function(){let e=ds();return function(t,n,r,i,a,o){let s,c;for(n||=2,r||=0,c=i?Math.min(i*n+r,t.length):t.length,s=r;s<c;s+=n)e[0]=t[s],e[1]=t[s+1],a(e,e,o),t[s]=e[0],t[s+1]=e[1];return t}})();function xs(e,t,n){let r=t[0],i=t[1],a=n[3]*r+n[7]*i||1;return e[0]=(n[0]*r+n[4]*i)/a,e[1]=(n[1]*r+n[5]*i)/a,e}function Ss(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[3]*r+n[7]*i+n[11]*a||1;return e[0]=(n[0]*r+n[4]*i+n[8]*a)/o,e[1]=(n[1]*r+n[5]*i+n[9]*a)/o,e[2]=(n[2]*r+n[6]*i+n[10]*a)/o,e}function Cs(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e[2]=t[2],e}function ws(e,t,n){let r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e[2]=t[2],e[3]=t[3],e}function Ts(e,t,n){let r=t[0],i=t[1],a=t[2];return e[0]=n[0]*r+n[3]*i+n[6]*a,e[1]=n[1]*r+n[4]*i+n[7]*a,e[2]=n[2]*r+n[5]*i+n[8]*a,e[3]=t[3],e}var Es=class extends ls{constructor(e=0,t=0){super(2),Jo(e)&&arguments.length===1?this.copy(e):(L.debug&&(R(e),R(t)),this[0]=e,this[1]=t)}set(e,t){return this[0]=e,this[1]=t,this.check()}copy(e){return this[0]=e[0],this[1]=e[1],this.check()}fromObject(e){return L.debug&&(R(e.x),R(e.y)),this[0]=e.x,this[1]=e.y,this.check()}toObject(e){return e.x=this[0],e.y=this[1],e}get ELEMENTS(){return 2}horizontalAngle(){return Math.atan2(this.y,this.x)}verticalAngle(){return Math.atan2(this.x,this.y)}transform(e){return this.transformAsPoint(e)}transformAsPoint(e){return ys(this,this,e),this.check()}transformAsVector(e){return xs(this,this,e),this.check()}transformByMatrix3(e){return vs(this,this,e),this.check()}transformByMatrix2x3(e){return _s(this,this,e),this.check()}transformByMatrix2(e){return gs(this,this,e),this.check()}};function Ds(){let e=new us(3);return us!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e}function Os(e){let t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)}function ks(e,t,n){let r=new us(3);return r[0]=e,r[1]=t,r[2]=n,r}function As(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e}function js(e,t){let n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)}function Ms(e){let t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r}function Ns(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e}function Ps(e,t){let n=t[0],r=t[1],i=t[2],a=n*n+r*r+i*i;return a>0&&(a=1/Math.sqrt(a)),e[0]=t[0]*a,e[1]=t[1]*a,e[2]=t[2]*a,e}function Fs(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Is(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[0],s=n[1],c=n[2];return e[0]=i*c-a*s,e[1]=a*o-r*c,e[2]=r*s-i*o,e}function Ls(e,t,n,r){let i=t[0],a=t[1],o=t[2];return e[0]=i+r*(n[0]-i),e[1]=a+r*(n[1]-a),e[2]=o+r*(n[2]-o),e}function Rs(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[3]*r+n[7]*i+n[11]*a+n[15];return o||=1,e[0]=(n[0]*r+n[4]*i+n[8]*a+n[12])/o,e[1]=(n[1]*r+n[5]*i+n[9]*a+n[13])/o,e[2]=(n[2]*r+n[6]*i+n[10]*a+n[14])/o,e}function zs(e,t,n){let r=t[0],i=t[1],a=t[2];return e[0]=r*n[0]+i*n[3]+a*n[6],e[1]=r*n[1]+i*n[4]+a*n[7],e[2]=r*n[2]+i*n[5]+a*n[8],e}function Bs(e,t,n){let r=n[0],i=n[1],a=n[2],o=n[3],s=t[0],c=t[1],l=t[2],u=i*l-a*c,d=a*s-r*l,f=r*c-i*s,p=i*f-a*d,m=a*u-r*f,h=r*d-i*u,g=o*2;return u*=g,d*=g,f*=g,p*=2,m*=2,h*=2,e[0]=s+u+p,e[1]=c+d+m,e[2]=l+f+h,e}function Vs(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[0],a[1]=i[1]*Math.cos(r)-i[2]*Math.sin(r),a[2]=i[1]*Math.sin(r)+i[2]*Math.cos(r),e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function Hs(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[2]*Math.sin(r)+i[0]*Math.cos(r),a[1]=i[1],a[2]=i[2]*Math.cos(r)-i[0]*Math.sin(r),e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function Us(e,t,n,r){let i=[],a=[];return i[0]=t[0]-n[0],i[1]=t[1]-n[1],i[2]=t[2]-n[2],a[0]=i[0]*Math.cos(r)-i[1]*Math.sin(r),a[1]=i[0]*Math.sin(r)+i[1]*Math.cos(r),a[2]=i[2],e[0]=a[0]+n[0],e[1]=a[1]+n[1],e[2]=a[2]+n[2],e}function Ws(e,t){let n=e[0],r=e[1],i=e[2],a=t[0],o=t[1],s=t[2],c=Math.sqrt((n*n+r*r+i*i)*(a*a+o*o+s*s)),l=c&&Fs(e,t)/c;return Math.acos(Math.min(Math.max(l,-1),1))}var Gs=As,Ks=js,qs=Os,Js=Ms;(function(){let e=Ds();return function(t,n,r,i,a,o){let s,c;for(n||=3,r||=0,c=i?Math.min(i*n+r,t.length):t.length,s=r;s<c;s+=n)e[0]=t[s],e[1]=t[s+1],e[2]=t[s+2],a(e,e,o),t[s]=e[0],t[s+1]=e[1],t[s+2]=e[2];return t}})();var Ys=[0,0,0],Xs,z=class e extends ls{static get ZERO(){return Xs||(Xs=new e(0,0,0),Object.freeze(Xs)),Xs}constructor(e=0,t=0,n=0){super(-0,-0,-0),arguments.length===1&&Jo(e)?this.copy(e):(L.debug&&(R(e),R(t),R(n)),this[0]=e,this[1]=t,this[2]=n)}set(e,t,n){return this[0]=e,this[1]=t,this[2]=n,this.check()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this.check()}fromObject(e){return L.debug&&(R(e.x),R(e.y),R(e.z)),this[0]=e.x,this[1]=e.y,this[2]=e.z,this.check()}toObject(e){return e.x=this[0],e.y=this[1],e.z=this[2],e}get ELEMENTS(){return 3}get z(){return this[2]}set z(e){this[2]=R(e)}angle(e){return Ws(this,e)}cross(e){return Is(this,this,e),this.check()}rotateX({radians:e,origin:t=Ys}){return Vs(this,this,t,e),this.check()}rotateY({radians:e,origin:t=Ys}){return Hs(this,this,t,e),this.check()}rotateZ({radians:e,origin:t=Ys}){return Us(this,this,t,e),this.check()}transform(e){return this.transformAsPoint(e)}transformAsPoint(e){return Rs(this,this,e),this.check()}transformAsVector(e){return Ss(this,this,e),this.check()}transformByMatrix3(e){return zs(this,this,e),this.check()}transformByMatrix2(e){return Cs(this,this,e),this.check()}transformByQuaternion(e){return Bs(this,this,e),this.check()}},Zs=class extends as{toString(){let e=`[`;if(L.printRowMajor){e+=`row-major:`;for(let t=0;t<this.RANK;++t)for(let n=0;n<this.RANK;++n)e+=` ${this[n*this.RANK+t]}`}else{e+=`column-major:`;for(let t=0;t<this.ELEMENTS;++t)e+=` ${this[t]}`}return e+=`]`,e}getElementIndex(e,t){return t*this.RANK+e}getElement(e,t){return this[t*this.RANK+e]}setElement(e,t,n){return this[t*this.RANK+e]=R(n),this}getColumn(e,t=Array(this.RANK).fill(-0)){let n=e*this.RANK;for(let e=0;e<this.RANK;++e)t[e]=this[n+e];return t}setColumn(e,t){let n=e*this.RANK;for(let e=0;e<this.RANK;++e)this[n+e]=t[e];return this}};function Qs(){let e=new us(9);return us!=Float32Array&&(e[1]=0,e[2]=0,e[3]=0,e[5]=0,e[6]=0,e[7]=0),e[0]=1,e[4]=1,e[8]=1,e}function $s(e,t){if(e===t){let n=t[1],r=t[2],i=t[5];e[1]=t[3],e[2]=t[6],e[3]=n,e[5]=t[7],e[6]=r,e[7]=i}else e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8];return e}function ec(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=t[4],s=t[5],c=t[6],l=t[7],u=t[8],d=u*o-s*l,f=-u*a+s*c,p=l*a-o*c,m=n*d+r*f+i*p;return m?(m=1/m,e[0]=d*m,e[1]=(-u*r+i*l)*m,e[2]=(s*r-i*o)*m,e[3]=f*m,e[4]=(u*n-i*c)*m,e[5]=(-s*n+i*a)*m,e[6]=p*m,e[7]=(-l*n+r*c)*m,e[8]=(o*n-r*a)*m,e):null}function tc(e){let t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*(l*a-o*c)+n*(-l*i+o*s)+r*(c*i-a*s)}function nc(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3],s=t[4],c=t[5],l=t[6],u=t[7],d=t[8],f=n[0],p=n[1],m=n[2],h=n[3],g=n[4],_=n[5],v=n[6],y=n[7],b=n[8];return e[0]=f*r+p*o+m*l,e[1]=f*i+p*s+m*u,e[2]=f*a+p*c+m*d,e[3]=h*r+g*o+_*l,e[4]=h*i+g*s+_*u,e[5]=h*a+g*c+_*d,e[6]=v*r+y*o+b*l,e[7]=v*i+y*s+b*u,e[8]=v*a+y*c+b*d,e}function rc(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3],s=t[4],c=t[5],l=t[6],u=t[7],d=t[8],f=n[0],p=n[1];return e[0]=r,e[1]=i,e[2]=a,e[3]=o,e[4]=s,e[5]=c,e[6]=f*r+p*o+l,e[7]=f*i+p*s+u,e[8]=f*a+p*c+d,e}function ic(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3],s=t[4],c=t[5],l=t[6],u=t[7],d=t[8],f=Math.sin(n),p=Math.cos(n);return e[0]=p*r+f*o,e[1]=p*i+f*s,e[2]=p*a+f*c,e[3]=p*o-f*r,e[4]=p*s-f*i,e[5]=p*c-f*a,e[6]=l,e[7]=u,e[8]=d,e}function ac(e,t,n){let r=n[0],i=n[1];return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=i*t[3],e[4]=i*t[4],e[5]=i*t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e}function oc(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=n+n,s=r+r,c=i+i,l=n*o,u=r*o,d=r*s,f=i*o,p=i*s,m=i*c,h=a*o,g=a*s,_=a*c;return e[0]=1-d-m,e[3]=u-_,e[6]=f+g,e[1]=u+_,e[4]=1-l-m,e[7]=p-h,e[2]=f-g,e[5]=p+h,e[8]=1-l-d,e}var sc;(function(e){e[e.COL0ROW0=0]=`COL0ROW0`,e[e.COL0ROW1=1]=`COL0ROW1`,e[e.COL0ROW2=2]=`COL0ROW2`,e[e.COL1ROW0=3]=`COL1ROW0`,e[e.COL1ROW1=4]=`COL1ROW1`,e[e.COL1ROW2=5]=`COL1ROW2`,e[e.COL2ROW0=6]=`COL2ROW0`,e[e.COL2ROW1=7]=`COL2ROW1`,e[e.COL2ROW2=8]=`COL2ROW2`})(sc||={});var cc=Object.freeze([1,0,0,0,1,0,0,0,1]),B=class extends Zs{static get IDENTITY(){return fc()}static get ZERO(){return dc()}get ELEMENTS(){return 9}get RANK(){return 3}get INDICES(){return sc}constructor(e,...t){super(-0,-0,-0,-0,-0,-0,-0,-0,-0),arguments.length===1&&Array.isArray(e)?this.copy(e):t.length>0?this.copy([e,...t]):this.identity()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this[4]=e[4],this[5]=e[5],this[6]=e[6],this[7]=e[7],this[8]=e[8],this.check()}identity(){return this.copy(cc)}fromObject(e){return this.check()}fromQuaternion(e){return oc(this,e),this.check()}set(e,t,n,r,i,a,o,s,c){return this[0]=e,this[1]=t,this[2]=n,this[3]=r,this[4]=i,this[5]=a,this[6]=o,this[7]=s,this[8]=c,this.check()}setRowMajor(e,t,n,r,i,a,o,s,c){return this[0]=e,this[1]=r,this[2]=o,this[3]=t,this[4]=i,this[5]=s,this[6]=n,this[7]=a,this[8]=c,this.check()}determinant(){return tc(this)}transpose(){return $s(this,this),this.check()}invert(){return ec(this,this),this.check()}multiplyLeft(e){return nc(this,e,this),this.check()}multiplyRight(e){return nc(this,this,e),this.check()}rotate(e){return ic(this,this,e),this.check()}scale(e){return Array.isArray(e)?ac(this,this,e):ac(this,this,[e,e]),this.check()}translate(e){return rc(this,this,e),this.check()}transform(e,t){let n;switch(e.length){case 2:n=vs(t||[-0,-0],e,this);break;case 3:n=zs(t||[-0,-0,-0],e,this);break;case 4:n=Ts(t||[-0,-0,-0,-0],e,this);break;default:throw Error(`Illegal vector`)}return ss(n,e.length),n}transformVector(e,t){return this.transform(e,t)}transformVector2(e,t){return this.transform(e,t)}transformVector3(e,t){return this.transform(e,t)}},lc,uc=null;function dc(){return lc||(lc=new B([0,0,0,0,0,0,0,0,0]),Object.freeze(lc)),lc}function fc(){return uc||(uc=new B,Object.freeze(uc)),uc}function pc(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}function mc(e,t){if(e===t){let n=t[1],r=t[2],i=t[3],a=t[6],o=t[7],s=t[11];e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=n,e[6]=t[9],e[7]=t[13],e[8]=r,e[9]=a,e[11]=t[14],e[12]=i,e[13]=o,e[14]=s}else e[0]=t[0],e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=t[1],e[5]=t[5],e[6]=t[9],e[7]=t[13],e[8]=t[2],e[9]=t[6],e[10]=t[10],e[11]=t[14],e[12]=t[3],e[13]=t[7],e[14]=t[11],e[15]=t[15];return e}function hc(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=t[4],s=t[5],c=t[6],l=t[7],u=t[8],d=t[9],f=t[10],p=t[11],m=t[12],h=t[13],g=t[14],_=t[15],v=n*s-r*o,y=n*c-i*o,b=n*l-a*o,x=r*c-i*s,S=r*l-a*s,C=i*l-a*c,w=u*h-d*m,T=u*g-f*m,E=u*_-p*m,D=d*g-f*h,ee=d*_-p*h,O=f*_-p*g,k=v*O-y*ee+b*D+x*E-S*T+C*w;return k?(k=1/k,e[0]=(s*O-c*ee+l*D)*k,e[1]=(i*ee-r*O-a*D)*k,e[2]=(h*C-g*S+_*x)*k,e[3]=(f*S-d*C-p*x)*k,e[4]=(c*E-o*O-l*T)*k,e[5]=(n*O-i*E+a*T)*k,e[6]=(g*b-m*C-_*y)*k,e[7]=(u*C-f*b+p*y)*k,e[8]=(o*ee-s*E+l*w)*k,e[9]=(r*E-n*ee-a*w)*k,e[10]=(m*S-h*b+_*v)*k,e[11]=(d*b-u*S-p*v)*k,e[12]=(s*T-o*D-c*w)*k,e[13]=(n*D-r*T+i*w)*k,e[14]=(h*y-m*x-g*v)*k,e[15]=(u*x-d*y+f*v)*k,e):null}function gc(e){let t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=n*s-r*o,b=l*m-u*p,x=l*h-d*p,S=u*h-d*m,C=t*S-n*x+r*b,w=a*S-o*x+s*b,T=l*y-u*v+d*_,E=p*y-m*v+h*_;return c*C-i*w+g*T-f*E}function _c(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3],s=t[4],c=t[5],l=t[6],u=t[7],d=t[8],f=t[9],p=t[10],m=t[11],h=t[12],g=t[13],_=t[14],v=t[15],y=n[0],b=n[1],x=n[2],S=n[3];return e[0]=y*r+b*s+x*d+S*h,e[1]=y*i+b*c+x*f+S*g,e[2]=y*a+b*l+x*p+S*_,e[3]=y*o+b*u+x*m+S*v,y=n[4],b=n[5],x=n[6],S=n[7],e[4]=y*r+b*s+x*d+S*h,e[5]=y*i+b*c+x*f+S*g,e[6]=y*a+b*l+x*p+S*_,e[7]=y*o+b*u+x*m+S*v,y=n[8],b=n[9],x=n[10],S=n[11],e[8]=y*r+b*s+x*d+S*h,e[9]=y*i+b*c+x*f+S*g,e[10]=y*a+b*l+x*p+S*_,e[11]=y*o+b*u+x*m+S*v,y=n[12],b=n[13],x=n[14],S=n[15],e[12]=y*r+b*s+x*d+S*h,e[13]=y*i+b*c+x*f+S*g,e[14]=y*a+b*l+x*p+S*_,e[15]=y*o+b*u+x*m+S*v,e}function vc(e,t,n){let r=n[0],i=n[1],a=n[2],o,s,c,l,u,d,f,p,m,h,g,_;return t===e?(e[12]=t[0]*r+t[4]*i+t[8]*a+t[12],e[13]=t[1]*r+t[5]*i+t[9]*a+t[13],e[14]=t[2]*r+t[6]*i+t[10]*a+t[14],e[15]=t[3]*r+t[7]*i+t[11]*a+t[15]):(o=t[0],s=t[1],c=t[2],l=t[3],u=t[4],d=t[5],f=t[6],p=t[7],m=t[8],h=t[9],g=t[10],_=t[11],e[0]=o,e[1]=s,e[2]=c,e[3]=l,e[4]=u,e[5]=d,e[6]=f,e[7]=p,e[8]=m,e[9]=h,e[10]=g,e[11]=_,e[12]=o*r+u*i+m*a+t[12],e[13]=s*r+d*i+h*a+t[13],e[14]=c*r+f*i+g*a+t[14],e[15]=l*r+p*i+_*a+t[15]),e}function yc(e,t,n){let r=n[0],i=n[1],a=n[2];return e[0]=t[0]*r,e[1]=t[1]*r,e[2]=t[2]*r,e[3]=t[3]*r,e[4]=t[4]*i,e[5]=t[5]*i,e[6]=t[6]*i,e[7]=t[7]*i,e[8]=t[8]*a,e[9]=t[9]*a,e[10]=t[10]*a,e[11]=t[11]*a,e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e}function bc(e,t,n,r){let i=r[0],a=r[1],o=r[2],s=Math.sqrt(i*i+a*a+o*o),c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,ee,O,k,A;return s<1e-6?null:(s=1/s,i*=s,a*=s,o*=s,l=Math.sin(n),c=Math.cos(n),u=1-c,d=t[0],f=t[1],p=t[2],m=t[3],h=t[4],g=t[5],_=t[6],v=t[7],y=t[8],b=t[9],x=t[10],S=t[11],C=i*i*u+c,w=a*i*u+o*l,T=o*i*u-a*l,E=i*a*u-o*l,D=a*a*u+c,ee=o*a*u+i*l,O=i*o*u+a*l,k=a*o*u-i*l,A=o*o*u+c,e[0]=d*C+h*w+y*T,e[1]=f*C+g*w+b*T,e[2]=p*C+_*w+x*T,e[3]=m*C+v*w+S*T,e[4]=d*E+h*D+y*ee,e[5]=f*E+g*D+b*ee,e[6]=p*E+_*D+x*ee,e[7]=m*E+v*D+S*ee,e[8]=d*O+h*k+y*A,e[9]=f*O+g*k+b*A,e[10]=p*O+_*k+x*A,e[11]=m*O+v*k+S*A,t!==e&&(e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e)}function xc(e,t,n){let r=Math.sin(n),i=Math.cos(n),a=t[4],o=t[5],s=t[6],c=t[7],l=t[8],u=t[9],d=t[10],f=t[11];return t!==e&&(e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[4]=a*i+l*r,e[5]=o*i+u*r,e[6]=s*i+d*r,e[7]=c*i+f*r,e[8]=l*i-a*r,e[9]=u*i-o*r,e[10]=d*i-s*r,e[11]=f*i-c*r,e}function Sc(e,t,n){let r=Math.sin(n),i=Math.cos(n),a=t[0],o=t[1],s=t[2],c=t[3],l=t[8],u=t[9],d=t[10],f=t[11];return t!==e&&(e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=a*i-l*r,e[1]=o*i-u*r,e[2]=s*i-d*r,e[3]=c*i-f*r,e[8]=a*r+l*i,e[9]=o*r+u*i,e[10]=s*r+d*i,e[11]=c*r+f*i,e}function Cc(e,t,n){let r=Math.sin(n),i=Math.cos(n),a=t[0],o=t[1],s=t[2],c=t[3],l=t[4],u=t[5],d=t[6],f=t[7];return t!==e&&(e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=a*i+l*r,e[1]=o*i+u*r,e[2]=s*i+d*r,e[3]=c*i+f*r,e[4]=l*i-a*r,e[5]=u*i-o*r,e[6]=d*i-s*r,e[7]=f*i-c*r,e}function wc(e,t){let n=t[0],r=t[1],i=t[2],a=t[4],o=t[5],s=t[6],c=t[8],l=t[9],u=t[10];return e[0]=Math.sqrt(n*n+r*r+i*i),e[1]=Math.sqrt(a*a+o*o+s*s),e[2]=Math.sqrt(c*c+l*l+u*u),e}function Tc(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=n+n,s=r+r,c=i+i,l=n*o,u=r*o,d=r*s,f=i*o,p=i*s,m=i*c,h=a*o,g=a*s,_=a*c;return e[0]=1-d-m,e[1]=u+_,e[2]=f-g,e[3]=0,e[4]=u-_,e[5]=1-l-m,e[6]=p+h,e[7]=0,e[8]=f+g,e[9]=p-h,e[10]=1-l-d,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}function Ec(e,t,n,r,i,a,o){let s=1/(n-t),c=1/(i-r),l=1/(a-o);return e[0]=a*2*s,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=a*2*c,e[6]=0,e[7]=0,e[8]=(n+t)*s,e[9]=(i+r)*c,e[10]=(o+a)*l,e[11]=-1,e[12]=0,e[13]=0,e[14]=o*a*2*l,e[15]=0,e}function Dc(e,t,n,r,i){let a=1/Math.tan(t/2);if(e[0]=a/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=a,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[11]=-1,e[12]=0,e[13]=0,e[15]=0,i!=null&&i!==1/0){let t=1/(r-i);e[10]=(i+r)*t,e[14]=2*i*r*t}else e[10]=-1,e[14]=-2*r;return e}var Oc=Dc;function kc(e,t,n,r,i,a,o){let s=1/(t-n),c=1/(r-i),l=1/(a-o);return e[0]=-2*s,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=-2*c,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=2*l,e[11]=0,e[12]=(t+n)*s,e[13]=(i+r)*c,e[14]=(o+a)*l,e[15]=1,e}var Ac=kc;function jc(e,t,n,r){let i,a,o,s,c,l,u,d,f,p,m=t[0],h=t[1],g=t[2],_=r[0],v=r[1],y=r[2],b=n[0],x=n[1],S=n[2];return Math.abs(m-b)<1e-6&&Math.abs(h-x)<1e-6&&Math.abs(g-S)<1e-6?pc(e):(d=m-b,f=h-x,p=g-S,i=1/Math.sqrt(d*d+f*f+p*p),d*=i,f*=i,p*=i,a=v*p-y*f,o=y*d-_*p,s=_*f-v*d,i=Math.sqrt(a*a+o*o+s*s),i?(i=1/i,a*=i,o*=i,s*=i):(a=0,o=0,s=0),c=f*s-p*o,l=p*a-d*s,u=d*o-f*a,i=Math.sqrt(c*c+l*l+u*u),i?(i=1/i,c*=i,l*=i,u*=i):(c=0,l=0,u=0),e[0]=a,e[1]=c,e[2]=d,e[3]=0,e[4]=o,e[5]=l,e[6]=f,e[7]=0,e[8]=s,e[9]=u,e[10]=p,e[11]=0,e[12]=-(a*m+o*h+s*g),e[13]=-(c*m+l*h+u*g),e[14]=-(d*m+f*h+p*g),e[15]=1,e)}function Mc(){let e=new us(4);return us!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0,e[3]=0),e}function Nc(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e[3]=t[3]+n[3],e}function Pc(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e[3]=t[3]*n,e}function Fc(e){let t=e[0],n=e[1],r=e[2],i=e[3];return Math.sqrt(t*t+n*n+r*r+i*i)}function Ic(e){let t=e[0],n=e[1],r=e[2],i=e[3];return t*t+n*n+r*r+i*i}function Lc(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=n*n+r*r+i*i+a*a;return o>0&&(o=1/Math.sqrt(o)),e[0]=n*o,e[1]=r*o,e[2]=i*o,e[3]=a*o,e}function Rc(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]+e[3]*t[3]}function zc(e,t,n,r){let i=t[0],a=t[1],o=t[2],s=t[3];return e[0]=i+r*(n[0]-i),e[1]=a+r*(n[1]-a),e[2]=o+r*(n[2]-o),e[3]=s+r*(n[3]-s),e}function Bc(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3];return e[0]=n[0]*r+n[4]*i+n[8]*a+n[12]*o,e[1]=n[1]*r+n[5]*i+n[9]*a+n[13]*o,e[2]=n[2]*r+n[6]*i+n[10]*a+n[14]*o,e[3]=n[3]*r+n[7]*i+n[11]*a+n[15]*o,e}function Vc(e,t,n){let r=t[0],i=t[1],a=t[2],o=n[0],s=n[1],c=n[2],l=n[3],u=l*r+s*a-c*i,d=l*i+c*r-o*a,f=l*a+o*i-s*r,p=-o*r-s*i-c*a;return e[0]=u*l+p*-o+d*-c-f*-s,e[1]=d*l+p*-s+f*-o-u*-c,e[2]=f*l+p*-c+u*-s-d*-o,e[3]=t[3],e}(function(){let e=Mc();return function(t,n,r,i,a,o){let s,c;for(n||=4,r||=0,c=i?Math.min(i*n+r,t.length):t.length,s=r;s<c;s+=n)e[0]=t[s],e[1]=t[s+1],e[2]=t[s+2],e[3]=t[s+3],a(e,e,o),t[s]=e[0],t[s+1]=e[1],t[s+2]=e[2],t[s+3]=e[3];return t}})();var Hc;(function(e){e[e.COL0ROW0=0]=`COL0ROW0`,e[e.COL0ROW1=1]=`COL0ROW1`,e[e.COL0ROW2=2]=`COL0ROW2`,e[e.COL0ROW3=3]=`COL0ROW3`,e[e.COL1ROW0=4]=`COL1ROW0`,e[e.COL1ROW1=5]=`COL1ROW1`,e[e.COL1ROW2=6]=`COL1ROW2`,e[e.COL1ROW3=7]=`COL1ROW3`,e[e.COL2ROW0=8]=`COL2ROW0`,e[e.COL2ROW1=9]=`COL2ROW1`,e[e.COL2ROW2=10]=`COL2ROW2`,e[e.COL2ROW3=11]=`COL2ROW3`,e[e.COL3ROW0=12]=`COL3ROW0`,e[e.COL3ROW1=13]=`COL3ROW1`,e[e.COL3ROW2=14]=`COL3ROW2`,e[e.COL3ROW3=15]=`COL3ROW3`})(Hc||={});var Uc=45*Math.PI/180,Wc=1,Gc=.1,Kc=500,qc=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),V=class extends Zs{static get IDENTITY(){return Zc()}static get ZERO(){return Xc()}get ELEMENTS(){return 16}get RANK(){return 4}get INDICES(){return Hc}constructor(e){super(-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0),arguments.length===1&&Array.isArray(e)?this.copy(e):this.identity()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this[4]=e[4],this[5]=e[5],this[6]=e[6],this[7]=e[7],this[8]=e[8],this[9]=e[9],this[10]=e[10],this[11]=e[11],this[12]=e[12],this[13]=e[13],this[14]=e[14],this[15]=e[15],this.check()}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){return this[0]=e,this[1]=t,this[2]=n,this[3]=r,this[4]=i,this[5]=a,this[6]=o,this[7]=s,this[8]=c,this[9]=l,this[10]=u,this[11]=d,this[12]=f,this[13]=p,this[14]=m,this[15]=h,this.check()}setRowMajor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){return this[0]=e,this[1]=i,this[2]=c,this[3]=f,this[4]=t,this[5]=a,this[6]=l,this[7]=p,this[8]=n,this[9]=o,this[10]=u,this[11]=m,this[12]=r,this[13]=s,this[14]=d,this[15]=h,this.check()}toRowMajor(e){return e[0]=this[0],e[1]=this[4],e[2]=this[8],e[3]=this[12],e[4]=this[1],e[5]=this[5],e[6]=this[9],e[7]=this[13],e[8]=this[2],e[9]=this[6],e[10]=this[10],e[11]=this[14],e[12]=this[3],e[13]=this[7],e[14]=this[11],e[15]=this[15],e}identity(){return this.copy(qc)}fromObject(e){return this.check()}fromQuaternion(e){return Tc(this,e),this.check()}frustum(e){let{left:t,right:n,bottom:r,top:i,near:a=Gc,far:o=Kc}=e;return o===1/0?$c(this,t,n,r,i,a):Ec(this,t,n,r,i,a,o),this.check()}lookAt(e){let{eye:t,center:n=[0,0,0],up:r=[0,1,0]}=e;return jc(this,t,n,r),this.check()}ortho(e){let{left:t,right:n,bottom:r,top:i,near:a=Gc,far:o=Kc}=e;return Ac(this,t,n,r,i,a,o),this.check()}orthographic(e){let{fovy:t=Uc,aspect:n=Wc,focalDistance:r=1,near:i=Gc,far:a=Kc}=e;Qc(t);let o=t/2,s=r*Math.tan(o),c=s*n;return this.ortho({left:-c,right:c,bottom:-s,top:s,near:i,far:a})}perspective(e){let{fovy:t=45*Math.PI/180,aspect:n=1,near:r=.1,far:i=500}=e;return Qc(t),Oc(this,t,n,r,i),this.check()}determinant(){return gc(this)}getScale(e=[-0,-0,-0]){return e[0]=Math.sqrt(this[0]*this[0]+this[1]*this[1]+this[2]*this[2]),e[1]=Math.sqrt(this[4]*this[4]+this[5]*this[5]+this[6]*this[6]),e[2]=Math.sqrt(this[8]*this[8]+this[9]*this[9]+this[10]*this[10]),e}getTranslation(e=[-0,-0,-0]){return e[0]=this[12],e[1]=this[13],e[2]=this[14],e}getRotation(e,t){e||=[-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0],t||=[-0,-0,-0];let n=this.getScale(t),r=1/n[0],i=1/n[1],a=1/n[2];return e[0]=this[0]*r,e[1]=this[1]*i,e[2]=this[2]*a,e[3]=0,e[4]=this[4]*r,e[5]=this[5]*i,e[6]=this[6]*a,e[7]=0,e[8]=this[8]*r,e[9]=this[9]*i,e[10]=this[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}getRotationMatrix3(e,t){e||=[-0,-0,-0,-0,-0,-0,-0,-0,-0],t||=[-0,-0,-0];let n=this.getScale(t),r=1/n[0],i=1/n[1],a=1/n[2];return e[0]=this[0]*r,e[1]=this[1]*i,e[2]=this[2]*a,e[3]=this[4]*r,e[4]=this[5]*i,e[5]=this[6]*a,e[6]=this[8]*r,e[7]=this[9]*i,e[8]=this[10]*a,e}transpose(){return mc(this,this),this.check()}invert(){return hc(this,this),this.check()}multiplyLeft(e){return _c(this,e,this),this.check()}multiplyRight(e){return _c(this,this,e),this.check()}rotateX(e){return xc(this,this,e),this.check()}rotateY(e){return Sc(this,this,e),this.check()}rotateZ(e){return Cc(this,this,e),this.check()}rotateXYZ(e){return this.rotateX(e[0]).rotateY(e[1]).rotateZ(e[2])}rotateAxis(e,t){return bc(this,this,e,t),this.check()}scale(e){return yc(this,this,Array.isArray(e)?e:[e,e,e]),this.check()}translate(e){return vc(this,this,e),this.check()}transform(e,t){return e.length===4?(t=Bc(t||[-0,-0,-0,-0],e,this),ss(t,4),t):this.transformAsPoint(e,t)}transformAsPoint(e,t){let{length:n}=e,r;switch(n){case 2:r=ys(t||[-0,-0],e,this);break;case 3:r=Rs(t||[-0,-0,-0],e,this);break;default:throw Error(`Illegal vector`)}return ss(r,e.length),r}transformAsVector(e,t){let n;switch(e.length){case 2:n=xs(t||[-0,-0],e,this);break;case 3:n=Ss(t||[-0,-0,-0],e,this);break;default:throw Error(`Illegal vector`)}return ss(n,e.length),n}transformPoint(e,t){return this.transformAsPoint(e,t)}transformVector(e,t){return this.transformAsPoint(e,t)}transformDirection(e,t){return this.transformAsVector(e,t)}makeRotationX(e){return this.identity().rotateX(e)}makeTranslation(e,t,n){return this.identity().translate([e,t,n])}},Jc,Yc;function Xc(){return Jc||(Jc=new V([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),Object.freeze(Jc)),Jc}function Zc(){return Yc||(Yc=new V,Object.freeze(Yc)),Yc}function Qc(e){if(e>Math.PI*2)throw Error(`expected radians`)}function $c(e,t,n,r,i,a){let o=2*a/(n-t),s=2*a/(i-r),c=(n+t)/(n-t),l=(i+r)/(i-r),u=-2*a;return e[0]=o,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s,e[6]=0,e[7]=0,e[8]=c,e[9]=l,e[10]=-1,e[11]=-1,e[12]=0,e[13]=0,e[14]=u,e[15]=0,e}var el,tl=class e extends ls{static get ZERO(){return el||(el=new e(0,0,0,0),Object.freeze(el)),el}constructor(e=0,t=0,n=0,r=0){super(-0,-0,-0,-0),Jo(e)&&arguments.length===1?this.copy(e):(L.debug&&(R(e),R(t),R(n),R(r)),this[0]=e,this[1]=t,this[2]=n,this[3]=r)}set(e,t,n,r){return this[0]=e,this[1]=t,this[2]=n,this[3]=r,this.check()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this.check()}fromObject(e){return L.debug&&(R(e.x),R(e.y),R(e.z),R(e.w)),this[0]=e.x,this[1]=e.y,this[2]=e.z,this[3]=e.w,this}toObject(e){return e.x=this[0],e.y=this[1],e.z=this[2],e.w=this[3],e}get ELEMENTS(){return 4}get z(){return this[2]}set z(e){this[2]=R(e)}get w(){return this[3]}set w(e){this[3]=R(e)}transform(e){return Rs(this,this,e),this.check()}transformByMatrix3(e){return Ts(this,this,e),this.check()}transformByMatrix2(e){return ws(this,this,e),this.check()}transformByQuaternion(e){return Bs(this,this,e),this.check()}applyMatrix4(e){return e.transform(this,this),this}};function nl(){let e=new us(4);return us!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e[3]=1,e}function rl(e){return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e}function il(e,t,n){n*=.5;let r=Math.sin(n);return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=Math.cos(n),e}function al(e,t,n){let r=t[0],i=t[1],a=t[2],o=t[3],s=n[0],c=n[1],l=n[2],u=n[3];return e[0]=r*u+o*s+i*l-a*c,e[1]=i*u+o*c+a*s-r*l,e[2]=a*u+o*l+r*c-i*s,e[3]=o*u-r*s-i*c-a*l,e}function ol(e,t,n){n*=.5;let r=t[0],i=t[1],a=t[2],o=t[3],s=Math.sin(n),c=Math.cos(n);return e[0]=r*c+o*s,e[1]=i*c+a*s,e[2]=a*c-i*s,e[3]=o*c-r*s,e}function sl(e,t,n){n*=.5;let r=t[0],i=t[1],a=t[2],o=t[3],s=Math.sin(n),c=Math.cos(n);return e[0]=r*c-a*s,e[1]=i*c+o*s,e[2]=a*c+r*s,e[3]=o*c-i*s,e}function cl(e,t,n){n*=.5;let r=t[0],i=t[1],a=t[2],o=t[3],s=Math.sin(n),c=Math.cos(n);return e[0]=r*c+i*s,e[1]=i*c-r*s,e[2]=a*c+o*s,e[3]=o*c-a*s,e}function ll(e,t){let n=t[0],r=t[1],i=t[2];return e[0]=n,e[1]=r,e[2]=i,e[3]=Math.sqrt(Math.abs(1-n*n-r*r-i*i)),e}function ul(e,t,n,r){let i=t[0],a=t[1],o=t[2],s=t[3],c=n[0],l=n[1],u=n[2],d=n[3],f,p,m,h,g;return f=i*c+a*l+o*u+s*d,f<0&&(f=-f,c=-c,l=-l,u=-u,d=-d),1-f>1e-6?(p=Math.acos(f),g=Math.sin(p),m=Math.sin((1-r)*p)/g,h=Math.sin(r*p)/g):(m=1-r,h=r),e[0]=m*i+h*c,e[1]=m*a+h*l,e[2]=m*o+h*u,e[3]=m*s+h*d,e}function dl(e,t){let n=t[0],r=t[1],i=t[2],a=t[3],o=n*n+r*r+i*i+a*a,s=o?1/o:0;return e[0]=-n*s,e[1]=-r*s,e[2]=-i*s,e[3]=a*s,e}function fl(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=t[3],e}function pl(e,t){let n=t[0]+t[4]+t[8],r;if(n>0)r=Math.sqrt(n+1),e[3]=.5*r,r=.5/r,e[0]=(t[5]-t[7])*r,e[1]=(t[6]-t[2])*r,e[2]=(t[1]-t[3])*r;else{let n=0;t[4]>t[0]&&(n=1),t[8]>t[n*3+n]&&(n=2);let i=(n+1)%3,a=(n+2)%3;r=Math.sqrt(t[n*3+n]-t[i*3+i]-t[a*3+a]+1),e[n]=.5*r,r=.5/r,e[3]=(t[i*3+a]-t[a*3+i])*r,e[i]=(t[i*3+n]+t[n*3+i])*r,e[a]=(t[a*3+n]+t[n*3+a])*r}return e}var ml=Nc,hl=Pc,gl=Rc,_l=zc,vl=Fc,yl=Ic,bl=Lc,xl=(function(){let e=Ds(),t=ks(1,0,0),n=ks(0,1,0);return function(r,i,a){let o=Fs(i,a);return o<-.999999?(Is(e,t,i),qs(e)<1e-6&&Is(e,n,i),Ps(e,e),il(r,e,Math.PI),r):o>.999999?(r[0]=0,r[1]=0,r[2]=0,r[3]=1,r):(Is(e,i,a),r[0]=e[0],r[1]=e[1],r[2]=e[2],r[3]=1+o,bl(r,r))}})();(function(){let e=nl(),t=nl();return function(n,r,i,a,o,s){return ul(e,r,o,s),ul(t,i,a,s),ul(n,e,t,2*s*(1-s)),n}})(),(function(){let e=Qs();return function(t,n,r,i){return e[0]=r[0],e[3]=r[1],e[6]=r[2],e[1]=i[0],e[4]=i[1],e[7]=i[2],e[2]=-n[0],e[5]=-n[1],e[8]=-n[2],bl(t,pl(t,e))}})();var Sl=[0,0,0,1],Cl=class extends as{constructor(e=0,t=0,n=0,r=1){super(-0,-0,-0,-0),Array.isArray(e)&&arguments.length===1?this.copy(e):this.set(e,t,n,r)}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this.check()}set(e,t,n,r){return this[0]=e,this[1]=t,this[2]=n,this[3]=r,this.check()}fromObject(e){return this[0]=e.x,this[1]=e.y,this[2]=e.z,this[3]=e.w,this.check()}fromMatrix3(e){return pl(this,e),this.check()}fromAxisRotation(e,t){return il(this,e,t),this.check()}identity(){return rl(this),this.check()}setAxisAngle(e,t){return this.fromAxisRotation(e,t)}get ELEMENTS(){return 4}get x(){return this[0]}set x(e){this[0]=R(e)}get y(){return this[1]}set y(e){this[1]=R(e)}get z(){return this[2]}set z(e){this[2]=R(e)}get w(){return this[3]}set w(e){this[3]=R(e)}len(){return vl(this)}lengthSquared(){return yl(this)}dot(e){return gl(this,e)}rotationTo(e,t){return xl(this,e,t),this.check()}add(e){return ml(this,this,e),this.check()}calculateW(){return ll(this,this),this.check()}conjugate(){return fl(this,this),this.check()}invert(){return dl(this,this),this.check()}lerp(e,t,n){return n===void 0?this.lerp(this,e,t):(_l(this,e,t,n),this.check())}multiplyRight(e){return al(this,this,e),this.check()}multiplyLeft(e){return al(this,e,this),this.check()}normalize(){let e=this.len(),t=e>0?1/e:0;return this[0]*=t,this[1]*=t,this[2]*=t,this[3]*=t,e===0&&(this[3]=1),this.check()}rotateX(e){return ol(this,this,e),this.check()}rotateY(e){return sl(this,this,e),this.check()}rotateZ(e){return cl(this,this,e),this.check()}scale(e){return hl(this,this,e),this.check()}slerp(e,t,n){let r,i,a;switch(arguments.length){case 1:({start:r=Sl,target:i,ratio:a}=e);break;case 2:r=this,i=e,a=t;break;default:r=e,i=t,a=n}return ul(this,r,i,a),this.check()}transformVector4(e,t=new tl){return Vc(t,e,this),ss(t,4)}lengthSq(){return this.lengthSquared()}setFromAxisAngle(e,t){return this.setAxisAngle(e,t)}premultiply(e){return this.multiplyLeft(e)}multiply(e){return this.multiplyRight(e)}},wl=.1,Tl=1e-12,El=1e-15,Dl=1e-20;Math.PI/2,Math.PI/4,Math.PI/6,Math.PI*2;var Ol=20,kl={props:{},uniforms:{},name:`skin`,bindingLayout:[{name:`skin`,group:0}],dependencies:[],source:`
struct skinUniforms {
  jointMatrix: array<mat4x4<f32>, ${Ol}>,
};

@group(0) @binding(auto) var<uniform> skin: skinUniforms;

fn getSkinMatrix(weights: vec4f, joints: vec4u) -> mat4x4<f32> {
  return (weights.x * skin.jointMatrix[joints.x])
       + (weights.y * skin.jointMatrix[joints.y])
       + (weights.z * skin.jointMatrix[joints.z])
       + (weights.w * skin.jointMatrix[joints.w]);
}
`,vs:`
layout(std140) uniform skinUniforms {
  mat4 jointMatrix[SKIN_MAX_JOINTS];
} skin;

mat4 getSkinMatrix(vec4 weights, uvec4 joints) {
  return (weights.x * skin.jointMatrix[joints.x])
       + (weights.y * skin.jointMatrix[joints.y])
       + (weights.z * skin.jointMatrix[joints.z])
       + (weights.w * skin.jointMatrix[joints.w]);
}

`,fs:``,defines:{SKIN_MAX_JOINTS:Ol},getUniforms:(e={},t)=>{let{scenegraphsFromGLTF:n}=e;if(!n?.gltf?.skins?.[0])return{jointMatrix:[]};let{inverseBindMatrices:r,joints:i,skeleton:a}=n.gltf.skins[0],o=[],s=r.value.length/16;for(let e=0;e<s;e++){let t=r.value.subarray(e*16,e*16+16);o.push(new V(Array.from(t)))}let c=n.gltfNodeIndexToNodeMap.get(a),l={};c.preorderTraversal((e,{worldMatrix:t})=>{l[e.id]=t});let u=new Float32Array(Ol*16);for(let e=0;e<Ol;++e){let t=i[e];if(t===void 0)break;let r=l[n.gltfNodeIndexToNodeMap.get(t).id],a=o[e],s=new V().copy(r).multiplyRight(a),c=e*16;for(let e=0;e<16;e++)u[c+e]=s[e]}return{jointMatrix:u}},uniformTypes:{jointMatrix:[`mat4x4<f32>`,Ol]}},Al=`layout(std140) uniform floatColorsUniforms {
  float useByteColors;
} floatColors;

vec3 floatColors_normalize(vec3 inputColor) {
  return floatColors.useByteColors > 0.5 ? inputColor / 255.0 : inputColor;
}

vec4 floatColors_normalize(vec4 inputColor) {
  return floatColors.useByteColors > 0.5 ? inputColor / 255.0 : inputColor;
}

vec4 floatColors_premultiplyAlpha(vec4 inputColor) {
  return vec4(inputColor.rgb * inputColor.a, inputColor.a);
}

vec4 floatColors_unpremultiplyAlpha(vec4 inputColor) {
  return inputColor.a > 0.0 ? vec4(inputColor.rgb / inputColor.a, inputColor.a) : vec4(0.0);
}

vec4 floatColors_premultiply_alpha(vec4 inputColor) {
  return floatColors_premultiplyAlpha(inputColor);
}

vec4 floatColors_unpremultiply_alpha(vec4 inputColor) {
  return floatColors_unpremultiplyAlpha(inputColor);
}
`,jl={name:`floatColors`,props:{},uniforms:{},vs:Al,fs:Al,source:`struct floatColorsUniforms {
  useByteColors: f32
};

@group(0) @binding(auto) var<uniform> floatColors : floatColorsUniforms;

fn floatColors_normalize(inputColor: vec3<f32>) -> vec3<f32> {
  return select(inputColor, inputColor / 255.0, floatColors.useByteColors > 0.5);
}

fn floatColors_normalize4(inputColor: vec4<f32>) -> vec4<f32> {
  return select(inputColor, inputColor / 255.0, floatColors.useByteColors > 0.5);
}

fn floatColors_premultiplyAlpha(inputColor: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(inputColor.rgb * inputColor.a, inputColor.a);
}

fn floatColors_unpremultiplyAlpha(inputColor: vec4<f32>) -> vec4<f32> {
  return select(
    vec4<f32>(0.0),
    vec4<f32>(inputColor.rgb / inputColor.a, inputColor.a),
    inputColor.a > 0.0
  );
}

fn floatColors_premultiply_alpha(inputColor: vec4<f32>) -> vec4<f32> {
  return floatColors_premultiplyAlpha(inputColor);
}

fn floatColors_unpremultiply_alpha(inputColor: vec4<f32>) -> vec4<f32> {
  return floatColors_unpremultiplyAlpha(inputColor);
}
`,uniformTypes:{useByteColors:`f32`},defaultUniforms:{useByteColors:!0}},Ml=`precision highp int;

// #if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))
struct AmbientLight {
  vec3 color;
};

struct PointLight {
  vec3 color;
  vec3 position;
  vec3 attenuation; // 2nd order x:Constant-y:Linear-z:Exponential
};

struct SpotLight {
  vec3 color;
  vec3 position;
  vec3 direction;
  vec3 attenuation;
  vec2 coneCos;
};

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

struct UniformLight {
  vec3 color;
  vec3 position;
  vec3 direction;
  vec3 attenuation;
  vec2 coneCos;
};

layout(std140) uniform lightingUniforms {
  int enabled;
  int directionalLightCount;
  int pointLightCount;
  int spotLightCount;
  vec3 ambientColor;
  UniformLight lights[5];
} lighting;

PointLight lighting_getPointLight(int index) {
  UniformLight light = lighting.lights[index];
  return PointLight(light.color, light.position, light.attenuation);
}

SpotLight lighting_getSpotLight(int index) {
  UniformLight light = lighting.lights[lighting.pointLightCount + index];
  return SpotLight(light.color, light.position, light.direction, light.attenuation, light.coneCos);
}

DirectionalLight lighting_getDirectionalLight(int index) {
  UniformLight light =
    lighting.lights[lighting.pointLightCount + lighting.spotLightCount + index];
  return DirectionalLight(light.color, light.direction);
}

float getPointLightAttenuation(PointLight pointLight, float distance) {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

float getSpotLightAttenuation(SpotLight spotLight, vec3 positionWorldspace) {
  vec3 light_direction = normalize(positionWorldspace - spotLight.position);
  float coneFactor = smoothstep(
    spotLight.coneCos.y,
    spotLight.coneCos.x,
    dot(normalize(spotLight.direction), light_direction)
  );
  float distanceAttenuation = getPointLightAttenuation(
    PointLight(spotLight.color, spotLight.position, spotLight.attenuation),
    distance(spotLight.position, positionWorldspace)
  );
  return distanceAttenuation / max(coneFactor, 0.0001);
}

// #endif
`,Nl=`// #if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))
const MAX_LIGHTS: i32 = 5;

struct AmbientLight {
  color: vec3<f32>,
};

struct PointLight {
  color: vec3<f32>,
  position: vec3<f32>,
  attenuation: vec3<f32>, // 2nd order x:Constant-y:Linear-z:Exponential
};

struct SpotLight {
  color: vec3<f32>,
  position: vec3<f32>,
  direction: vec3<f32>,
  attenuation: vec3<f32>,
  coneCos: vec2<f32>,
};

struct DirectionalLight {
  color: vec3<f32>,
  direction: vec3<f32>,
};

struct UniformLight {
  color: vec3<f32>,
  position: vec3<f32>,
  direction: vec3<f32>,
  attenuation: vec3<f32>,
  coneCos: vec2<f32>,
};

struct lightingUniforms {
  enabled: i32,
  directionalLightCount: i32,
  pointLightCount: i32,
  spotLightCount: i32,
  ambientColor: vec3<f32>,
  lights: array<UniformLight, 5>,
};

@group(2) @binding(auto) var<uniform> lighting : lightingUniforms;

fn lighting_getPointLight(index: i32) -> PointLight {
  let light = lighting.lights[index];
  return PointLight(light.color, light.position, light.attenuation);
}

fn lighting_getSpotLight(index: i32) -> SpotLight {
  let light = lighting.lights[lighting.pointLightCount + index];
  return SpotLight(light.color, light.position, light.direction, light.attenuation, light.coneCos);
}

fn lighting_getDirectionalLight(index: i32) -> DirectionalLight {
  let light = lighting.lights[lighting.pointLightCount + lighting.spotLightCount + index];
  return DirectionalLight(light.color, light.direction);
}

fn getPointLightAttenuation(pointLight: PointLight, distance: f32) -> f32 {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

fn getSpotLightAttenuation(spotLight: SpotLight, positionWorldspace: vec3<f32>) -> f32 {
  let lightDirection = normalize(positionWorldspace - spotLight.position);
  let coneFactor = smoothstep(
    spotLight.coneCos.y,
    spotLight.coneCos.x,
    dot(normalize(spotLight.direction), lightDirection)
  );
  let distanceAttenuation = getPointLightAttenuation(
    PointLight(spotLight.color, spotLight.position, spotLight.attenuation),
    distance(spotLight.position, positionWorldspace)
  );
  return distanceAttenuation / max(coneFactor, 0.0001);
}
`,Pl=5,Fl={props:{},uniforms:{},name:`lighting`,defines:{},uniformTypes:{enabled:`i32`,directionalLightCount:`i32`,pointLightCount:`i32`,spotLightCount:`i32`,ambientColor:`vec3<f32>`,lights:[{color:`vec3<f32>`,position:`vec3<f32>`,direction:`vec3<f32>`,attenuation:`vec3<f32>`,coneCos:`vec2<f32>`},Pl]},defaultUniforms:Bl(),bindingLayout:[{name:`lighting`,group:2}],firstBindingSlot:0,source:Nl,vs:Ml,fs:Ml,getUniforms:Il};function Il(e,t={}){if(e&&={...e},!e)return Bl();e.lights&&(e={...e,...Rl(e.lights),lights:void 0});let{useByteColors:n,ambientLight:r,pointLights:i,spotLights:a,directionalLights:o}=e||{};if(!(r||i&&i.length>0||a&&a.length>0||o&&o.length>0))return{...Bl(),enabled:0};let s={...Bl(),...Ll({useByteColors:n,ambientLight:r,pointLights:i,spotLights:a,directionalLights:o})};return e.enabled!==void 0&&(s.enabled=+!!e.enabled),s}function Ll({useByteColors:e,ambientLight:t,pointLights:n=[],spotLights:r=[],directionalLights:i=[]}){let a=Vl(),o=0,s=0,c=0,l=0;for(let t of n){if(o>=Pl)break;a[o]={...a[o],color:zl(t,e),position:t.position,attenuation:t.attenuation||[1,0,0]},o++,s++}for(let t of r){if(o>=Pl)break;a[o]={...a[o],color:zl(t,e),position:t.position,direction:t.direction,attenuation:t.attenuation||[1,0,0],coneCos:Ul(t)},o++,c++}for(let t of i){if(o>=Pl)break;a[o]={...a[o],color:zl(t,e),direction:t.direction},o++,l++}return n.length+r.length+i.length>Pl&&M.warn(`MAX_LIGHTS exceeded, truncating to ${Pl}`)(),{ambientColor:zl(t,e),directionalLightCount:l,pointLightCount:s,spotLightCount:c,lights:a}}function Rl(e){let t={pointLights:[],spotLights:[],directionalLights:[]};for(let n of e||[])switch(n.type){case`ambient`:t.ambientLight=n;break;case`directional`:t.directionalLights?.push(n);break;case`point`:t.pointLights?.push(n);break;case`spot`:t.spotLights?.push(n);break;default:}return t}function zl(e={},t){let{color:n=[0,0,0],intensity:r=1}=e;return Fo(n,Po(t,!0)).map(e=>e*r)}function Bl(){return{enabled:1,directionalLightCount:0,pointLightCount:0,spotLightCount:0,ambientColor:[.1,.1,.1],lights:Vl()}}function Vl(){return Array.from({length:Pl},()=>Hl())}function Hl(){return{color:[1,1,1],position:[1,1,2],direction:[1,1,1],attenuation:[1,0,0],coneCos:[1,0]}}function Ul(e){let t=e.innerConeAngle??0,n=e.outerConeAngle??Math.PI/4;return[Math.cos(t),Math.cos(n)]}var Wl=`layout(std140) uniform phongMaterialUniforms {
  uniform bool unlit;
  uniform float ambient;
  uniform float diffuse;
  uniform float shininess;
  uniform vec3  specularColor;
} material;
`,Gl=`layout(std140) uniform phongMaterialUniforms {
  uniform bool unlit;
  uniform float ambient;
  uniform float diffuse;
  uniform float shininess;
  uniform vec3  specularColor;
} material;

vec3 lighting_getLightColor(vec3 surfaceColor, vec3 light_direction, vec3 view_direction, vec3 normal_worldspace, vec3 color) {
  vec3 halfway_direction = normalize(light_direction + view_direction);
  float lambertian = dot(light_direction, normal_worldspace);
  float specular = 0.0;
  if (lambertian > 0.0) {
    float specular_angle = max(dot(normal_worldspace, halfway_direction), 0.0);
    specular = pow(specular_angle, material.shininess);
  }
  lambertian = max(lambertian, 0.0);
  return (lambertian * material.diffuse * surfaceColor + specular * floatColors_normalize(material.specularColor)) * color;
}

vec3 lighting_getLightColor(vec3 surfaceColor, vec3 cameraPosition, vec3 position_worldspace, vec3 normal_worldspace) {
  vec3 lightColor = surfaceColor;

  if (material.unlit) {
    return surfaceColor;
  }

  if (lighting.enabled == 0) {
    return lightColor;
  }

  vec3 view_direction = normalize(cameraPosition - position_worldspace);
  lightColor = material.ambient * surfaceColor * lighting.ambientColor;

  for (int i = 0; i < lighting.pointLightCount; i++) {
    PointLight pointLight = lighting_getPointLight(i);
    vec3 light_position_worldspace = pointLight.position;
    vec3 light_direction = normalize(light_position_worldspace - position_worldspace);
    float light_attenuation = getPointLightAttenuation(pointLight, distance(light_position_worldspace, position_worldspace));
    lightColor += lighting_getLightColor(surfaceColor, light_direction, view_direction, normal_worldspace, pointLight.color / light_attenuation);
  }

  for (int i = 0; i < lighting.spotLightCount; i++) {
    SpotLight spotLight = lighting_getSpotLight(i);
    vec3 light_position_worldspace = spotLight.position;
    vec3 light_direction = normalize(light_position_worldspace - position_worldspace);
    float light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
    lightColor += lighting_getLightColor(surfaceColor, light_direction, view_direction, normal_worldspace, spotLight.color / light_attenuation);
  }

  for (int i = 0; i < lighting.directionalLightCount; i++) {
    DirectionalLight directionalLight = lighting_getDirectionalLight(i);
    lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
  }
  
  return lightColor;
}
`,Kl=`struct phongMaterialUniforms {
  unlit: u32,
  ambient: f32,
  diffuse: f32,
  shininess: f32,
  specularColor: vec3<f32>,
};

@group(3) @binding(auto) var<uniform> phongMaterial : phongMaterialUniforms;

fn lighting_getLightColor(surfaceColor: vec3<f32>, light_direction: vec3<f32>, view_direction: vec3<f32>, normal_worldspace: vec3<f32>, color: vec3<f32>) -> vec3<f32> {
  let halfway_direction: vec3<f32> = normalize(light_direction + view_direction);
  var lambertian: f32 = dot(light_direction, normal_worldspace);
  var specular: f32 = 0.0;
  if (lambertian > 0.0) {
    let specular_angle = max(dot(normal_worldspace, halfway_direction), 0.0);
    specular = pow(specular_angle, phongMaterial.shininess);
  }
  lambertian = max(lambertian, 0.0);
  return (
    lambertian * phongMaterial.diffuse * surfaceColor +
    specular * floatColors_normalize(phongMaterial.specularColor)
  ) * color;
}

fn lighting_getLightColor2(surfaceColor: vec3<f32>, cameraPosition: vec3<f32>, position_worldspace: vec3<f32>, normal_worldspace: vec3<f32>) -> vec3<f32> {
  var lightColor: vec3<f32> = surfaceColor;

  if (phongMaterial.unlit != 0u) {
    return surfaceColor;
  }

  if (lighting.enabled == 0) {
    return lightColor;
  }

  let view_direction: vec3<f32> = normalize(cameraPosition - position_worldspace);
  lightColor = phongMaterial.ambient * surfaceColor * lighting.ambientColor;

  for (var i: i32 = 0; i < lighting.pointLightCount; i++) {
    let pointLight: PointLight = lighting_getPointLight(i);
    let light_position_worldspace: vec3<f32> = pointLight.position;
    let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
    let light_attenuation = getPointLightAttenuation(
      pointLight,
      distance(light_position_worldspace, position_worldspace)
    );
    lightColor += lighting_getLightColor(
      surfaceColor,
      light_direction,
      view_direction,
      normal_worldspace,
      pointLight.color / light_attenuation
    );
  }

  for (var i: i32 = 0; i < lighting.spotLightCount; i++) {
    let spotLight: SpotLight = lighting_getSpotLight(i);
    let light_position_worldspace: vec3<f32> = spotLight.position;
    let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
    let light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
    lightColor += lighting_getLightColor(
      surfaceColor,
      light_direction,
      view_direction,
      normal_worldspace,
      spotLight.color / light_attenuation
    );
  }

  for (var i: i32 = 0; i < lighting.directionalLightCount; i++) {
    let directionalLight: DirectionalLight = lighting_getDirectionalLight(i);
    lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
  }  
  
  return lightColor;
}

fn lighting_getSpecularLightColor(cameraPosition: vec3<f32>, position_worldspace: vec3<f32>, normal_worldspace: vec3<f32>) -> vec3<f32>{
  var lightColor = vec3<f32>(0, 0, 0);
  let surfaceColor = vec3<f32>(0, 0, 0);

  if (lighting.enabled != 0) {
    let view_direction = normalize(cameraPosition - position_worldspace);

    for (var i: i32 = 0; i < lighting.pointLightCount; i++) {
      let pointLight: PointLight = lighting_getPointLight(i);
      let light_position_worldspace: vec3<f32> = pointLight.position;
      let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
      let light_attenuation = getPointLightAttenuation(
        pointLight,
        distance(light_position_worldspace, position_worldspace)
      );
      lightColor += lighting_getLightColor(
        surfaceColor,
        light_direction,
        view_direction,
        normal_worldspace,
        pointLight.color / light_attenuation
      );
    }

    for (var i: i32 = 0; i < lighting.spotLightCount; i++) {
      let spotLight: SpotLight = lighting_getSpotLight(i);
      let light_position_worldspace: vec3<f32> = spotLight.position;
      let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
      let light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
      lightColor += lighting_getLightColor(
        surfaceColor,
        light_direction,
        view_direction,
        normal_worldspace,
        spotLight.color / light_attenuation
      );
    }

    for (var i: i32 = 0; i < lighting.directionalLightCount; i++) {
        let directionalLight: DirectionalLight = lighting_getDirectionalLight(i);
        lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
    }
  }
  return lightColor;
}
`,ql={props:{},name:`gouraudMaterial`,bindingLayout:[{name:`gouraudMaterial`,group:3}],vs:Gl.replace(`phongMaterial`,`gouraudMaterial`),fs:Wl.replace(`phongMaterial`,`gouraudMaterial`),source:Kl.replaceAll(`phongMaterial`,`gouraudMaterial`),defines:{LIGHTING_VERTEX:!0},dependencies:[Fl,jl],uniformTypes:{unlit:`i32`,ambient:`f32`,diffuse:`f32`,shininess:`f32`,specularColor:`vec3<f32>`},defaultUniforms:{unlit:!1,ambient:.35,diffuse:.6,shininess:32,specularColor:[38.25,38.25,38.25]},getUniforms(e){return{...ql.defaultUniforms,...e}}},Jl={name:`phongMaterial`,firstBindingSlot:0,bindingLayout:[{name:`phongMaterial`,group:3}],dependencies:[Fl,jl],source:Kl,vs:Wl,fs:Gl,defines:{LIGHTING_FRAGMENT:!0},uniformTypes:{unlit:`i32`,ambient:`f32`,diffuse:`f32`,shininess:`f32`,specularColor:`vec3<f32>`},defaultUniforms:{unlit:!1,ambient:.35,diffuse:.6,shininess:32,specularColor:[38.25,38.25,38.25]},getUniforms(e){return{...Jl.defaultUniforms,...e}}},Yl=`#ifdef USE_IBL
@group(2) @binding(auto) var pbr_diffuseEnvSampler: texture_cube<f32>;
@group(2) @binding(auto) var pbr_diffuseEnvSamplerSampler: sampler;
@group(2) @binding(auto) var pbr_specularEnvSampler: texture_cube<f32>;
@group(2) @binding(auto) var pbr_specularEnvSamplerSampler: sampler;
@group(2) @binding(auto) var pbr_brdfLUT: texture_2d<f32>;
@group(2) @binding(auto) var pbr_brdfLUTSampler: sampler;
#endif
`,Xl=`#ifdef USE_IBL
uniform samplerCube pbr_diffuseEnvSampler;
uniform samplerCube pbr_specularEnvSampler;
uniform sampler2D pbr_brdfLUT;
#endif
`,Zl={name:`ibl`,firstBindingSlot:32,bindingLayout:[{name:`pbr_diffuseEnvSampler`,group:2},{name:`pbr_specularEnvSampler`,group:2},{name:`pbr_brdfLUT`,group:2}],source:Yl,vs:Xl,fs:Xl},Ql=`out vec3 pbr_vPosition;
out vec2 pbr_vUV0;
out vec2 pbr_vUV1;

#ifdef HAS_NORMALS
# ifdef HAS_TANGENTS
out mat3 pbr_vTBN;
# else
out vec3 pbr_vNormal;
# endif
#endif

void pbr_setPositionNormalTangentUV(
  vec4 position,
  vec4 normal,
  vec4 tangent,
  vec2 uv0,
  vec2 uv1
)
{
  vec4 pos = pbrProjection.modelMatrix * position;
  pbr_vPosition = vec3(pos.xyz) / pos.w;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
  vec3 normalW = normalize(vec3(pbrProjection.normalMatrix * vec4(normal.xyz, 0.0)));
  vec3 tangentW = normalize(vec3(pbrProjection.modelMatrix * vec4(tangent.xyz, 0.0)));
  vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
  pbr_vTBN = mat3(tangentW, bitangentW, normalW);
#else // HAS_TANGENTS != 1
  pbr_vNormal = normalize(vec3(pbrProjection.modelMatrix * vec4(normal.xyz, 0.0)));
#endif
#endif

#ifdef HAS_UV
  pbr_vUV0 = uv0;
#else
  pbr_vUV0 = vec2(0.,0.);
#endif

  pbr_vUV1 = uv1;
}
`,$l=`precision highp float;

layout(std140) uniform pbrMaterialUniforms {
  // Material is unlit
  bool unlit;

  // Base color map
  bool baseColorMapEnabled;
  vec4 baseColorFactor;

  bool normalMapEnabled;  
  float normalScale; // #ifdef HAS_NORMALMAP

  bool emissiveMapEnabled;
  vec3 emissiveFactor; // #ifdef HAS_EMISSIVEMAP

  vec2 metallicRoughnessValues;
  bool metallicRoughnessMapEnabled;

  bool occlusionMapEnabled;
  float occlusionStrength; // #ifdef HAS_OCCLUSIONMAP
  
  bool alphaCutoffEnabled;
  float alphaCutoff; // #ifdef ALPHA_CUTOFF

  vec3 specularColorFactor;
  float specularIntensityFactor;
  bool specularColorMapEnabled;
  bool specularIntensityMapEnabled;

  float ior;

  float transmissionFactor;
  bool transmissionMapEnabled;

  float thicknessFactor;
  float attenuationDistance;
  vec3 attenuationColor;

  float clearcoatFactor;
  float clearcoatRoughnessFactor;
  bool clearcoatMapEnabled;
  bool clearcoatRoughnessMapEnabled;

  vec3 sheenColorFactor;
  float sheenRoughnessFactor;
  bool sheenColorMapEnabled;
  bool sheenRoughnessMapEnabled;

  float iridescenceFactor;
  float iridescenceIor;
  vec2 iridescenceThicknessRange;
  bool iridescenceMapEnabled;

  float anisotropyStrength;
  float anisotropyRotation;
  vec2 anisotropyDirection;
  bool anisotropyMapEnabled;

  float emissiveStrength;
  
  // IBL
  bool IBLenabled;
  vec2 scaleIBLAmbient; // #ifdef USE_IBL
  
  // debugging flags used for shader output of intermediate PBR variables
  // #ifdef PBR_DEBUG
  vec4 scaleDiffBaseMR;
  vec4 scaleFGDSpec;
  // #endif

  int baseColorUVSet;
  mat3 baseColorUVTransform;
  int metallicRoughnessUVSet;
  mat3 metallicRoughnessUVTransform;
  int normalUVSet;
  mat3 normalUVTransform;
  int occlusionUVSet;
  mat3 occlusionUVTransform;
  int emissiveUVSet;
  mat3 emissiveUVTransform;
  int specularColorUVSet;
  mat3 specularColorUVTransform;
  int specularIntensityUVSet;
  mat3 specularIntensityUVTransform;
  int transmissionUVSet;
  mat3 transmissionUVTransform;
  int thicknessUVSet;
  mat3 thicknessUVTransform;
  int clearcoatUVSet;
  mat3 clearcoatUVTransform;
  int clearcoatRoughnessUVSet;
  mat3 clearcoatRoughnessUVTransform;
  int clearcoatNormalUVSet;
  mat3 clearcoatNormalUVTransform;
  int sheenColorUVSet;
  mat3 sheenColorUVTransform;
  int sheenRoughnessUVSet;
  mat3 sheenRoughnessUVTransform;
  int iridescenceUVSet;
  mat3 iridescenceUVTransform;
  int iridescenceThicknessUVSet;
  mat3 iridescenceThicknessUVTransform;
  int anisotropyUVSet;
  mat3 anisotropyUVTransform;
} pbrMaterial;

// Samplers
#ifdef HAS_BASECOLORMAP
uniform sampler2D pbr_baseColorSampler;
#endif
#ifdef HAS_NORMALMAP
uniform sampler2D pbr_normalSampler;
#endif
#ifdef HAS_EMISSIVEMAP
uniform sampler2D pbr_emissiveSampler;
#endif
#ifdef HAS_METALROUGHNESSMAP
uniform sampler2D pbr_metallicRoughnessSampler;
#endif
#ifdef HAS_OCCLUSIONMAP
uniform sampler2D pbr_occlusionSampler;
#endif
#ifdef HAS_SPECULARCOLORMAP
uniform sampler2D pbr_specularColorSampler;
#endif
#ifdef HAS_SPECULARINTENSITYMAP
uniform sampler2D pbr_specularIntensitySampler;
#endif
#ifdef HAS_TRANSMISSIONMAP
uniform sampler2D pbr_transmissionSampler;
#endif
#ifdef HAS_THICKNESSMAP
uniform sampler2D pbr_thicknessSampler;
#endif
#ifdef HAS_CLEARCOATMAP
uniform sampler2D pbr_clearcoatSampler;
#endif
#ifdef HAS_CLEARCOATROUGHNESSMAP
uniform sampler2D pbr_clearcoatRoughnessSampler;
#endif
#ifdef HAS_CLEARCOATNORMALMAP
uniform sampler2D pbr_clearcoatNormalSampler;
#endif
#ifdef HAS_SHEENCOLORMAP
uniform sampler2D pbr_sheenColorSampler;
#endif
#ifdef HAS_SHEENROUGHNESSMAP
uniform sampler2D pbr_sheenRoughnessSampler;
#endif
#ifdef HAS_IRIDESCENCEMAP
uniform sampler2D pbr_iridescenceSampler;
#endif
#ifdef HAS_IRIDESCENCETHICKNESSMAP
uniform sampler2D pbr_iridescenceThicknessSampler;
#endif
#ifdef HAS_ANISOTROPYMAP
uniform sampler2D pbr_anisotropySampler;
#endif
// Inputs from vertex shader

in vec3 pbr_vPosition;
in vec2 pbr_vUV0;
in vec2 pbr_vUV1;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
in mat3 pbr_vTBN;
#else
in vec3 pbr_vNormal;
#endif
#endif

// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo {
  float NdotL;                  // cos angle between normal and light direction
  float NdotV;                  // cos angle between normal and view direction
  float NdotH;                  // cos angle between normal and half vector
  float LdotH;                  // cos angle between light direction and half vector
  float VdotH;                  // cos angle between view direction and half vector
  float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
  float metalness;              // metallic value at the surface
  vec3 reflectance0;            // full reflectance color (normal incidence angle)
  vec3 reflectance90;           // reflectance color at grazing angle
  float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
  vec3 diffuseColor;            // color contribution from diffuse lighting
  vec3 specularColor;           // color contribution from specular lighting
  vec3 n;                       // normal at surface point
  vec3 v;                       // vector from surface point to camera
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;

vec3 calculateFinalColor(PBRInfo pbrInfo, vec3 lightColor);

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
#ifdef MANUAL_SRGB
#ifdef SRGB_FAST_APPROXIMATION
  vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
#else // SRGB_FAST_APPROXIMATION
  vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
  vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
#endif //SRGB_FAST_APPROXIMATION
  return vec4(linOut,srgbIn.w);;
#else //MANUAL_SRGB
  return srgbIn;
#endif //MANUAL_SRGB
}

vec2 getMaterialUV(int uvSet, mat3 uvTransform)
{
  vec2 baseUV = uvSet == 1 ? pbr_vUV1 : pbr_vUV0;
  return (uvTransform * vec3(baseUV, 1.0)).xy;
}

// Build the tangent basis from interpolated attributes or screen-space derivatives.
mat3 getTBN(vec2 uv)
{
#ifndef HAS_TANGENTS
  vec3 pos_dx = dFdx(pbr_vPosition);
  vec3 pos_dy = dFdy(pbr_vPosition);
  vec3 tex_dx = dFdx(vec3(uv, 0.0));
  vec3 tex_dy = dFdy(vec3(uv, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
  vec3 ng = normalize(pbr_vNormal);
#else
  vec3 ng = cross(pos_dx, pos_dy);
#endif

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);
#else // HAS_TANGENTS
  mat3 tbn = pbr_vTBN;
#endif

  return tbn;
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getMappedNormal(sampler2D normalSampler, mat3 tbn, float normalScale, vec2 uv)
{
  vec3 n = texture(normalSampler, uv).rgb;
  return normalize(tbn * ((2.0 * n - 1.0) * vec3(normalScale, normalScale, 1.0)));
}

vec3 getNormal(mat3 tbn, vec2 uv)
{
#ifdef HAS_NORMALMAP
  vec3 n = getMappedNormal(pbr_normalSampler, tbn, pbrMaterial.normalScale, uv);
#else
  // The tbn matrix is linearly interpolated, so we need to re-normalize
  vec3 n = normalize(tbn[2].xyz);
#endif

  return n;
}

vec3 getClearcoatNormal(mat3 tbn, vec3 baseNormal, vec2 uv)
{
#ifdef HAS_CLEARCOATNORMALMAP
  return getMappedNormal(pbr_clearcoatNormalSampler, tbn, 1.0, uv);
#else
  return baseNormal;
#endif
}

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
#ifdef USE_IBL
vec3 getIBLContribution(PBRInfo pbrInfo, vec3 n, vec3 reflection)
{
  float mipCount = 9.0; // resolution of 512x512
  float lod = (pbrInfo.perceptualRoughness * mipCount);
  // retrieve a scale and bias to F0. See [1], Figure 3
  vec3 brdf = SRGBtoLINEAR(texture(pbr_brdfLUT,
    vec2(pbrInfo.NdotV, 1.0 - pbrInfo.perceptualRoughness))).rgb;
  vec3 diffuseLight = SRGBtoLINEAR(texture(pbr_diffuseEnvSampler, n)).rgb;

#ifdef USE_TEX_LOD
  vec3 specularLight = SRGBtoLINEAR(texture(pbr_specularEnvSampler, reflection, lod)).rgb;
#else
  vec3 specularLight = SRGBtoLINEAR(texture(pbr_specularEnvSampler, reflection)).rgb;
#endif

  vec3 diffuse = diffuseLight * pbrInfo.diffuseColor;
  vec3 specular = specularLight * (pbrInfo.specularColor * brdf.x + brdf.y);

  // For presentation, this allows us to disable IBL terms
  diffuse *= pbrMaterial.scaleIBLAmbient.x;
  specular *= pbrMaterial.scaleIBLAmbient.y;

  return diffuse + specular;
}
#endif

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
vec3 diffuse(PBRInfo pbrInfo)
{
  return pbrInfo.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 specularReflection(PBRInfo pbrInfo)
{
  return pbrInfo.reflectance0 +
    (pbrInfo.reflectance90 - pbrInfo.reflectance0) *
    pow(clamp(1.0 - pbrInfo.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
float geometricOcclusion(PBRInfo pbrInfo)
{
  float NdotL = pbrInfo.NdotL;
  float NdotV = pbrInfo.NdotV;
  float r = pbrInfo.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across
// the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface
// for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes
// from EPIC Games [1], Equation 3.
float microfacetDistribution(PBRInfo pbrInfo)
{
  float roughnessSq = pbrInfo.alphaRoughness * pbrInfo.alphaRoughness;
  float f = (pbrInfo.NdotH * roughnessSq - pbrInfo.NdotH) * pbrInfo.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

float maxComponent(vec3 value)
{
  return max(max(value.r, value.g), value.b);
}

float getDielectricF0(float ior)
{
  float clampedIor = max(ior, 1.0);
  float ratio = (clampedIor - 1.0) / (clampedIor + 1.0);
  return ratio * ratio;
}

vec2 normalizeDirection(vec2 direction)
{
  float directionLength = length(direction);
  return directionLength > 0.0001 ? direction / directionLength : vec2(1.0, 0.0);
}

vec2 rotateDirection(vec2 direction, float rotation)
{
  float s = sin(rotation);
  float c = cos(rotation);
  return vec2(direction.x * c - direction.y * s, direction.x * s + direction.y * c);
}

vec3 getIridescenceTint(float iridescence, float thickness, float NdotV)
{
  if (iridescence <= 0.0) {
    return vec3(1.0);
  }

  float phase = 0.015 * thickness * pbrMaterial.iridescenceIor + (1.0 - NdotV) * 6.0;
  vec3 thinFilmTint =
    0.5 + 0.5 * cos(vec3(phase, phase + 2.0943951, phase + 4.1887902));
  return mix(vec3(1.0), thinFilmTint, iridescence);
}

vec3 getVolumeAttenuation(float thickness)
{
  if (thickness <= 0.0) {
    return vec3(1.0);
  }

  vec3 attenuationCoefficient =
    -log(max(pbrMaterial.attenuationColor, vec3(0.0001))) /
    max(pbrMaterial.attenuationDistance, 0.0001);
  return exp(-attenuationCoefficient * thickness);
}

PBRInfo createClearcoatPBRInfo(PBRInfo basePBRInfo, vec3 clearcoatNormal, float clearcoatRoughness)
{
  float perceptualRoughness = clamp(clearcoatRoughness, c_MinRoughness, 1.0);
  float alphaRoughness = perceptualRoughness * perceptualRoughness;
  float NdotV = clamp(abs(dot(clearcoatNormal, basePBRInfo.v)), 0.001, 1.0);

  return PBRInfo(
    basePBRInfo.NdotL,
    NdotV,
    basePBRInfo.NdotH,
    basePBRInfo.LdotH,
    basePBRInfo.VdotH,
    perceptualRoughness,
    0.0,
    vec3(0.04),
    vec3(1.0),
    alphaRoughness,
    vec3(0.0),
    vec3(0.04),
    clearcoatNormal,
    basePBRInfo.v
  );
}

vec3 calculateClearcoatContribution(
  PBRInfo pbrInfo,
  vec3 lightColor,
  vec3 clearcoatNormal,
  float clearcoatFactor,
  float clearcoatRoughness
) {
  if (clearcoatFactor <= 0.0) {
    return vec3(0.0);
  }

  PBRInfo clearcoatPBRInfo = createClearcoatPBRInfo(pbrInfo, clearcoatNormal, clearcoatRoughness);
  return calculateFinalColor(clearcoatPBRInfo, lightColor) * clearcoatFactor;
}

#ifdef USE_IBL
vec3 calculateClearcoatIBLContribution(
  PBRInfo pbrInfo,
  vec3 clearcoatNormal,
  vec3 reflection,
  float clearcoatFactor,
  float clearcoatRoughness
) {
  if (clearcoatFactor <= 0.0) {
    return vec3(0.0);
  }

  PBRInfo clearcoatPBRInfo = createClearcoatPBRInfo(pbrInfo, clearcoatNormal, clearcoatRoughness);
  return getIBLContribution(clearcoatPBRInfo, clearcoatNormal, reflection) * clearcoatFactor;
}
#endif

vec3 calculateSheenContribution(
  PBRInfo pbrInfo,
  vec3 lightColor,
  vec3 sheenColor,
  float sheenRoughness
) {
  if (maxComponent(sheenColor) <= 0.0) {
    return vec3(0.0);
  }

  float sheenFresnel = pow(clamp(1.0 - pbrInfo.VdotH, 0.0, 1.0), 5.0);
  float sheenVisibility = mix(1.0, pbrInfo.NdotL * pbrInfo.NdotV, sheenRoughness);
  return pbrInfo.NdotL *
    lightColor *
    sheenColor *
    (0.25 + 0.75 * sheenFresnel) *
    sheenVisibility *
    (1.0 - pbrInfo.metalness);
}

float calculateAnisotropyBoost(
  PBRInfo pbrInfo,
  vec3 anisotropyTangent,
  float anisotropyStrength
) {
  if (anisotropyStrength <= 0.0) {
    return 1.0;
  }

  vec3 anisotropyBitangent = normalize(cross(pbrInfo.n, anisotropyTangent));
  float bitangentViewAlignment = abs(dot(pbrInfo.v, anisotropyBitangent));
  return mix(1.0, 0.65 + 0.7 * bitangentViewAlignment, anisotropyStrength);
}

vec3 calculateMaterialLightColor(
  PBRInfo pbrInfo,
  vec3 lightColor,
  vec3 clearcoatNormal,
  float clearcoatFactor,
  float clearcoatRoughness,
  vec3 sheenColor,
  float sheenRoughness,
  vec3 anisotropyTangent,
  float anisotropyStrength
) {
  float anisotropyBoost = calculateAnisotropyBoost(pbrInfo, anisotropyTangent, anisotropyStrength);
  vec3 color = calculateFinalColor(pbrInfo, lightColor) * anisotropyBoost;
  color += calculateClearcoatContribution(
    pbrInfo,
    lightColor,
    clearcoatNormal,
    clearcoatFactor,
    clearcoatRoughness
  );
  color += calculateSheenContribution(pbrInfo, lightColor, sheenColor, sheenRoughness);
  return color;
}

void PBRInfo_setAmbientLight(inout PBRInfo pbrInfo) {
  pbrInfo.NdotL = 1.0;
  pbrInfo.NdotH = 0.0;
  pbrInfo.LdotH = 0.0;
  pbrInfo.VdotH = 1.0;
}

void PBRInfo_setDirectionalLight(inout PBRInfo pbrInfo, vec3 lightDirection) {
  vec3 n = pbrInfo.n;
  vec3 v = pbrInfo.v;
  vec3 l = normalize(lightDirection);             // Vector from surface point to light
  vec3 h = normalize(l+v);                        // Half vector between both l and v

  pbrInfo.NdotL = clamp(dot(n, l), 0.001, 1.0);
  pbrInfo.NdotH = clamp(dot(n, h), 0.0, 1.0);
  pbrInfo.LdotH = clamp(dot(l, h), 0.0, 1.0);
  pbrInfo.VdotH = clamp(dot(v, h), 0.0, 1.0);
}

void PBRInfo_setPointLight(inout PBRInfo pbrInfo, PointLight pointLight) {
  vec3 light_direction = normalize(pointLight.position - pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInfo, light_direction);
}

void PBRInfo_setSpotLight(inout PBRInfo pbrInfo, SpotLight spotLight) {
  vec3 light_direction = normalize(spotLight.position - pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInfo, light_direction);
}

vec3 calculateFinalColor(PBRInfo pbrInfo, vec3 lightColor) {
  // Calculate the shading terms for the microfacet specular shading model
  vec3 F = specularReflection(pbrInfo);
  float G = geometricOcclusion(pbrInfo);
  float D = microfacetDistribution(pbrInfo);

  // Calculation of analytical lighting contribution
  vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInfo);
  vec3 specContrib = F * G * D / (4.0 * pbrInfo.NdotL * pbrInfo.NdotV);
  // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
  return pbrInfo.NdotL * lightColor * (diffuseContrib + specContrib);
}

vec4 pbr_filterColor(vec4 colorUnused)
{
  vec2 baseColorUV = getMaterialUV(pbrMaterial.baseColorUVSet, pbrMaterial.baseColorUVTransform);
  vec2 metallicRoughnessUV = getMaterialUV(
    pbrMaterial.metallicRoughnessUVSet,
    pbrMaterial.metallicRoughnessUVTransform
  );
  vec2 normalUV = getMaterialUV(pbrMaterial.normalUVSet, pbrMaterial.normalUVTransform);
  vec2 occlusionUV = getMaterialUV(pbrMaterial.occlusionUVSet, pbrMaterial.occlusionUVTransform);
  vec2 emissiveUV = getMaterialUV(pbrMaterial.emissiveUVSet, pbrMaterial.emissiveUVTransform);
  vec2 specularColorUV = getMaterialUV(
    pbrMaterial.specularColorUVSet,
    pbrMaterial.specularColorUVTransform
  );
  vec2 specularIntensityUV = getMaterialUV(
    pbrMaterial.specularIntensityUVSet,
    pbrMaterial.specularIntensityUVTransform
  );
  vec2 transmissionUV = getMaterialUV(
    pbrMaterial.transmissionUVSet,
    pbrMaterial.transmissionUVTransform
  );
  vec2 thicknessUV = getMaterialUV(pbrMaterial.thicknessUVSet, pbrMaterial.thicknessUVTransform);
  vec2 clearcoatUV = getMaterialUV(pbrMaterial.clearcoatUVSet, pbrMaterial.clearcoatUVTransform);
  vec2 clearcoatRoughnessUV = getMaterialUV(
    pbrMaterial.clearcoatRoughnessUVSet,
    pbrMaterial.clearcoatRoughnessUVTransform
  );
  vec2 clearcoatNormalUV = getMaterialUV(
    pbrMaterial.clearcoatNormalUVSet,
    pbrMaterial.clearcoatNormalUVTransform
  );
  vec2 sheenColorUV = getMaterialUV(
    pbrMaterial.sheenColorUVSet,
    pbrMaterial.sheenColorUVTransform
  );
  vec2 sheenRoughnessUV = getMaterialUV(
    pbrMaterial.sheenRoughnessUVSet,
    pbrMaterial.sheenRoughnessUVTransform
  );
  vec2 iridescenceUV = getMaterialUV(
    pbrMaterial.iridescenceUVSet,
    pbrMaterial.iridescenceUVTransform
  );
  vec2 iridescenceThicknessUV = getMaterialUV(
    pbrMaterial.iridescenceThicknessUVSet,
    pbrMaterial.iridescenceThicknessUVTransform
  );
  vec2 anisotropyUV = getMaterialUV(
    pbrMaterial.anisotropyUVSet,
    pbrMaterial.anisotropyUVTransform
  );

  // The albedo may be defined from a base texture or a flat color
#ifdef HAS_BASECOLORMAP
  vec4 baseColor =
    SRGBtoLINEAR(texture(pbr_baseColorSampler, baseColorUV)) * pbrMaterial.baseColorFactor;
#else
  vec4 baseColor = pbrMaterial.baseColorFactor;
#endif

#ifdef ALPHA_CUTOFF
  if (baseColor.a < pbrMaterial.alphaCutoff) {
    discard;
  }
#endif

  vec3 color = vec3(0, 0, 0);

  float transmission = 0.0;

  if(pbrMaterial.unlit){
    color.rgb = baseColor.rgb;
  }
  else{
    // Metallic and Roughness material properties are packed together
    // In glTF, these factors can be specified by fixed scalar values
    // or from a metallic-roughness map
    float perceptualRoughness = pbrMaterial.metallicRoughnessValues.y;
    float metallic = pbrMaterial.metallicRoughnessValues.x;
#ifdef HAS_METALROUGHNESSMAP
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    vec4 mrSample = texture(pbr_metallicRoughnessSampler, metallicRoughnessUV);
    perceptualRoughness = mrSample.g * perceptualRoughness;
    metallic = mrSample.b * metallic;
#endif
    perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
    metallic = clamp(metallic, 0.0, 1.0);
    mat3 tbn = getTBN(normalUV);
    vec3 n = getNormal(tbn, normalUV);                          // normal at surface point
    vec3 v = normalize(pbrProjection.camera - pbr_vPosition);  // Vector from surface point to camera
    float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
#ifdef USE_MATERIAL_EXTENSIONS
    bool useExtendedPBR =
      pbrMaterial.specularColorMapEnabled ||
      pbrMaterial.specularIntensityMapEnabled ||
      abs(pbrMaterial.specularIntensityFactor - 1.0) > 0.0001 ||
      maxComponent(abs(pbrMaterial.specularColorFactor - vec3(1.0))) > 0.0001 ||
      abs(pbrMaterial.ior - 1.5) > 0.0001 ||
      pbrMaterial.transmissionMapEnabled ||
      pbrMaterial.transmissionFactor > 0.0001 ||
      pbrMaterial.clearcoatMapEnabled ||
      pbrMaterial.clearcoatRoughnessMapEnabled ||
      pbrMaterial.clearcoatFactor > 0.0001 ||
      pbrMaterial.clearcoatRoughnessFactor > 0.0001 ||
      pbrMaterial.sheenColorMapEnabled ||
      pbrMaterial.sheenRoughnessMapEnabled ||
      maxComponent(pbrMaterial.sheenColorFactor) > 0.0001 ||
      pbrMaterial.sheenRoughnessFactor > 0.0001 ||
      pbrMaterial.iridescenceMapEnabled ||
      pbrMaterial.iridescenceFactor > 0.0001 ||
      abs(pbrMaterial.iridescenceIor - 1.3) > 0.0001 ||
      abs(pbrMaterial.iridescenceThicknessRange.x - 100.0) > 0.0001 ||
      abs(pbrMaterial.iridescenceThicknessRange.y - 400.0) > 0.0001 ||
      pbrMaterial.anisotropyMapEnabled ||
      pbrMaterial.anisotropyStrength > 0.0001 ||
      abs(pbrMaterial.anisotropyRotation) > 0.0001 ||
      length(pbrMaterial.anisotropyDirection - vec2(1.0, 0.0)) > 0.0001;
#else
    bool useExtendedPBR = false;
#endif

    if (!useExtendedPBR) {
      // Keep the baseline metallic-roughness implementation byte-for-byte equivalent in behavior.
      float alphaRoughness = perceptualRoughness * perceptualRoughness;

      vec3 f0 = vec3(0.04);
      vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
      diffuseColor *= 1.0 - metallic;
      vec3 specularColor = mix(f0, baseColor.rgb, metallic);

      float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
      float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
      vec3 specularEnvironmentR0 = specularColor.rgb;
      vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;
      vec3 reflection = -normalize(reflect(v, n));

      PBRInfo pbrInfo = PBRInfo(
        0.0, // NdotL
        NdotV,
        0.0, // NdotH
        0.0, // LdotH
        0.0, // VdotH
        perceptualRoughness,
        metallic,
        specularEnvironmentR0,
        specularEnvironmentR90,
        alphaRoughness,
        diffuseColor,
        specularColor,
        n,
        v
      );

#ifdef USE_LIGHTS
      PBRInfo_setAmbientLight(pbrInfo);
      color += calculateFinalColor(pbrInfo, lighting.ambientColor);

      for(int i = 0; i < lighting.directionalLightCount; i++) {
        if (i < lighting.directionalLightCount) {
          PBRInfo_setDirectionalLight(pbrInfo, lighting_getDirectionalLight(i).direction);
          color += calculateFinalColor(pbrInfo, lighting_getDirectionalLight(i).color);
        }
      }

      for(int i = 0; i < lighting.pointLightCount; i++) {
        if (i < lighting.pointLightCount) {
          PBRInfo_setPointLight(pbrInfo, lighting_getPointLight(i));
          float attenuation = getPointLightAttenuation(lighting_getPointLight(i), distance(lighting_getPointLight(i).position, pbr_vPosition));
          color += calculateFinalColor(pbrInfo, lighting_getPointLight(i).color / attenuation);
        }
      }

      for(int i = 0; i < lighting.spotLightCount; i++) {
        if (i < lighting.spotLightCount) {
          PBRInfo_setSpotLight(pbrInfo, lighting_getSpotLight(i));
          float attenuation = getSpotLightAttenuation(lighting_getSpotLight(i), pbr_vPosition);
          color += calculateFinalColor(pbrInfo, lighting_getSpotLight(i).color / attenuation);
        }
      }
#endif

#ifdef USE_IBL
      if (pbrMaterial.IBLenabled) {
        color += getIBLContribution(pbrInfo, n, reflection);
      }
#endif

#ifdef HAS_OCCLUSIONMAP
      if (pbrMaterial.occlusionMapEnabled) {
        float ao = texture(pbr_occlusionSampler, occlusionUV).r;
        color = mix(color, color * ao, pbrMaterial.occlusionStrength);
      }
#endif

      vec3 emissive = pbrMaterial.emissiveFactor;
#ifdef HAS_EMISSIVEMAP
      if (pbrMaterial.emissiveMapEnabled) {
        emissive *= SRGBtoLINEAR(texture(pbr_emissiveSampler, emissiveUV)).rgb;
      }
#endif
      color += emissive * pbrMaterial.emissiveStrength;

#ifdef PBR_DEBUG
      color = mix(color, baseColor.rgb, pbrMaterial.scaleDiffBaseMR.y);
      color = mix(color, vec3(metallic), pbrMaterial.scaleDiffBaseMR.z);
      color = mix(color, vec3(perceptualRoughness), pbrMaterial.scaleDiffBaseMR.w);
#endif

      return vec4(pow(color, vec3(1.0 / 2.2)), baseColor.a);
    }

    float specularIntensity = pbrMaterial.specularIntensityFactor;
#ifdef HAS_SPECULARINTENSITYMAP
    if (pbrMaterial.specularIntensityMapEnabled) {
      specularIntensity *= texture(pbr_specularIntensitySampler, specularIntensityUV).a;
    }
#endif

    vec3 specularFactor = pbrMaterial.specularColorFactor;
#ifdef HAS_SPECULARCOLORMAP
    if (pbrMaterial.specularColorMapEnabled) {
      specularFactor *= SRGBtoLINEAR(texture(pbr_specularColorSampler, specularColorUV)).rgb;
    }
#endif

    transmission = pbrMaterial.transmissionFactor;
#ifdef HAS_TRANSMISSIONMAP
    if (pbrMaterial.transmissionMapEnabled) {
      transmission *= texture(pbr_transmissionSampler, transmissionUV).r;
    }
#endif
    transmission = clamp(transmission * (1.0 - metallic), 0.0, 1.0);
    float thickness = max(pbrMaterial.thicknessFactor, 0.0);
#ifdef HAS_THICKNESSMAP
    thickness *= texture(pbr_thicknessSampler, thicknessUV).g;
#endif

    float clearcoatFactor = pbrMaterial.clearcoatFactor;
    float clearcoatRoughness = pbrMaterial.clearcoatRoughnessFactor;
#ifdef HAS_CLEARCOATMAP
    if (pbrMaterial.clearcoatMapEnabled) {
      clearcoatFactor *= texture(pbr_clearcoatSampler, clearcoatUV).r;
    }
#endif
#ifdef HAS_CLEARCOATROUGHNESSMAP
    if (pbrMaterial.clearcoatRoughnessMapEnabled) {
      clearcoatRoughness *= texture(pbr_clearcoatRoughnessSampler, clearcoatRoughnessUV).g;
    }
#endif
    clearcoatFactor = clamp(clearcoatFactor, 0.0, 1.0);
    clearcoatRoughness = clamp(clearcoatRoughness, c_MinRoughness, 1.0);
    vec3 clearcoatNormal = getClearcoatNormal(getTBN(clearcoatNormalUV), n, clearcoatNormalUV);

    vec3 sheenColor = pbrMaterial.sheenColorFactor;
    float sheenRoughness = pbrMaterial.sheenRoughnessFactor;
#ifdef HAS_SHEENCOLORMAP
    if (pbrMaterial.sheenColorMapEnabled) {
      sheenColor *= SRGBtoLINEAR(texture(pbr_sheenColorSampler, sheenColorUV)).rgb;
    }
#endif
#ifdef HAS_SHEENROUGHNESSMAP
    if (pbrMaterial.sheenRoughnessMapEnabled) {
      sheenRoughness *= texture(pbr_sheenRoughnessSampler, sheenRoughnessUV).a;
    }
#endif
    sheenRoughness = clamp(sheenRoughness, c_MinRoughness, 1.0);

    float iridescence = pbrMaterial.iridescenceFactor;
#ifdef HAS_IRIDESCENCEMAP
    if (pbrMaterial.iridescenceMapEnabled) {
      iridescence *= texture(pbr_iridescenceSampler, iridescenceUV).r;
    }
#endif
    iridescence = clamp(iridescence, 0.0, 1.0);
    float iridescenceThickness = mix(
      pbrMaterial.iridescenceThicknessRange.x,
      pbrMaterial.iridescenceThicknessRange.y,
      0.5
    );
#ifdef HAS_IRIDESCENCETHICKNESSMAP
    iridescenceThickness = mix(
      pbrMaterial.iridescenceThicknessRange.x,
      pbrMaterial.iridescenceThicknessRange.y,
      texture(pbr_iridescenceThicknessSampler, iridescenceThicknessUV).g
    );
#endif

    float anisotropyStrength = clamp(pbrMaterial.anisotropyStrength, 0.0, 1.0);
    vec2 anisotropyDirection = normalizeDirection(pbrMaterial.anisotropyDirection);
#ifdef HAS_ANISOTROPYMAP
    if (pbrMaterial.anisotropyMapEnabled) {
      vec3 anisotropySample = texture(pbr_anisotropySampler, anisotropyUV).rgb;
      anisotropyStrength *= anisotropySample.b;
      vec2 mappedDirection = anisotropySample.rg * 2.0 - 1.0;
      if (length(mappedDirection) > 0.0001) {
        anisotropyDirection = normalize(mappedDirection);
      }
    }
#endif
    anisotropyDirection = rotateDirection(anisotropyDirection, pbrMaterial.anisotropyRotation);
    vec3 anisotropyTangent = normalize(tbn[0] * anisotropyDirection.x + tbn[1] * anisotropyDirection.y);
    if (length(anisotropyTangent) < 0.0001) {
      anisotropyTangent = normalize(tbn[0]);
    }
    float anisotropyViewAlignment = abs(dot(v, anisotropyTangent));
    perceptualRoughness = mix(
      perceptualRoughness,
      clamp(perceptualRoughness * (1.0 - 0.6 * anisotropyViewAlignment), c_MinRoughness, 1.0),
      anisotropyStrength
    );

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness [2].
    float alphaRoughness = perceptualRoughness * perceptualRoughness;

    float dielectricF0 = getDielectricF0(pbrMaterial.ior);
    vec3 dielectricSpecularF0 = min(
      vec3(dielectricF0) * specularFactor * specularIntensity,
      vec3(1.0)
    );
    vec3 iridescenceTint = getIridescenceTint(iridescence, iridescenceThickness, NdotV);
    dielectricSpecularF0 = mix(
      dielectricSpecularF0,
      dielectricSpecularF0 * iridescenceTint,
      iridescence
    );
    vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - dielectricSpecularF0);
    diffuseColor *= (1.0 - metallic) * (1.0 - transmission);
    vec3 specularColor = mix(dielectricSpecularF0, baseColor.rgb, metallic);

    float baseLayerEnergy = 1.0 - clearcoatFactor * 0.25;
    diffuseColor *= baseLayerEnergy;
    specularColor *= baseLayerEnergy;

    // Compute reflectance.
    float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

    // For typical incident reflectance range (between 4% to 100%) set the grazing
    // reflectance to 100% for typical fresnel effect.
    // For very low reflectance range on highly diffuse objects (below 4%),
    // incrementally reduce grazing reflecance to 0%.
    float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
    vec3 specularEnvironmentR0 = specularColor.rgb;
    vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;
    vec3 reflection = -normalize(reflect(v, n));

    PBRInfo pbrInfo = PBRInfo(
      0.0, // NdotL
      NdotV,
      0.0, // NdotH
      0.0, // LdotH
      0.0, // VdotH
      perceptualRoughness,
      metallic,
      specularEnvironmentR0,
      specularEnvironmentR90,
      alphaRoughness,
      diffuseColor,
      specularColor,
      n,
      v
    );


#ifdef USE_LIGHTS
    // Apply ambient light
    PBRInfo_setAmbientLight(pbrInfo);
    color += calculateMaterialLightColor(
      pbrInfo,
      lighting.ambientColor,
      clearcoatNormal,
      clearcoatFactor,
      clearcoatRoughness,
      sheenColor,
      sheenRoughness,
      anisotropyTangent,
      anisotropyStrength
    );

    // Apply directional light
    for(int i = 0; i < lighting.directionalLightCount; i++) {
      if (i < lighting.directionalLightCount) {
        PBRInfo_setDirectionalLight(pbrInfo, lighting_getDirectionalLight(i).direction);
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getDirectionalLight(i).color,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }

    // Apply point light
    for(int i = 0; i < lighting.pointLightCount; i++) {
      if (i < lighting.pointLightCount) {
        PBRInfo_setPointLight(pbrInfo, lighting_getPointLight(i));
        float attenuation = getPointLightAttenuation(lighting_getPointLight(i), distance(lighting_getPointLight(i).position, pbr_vPosition));
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getPointLight(i).color / attenuation,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }

    for(int i = 0; i < lighting.spotLightCount; i++) {
      if (i < lighting.spotLightCount) {
        PBRInfo_setSpotLight(pbrInfo, lighting_getSpotLight(i));
        float attenuation = getSpotLightAttenuation(lighting_getSpotLight(i), pbr_vPosition);
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getSpotLight(i).color / attenuation,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }
#endif

    // Calculate lighting contribution from image based lighting source (IBL)
#ifdef USE_IBL
    if (pbrMaterial.IBLenabled) {
      color += getIBLContribution(pbrInfo, n, reflection) *
        calculateAnisotropyBoost(pbrInfo, anisotropyTangent, anisotropyStrength);
      color += calculateClearcoatIBLContribution(
        pbrInfo,
        clearcoatNormal,
        -normalize(reflect(v, clearcoatNormal)),
        clearcoatFactor,
        clearcoatRoughness
      );
      color += sheenColor * pbrMaterial.scaleIBLAmbient.x * (1.0 - sheenRoughness) * 0.25;
    }
#endif

 // Apply optional PBR terms for additional (optional) shading
#ifdef HAS_OCCLUSIONMAP
    if (pbrMaterial.occlusionMapEnabled) {
      float ao = texture(pbr_occlusionSampler, occlusionUV).r;
      color = mix(color, color * ao, pbrMaterial.occlusionStrength);
    }
#endif

    vec3 emissive = pbrMaterial.emissiveFactor;
#ifdef HAS_EMISSIVEMAP
    if (pbrMaterial.emissiveMapEnabled) {
      emissive *= SRGBtoLINEAR(texture(pbr_emissiveSampler, emissiveUV)).rgb;
    }
#endif
    color += emissive * pbrMaterial.emissiveStrength;

    if (transmission > 0.0) {
      color = mix(color, color * getVolumeAttenuation(thickness), transmission);
    }

    // This section uses mix to override final color for reference app visualization
    // of various parameters in the lighting equation.
#ifdef PBR_DEBUG
    // TODO: Figure out how to debug multiple lights

    // color = mix(color, F, pbr_scaleFGDSpec.x);
    // color = mix(color, vec3(G), pbr_scaleFGDSpec.y);
    // color = mix(color, vec3(D), pbr_scaleFGDSpec.z);
    // color = mix(color, specContrib, pbr_scaleFGDSpec.w);

    // color = mix(color, diffuseContrib, pbr_scaleDiffBaseMR.x);
    color = mix(color, baseColor.rgb, pbrMaterial.scaleDiffBaseMR.y);
    color = mix(color, vec3(metallic), pbrMaterial.scaleDiffBaseMR.z);
    color = mix(color, vec3(perceptualRoughness), pbrMaterial.scaleDiffBaseMR.w);
#endif

  }

  float alpha = clamp(baseColor.a * (1.0 - transmission), 0.0, 1.0);
  return vec4(pow(color,vec3(1.0/2.2)), alpha);
}
`,eu=`struct PBRFragmentInputs {
  pbr_vPosition: vec3f,
  pbr_vUV0: vec2f,
  pbr_vUV1: vec2f,
  pbr_vTBN: mat3x3f,
  pbr_vNormal: vec3f
};

var<private> fragmentInputs: PBRFragmentInputs;

fn pbr_setPositionNormalTangentUV(
  position: vec4f,
  normal: vec4f,
  tangent: vec4f,
  uv0: vec2f,
  uv1: vec2f
)
{
  var pos: vec4f = pbrProjection.modelMatrix * position;
  fragmentInputs.pbr_vPosition = pos.xyz / pos.w;
  fragmentInputs.pbr_vNormal = vec3f(0.0, 0.0, 1.0);
  fragmentInputs.pbr_vTBN = mat3x3f(
    vec3f(1.0, 0.0, 0.0),
    vec3f(0.0, 1.0, 0.0),
    vec3f(0.0, 0.0, 1.0)
  );
  fragmentInputs.pbr_vUV0 = vec2f(0.0, 0.0);
  fragmentInputs.pbr_vUV1 = uv1;

#ifdef HAS_NORMALS
  let normalW: vec3f = normalize((pbrProjection.normalMatrix * vec4f(normal.xyz, 0.0)).xyz);
  fragmentInputs.pbr_vNormal = normalW;
#ifdef HAS_TANGENTS
  let tangentW: vec3f = normalize((pbrProjection.modelMatrix * vec4f(tangent.xyz, 0.0)).xyz);
  let bitangentW: vec3f = cross(normalW, tangentW) * tangent.w;
  fragmentInputs.pbr_vTBN = mat3x3f(tangentW, bitangentW, normalW);
#endif
#endif

#ifdef HAS_UV
  fragmentInputs.pbr_vUV0 = uv0;
#endif
}

struct pbrMaterialUniforms {
  // Material is unlit
  unlit: u32,

  // Base color map
  baseColorMapEnabled: u32,
  baseColorFactor: vec4f,

  normalMapEnabled : u32,
  normalScale: f32,  // #ifdef HAS_NORMALMAP

  emissiveMapEnabled: u32,
  emissiveFactor: vec3f, // #ifdef HAS_EMISSIVEMAP

  metallicRoughnessValues: vec2f,
  metallicRoughnessMapEnabled: u32,

  occlusionMapEnabled: i32,
  occlusionStrength: f32, // #ifdef HAS_OCCLUSIONMAP
  
  alphaCutoffEnabled: i32,
  alphaCutoff: f32, // #ifdef ALPHA_CUTOFF

  specularColorFactor: vec3f,
  specularIntensityFactor: f32,
  specularColorMapEnabled: i32,
  specularIntensityMapEnabled: i32,

  ior: f32,

  transmissionFactor: f32,
  transmissionMapEnabled: i32,

  thicknessFactor: f32,
  attenuationDistance: f32,
  attenuationColor: vec3f,

  clearcoatFactor: f32,
  clearcoatRoughnessFactor: f32,
  clearcoatMapEnabled: i32,
  clearcoatRoughnessMapEnabled: i32,

  sheenColorFactor: vec3f,
  sheenRoughnessFactor: f32,
  sheenColorMapEnabled: i32,
  sheenRoughnessMapEnabled: i32,

  iridescenceFactor: f32,
  iridescenceIor: f32,
  iridescenceThicknessRange: vec2f,
  iridescenceMapEnabled: i32,

  anisotropyStrength: f32,
  anisotropyRotation: f32,
  anisotropyDirection: vec2f,
  anisotropyMapEnabled: i32,

  emissiveStrength: f32,
  
  // IBL
  IBLenabled: i32,
  scaleIBLAmbient: vec2f, // #ifdef USE_IBL
  
  // debugging flags used for shader output of intermediate PBR variables
  // #ifdef PBR_DEBUG
  scaleDiffBaseMR: vec4f,
  scaleFGDSpec: vec4f,
  // #endif

  baseColorUVSet: i32,
  baseColorUVTransform: mat3x3f,
  metallicRoughnessUVSet: i32,
  metallicRoughnessUVTransform: mat3x3f,
  normalUVSet: i32,
  normalUVTransform: mat3x3f,
  occlusionUVSet: i32,
  occlusionUVTransform: mat3x3f,
  emissiveUVSet: i32,
  emissiveUVTransform: mat3x3f,
  specularColorUVSet: i32,
  specularColorUVTransform: mat3x3f,
  specularIntensityUVSet: i32,
  specularIntensityUVTransform: mat3x3f,
  transmissionUVSet: i32,
  transmissionUVTransform: mat3x3f,
  thicknessUVSet: i32,
  thicknessUVTransform: mat3x3f,
  clearcoatUVSet: i32,
  clearcoatUVTransform: mat3x3f,
  clearcoatRoughnessUVSet: i32,
  clearcoatRoughnessUVTransform: mat3x3f,
  clearcoatNormalUVSet: i32,
  clearcoatNormalUVTransform: mat3x3f,
  sheenColorUVSet: i32,
  sheenColorUVTransform: mat3x3f,
  sheenRoughnessUVSet: i32,
  sheenRoughnessUVTransform: mat3x3f,
  iridescenceUVSet: i32,
  iridescenceUVTransform: mat3x3f,
  iridescenceThicknessUVSet: i32,
  iridescenceThicknessUVTransform: mat3x3f,
  anisotropyUVSet: i32,
  anisotropyUVTransform: mat3x3f,
}

@group(3) @binding(auto) var<uniform> pbrMaterial : pbrMaterialUniforms;

// Samplers
#ifdef HAS_BASECOLORMAP
@group(3) @binding(auto) var pbr_baseColorSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_baseColorSamplerSampler: sampler;
#endif
#ifdef HAS_NORMALMAP
@group(3) @binding(auto) var pbr_normalSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_normalSamplerSampler: sampler;
#endif
#ifdef HAS_EMISSIVEMAP
@group(3) @binding(auto) var pbr_emissiveSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_emissiveSamplerSampler: sampler;
#endif
#ifdef HAS_METALROUGHNESSMAP
@group(3) @binding(auto) var pbr_metallicRoughnessSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_metallicRoughnessSamplerSampler: sampler;
#endif
#ifdef HAS_OCCLUSIONMAP
@group(3) @binding(auto) var pbr_occlusionSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_occlusionSamplerSampler: sampler;
#endif
#ifdef HAS_SPECULARCOLORMAP
@group(3) @binding(auto) var pbr_specularColorSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_specularColorSamplerSampler: sampler;
#endif
#ifdef HAS_SPECULARINTENSITYMAP
@group(3) @binding(auto) var pbr_specularIntensitySampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_specularIntensitySamplerSampler: sampler;
#endif
#ifdef HAS_TRANSMISSIONMAP
@group(3) @binding(auto) var pbr_transmissionSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_transmissionSamplerSampler: sampler;
#endif
#ifdef HAS_THICKNESSMAP
@group(3) @binding(auto) var pbr_thicknessSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_thicknessSamplerSampler: sampler;
#endif
#ifdef HAS_CLEARCOATMAP
@group(3) @binding(auto) var pbr_clearcoatSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_clearcoatSamplerSampler: sampler;
#endif
#ifdef HAS_CLEARCOATROUGHNESSMAP
@group(3) @binding(auto) var pbr_clearcoatRoughnessSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_clearcoatRoughnessSamplerSampler: sampler;
#endif
#ifdef HAS_CLEARCOATNORMALMAP
@group(3) @binding(auto) var pbr_clearcoatNormalSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_clearcoatNormalSamplerSampler: sampler;
#endif
#ifdef HAS_SHEENCOLORMAP
@group(3) @binding(auto) var pbr_sheenColorSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_sheenColorSamplerSampler: sampler;
#endif
#ifdef HAS_SHEENROUGHNESSMAP
@group(3) @binding(auto) var pbr_sheenRoughnessSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_sheenRoughnessSamplerSampler: sampler;
#endif
#ifdef HAS_IRIDESCENCEMAP
@group(3) @binding(auto) var pbr_iridescenceSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_iridescenceSamplerSampler: sampler;
#endif
#ifdef HAS_IRIDESCENCETHICKNESSMAP
@group(3) @binding(auto) var pbr_iridescenceThicknessSampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_iridescenceThicknessSamplerSampler: sampler;
#endif
#ifdef HAS_ANISOTROPYMAP
@group(3) @binding(auto) var pbr_anisotropySampler: texture_2d<f32>;
@group(3) @binding(auto) var pbr_anisotropySamplerSampler: sampler;
#endif
// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo {
  NdotL: f32,                  // cos angle between normal and light direction
  NdotV: f32,                  // cos angle between normal and view direction
  NdotH: f32,                  // cos angle between normal and half vector
  LdotH: f32,                  // cos angle between light direction and half vector
  VdotH: f32,                  // cos angle between view direction and half vector
  perceptualRoughness: f32,    // roughness value, as authored by the model creator (input to shader)
  metalness: f32,              // metallic value at the surface
  reflectance0: vec3f,            // full reflectance color (normal incidence angle)
  reflectance90: vec3f,           // reflectance color at grazing angle
  alphaRoughness: f32,         // roughness mapped to a more linear change in the roughness (proposed by [2])
  diffuseColor: vec3f,            // color contribution from diffuse lighting
  specularColor: vec3f,           // color contribution from specular lighting
  n: vec3f,                       // normal at surface point
  v: vec3f,                       // vector from surface point to camera
};

const M_PI = 3.141592653589793;
const c_MinRoughness = 0.04;

fn SRGBtoLINEAR(srgbIn: vec4f ) -> vec4f
{
  var linOut: vec3f = srgbIn.xyz;
#ifdef MANUAL_SRGB
  let bLess: vec3f = step(vec3f(0.04045), srgbIn.xyz);
  linOut = mix(
    srgbIn.xyz / vec3f(12.92),
    pow((srgbIn.xyz + vec3f(0.055)) / vec3f(1.055), vec3f(2.4)),
    bLess
  );
#ifdef SRGB_FAST_APPROXIMATION
  linOut = pow(srgbIn.xyz, vec3f(2.2));
#endif
#endif
  return vec4f(linOut, srgbIn.w);
}

fn getMaterialUV(uvSet: i32, uvTransform: mat3x3f) -> vec2f
{
  var baseUV = fragmentInputs.pbr_vUV0;
  if (uvSet == 1) {
    baseUV = fragmentInputs.pbr_vUV1;
  }
  return (uvTransform * vec3f(baseUV, 1.0)).xy;
}

// Build the tangent basis from interpolated attributes or screen-space derivatives.
fn getTBN(uv: vec2f) -> mat3x3f
{
  let pos_dx: vec3f = dpdx(fragmentInputs.pbr_vPosition);
  let pos_dy: vec3f = dpdy(fragmentInputs.pbr_vPosition);
  let tex_dx: vec3f = dpdx(vec3f(uv, 0.0));
  let tex_dy: vec3f = dpdy(vec3f(uv, 0.0));
  var t: vec3f = (tex_dy.y * pos_dx - tex_dx.y * pos_dy) / (tex_dx.x * tex_dy.y - tex_dy.x * tex_dx.y);

  var ng: vec3f = cross(pos_dx, pos_dy);
#ifdef HAS_NORMALS
  ng = normalize(fragmentInputs.pbr_vNormal);
#endif
  t = normalize(t - ng * dot(ng, t));
  var b: vec3f = normalize(cross(ng, t));
  var tbn: mat3x3f = mat3x3f(t, b, ng);
#ifdef HAS_TANGENTS
  tbn = fragmentInputs.pbr_vTBN;
#endif

  return tbn;
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
fn getMappedNormal(
  normalSampler: texture_2d<f32>,
  normalSamplerBinding: sampler,
  tbn: mat3x3f,
  normalScale: f32,
  uv: vec2f
) -> vec3f
{
  let n = textureSample(normalSampler, normalSamplerBinding, uv).rgb;
  return normalize(tbn * ((2.0 * n - 1.0) * vec3f(normalScale, normalScale, 1.0)));
}

fn getNormal(tbn: mat3x3f, uv: vec2f) -> vec3f
{
  // The tbn matrix is linearly interpolated, so we need to re-normalize
  var n: vec3f = normalize(tbn[2].xyz);
#ifdef HAS_NORMALMAP
  n = getMappedNormal(
    pbr_normalSampler,
    pbr_normalSamplerSampler,
    tbn,
    pbrMaterial.normalScale,
    uv
  );
#endif

  return n;
}

fn getClearcoatNormal(tbn: mat3x3f, baseNormal: vec3f, uv: vec2f) -> vec3f
{
#ifdef HAS_CLEARCOATNORMALMAP
  return getMappedNormal(
    pbr_clearcoatNormalSampler,
    pbr_clearcoatNormalSamplerSampler,
    tbn,
    1.0,
    uv
  );
#else
  return baseNormal;
#endif
}

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
#ifdef USE_IBL
fn getIBLContribution(pbrInfo: PBRInfo, n: vec3f, reflection: vec3f) -> vec3f
{
  let mipCount: f32 = 9.0; // resolution of 512x512
  let lod: f32 = pbrInfo.perceptualRoughness * mipCount;
  // retrieve a scale and bias to F0. See [1], Figure 3
  let brdf = SRGBtoLINEAR(
    textureSampleLevel(
      pbr_brdfLUT,
      pbr_brdfLUTSampler,
      vec2f(pbrInfo.NdotV, 1.0 - pbrInfo.perceptualRoughness),
      0.0
    )
  ).rgb;
  let diffuseLight =
    SRGBtoLINEAR(
      textureSampleLevel(pbr_diffuseEnvSampler, pbr_diffuseEnvSamplerSampler, n, 0.0)
    ).rgb;
  var specularLight = SRGBtoLINEAR(
    textureSampleLevel(
      pbr_specularEnvSampler,
      pbr_specularEnvSamplerSampler,
      reflection,
      0.0
    )
  ).rgb;
#ifdef USE_TEX_LOD
  specularLight = SRGBtoLINEAR(
    textureSampleLevel(
      pbr_specularEnvSampler,
      pbr_specularEnvSamplerSampler,
      reflection,
      lod
    )
  ).rgb;
#endif

  let diffuse = diffuseLight * pbrInfo.diffuseColor * pbrMaterial.scaleIBLAmbient.x;
  let specular =
    specularLight * (pbrInfo.specularColor * brdf.x + brdf.y) * pbrMaterial.scaleIBLAmbient.y;

  return diffuse + specular;
}
#endif

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
fn diffuse(pbrInfo: PBRInfo) -> vec3<f32> {
  return pbrInfo.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
fn specularReflection(pbrInfo: PBRInfo) -> vec3<f32> {
  return pbrInfo.reflectance0 +
    (pbrInfo.reflectance90 - pbrInfo.reflectance0) *
    pow(clamp(1.0 - pbrInfo.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
fn geometricOcclusion(pbrInfo: PBRInfo) -> f32 {
  let NdotL: f32 = pbrInfo.NdotL;
  let NdotV: f32 = pbrInfo.NdotV;
  let r: f32 = pbrInfo.alphaRoughness;

  let attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  let attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across
// the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface
// for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes
// from EPIC Games [1], Equation 3.
fn microfacetDistribution(pbrInfo: PBRInfo) -> f32 {
  let roughnessSq = pbrInfo.alphaRoughness * pbrInfo.alphaRoughness;
  let f = (pbrInfo.NdotH * roughnessSq - pbrInfo.NdotH) * pbrInfo.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

fn maxComponent(value: vec3f) -> f32 {
  return max(max(value.r, value.g), value.b);
}

fn getDielectricF0(ior: f32) -> f32 {
  let clampedIor = max(ior, 1.0);
  let ratio = (clampedIor - 1.0) / (clampedIor + 1.0);
  return ratio * ratio;
}

fn normalizeDirection(direction: vec2f) -> vec2f {
  let directionLength = length(direction);
  if (directionLength > 0.0001) {
    return direction / directionLength;
  }

  return vec2f(1.0, 0.0);
}

fn rotateDirection(direction: vec2f, rotation: f32) -> vec2f {
  let s = sin(rotation);
  let c = cos(rotation);
  return vec2f(direction.x * c - direction.y * s, direction.x * s + direction.y * c);
}

fn getIridescenceTint(iridescence: f32, thickness: f32, NdotV: f32) -> vec3f {
  if (iridescence <= 0.0) {
    return vec3f(1.0);
  }

  let phase = 0.015 * thickness * pbrMaterial.iridescenceIor + (1.0 - NdotV) * 6.0;
  let thinFilmTint =
    0.5 +
    0.5 *
    cos(vec3f(phase, phase + 2.0943951, phase + 4.1887902));
  return mix(vec3f(1.0), thinFilmTint, iridescence);
}

fn getVolumeAttenuation(thickness: f32) -> vec3f {
  if (thickness <= 0.0) {
    return vec3f(1.0);
  }

  let attenuationCoefficient =
    -log(max(pbrMaterial.attenuationColor, vec3f(0.0001))) /
    max(pbrMaterial.attenuationDistance, 0.0001);
  return exp(-attenuationCoefficient * thickness);
}

fn createClearcoatPBRInfo(
  basePBRInfo: PBRInfo,
  clearcoatNormal: vec3f,
  clearcoatRoughness: f32
) -> PBRInfo {
  let perceptualRoughness = clamp(clearcoatRoughness, c_MinRoughness, 1.0);
  let alphaRoughness = perceptualRoughness * perceptualRoughness;
  let NdotV = clamp(abs(dot(clearcoatNormal, basePBRInfo.v)), 0.001, 1.0);

  return PBRInfo(
    basePBRInfo.NdotL,
    NdotV,
    basePBRInfo.NdotH,
    basePBRInfo.LdotH,
    basePBRInfo.VdotH,
    perceptualRoughness,
    0.0,
    vec3f(0.04),
    vec3f(1.0),
    alphaRoughness,
    vec3f(0.0),
    vec3f(0.04),
    clearcoatNormal,
    basePBRInfo.v
  );
}

fn calculateClearcoatContribution(
  pbrInfo: PBRInfo,
  lightColor: vec3f,
  clearcoatNormal: vec3f,
  clearcoatFactor: f32,
  clearcoatRoughness: f32
) -> vec3f {
  if (clearcoatFactor <= 0.0) {
    return vec3f(0.0);
  }

  let clearcoatPBRInfo = createClearcoatPBRInfo(pbrInfo, clearcoatNormal, clearcoatRoughness);
  return calculateFinalColor(clearcoatPBRInfo, lightColor) * clearcoatFactor;
}

#ifdef USE_IBL
fn calculateClearcoatIBLContribution(
  pbrInfo: PBRInfo,
  clearcoatNormal: vec3f,
  reflection: vec3f,
  clearcoatFactor: f32,
  clearcoatRoughness: f32
) -> vec3f {
  if (clearcoatFactor <= 0.0) {
    return vec3f(0.0);
  }

  let clearcoatPBRInfo = createClearcoatPBRInfo(pbrInfo, clearcoatNormal, clearcoatRoughness);
  return getIBLContribution(clearcoatPBRInfo, clearcoatNormal, reflection) * clearcoatFactor;
}
#endif

fn calculateSheenContribution(
  pbrInfo: PBRInfo,
  lightColor: vec3f,
  sheenColor: vec3f,
  sheenRoughness: f32
) -> vec3f {
  if (maxComponent(sheenColor) <= 0.0) {
    return vec3f(0.0);
  }

  let sheenFresnel = pow(clamp(1.0 - pbrInfo.VdotH, 0.0, 1.0), 5.0);
  let sheenVisibility = mix(1.0, pbrInfo.NdotL * pbrInfo.NdotV, sheenRoughness);
  return pbrInfo.NdotL *
    lightColor *
    sheenColor *
    (0.25 + 0.75 * sheenFresnel) *
    sheenVisibility *
    (1.0 - pbrInfo.metalness);
}

fn calculateAnisotropyBoost(
  pbrInfo: PBRInfo,
  anisotropyTangent: vec3f,
  anisotropyStrength: f32
) -> f32 {
  if (anisotropyStrength <= 0.0) {
    return 1.0;
  }

  let anisotropyBitangent = normalize(cross(pbrInfo.n, anisotropyTangent));
  let bitangentViewAlignment = abs(dot(pbrInfo.v, anisotropyBitangent));
  return mix(1.0, 0.65 + 0.7 * bitangentViewAlignment, anisotropyStrength);
}

fn calculateMaterialLightColor(
  pbrInfo: PBRInfo,
  lightColor: vec3f,
  clearcoatNormal: vec3f,
  clearcoatFactor: f32,
  clearcoatRoughness: f32,
  sheenColor: vec3f,
  sheenRoughness: f32,
  anisotropyTangent: vec3f,
  anisotropyStrength: f32
) -> vec3f {
  let anisotropyBoost = calculateAnisotropyBoost(pbrInfo, anisotropyTangent, anisotropyStrength);
  var color = calculateFinalColor(pbrInfo, lightColor) * anisotropyBoost;
  color += calculateClearcoatContribution(
    pbrInfo,
    lightColor,
    clearcoatNormal,
    clearcoatFactor,
    clearcoatRoughness
  );
  color += calculateSheenContribution(pbrInfo, lightColor, sheenColor, sheenRoughness);
  return color;
}

fn PBRInfo_setAmbientLight(pbrInfo: ptr<function, PBRInfo>) {
  (*pbrInfo).NdotL = 1.0;
  (*pbrInfo).NdotH = 0.0;
  (*pbrInfo).LdotH = 0.0;
  (*pbrInfo).VdotH = 1.0;
}

fn PBRInfo_setDirectionalLight(pbrInfo: ptr<function, PBRInfo>, lightDirection: vec3<f32>) {
  let n = (*pbrInfo).n;
  let v = (*pbrInfo).v;
  let l = normalize(lightDirection);             // Vector from surface point to light
  let h = normalize(l + v);                      // Half vector between both l and v

  (*pbrInfo).NdotL = clamp(dot(n, l), 0.001, 1.0);
  (*pbrInfo).NdotH = clamp(dot(n, h), 0.0, 1.0);
  (*pbrInfo).LdotH = clamp(dot(l, h), 0.0, 1.0);
  (*pbrInfo).VdotH = clamp(dot(v, h), 0.0, 1.0);
}

fn PBRInfo_setPointLight(pbrInfo: ptr<function, PBRInfo>, pointLight: PointLight) {
  let light_direction = normalize(pointLight.position - fragmentInputs.pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInfo, light_direction);
}

fn PBRInfo_setSpotLight(pbrInfo: ptr<function, PBRInfo>, spotLight: SpotLight) {
  let light_direction = normalize(spotLight.position - fragmentInputs.pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInfo, light_direction);
}

fn calculateFinalColor(pbrInfo: PBRInfo, lightColor: vec3<f32>) -> vec3<f32> {
  // Calculate the shading terms for the microfacet specular shading model
  let F = specularReflection(pbrInfo);
  let G = geometricOcclusion(pbrInfo);
  let D = microfacetDistribution(pbrInfo);

  // Calculation of analytical lighting contribution
  let diffuseContrib = (1.0 - F) * diffuse(pbrInfo);
  let specContrib = F * G * D / (4.0 * pbrInfo.NdotL * pbrInfo.NdotV);
  // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
  return pbrInfo.NdotL * lightColor * (diffuseContrib + specContrib);
}

fn pbr_filterColor(colorUnused: vec4<f32>) -> vec4<f32> {
  let baseColorUV = getMaterialUV(pbrMaterial.baseColorUVSet, pbrMaterial.baseColorUVTransform);
  let metallicRoughnessUV = getMaterialUV(
    pbrMaterial.metallicRoughnessUVSet,
    pbrMaterial.metallicRoughnessUVTransform
  );
  let normalUV = getMaterialUV(pbrMaterial.normalUVSet, pbrMaterial.normalUVTransform);
  let occlusionUV = getMaterialUV(pbrMaterial.occlusionUVSet, pbrMaterial.occlusionUVTransform);
  let emissiveUV = getMaterialUV(pbrMaterial.emissiveUVSet, pbrMaterial.emissiveUVTransform);
  let specularColorUV = getMaterialUV(
    pbrMaterial.specularColorUVSet,
    pbrMaterial.specularColorUVTransform
  );
  let specularIntensityUV = getMaterialUV(
    pbrMaterial.specularIntensityUVSet,
    pbrMaterial.specularIntensityUVTransform
  );
  let transmissionUV = getMaterialUV(
    pbrMaterial.transmissionUVSet,
    pbrMaterial.transmissionUVTransform
  );
  let thicknessUV = getMaterialUV(pbrMaterial.thicknessUVSet, pbrMaterial.thicknessUVTransform);
  let clearcoatUV = getMaterialUV(pbrMaterial.clearcoatUVSet, pbrMaterial.clearcoatUVTransform);
  let clearcoatRoughnessUV = getMaterialUV(
    pbrMaterial.clearcoatRoughnessUVSet,
    pbrMaterial.clearcoatRoughnessUVTransform
  );
  let clearcoatNormalUV = getMaterialUV(
    pbrMaterial.clearcoatNormalUVSet,
    pbrMaterial.clearcoatNormalUVTransform
  );
  let sheenColorUV = getMaterialUV(
    pbrMaterial.sheenColorUVSet,
    pbrMaterial.sheenColorUVTransform
  );
  let sheenRoughnessUV = getMaterialUV(
    pbrMaterial.sheenRoughnessUVSet,
    pbrMaterial.sheenRoughnessUVTransform
  );
  let iridescenceUV = getMaterialUV(
    pbrMaterial.iridescenceUVSet,
    pbrMaterial.iridescenceUVTransform
  );
  let iridescenceThicknessUV = getMaterialUV(
    pbrMaterial.iridescenceThicknessUVSet,
    pbrMaterial.iridescenceThicknessUVTransform
  );
  let anisotropyUV = getMaterialUV(
    pbrMaterial.anisotropyUVSet,
    pbrMaterial.anisotropyUVTransform
  );

  // The albedo may be defined from a base texture or a flat color
  var baseColor: vec4<f32> = pbrMaterial.baseColorFactor;
  #ifdef HAS_BASECOLORMAP
  baseColor = SRGBtoLINEAR(
    textureSample(pbr_baseColorSampler, pbr_baseColorSamplerSampler, baseColorUV)
  ) * pbrMaterial.baseColorFactor;
  #endif

  #ifdef ALPHA_CUTOFF
  if (baseColor.a < pbrMaterial.alphaCutoff) {
    discard;
  }
  #endif

  var color = vec3<f32>(0.0, 0.0, 0.0);
  var transmission = 0.0;

  if (pbrMaterial.unlit != 0u) {
    color = baseColor.rgb;
  } else {
    // Metallic and Roughness material properties are packed together
    // In glTF, these factors can be specified by fixed scalar values
    // or from a metallic-roughness map
    var perceptualRoughness = pbrMaterial.metallicRoughnessValues.y;
    var metallic = pbrMaterial.metallicRoughnessValues.x;
    #ifdef HAS_METALROUGHNESSMAP
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    let mrSample = textureSample(
      pbr_metallicRoughnessSampler,
      pbr_metallicRoughnessSamplerSampler,
      metallicRoughnessUV
    );
    perceptualRoughness = mrSample.g * perceptualRoughness;
    metallic = mrSample.b * metallic;
    #endif
    perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
    metallic = clamp(metallic, 0.0, 1.0);
    let tbn = getTBN(normalUV);
    let n = getNormal(tbn, normalUV);                          // normal at surface point
    let v = normalize(pbrProjection.camera - fragmentInputs.pbr_vPosition);  // Vector from surface point to camera
    let NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
    var useExtendedPBR = false;
    #ifdef USE_MATERIAL_EXTENSIONS
    useExtendedPBR =
      pbrMaterial.specularColorMapEnabled != 0 ||
      pbrMaterial.specularIntensityMapEnabled != 0 ||
      abs(pbrMaterial.specularIntensityFactor - 1.0) > 0.0001 ||
      maxComponent(abs(pbrMaterial.specularColorFactor - vec3f(1.0))) > 0.0001 ||
      abs(pbrMaterial.ior - 1.5) > 0.0001 ||
      pbrMaterial.transmissionMapEnabled != 0 ||
      pbrMaterial.transmissionFactor > 0.0001 ||
      pbrMaterial.clearcoatMapEnabled != 0 ||
      pbrMaterial.clearcoatRoughnessMapEnabled != 0 ||
      pbrMaterial.clearcoatFactor > 0.0001 ||
      pbrMaterial.clearcoatRoughnessFactor > 0.0001 ||
      pbrMaterial.sheenColorMapEnabled != 0 ||
      pbrMaterial.sheenRoughnessMapEnabled != 0 ||
      maxComponent(pbrMaterial.sheenColorFactor) > 0.0001 ||
      pbrMaterial.sheenRoughnessFactor > 0.0001 ||
      pbrMaterial.iridescenceMapEnabled != 0 ||
      pbrMaterial.iridescenceFactor > 0.0001 ||
      abs(pbrMaterial.iridescenceIor - 1.3) > 0.0001 ||
      abs(pbrMaterial.iridescenceThicknessRange.x - 100.0) > 0.0001 ||
      abs(pbrMaterial.iridescenceThicknessRange.y - 400.0) > 0.0001 ||
      pbrMaterial.anisotropyMapEnabled != 0 ||
      pbrMaterial.anisotropyStrength > 0.0001 ||
      abs(pbrMaterial.anisotropyRotation) > 0.0001 ||
      length(pbrMaterial.anisotropyDirection - vec2f(1.0, 0.0)) > 0.0001;
    #endif

    if (!useExtendedPBR) {
      let alphaRoughness = perceptualRoughness * perceptualRoughness;

      let f0 = vec3<f32>(0.04);
      var diffuseColor = baseColor.rgb * (vec3<f32>(1.0) - f0);
      diffuseColor *= 1.0 - metallic;
      let specularColor = mix(f0, baseColor.rgb, metallic);

      let reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
      let reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
      let specularEnvironmentR0 = specularColor;
      let specularEnvironmentR90 = vec3<f32>(1.0, 1.0, 1.0) * reflectance90;
      let reflection = -normalize(reflect(v, n));

      var pbrInfo = PBRInfo(
        0.0, // NdotL
        NdotV,
        0.0, // NdotH
        0.0, // LdotH
        0.0, // VdotH
        perceptualRoughness,
        metallic,
        specularEnvironmentR0,
        specularEnvironmentR90,
        alphaRoughness,
        diffuseColor,
        specularColor,
        n,
        v
      );

      #ifdef USE_LIGHTS
      PBRInfo_setAmbientLight(&pbrInfo);
      color += calculateFinalColor(pbrInfo, lighting.ambientColor);

      for (var i = 0; i < lighting.directionalLightCount; i++) {
        if (i < lighting.directionalLightCount) {
          PBRInfo_setDirectionalLight(&pbrInfo, lighting_getDirectionalLight(i).direction);
          color += calculateFinalColor(pbrInfo, lighting_getDirectionalLight(i).color);
        }
      }

      for (var i = 0; i < lighting.pointLightCount; i++) {
        if (i < lighting.pointLightCount) {
          PBRInfo_setPointLight(&pbrInfo, lighting_getPointLight(i));
          let attenuation = getPointLightAttenuation(
            lighting_getPointLight(i),
            distance(lighting_getPointLight(i).position, fragmentInputs.pbr_vPosition)
          );
          color += calculateFinalColor(pbrInfo, lighting_getPointLight(i).color / attenuation);
        }
      }

      for (var i = 0; i < lighting.spotLightCount; i++) {
        if (i < lighting.spotLightCount) {
          PBRInfo_setSpotLight(&pbrInfo, lighting_getSpotLight(i));
          let attenuation = getSpotLightAttenuation(
            lighting_getSpotLight(i),
            fragmentInputs.pbr_vPosition
          );
          color += calculateFinalColor(pbrInfo, lighting_getSpotLight(i).color / attenuation);
        }
      }
      #endif

      #ifdef USE_IBL
      if (pbrMaterial.IBLenabled != 0) {
        color += getIBLContribution(pbrInfo, n, reflection);
      }
      #endif

      #ifdef HAS_OCCLUSIONMAP
      if (pbrMaterial.occlusionMapEnabled != 0) {
        let ao = textureSample(pbr_occlusionSampler, pbr_occlusionSamplerSampler, occlusionUV).r;
        color = mix(color, color * ao, pbrMaterial.occlusionStrength);
      }
      #endif

      var emissive = pbrMaterial.emissiveFactor;
      #ifdef HAS_EMISSIVEMAP
      if (pbrMaterial.emissiveMapEnabled != 0u) {
        emissive *= SRGBtoLINEAR(
          textureSample(pbr_emissiveSampler, pbr_emissiveSamplerSampler, emissiveUV)
        ).rgb;
      }
      #endif
      color += emissive * pbrMaterial.emissiveStrength;

      #ifdef PBR_DEBUG
      color = mix(color, baseColor.rgb, pbrMaterial.scaleDiffBaseMR.y);
      color = mix(color, vec3<f32>(metallic), pbrMaterial.scaleDiffBaseMR.z);
      color = mix(color, vec3<f32>(perceptualRoughness), pbrMaterial.scaleDiffBaseMR.w);
      #endif

      return vec4<f32>(pow(color, vec3<f32>(1.0 / 2.2)), baseColor.a);
    }

    var specularIntensity = pbrMaterial.specularIntensityFactor;
    #ifdef HAS_SPECULARINTENSITYMAP
    if (pbrMaterial.specularIntensityMapEnabled != 0) {
      specularIntensity *= textureSample(
        pbr_specularIntensitySampler,
        pbr_specularIntensitySamplerSampler,
        specularIntensityUV
      ).a;
    }
    #endif

    var specularFactor = pbrMaterial.specularColorFactor;
    #ifdef HAS_SPECULARCOLORMAP
    if (pbrMaterial.specularColorMapEnabled != 0) {
      specularFactor *= SRGBtoLINEAR(
        textureSample(
          pbr_specularColorSampler,
          pbr_specularColorSamplerSampler,
          specularColorUV
        )
      ).rgb;
    }
    #endif

    transmission = pbrMaterial.transmissionFactor;
    #ifdef HAS_TRANSMISSIONMAP
    if (pbrMaterial.transmissionMapEnabled != 0) {
      transmission *= textureSample(
        pbr_transmissionSampler,
        pbr_transmissionSamplerSampler,
        transmissionUV
      ).r;
    }
    #endif
    transmission = clamp(transmission * (1.0 - metallic), 0.0, 1.0);
    var thickness = max(pbrMaterial.thicknessFactor, 0.0);
    #ifdef HAS_THICKNESSMAP
    thickness *= textureSample(
      pbr_thicknessSampler,
      pbr_thicknessSamplerSampler,
      thicknessUV
    ).g;
    #endif

    var clearcoatFactor = pbrMaterial.clearcoatFactor;
    var clearcoatRoughness = pbrMaterial.clearcoatRoughnessFactor;
    #ifdef HAS_CLEARCOATMAP
    if (pbrMaterial.clearcoatMapEnabled != 0) {
      clearcoatFactor *= textureSample(
        pbr_clearcoatSampler,
        pbr_clearcoatSamplerSampler,
        clearcoatUV
      ).r;
    }
    #endif
    #ifdef HAS_CLEARCOATROUGHNESSMAP
    if (pbrMaterial.clearcoatRoughnessMapEnabled != 0) {
      clearcoatRoughness *= textureSample(
        pbr_clearcoatRoughnessSampler,
        pbr_clearcoatRoughnessSamplerSampler,
        clearcoatRoughnessUV
      ).g;
    }
    #endif
    clearcoatFactor = clamp(clearcoatFactor, 0.0, 1.0);
    clearcoatRoughness = clamp(clearcoatRoughness, c_MinRoughness, 1.0);
    let clearcoatNormal = getClearcoatNormal(getTBN(clearcoatNormalUV), n, clearcoatNormalUV);

    var sheenColor = pbrMaterial.sheenColorFactor;
    var sheenRoughness = pbrMaterial.sheenRoughnessFactor;
    #ifdef HAS_SHEENCOLORMAP
    if (pbrMaterial.sheenColorMapEnabled != 0) {
      sheenColor *= SRGBtoLINEAR(
        textureSample(
          pbr_sheenColorSampler,
          pbr_sheenColorSamplerSampler,
          sheenColorUV
        )
      ).rgb;
    }
    #endif
    #ifdef HAS_SHEENROUGHNESSMAP
    if (pbrMaterial.sheenRoughnessMapEnabled != 0) {
      sheenRoughness *= textureSample(
        pbr_sheenRoughnessSampler,
        pbr_sheenRoughnessSamplerSampler,
        sheenRoughnessUV
      ).a;
    }
    #endif
    sheenRoughness = clamp(sheenRoughness, c_MinRoughness, 1.0);

    var iridescence = pbrMaterial.iridescenceFactor;
    #ifdef HAS_IRIDESCENCEMAP
    if (pbrMaterial.iridescenceMapEnabled != 0) {
      iridescence *= textureSample(
        pbr_iridescenceSampler,
        pbr_iridescenceSamplerSampler,
        iridescenceUV
      ).r;
    }
    #endif
    iridescence = clamp(iridescence, 0.0, 1.0);
    var iridescenceThickness = mix(
      pbrMaterial.iridescenceThicknessRange.x,
      pbrMaterial.iridescenceThicknessRange.y,
      0.5
    );
    #ifdef HAS_IRIDESCENCETHICKNESSMAP
    iridescenceThickness = mix(
      pbrMaterial.iridescenceThicknessRange.x,
      pbrMaterial.iridescenceThicknessRange.y,
      textureSample(
        pbr_iridescenceThicknessSampler,
        pbr_iridescenceThicknessSamplerSampler,
        iridescenceThicknessUV
      ).g
    );
    #endif

    var anisotropyStrength = clamp(pbrMaterial.anisotropyStrength, 0.0, 1.0);
    var anisotropyDirection = normalizeDirection(pbrMaterial.anisotropyDirection);
    #ifdef HAS_ANISOTROPYMAP
    if (pbrMaterial.anisotropyMapEnabled != 0) {
      let anisotropySample = textureSample(
        pbr_anisotropySampler,
        pbr_anisotropySamplerSampler,
        anisotropyUV
      ).rgb;
      anisotropyStrength *= anisotropySample.b;
      let mappedDirection = anisotropySample.rg * 2.0 - 1.0;
      if (length(mappedDirection) > 0.0001) {
        anisotropyDirection = normalize(mappedDirection);
      }
    }
    #endif
    anisotropyDirection = rotateDirection(anisotropyDirection, pbrMaterial.anisotropyRotation);
    var anisotropyTangent =
      normalize(tbn[0] * anisotropyDirection.x + tbn[1] * anisotropyDirection.y);
    if (length(anisotropyTangent) < 0.0001) {
      anisotropyTangent = normalize(tbn[0]);
    }
    let anisotropyViewAlignment = abs(dot(v, anisotropyTangent));
    perceptualRoughness = mix(
      perceptualRoughness,
      clamp(perceptualRoughness * (1.0 - 0.6 * anisotropyViewAlignment), c_MinRoughness, 1.0),
      anisotropyStrength
    );

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness [2].
    let alphaRoughness = perceptualRoughness * perceptualRoughness;

    let dielectricF0 = getDielectricF0(pbrMaterial.ior);
    var dielectricSpecularF0 = min(
      vec3f(dielectricF0) * specularFactor * specularIntensity,
      vec3f(1.0)
    );
    let iridescenceTint = getIridescenceTint(iridescence, iridescenceThickness, NdotV);
    dielectricSpecularF0 = mix(
      dielectricSpecularF0,
      dielectricSpecularF0 * iridescenceTint,
      iridescence
    );
    var diffuseColor = baseColor.rgb * (vec3f(1.0) - dielectricSpecularF0);
    diffuseColor *= (1.0 - metallic) * (1.0 - transmission);
    var specularColor = mix(dielectricSpecularF0, baseColor.rgb, metallic);

    let baseLayerEnergy = 1.0 - clearcoatFactor * 0.25;
    diffuseColor *= baseLayerEnergy;
    specularColor *= baseLayerEnergy;

    // Compute reflectance.
    let reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

    // For typical incident reflectance range (between 4% to 100%) set the grazing
    // reflectance to 100% for typical fresnel effect.
    // For very low reflectance range on highly diffuse objects (below 4%),
    // incrementally reduce grazing reflectance to 0%.
    let reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
    let specularEnvironmentR0 = specularColor;
    let specularEnvironmentR90 = vec3<f32>(1.0, 1.0, 1.0) * reflectance90;
    let reflection = -normalize(reflect(v, n));

    var pbrInfo = PBRInfo(
      0.0, // NdotL
      NdotV,
      0.0, // NdotH
      0.0, // LdotH
      0.0, // VdotH
      perceptualRoughness,
      metallic,
      specularEnvironmentR0,
      specularEnvironmentR90,
      alphaRoughness,
      diffuseColor,
      specularColor,
      n,
      v
    );

    #ifdef USE_LIGHTS
    // Apply ambient light
    PBRInfo_setAmbientLight(&pbrInfo);
    color += calculateMaterialLightColor(
      pbrInfo,
      lighting.ambientColor,
      clearcoatNormal,
      clearcoatFactor,
      clearcoatRoughness,
      sheenColor,
      sheenRoughness,
      anisotropyTangent,
      anisotropyStrength
    );

    // Apply directional light
    for (var i = 0; i < lighting.directionalLightCount; i++) {
      if (i < lighting.directionalLightCount) {
        PBRInfo_setDirectionalLight(&pbrInfo, lighting_getDirectionalLight(i).direction);
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getDirectionalLight(i).color,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }

    // Apply point light
    for (var i = 0; i < lighting.pointLightCount; i++) {
      if (i < lighting.pointLightCount) {
        PBRInfo_setPointLight(&pbrInfo, lighting_getPointLight(i));
        let attenuation = getPointLightAttenuation(
          lighting_getPointLight(i),
          distance(lighting_getPointLight(i).position, fragmentInputs.pbr_vPosition)
        );
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getPointLight(i).color / attenuation,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }

    for (var i = 0; i < lighting.spotLightCount; i++) {
      if (i < lighting.spotLightCount) {
        PBRInfo_setSpotLight(&pbrInfo, lighting_getSpotLight(i));
        let attenuation = getSpotLightAttenuation(lighting_getSpotLight(i), fragmentInputs.pbr_vPosition);
        color += calculateMaterialLightColor(
          pbrInfo,
          lighting_getSpotLight(i).color / attenuation,
          clearcoatNormal,
          clearcoatFactor,
          clearcoatRoughness,
          sheenColor,
          sheenRoughness,
          anisotropyTangent,
          anisotropyStrength
        );
      }
    }
    #endif

    // Calculate lighting contribution from image based lighting source (IBL)
    #ifdef USE_IBL
    if (pbrMaterial.IBLenabled != 0) {
      color += getIBLContribution(pbrInfo, n, reflection) *
        calculateAnisotropyBoost(pbrInfo, anisotropyTangent, anisotropyStrength);
      color += calculateClearcoatIBLContribution(
        pbrInfo,
        clearcoatNormal,
        -normalize(reflect(v, clearcoatNormal)),
        clearcoatFactor,
        clearcoatRoughness
      );
      color += sheenColor * pbrMaterial.scaleIBLAmbient.x * (1.0 - sheenRoughness) * 0.25;
    }
    #endif

    // Apply optional PBR terms for additional (optional) shading
    #ifdef HAS_OCCLUSIONMAP
    if (pbrMaterial.occlusionMapEnabled != 0) {
      let ao = textureSample(pbr_occlusionSampler, pbr_occlusionSamplerSampler, occlusionUV).r;
      color = mix(color, color * ao, pbrMaterial.occlusionStrength);
    }
    #endif

    var emissive = pbrMaterial.emissiveFactor;
    #ifdef HAS_EMISSIVEMAP
    if (pbrMaterial.emissiveMapEnabled != 0u) {
      emissive *= SRGBtoLINEAR(
        textureSample(pbr_emissiveSampler, pbr_emissiveSamplerSampler, emissiveUV)
      ).rgb;
    }
    #endif
    color += emissive * pbrMaterial.emissiveStrength;

    if (transmission > 0.0) {
      color = mix(color, color * getVolumeAttenuation(thickness), transmission);
    }

    // This section uses mix to override final color for reference app visualization
    // of various parameters in the lighting equation.
    #ifdef PBR_DEBUG
    // TODO: Figure out how to debug multiple lights

    // color = mix(color, F, pbr_scaleFGDSpec.x);
    // color = mix(color, vec3(G), pbr_scaleFGDSpec.y);
    // color = mix(color, vec3(D), pbr_scaleFGDSpec.z);
    // color = mix(color, specContrib, pbr_scaleFGDSpec.w);

    // color = mix(color, diffuseContrib, pbr_scaleDiffBaseMR.x);
    color = mix(color, baseColor.rgb, pbrMaterial.scaleDiffBaseMR.y);
    color = mix(color, vec3<f32>(metallic), pbrMaterial.scaleDiffBaseMR.z);
    color = mix(color, vec3<f32>(perceptualRoughness), pbrMaterial.scaleDiffBaseMR.w);
    #endif
  }

  let alpha = clamp(baseColor.a * (1.0 - transmission), 0.0, 1.0);
  return vec4<f32>(pow(color, vec3<f32>(1.0 / 2.2)), alpha);
}
`,tu=`layout(std140) uniform pbrProjectionUniforms {
  mat4 modelViewProjectionMatrix;
  mat4 modelMatrix;
  mat4 normalMatrix;
  vec3 camera;
} pbrProjection;
`,nu={props:{},uniforms:{},defaultUniforms:{unlit:!1,baseColorMapEnabled:!1,baseColorFactor:[1,1,1,1],normalMapEnabled:!1,normalScale:1,emissiveMapEnabled:!1,emissiveFactor:[0,0,0],metallicRoughnessValues:[1,1],metallicRoughnessMapEnabled:!1,occlusionMapEnabled:!1,occlusionStrength:1,alphaCutoffEnabled:!1,alphaCutoff:.5,IBLenabled:!1,scaleIBLAmbient:[1,1],scaleDiffBaseMR:[0,0,0,0],scaleFGDSpec:[0,0,0,0],specularColorFactor:[1,1,1],specularIntensityFactor:1,specularColorMapEnabled:!1,specularIntensityMapEnabled:!1,ior:1.5,transmissionFactor:0,transmissionMapEnabled:!1,thicknessFactor:0,attenuationDistance:1e9,attenuationColor:[1,1,1],clearcoatFactor:0,clearcoatRoughnessFactor:0,clearcoatMapEnabled:!1,clearcoatRoughnessMapEnabled:!1,sheenColorFactor:[0,0,0],sheenRoughnessFactor:0,sheenColorMapEnabled:!1,sheenRoughnessMapEnabled:!1,iridescenceFactor:0,iridescenceIor:1.3,iridescenceThicknessRange:[100,400],iridescenceMapEnabled:!1,anisotropyStrength:0,anisotropyRotation:0,anisotropyDirection:[1,0],anisotropyMapEnabled:!1,emissiveStrength:1,baseColorUVSet:0,baseColorUVTransform:[1,0,0,0,1,0,0,0,1],metallicRoughnessUVSet:0,metallicRoughnessUVTransform:[1,0,0,0,1,0,0,0,1],normalUVSet:0,normalUVTransform:[1,0,0,0,1,0,0,0,1],occlusionUVSet:0,occlusionUVTransform:[1,0,0,0,1,0,0,0,1],emissiveUVSet:0,emissiveUVTransform:[1,0,0,0,1,0,0,0,1],specularColorUVSet:0,specularColorUVTransform:[1,0,0,0,1,0,0,0,1],specularIntensityUVSet:0,specularIntensityUVTransform:[1,0,0,0,1,0,0,0,1],transmissionUVSet:0,transmissionUVTransform:[1,0,0,0,1,0,0,0,1],thicknessUVSet:0,thicknessUVTransform:[1,0,0,0,1,0,0,0,1],clearcoatUVSet:0,clearcoatUVTransform:[1,0,0,0,1,0,0,0,1],clearcoatRoughnessUVSet:0,clearcoatRoughnessUVTransform:[1,0,0,0,1,0,0,0,1],clearcoatNormalUVSet:0,clearcoatNormalUVTransform:[1,0,0,0,1,0,0,0,1],sheenColorUVSet:0,sheenColorUVTransform:[1,0,0,0,1,0,0,0,1],sheenRoughnessUVSet:0,sheenRoughnessUVTransform:[1,0,0,0,1,0,0,0,1],iridescenceUVSet:0,iridescenceUVTransform:[1,0,0,0,1,0,0,0,1],iridescenceThicknessUVSet:0,iridescenceThicknessUVTransform:[1,0,0,0,1,0,0,0,1],anisotropyUVSet:0,anisotropyUVTransform:[1,0,0,0,1,0,0,0,1]},name:`pbrMaterial`,firstBindingSlot:0,bindingLayout:[{name:`pbrMaterial`,group:3},{name:`pbr_baseColorSampler`,group:3},{name:`pbr_normalSampler`,group:3},{name:`pbr_emissiveSampler`,group:3},{name:`pbr_metallicRoughnessSampler`,group:3},{name:`pbr_occlusionSampler`,group:3},{name:`pbr_specularColorSampler`,group:3},{name:`pbr_specularIntensitySampler`,group:3},{name:`pbr_transmissionSampler`,group:3},{name:`pbr_thicknessSampler`,group:3},{name:`pbr_clearcoatSampler`,group:3},{name:`pbr_clearcoatRoughnessSampler`,group:3},{name:`pbr_clearcoatNormalSampler`,group:3},{name:`pbr_sheenColorSampler`,group:3},{name:`pbr_sheenRoughnessSampler`,group:3},{name:`pbr_iridescenceSampler`,group:3},{name:`pbr_iridescenceThicknessSampler`,group:3},{name:`pbr_anisotropySampler`,group:3}],dependencies:[Fl,Zl,{name:`pbrProjection`,bindingLayout:[{name:`pbrProjection`,group:0}],source:`struct pbrProjectionUniforms {
  modelViewProjectionMatrix: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  camera: vec3<f32>
};

@group(0) @binding(auto) var<uniform> pbrProjection: pbrProjectionUniforms;
`,vs:tu,fs:tu,getUniforms:e=>e,uniformTypes:{modelViewProjectionMatrix:`mat4x4<f32>`,modelMatrix:`mat4x4<f32>`,normalMatrix:`mat4x4<f32>`,camera:`vec3<f32>`}}],source:eu,vs:Ql,fs:$l,defines:{LIGHTING_FRAGMENT:!0,HAS_NORMALMAP:!1,HAS_EMISSIVEMAP:!1,HAS_OCCLUSIONMAP:!1,HAS_BASECOLORMAP:!1,HAS_METALROUGHNESSMAP:!1,HAS_SPECULARCOLORMAP:!1,HAS_SPECULARINTENSITYMAP:!1,HAS_TRANSMISSIONMAP:!1,HAS_THICKNESSMAP:!1,HAS_CLEARCOATMAP:!1,HAS_CLEARCOATROUGHNESSMAP:!1,HAS_CLEARCOATNORMALMAP:!1,HAS_SHEENCOLORMAP:!1,HAS_SHEENROUGHNESSMAP:!1,HAS_IRIDESCENCEMAP:!1,HAS_IRIDESCENCETHICKNESSMAP:!1,HAS_ANISOTROPYMAP:!1,USE_MATERIAL_EXTENSIONS:!1,ALPHA_CUTOFF:!1,USE_IBL:!1,PBR_DEBUG:!1},getUniforms:e=>e,uniformTypes:{unlit:`i32`,baseColorMapEnabled:`i32`,baseColorFactor:`vec4<f32>`,normalMapEnabled:`i32`,normalScale:`f32`,emissiveMapEnabled:`i32`,emissiveFactor:`vec3<f32>`,metallicRoughnessValues:`vec2<f32>`,metallicRoughnessMapEnabled:`i32`,occlusionMapEnabled:`i32`,occlusionStrength:`f32`,alphaCutoffEnabled:`i32`,alphaCutoff:`f32`,specularColorFactor:`vec3<f32>`,specularIntensityFactor:`f32`,specularColorMapEnabled:`i32`,specularIntensityMapEnabled:`i32`,ior:`f32`,transmissionFactor:`f32`,transmissionMapEnabled:`i32`,thicknessFactor:`f32`,attenuationDistance:`f32`,attenuationColor:`vec3<f32>`,clearcoatFactor:`f32`,clearcoatRoughnessFactor:`f32`,clearcoatMapEnabled:`i32`,clearcoatRoughnessMapEnabled:`i32`,sheenColorFactor:`vec3<f32>`,sheenRoughnessFactor:`f32`,sheenColorMapEnabled:`i32`,sheenRoughnessMapEnabled:`i32`,iridescenceFactor:`f32`,iridescenceIor:`f32`,iridescenceThicknessRange:`vec2<f32>`,iridescenceMapEnabled:`i32`,anisotropyStrength:`f32`,anisotropyRotation:`f32`,anisotropyDirection:`vec2<f32>`,anisotropyMapEnabled:`i32`,emissiveStrength:`f32`,IBLenabled:`i32`,scaleIBLAmbient:`vec2<f32>`,scaleDiffBaseMR:`vec4<f32>`,scaleFGDSpec:`vec4<f32>`,baseColorUVSet:`i32`,baseColorUVTransform:`mat3x3<f32>`,metallicRoughnessUVSet:`i32`,metallicRoughnessUVTransform:`mat3x3<f32>`,normalUVSet:`i32`,normalUVTransform:`mat3x3<f32>`,occlusionUVSet:`i32`,occlusionUVTransform:`mat3x3<f32>`,emissiveUVSet:`i32`,emissiveUVTransform:`mat3x3<f32>`,specularColorUVSet:`i32`,specularColorUVTransform:`mat3x3<f32>`,specularIntensityUVSet:`i32`,specularIntensityUVTransform:`mat3x3<f32>`,transmissionUVSet:`i32`,transmissionUVTransform:`mat3x3<f32>`,thicknessUVSet:`i32`,thicknessUVTransform:`mat3x3<f32>`,clearcoatUVSet:`i32`,clearcoatUVTransform:`mat3x3<f32>`,clearcoatRoughnessUVSet:`i32`,clearcoatRoughnessUVTransform:`mat3x3<f32>`,clearcoatNormalUVSet:`i32`,clearcoatNormalUVTransform:`mat3x3<f32>`,sheenColorUVSet:`i32`,sheenColorUVTransform:`mat3x3<f32>`,sheenRoughnessUVSet:`i32`,sheenRoughnessUVTransform:`mat3x3<f32>`,iridescenceUVSet:`i32`,iridescenceUVTransform:`mat3x3<f32>`,iridescenceThicknessUVSet:`i32`,iridescenceThicknessUVTransform:`mat3x3<f32>`,anisotropyUVSet:`i32`,anisotropyUVTransform:`mat3x3<f32>`}},ru={};function iu(e=`id`){return ru[e]=ru[e]||1,`${e}-${ru[e]++}`}var au=class{id;userData={};topology;bufferLayout=[];vertexCount;indices;attributes;constructor(e){if(this.id=e.id||iu(`geometry`),this.topology=e.topology,this.indices=e.indices||null,this.attributes=e.attributes,this.vertexCount=e.vertexCount,this.bufferLayout=e.bufferLayout||[],this.indices&&!(this.indices.usage&P.INDEX))throw Error(`Index buffer must have INDEX usage`)}destroy(){this.indices?.destroy();for(let e of Object.values(this.attributes))e.destroy()}getVertexCount(){return this.vertexCount}getAttributes(){return this.attributes}getIndexes(){return this.indices||null}_calculateVertexCount(e){return e.byteLength/12}};function ou(e,t){if(t instanceof au)return t;let n=su(e,t),{attributes:r,bufferLayout:i}=cu(e,t);return new au({topology:t.topology||`triangle-list`,bufferLayout:i,vertexCount:t.vertexCount,indices:n,attributes:r})}function su(e,t){if(!t.indices)return;let n=t.indices.value;return e.createBuffer({usage:P.INDEX,data:n})}function cu(e,t){let n=[],r={};for(let[i,a]of Object.entries(t.attributes)){let t=i;switch(i){case`POSITION`:t=`positions`;break;case`NORMAL`:t=`normals`;break;case`TEXCOORD_0`:t=`texCoords`;break;case`TEXCOORD_1`:t=`texCoords1`;break;case`COLOR_0`:t=`colors`;break}if(a){r[t]=e.createBuffer({data:a.value,id:`${i}-buffer`});let{value:o,size:s,normalized:c}=a;if(s===void 0)throw Error(`Attribute ${i} is missing a size`);n.push({name:t,format:an.getVertexFormatFromAttribute(o,s,c)})}}return{attributes:r,bufferLayout:n,vertexCount:t._calculateVertexCount(t.attributes,t.indices)}}function lu(e,t){let n={},r=`Values`;if(e.attributes.length===0&&!e.varyings?.length)return{"No attributes or varyings":{[r]:`N/A`}};for(let t of e.attributes)if(t){let e=`${t.location} ${t.name}: ${t.type}`;n[`in ${e}`]={[r]:t.stepMode||`vertex`}}for(let t of e.varyings||[]){let e=`${t.location} ${t.name}`;n[`out ${e}`]={[r]:JSON.stringify(t)}}return n}var uu=`__debugFramebufferState`,du=8;function fu(e,t,n){if(e.device.type!==`webgl`)return;let r=hu(e.device);if(!r.flushing){if(_u(e)){pu(e,n,r);return}t&&gu(t)&&t.handle!==null&&(r.queuedFramebuffers.includes(t)||r.queuedFramebuffers.push(t))}}function pu(e,t,n){if(n.queuedFramebuffers.length===0)return;let{gl:r}=e.device,i=r.getParameter(36010),a=r.getParameter(36006),[o,s]=e.device.getDefaultCanvasContext().getDrawingBufferSize(),c=vu(t.top,du),l=vu(t.left,du);n.flushing=!0;try{for(let e of n.queuedFramebuffers){let[n,i,a,u,d]=mu({framebuffer:e,targetWidth:o,targetHeight:s,topPx:c,leftPx:l,minimap:t.minimap});r.bindFramebuffer(36008,e.handle),r.bindFramebuffer(36009,null),r.blitFramebuffer(0,0,e.width,e.height,n,i,a,u,16384,9728),c+=d+du}}finally{r.bindFramebuffer(36008,i),r.bindFramebuffer(36009,a),n.flushing=!1}}function mu(e){let{framebuffer:t,targetWidth:n,targetHeight:r,topPx:i,leftPx:a,minimap:o}=e,s=o?Math.max(Math.floor(n/4),1):n,c=o?Math.max(Math.floor(r/4),1):r,l=Math.min(s/t.width,c/t.height),u=Math.max(Math.floor(t.width*l),1),d=Math.max(Math.floor(t.height*l),1),f=a,p=Math.max(r-i-d,0);return[f,p,f+u,p+d,d]}function hu(e){return e.userData[uu]||={flushing:!1,queuedFramebuffers:[]},e.userData[uu]}function gu(e){return`colorAttachments`in e}function _u(e){let t=e.props.framebuffer;return!t||t.handle===null}function vu(e,t){if(!e)return t;let n=Number.parseInt(e,10);return Number.isFinite(n)?n:t}function yu(e,t,n){if(e===t)return!0;if(!n||!e||!t)return!1;if(Array.isArray(e)){if(!Array.isArray(t)||e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!yu(e[r],t[r],n-1))return!1;return!0}if(Array.isArray(t))return!1;if(typeof e==`object`&&typeof t==`object`){let r=Object.keys(e),i=Object.keys(t);if(r.length!==i.length)return!1;for(let i of r)if(!t.hasOwnProperty(i)||!yu(e[i],t[i],n-1))return!1;return!0}return!1}var bu=class{bufferLayouts;constructor(e){this.bufferLayouts=e}getBufferLayout(e){return this.bufferLayouts.find(t=>t.name===e)||null}getAttributeNamesForBuffer(e){return e.attributes?e.attributes?.map(e=>e.attribute):[e.name]}mergeBufferLayouts(e,t){let n=[...e];for(let e of t){let t=n.findIndex(t=>t.name===e.name);t<0?n.push(e):n[t]=e}return n}getBufferIndex(e){let t=this.bufferLayouts.findIndex(t=>t.name===e);return t===-1&&M.warn(`BufferLayout: Missing buffer for "${e}".`)(),t}};function xu(e,t){let n=1/0;for(let r of e){let e=t[r];e!==void 0&&(n=Math.min(n,e))}return n}function Su(e,t){let n=Object.fromEntries(e.attributes.map(e=>[e.name,e.location])),r=t.slice();return r.sort((e,t)=>{let r=e.attributes?e.attributes.map(e=>e.attribute):[e.name],i=t.attributes?t.attributes.map(e=>e.attribute):[t.name];return xu(r,n)-xu(i,n)}),r}function Cu(e,t){if(!e||!t.some(e=>e.bindingLayout?.length))return e;let n={...e,bindings:e.bindings.map(e=>({...e}))};`attributes`in(e||{})&&(n.attributes=e?.attributes||[]);for(let e of t)for(let t of e.bindingLayout||[])for(let e of Tu(t.name)){let r=n.bindings.find(t=>t.name===e);r?.group===0&&(r.group=t.group)}return n}function wu(e){return!!(e.uniformTypes&&!Eu(e.uniformTypes))}function Tu(e){let t=new Set([e,`${e}Uniforms`]);return e.endsWith(`Uniforms`)||t.add(`${e}Sampler`),[...t]}function Eu(e){for(let t in e)return!1;return!0}function Du(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Ou(e){return Array.isArray(e)?e.length===0||typeof e[0]==`number`:!1}function ku(e){return Du(e)||Ou(e)}function Au(e){return ku(e)||typeof e==`number`||typeof e==`boolean`}function ju(e,t={}){let n={bindings:{},uniforms:{}};return Object.keys(e).forEach(r=>{let i=e[r];Object.prototype.hasOwnProperty.call(t,r)||Au(i)?n.uniforms[r]=i:n.bindings[r]=i}),n}var Mu=class{options={disableWarnings:!1};modules;moduleUniforms;moduleBindings;constructor(e,t){Object.assign(this.options,t);let n=Xi(Object.values(e).filter(Ru));for(let t of n)e[t.name]=t;M.log(1,`Creating ShaderInputs with modules`,Object.keys(e))(),this.modules=e,this.moduleUniforms={},this.moduleBindings={};for(let[t,n]of Object.entries(e))n&&(this._addModule(n),n.name&&t!==n.name&&!this.options.disableWarnings&&M.warn(`Module name: ${t} vs ${n.name}`)())}destroy(){}setProps(e){for(let t of Object.keys(e)){let n=t,r=e[n]||{},i=this.modules[n];if(!i)this.options.disableWarnings||M.warn(`Module ${t} not found`)();else{let e=this.moduleUniforms[n],t=this.moduleBindings[n],{uniforms:a,bindings:o}=ju(i.getUniforms?.(r,e)||r,i.uniformTypes);this.moduleUniforms[n]=Nu(e,a,i.uniformTypes),this.moduleBindings[n]={...t,...o}}}}getModules(){return Object.values(this.modules)}getUniformValues(){return this.moduleUniforms}getBindingValues(){let e={};for(let t of Object.values(this.moduleBindings))Object.assign(e,t);return e}getDebugTable(){let e={};for(let[t,n]of Object.entries(this.moduleUniforms))for(let[r,i]of Object.entries(n))e[`${t}.${r}`]={type:this.modules[t].uniformTypes?.[r],value:String(i)};return e}_addModule(e){let t=e.name;this.moduleUniforms[t]=Nu({},e.defaultUniforms||{},e.uniformTypes),this.moduleBindings[t]={}}};function Nu(e={},t={},n={}){let r={...e};for(let[i,a]of Object.entries(t))a!==void 0&&(r[i]=Pu(e[i],a,n[i]));return r}function Pu(e,t,n){if(!n||typeof n==`string`)return Fu(t);if(Array.isArray(n)){if(Iu(t)||!Array.isArray(t))return Fu(t);let r=Array.isArray(e)&&!Iu(e)?[...e]:[],i=r.slice();for(let e=0;e<t.length;e++){let a=t[e];a!==void 0&&(i[e]=Pu(r[e],a,n[0]))}return i}if(!Lu(t))return Fu(t);let r=n,i=Lu(e)?e:{},a={...i};for(let[e,n]of Object.entries(t))n!==void 0&&(a[e]=Pu(i[e],n,r[e]));return a}function Fu(e){return ArrayBuffer.isView(e)?Array.prototype.slice.call(e):Array.isArray(e)?Iu(e)?e.slice():e.map(e=>e===void 0?void 0:Fu(e)):Lu(e)?Object.fromEntries(Object.entries(e).map(([e,t])=>[e,t===void 0?void 0:Fu(t)])):e}function Iu(e){return ArrayBuffer.isView(e)||Array.isArray(e)&&(e.length===0||typeof e[0]==`number`)}function Lu(e){return!!e&&typeof e==`object`&&!Array.isArray(e)&&!ArrayBuffer.isView(e)}function Ru(e){return!!e?.dependencies}var zu={"+X":0,"-X":1,"+Y":2,"-Y":3,"+Z":4,"-Z":5};function Bu(e){return e?Array.isArray(e)?e[0]??null:e:null}function Vu(e){let{dimension:t,data:n}=e;if(!n)return null;switch(t){case`1d`:{let e=Bu(n);if(!e)return null;let{width:t}=Hu(e);return{width:t,height:1}}case`2d`:{let e=Bu(n);return e?Hu(e):null}case`3d`:case`2d-array`:{if(!Array.isArray(n)||n.length===0)return null;let e=Bu(n[0]);return e?Hu(e):null}case`cube`:{let e=Object.keys(n)[0]??null;if(!e)return null;let t=n[e],r=Bu(t);return r?Hu(r):null}case`cube-array`:{if(!Array.isArray(n)||n.length===0)return null;let e=n[0],t=Object.keys(e)[0]??null;if(!t)return null;let r=Bu(e[t]);return r?Hu(r):null}default:return null}}function Hu(e){if(In(e))return Ln(e);if(typeof e==`object`&&`width`in e&&`height`in e)return{width:e.width,height:e.height};throw Error(`Unsupported mip-level data`)}function Uu(e){return typeof e==`object`&&!!e&&`data`in e&&`width`in e&&`height`in e}function Wu(e){return ArrayBuffer.isView(e)}function Gu(e){let{textureFormat:t,format:n}=e;if(t&&n&&t!==n)throw Error(`Conflicting texture formats "${t}" and "${n}" provided for the same mip level`);return t??n}function Ku(e){let t=zu[e];if(t===void 0)throw Error(`Invalid cube face: ${e}`);return t}function qu(e,t){return 6*e+Ku(t)}function Ju(e){throw Error(`setTexture1DData not supported in WebGL.`)}function Yu(e){return Array.isArray(e)?e:[e]}function Xu(e,t,n,r){let i=Yu(t),a=e,o=[];for(let e=0;e<i.length;e++){let t=i[e];if(In(t))o.push({type:`external-image`,image:t,z:a,mipLevel:e});else if(Uu(t))o.push({type:`texture-data`,data:t,textureFormat:Gu(t),z:a,mipLevel:e});else if(Wu(t)&&n)o.push({type:`texture-data`,data:{data:t,width:Math.max(1,n.width>>e),height:Math.max(1,n.height>>e),...r?{format:r}:{}},textureFormat:r,z:a,mipLevel:e});else throw Error(`Unsupported 2D mip-level payload`)}return o}function Zu(e){let t=[];for(let n=0;n<e.length;n++)t.push(...Xu(n,e[n]));return t}function Qu(e){let t=[];for(let n=0;n<e.length;n++)t.push(...Xu(n,e[n]));return t}function $u(e){let t=[];for(let[n,r]of Object.entries(e)){let e=Ku(n);t.push(...Xu(e,r))}return t}function ed(e){let t=[];return e.forEach((e,n)=>{for(let[r,i]of Object.entries(e)){let e=qu(n,r);t.push(...Xu(e,i))}}),t}var td=class e{device;id;props;_texture=null;_sampler=null;_view=null;ready;isReady=!1;destroyed=!1;resolveReady=()=>{};rejectReady=()=>{};get texture(){if(!this._texture)throw Error(`Texture not initialized yet`);return this._texture}get sampler(){if(!this._sampler)throw Error(`Sampler not initialized yet`);return this._sampler}get view(){if(!this._view)throw Error(`View not initialized yet`);return this._view}get[Symbol.toStringTag](){return`DynamicTexture`}toString(){let e=this._texture?.width??this.props.width??`?`,t=this._texture?.height??this.props.height??`?`;return`DynamicTexture:"${this.id}":${e}x${t}px:(${this.isReady?`ready`:`loading...`})`}constructor(t,n){this.device=t;let r=iu(`dynamic-texture`),i=n;this.props={...e.defaultProps,id:r,...n,data:null},this.id=this.props.id,this.ready=new Promise((e,t)=>{this.resolveReady=e,this.rejectReady=t}),this.initAsync(i)}async initAsync(e){try{let t=await this._loadAllData(e);this._checkNotDestroyed();let n=t.data?nd({...t,width:e.width,height:e.height,format:e.format}):[],r=`format`in e&&e.format!==void 0,i=`usage`in e&&e.usage!==void 0,a=this.props.width&&this.props.height?{width:this.props.width,height:this.props.height}:Vu(t)||{width:this.props.width||1,height:this.props.height||1};if(!a||a.width<=0||a.height<=0)throw Error(`${this} size could not be determined or was zero`);let o=rd(this.device,n,a,{format:r?e.format:void 0}),s=o.format??this.props.format,c={...this.props,...a,format:s,mipLevels:1,data:void 0};this.device.isTextureFormatCompressed(s)&&!i&&(c.usage=I.SAMPLE|I.COPY_DST);let l=this.props.mipmaps&&!o.hasExplicitMipChain&&!this.device.isTextureFormatCompressed(s);if(this.device.type===`webgpu`&&l){let e=this.props.dimension===`3d`?I.SAMPLE|I.STORAGE|I.COPY_DST|I.COPY_SRC:I.SAMPLE|I.RENDER|I.COPY_DST|I.COPY_SRC;c.usage|=e}let u=this.device.getMipLevelCount(c.width,c.height),d=o.hasExplicitMipChain?o.mipLevels:this.props.mipLevels===`auto`?u:Math.max(1,Math.min(u,this.props.mipLevels??1)),f={...c,mipLevels:d};this._texture=this.device.createTexture(f),this._sampler=this.texture.sampler,this._view=this.texture.view,o.subresources.length&&this._setTextureSubresources(o.subresources),this.props.mipmaps&&!o.hasExplicitMipChain&&!l&&M.warn(`${this} skipping auto-generated mipmaps for compressed texture format`)(),l&&this.generateMipmaps(),this.isReady=!0,this.resolveReady(this.texture),M.info(0,`${this} created`)()}catch(e){let t=e instanceof Error?e:Error(String(e));this.rejectReady(t)}}destroy(){this._texture&&(this._texture.destroy(),this._texture=null,this._sampler=null,this._view=null),this.destroyed=!0}generateMipmaps(){this.device.type===`webgl`?this.texture.generateMipmapsWebGL():this.device.type===`webgpu`?this.device.generateMipmapsWebGPU(this.texture):M.warn(`${this} mipmaps not supported on ${this.device.type}`)}setSampler(e={}){this._checkReady();let t=e instanceof cr?e:this.device.createSampler(e);this.texture.setSampler(t),this._sampler=t}async readBuffer(e={}){this.isReady||await this.ready;let t=e.width??this.texture.width,n=e.height??this.texture.height,r=e.depthOrArrayLayers??this.texture.depth,i=this.texture.computeMemoryLayout({width:t,height:n,depthOrArrayLayers:r}),a=this.device.createBuffer({byteLength:i.byteLength,usage:P.COPY_DST|P.MAP_READ});this.texture.readBuffer({...e,width:t,height:n,depthOrArrayLayers:r},a);let o=this.device.createFence();return await o.signaled,o.destroy(),a}async readAsync(e={}){this.isReady||await this.ready;let t=e.width??this.texture.width,n=e.height??this.texture.height,r=e.depthOrArrayLayers??this.texture.depth,i=this.texture.computeMemoryLayout({width:t,height:n,depthOrArrayLayers:r}),a=await this.readBuffer(e),o=await a.readAsync(0,i.byteLength);return a.destroy(),o.buffer}resize(e){if(this._checkReady(),e.width===this.texture.width&&e.height===this.texture.height)return!1;let t=this.texture;return this._texture=t.clone(e),this._sampler=this.texture.sampler,this._view=this.texture.view,t.destroy(),M.info(`${this} resized`),!0}getCubeFaceIndex(e){let t=zu[e];if(t===void 0)throw Error(`Invalid cube face: ${e}`);return t}getCubeArrayFaceIndex(e,t){return 6*e+this.getCubeFaceIndex(t)}setTexture1DData(e){if(this._checkReady(),this.texture.props.dimension!==`1d`)throw Error(`${this} is not 1d`);let t=Ju(e);this._setTextureSubresources(t)}setTexture2DData(e,t=0){if(this._checkReady(),this.texture.props.dimension!==`2d`)throw Error(`${this} is not 2d`);let n=Xu(t,e);this._setTextureSubresources(n)}setTexture3DData(e){if(this.texture.props.dimension!==`3d`)throw Error(`${this} is not 3d`);let t=Zu(e);this._setTextureSubresources(t)}setTextureArrayData(e){if(this.texture.props.dimension!==`2d-array`)throw Error(`${this} is not 2d-array`);let t=Qu(e);this._setTextureSubresources(t)}setTextureCubeData(e){if(this.texture.props.dimension!==`cube`)throw Error(`${this} is not cube`);let t=$u(e);this._setTextureSubresources(t)}setTextureCubeArrayData(e){if(this.texture.props.dimension!==`cube-array`)throw Error(`${this} is not cube-array`);let t=ed(e);this._setTextureSubresources(t)}_setTextureSubresources(e){for(let t of e){let{z:e,mipLevel:n}=t;switch(t.type){case`external-image`:let{image:r,flipY:i}=t;this.texture.copyExternalImage({image:r,z:e,mipLevel:n,flipY:i});break;case`texture-data`:let{data:a,textureFormat:o}=t;if(o&&o!==this.texture.format)throw Error(`${this} mip level ${n} uses format "${o}" but texture format is "${this.texture.format}"`);this.texture.writeData(a.data,{x:0,y:0,z:e,width:a.width,height:a.height,depthOrArrayLayers:1,mipLevel:n});break;default:throw Error(`Unsupported 2D mip-level payload`)}}}async _loadAllData(e){let t=await sd(e.data);return{dimension:e.dimension??`2d`,data:t??null}}_checkNotDestroyed(){this.destroyed&&M.warn(`${this} already destroyed`)}_checkReady(){this.isReady||M.warn(`${this} Cannot perform this operation before ready`)}static defaultProps={...I.defaultProps,dimension:`2d`,data:null,mipmaps:!1}};function nd(e){if(!e.data)return[];let t=e.width&&e.height?{width:e.width,height:e.height}:void 0,n=`format`in e?e.format:void 0;switch(e.dimension){case`1d`:return Ju(e.data);case`2d`:return Xu(0,e.data,t,n);case`3d`:return Zu(e.data);case`2d-array`:return Qu(e.data);case`cube`:return $u(e.data);case`cube-array`:return ed(e.data);default:throw Error(`Unhandled dimension ${e.dimension}`)}}function rd(e,t,n,r){if(t.length===0)return{subresources:t,mipLevels:1,format:r.format,hasExplicitMipChain:!1};let i=new Map;for(let e of t){let t=i.get(e.z)??[];t.push(e),i.set(e.z,t)}let a=t.some(e=>e.mipLevel>0),o=r.format,s=1/0,c=[];for(let[t,r]of i){let i=[...r].sort((e,t)=>e.mipLevel-t.mipLevel),a=i[0];if(!a||a.mipLevel!==0)throw Error(`DynamicTexture: slice ${t} is missing mip level 0`);let l=ad(e,a);if(l.width!==n.width||l.height!==n.height)throw Error(`DynamicTexture: slice ${t} base level dimensions ${l.width}x${l.height} do not match expected ${n.width}x${n.height}`);let u=id(a);if(u){if(o&&o!==u)throw Error(`DynamicTexture: slice ${t} base level format "${u}" does not match texture format "${o}"`);o=u}let d=o&&e.isTextureFormatCompressed(o)?od(e,l.width,l.height,o):e.getMipLevelCount(l.width,l.height),f=0;for(let t=0;t<i.length;t++){let n=i[t];if(!n||n.mipLevel!==t||t>=d)break;let r=ad(e,n),a=Math.max(1,l.width>>t),s=Math.max(1,l.height>>t);if(r.width!==a||r.height!==s)break;let u=id(n);if(u&&(o||=u,u!==o))break;f++,c.push(n)}s=Math.min(s,f)}let l=Number.isFinite(s)?Math.max(1,s):1;return{subresources:c.filter(e=>e.mipLevel<l),mipLevels:l,format:o,hasExplicitMipChain:a}}function id(e){if(e.type===`texture-data`)return e.textureFormat??Gu(e.data)}function ad(e,t){switch(t.type){case`external-image`:return e.getExternalImageSize(t.image);case`texture-data`:return{width:t.data.width,height:t.data.height};default:throw Error(`Unsupported texture subresource`)}}function od(e,t,n,r){let{blockWidth:i=1,blockHeight:a=1}=e.getTextureFormatInfo(r),o=1;for(let e=1;;e++){let r=Math.max(1,t>>e),s=Math.max(1,n>>e);if(r<i||s<a)break;o++}return o}async function sd(e){if(e=await e,Array.isArray(e))return await Promise.all(e.map(sd));if(e&&typeof e==`object`&&e.constructor===Object){let t=e,n=await Promise.all(Object.values(t).map(sd)),r=Object.keys(t),i={};for(let e=0;e<r.length;e++)i[r[e]]=n[e];return i}return e}var cd=2,ld=1e4,ud=`render pipeline initialization failed`,dd=class e{static defaultProps={...xr.defaultProps,source:void 0,vs:null,fs:null,id:`unnamed`,handle:void 0,userData:{},defines:{},modules:[],geometry:null,indexBuffer:null,attributes:{},constantAttributes:{},bindings:{},uniforms:{},varyings:[],isInstanced:void 0,instanceCount:0,vertexCount:0,shaderInputs:void 0,material:void 0,pipelineFactory:void 0,shaderFactory:void 0,transformFeedback:void 0,shaderAssembler:ko.getDefaultShaderAssembler(),debugShaders:void 0,disableWarnings:void 0};device;id;source;vs;fs;pipelineFactory;shaderFactory;userData={};parameters;topology;bufferLayout;isInstanced=void 0;instanceCount=0;vertexCount;indexBuffer=null;bufferAttributes={};constantAttributes={};bindings={};vertexArray;transformFeedback=null;pipeline;shaderInputs;material=null;_uniformStore;_attributeInfos={};_gpuGeometry=null;props;_pipelineNeedsUpdate=`newly created`;_needsRedraw=`initializing`;_destroyed=!1;_lastDrawTimestamp=-1;_bindingTable=[];get[Symbol.toStringTag](){return`Model`}toString(){return`Model(${this.id})`}constructor(t,n){this.props={...e.defaultProps,...n},n=this.props,this.id=n.id||iu(`model`),this.device=t,Object.assign(this.userData,n.userData),this.material=n.material||null;let r=Object.fromEntries(this.props.modules?.map(e=>[e.name,e])||[]),i=n.shaderInputs||new Mu(r,{disableWarnings:this.props.disableWarnings});this.setShaderInputs(i);let a=fd(t),o=(this.props.modules?.length>0?this.props.modules:this.shaderInputs?.getModules())||[];if(this.props.shaderLayout=Cu(this.props.shaderLayout,o)||null,this.device.type===`webgpu`&&this.props.source){let{source:e,getUniforms:n,bindingTable:r}=this.props.shaderAssembler.assembleWGSLShader({platformInfo:a,...this.props,modules:o});this.source=e,this._getModuleUniforms=n,this._bindingTable=r;let i=t.getShaderLayout?.(this.source);this.props.shaderLayout=Cu(this.props.shaderLayout||i||null,o)||null}else{let{vs:e,fs:t,getUniforms:n}=this.props.shaderAssembler.assembleGLSLShaderPair({platformInfo:a,...this.props,modules:o});this.vs=e,this.fs=t,this._getModuleUniforms=n,this._bindingTable=[]}this.vertexCount=this.props.vertexCount,this.instanceCount=this.props.instanceCount,this.topology=this.props.topology,this.bufferLayout=this.props.bufferLayout,this.parameters=this.props.parameters,n.geometry&&this.setGeometry(n.geometry),this.pipelineFactory=n.pipelineFactory||wr.getDefaultPipelineFactory(this.device),this.shaderFactory=n.shaderFactory||Tr.getDefaultShaderFactory(this.device),this.pipeline=this._updatePipeline(),this.vertexArray=t.createVertexArray({shaderLayout:this.pipeline.shaderLayout,bufferLayout:this.pipeline.bufferLayout}),this._gpuGeometry&&this._setGeometryAttributes(this._gpuGeometry),`isInstanced`in n&&(this.isInstanced=n.isInstanced),n.instanceCount&&this.setInstanceCount(n.instanceCount),n.vertexCount&&this.setVertexCount(n.vertexCount),n.indexBuffer&&this.setIndexBuffer(n.indexBuffer),n.attributes&&this.setAttributes(n.attributes),n.constantAttributes&&this.setConstantAttributes(n.constantAttributes),n.bindings&&this.setBindings(n.bindings),n.transformFeedback&&(this.transformFeedback=n.transformFeedback)}destroy(){this._destroyed||=(this.pipelineFactory.release(this.pipeline),this.shaderFactory.release(this.pipeline.vs),this.pipeline.fs&&this.pipeline.fs!==this.pipeline.vs&&this.shaderFactory.release(this.pipeline.fs),this._uniformStore.destroy(),this._gpuGeometry?.destroy(),!0)}needsRedraw(){this._getBindingsUpdateTimestamp()>this._lastDrawTimestamp&&this.setNeedsRedraw(`contents of bound textures or buffers updated`);let e=this._needsRedraw;return this._needsRedraw=!1,e}setNeedsRedraw(e){this._needsRedraw||=e}getBindingDebugTable(){return this._bindingTable}predraw(){this.updateShaderInputs(),this.pipeline=this._updatePipeline()}draw(e){let t=this._areBindingsLoading();if(t)return M.info(cd,`>>> DRAWING ABORTED ${this.id}: ${t} not loaded`)(),!1;try{e.pushDebugGroup(`${this}.predraw(${e})`),this.predraw()}finally{e.popDebugGroup()}let n,r=this.pipeline.isErrored;try{if(e.pushDebugGroup(`${this}.draw(${e})`),this._logDrawCallStart(),this.pipeline=this._updatePipeline(),r=this.pipeline.isErrored,r)M.info(cd,`>>> DRAWING ABORTED ${this.id}: ${ud}`)(),n=!1;else{let t=this._getBindings(),r=this._getBindGroups(),{indexBuffer:i}=this.vertexArray,a=i?i.byteLength/(i.indexType===`uint32`?4:2):void 0;n=this.pipeline.draw({renderPass:e,vertexArray:this.vertexArray,isInstanced:this.isInstanced,vertexCount:this.vertexCount,instanceCount:this.instanceCount,indexCount:a,transformFeedback:this.transformFeedback||void 0,bindings:t,bindGroups:r,_bindGroupCacheKeys:this._getBindGroupCacheKeys(),uniforms:this.props.uniforms,parameters:this.parameters,topology:this.topology})}}finally{e.popDebugGroup(),this._logDrawCallEnd()}return this._logFramebuffer(e),n?(this._lastDrawTimestamp=this.device.timestamp,this._needsRedraw=!1):r?this._needsRedraw=ud:this._needsRedraw=`waiting for resource initialization`,n}setGeometry(e){this._gpuGeometry?.destroy();let t=e&&ou(this.device,e);if(t){this.setTopology(t.topology||`triangle-list`);let e=new bu(this.bufferLayout);this.bufferLayout=e.mergeBufferLayouts(t.bufferLayout,this.bufferLayout),this.vertexArray&&this._setGeometryAttributes(t)}this._gpuGeometry=t}setTopology(e){e!==this.topology&&(this.topology=e,this._setPipelineNeedsUpdate(`topology`))}setBufferLayout(e){let t=new bu(this.bufferLayout);this.bufferLayout=this._gpuGeometry?t.mergeBufferLayouts(e,this._gpuGeometry.bufferLayout):e,this._setPipelineNeedsUpdate(`bufferLayout`),this.pipeline=this._updatePipeline(),this.vertexArray=this.device.createVertexArray({shaderLayout:this.pipeline.shaderLayout,bufferLayout:this.pipeline.bufferLayout}),this._gpuGeometry&&this._setGeometryAttributes(this._gpuGeometry)}setParameters(e){yu(e,this.parameters,2)||(this.parameters=e,this._setPipelineNeedsUpdate(`parameters`))}setInstanceCount(e){this.instanceCount=e,this.isInstanced===void 0&&e>0&&(this.isInstanced=!0),this.setNeedsRedraw(`instanceCount`)}setVertexCount(e){this.vertexCount=e,this.setNeedsRedraw(`vertexCount`)}setShaderInputs(e){this.shaderInputs=e,this._uniformStore=new Di(this.device,this.shaderInputs.modules);for(let[e,t]of Object.entries(this.shaderInputs.modules))if(wu(t)&&!this.material?.ownsModule(e)){let t=this._uniformStore.getManagedUniformBuffer(e);this.bindings[`${e}Uniforms`]=t}this.setNeedsRedraw(`shaderInputs`)}setMaterial(e){this.material=e,this.setNeedsRedraw(`material`)}updateShaderInputs(){this._uniformStore.setUniforms(this.shaderInputs.getUniformValues()),this.setBindings(this._getNonMaterialBindings(this.shaderInputs.getBindingValues())),this.setNeedsRedraw(`shaderInputs`)}setBindings(e){Object.assign(this.bindings,e),this.setNeedsRedraw(`bindings`)}setTransformFeedback(e){this.transformFeedback=e,this.setNeedsRedraw(`transformFeedback`)}setIndexBuffer(e){this.vertexArray.setIndexBuffer(e),this.setNeedsRedraw(`indexBuffer`)}setAttributes(e,t){let n=t?.disableWarnings??this.props.disableWarnings;e.indices&&M.warn(`Model:${this.id} setAttributes() - indexBuffer should be set using setIndexBuffer()`)(),this.bufferLayout=Su(this.pipeline.shaderLayout,this.bufferLayout);let r=new bu(this.bufferLayout);for(let[t,i]of Object.entries(e)){let e=r.getBufferLayout(t);if(!e){n||M.warn(`Model(${this.id}): Missing layout for buffer "${t}".`)();continue}let a=r.getAttributeNamesForBuffer(e),o=!1;for(let e of a){let t=this._attributeInfos[e];if(t){let e=this.device.type===`webgpu`?r.getBufferIndex(t.bufferName):t.location;this.vertexArray.setBuffer(e,i),o=!0}}!o&&!n&&M.warn(`Model(${this.id}): Ignoring buffer "${i.id}" for unknown attribute "${t}"`)()}this.setNeedsRedraw(`attributes`)}setConstantAttributes(e,t){for(let[n,r]of Object.entries(e)){let e=this._attributeInfos[n];e?this.vertexArray.setConstantWebGL(e.location,r):(t?.disableWarnings??this.props.disableWarnings)||M.warn(`Model "${this.id}: Ignoring constant supplied for unknown attribute "${n}"`)()}this.setNeedsRedraw(`constants`)}_areBindingsLoading(){for(let e of Object.values(this.bindings))if(e instanceof td&&!e.isReady)return e.id;for(let e of Object.values(this.material?.bindings||{}))if(e instanceof td&&!e.isReady)return e.id;return!1}_getBindings(){let e={};for(let[t,n]of Object.entries(this.bindings))n instanceof td?n.isReady&&(e[t]=n.texture):e[t]=n;return e}_getBindGroups(){let e=this.pipeline?.shaderLayout||this.props.shaderLayout||{bindings:[]},t=e.bindings.length?Ai(e,this._getBindings()):{0:this._getBindings()};if(!this.material)return t;for(let[e,n]of Object.entries(this.material.getBindingsByGroup())){let r=Number(e);t[r]={...t[r]||{},...n}}return t}_getBindGroupCacheKeys(){let e=this.material?.getBindGroupCacheKey(3);return e?{3:e}:{}}_getBindingsUpdateTimestamp(){let e=0;for(let t of Object.values(this.bindings))t instanceof ur?e=Math.max(e,t.texture.updateTimestamp):t instanceof P||t instanceof I?e=Math.max(e,t.updateTimestamp):t instanceof td?e=t.texture?Math.max(e,t.texture.updateTimestamp):1/0:t instanceof cr||(e=Math.max(e,t.buffer.updateTimestamp));return Math.max(e,this.material?.getBindingsUpdateTimestamp()||0)}_setGeometryAttributes(e){let t={...e.attributes};for(let[e]of Object.entries(t))!this.pipeline.shaderLayout.attributes.find(t=>t.name===e)&&e!==`positions`&&delete t[e];this.vertexCount=e.vertexCount,this.setIndexBuffer(e.indices||null),this.setAttributes(e.attributes,{disableWarnings:!0}),this.setAttributes(t,{disableWarnings:this.props.disableWarnings}),this.setNeedsRedraw(`geometry attributes`)}_setPipelineNeedsUpdate(e){this._pipelineNeedsUpdate||=e,this.setNeedsRedraw(e)}_updatePipeline(){if(this._pipelineNeedsUpdate){let e=null,t=null;this.pipeline&&(M.log(1,`Model ${this.id}: Recreating pipeline because "${this._pipelineNeedsUpdate}".`)(),e=this.pipeline.vs,t=this.pipeline.fs),this._pipelineNeedsUpdate=!1;let n=this.shaderFactory.createShader({id:`${this.id}-vertex`,stage:`vertex`,source:this.source||this.vs,debugShaders:this.props.debugShaders}),r=null;this.source?r=n:this.fs&&(r=this.shaderFactory.createShader({id:`${this.id}-fragment`,stage:`fragment`,source:this.source||this.fs,debugShaders:this.props.debugShaders})),this.pipeline=this.pipelineFactory.createRenderPipeline({...this.props,bindings:void 0,bufferLayout:this.bufferLayout,topology:this.topology,parameters:this.parameters,bindGroups:this._getBindGroups(),vs:n,fs:r}),this._attributeInfos=Vr(this.pipeline.shaderLayout,this.bufferLayout),e&&this.shaderFactory.release(e),t&&t!==e&&this.shaderFactory.release(t)}return this.pipeline}_lastLogTime=0;_logOpen=!1;_logDrawCallStart(){let e=M.level>3?0:ld;M.level<2||Date.now()-this._lastLogTime<e||(this._lastLogTime=Date.now(),this._logOpen=!0,M.group(cd,`>>> DRAWING MODEL ${this.id}`,{collapsed:M.level<=2})())}_logDrawCallEnd(){if(this._logOpen){let e=lu(this.pipeline.shaderLayout,this.id);M.table(cd,e)();let t=this.shaderInputs.getDebugTable();M.table(cd,t)();let n=this._getAttributeDebugTable();M.table(cd,this._attributeInfos)(),M.table(cd,n)(),M.groupEnd(cd)(),this._logOpen=!1}}_drawCount=0;_logFramebuffer(e){let t=this.device.props.debugFramebuffers;if(this._drawCount++,!t)return;let n=e.props.framebuffer;fu(e,n,{id:n?.id||`${this.id}-framebuffer`,minimap:!0})}_getAttributeDebugTable(){let e={};for(let[t,n]of Object.entries(this._attributeInfos)){let r=this.vertexArray.attributes[n.location];e[n.location]={name:t,type:n.shaderType,values:r?this._getBufferOrConstantValues(r,n.bufferDataType):`null`}}if(this.vertexArray.indexBuffer){let{indexBuffer:t}=this.vertexArray,n=t.indexType===`uint32`?new Uint32Array(t.debugData):new Uint16Array(t.debugData);e.indices={name:`indices`,type:t.indexType,values:n.toString()}}return e}_getBufferOrConstantValues(e,t){let n=nn.getTypedArrayConstructor(t);return(e instanceof P?new n(e.debugData):e).toString()}_getNonMaterialBindings(e){if(!this.material)return e;let t={};for(let[n,r]of Object.entries(e))this.material.ownsBinding(n)||(t[n]=r);return t}};function fd(e){return{type:e.type,shaderLanguage:e.info.shadingLanguage,shaderLanguageVersion:e.info.shadingLanguageVersion,gpu:e.info.gpu,features:e.features}}var pd=class{id;device;factory;shaderInputs;bindings={};_uniformStore;_bindGroupCacheToken={};constructor(e,t={}){this.id=t.id||iu(`material`),this.device=e,this.factory=t.factory||new md(e,{modules:t.modules||t.shaderInputs?.getModules()||[]});let n=Object.fromEntries((t.shaderInputs?.getModules()||this.factory.modules).map(e=>[e.name,e]));this.shaderInputs=t.shaderInputs||new Mu(n),this._uniformStore=new Di(this.device,this.shaderInputs.modules);for(let[e,t]of Object.entries(this.shaderInputs.modules))if(this.ownsModule(e)&&wu(t)){let t=this._uniformStore.getManagedUniformBuffer(e);this.bindings[`${e}Uniforms`]=t}this.updateShaderInputs(),t.bindings&&this._replaceOwnedBindings(t.bindings)}destroy(){this._uniformStore.destroy()}clone(e={}){let t=this.factory.createMaterial({id:e.id,shaderInputs:e.shaderInputs,bindings:{...this.getResourceBindings(),...e.bindings}});return e.shaderInputs||t.setProps(this.shaderInputs.getUniformValues()),e.moduleProps&&t.setProps(e.moduleProps),t}ownsBinding(e){return this.factory.ownsBinding(e)}ownsModule(e){return this.factory.ownsModule(e)}setProps(e){this.shaderInputs.setProps(e),this.updateShaderInputs()}updateShaderInputs(){this._uniformStore.setUniforms(this.shaderInputs.getUniformValues()),this._setOwnedBindings(this.shaderInputs.getBindingValues())&&(this._bindGroupCacheToken={})}getResourceBindings(){let e={};for(let[t,n]of Object.entries(this.bindings))hd(t)||(e[t]=n);return e}getBindings(){let e={},t=e;for(let[e,n]of Object.entries(this.bindings))n instanceof td?n.isReady&&(t[e]=n.texture):t[e]=n;return e}getBindingsByGroup(){return this.factory.getBindingsByGroup(this.getBindings())}getBindGroupCacheKey(e){return e===3?this._bindGroupCacheToken:null}getBindingsUpdateTimestamp(){let e=0;for(let t of Object.values(this.bindings))t instanceof ur?e=Math.max(e,t.texture.updateTimestamp):t instanceof P||t instanceof I?e=Math.max(e,t.updateTimestamp):t instanceof td?e=t.texture?Math.max(e,t.texture.updateTimestamp):1/0:t instanceof cr||(e=Math.max(e,t.buffer.updateTimestamp));return e}_replaceOwnedBindings(e){this._setOwnedBindings(e)&&(this._bindGroupCacheToken={})}_setOwnedBindings(e){let t=!1;for(let[n,r]of Object.entries(e))r!==void 0&&this.ownsBinding(n)&&this.bindings[n]!==r&&(this.bindings[n]=r,t=!0);return t}},md=class{device;modules;_materialBindingNames;_materialModuleNames;constructor(e,t={}){this.device=e,this.modules=t.modules||[];let n=new Mu(Object.fromEntries(this.modules.map(e=>[e.name,e])));this._materialBindingNames=gd(n),this._materialModuleNames=_d(n)}createMaterial(e={}){return new pd(this.device,{...e,factory:this})}getBindingNames(){return Array.from(this._materialBindingNames)}ownsBinding(e){if(this._materialBindingNames.has(e))return!0;let t=hd(e);return t?this._materialModuleNames.has(t):!1}ownsModule(e){return this._materialModuleNames.has(e)}getBindingsByGroup(e){return Object.keys(e).length>0?{3:e}:{}}};function hd(e){return e.endsWith(`Uniforms`)?e.slice(0,-8):null}function gd(e){let t=new Set;for(let n of Object.values(e.modules))for(let e of n.bindingLayout||[])e.group===3&&t.add(e.name);return t}function _d(e){let t=new Set;for(let n of Object.values(e.modules))n.name&&n.bindingLayout?.some(e=>e.group===3&&e.name===n.name)&&t.add(n.name);return t}var vd=class e{device;model;transformFeedback;static defaultProps={...dd.defaultProps,outputs:void 0,feedbackBuffers:void 0};static isSupported(e){return e?.info?.type===`webgl`}constructor(t,n=e.defaultProps){if(!e.isSupported(t))throw Error(`BufferTransform not yet implemented on WebGPU`);this.device=t,this.model=new dd(this.device,{id:n.id||`buffer-transform-model`,fs:n.fs||jo(),topology:n.topology||`point-list`,varyings:n.outputs||n.varyings,...n}),this.transformFeedback=this.device.createTransformFeedback({layout:this.model.pipeline.shaderLayout,buffers:n.feedbackBuffers}),this.model.setTransformFeedback(this.transformFeedback),Object.seal(this)}destroy(){this.model&&this.model.destroy()}delete(){this.destroy()}run(e){e?.inputBuffers&&this.model.setAttributes(e.inputBuffers),e?.outputBuffers&&this.transformFeedback.setBuffers(e.outputBuffers);let t=this.device.beginRenderPass(e);this.model.draw(t),t.end()}getBuffer(e){return this.transformFeedback.getBuffer(e)}readAsync(e){let t=this.getBuffer(e);if(!t)throw Error(`BufferTransform#getBuffer`);if(t instanceof P)return t.readAsync();let{buffer:n,byteOffset:r=0,byteLength:i=n.byteLength}=t;return n.readAsync(r,i)}};function yd(e,t){if(!e)throw Error(t)}var bd=class{id;matrix=new V;display=!0;position=new z;rotation=new z;scale=new z(1,1,1);userData={};props={};constructor(e={}){let{id:t}=e;this.id=t||iu(this.constructor.name),this._setScenegraphNodeProps(e)}getBounds(){return null}destroy(){}delete(){this.destroy()}setProps(e){return this._setScenegraphNodeProps(e),this}toString(){return`{type: ScenegraphNode, id: ${this.id})}`}setPosition(e){return yd(e.length===3,`setPosition requires vector argument`),this.position=e,this}setRotation(e){return yd(e.length===3||e.length===4,`setRotation requires vector argument`),this.rotation=e,this}setScale(e){return yd(e.length===3,`setScale requires vector argument`),this.scale=e,this}setMatrix(e,t=!0){t?this.matrix.copy(e):this.matrix=e}setMatrixComponents(e){let{position:t,rotation:n,scale:r,update:i=!0}=e;return t&&this.setPosition(t),n&&this.setRotation(n),r&&this.setScale(r),i&&this.updateMatrix(),this}updateMatrix(){if(this.matrix.identity(),this.matrix.translate(this.position),this.rotation.length===4){let e=new V().fromQuaternion(this.rotation);this.matrix.multiplyRight(e)}else this.matrix.rotateXYZ(this.rotation);return this.matrix.scale(this.scale),this}update({position:e,rotation:t,scale:n}={}){return e&&this.setPosition(e),t&&this.setRotation(t),n&&this.setScale(n),this.updateMatrix(),this}getCoordinateUniforms(e,t){t||=this.matrix;let n=new V(e).multiplyRight(t),r=n.invert(),i=r.transpose();return{viewMatrix:e,modelMatrix:t,objectMatrix:t,worldMatrix:n,worldInverseMatrix:r,worldInverseTransposeMatrix:i}}_setScenegraphNodeProps(e){e?.position&&this.setPosition(e.position),e?.rotation&&this.setRotation(e.rotation),e?.scale&&this.setScale(e.scale),this.updateMatrix(),e?.matrix&&this.setMatrix(e.matrix),Object.assign(this.props,e)}},xd=class e extends bd{children;constructor(e={}){e=Array.isArray(e)?{children:e}:e;let{children:t=[]}=e;M.assert(t.every(e=>e instanceof bd),`every child must an instance of ScenegraphNode`),super(e),this.children=t}getBounds(){let e=[[1/0,1/0,1/0],[-1/0,-1/0,-1/0]];return this.traverse((t,{worldMatrix:n})=>{let r=t.getBounds();if(!r)return;let[i,a]=r,o=new z(i).add(a).divide([2,2,2]);n.transformAsPoint(o,o);let s=new z(a).subtract(i).divide([2,2,2]);n.transformAsVector(s,s);for(let t=0;t<8;t++){let n=new z(t&1?-1:1,t&2?-1:1,t&4?-1:1).multiply(s).add(o);for(let t=0;t<3;t++)e[0][t]=Math.min(e[0][t],n[t]),e[1][t]=Math.max(e[1][t],n[t])}}),Number.isFinite(e[0][0])?e:null}destroy(){this.children.forEach(e=>e.destroy()),this.removeAll(),super.destroy()}add(...e){for(let t of e)Array.isArray(t)?this.add(...t):this.children.push(t);return this}remove(e){let t=this.children,n=t.indexOf(e);return n>-1&&t.splice(n,1),this}removeAll(){return this.children=[],this}traverse(t,{worldMatrix:n=new V}={}){let r=new V(n).multiplyRight(this.matrix);for(let n of this.children)n instanceof e?n.traverse(t,{worldMatrix:r}):t(n,{worldMatrix:r})}preorderTraversal(t,{worldMatrix:n=new V}={}){let r=new V(n).multiplyRight(this.matrix);t(this,{worldMatrix:r});for(let n of this.children)n instanceof e?n.preorderTraversal(t,{worldMatrix:r}):t(n,{worldMatrix:r})}},Sd=class extends bd{model;bounds=null;managedResources;constructor(e){super(e),this.model=e.model,this.managedResources=e.managedResources||[],this.bounds=e.bounds||null,this.setProps(e)}destroy(){this.model&&=(this.model.destroy(),null),this.managedResources.forEach(e=>e.destroy()),this.managedResources=[]}getBounds(){return this.bounds}draw(e){return this.model.draw(e)}},Cd=class{id;topology;vertexCount;indices;attributes;userData={};constructor(e){let{attributes:t={},indices:n=null,vertexCount:r=null}=e;this.id=e.id||iu(`geometry`),this.topology=e.topology,n&&(this.indices=ArrayBuffer.isView(n)?{value:n,size:1}:n),this.attributes={};for(let[e,n]of Object.entries(t)){let t=ArrayBuffer.isView(n)?{value:n}:n;if(!ArrayBuffer.isView(t.value))throw Error(`${this._print(e)}: must be typed array or object with value as typed array`);if((e===`POSITION`||e===`positions`)&&!t.size&&(t.size=3),e===`indices`){if(this.indices)throw Error(`Multiple indices detected`);this.indices=t}else this.attributes[e]=t}this.indices&&this.indices.isIndexed!==void 0&&(this.indices=Object.assign({},this.indices),delete this.indices.isIndexed),this.vertexCount=r||this._calculateVertexCount(this.attributes,this.indices)}getVertexCount(){return this.vertexCount}getAttributes(){return this.indices?{indices:this.indices,...this.attributes}:this.attributes}_print(e){return`Geometry ${this.id} attribute ${e}`}_setAttributes(e,t){return this}_calculateVertexCount(e,t){if(t)return t.value.length;let n=1/0;for(let t of Object.values(e)){let{value:e,size:r,constant:i}=t;!i&&e&&r!==void 0&&r>=1&&(n=Math.min(n,e.length/r))}return n}},wd={name:`color`,dependencies:[],source:`

@must_use
fn deckgl_premultiplied_alpha(fragColor: vec4<f32>) -> vec4<f32> {
    return vec4(fragColor.rgb * fragColor.a, fragColor.a); 
};
`,getUniforms:e=>({})},Td=`const SMOOTH_EDGE_RADIUS: f32 = 0.5;

struct VertexGeometry {
  position: vec4<f32>,
  worldPosition: vec3<f32>,
  worldPositionAlt: vec3<f32>,
  normal: vec3<f32>,
  uv: vec2<f32>,
  pickingColor: vec3<f32>,
};

var<private> geometry_: VertexGeometry = VertexGeometry(
  vec4<f32>(0.0, 0.0, 1.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec2<f32>(0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0)
);

struct FragmentGeometry {
  uv: vec2<f32>,
};

var<private> fragmentGeometry: FragmentGeometry;

fn smoothedge(edge: f32, x: f32) -> f32 {
  return smoothstep(edge - SMOOTH_EDGE_RADIUS, edge + SMOOTH_EDGE_RADIUS, x);
}
`,Ed=`#define SMOOTH_EDGE_RADIUS 0.5`,Dd={name:`geometry`,source:Td,vs:`\
${Ed}

struct VertexGeometry {
  vec4 position;
  vec3 worldPosition;
  vec3 worldPositionAlt;
  vec3 normal;
  vec2 uv;
  vec3 pickingColor;
} geometry = VertexGeometry(
  vec4(0.0, 0.0, 1.0, 0.0),
  vec3(0.0),
  vec3(0.0),
  vec3(0.0),
  vec2(0.0),
  vec3(0.0)
);
`,fs:`\
${Ed}

struct FragmentGeometry {
  vec2 uv;
} geometry;

float smoothedge(float edge, float x) {
  return smoothstep(edge - SMOOTH_EDGE_RADIUS, edge + SMOOTH_EDGE_RADIUS, x);
}
`};function Od(e,t){if(e===t)return!0;if(Array.isArray(e)){let n=e.length;if(!t||t.length!==n)return!1;for(let r=0;r<n;r++)if(e[r]!==t[r])return!1;return!0}return!1}function kd(e){let t={},n;return r=>{for(let i in r)if(!Od(r[i],t[i])){n=e(r),t=r;break}return n}}var Ad=[0,0,0,0],jd=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],Md=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],Nd=[0,0,0],Pd=[0,0,0],Fd={default:-1,cartesian:0,lnglat:1,"meter-offsets":2,"lnglat-offsets":3};function Id(e){let t=Fd[e];if(t===void 0)throw Error(`Invalid coordinateSystem: ${e}`);return t}var Ld=kd(Vd);function Rd(e,t,n=Pd){n.length<3&&(n=[n[0],n[1],0]);let r=n,i,a=!0;switch(i=t===`lnglat-offsets`||t===`meter-offsets`?n:e.isGeospatial?[Math.fround(e.longitude),Math.fround(e.latitude),0]:null,e.projectionMode){case Ct.WEB_MERCATOR:(t===`lnglat`||t===`cartesian`)&&(i=[0,0,0],a=!1);break;case Ct.WEB_MERCATOR_AUTO_OFFSET:t===`lnglat`?r=i:t===`cartesian`&&(r=[Math.fround(e.center[0]),Math.fround(e.center[1]),0],i=e.unprojectPosition(r),r[0]-=n[0],r[1]-=n[1],r[2]-=n[2]);break;case Ct.IDENTITY:r=e.position.map(Math.fround),r[2]=r[2]||0;break;case Ct.GLOBE:a=!1,i=null;break;default:a=!1}return{geospatialOrigin:i,shaderCoordinateOrigin:r,offsetMode:a}}function zd(e,t,n){let{viewMatrixUncentered:r,projectionMatrix:i}=e,{viewMatrix:a,viewProjectionMatrix:o}=e,s=Ad,c=Ad,l=e.cameraPosition,{geospatialOrigin:u,shaderCoordinateOrigin:d,offsetMode:f}=Rd(e,t,n);return f&&(c=e.projectPosition(u||d),l=[l[0]-c[0],l[1]-c[1],l[2]-c[2]],c[3]=1,s=Bc([],c,o),a=r||a,o=_c([],i,a),o=_c([],o,jd)),{viewMatrix:a,viewProjectionMatrix:o,projectionCenter:s,originCommon:c,cameraPosCommon:l,shaderCoordinateOrigin:d,geospatialOrigin:u}}function Bd({viewport:e,devicePixelRatio:t=1,modelMatrix:n=null,coordinateSystem:r=`default`,coordinateOrigin:i=Pd,autoWrapLongitude:a=!1}){r==="default"&&(r=e.isGeospatial?`lnglat`:`cartesian`);let o=Ld({viewport:e,devicePixelRatio:t,coordinateSystem:r,coordinateOrigin:i});return o.wrapLongitude=a,o.modelMatrix=n||Md,o}function Vd({viewport:e,devicePixelRatio:t,coordinateSystem:n,coordinateOrigin:r}){let{projectionCenter:i,viewProjectionMatrix:a,originCommon:o,cameraPosCommon:s,shaderCoordinateOrigin:c,geospatialOrigin:l}=zd(e,n,r),u=e.getDistanceScales(),d=[e.width*t,e.height*t],f=Bc([],[0,0,-e.focalDistance,1],e.projectionMatrix)[3]||1,p={coordinateSystem:Id(n),projectionMode:e.projectionMode,coordinateOrigin:c,commonOrigin:o.slice(0,3),center:i,pseudoMeters:!!e._pseudoMeters,viewportSize:d,devicePixelRatio:t,focalDistance:f,commonUnitsPerMeter:u.unitsPerMeter,commonUnitsPerWorldUnit:u.unitsPerMeter,commonUnitsPerWorldUnit2:Nd,scale:e.scale,wrapLongitude:!1,viewProjectionMatrix:a,modelMatrix:Md,cameraPosition:s};if(l){let t=e.getDistanceScales(l);switch(n){case`meter-offsets`:p.commonUnitsPerWorldUnit=t.unitsPerMeter,p.commonUnitsPerWorldUnit2=t.unitsPerMeter2;break;case`lnglat`:case`lnglat-offsets`:e._pseudoMeters||(p.commonUnitsPerMeter=t.unitsPerMeter),p.commonUnitsPerWorldUnit=t.unitsPerDegree,p.commonUnitsPerWorldUnit2=t.unitsPerDegree2;break;case`cartesian`:p.commonUnitsPerWorldUnit=[1,1,t.unitsPerMeter[2]],p.commonUnitsPerWorldUnit2=[0,0,t.unitsPerMeter2[2]];break;default:break}}return p}var Hd=`\
${`\
${[`default`,`lnglat`,`meter-offsets`,`lnglat-offsets`,`cartesian`].map(e=>`const COORDINATE_SYSTEM_${e.toUpperCase().replaceAll(`-`,`_`)}: i32 = ${Id(e)};`).join(``)}
${Object.keys(Ct).map(e=>`const PROJECTION_MODE_${e}: i32 = ${Ct[e]};`).join(``)}
${Object.keys(wt).map(e=>`const UNIT_${e.toUpperCase()}: i32 = ${wt[e]};`).join(``)}

const TILE_SIZE: f32 = 512.0;
const PI: f32 = 3.1415926536;
const WORLD_SCALE: f32 = TILE_SIZE / (PI * 2.0);
const ZERO_64_LOW: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
const EARTH_RADIUS: f32 = 6370972.0; // meters
const GLOBE_RADIUS: f32 = 256.0;

// -----------------------------------------------------------------------------
// Uniform block (converted from GLSL uniform block)
// -----------------------------------------------------------------------------
struct ProjectUniforms {
  wrapLongitude: i32,
  coordinateSystem: i32,
  commonUnitsPerMeter: vec3<f32>,
  projectionMode: i32,
  scale: f32,
  commonUnitsPerWorldUnit: vec3<f32>,
  commonUnitsPerWorldUnit2: vec3<f32>,
  center: vec4<f32>,
  modelMatrix: mat4x4<f32>,
  viewProjectionMatrix: mat4x4<f32>,
  viewportSize: vec2<f32>,
  devicePixelRatio: f32,
  focalDistance: f32,
  cameraPosition: vec3<f32>,
  coordinateOrigin: vec3<f32>,
  commonOrigin: vec3<f32>,
  pseudoMeters: i32,
};

@group(0) @binding(auto)
var<uniform> project: ProjectUniforms;

// -----------------------------------------------------------------------------
// Geometry data shared across the project helpers.
// The active layer shader is responsible for populating this private module
// state before calling the project functions below.
// -----------------------------------------------------------------------------

// Structure to carry additional geometry data used by deck.gl filters.
struct Geometry {
  worldPosition: vec3<f32>,
  worldPositionAlt: vec3<f32>,
  position: vec4<f32>,
  normal: vec3<f32>,
  uv: vec2<f32>,
  pickingColor: vec3<f32>,
};

var<private> geometry: Geometry;
`}

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

// Returns an adjustment factor for commonUnitsPerMeter
fn _project_size_at_latitude(lat: f32) -> f32 {
  let y = clamp(lat, -89.9, 89.9);
  return 1.0 / cos(radians(y));
}

// Overloaded version: scales a value in meters at a given latitude.
fn _project_size_at_latitude_m(meters: f32, lat: f32) -> f32 {
  return meters * project.commonUnitsPerMeter.z * _project_size_at_latitude(lat);
}

// Computes a non-linear scale factor based on geometry.
// (Note: This function relies on "geometry" being provided.)
fn project_size() -> f32 {
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR &&
      project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT &&
      project.pseudoMeters == 0) {
    if (geometry.position.w == 0.0) {
      return _project_size_at_latitude(geometry.worldPosition.y);
    }
    let y: f32 = geometry.position.y / TILE_SIZE * 2.0 - 1.0;
    let y2 = y * y;
    let y4 = y2 * y2;
    let y6 = y4 * y2;
    return 1.0 + 4.9348 * y2 + 4.0587 * y4 + 1.5642 * y6;
  }
  return 1.0;
}

// Overloads to scale offsets (meters to world units)
fn project_size_float(meters: f32) -> f32 {
  return meters * project.commonUnitsPerMeter.z * project_size();
}

fn project_size_vec2(meters: vec2<f32>) -> vec2<f32> {
  return meters * project.commonUnitsPerMeter.xy * project_size();
}

fn project_size_vec3(meters: vec3<f32>) -> vec3<f32> {
  return meters * project.commonUnitsPerMeter * project_size();
}

fn project_size_vec4(meters: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(meters.xyz * project.commonUnitsPerMeter, meters.w);
}

// Returns a rotation matrix aligning the z‑axis with the given up vector.
fn project_get_orientation_matrix(up: vec3<f32>) -> mat3x3<f32> {
  let uz = normalize(up);
  let ux = select(
    vec3<f32>(1.0, 0.0, 0.0),
    normalize(vec3<f32>(uz.y, -uz.x, 0.0)),
    abs(uz.z) == 1.0
  );
  let uy = cross(uz, ux);
  return mat3x3<f32>(ux, uy, uz);
}

// Since WGSL does not support "out" parameters, we return a struct.
struct RotationResult {
  needsRotation: bool,
  transform: mat3x3<f32>,
};

fn project_needs_rotation(commonPosition: vec3<f32>) -> RotationResult {
  if (project.projectionMode == PROJECTION_MODE_GLOBE) {
    return RotationResult(true, project_get_orientation_matrix(commonPosition));
  } else {
    return RotationResult(false, mat3x3<f32>());  // identity alternative if needed
  };
}

// Projects a normal vector from the current coordinate system to world space.
fn project_normal(vector: vec3<f32>) -> vec3<f32> {
  let normal_modelspace = project.modelMatrix * vec4<f32>(vector, 0.0);
  var n = normalize(normal_modelspace.xyz * project.commonUnitsPerMeter);
  let rotResult = project_needs_rotation(geometry.position.xyz);
  if (rotResult.needsRotation) {
    n = rotResult.transform * n;
  }
  return n;
}

// Applies a scale offset based on y-offset (dy)
fn project_offset_(offset: vec4<f32>) -> vec4<f32> {
  let dy: f32 = offset.y;
  let commonUnitsPerWorldUnit = project.commonUnitsPerWorldUnit + project.commonUnitsPerWorldUnit2 * dy;
  return vec4<f32>(offset.xyz * commonUnitsPerWorldUnit, offset.w);
}

// Projects lng/lat coordinates to a unit tile [0,1]
fn project_mercator_(lnglat: vec2<f32>) -> vec2<f32> {
  var x = lnglat.x;
  if (project.wrapLongitude != 0) {
    x = ((x + 180.0) % 360.0) - 180.0;
  }
  let y = clamp(lnglat.y, -89.9, 89.9);
  return vec2<f32>(
    radians(x) + PI,
    PI + log(tan(PI * 0.25 + radians(y) * 0.5))
  ) * WORLD_SCALE;
}

// Projects lng/lat/z coordinates for a globe projection.
fn project_globe_(lnglatz: vec3<f32>) -> vec3<f32> {
  let lambda = radians(lnglatz.x);
  let phi = radians(lnglatz.y);
  let cosPhi = cos(phi);
  let D = (lnglatz.z / EARTH_RADIUS + 1.0) * GLOBE_RADIUS;
  return vec3<f32>(
    sin(lambda) * cosPhi,
    -cos(lambda) * cosPhi,
    sin(phi)
  ) * D;
}

// Projects positions (with an optional 64-bit low part) from the input
// coordinate system to the common space.
fn project_position_vec4_f64(position: vec4<f32>, position64Low: vec3<f32>) -> vec4<f32> {
  var position_world = project.modelMatrix * position;

  // Work around for a Mac+NVIDIA bug:
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      return vec4<f32>(
        project_mercator_(position_world.xy),
        _project_size_at_latitude_m(position_world.z, position_world.y),
        position_world.w
      );
    }
    if (project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN) {
      position_world = vec4f(position_world.xyz + project.coordinateOrigin, position_world.w);
    }
  }
  if (project.projectionMode == PROJECTION_MODE_GLOBE) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      return vec4<f32>(
        project_globe_(position_world.xyz),
        position_world.w
      );
    }
  }
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      if (abs(position_world.y - project.coordinateOrigin.y) > 0.25) {
        return vec4<f32>(
          project_mercator_(position_world.xy) - project.commonOrigin.xy,
          project_size_float(position_world.z),
          position_world.w
        );
      }
    }
  }
  if (project.projectionMode == PROJECTION_MODE_IDENTITY ||
      (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET &&
       (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
        project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN))) {
    position_world = vec4f(position_world.xyz - project.coordinateOrigin, position_world.w);
  }

  return project_offset_(position_world) +
         project_offset_(project.modelMatrix * vec4<f32>(position64Low, 0.0));
}

// Overloaded versions for different input types.
fn project_position_vec4_f32(position: vec4<f32>) -> vec4<f32> {
  return project_position_vec4_f64(position, ZERO_64_LOW);
}

fn project_position_vec3_f64(position: vec3<f32>, position64Low: vec3<f32>) -> vec3<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 1.0), position64Low);
  return projected_position.xyz;
}

fn project_position_vec3_f32(position: vec3<f32>) -> vec3<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 1.0), ZERO_64_LOW);
  return projected_position.xyz;
}

fn project_position_vec2_f32(position: vec2<f32>) -> vec2<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 0.0, 1.0), ZERO_64_LOW);
  return projected_position.xy;
}

// Transforms a common space position to clip space.
fn project_common_position_to_clipspace_with_projection(position: vec4<f32>, viewProjectionMatrix: mat4x4<f32>, center: vec4<f32>) -> vec4<f32> {
  return viewProjectionMatrix * position + center;
}

// Uses the project viewProjectionMatrix and center.
fn project_common_position_to_clipspace(position: vec4<f32>) -> vec4<f32> {
  return project_common_position_to_clipspace_with_projection(position, project.viewProjectionMatrix, project.center);
}

// Returns a clip space offset corresponding to a given number of screen pixels.
fn project_pixel_size_to_clipspace(pixels: vec2<f32>) -> vec2<f32> {
  let offset = pixels / project.viewportSize * project.devicePixelRatio * 2.0;
  return offset * project.focalDistance;
}

fn project_meter_size_to_pixel(meters: f32) -> f32 {
  return project_size_float(meters) * project.scale;
}

fn project_unit_size_to_pixel(size: f32, unit: i32) -> f32 {
  if (unit == UNIT_METERS) {
    return project_meter_size_to_pixel(size);
  } else if (unit == UNIT_COMMON) {
    return size * project.scale;
  }
  // UNIT_PIXELS: no scaling applied.
  return size;
}

fn project_pixel_size_float(pixels: f32) -> f32 {
  return pixels / project.scale;
}

fn project_pixel_size_vec2(pixels: vec2<f32>) -> vec2<f32> {
  return pixels / project.scale;
}
`,Ud=`\
${[`default`,`lnglat`,`meter-offsets`,`lnglat-offsets`,`cartesian`].map(e=>`const int COORDINATE_SYSTEM_${e.toUpperCase().replaceAll(`-`,`_`)} = ${Id(e)};`).join(``)}
${Object.keys(Ct).map(e=>`const int PROJECTION_MODE_${e} = ${Ct[e]};`).join(``)}
${Object.keys(wt).map(e=>`const int UNIT_${e.toUpperCase()} = ${wt[e]};`).join(``)}
layout(std140) uniform projectUniforms {
bool wrapLongitude;
int coordinateSystem;
vec3 commonUnitsPerMeter;
int projectionMode;
float scale;
vec3 commonUnitsPerWorldUnit;
vec3 commonUnitsPerWorldUnit2;
vec4 center;
mat4 modelMatrix;
mat4 viewProjectionMatrix;
vec2 viewportSize;
float devicePixelRatio;
float focalDistance;
vec3 cameraPosition;
vec3 coordinateOrigin;
vec3 commonOrigin;
bool pseudoMeters;
} project;
const float TILE_SIZE = 512.0;
const float PI = 3.1415926536;
const float WORLD_SCALE = TILE_SIZE / (PI * 2.0);
const vec3 ZERO_64_LOW = vec3(0.0);
const float EARTH_RADIUS = 6370972.0;
const float GLOBE_RADIUS = 256.0;
float project_size_at_latitude(float lat) {
float y = clamp(lat, -89.9, 89.9);
return 1.0 / cos(radians(y));
}
float project_size() {
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR &&
project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT &&
project.pseudoMeters == false) {
if (geometry.position.w == 0.0) {
return project_size_at_latitude(geometry.worldPosition.y);
}
float y = geometry.position.y / TILE_SIZE * 2.0 - 1.0;
float y2 = y * y;
float y4 = y2 * y2;
float y6 = y4 * y2;
return 1.0 + 4.9348 * y2 + 4.0587 * y4 + 1.5642 * y6;
}
return 1.0;
}
float project_size_at_latitude(float meters, float lat) {
return meters * project.commonUnitsPerMeter.z * project_size_at_latitude(lat);
}
float project_size(float meters) {
return meters * project.commonUnitsPerMeter.z * project_size();
}
vec2 project_size(vec2 meters) {
return meters * project.commonUnitsPerMeter.xy * project_size();
}
vec3 project_size(vec3 meters) {
return meters * project.commonUnitsPerMeter * project_size();
}
vec4 project_size(vec4 meters) {
return vec4(meters.xyz * project.commonUnitsPerMeter, meters.w);
}
mat3 project_get_orientation_matrix(vec3 up) {
vec3 uz = normalize(up);
vec3 ux = abs(uz.z) == 1.0 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(uz.y, -uz.x, 0));
vec3 uy = cross(uz, ux);
return mat3(ux, uy, uz);
}
bool project_needs_rotation(vec3 commonPosition, out mat3 transform) {
if (project.projectionMode == PROJECTION_MODE_GLOBE) {
transform = project_get_orientation_matrix(commonPosition);
return true;
}
return false;
}
vec3 project_normal(vec3 vector) {
vec4 normal_modelspace = project.modelMatrix * vec4(vector, 0.0);
vec3 n = normalize(normal_modelspace.xyz * project.commonUnitsPerMeter);
mat3 rotation;
if (project_needs_rotation(geometry.position.xyz, rotation)) {
n = rotation * n;
}
return n;
}
vec4 project_offset_(vec4 offset) {
float dy = offset.y;
vec3 commonUnitsPerWorldUnit = project.commonUnitsPerWorldUnit + project.commonUnitsPerWorldUnit2 * dy;
return vec4(offset.xyz * commonUnitsPerWorldUnit, offset.w);
}
vec2 project_mercator_(vec2 lnglat) {
float x = lnglat.x;
if (project.wrapLongitude) {
x = mod(x + 180., 360.0) - 180.;
}
float y = clamp(lnglat.y, -89.9, 89.9);
return vec2(
radians(x) + PI,
PI + log(tan_fp32(PI * 0.25 + radians(y) * 0.5))
) * WORLD_SCALE;
}
vec3 project_globe_(vec3 lnglatz) {
float lambda = radians(lnglatz.x);
float phi = radians(lnglatz.y);
float cosPhi = cos(phi);
float D = (lnglatz.z / EARTH_RADIUS + 1.0) * GLOBE_RADIUS;
return vec3(
sin(lambda) * cosPhi,
-cos(lambda) * cosPhi,
sin(phi)
) * D;
}
vec4 project_position(vec4 position, vec3 position64Low) {
vec4 position_world = project.modelMatrix * position;
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
return vec4(
project_mercator_(position_world.xy),
project_size_at_latitude(position_world.z, position_world.y),
position_world.w
);
}
if (project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN) {
position_world.xyz += project.coordinateOrigin;
}
}
if (project.projectionMode == PROJECTION_MODE_GLOBE) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
return vec4(
project_globe_(position_world.xyz),
position_world.w
);
}
}
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
if (abs(position_world.y - project.coordinateOrigin.y) > 0.25) {
return vec4(
project_mercator_(position_world.xy) - project.commonOrigin.xy,
project_size(position_world.z),
position_world.w
);
}
}
}
if (project.projectionMode == PROJECTION_MODE_IDENTITY ||
(project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET &&
(project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN))) {
position_world.xyz -= project.coordinateOrigin;
}
return project_offset_(position_world) + project_offset_(project.modelMatrix * vec4(position64Low, 0.0));
}
vec4 project_position(vec4 position) {
return project_position(position, ZERO_64_LOW);
}
vec3 project_position(vec3 position, vec3 position64Low) {
vec4 projected_position = project_position(vec4(position, 1.0), position64Low);
return projected_position.xyz;
}
vec3 project_position(vec3 position) {
vec4 projected_position = project_position(vec4(position, 1.0), ZERO_64_LOW);
return projected_position.xyz;
}
vec2 project_position(vec2 position) {
vec4 projected_position = project_position(vec4(position, 0.0, 1.0), ZERO_64_LOW);
return projected_position.xy;
}
vec4 project_common_position_to_clipspace(vec4 position, mat4 viewProjectionMatrix, vec4 center) {
return viewProjectionMatrix * position + center;
}
vec4 project_common_position_to_clipspace(vec4 position) {
return project_common_position_to_clipspace(position, project.viewProjectionMatrix, project.center);
}
vec2 project_pixel_size_to_clipspace(vec2 pixels) {
vec2 offset = pixels / project.viewportSize * project.devicePixelRatio * 2.0;
return offset * project.focalDistance;
}
float project_size_to_pixel(float meters) {
return project_size(meters) * project.scale;
}
vec2 project_size_to_pixel(vec2 meters) {
return project_size(meters) * project.scale;
}
float project_size_to_pixel(float size, int unit) {
if (unit == UNIT_METERS) return project_size_to_pixel(size);
if (unit == UNIT_COMMON) return size * project.scale;
return size;
}
float project_pixel_size(float pixels) {
return pixels / project.scale;
}
vec2 project_pixel_size(vec2 pixels) {
return pixels / project.scale;
}
`,Wd={};function Gd(e=Wd){return`viewport`in e?Bd(e):{}}var Kd={name:`project`,dependencies:[Lo,Dd],source:Hd,vs:Ud,getUniforms:Gd,uniformTypes:{wrapLongitude:`f32`,coordinateSystem:`i32`,commonUnitsPerMeter:`vec3<f32>`,projectionMode:`i32`,scale:`f32`,commonUnitsPerWorldUnit:`vec3<f32>`,commonUnitsPerWorldUnit2:`vec3<f32>`,center:`vec4<f32>`,modelMatrix:`mat4x4<f32>`,viewProjectionMatrix:`mat4x4<f32>`,viewportSize:`vec2<f32>`,devicePixelRatio:`f32`,focalDistance:`f32`,cameraPosition:`vec3<f32>`,coordinateOrigin:`vec3<f32>`,commonOrigin:`vec3<f32>`,pseudoMeters:`f32`}},qd={name:`project32`,dependencies:[Kd],source:`// Define a structure to hold both the clip-space position and the common position.
struct ProjectResult {
  clipPosition: vec4<f32>,
  commonPosition: vec4<f32>,
};

// This function mimics the GLSL version with the 'out' parameter by returning both values.
fn project_position_to_clipspace_and_commonspace(
    position: vec3<f32>,
    position64Low: vec3<f32>,
    offset: vec3<f32>
) -> ProjectResult {
  // Compute the projected position.
  let projectedPosition: vec3<f32> = project_position_vec3_f64(position, position64Low);

  // Start with the provided offset.
  var finalOffset: vec3<f32> = offset;

  // Get whether a rotation is needed and the rotation matrix.
  let rotationResult = project_needs_rotation(projectedPosition);

  // If rotation is needed, update the offset.
  if (rotationResult.needsRotation) {
    finalOffset = rotationResult.transform * offset;
  }

  // Compute the common position.
  let commonPosition: vec4<f32> = vec4<f32>(projectedPosition + finalOffset, 1.0);

  // Convert to clip-space.
  let clipPosition: vec4<f32> = project_common_position_to_clipspace(commonPosition);

  return ProjectResult(clipPosition, commonPosition);
}

// A convenience overload that returns only the clip-space position.
fn project_position_to_clipspace(
    position: vec3<f32>,
    position64Low: vec3<f32>,
    offset: vec3<f32>
) -> vec4<f32> {
  return project_position_to_clipspace_and_commonspace(position, position64Low, offset).clipPosition;
}
`,vs:`vec4 project_position_to_clipspace(
  vec3 position, vec3 position64Low, vec3 offset, out vec4 commonPosition
) {
  vec3 projectedPosition = project_position(position, position64Low);
  mat3 rotation;
  if (project_needs_rotation(projectedPosition, rotation)) {
    // offset is specified as ENU
    // when in globe projection, rotate offset so that the ground alighs with the surface of the globe
    offset = rotation * offset;
  }
  commonPosition = vec4(projectedPosition + offset, 1.0);
  return project_common_position_to_clipspace(commonPosition);
}

vec4 project_position_to_clipspace(
  vec3 position, vec3 position64Low, vec3 offset
) {
  vec4 commonPosition;
  return project_position_to_clipspace(position, position64Low, offset, commonPosition);
}
`};function Jd(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}function Yd(e,t){let n=Bc([],t,e);return Pc(n,n,1/n[3]),n}function Xd(e,t,n){return e<t?t:e>n?n:e}function Zd(e){return Math.log(e)*Math.LOG2E}var Qd=Math.log2||Zd;function $d(e,t){if(!e)throw Error(t||`@math.gl/web-mercator: assertion failed.`)}var ef=Math.PI,tf=ef/4,nf=ef/180,rf=180/ef,af=512,of=4003e4,sf=85.051129,cf=1.5;function lf(e){return Qd(e)}function uf(e){let[t,n]=e;$d(Number.isFinite(t)),$d(Number.isFinite(n)&&n>=-90&&n<=90,`invalid latitude`);let r=t*nf,i=n*nf;return[af*(r+ef)/(2*ef),af*(ef+Math.log(Math.tan(tf+i*.5)))/(2*ef)]}function df(e){let[t,n]=e,r=t/af*(2*ef)-ef,i=2*(Math.atan(Math.exp(n/af*(2*ef)-ef))-tf);return[r*rf,i*rf]}function ff(e){let{latitude:t}=e;return $d(Number.isFinite(t)),lf(of*Math.cos(t*nf))-9}function pf(e){let t=Math.cos(e*nf);return af/of/t}function mf(e){let{latitude:t,longitude:n,highPrecision:r=!1}=e;$d(Number.isFinite(t)&&Number.isFinite(n));let i=af,a=Math.cos(t*nf),o=i/360,s=o/a,c=i/of/a,l={unitsPerMeter:[c,c,c],metersPerUnit:[1/c,1/c,1/c],unitsPerDegree:[o,s,c],degreesPerUnit:[1/o,1/s,1/c]};if(r){let e=nf*Math.tan(t*nf)/a,n=o*e/2,r=i/of*e,u=r/s*c;l.unitsPerDegree2=[0,n,r],l.unitsPerMeter2=[u,0,u]}return l}function hf(e,t){let[n,r,i]=e,[a,o,s]=t,{unitsPerMeter:c,unitsPerMeter2:l}=mf({longitude:n,latitude:r,highPrecision:!0}),u=uf(e);u[0]+=a*(c[0]+l[0]*o),u[1]+=o*(c[1]+l[1]*o);let d=df(u),f=(i||0)+(s||0);return Number.isFinite(i)||Number.isFinite(s)?[d[0],d[1],f]:d}function gf(e){let{height:t,pitch:n,bearing:r,altitude:i,scale:a,center:o}=e,s=Jd();vc(s,s,[0,0,-i]),xc(s,s,-n*nf),Cc(s,s,r*nf);let c=a/t;return yc(s,s,[c,c,c]),o&&vc(s,s,Ns([],o)),s}function _f(e){let{width:t,height:n,altitude:r,pitch:i=0,offset:a,center:o,scale:s,nearZMultiplier:c=1,farZMultiplier:l=1}=e,{fovy:u=vf(cf)}=e;r!==void 0&&(u=vf(r));let d=u*nf,f=i*nf,p=yf(u),m=p;o&&(m+=o[2]*s/Math.cos(f)/n);let h=d*(.5+(a?a[1]:0)/n),g=Math.sin(h)*m/Math.sin(Xd(Math.PI/2-f-h,.01,Math.PI-.01)),_=Math.sin(f)*g+m,v=m*10,y=Math.min(_*l,v);return{fov:d,aspect:t/n,focalDistance:p,near:c,far:y}}function vf(e){return 2*Math.atan(.5/e)*rf}function yf(e){return .5/Math.tan(.5*e*nf)}function bf(e,t){let[n,r,i=0]=e;return $d(Number.isFinite(n)&&Number.isFinite(r)&&Number.isFinite(i)),Yd(t,[n,r,i,1])}function xf(e,t,n=0){let[r,i,a]=e;if($d(Number.isFinite(r)&&Number.isFinite(i),`invalid pixel coordinate`),Number.isFinite(a))return Yd(t,[r,i,a,1]);let o=Yd(t,[r,i,0,1]),s=Yd(t,[r,i,1,1]),c=o[2],l=s[2];return hs([],o,s,c===l?0:((n||0)-c)/(l-c))}function Sf(e){let{width:t,height:n,bounds:r,minExtent:i=0,maxZoom:a=24,offset:o=[0,0]}=e,[[s,c],[l,u]]=r,d=Cf(e.padding),f=uf([s,Xd(u,-sf,sf)]),p=uf([l,Xd(c,-sf,sf)]),m=[Math.max(Math.abs(p[0]-f[0]),i),Math.max(Math.abs(p[1]-f[1]),i)],h=[t-d.left-d.right-Math.abs(o[0])*2,n-d.top-d.bottom-Math.abs(o[1])*2];$d(h[0]>0&&h[1]>0);let g=h[0]/m[0],_=h[1]/m[1],v=(d.right-d.left)/2/g,y=(d.top-d.bottom)/2/_,b=df([(p[0]+f[0])/2+v,(p[1]+f[1])/2+y]),x=Math.min(a,Qd(Math.abs(Math.min(g,_))));return $d(Number.isFinite(x)),{longitude:b[0],latitude:b[1],zoom:x}}function Cf(e=0){return typeof e==`number`?{top:e,bottom:e,left:e,right:e}:($d(Number.isFinite(e.top)&&Number.isFinite(e.bottom)&&Number.isFinite(e.left)&&Number.isFinite(e.right)),e)}var wf=Math.PI/180;function Tf(e,t=0){let{width:n,height:r,unproject:i}=e,a={targetZ:t},o=i([0,r],a),s=i([n,r],a),c,l;return(e.fovy?.5*e.fovy*wf:Math.atan(.5/e.altitude))>(90-e.pitch)*wf-.01?(c=Ef(e,0,t),l=Ef(e,n,t)):(c=i([0,0],a),l=i([n,0],a)),[o,s,l,c]}function Ef(e,t,n){let{pixelUnprojectionMatrix:r}=e,i=Yd(r,[t,0,1,1]),a=Yd(r,[t,e.height,1,1]),o=df(hs([],i,a,(n*e.distanceScales.unitsPerMeter[2]-i[2])/(a[2]-i[2])));return o.push(n),o}var Df=`struct pickingUniforms {
  isActive: f32,
  isAttribute: f32,
  isHighlightActive: f32,
  useByteColors: f32,
  highlightedObjectColor: vec3<f32>,
  highlightColor: vec4<f32>,
};

@group(0) @binding(auto) var<uniform> picking: pickingUniforms;

fn picking_normalizeColor(color: vec3<f32>) -> vec3<f32> {
  return select(color, color / 255.0, picking.useByteColors > 0.5);
}

fn picking_normalizeColor4(color: vec4<f32>) -> vec4<f32> {
  return select(color, color / 255.0, picking.useByteColors > 0.5);
}

fn picking_isColorZero(color: vec3<f32>) -> bool {
  return dot(color, vec3<f32>(1.0)) < 0.00001;
}

fn picking_isColorValid(color: vec3<f32>) -> bool {
  return dot(color, vec3<f32>(1.0)) > 0.00001;
}
`,Of={...Uo,source:Df,defaultUniforms:{...Uo.defaultUniforms,useByteColors:!0},inject:{"vs:DECKGL_FILTER_GL_POSITION":`
    // for picking depth values
    picking_setPickingAttribute(position.z / position.w);
  `,"vs:DECKGL_FILTER_COLOR":`
  picking_setPickingColor(geometry.pickingColor);
  `,"fs:DECKGL_FILTER_COLOR":{order:99,injection:`
  // use highlight color if this fragment belongs to the selected object.
  color = picking_filterHighlightColor(color);

  // use picking color if rendering to picking FBO.
  color = picking_filterPickingColor(color);
    `}}},kf={NO_STATE:`Awaiting state`,MATCHED:`Matched. State transferred from previous layer`,INITIALIZED:`Initialized`,AWAITING_GC:`Discarded. Awaiting garbage collection`,AWAITING_FINALIZATION:`No longer matched. Awaiting garbage collection`,FINALIZED:`Finalized! Awaiting garbage collection`},Af=Symbol.for(`component`),jf=Symbol.for(`propTypes`),Mf=Symbol.for(`deprecatedProps`),Nf=Symbol.for(`asyncPropDefaults`),Pf=Symbol.for(`asyncPropOriginal`),Ff=Symbol.for(`asyncPropResolved`),If={};function Lf(e){If=e}function Rf(e,t,n,r){O.level>0&&If[e]&&If[e].call(null,t,n,r)}function zf(e,t=()=>!0){return Array.isArray(e)?Bf(e,t,[]):t(e)?[e]:[]}function Bf(e,t,n){let r=-1;for(;++r<e.length;){let i=e[r];Array.isArray(i)?Bf(i,t,n):t(i)&&n.push(i)}return n}function Vf({target:e,source:t,start:n=0,count:r=1}){let i=t.length,a=r*i,o=0;for(let r=n;o<i;o++)e[r++]=t[o];for(;o<a;)o<a-o?(e.copyWithin(n+o,n,n+o),o*=2):(e.copyWithin(n+o,n,n+a-o),o=a);return e}async function Hf(e,t,n,r){return r._parse(e,t,n,r)}function H(e,t){if(!e)throw Error(t||`loader assertion failed.`)}var Uf={self:typeof self<`u`&&self,window:typeof window<`u`&&window,global:typeof global<`u`&&global,document:typeof document<`u`&&document};Uf.self||Uf.window||Uf.global,Uf.window||Uf.self||Uf.global,Uf.global||Uf.self||Uf.window,Uf.document;var Wf=!!(typeof process!=`object`||String(process)!==`[object process]`||process.browser),Gf=typeof process<`u`&&process.version&&/v([0-9]*)/.exec(process.version);Gf&&parseFloat(Gf[1]);var Kf=`v4.4.3`;function qf(){let e=new T({id:`loaders.gl`});return globalThis.loaders||={},globalThis.loaders.log=e,globalThis.loaders.version=Kf,globalThis.probe||={},globalThis.probe.loaders=e,e}var Jf=qf(),Yf=e=>typeof e==`boolean`,Xf=e=>typeof e==`function`,Zf=e=>typeof e==`object`&&!!e,Qf=e=>Zf(e)&&e.constructor==={}.constructor,$f=e=>typeof SharedArrayBuffer<`u`&&e instanceof SharedArrayBuffer,ep=e=>Zf(e)&&typeof e.byteLength==`number`&&typeof e.slice==`function`,tp=e=>!!e&&Xf(e[Symbol.iterator]),np=e=>!!e&&Xf(e[Symbol.asyncIterator]),rp=e=>typeof Response<`u`&&e instanceof Response||Zf(e)&&Xf(e.arrayBuffer)&&Xf(e.text)&&Xf(e.json),ip=e=>typeof Blob<`u`&&e instanceof Blob,ap=e=>typeof ReadableStream<`u`&&e instanceof ReadableStream||Zf(e)&&Xf(e.tee)&&Xf(e.cancel)&&Xf(e.getReader),op=e=>Zf(e)&&Xf(e.read)&&Xf(e.pipe)&&Yf(e.readable),sp=e=>ap(e)||op(e);function cp(e,t){return lp(e||{},t)}function lp(e,t,n=0){if(n>3)return t;let r={...e};for(let[e,i]of Object.entries(t))i&&typeof i==`object`&&!Array.isArray(i)?r[e]=lp(r[e]||{},t[e],n+1):r[e]=t[e];return r}function up(e){globalThis.loaders||={},globalThis.loaders.modules||={},Object.assign(globalThis.loaders.modules,e)}function dp(e){return globalThis.loaders?.modules?.[e]||null}function fp(e,t){if(!e)throw Error(t||`loaders.gl assertion failed.`)}var pp={self:typeof self<`u`&&self,window:typeof window<`u`&&window,global:typeof global<`u`&&global,document:typeof document<`u`&&document};pp.self||pp.window||pp.global,pp.window||pp.self||pp.global,pp.global||pp.self||pp.window,pp.document;var mp=typeof process!=`object`||String(process)!==`[object process]`||process.browser,hp=typeof importScripts==`function`,gp=typeof window<`u`&&window.orientation!==void 0,_p=typeof process<`u`&&process.version&&/v([0-9]*)/.exec(process.version);_p&&parseFloat(_p[1]);var vp=class{terminate(){}},yp=new Map;function bp(e){fp(e.source&&!e.url||!e.source&&e.url);let t=yp.get(e.source||e.url);return t||(e.url&&(t=xp(e.url),yp.set(e.url,t)),e.source&&(t=Sp(e.source),yp.set(e.source,t))),fp(t),t}function xp(e){return e.startsWith(`http`)?Sp(Cp(e)):e}function Sp(e){let t=new Blob([e],{type:`application/javascript`});return URL.createObjectURL(t)}function Cp(e){return`\
try {
  importScripts('${e}');
} catch (error) {
  console.error(error);
  throw error;
}`}function wp(e,t=!0,n){let r=n||new Set;if(e){if(Tp(e))r.add(e);else if(Tp(e.buffer))r.add(e.buffer);else if(!ArrayBuffer.isView(e)&&t&&typeof e==`object`)for(let n in e)wp(e[n],t,r)}return n===void 0?Array.from(r):[]}function Tp(e){return e?e instanceof ArrayBuffer||typeof MessagePort<`u`&&e instanceof MessagePort||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof OffscreenCanvas<`u`&&e instanceof OffscreenCanvas:!1}var Ep=()=>{},Dp=class{name;source;url;terminated=!1;worker;onMessage;onError;_loadableURL=``;static isSupported(){return typeof Worker<`u`&&mp||vp!==void 0&&!mp}constructor(e){let{name:t,source:n,url:r}=e;fp(n||r),this.name=t,this.source=n,this.url=r,this.onMessage=Ep,this.onError=e=>console.log(e),this.worker=mp?this._createBrowserWorker():this._createNodeWorker()}destroy(){this.onMessage=Ep,this.onError=Ep,this.worker.terminate(),this.terminated=!0}get isRunning(){return!!this.onMessage}postMessage(e,t){t||=wp(e),this.worker.postMessage(e,t)}_getErrorFromErrorEvent(e){let t=`Failed to load `;return t+=`worker ${this.name} from ${this.url}. `,e.message&&(t+=`${e.message} in `),e.lineno&&(t+=`:${e.lineno}:${e.colno}`),Error(t)}_createBrowserWorker(){this._loadableURL=bp({source:this.source,url:this.url});let e=new Worker(this._loadableURL,{name:this.name});return e.onmessage=e=>{e.data?this.onMessage(e.data):this.onError(Error(`No data received`))},e.onerror=e=>{this.onError(this._getErrorFromErrorEvent(e)),this.terminated=!0},e.onmessageerror=e=>console.error(e),e}_createNodeWorker(){let e;if(this.url)e=new vp(this.url.includes(`:/`)||this.url.startsWith(`/`)?this.url:`./${this.url}`,{eval:!1,type:this.url.endsWith(`.ts`)||this.url.endsWith(`.mjs`)?`module`:`commonjs`});else if(this.source)e=new vp(this.source,{eval:!0});else throw Error(`no worker`);return e.on(`message`,e=>{this.onMessage(e)}),e.on(`error`,e=>{this.onError(e)}),e.on(`exit`,e=>{}),e}},Op=class{name;workerThread;isRunning=!0;result;_resolve=()=>{};_reject=()=>{};constructor(e,t){this.name=e,this.workerThread=t,this.result=new Promise((e,t)=>{this._resolve=e,this._reject=t})}postMessage(e,t){this.workerThread.postMessage({source:`loaders.gl`,type:e,payload:t})}done(e){fp(this.isRunning),this.isRunning=!1,this._resolve(e)}error(e){fp(this.isRunning),this.isRunning=!1,this._reject(e)}},kp=class{name=`unnamed`;source;url;maxConcurrency=1;maxMobileConcurrency=1;onDebug=()=>{};reuseWorkers=!0;props={};jobQueue=[];idleQueue=[];count=0;isDestroyed=!1;static isSupported(){return Dp.isSupported()}constructor(e){this.source=e.source,this.url=e.url,this.setProps(e)}destroy(){this.idleQueue.forEach(e=>e.destroy()),this.isDestroyed=!0}setProps(e){this.props={...this.props,...e},e.name!==void 0&&(this.name=e.name),e.maxConcurrency!==void 0&&(this.maxConcurrency=e.maxConcurrency),e.maxMobileConcurrency!==void 0&&(this.maxMobileConcurrency=e.maxMobileConcurrency),e.reuseWorkers!==void 0&&(this.reuseWorkers=e.reuseWorkers),e.onDebug!==void 0&&(this.onDebug=e.onDebug)}async startJob(e,t=(e,t,n)=>e.done(n),n=(e,t)=>e.error(t)){let r=new Promise(r=>(this.jobQueue.push({name:e,onMessage:t,onError:n,onStart:r}),this));return this._startQueuedJob(),await r}async _startQueuedJob(){if(!this.jobQueue.length)return;let e=this._getAvailableWorker();if(!e)return;let t=this.jobQueue.shift();if(t){this.onDebug({message:`Starting job`,name:t.name,workerThread:e,backlog:this.jobQueue.length});let n=new Op(t.name,e);e.onMessage=e=>t.onMessage(n,e.type,e.payload),e.onError=e=>t.onError(n,e),t.onStart(n);try{await n.result}catch(e){console.error(`Worker exception: ${e}`)}finally{this.returnWorkerToQueue(e)}}}returnWorkerToQueue(e){!mp||this.isDestroyed||!this.reuseWorkers||this.count>this._getMaxConcurrency()?(e.destroy(),this.count--):this.idleQueue.push(e),this.isDestroyed||this._startQueuedJob()}_getAvailableWorker(){return this.idleQueue.length>0?this.idleQueue.shift()||null:this.count<this._getMaxConcurrency()?(this.count++,new Dp({name:`${this.name.toLowerCase()} (#${this.count} of ${this.maxConcurrency})`,source:this.source,url:this.url})):null}_getMaxConcurrency(){return gp?this.maxMobileConcurrency:this.maxConcurrency}},Ap={maxConcurrency:3,maxMobileConcurrency:1,reuseWorkers:!0,onDebug:()=>{}},jp=class e{props;workerPools=new Map;static _workerFarm;static isSupported(){return Dp.isSupported()}static getWorkerFarm(t={}){return e._workerFarm=e._workerFarm||new e({}),e._workerFarm.setProps(t),e._workerFarm}constructor(e){this.props={...Ap},this.setProps(e),this.workerPools=new Map}destroy(){for(let e of this.workerPools.values())e.destroy();this.workerPools=new Map}setProps(e){this.props={...this.props,...e};for(let e of this.workerPools.values())e.setProps(this._getWorkerPoolProps())}getWorkerPool(e){let{name:t,source:n,url:r}=e,i=this.workerPools.get(t);return i||(i=new kp({name:t,source:n,url:r}),i.setProps(this._getWorkerPoolProps()),this.workerPools.set(t,i)),i}_getWorkerPoolProps(){return{maxConcurrency:this.props.maxConcurrency,maxMobileConcurrency:this.props.maxMobileConcurrency,reuseWorkers:this.props.reuseWorkers,onDebug:this.props.onDebug}}},Mp=`latest`;function Np(){return globalThis._loadersgl_?.version||(globalThis._loadersgl_=globalThis._loadersgl_||{},globalThis._loadersgl_.version=`4.4.3`),globalThis._loadersgl_.version}var Pp=Np();function Fp(e,t={}){let n=t[e.id]||{},r=mp?`${e.id}-worker.js`:`${e.id}-worker-node.js`,i=n.workerUrl;if(!i&&e.id===`compression`&&(i=t.workerUrl),(t._workerType||t?.core?._workerType)===`test`&&(i=mp?`modules/${e.module}/dist/${r}`:`modules/${e.module}/src/workers/${e.id}-worker-node.ts`),!i){let t=e.version;t===`latest`&&(t=Mp);let n=t?`@${t}`:``;i=`https://unpkg.com/@loaders.gl/${e.module}${n}/dist/${r}`}return fp(i),i}function Ip(e,t=Pp){fp(e,`no worker provided`);let n=e.version;return!(!t||!n)}var Lp={};function Rp(e={}){let t=e.useLocalLibraries??e.core?.useLocalLibraries,n=e.CDN??e.core?.CDN,r=e.modules;return{...t===void 0?{}:{useLocalLibraries:t},...n===void 0?{}:{CDN:n},...r===void 0?{}:{modules:r}}}async function zp(e,t=null,n={},r=null){return t&&(e=Bp(e,t,n,r)),Lp[e]=Lp[e]||Vp(e),await Lp[e]}function Bp(e,t,n={},r=null){if(n?.core)throw Error(`loadLibrary: options.core must be pre-normalized`);if(!n.useLocalLibraries&&e.startsWith(`http`))return e;r||=e;let i=n.modules||{};return i[r]?i[r]:mp?n.CDN?(fp(n.CDN.startsWith(`http`)),`${n.CDN}/${t}@${Pp}/dist/libs/${r}`):hp?`../src/libs/${r}`:`modules/${t}/src/libs/${r}`:`modules/${t}/dist/libs/${r}`}async function Vp(e){if(e.endsWith(`wasm`))return await Up(e);if(!mp){let{requireFromFile:t}=globalThis.loaders||{};try{let n=await t?.(e);return n||!e.includes(`/dist/libs/`)?n:await t?.(e.replace(`/dist/libs/`,`/src/libs/`))}catch(n){if(e.includes(`/dist/libs/`))try{return await t?.(e.replace(`/dist/libs/`,`/src/libs/`))}catch{}return console.error(n),null}}return hp?importScripts(e):Hp(await Wp(e),e)}function Hp(e,t){if(!mp){let{requireFromString:n}=globalThis.loaders||{};return n?.(e,t)}if(hp)return eval.call(globalThis,e),null;let n=document.createElement(`script`);n.id=t;try{n.appendChild(document.createTextNode(e))}catch{n.text=e}return document.body.appendChild(n),null}async function Up(e){let{readFileAsArrayBuffer:t}=globalThis.loaders||{};if(mp||!t||e.startsWith(`http`))return await(await fetch(e)).arrayBuffer();try{return await t(e)}catch{if(e.includes(`/dist/libs/`))return await t(e.replace(`/dist/libs/`,`/src/libs/`));throw Error(`Failed to load ArrayBuffer from ${e}`)}}async function Wp(e){let{readFileAsText:t}=globalThis.loaders||{};if(mp||!t||e.startsWith(`http`))return await(await fetch(e)).text();try{return await t(e)}catch{if(e.includes(`/dist/libs/`))return await t(e.replace(`/dist/libs/`,`/src/libs/`));throw Error(`Failed to load text from ${e}`)}}function Gp(e,t){if(!jp.isSupported())return!1;let n=t?._nodeWorkers??t?.core?._nodeWorkers;if(!mp&&!n)return!1;let r=t?.worker??t?.core?.worker;return!!(e.worker&&r)}async function Kp(e,t,n,r,i){let a=e.id,o=Fp(e,n),s=jp.getWorkerFarm(n?.core).getWorkerPool({name:a,url:o});n=JSON.parse(JSON.stringify(n)),r=JSON.parse(JSON.stringify(r||{}));let c=await s.startJob(`process-on-worker`,qp.bind(null,i));return c.postMessage(`process`,{input:t,options:n,context:r}),await(await c.result).result}async function qp(e,t,n,r){switch(n){case`done`:t.done(r);break;case`error`:t.error(Error(r.error));break;case`process`:let{id:i,input:a,options:o}=r;try{let n=await e(a,o);t.postMessage(`done`,{id:i,result:n})}catch(e){let n=e instanceof Error?e.message:`unknown error`;t.postMessage(`error`,{id:i,error:n})}break;default:console.warn(`parse-with-worker unknown message ${n}`)}}function Jp(e,t=5){return typeof e==`string`?e.slice(0,t):ArrayBuffer.isView(e)?Yp(e.buffer,e.byteOffset,t):e instanceof ArrayBuffer?Yp(e,0,t):``}function Yp(e,t,n){if(e.byteLength<=t+n)return``;let r=new DataView(e),i=``;for(let e=0;e<n;e++)i+=String.fromCharCode(r.getUint8(t+e));return i}function Xp(e){try{return JSON.parse(e)}catch{throw Error(`Failed to parse JSON from data starting with "${Jp(e)}"`)}}function Zp(e,t,n){if(n||=e.byteLength,e.byteLength<n||t.byteLength<n)return!1;let r=new Uint8Array(e),i=new Uint8Array(t);for(let e=0;e<r.length;++e)if(r[e]!==i[e])return!1;return!0}function Qp(...e){return $p(e)}function $p(e){let t=e.map(e=>e instanceof ArrayBuffer?new Uint8Array(e):e),n=t.reduce((e,t)=>e+t.byteLength,0),r=new Uint8Array(n),i=0;for(let e of t)r.set(e,i),i+=e.byteLength;return r.buffer}function em(e,t,n){let r=n===void 0?new Uint8Array(e).subarray(t):new Uint8Array(e).subarray(t,t+n);return new Uint8Array(r).buffer}function tm(e,t){return H(e>=0),H(t>0),e+(t-1)&~(t-1)}function nm(e,t,n){let r;if(e instanceof ArrayBuffer)r=new Uint8Array(e);else{let t=e.byteOffset,n=e.byteLength;r=new Uint8Array(e.buffer||e.arrayBuffer,t,n)}return t.set(r,n),n+tm(r.byteLength,4)}async function rm(e){let t=[];for await(let n of e)t.push(im(n));return Qp(...t)}function im(e){if(e instanceof ArrayBuffer)return e;if(ArrayBuffer.isView(e)){let{buffer:t,byteOffset:n,byteLength:r}=e;return am(t,n,r)}return am(e)}function am(e,t=0,n=e.byteLength-t){let r=new Uint8Array(e,t,n),i=new Uint8Array(r.length);return i.set(r),i.buffer}var om=`Queued Requests`,sm=`Active Requests`,cm=`Cancelled Requests`,lm=`Queued Requests Ever`,um=`Active Requests Ever`,dm={id:`request-scheduler`,throttleRequests:!0,maxRequests:6,debounceTime:0},fm=class{props;stats;activeRequestCount=0;requestQueue=[];requestMap=new Map;updateTimer=null;constructor(e={}){this.props={...dm,...e},this.stats=new kt({id:this.props.id}),this.stats.get(om),this.stats.get(sm),this.stats.get(cm),this.stats.get(lm),this.stats.get(um)}setProps(e){e.throttleRequests!==void 0&&(this.props.throttleRequests=e.throttleRequests),e.maxRequests!==void 0&&(this.props.maxRequests=e.maxRequests),e.debounceTime!==void 0&&(this.props.debounceTime=e.debounceTime)}scheduleRequest(e,t=()=>0){if(!this.props.throttleRequests)return Promise.resolve({done:()=>{}});if(this.requestMap.has(e))return this.requestMap.get(e);let n={handle:e,priority:0,getPriority:t},r=new Promise(e=>(n.resolve=e,n));return this.requestQueue.push(n),this.requestMap.set(e,r),this._issueNewRequests(),r}_issueRequest(e){let{handle:t,resolve:n}=e,r=!1,i=()=>{r||(r=!0,this.requestMap.delete(t),this.activeRequestCount--,this._issueNewRequests())};return this.activeRequestCount++,n?n({done:i}):Promise.resolve({done:i})}_issueNewRequests(){this.updateTimer!==null&&clearTimeout(this.updateTimer),this.updateTimer=setTimeout(()=>this._issueNewRequestsAsync(),this.props.debounceTime)}_issueNewRequestsAsync(){this.updateTimer!==null&&clearTimeout(this.updateTimer),this.updateTimer=null;let e=Math.max(this.props.maxRequests-this.activeRequestCount,0);if(e!==0){this._updateAllRequests();for(let t=0;t<e;++t){let e=this.requestQueue.shift();e&&this._issueRequest(e)}}}_updateAllRequests(){let e=this.requestQueue;for(let t=0;t<e.length;++t){let n=e[t];this._updateRequest(n)||(e.splice(t,1),this.requestMap.delete(n.handle),t--)}e.sort((e,t)=>e.priority-t.priority)}_updateRequest(e){return e.priority=e.getPriority(e.handle),e.priority<0?(e.resolve(null),!1):!0}},pm=``,mm={};function hm(e){for(let t in mm)if(e.startsWith(t)){let n=mm[t];e=e.replace(t,n)}return!e.startsWith(`http://`)&&!e.startsWith(`https://`)&&(e=`${pm}${e}`),e}function gm(e){return e}function _m(e){return e&&typeof e==`object`&&e.isBuffer}function vm(e){if(_m(e))return gm(e);if(e instanceof ArrayBuffer)return e;if($f(e))return bm(e);if(ArrayBuffer.isView(e)){let t=e.buffer;return e.byteOffset===0&&e.byteLength===e.buffer.byteLength?t:t.slice(e.byteOffset,e.byteOffset+e.byteLength)}if(typeof e==`string`){let t=e;return new TextEncoder().encode(t).buffer}if(e&&typeof e==`object`&&e._toArrayBuffer)return e._toArrayBuffer();throw Error(`toArrayBuffer`)}function ym(e){if(e instanceof ArrayBuffer)return e;if($f(e))return bm(e);let{buffer:t,byteOffset:n,byteLength:r}=e;return t instanceof ArrayBuffer&&n===0&&r===t.byteLength?t:bm(t,n,r)}function bm(e,t=0,n=e.byteLength-t){let r=new Uint8Array(e,t,n),i=new Uint8Array(r.length);return i.set(r),i.buffer}function xm(e){return ArrayBuffer.isView(e)?e:new Uint8Array(e)}function Sm(){if(typeof process<`u`&&process.cwd!==void 0)return process.cwd();let e=window.location?.pathname;return e?.slice(0,e.lastIndexOf(`/`)+1)||``}function Cm(e){let t=e?e.lastIndexOf(`/`):-1;return t>=0?e.substr(t+1):e}function wm(e){let t=e?e.lastIndexOf(`/`):-1;return t>=0?e.substr(0,t):``}function Tm(...e){let t=[];for(let n=0;n<e.length;n++)t[n]=e[n];let n=``,r=!1,i;for(let e=t.length-1;e>=-1&&!r;e--){let a;e>=0?a=t[e]:(i===void 0&&(i=Sm()),a=i),a.length!==0&&(n=`${a}/${n}`,r=a.charCodeAt(0)===Em)}return n=Om(n,!r),r?`/${n}`:n.length>0?n:`.`}var Em=47,Dm=46;function Om(e,t){let n=``,r=-1,i=0,a,o=!1;for(let s=0;s<=e.length;++s){if(s<e.length)a=e.charCodeAt(s);else if(a===Em)break;else a=Em;if(a===Em){if(!(r===s-1||i===1))if(r!==s-1&&i===2){if(n.length<2||!o||n.charCodeAt(n.length-1)!==Dm||n.charCodeAt(n.length-2)!==Dm){if(n.length>2){let e=n.length-1,t=e;for(;t>=0&&n.charCodeAt(t)!==Em;--t);if(t!==e){n=t===-1?``:n.slice(0,t),r=s,i=0,o=!1;continue}}else if(n.length===2||n.length===1){n=``,r=s,i=0,o=!1;continue}}t&&(n.length>0?n+=`/..`:n=`..`,o=!0)}else{let t=e.slice(r+1,s);n.length>0?n+=`/${t}`:n=t,o=!1}r=s,i=0}else a===Dm&&i!==-1?++i:i=-1}return n}function km(e){return e?(Array.isArray(e)&&(e=e[0]),Array.isArray(e?.extensions)):!1}function Am(e){H(e,`null loader`),H(km(e),`invalid loader`);let t;return Array.isArray(e)&&(t=e[1],e=e[0],e={...e,options:{...e.options,...t}}),(e?.parseTextSync||e?.parseText)&&(e.text=!0),e.text||(e.binary=!0),e}var jm=new T({id:`loaders.gl`}),Mm=class{log(){return()=>{}}info(){return()=>{}}warn(){return()=>{}}error(){return()=>{}}},Nm={core:{baseUrl:void 0,fetch:null,mimeType:void 0,fallbackMimeType:void 0,ignoreRegisteredLoaders:void 0,nothrow:!1,log:new class{console;constructor(){this.console=console}log(...e){return this.console.log.bind(this.console,...e)}info(...e){return this.console.info.bind(this.console,...e)}warn(...e){return this.console.warn.bind(this.console,...e)}error(...e){return this.console.error.bind(this.console,...e)}},useLocalLibraries:!1,CDN:`https://unpkg.com/@loaders.gl`,worker:!0,maxConcurrency:3,maxMobileConcurrency:1,reuseWorkers:Wf,_nodeWorkers:!1,_workerType:``,limit:0,_limitMB:0,batchSize:`auto`,batchDebounceMs:0,metadata:!1,transforms:[]}},Pm={baseUri:`core.baseUrl`,fetch:`core.fetch`,mimeType:`core.mimeType`,fallbackMimeType:`core.fallbackMimeType`,ignoreRegisteredLoaders:`core.ignoreRegisteredLoaders`,nothrow:`core.nothrow`,log:`core.log`,useLocalLibraries:`core.useLocalLibraries`,CDN:`core.CDN`,worker:`core.worker`,maxConcurrency:`core.maxConcurrency`,maxMobileConcurrency:`core.maxMobileConcurrency`,reuseWorkers:`core.reuseWorkers`,_nodeWorkers:`core.nodeWorkers`,_workerType:`core._workerType`,_worker:`core._workerType`,limit:`core.limit`,_limitMB:`core._limitMB`,batchSize:`core.batchSize`,batchDebounceMs:`core.batchDebounceMs`,metadata:`core.metadata`,transforms:`core.transforms`,throws:`nothrow`,dataType:`(no longer used)`,uri:`core.baseUrl`,method:`core.fetch.method`,headers:`core.fetch.headers`,body:`core.fetch.body`,mode:`core.fetch.mode`,credentials:`core.fetch.credentials`,cache:`core.fetch.cache`,redirect:`core.fetch.redirect`,referrer:`core.fetch.referrer`,referrerPolicy:`core.fetch.referrerPolicy`,integrity:`core.fetch.integrity`,keepalive:`core.fetch.keepalive`,signal:`core.fetch.signal`},Fm=/\?.*/;function Im(e){let t=e.match(Fm);return t&&t[0]}function Lm(e){return e.replace(Fm,``)}function Rm(e){if(e.length<50)return e;let t=e.slice(e.length-15);return`${e.substr(0,32)}...${t}`}var zm=[`baseUrl`,`fetch`,`mimeType`,`fallbackMimeType`,`ignoreRegisteredLoaders`,`nothrow`,`log`,`useLocalLibraries`,`CDN`,`worker`,`maxConcurrency`,`maxMobileConcurrency`,`reuseWorkers`,`_nodeWorkers`,`_workerType`,`limit`,`_limitMB`,`batchSize`,`batchDebounceMs`,`metadata`,`transforms`];function Bm(){globalThis.loaders=globalThis.loaders||{};let{loaders:e}=globalThis;return e._state||={},e._state}function Vm(){let e=Bm();return e.globalOptions=e.globalOptions||{...Nm,core:{...Nm.core}},Um(e.globalOptions)}function Hm(e,t,n,r){return n||=[],n=Array.isArray(n)?n:[n],Wm(e,n),Um(qm(t,e,r))}function Um(e){let t=Xm(e);Zm(t);for(let e of zm)t.core&&t.core[e]!==void 0&&delete t[e];return t.core&&t.core._workerType!==void 0&&delete t._worker,t}function Wm(e,t){Gm(e,null,Nm,Pm,t);for(let n of t){let r=e&&e[n.id]||{},i=n.options&&n.options[n.id]||{},a=n.deprecatedOptions&&n.deprecatedOptions[n.id]||{};Gm(r,n.id,i,a,t)}}function Gm(e,t,n,r,i){let a=t||`Top level`,o=t?`${t}.`:``;for(let s in e){let c=!t&&Zf(e[s]),l=s===`baseUri`&&!t,u=s===`workerUrl`&&t;if(!(s in n)&&!l&&!u){if(s in r)jm.level>0&&jm.warn(`${a} loader option \'${o}${s}\' no longer supported, use \'${r[s]}\'`)();else if(!c&&jm.level>0){let e=Km(s,i);jm.warn(`${a} loader option \'${o}${s}\' not recognized. ${e}`)()}}}}function Km(e,t){let n=e.toLowerCase(),r=``;for(let i of t)for(let t in i.options){if(e===t)return`Did you mean \'${i.id}.${t}\'?`;let a=t.toLowerCase();(n.startsWith(a)||a.startsWith(n))&&(r||=`Did you mean \'${i.id}.${t}\'?`)}return r}function qm(e,t,n){let r=e.options||{},i={...r};return r.core&&(i.core={...r.core}),Zm(i),i.core?.log===null&&(i.core={...i.core,log:new Mm}),Jm(i,Um(Vm())),Jm(i,Um(t)),Ym(i,n),Qm(i),i}function Jm(e,t){for(let n in t)if(n in t){let r=t[n];Qf(r)&&Qf(e[n])?e[n]={...e[n],...t[n]}:e[n]=t[n]}}function Ym(e,t){t&&e.core?.baseUrl===void 0&&(e.core||={},e.core.baseUrl=wm(Lm(t)))}function Xm(e){let t={...e};return e.core&&(t.core={...e.core}),t}function Zm(e){e.baseUri!==void 0&&(e.core||={},e.core.baseUrl===void 0&&(e.core.baseUrl=e.baseUri));for(let t of zm)if(e[t]!==void 0){let n=e.core=e.core||{};n[t]===void 0&&(n[t]=e[t])}let t=e._worker;t!==void 0&&(e.core||={},e.core._workerType===void 0&&(e.core._workerType=t))}function Qm(e){let t=e.core;if(t)for(let n of zm)t[n]!==void 0&&(e[n]=t[n])}var $m=()=>{let e=Bm();return e.loaderRegistry=e.loaderRegistry||[],e.loaderRegistry};function eh(e){let t=$m();e=Array.isArray(e)?e:[e];for(let n of e){let e=Am(n);t.find(t=>e===t)||t.unshift(e)}}function th(){return $m()}var nh=class extends Error{constructor(e,t){super(e),this.reason=t.reason,this.url=t.url,this.response=t.response}reason;url;response},rh=/^data:([-\w.]+\/[-\w.+]+)(;|,)/,ih=/^([-\w.]+\/[-\w.+]+)/;function ah(e,t){return e.toLowerCase()===t.toLowerCase()}function oh(e){let t=ih.exec(e);return t?t[1]:e}function sh(e){let t=rh.exec(e);return t?t[1]:``}function ch(e){return rp(e)?e.url:ip(e)?(`name`in e?e.name:``)||``:typeof e==`string`?e:``}function lh(e){if(rp(e)){let t=e.headers.get(`content-type`)||``,n=Lm(e.url);return oh(t)||sh(n)}return ip(e)?e.type||``:typeof e==`string`?sh(e):``}function uh(e){return rp(e)?e.headers[`content-length`]||-1:ip(e)?e.size:typeof e==`string`?e.length:e instanceof ArrayBuffer||ArrayBuffer.isView(e)?e.byteLength:-1}async function dh(e){if(rp(e))return e;let t={},n=uh(e);n>=0&&(t[`content-length`]=String(n));let r=ch(e),i=lh(e);i&&(t[`content-type`]=i);let a=await mh(e);a&&(t[`x-first-bytes`]=a),typeof e==`string`&&(e=new TextEncoder().encode(e));let o=new Response(e,{headers:t});return Object.defineProperty(o,"url",{value:r}),o}async function fh(e){if(!e.ok)throw await ph(e)}async function ph(e){let t=Rm(e.url),n=`Failed to fetch resource (${e.status}) ${e.statusText}: ${t}`;n=n.length>100?`${n.slice(0,100)}...`:n;let r={reason:e.statusText,url:e.url,response:e};try{let t=e.headers.get(`Content-Type`);r.reason=!e.bodyUsed&&t?.includes(`application/json`)?await e.json():await e.text()}catch{}return new nh(n,r)}async function mh(e){if(typeof e==`string`)return`data:,${e.slice(0,5)}`;if(e instanceof Blob){let t=e.slice(0,5);return await new Promise(e=>{let n=new FileReader;n.onload=t=>e(t?.target?.result),n.readAsDataURL(t)})}return e instanceof ArrayBuffer?`data:base64,${hh(e.slice(0,5))}`:null}function hh(e){let t=``,n=new Uint8Array(e);for(let e=0;e<n.byteLength;e++)t+=String.fromCharCode(n[e]);return btoa(t)}function gh(e){return!_h(e)&&!vh(e)}function _h(e){return e.startsWith(`http:`)||e.startsWith(`https:`)}function vh(e){return e.startsWith(`data:`)}async function yh(e,t){if(typeof e==`string`){let n=hm(e);return gh(n)&&globalThis.loaders?.fetchNode?globalThis.loaders?.fetchNode(n,t):await fetch(n,t)}return await dh(e)}function bh(e,t){let n=Vm(),r=e||n,i=r.fetch??r.core?.fetch;return typeof i==`function`?i:Zf(i)?e=>yh(e,i):t?.fetch?t?.fetch:yh}var xh=256*1024;function*Sh(e,t){let n=t?.chunkSize||xh,r=0,i=new TextEncoder;for(;r<e.length;){let t=Math.min(e.length-r,n),a=e.slice(r,r+t);r+=t,yield ym(i.encode(a))}}var Ch=256*1024;function*wh(e,t={}){let{chunkSize:n=Ch}=t,r=0;for(;r<e.byteLength;){let t=Math.min(e.byteLength-r,n),i=new ArrayBuffer(t),a=new Uint8Array(e,r,t);new Uint8Array(i).set(a),r+=t,yield i}}var Th=1024*1024;async function*Eh(e,t){let n=t?.chunkSize||Th,r=0;for(;r<e.size;){let t=r+n,i=await e.slice(r,t).arrayBuffer();r=t,yield i}}function Dh(e,t){return Wf?Oh(e,t):kh(e,t)}async function*Oh(e,t){let n=e.getReader(),r;try{for(;;){let e=r||n.read();t?._streamReadAhead&&(r=n.read());let{done:i,value:a}=await e;if(i)return;yield vm(a)}}catch{n.releaseLock()}}async function*kh(e,t){for await(let t of e)yield vm(t)}function Ah(e,t){if(typeof e==`string`)return Sh(e,t);if(e instanceof ArrayBuffer)return wh(e,t);if(ip(e))return Eh(e,t);if(sp(e))return Dh(e,t);if(rp(e)){let n=e.body;if(!n)throw Error(`Readable stream not available on Response`);return Dh(n,t)}throw Error(`makeIterator`)}var jh=`Cannot convert supplied data type`;function Mh(e,t,n){if(t.text&&typeof e==`string`)return e;if(_m(e)&&(e=e.buffer),ep(e)){let n=xm(e);return t.text&&!t.binary?new TextDecoder(`utf8`).decode(n):vm(n)}throw Error(jh)}async function Nh(e,t,n){if(typeof e==`string`||ep(e))return Mh(e,t,n);if(ip(e)&&(e=await dh(e)),rp(e))return await fh(e),t.binary?await e.arrayBuffer():await e.text();if(sp(e)&&(e=Ah(e,n)),tp(e)||np(e))return rm(e);throw Error(jh)}function Ph(e,t,n){if(n)return n;let r={fetch:bh(t,e),...e};if(r.url){let e=Lm(r.url);r.baseUrl=e,r.queryString=Im(r.url),r.filename=Cm(e),r.baseUrl=wm(e)}return Array.isArray(r.loaders)||(r.loaders=null),r}function Fh(e,t){if(e&&!Array.isArray(e))return e;let n;if(e&&(n=Array.isArray(e)?e:[e]),t&&t.loaders){let e=Array.isArray(t.loaders)?t.loaders:[t.loaders];n=n?[...n,...e]:e}return n&&n.length?n:void 0}var Ih=/\.([^.]+)$/;async function Lh(e,t=[],n,r){if(!Vh(e))return null;let i=Um(n||{});if(i.core||={},e instanceof Response&&Rh(e)){let n=zh(await e.clone().text(),t,{...i,core:{...i.core,nothrow:!0}},r);if(n)return n}let a=zh(e,t,{...i,core:{...i.core,nothrow:!0}},r);if(a)return a;if(ip(e)&&(e=await e.slice(0,10).arrayBuffer(),a=zh(e,t,i,r)),!a&&e instanceof Response&&Rh(e)&&(a=zh(await e.clone().text(),t,i,r)),!a&&!i.core.nothrow)throw Error(Hh(e));return a}function Rh(e){let t=lh(e);return!!(t&&(t.startsWith(`text/`)||t===`application/json`||t.endsWith(`+json`)))}function zh(e,t=[],n,r){if(!Vh(e))return null;let i=Um(n||{});if(i.core||={},t&&!Array.isArray(t))return Am(t);let a=[];t&&(a=a.concat(t)),i.core.ignoreRegisteredLoaders||a.push(...th()),Uh(a);let o=Bh(e,a,i,r);if(!o&&!i.core.nothrow)throw Error(Hh(e));return o}function Bh(e,t,n,r){let i=ch(e),a=lh(e),o=Lm(i)||r?.url,s=null,c=``;return n?.core?.mimeType&&(s=Kh(t,n?.core?.mimeType),c=`match forced by supplied MIME type ${n?.core?.mimeType}`),s||=Wh(t,o),c||=s?`matched url ${o}`:``,s||=Kh(t,a),c||=s?`matched MIME type ${a}`:``,s||=qh(t,e),c||=s?`matched initial data ${Zh(e)}`:``,n?.core?.fallbackMimeType&&(s||=Kh(t,n?.core?.fallbackMimeType),c||=s?`matched fallback MIME type ${a}`:``),c&&Jf.log(1,`selectLoader selected ${s?.name}: ${c}.`),s}function Vh(e){return!(e instanceof Response&&e.status===204)}function Hh(e){let t=ch(e),n=lh(e),r=`No valid loader found (`;r+=t?`${Cm(t)}, `:`no url provided, `,r+=`MIME type: ${n?`"${n}"`:`not provided`}, `;let i=e?Zh(e):``;return r+=i?` first bytes: "${i}"`:`first bytes: not available`,r+=`)`,r}function Uh(e){for(let t of e)Am(t)}function Wh(e,t){let n=t&&Ih.exec(t),r=n&&n[1];return r?Gh(e,r):null}function Gh(e,t){t=t.toLowerCase();for(let n of e)for(let e of n.extensions)if(e.toLowerCase()===t)return n;return null}function Kh(e,t){for(let n of e)if(n.mimeTypes?.some(e=>ah(t,e))||ah(t,`application/x.${n.id}`))return n;return null}function qh(e,t){if(!t)return null;for(let n of e)if(typeof t==`string`){if(Jh(t,n))return n}else if(ArrayBuffer.isView(t)){if(Yh(t.buffer,t.byteOffset,n))return n}else if(t instanceof ArrayBuffer&&Yh(t,0,n))return n;return null}function Jh(e,t){return t.testText?t.testText(e):(Array.isArray(t.tests)?t.tests:[t.tests]).some(t=>e.startsWith(t))}function Yh(e,t,n){return(Array.isArray(n.tests)?n.tests:[n.tests]).some(r=>Xh(e,t,n,r))}function Xh(e,t,n,r){if(ep(r))return Zp(r,e,r.byteLength);switch(typeof r){case`function`:return r(ym(e));case`string`:return r===Qh(e,t,r.length);default:return!1}}function Zh(e,t=5){return typeof e==`string`?e.slice(0,t):ArrayBuffer.isView(e)?Qh(e.buffer,e.byteOffset,t):e instanceof ArrayBuffer?Qh(e,0,t):``}function Qh(e,t,n){if(e.byteLength<t+n)return``;let r=new DataView(e),i=``;for(let e=0;e<n;e++)i+=String.fromCharCode(r.getUint8(t+e));return i}async function $h(e,t,n,r){t&&!Array.isArray(t)&&!km(t)&&(r=void 0,n=t,t=void 0),e=await e,n||={};let i=ch(e),a=Fh(t,r),o=await Lh(e,a,n);if(!o)return null;let s=Hm(n,o,a,i);return r=Ph({url:i,_parse:$h,loaders:a},s,r||null),await eg(o,e,s,r)}async function eg(e,t,n,r){if(Ip(e),n=cp(e.options,n),rp(t)){let{ok:e,redirected:n,status:i,statusText:a,type:o,url:s}=t;r.response={headers:Object.fromEntries(t.headers.entries()),ok:e,redirected:n,status:i,statusText:a,type:o,url:s}}t=await Nh(t,e,n);let i=e;if(i.parseTextSync&&typeof t==`string`)return i.parseTextSync(t,n,r);if(Gp(e,n))return await Kp(e,t,n,r,$h);if(i.parseText&&typeof t==`string`)return await i.parseText(t,n,r);if(i.parse)return await i.parse(t,n,r);throw fp(!i.parseSync),Error(`${e.id} loader - no parser found and worker is disabled`)}async function tg(e,t,n,r){let i,a;!Array.isArray(t)&&!km(t)?(i=[],a=t,r=void 0):(i=t,a=n);let o=bh(a),s=e;return typeof e==`string`&&(s=await o(e)),ip(e)&&(s=await o(e)),typeof e==`string`&&(Um(a||{}).core?.baseUrl||(a={...a,core:{...a?.core,baseUrl:e}})),await $h(s,i,a)}var ng=new class{constructor(e={}){this._pool=[],this.opts={overAlloc:2,poolSize:100},this.setOptions(e)}setOptions(e){Object.assign(this.opts,e)}allocate(e,t,{size:n=1,type:r,padding:i=0,copy:a=!1,initialize:o=!1,maxCount:s}){let c=r||e&&e.constructor||Float32Array,l=t*n+i;if(ArrayBuffer.isView(e)){if(l<=e.length)return e;if(l*e.BYTES_PER_ELEMENT<=e.buffer.byteLength)return new c(e.buffer,0,l)}let u=1/0;s&&(u=s*n+i);let d=this._allocate(c,l,o,u);return e&&a?d.set(e):o||d.fill(0,0,4),this._release(e),d}release(e){this._release(e)}_allocate(e,t,n,r){let i=Math.max(Math.ceil(t*this.opts.overAlloc),1);i>r&&(i=r);let a=this._pool,o=e.BYTES_PER_ELEMENT*i,s=a.findIndex(e=>e.byteLength>=o);if(s>=0){let t=new e(a.splice(s,1)[0],0,i);return n&&t.fill(0),t}return new e(i)}_release(e){if(!ArrayBuffer.isView(e))return;let t=this._pool,{buffer:n}=e,{byteLength:r}=n,i=t.findIndex(e=>e.byteLength>=r);i<0?t.push(n):(i>0||t.length<this.opts.poolSize)&&t.splice(i,0,n),t.length>this.opts.poolSize&&t.shift()}};function rg(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}function ig(e,t){let n=e%t;return n<0?t+n:n}function ag(e){return[e[12],e[13],e[14]]}function og(e){return{left:cg(e[3]+e[0],e[7]+e[4],e[11]+e[8],e[15]+e[12]),right:cg(e[3]-e[0],e[7]-e[4],e[11]-e[8],e[15]-e[12]),bottom:cg(e[3]+e[1],e[7]+e[5],e[11]+e[9],e[15]+e[13]),top:cg(e[3]-e[1],e[7]-e[5],e[11]-e[9],e[15]-e[13]),near:cg(e[3]+e[2],e[7]+e[6],e[11]+e[10],e[15]+e[14]),far:cg(e[3]-e[2],e[7]-e[6],e[11]-e[10],e[15]-e[14])}}var sg=new z;function cg(e,t,n,r){sg.set(e,t,n);let i=sg.len();return{distance:r/i,normal:new z(-e/i,-t/i,-n/i)}}function lg(e){return e-Math.fround(e)}var ug;function dg(e,t){let{size:n=1,startIndex:r=0}=t,i=t.endIndex===void 0?e.length:t.endIndex,a=(i-r)/n;ug=ng.allocate(ug,a,{type:Float32Array,size:n*2});let o=r,s=0;for(;o<i;){for(let t=0;t<n;t++){let r=e[o++];ug[s+t]=r,ug[s+t+n]=lg(r)}s+=n*2}return ug.subarray(0,a*n*2)}function fg(e){let t=null,n=!1;for(let r of e)r&&(t?(n||=(t=[[t[0][0],t[0][1]],[t[1][0],t[1][1]]],!0),t[0][0]=Math.min(t[0][0],r[0][0]),t[0][1]=Math.min(t[0][1],r[0][1]),t[1][0]=Math.max(t[1][0],r[1][0]),t[1][1]=Math.max(t[1][1],r[1][1])):t=r);return t}var pg=Math.PI/180,mg=rg(),hg=[0,0,0],gg={unitsPerMeter:[1,1,1],metersPerUnit:[1,1,1]};function _g({width:e,height:t,orthographic:n,fovyRadians:r,focalDistance:i,padding:a,near:o,far:s}){let c=e/t,l=n?new V().orthographic({fovy:r,aspect:c,focalDistance:i,near:o,far:s}):new V().perspective({fovy:r,aspect:c,near:o,far:s});if(a){let{left:n=0,right:r=0,top:i=0,bottom:o=0}=a,s=$o((n+e-r)/2,0,e)-e/2,c=$o((i+t-o)/2,0,t)-t/2;l[8]-=s*2/e,l[9]+=c*2/t}return l}var vg=class e{constructor(e={}){this._frustumPlanes={},this.id=e.id||this.constructor.displayName||`viewport`,this.x=e.x||0,this.y=e.y||0,this.width=e.width||1,this.height=e.height||1,this.zoom=e.zoom||0,this.padding=e.padding,this.distanceScales=e.distanceScales||gg,this.focalDistance=e.focalDistance||1,this.position=e.position||hg,this.modelMatrix=e.modelMatrix||null;let{longitude:t,latitude:n}=e;this.isGeospatial=Number.isFinite(n)&&Number.isFinite(t),this._initProps(e),this._initMatrices(e),this.equals=this.equals.bind(this),this.project=this.project.bind(this),this.unproject=this.unproject.bind(this),this.projectPosition=this.projectPosition.bind(this),this.unprojectPosition=this.unprojectPosition.bind(this),this.projectFlat=this.projectFlat.bind(this),this.unprojectFlat=this.unprojectFlat.bind(this)}get subViewports(){return null}get metersPerPixel(){return this.distanceScales.metersPerUnit[2]/this.scale}get projectionMode(){return this.isGeospatial?this.zoom<12?Ct.WEB_MERCATOR:Ct.WEB_MERCATOR_AUTO_OFFSET:Ct.IDENTITY}equals(t){return t instanceof e?this===t?!0:t.width===this.width&&t.height===this.height&&t.scale===this.scale&&ts(t.projectionMatrix,this.projectionMatrix)&&ts(t.viewMatrix,this.viewMatrix):!1}project(e,{topLeft:t=!0}={}){let n=bf(this.projectPosition(e),this.pixelProjectionMatrix),[r,i]=n,a=t?i:this.height-i;return e.length===2?[r,a]:[r,a,n[2]]}unproject(e,{topLeft:t=!0,targetZ:n}={}){let[r,i,a]=e,o=t?i:this.height-i,s=n&&n*this.distanceScales.unitsPerMeter[2],c=xf([r,o,a],this.pixelUnprojectionMatrix,s),[l,u,d]=this.unprojectPosition(c);return Number.isFinite(a)?[l,u,d]:Number.isFinite(n)?[l,u,n]:[l,u]}projectPosition(e){let[t,n]=this.projectFlat(e);return[t,n,(e[2]||0)*this.distanceScales.unitsPerMeter[2]]}unprojectPosition(e){let[t,n]=this.unprojectFlat(e);return[t,n,(e[2]||0)*this.distanceScales.metersPerUnit[2]]}projectFlat(e){if(this.isGeospatial){let t=uf(e);return t[1]=$o(t[1],-318,830),t}return e}unprojectFlat(e){return this.isGeospatial?df(e):e}getBounds(e={}){let t={targetZ:e.z||0},n=this.unproject([0,0],t),r=this.unproject([this.width,0],t),i=this.unproject([0,this.height],t),a=this.unproject([this.width,this.height],t);return[Math.min(n[0],r[0],i[0],a[0]),Math.min(n[1],r[1],i[1],a[1]),Math.max(n[0],r[0],i[0],a[0]),Math.max(n[1],r[1],i[1],a[1])]}getDistanceScales(e){return e&&this.isGeospatial?mf({longitude:e[0],latitude:e[1],highPrecision:!0}):this.distanceScales}containsPixel({x:e,y:t,width:n=1,height:r=1}){return e<this.x+this.width&&this.x<e+n&&t<this.y+this.height&&this.y<t+r}getFrustumPlanes(){return this._frustumPlanes.near||Object.assign(this._frustumPlanes,og(this.viewProjectionMatrix)),this._frustumPlanes}panByPosition(e,t,n){return null}_initProps(e){let t=e.longitude,n=e.latitude;this.isGeospatial&&(Number.isFinite(e.zoom)||(this.zoom=ff({latitude:n})+Math.log2(this.focalDistance)),this.distanceScales=e.distanceScales||mf({latitude:n,longitude:t}));let r=2**this.zoom;this.scale=r;let{position:i,modelMatrix:a}=e,o=hg;if(i&&(o=a?new V(a).transformAsVector(i,[]):i),this.isGeospatial){let e=this.projectPosition([t,n,0]);this.center=new z(o).scale(this.distanceScales.unitsPerMeter).add(e)}else this.center=this.projectPosition(o)}_initMatrices(e){let{viewMatrix:t=mg,projectionMatrix:n=null,orthographic:r=!1,fovyRadians:i,fovy:a=75,near:o=.1,far:s=1e3,padding:c=null,focalDistance:l=1}=e;this.viewMatrixUncentered=t,this.viewMatrix=new V().multiplyRight(t).translate(new z(this.center).negate()),this.projectionMatrix=n||_g({width:this.width,height:this.height,orthographic:r,fovyRadians:i||a*pg,focalDistance:l,padding:c,near:o,far:s});let u=rg();_c(u,u,this.projectionMatrix),_c(u,u,this.viewMatrix),this.viewProjectionMatrix=u,this.viewMatrixInverse=hc([],this.viewMatrix)||this.viewMatrix,this.cameraPosition=ag(this.viewMatrixInverse);let d=rg(),f=rg();yc(d,d,[this.width/2,-this.height/2,1]),vc(d,d,[1,-1,0]),_c(f,d,this.viewProjectionMatrix),this.pixelProjectionMatrix=f,this.pixelUnprojectionMatrix=hc(rg(),this.pixelProjectionMatrix),this.pixelUnprojectionMatrix||O.warn(`Pixel project matrix not invertible`)()}};vg.displayName=`Viewport`;function yg(e,t,n){if(e===t)return!0;if(!n||!e||!t)return!1;if(Array.isArray(e)){if(!Array.isArray(t)||e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!yg(e[r],t[r],n-1))return!1;return!0}if(Array.isArray(t))return!1;if(typeof e==`object`&&typeof t==`object`){let r=Object.keys(e),i=Object.keys(t);if(r.length!==i.length)return!1;for(let i of r)if(!t.hasOwnProperty(i)||!yg(e[i],t[i],n-1))return!1;return!0}return!1}var bg=class e extends vg{constructor(e={}){let{latitude:t=0,longitude:n=0,zoom:r=0,pitch:i=0,bearing:a=0,nearZMultiplier:o=.1,farZMultiplier:s=1.01,nearZ:c,farZ:l,orthographic:u=!1,projectionMatrix:d,repeat:f=!1,worldOffset:p=0,position:m,padding:h,legacyMeterSizes:g=!1}=e,{width:_,height:v,altitude:y=1.5}=e,b=2**r;_||=1,v||=1;let x,S=null;if(d)y=d[5]/2,x=vf(y);else{e.fovy?(x=e.fovy,y=yf(x)):x=vf(y);let n;if(h){let{top:e=0,bottom:t=0}=h;n=[0,$o((e+v-t)/2,0,v)-v/2]}S=_f({width:_,height:v,scale:b,center:m&&[0,0,m[2]*pf(t)],offset:n,pitch:i,fovy:x,nearZMultiplier:o,farZMultiplier:s}),Number.isFinite(c)&&(S.near=c),Number.isFinite(l)&&(S.far=l)}let C=gf({height:v,pitch:i,bearing:a,scale:b,altitude:y});p&&(C=new V().translate([512*p,0,0]).multiplyLeft(C)),super({...e,width:_,height:v,viewMatrix:C,longitude:n,latitude:t,zoom:r,...S,fovy:x,focalDistance:y}),this.latitude=t,this.longitude=n,this.zoom=r,this.pitch=i,this.bearing=a,this.altitude=y,this.fovy=x,this.orthographic=u,this._subViewports=f?[]:null,this._pseudoMeters=g,Object.freeze(this)}get subViewports(){if(this._subViewports&&!this._subViewports.length){let t=this.getBounds(),n=Math.floor((t[0]+180)/360),r=Math.ceil((t[2]-180)/360);for(let t=n;t<=r;t++){let n=t?new e({...this,worldOffset:t}):this;this._subViewports.push(n)}}return this._subViewports}projectPosition(e){if(this._pseudoMeters)return super.projectPosition(e);let[t,n]=this.projectFlat(e);return[t,n,(e[2]||0)*pf(e[1])]}unprojectPosition(e){if(this._pseudoMeters)return super.unprojectPosition(e);let[t,n]=this.unprojectFlat(e);return[t,n,(e[2]||0)/pf(n)]}addMetersToLngLat(e,t){return hf(e,t)}panByPosition(e,t,n){let r=xf(t,this.pixelUnprojectionMatrix),i=fs([],this.projectFlat(e),ms([],r)),a=fs([],this.center,i),[o,s]=this.unprojectFlat(a);return{longitude:o,latitude:s}}panByPosition3D(e,t){let n=e[2]||0,r=bs([],e,this.unproject(t,{targetZ:n}));return{longitude:this.longitude+r[0],latitude:this.latitude+r[1]}}getBounds(e={}){let t=Tf(this,e.z||0);return[Math.min(t[0][0],t[1][0],t[2][0],t[3][0]),Math.min(t[0][1],t[1][1],t[2][1],t[3][1]),Math.max(t[0][0],t[1][0],t[2][0],t[3][0]),Math.max(t[0][1],t[1][1],t[2][1],t[3][1])]}fitBounds(t,n={}){let{width:r,height:i}=this,{longitude:a,latitude:o,zoom:s}=Sf({width:r,height:i,bounds:t,...n});return new e({width:r,height:i,longitude:a,latitude:o,zoom:s})}};bg.displayName=`WebMercatorViewport`;var xg=class{constructor(e){this._inProgress=!1,this._handle=null,this.time=0,this.settings={duration:0},this._timeline=e}get inProgress(){return this._inProgress}start(e){this.cancel(),this.settings=e,this._inProgress=!0,this.settings.onStart?.(this)}end(){this._inProgress&&(this._timeline.removeChannel(this._handle),this._handle=null,this._inProgress=!1,this.settings.onEnd?.(this))}cancel(){this._inProgress&&=(this.settings.onInterrupt?.(this),this._timeline.removeChannel(this._handle),this._handle=null,!1)}update(){if(!this._inProgress)return!1;if(this._handle===null){let{_timeline:e,settings:t}=this;this._handle=e.addChannel({delay:e.getTime(),duration:t.duration})}return this.time=this._timeline.getTime(this._handle),this._onUpdate(),this.settings.onUpdate?.(this),this._timeline.isFinished(this._handle)&&this.end(),!0}_onUpdate(){}};function Sg(e,t){if(!e)throw Error(t||`deck.gl: assertion failed.`)}var Cg=`4.4.3`,wg=globalThis.loaders?.parseImageNode,Tg=typeof Image<`u`,Eg=typeof ImageBitmap<`u`,Dg=Wf?!0:!!wg;function Og(e){switch(e){case`auto`:return Eg||Tg||Dg;case`imagebitmap`:return Eg;case`image`:return Tg;case`data`:return Dg;default:throw Error(`@loaders.gl/images: image ${e} not supported in this environment`)}}function kg(){if(Eg)return`imagebitmap`;if(Tg)return`image`;if(Dg)return`data`;throw Error(`Install '@loaders.gl/polyfills' to parse images under Node.js`)}function Ag(e){let t=Mg(e);if(!t)throw Error(`Not an image`);return t}function jg(e){switch(Ag(e)){case`data`:return e;case`image`:case`imagebitmap`:let t=document.createElement(`canvas`),n=t.getContext(`2d`);if(!n)throw Error(`getImageData`);return t.width=e.width,t.height=e.height,n.drawImage(e,0,0),n.getImageData(0,0,e.width,e.height);default:throw Error(`getImageData`)}}function Mg(e){return typeof ImageBitmap<`u`&&e instanceof ImageBitmap?`imagebitmap`:typeof Image<`u`&&e instanceof Image?`image`:e&&typeof e==`object`&&e.data&&e.width&&e.height?`data`:null}var Ng=/^data:image\/svg\+xml/,Pg=/\.svg((\?|#).*)?$/;function Fg(e){return e&&(Ng.test(e)||Pg.test(e))}function Ig(e,t){if(Fg(t)){let t=new TextDecoder().decode(e);try{typeof unescape==`function`&&typeof encodeURIComponent==`function`&&(t=unescape(encodeURIComponent(t)))}catch(e){throw Error(e.message)}return`data:image/svg+xml;base64,${btoa(t)}`}return Lg(e,t)}function Lg(e,t){if(Fg(t))throw Error(`SVG cannot be parsed directly to imagebitmap`);return new Blob([new Uint8Array(e)])}async function Rg(e,t,n){let r=Ig(e,n),i=self.URL||self.webkitURL,a=typeof r!=`string`&&i.createObjectURL(r);try{return await zg(a||r,t)}finally{a&&i.revokeObjectURL(a)}}async function zg(e,t){let n=new Image;return n.src=e,t.image&&t.image.decode&&n.decode?(await n.decode(),n):await new Promise((e,t)=>{try{n.onload=()=>e(n),n.onerror=e=>{let n=e instanceof Error?e.message:`error`;t(Error(n))}}catch(e){t(e)}})}var Bg=!0;async function Vg(e,t,n){let r;r=Fg(n)?await Rg(e,t,n):Lg(e,n);let i=t&&t.imagebitmap;return await Hg(r,i)}async function Hg(e,t=null){if((Ug(t)||!Bg)&&(t=null),t)try{return await createImageBitmap(e,t)}catch(e){console.warn(e),Bg=!1}return await createImageBitmap(e)}function Ug(e){if(!e)return!0;for(let t in e)if(Object.prototype.hasOwnProperty.call(e,t))return!1;return!0}function Wg(e){return!Jg(e,`ftyp`,4)||!(e[8]&96)?null:Gg(e)}function Gg(e){switch(Kg(e,8,12).replace(`\0`,` `).trim()){case`avif`:case`avis`:return{extension:`avif`,mimeType:`image/avif`};default:return null}}function Kg(e,t,n){return String.fromCharCode(...e.slice(t,n))}function qg(e){return[...e].map(e=>e.charCodeAt(0))}function Jg(e,t,n=0){let r=qg(t);for(let t=0;t<r.length;++t)if(r[t]!==e[t+n])return!1;return!0}var Yg=!1,Xg=!0;function Zg(e){let t=i_(e);return $g(t)||n_(t)||e_(t)||t_(t)||Qg(t)}function Qg(e){let t=Wg(new Uint8Array(e instanceof DataView?e.buffer:e));return t?{mimeType:t.mimeType,width:0,height:0}:null}function $g(e){let t=i_(e);return t.byteLength>=24&&t.getUint32(0,Yg)===2303741511?{mimeType:`image/png`,width:t.getUint32(16,Yg),height:t.getUint32(20,Yg)}:null}function e_(e){let t=i_(e);return t.byteLength>=10&&t.getUint32(0,Yg)===1195984440?{mimeType:`image/gif`,width:t.getUint16(6,Xg),height:t.getUint16(8,Xg)}:null}function t_(e){let t=i_(e);return t.byteLength>=14&&t.getUint16(0,Yg)===16973&&t.getUint32(2,Xg)===t.byteLength?{mimeType:`image/bmp`,width:t.getUint32(18,Xg),height:t.getUint32(22,Xg)}:null}function n_(e){let t=i_(e);if(!(t.byteLength>=3&&t.getUint16(0,Yg)===65496&&t.getUint8(2)===255))return null;let{tableMarkers:n,sofMarkers:r}=r_(),i=2;for(;i+9<t.byteLength;){let e=t.getUint16(i,Yg);if(r.has(e))return{mimeType:`image/jpeg`,height:t.getUint16(i+5,Yg),width:t.getUint16(i+7,Yg)};if(!n.has(e))return null;i+=2,i+=t.getUint16(i,Yg)}return null}function r_(){let e=new Set([65499,65476,65484,65501,65534]);for(let t=65504;t<65520;++t)e.add(t);return{tableMarkers:e,sofMarkers:new Set([65472,65473,65474,65475,65477,65478,65479,65481,65482,65483,65485,65486,65487,65502])}}function i_(e){if(e instanceof DataView)return e;if(ArrayBuffer.isView(e))return new DataView(e.buffer);if(e instanceof ArrayBuffer)return new DataView(e);throw Error(`toDataView`)}async function a_(e,t){let{mimeType:n}=Zg(e)||{},r=globalThis.loaders?.parseImageNode;return H(r),await r(e,n)}async function o_(e,t,n){t||={};let r=(t.image||{}).type||`auto`,{url:i}=n||{},a=s_(r),o;switch(a){case`imagebitmap`:o=await Vg(e,t,i);break;case`image`:o=await Rg(e,t,i);break;case`data`:o=await a_(e,t);break;default:H(!1)}return r===`data`&&(o=jg(o)),o}function s_(e){switch(e){case`auto`:case`data`:return kg();default:return Og(e),e}}var c_={dataType:null,batchType:null,id:`image`,module:`images`,name:`Images`,version:Cg,mimeTypes:[`image/png`,`image/jpeg`,`image/gif`,`image/webp`,`image/avif`,`image/bmp`,`image/vnd.microsoft.icon`,`image/svg+xml`],extensions:[`png`,`jpg`,`jpeg`,`gif`,`webp`,`bmp`,`ico`,`svg`,`avif`],parse:o_,tests:[e=>!!Zg(new DataView(e))],options:{image:{type:`auto`,decode:!0}}},l_={};function u_(e){return l_[e]===void 0&&(l_[e]=Wf?f_(e):d_(e)),l_[e]}function d_(e){let t=globalThis.loaders?.imageFormatsNode||[`image/png`,`image/jpeg`,`image/gif`];return!!globalThis.loaders?.parseImageNode&&t.includes(e)}function f_(e){switch(e){case`image/avif`:case`image/webp`:return p_(e);default:return!0}}function p_(e){try{return document.createElement(`canvas`).toDataURL(e).indexOf(`data:${e}`)===0}catch{return!1}}var m_;(function(e){e[e.DEPTH_BUFFER_BIT=256]=`DEPTH_BUFFER_BIT`,e[e.STENCIL_BUFFER_BIT=1024]=`STENCIL_BUFFER_BIT`,e[e.COLOR_BUFFER_BIT=16384]=`COLOR_BUFFER_BIT`,e[e.POINTS=0]=`POINTS`,e[e.LINES=1]=`LINES`,e[e.LINE_LOOP=2]=`LINE_LOOP`,e[e.LINE_STRIP=3]=`LINE_STRIP`,e[e.TRIANGLES=4]=`TRIANGLES`,e[e.TRIANGLE_STRIP=5]=`TRIANGLE_STRIP`,e[e.TRIANGLE_FAN=6]=`TRIANGLE_FAN`,e[e.ZERO=0]=`ZERO`,e[e.ONE=1]=`ONE`,e[e.SRC_COLOR=768]=`SRC_COLOR`,e[e.ONE_MINUS_SRC_COLOR=769]=`ONE_MINUS_SRC_COLOR`,e[e.SRC_ALPHA=770]=`SRC_ALPHA`,e[e.ONE_MINUS_SRC_ALPHA=771]=`ONE_MINUS_SRC_ALPHA`,e[e.DST_ALPHA=772]=`DST_ALPHA`,e[e.ONE_MINUS_DST_ALPHA=773]=`ONE_MINUS_DST_ALPHA`,e[e.DST_COLOR=774]=`DST_COLOR`,e[e.ONE_MINUS_DST_COLOR=775]=`ONE_MINUS_DST_COLOR`,e[e.SRC_ALPHA_SATURATE=776]=`SRC_ALPHA_SATURATE`,e[e.CONSTANT_COLOR=32769]=`CONSTANT_COLOR`,e[e.ONE_MINUS_CONSTANT_COLOR=32770]=`ONE_MINUS_CONSTANT_COLOR`,e[e.CONSTANT_ALPHA=32771]=`CONSTANT_ALPHA`,e[e.ONE_MINUS_CONSTANT_ALPHA=32772]=`ONE_MINUS_CONSTANT_ALPHA`,e[e.FUNC_ADD=32774]=`FUNC_ADD`,e[e.FUNC_SUBTRACT=32778]=`FUNC_SUBTRACT`,e[e.FUNC_REVERSE_SUBTRACT=32779]=`FUNC_REVERSE_SUBTRACT`,e[e.BLEND_EQUATION=32777]=`BLEND_EQUATION`,e[e.BLEND_EQUATION_RGB=32777]=`BLEND_EQUATION_RGB`,e[e.BLEND_EQUATION_ALPHA=34877]=`BLEND_EQUATION_ALPHA`,e[e.BLEND_DST_RGB=32968]=`BLEND_DST_RGB`,e[e.BLEND_SRC_RGB=32969]=`BLEND_SRC_RGB`,e[e.BLEND_DST_ALPHA=32970]=`BLEND_DST_ALPHA`,e[e.BLEND_SRC_ALPHA=32971]=`BLEND_SRC_ALPHA`,e[e.BLEND_COLOR=32773]=`BLEND_COLOR`,e[e.ARRAY_BUFFER_BINDING=34964]=`ARRAY_BUFFER_BINDING`,e[e.ELEMENT_ARRAY_BUFFER_BINDING=34965]=`ELEMENT_ARRAY_BUFFER_BINDING`,e[e.LINE_WIDTH=2849]=`LINE_WIDTH`,e[e.ALIASED_POINT_SIZE_RANGE=33901]=`ALIASED_POINT_SIZE_RANGE`,e[e.ALIASED_LINE_WIDTH_RANGE=33902]=`ALIASED_LINE_WIDTH_RANGE`,e[e.CULL_FACE_MODE=2885]=`CULL_FACE_MODE`,e[e.FRONT_FACE=2886]=`FRONT_FACE`,e[e.DEPTH_RANGE=2928]=`DEPTH_RANGE`,e[e.DEPTH_WRITEMASK=2930]=`DEPTH_WRITEMASK`,e[e.DEPTH_CLEAR_VALUE=2931]=`DEPTH_CLEAR_VALUE`,e[e.DEPTH_FUNC=2932]=`DEPTH_FUNC`,e[e.STENCIL_CLEAR_VALUE=2961]=`STENCIL_CLEAR_VALUE`,e[e.STENCIL_FUNC=2962]=`STENCIL_FUNC`,e[e.STENCIL_FAIL=2964]=`STENCIL_FAIL`,e[e.STENCIL_PASS_DEPTH_FAIL=2965]=`STENCIL_PASS_DEPTH_FAIL`,e[e.STENCIL_PASS_DEPTH_PASS=2966]=`STENCIL_PASS_DEPTH_PASS`,e[e.STENCIL_REF=2967]=`STENCIL_REF`,e[e.STENCIL_VALUE_MASK=2963]=`STENCIL_VALUE_MASK`,e[e.STENCIL_WRITEMASK=2968]=`STENCIL_WRITEMASK`,e[e.STENCIL_BACK_FUNC=34816]=`STENCIL_BACK_FUNC`,e[e.STENCIL_BACK_FAIL=34817]=`STENCIL_BACK_FAIL`,e[e.STENCIL_BACK_PASS_DEPTH_FAIL=34818]=`STENCIL_BACK_PASS_DEPTH_FAIL`,e[e.STENCIL_BACK_PASS_DEPTH_PASS=34819]=`STENCIL_BACK_PASS_DEPTH_PASS`,e[e.STENCIL_BACK_REF=36003]=`STENCIL_BACK_REF`,e[e.STENCIL_BACK_VALUE_MASK=36004]=`STENCIL_BACK_VALUE_MASK`,e[e.STENCIL_BACK_WRITEMASK=36005]=`STENCIL_BACK_WRITEMASK`,e[e.VIEWPORT=2978]=`VIEWPORT`,e[e.SCISSOR_BOX=3088]=`SCISSOR_BOX`,e[e.COLOR_CLEAR_VALUE=3106]=`COLOR_CLEAR_VALUE`,e[e.COLOR_WRITEMASK=3107]=`COLOR_WRITEMASK`,e[e.UNPACK_ALIGNMENT=3317]=`UNPACK_ALIGNMENT`,e[e.PACK_ALIGNMENT=3333]=`PACK_ALIGNMENT`,e[e.MAX_TEXTURE_SIZE=3379]=`MAX_TEXTURE_SIZE`,e[e.MAX_VIEWPORT_DIMS=3386]=`MAX_VIEWPORT_DIMS`,e[e.SUBPIXEL_BITS=3408]=`SUBPIXEL_BITS`,e[e.RED_BITS=3410]=`RED_BITS`,e[e.GREEN_BITS=3411]=`GREEN_BITS`,e[e.BLUE_BITS=3412]=`BLUE_BITS`,e[e.ALPHA_BITS=3413]=`ALPHA_BITS`,e[e.DEPTH_BITS=3414]=`DEPTH_BITS`,e[e.STENCIL_BITS=3415]=`STENCIL_BITS`,e[e.POLYGON_OFFSET_UNITS=10752]=`POLYGON_OFFSET_UNITS`,e[e.POLYGON_OFFSET_FACTOR=32824]=`POLYGON_OFFSET_FACTOR`,e[e.TEXTURE_BINDING_2D=32873]=`TEXTURE_BINDING_2D`,e[e.SAMPLE_BUFFERS=32936]=`SAMPLE_BUFFERS`,e[e.SAMPLES=32937]=`SAMPLES`,e[e.SAMPLE_COVERAGE_VALUE=32938]=`SAMPLE_COVERAGE_VALUE`,e[e.SAMPLE_COVERAGE_INVERT=32939]=`SAMPLE_COVERAGE_INVERT`,e[e.COMPRESSED_TEXTURE_FORMATS=34467]=`COMPRESSED_TEXTURE_FORMATS`,e[e.VENDOR=7936]=`VENDOR`,e[e.RENDERER=7937]=`RENDERER`,e[e.VERSION=7938]=`VERSION`,e[e.IMPLEMENTATION_COLOR_READ_TYPE=35738]=`IMPLEMENTATION_COLOR_READ_TYPE`,e[e.IMPLEMENTATION_COLOR_READ_FORMAT=35739]=`IMPLEMENTATION_COLOR_READ_FORMAT`,e[e.BROWSER_DEFAULT_WEBGL=37444]=`BROWSER_DEFAULT_WEBGL`,e[e.STATIC_DRAW=35044]=`STATIC_DRAW`,e[e.STREAM_DRAW=35040]=`STREAM_DRAW`,e[e.DYNAMIC_DRAW=35048]=`DYNAMIC_DRAW`,e[e.ARRAY_BUFFER=34962]=`ARRAY_BUFFER`,e[e.ELEMENT_ARRAY_BUFFER=34963]=`ELEMENT_ARRAY_BUFFER`,e[e.BUFFER_SIZE=34660]=`BUFFER_SIZE`,e[e.BUFFER_USAGE=34661]=`BUFFER_USAGE`,e[e.CURRENT_VERTEX_ATTRIB=34342]=`CURRENT_VERTEX_ATTRIB`,e[e.VERTEX_ATTRIB_ARRAY_ENABLED=34338]=`VERTEX_ATTRIB_ARRAY_ENABLED`,e[e.VERTEX_ATTRIB_ARRAY_SIZE=34339]=`VERTEX_ATTRIB_ARRAY_SIZE`,e[e.VERTEX_ATTRIB_ARRAY_STRIDE=34340]=`VERTEX_ATTRIB_ARRAY_STRIDE`,e[e.VERTEX_ATTRIB_ARRAY_TYPE=34341]=`VERTEX_ATTRIB_ARRAY_TYPE`,e[e.VERTEX_ATTRIB_ARRAY_NORMALIZED=34922]=`VERTEX_ATTRIB_ARRAY_NORMALIZED`,e[e.VERTEX_ATTRIB_ARRAY_POINTER=34373]=`VERTEX_ATTRIB_ARRAY_POINTER`,e[e.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING=34975]=`VERTEX_ATTRIB_ARRAY_BUFFER_BINDING`,e[e.CULL_FACE=2884]=`CULL_FACE`,e[e.FRONT=1028]=`FRONT`,e[e.BACK=1029]=`BACK`,e[e.FRONT_AND_BACK=1032]=`FRONT_AND_BACK`,e[e.BLEND=3042]=`BLEND`,e[e.DEPTH_TEST=2929]=`DEPTH_TEST`,e[e.DITHER=3024]=`DITHER`,e[e.POLYGON_OFFSET_FILL=32823]=`POLYGON_OFFSET_FILL`,e[e.SAMPLE_ALPHA_TO_COVERAGE=32926]=`SAMPLE_ALPHA_TO_COVERAGE`,e[e.SAMPLE_COVERAGE=32928]=`SAMPLE_COVERAGE`,e[e.SCISSOR_TEST=3089]=`SCISSOR_TEST`,e[e.STENCIL_TEST=2960]=`STENCIL_TEST`,e[e.NO_ERROR=0]=`NO_ERROR`,e[e.INVALID_ENUM=1280]=`INVALID_ENUM`,e[e.INVALID_VALUE=1281]=`INVALID_VALUE`,e[e.INVALID_OPERATION=1282]=`INVALID_OPERATION`,e[e.OUT_OF_MEMORY=1285]=`OUT_OF_MEMORY`,e[e.CONTEXT_LOST_WEBGL=37442]=`CONTEXT_LOST_WEBGL`,e[e.CW=2304]=`CW`,e[e.CCW=2305]=`CCW`,e[e.DONT_CARE=4352]=`DONT_CARE`,e[e.FASTEST=4353]=`FASTEST`,e[e.NICEST=4354]=`NICEST`,e[e.GENERATE_MIPMAP_HINT=33170]=`GENERATE_MIPMAP_HINT`,e[e.BYTE=5120]=`BYTE`,e[e.UNSIGNED_BYTE=5121]=`UNSIGNED_BYTE`,e[e.SHORT=5122]=`SHORT`,e[e.UNSIGNED_SHORT=5123]=`UNSIGNED_SHORT`,e[e.INT=5124]=`INT`,e[e.UNSIGNED_INT=5125]=`UNSIGNED_INT`,e[e.FLOAT=5126]=`FLOAT`,e[e.DOUBLE=5130]=`DOUBLE`,e[e.DEPTH_COMPONENT=6402]=`DEPTH_COMPONENT`,e[e.ALPHA=6406]=`ALPHA`,e[e.RGB=6407]=`RGB`,e[e.RGBA=6408]=`RGBA`,e[e.LUMINANCE=6409]=`LUMINANCE`,e[e.LUMINANCE_ALPHA=6410]=`LUMINANCE_ALPHA`,e[e.UNSIGNED_SHORT_4_4_4_4=32819]=`UNSIGNED_SHORT_4_4_4_4`,e[e.UNSIGNED_SHORT_5_5_5_1=32820]=`UNSIGNED_SHORT_5_5_5_1`,e[e.UNSIGNED_SHORT_5_6_5=33635]=`UNSIGNED_SHORT_5_6_5`,e[e.FRAGMENT_SHADER=35632]=`FRAGMENT_SHADER`,e[e.VERTEX_SHADER=35633]=`VERTEX_SHADER`,e[e.COMPILE_STATUS=35713]=`COMPILE_STATUS`,e[e.DELETE_STATUS=35712]=`DELETE_STATUS`,e[e.LINK_STATUS=35714]=`LINK_STATUS`,e[e.VALIDATE_STATUS=35715]=`VALIDATE_STATUS`,e[e.ATTACHED_SHADERS=35717]=`ATTACHED_SHADERS`,e[e.ACTIVE_ATTRIBUTES=35721]=`ACTIVE_ATTRIBUTES`,e[e.ACTIVE_UNIFORMS=35718]=`ACTIVE_UNIFORMS`,e[e.MAX_VERTEX_ATTRIBS=34921]=`MAX_VERTEX_ATTRIBS`,e[e.MAX_VERTEX_UNIFORM_VECTORS=36347]=`MAX_VERTEX_UNIFORM_VECTORS`,e[e.MAX_VARYING_VECTORS=36348]=`MAX_VARYING_VECTORS`,e[e.MAX_COMBINED_TEXTURE_IMAGE_UNITS=35661]=`MAX_COMBINED_TEXTURE_IMAGE_UNITS`,e[e.MAX_VERTEX_TEXTURE_IMAGE_UNITS=35660]=`MAX_VERTEX_TEXTURE_IMAGE_UNITS`,e[e.MAX_TEXTURE_IMAGE_UNITS=34930]=`MAX_TEXTURE_IMAGE_UNITS`,e[e.MAX_FRAGMENT_UNIFORM_VECTORS=36349]=`MAX_FRAGMENT_UNIFORM_VECTORS`,e[e.SHADER_TYPE=35663]=`SHADER_TYPE`,e[e.SHADING_LANGUAGE_VERSION=35724]=`SHADING_LANGUAGE_VERSION`,e[e.CURRENT_PROGRAM=35725]=`CURRENT_PROGRAM`,e[e.NEVER=512]=`NEVER`,e[e.LESS=513]=`LESS`,e[e.EQUAL=514]=`EQUAL`,e[e.LEQUAL=515]=`LEQUAL`,e[e.GREATER=516]=`GREATER`,e[e.NOTEQUAL=517]=`NOTEQUAL`,e[e.GEQUAL=518]=`GEQUAL`,e[e.ALWAYS=519]=`ALWAYS`,e[e.KEEP=7680]=`KEEP`,e[e.REPLACE=7681]=`REPLACE`,e[e.INCR=7682]=`INCR`,e[e.DECR=7683]=`DECR`,e[e.INVERT=5386]=`INVERT`,e[e.INCR_WRAP=34055]=`INCR_WRAP`,e[e.DECR_WRAP=34056]=`DECR_WRAP`,e[e.NEAREST=9728]=`NEAREST`,e[e.LINEAR=9729]=`LINEAR`,e[e.NEAREST_MIPMAP_NEAREST=9984]=`NEAREST_MIPMAP_NEAREST`,e[e.LINEAR_MIPMAP_NEAREST=9985]=`LINEAR_MIPMAP_NEAREST`,e[e.NEAREST_MIPMAP_LINEAR=9986]=`NEAREST_MIPMAP_LINEAR`,e[e.LINEAR_MIPMAP_LINEAR=9987]=`LINEAR_MIPMAP_LINEAR`,e[e.TEXTURE_MAG_FILTER=10240]=`TEXTURE_MAG_FILTER`,e[e.TEXTURE_MIN_FILTER=10241]=`TEXTURE_MIN_FILTER`,e[e.TEXTURE_WRAP_S=10242]=`TEXTURE_WRAP_S`,e[e.TEXTURE_WRAP_T=10243]=`TEXTURE_WRAP_T`,e[e.TEXTURE_2D=3553]=`TEXTURE_2D`,e[e.TEXTURE=5890]=`TEXTURE`,e[e.TEXTURE_CUBE_MAP=34067]=`TEXTURE_CUBE_MAP`,e[e.TEXTURE_BINDING_CUBE_MAP=34068]=`TEXTURE_BINDING_CUBE_MAP`,e[e.TEXTURE_CUBE_MAP_POSITIVE_X=34069]=`TEXTURE_CUBE_MAP_POSITIVE_X`,e[e.TEXTURE_CUBE_MAP_NEGATIVE_X=34070]=`TEXTURE_CUBE_MAP_NEGATIVE_X`,e[e.TEXTURE_CUBE_MAP_POSITIVE_Y=34071]=`TEXTURE_CUBE_MAP_POSITIVE_Y`,e[e.TEXTURE_CUBE_MAP_NEGATIVE_Y=34072]=`TEXTURE_CUBE_MAP_NEGATIVE_Y`,e[e.TEXTURE_CUBE_MAP_POSITIVE_Z=34073]=`TEXTURE_CUBE_MAP_POSITIVE_Z`,e[e.TEXTURE_CUBE_MAP_NEGATIVE_Z=34074]=`TEXTURE_CUBE_MAP_NEGATIVE_Z`,e[e.MAX_CUBE_MAP_TEXTURE_SIZE=34076]=`MAX_CUBE_MAP_TEXTURE_SIZE`,e[e.TEXTURE0=33984]=`TEXTURE0`,e[e.ACTIVE_TEXTURE=34016]=`ACTIVE_TEXTURE`,e[e.REPEAT=10497]=`REPEAT`,e[e.CLAMP_TO_EDGE=33071]=`CLAMP_TO_EDGE`,e[e.MIRRORED_REPEAT=33648]=`MIRRORED_REPEAT`,e[e.TEXTURE_WIDTH=4096]=`TEXTURE_WIDTH`,e[e.TEXTURE_HEIGHT=4097]=`TEXTURE_HEIGHT`,e[e.FLOAT_VEC2=35664]=`FLOAT_VEC2`,e[e.FLOAT_VEC3=35665]=`FLOAT_VEC3`,e[e.FLOAT_VEC4=35666]=`FLOAT_VEC4`,e[e.INT_VEC2=35667]=`INT_VEC2`,e[e.INT_VEC3=35668]=`INT_VEC3`,e[e.INT_VEC4=35669]=`INT_VEC4`,e[e.BOOL=35670]=`BOOL`,e[e.BOOL_VEC2=35671]=`BOOL_VEC2`,e[e.BOOL_VEC3=35672]=`BOOL_VEC3`,e[e.BOOL_VEC4=35673]=`BOOL_VEC4`,e[e.FLOAT_MAT2=35674]=`FLOAT_MAT2`,e[e.FLOAT_MAT3=35675]=`FLOAT_MAT3`,e[e.FLOAT_MAT4=35676]=`FLOAT_MAT4`,e[e.SAMPLER_2D=35678]=`SAMPLER_2D`,e[e.SAMPLER_CUBE=35680]=`SAMPLER_CUBE`,e[e.LOW_FLOAT=36336]=`LOW_FLOAT`,e[e.MEDIUM_FLOAT=36337]=`MEDIUM_FLOAT`,e[e.HIGH_FLOAT=36338]=`HIGH_FLOAT`,e[e.LOW_INT=36339]=`LOW_INT`,e[e.MEDIUM_INT=36340]=`MEDIUM_INT`,e[e.HIGH_INT=36341]=`HIGH_INT`,e[e.FRAMEBUFFER=36160]=`FRAMEBUFFER`,e[e.RENDERBUFFER=36161]=`RENDERBUFFER`,e[e.RGBA4=32854]=`RGBA4`,e[e.RGB5_A1=32855]=`RGB5_A1`,e[e.RGB565=36194]=`RGB565`,e[e.DEPTH_COMPONENT16=33189]=`DEPTH_COMPONENT16`,e[e.STENCIL_INDEX=6401]=`STENCIL_INDEX`,e[e.STENCIL_INDEX8=36168]=`STENCIL_INDEX8`,e[e.DEPTH_STENCIL=34041]=`DEPTH_STENCIL`,e[e.RENDERBUFFER_WIDTH=36162]=`RENDERBUFFER_WIDTH`,e[e.RENDERBUFFER_HEIGHT=36163]=`RENDERBUFFER_HEIGHT`,e[e.RENDERBUFFER_INTERNAL_FORMAT=36164]=`RENDERBUFFER_INTERNAL_FORMAT`,e[e.RENDERBUFFER_RED_SIZE=36176]=`RENDERBUFFER_RED_SIZE`,e[e.RENDERBUFFER_GREEN_SIZE=36177]=`RENDERBUFFER_GREEN_SIZE`,e[e.RENDERBUFFER_BLUE_SIZE=36178]=`RENDERBUFFER_BLUE_SIZE`,e[e.RENDERBUFFER_ALPHA_SIZE=36179]=`RENDERBUFFER_ALPHA_SIZE`,e[e.RENDERBUFFER_DEPTH_SIZE=36180]=`RENDERBUFFER_DEPTH_SIZE`,e[e.RENDERBUFFER_STENCIL_SIZE=36181]=`RENDERBUFFER_STENCIL_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE=36048]=`FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE`,e[e.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME=36049]=`FRAMEBUFFER_ATTACHMENT_OBJECT_NAME`,e[e.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL=36050]=`FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL`,e[e.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE=36051]=`FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE`,e[e.COLOR_ATTACHMENT0=36064]=`COLOR_ATTACHMENT0`,e[e.DEPTH_ATTACHMENT=36096]=`DEPTH_ATTACHMENT`,e[e.STENCIL_ATTACHMENT=36128]=`STENCIL_ATTACHMENT`,e[e.DEPTH_STENCIL_ATTACHMENT=33306]=`DEPTH_STENCIL_ATTACHMENT`,e[e.NONE=0]=`NONE`,e[e.FRAMEBUFFER_COMPLETE=36053]=`FRAMEBUFFER_COMPLETE`,e[e.FRAMEBUFFER_INCOMPLETE_ATTACHMENT=36054]=`FRAMEBUFFER_INCOMPLETE_ATTACHMENT`,e[e.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT=36055]=`FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT`,e[e.FRAMEBUFFER_INCOMPLETE_DIMENSIONS=36057]=`FRAMEBUFFER_INCOMPLETE_DIMENSIONS`,e[e.FRAMEBUFFER_UNSUPPORTED=36061]=`FRAMEBUFFER_UNSUPPORTED`,e[e.FRAMEBUFFER_BINDING=36006]=`FRAMEBUFFER_BINDING`,e[e.RENDERBUFFER_BINDING=36007]=`RENDERBUFFER_BINDING`,e[e.READ_FRAMEBUFFER=36008]=`READ_FRAMEBUFFER`,e[e.DRAW_FRAMEBUFFER=36009]=`DRAW_FRAMEBUFFER`,e[e.MAX_RENDERBUFFER_SIZE=34024]=`MAX_RENDERBUFFER_SIZE`,e[e.INVALID_FRAMEBUFFER_OPERATION=1286]=`INVALID_FRAMEBUFFER_OPERATION`,e[e.UNPACK_FLIP_Y_WEBGL=37440]=`UNPACK_FLIP_Y_WEBGL`,e[e.UNPACK_PREMULTIPLY_ALPHA_WEBGL=37441]=`UNPACK_PREMULTIPLY_ALPHA_WEBGL`,e[e.UNPACK_COLORSPACE_CONVERSION_WEBGL=37443]=`UNPACK_COLORSPACE_CONVERSION_WEBGL`,e[e.READ_BUFFER=3074]=`READ_BUFFER`,e[e.UNPACK_ROW_LENGTH=3314]=`UNPACK_ROW_LENGTH`,e[e.UNPACK_SKIP_ROWS=3315]=`UNPACK_SKIP_ROWS`,e[e.UNPACK_SKIP_PIXELS=3316]=`UNPACK_SKIP_PIXELS`,e[e.PACK_ROW_LENGTH=3330]=`PACK_ROW_LENGTH`,e[e.PACK_SKIP_ROWS=3331]=`PACK_SKIP_ROWS`,e[e.PACK_SKIP_PIXELS=3332]=`PACK_SKIP_PIXELS`,e[e.TEXTURE_BINDING_3D=32874]=`TEXTURE_BINDING_3D`,e[e.UNPACK_SKIP_IMAGES=32877]=`UNPACK_SKIP_IMAGES`,e[e.UNPACK_IMAGE_HEIGHT=32878]=`UNPACK_IMAGE_HEIGHT`,e[e.MAX_3D_TEXTURE_SIZE=32883]=`MAX_3D_TEXTURE_SIZE`,e[e.MAX_ELEMENTS_VERTICES=33e3]=`MAX_ELEMENTS_VERTICES`,e[e.MAX_ELEMENTS_INDICES=33001]=`MAX_ELEMENTS_INDICES`,e[e.MAX_TEXTURE_LOD_BIAS=34045]=`MAX_TEXTURE_LOD_BIAS`,e[e.MAX_FRAGMENT_UNIFORM_COMPONENTS=35657]=`MAX_FRAGMENT_UNIFORM_COMPONENTS`,e[e.MAX_VERTEX_UNIFORM_COMPONENTS=35658]=`MAX_VERTEX_UNIFORM_COMPONENTS`,e[e.MAX_ARRAY_TEXTURE_LAYERS=35071]=`MAX_ARRAY_TEXTURE_LAYERS`,e[e.MIN_PROGRAM_TEXEL_OFFSET=35076]=`MIN_PROGRAM_TEXEL_OFFSET`,e[e.MAX_PROGRAM_TEXEL_OFFSET=35077]=`MAX_PROGRAM_TEXEL_OFFSET`,e[e.MAX_VARYING_COMPONENTS=35659]=`MAX_VARYING_COMPONENTS`,e[e.FRAGMENT_SHADER_DERIVATIVE_HINT=35723]=`FRAGMENT_SHADER_DERIVATIVE_HINT`,e[e.RASTERIZER_DISCARD=35977]=`RASTERIZER_DISCARD`,e[e.VERTEX_ARRAY_BINDING=34229]=`VERTEX_ARRAY_BINDING`,e[e.MAX_VERTEX_OUTPUT_COMPONENTS=37154]=`MAX_VERTEX_OUTPUT_COMPONENTS`,e[e.MAX_FRAGMENT_INPUT_COMPONENTS=37157]=`MAX_FRAGMENT_INPUT_COMPONENTS`,e[e.MAX_SERVER_WAIT_TIMEOUT=37137]=`MAX_SERVER_WAIT_TIMEOUT`,e[e.MAX_ELEMENT_INDEX=36203]=`MAX_ELEMENT_INDEX`,e[e.RED=6403]=`RED`,e[e.RGB8=32849]=`RGB8`,e[e.RGBA8=32856]=`RGBA8`,e[e.RGB10_A2=32857]=`RGB10_A2`,e[e.TEXTURE_3D=32879]=`TEXTURE_3D`,e[e.TEXTURE_WRAP_R=32882]=`TEXTURE_WRAP_R`,e[e.TEXTURE_MIN_LOD=33082]=`TEXTURE_MIN_LOD`,e[e.TEXTURE_MAX_LOD=33083]=`TEXTURE_MAX_LOD`,e[e.TEXTURE_BASE_LEVEL=33084]=`TEXTURE_BASE_LEVEL`,e[e.TEXTURE_MAX_LEVEL=33085]=`TEXTURE_MAX_LEVEL`,e[e.TEXTURE_COMPARE_MODE=34892]=`TEXTURE_COMPARE_MODE`,e[e.TEXTURE_COMPARE_FUNC=34893]=`TEXTURE_COMPARE_FUNC`,e[e.SRGB=35904]=`SRGB`,e[e.SRGB8=35905]=`SRGB8`,e[e.SRGB8_ALPHA8=35907]=`SRGB8_ALPHA8`,e[e.COMPARE_REF_TO_TEXTURE=34894]=`COMPARE_REF_TO_TEXTURE`,e[e.RGBA32F=34836]=`RGBA32F`,e[e.RGB32F=34837]=`RGB32F`,e[e.RGBA16F=34842]=`RGBA16F`,e[e.RGB16F=34843]=`RGB16F`,e[e.TEXTURE_2D_ARRAY=35866]=`TEXTURE_2D_ARRAY`,e[e.TEXTURE_BINDING_2D_ARRAY=35869]=`TEXTURE_BINDING_2D_ARRAY`,e[e.R11F_G11F_B10F=35898]=`R11F_G11F_B10F`,e[e.RGB9_E5=35901]=`RGB9_E5`,e[e.RGBA32UI=36208]=`RGBA32UI`,e[e.RGB32UI=36209]=`RGB32UI`,e[e.RGBA16UI=36214]=`RGBA16UI`,e[e.RGB16UI=36215]=`RGB16UI`,e[e.RGBA8UI=36220]=`RGBA8UI`,e[e.RGB8UI=36221]=`RGB8UI`,e[e.RGBA32I=36226]=`RGBA32I`,e[e.RGB32I=36227]=`RGB32I`,e[e.RGBA16I=36232]=`RGBA16I`,e[e.RGB16I=36233]=`RGB16I`,e[e.RGBA8I=36238]=`RGBA8I`,e[e.RGB8I=36239]=`RGB8I`,e[e.RED_INTEGER=36244]=`RED_INTEGER`,e[e.RGB_INTEGER=36248]=`RGB_INTEGER`,e[e.RGBA_INTEGER=36249]=`RGBA_INTEGER`,e[e.R8=33321]=`R8`,e[e.RG8=33323]=`RG8`,e[e.R16F=33325]=`R16F`,e[e.R32F=33326]=`R32F`,e[e.RG16F=33327]=`RG16F`,e[e.RG32F=33328]=`RG32F`,e[e.R8I=33329]=`R8I`,e[e.R8UI=33330]=`R8UI`,e[e.R16I=33331]=`R16I`,e[e.R16UI=33332]=`R16UI`,e[e.R32I=33333]=`R32I`,e[e.R32UI=33334]=`R32UI`,e[e.RG8I=33335]=`RG8I`,e[e.RG8UI=33336]=`RG8UI`,e[e.RG16I=33337]=`RG16I`,e[e.RG16UI=33338]=`RG16UI`,e[e.RG32I=33339]=`RG32I`,e[e.RG32UI=33340]=`RG32UI`,e[e.R8_SNORM=36756]=`R8_SNORM`,e[e.RG8_SNORM=36757]=`RG8_SNORM`,e[e.RGB8_SNORM=36758]=`RGB8_SNORM`,e[e.RGBA8_SNORM=36759]=`RGBA8_SNORM`,e[e.RGB10_A2UI=36975]=`RGB10_A2UI`,e[e.TEXTURE_IMMUTABLE_FORMAT=37167]=`TEXTURE_IMMUTABLE_FORMAT`,e[e.TEXTURE_IMMUTABLE_LEVELS=33503]=`TEXTURE_IMMUTABLE_LEVELS`,e[e.UNSIGNED_INT_2_10_10_10_REV=33640]=`UNSIGNED_INT_2_10_10_10_REV`,e[e.UNSIGNED_INT_10F_11F_11F_REV=35899]=`UNSIGNED_INT_10F_11F_11F_REV`,e[e.UNSIGNED_INT_5_9_9_9_REV=35902]=`UNSIGNED_INT_5_9_9_9_REV`,e[e.FLOAT_32_UNSIGNED_INT_24_8_REV=36269]=`FLOAT_32_UNSIGNED_INT_24_8_REV`,e[e.UNSIGNED_INT_24_8=34042]=`UNSIGNED_INT_24_8`,e[e.HALF_FLOAT=5131]=`HALF_FLOAT`,e[e.RG=33319]=`RG`,e[e.RG_INTEGER=33320]=`RG_INTEGER`,e[e.INT_2_10_10_10_REV=36255]=`INT_2_10_10_10_REV`,e[e.CURRENT_QUERY=34917]=`CURRENT_QUERY`,e[e.QUERY_RESULT=34918]=`QUERY_RESULT`,e[e.QUERY_RESULT_AVAILABLE=34919]=`QUERY_RESULT_AVAILABLE`,e[e.ANY_SAMPLES_PASSED=35887]=`ANY_SAMPLES_PASSED`,e[e.ANY_SAMPLES_PASSED_CONSERVATIVE=36202]=`ANY_SAMPLES_PASSED_CONSERVATIVE`,e[e.MAX_DRAW_BUFFERS=34852]=`MAX_DRAW_BUFFERS`,e[e.DRAW_BUFFER0=34853]=`DRAW_BUFFER0`,e[e.DRAW_BUFFER1=34854]=`DRAW_BUFFER1`,e[e.DRAW_BUFFER2=34855]=`DRAW_BUFFER2`,e[e.DRAW_BUFFER3=34856]=`DRAW_BUFFER3`,e[e.DRAW_BUFFER4=34857]=`DRAW_BUFFER4`,e[e.DRAW_BUFFER5=34858]=`DRAW_BUFFER5`,e[e.DRAW_BUFFER6=34859]=`DRAW_BUFFER6`,e[e.DRAW_BUFFER7=34860]=`DRAW_BUFFER7`,e[e.DRAW_BUFFER8=34861]=`DRAW_BUFFER8`,e[e.DRAW_BUFFER9=34862]=`DRAW_BUFFER9`,e[e.DRAW_BUFFER10=34863]=`DRAW_BUFFER10`,e[e.DRAW_BUFFER11=34864]=`DRAW_BUFFER11`,e[e.DRAW_BUFFER12=34865]=`DRAW_BUFFER12`,e[e.DRAW_BUFFER13=34866]=`DRAW_BUFFER13`,e[e.DRAW_BUFFER14=34867]=`DRAW_BUFFER14`,e[e.DRAW_BUFFER15=34868]=`DRAW_BUFFER15`,e[e.MAX_COLOR_ATTACHMENTS=36063]=`MAX_COLOR_ATTACHMENTS`,e[e.COLOR_ATTACHMENT1=36065]=`COLOR_ATTACHMENT1`,e[e.COLOR_ATTACHMENT2=36066]=`COLOR_ATTACHMENT2`,e[e.COLOR_ATTACHMENT3=36067]=`COLOR_ATTACHMENT3`,e[e.COLOR_ATTACHMENT4=36068]=`COLOR_ATTACHMENT4`,e[e.COLOR_ATTACHMENT5=36069]=`COLOR_ATTACHMENT5`,e[e.COLOR_ATTACHMENT6=36070]=`COLOR_ATTACHMENT6`,e[e.COLOR_ATTACHMENT7=36071]=`COLOR_ATTACHMENT7`,e[e.COLOR_ATTACHMENT8=36072]=`COLOR_ATTACHMENT8`,e[e.COLOR_ATTACHMENT9=36073]=`COLOR_ATTACHMENT9`,e[e.COLOR_ATTACHMENT10=36074]=`COLOR_ATTACHMENT10`,e[e.COLOR_ATTACHMENT11=36075]=`COLOR_ATTACHMENT11`,e[e.COLOR_ATTACHMENT12=36076]=`COLOR_ATTACHMENT12`,e[e.COLOR_ATTACHMENT13=36077]=`COLOR_ATTACHMENT13`,e[e.COLOR_ATTACHMENT14=36078]=`COLOR_ATTACHMENT14`,e[e.COLOR_ATTACHMENT15=36079]=`COLOR_ATTACHMENT15`,e[e.SAMPLER_3D=35679]=`SAMPLER_3D`,e[e.SAMPLER_2D_SHADOW=35682]=`SAMPLER_2D_SHADOW`,e[e.SAMPLER_2D_ARRAY=36289]=`SAMPLER_2D_ARRAY`,e[e.SAMPLER_2D_ARRAY_SHADOW=36292]=`SAMPLER_2D_ARRAY_SHADOW`,e[e.SAMPLER_CUBE_SHADOW=36293]=`SAMPLER_CUBE_SHADOW`,e[e.INT_SAMPLER_2D=36298]=`INT_SAMPLER_2D`,e[e.INT_SAMPLER_3D=36299]=`INT_SAMPLER_3D`,e[e.INT_SAMPLER_CUBE=36300]=`INT_SAMPLER_CUBE`,e[e.INT_SAMPLER_2D_ARRAY=36303]=`INT_SAMPLER_2D_ARRAY`,e[e.UNSIGNED_INT_SAMPLER_2D=36306]=`UNSIGNED_INT_SAMPLER_2D`,e[e.UNSIGNED_INT_SAMPLER_3D=36307]=`UNSIGNED_INT_SAMPLER_3D`,e[e.UNSIGNED_INT_SAMPLER_CUBE=36308]=`UNSIGNED_INT_SAMPLER_CUBE`,e[e.UNSIGNED_INT_SAMPLER_2D_ARRAY=36311]=`UNSIGNED_INT_SAMPLER_2D_ARRAY`,e[e.MAX_SAMPLES=36183]=`MAX_SAMPLES`,e[e.SAMPLER_BINDING=35097]=`SAMPLER_BINDING`,e[e.PIXEL_PACK_BUFFER=35051]=`PIXEL_PACK_BUFFER`,e[e.PIXEL_UNPACK_BUFFER=35052]=`PIXEL_UNPACK_BUFFER`,e[e.PIXEL_PACK_BUFFER_BINDING=35053]=`PIXEL_PACK_BUFFER_BINDING`,e[e.PIXEL_UNPACK_BUFFER_BINDING=35055]=`PIXEL_UNPACK_BUFFER_BINDING`,e[e.COPY_READ_BUFFER=36662]=`COPY_READ_BUFFER`,e[e.COPY_WRITE_BUFFER=36663]=`COPY_WRITE_BUFFER`,e[e.COPY_READ_BUFFER_BINDING=36662]=`COPY_READ_BUFFER_BINDING`,e[e.COPY_WRITE_BUFFER_BINDING=36663]=`COPY_WRITE_BUFFER_BINDING`,e[e.FLOAT_MAT2x3=35685]=`FLOAT_MAT2x3`,e[e.FLOAT_MAT2x4=35686]=`FLOAT_MAT2x4`,e[e.FLOAT_MAT3x2=35687]=`FLOAT_MAT3x2`,e[e.FLOAT_MAT3x4=35688]=`FLOAT_MAT3x4`,e[e.FLOAT_MAT4x2=35689]=`FLOAT_MAT4x2`,e[e.FLOAT_MAT4x3=35690]=`FLOAT_MAT4x3`,e[e.UNSIGNED_INT_VEC2=36294]=`UNSIGNED_INT_VEC2`,e[e.UNSIGNED_INT_VEC3=36295]=`UNSIGNED_INT_VEC3`,e[e.UNSIGNED_INT_VEC4=36296]=`UNSIGNED_INT_VEC4`,e[e.UNSIGNED_NORMALIZED=35863]=`UNSIGNED_NORMALIZED`,e[e.SIGNED_NORMALIZED=36764]=`SIGNED_NORMALIZED`,e[e.VERTEX_ATTRIB_ARRAY_INTEGER=35069]=`VERTEX_ATTRIB_ARRAY_INTEGER`,e[e.VERTEX_ATTRIB_ARRAY_DIVISOR=35070]=`VERTEX_ATTRIB_ARRAY_DIVISOR`,e[e.TRANSFORM_FEEDBACK_BUFFER_MODE=35967]=`TRANSFORM_FEEDBACK_BUFFER_MODE`,e[e.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS=35968]=`MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS`,e[e.TRANSFORM_FEEDBACK_VARYINGS=35971]=`TRANSFORM_FEEDBACK_VARYINGS`,e[e.TRANSFORM_FEEDBACK_BUFFER_START=35972]=`TRANSFORM_FEEDBACK_BUFFER_START`,e[e.TRANSFORM_FEEDBACK_BUFFER_SIZE=35973]=`TRANSFORM_FEEDBACK_BUFFER_SIZE`,e[e.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN=35976]=`TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN`,e[e.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS=35978]=`MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS`,e[e.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS=35979]=`MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS`,e[e.INTERLEAVED_ATTRIBS=35980]=`INTERLEAVED_ATTRIBS`,e[e.SEPARATE_ATTRIBS=35981]=`SEPARATE_ATTRIBS`,e[e.TRANSFORM_FEEDBACK_BUFFER=35982]=`TRANSFORM_FEEDBACK_BUFFER`,e[e.TRANSFORM_FEEDBACK_BUFFER_BINDING=35983]=`TRANSFORM_FEEDBACK_BUFFER_BINDING`,e[e.TRANSFORM_FEEDBACK=36386]=`TRANSFORM_FEEDBACK`,e[e.TRANSFORM_FEEDBACK_PAUSED=36387]=`TRANSFORM_FEEDBACK_PAUSED`,e[e.TRANSFORM_FEEDBACK_ACTIVE=36388]=`TRANSFORM_FEEDBACK_ACTIVE`,e[e.TRANSFORM_FEEDBACK_BINDING=36389]=`TRANSFORM_FEEDBACK_BINDING`,e[e.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING=33296]=`FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING`,e[e.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE=33297]=`FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE`,e[e.FRAMEBUFFER_ATTACHMENT_RED_SIZE=33298]=`FRAMEBUFFER_ATTACHMENT_RED_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE=33299]=`FRAMEBUFFER_ATTACHMENT_GREEN_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE=33300]=`FRAMEBUFFER_ATTACHMENT_BLUE_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE=33301]=`FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE=33302]=`FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE`,e[e.FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE=33303]=`FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE`,e[e.FRAMEBUFFER_DEFAULT=33304]=`FRAMEBUFFER_DEFAULT`,e[e.DEPTH24_STENCIL8=35056]=`DEPTH24_STENCIL8`,e[e.DRAW_FRAMEBUFFER_BINDING=36006]=`DRAW_FRAMEBUFFER_BINDING`,e[e.READ_FRAMEBUFFER_BINDING=36010]=`READ_FRAMEBUFFER_BINDING`,e[e.RENDERBUFFER_SAMPLES=36011]=`RENDERBUFFER_SAMPLES`,e[e.FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER=36052]=`FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER`,e[e.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE=36182]=`FRAMEBUFFER_INCOMPLETE_MULTISAMPLE`,e[e.UNIFORM_BUFFER=35345]=`UNIFORM_BUFFER`,e[e.UNIFORM_BUFFER_BINDING=35368]=`UNIFORM_BUFFER_BINDING`,e[e.UNIFORM_BUFFER_START=35369]=`UNIFORM_BUFFER_START`,e[e.UNIFORM_BUFFER_SIZE=35370]=`UNIFORM_BUFFER_SIZE`,e[e.MAX_VERTEX_UNIFORM_BLOCKS=35371]=`MAX_VERTEX_UNIFORM_BLOCKS`,e[e.MAX_FRAGMENT_UNIFORM_BLOCKS=35373]=`MAX_FRAGMENT_UNIFORM_BLOCKS`,e[e.MAX_COMBINED_UNIFORM_BLOCKS=35374]=`MAX_COMBINED_UNIFORM_BLOCKS`,e[e.MAX_UNIFORM_BUFFER_BINDINGS=35375]=`MAX_UNIFORM_BUFFER_BINDINGS`,e[e.MAX_UNIFORM_BLOCK_SIZE=35376]=`MAX_UNIFORM_BLOCK_SIZE`,e[e.MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS=35377]=`MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS`,e[e.MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS=35379]=`MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS`,e[e.UNIFORM_BUFFER_OFFSET_ALIGNMENT=35380]=`UNIFORM_BUFFER_OFFSET_ALIGNMENT`,e[e.ACTIVE_UNIFORM_BLOCKS=35382]=`ACTIVE_UNIFORM_BLOCKS`,e[e.UNIFORM_TYPE=35383]=`UNIFORM_TYPE`,e[e.UNIFORM_SIZE=35384]=`UNIFORM_SIZE`,e[e.UNIFORM_BLOCK_INDEX=35386]=`UNIFORM_BLOCK_INDEX`,e[e.UNIFORM_OFFSET=35387]=`UNIFORM_OFFSET`,e[e.UNIFORM_ARRAY_STRIDE=35388]=`UNIFORM_ARRAY_STRIDE`,e[e.UNIFORM_MATRIX_STRIDE=35389]=`UNIFORM_MATRIX_STRIDE`,e[e.UNIFORM_IS_ROW_MAJOR=35390]=`UNIFORM_IS_ROW_MAJOR`,e[e.UNIFORM_BLOCK_BINDING=35391]=`UNIFORM_BLOCK_BINDING`,e[e.UNIFORM_BLOCK_DATA_SIZE=35392]=`UNIFORM_BLOCK_DATA_SIZE`,e[e.UNIFORM_BLOCK_ACTIVE_UNIFORMS=35394]=`UNIFORM_BLOCK_ACTIVE_UNIFORMS`,e[e.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES=35395]=`UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES`,e[e.UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER=35396]=`UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER`,e[e.UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER=35398]=`UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER`,e[e.OBJECT_TYPE=37138]=`OBJECT_TYPE`,e[e.SYNC_CONDITION=37139]=`SYNC_CONDITION`,e[e.SYNC_STATUS=37140]=`SYNC_STATUS`,e[e.SYNC_FLAGS=37141]=`SYNC_FLAGS`,e[e.SYNC_FENCE=37142]=`SYNC_FENCE`,e[e.SYNC_GPU_COMMANDS_COMPLETE=37143]=`SYNC_GPU_COMMANDS_COMPLETE`,e[e.UNSIGNALED=37144]=`UNSIGNALED`,e[e.SIGNALED=37145]=`SIGNALED`,e[e.ALREADY_SIGNALED=37146]=`ALREADY_SIGNALED`,e[e.TIMEOUT_EXPIRED=37147]=`TIMEOUT_EXPIRED`,e[e.CONDITION_SATISFIED=37148]=`CONDITION_SATISFIED`,e[e.WAIT_FAILED=37149]=`WAIT_FAILED`,e[e.SYNC_FLUSH_COMMANDS_BIT=1]=`SYNC_FLUSH_COMMANDS_BIT`,e[e.COLOR=6144]=`COLOR`,e[e.DEPTH=6145]=`DEPTH`,e[e.STENCIL=6146]=`STENCIL`,e[e.MIN=32775]=`MIN`,e[e.MAX=32776]=`MAX`,e[e.DEPTH_COMPONENT24=33190]=`DEPTH_COMPONENT24`,e[e.STREAM_READ=35041]=`STREAM_READ`,e[e.STREAM_COPY=35042]=`STREAM_COPY`,e[e.STATIC_READ=35045]=`STATIC_READ`,e[e.STATIC_COPY=35046]=`STATIC_COPY`,e[e.DYNAMIC_READ=35049]=`DYNAMIC_READ`,e[e.DYNAMIC_COPY=35050]=`DYNAMIC_COPY`,e[e.DEPTH_COMPONENT32F=36012]=`DEPTH_COMPONENT32F`,e[e.DEPTH32F_STENCIL8=36013]=`DEPTH32F_STENCIL8`,e[e.INVALID_INDEX=4294967295]=`INVALID_INDEX`,e[e.TIMEOUT_IGNORED=-1]=`TIMEOUT_IGNORED`,e[e.MAX_CLIENT_WAIT_TIMEOUT_WEBGL=37447]=`MAX_CLIENT_WAIT_TIMEOUT_WEBGL`,e[e.UNMASKED_VENDOR_WEBGL=37445]=`UNMASKED_VENDOR_WEBGL`,e[e.UNMASKED_RENDERER_WEBGL=37446]=`UNMASKED_RENDERER_WEBGL`,e[e.MAX_TEXTURE_MAX_ANISOTROPY_EXT=34047]=`MAX_TEXTURE_MAX_ANISOTROPY_EXT`,e[e.TEXTURE_MAX_ANISOTROPY_EXT=34046]=`TEXTURE_MAX_ANISOTROPY_EXT`,e[e.R16_EXT=33322]=`R16_EXT`,e[e.RG16_EXT=33324]=`RG16_EXT`,e[e.RGB16_EXT=32852]=`RGB16_EXT`,e[e.RGBA16_EXT=32859]=`RGBA16_EXT`,e[e.R16_SNORM_EXT=36760]=`R16_SNORM_EXT`,e[e.RG16_SNORM_EXT=36761]=`RG16_SNORM_EXT`,e[e.RGB16_SNORM_EXT=36762]=`RGB16_SNORM_EXT`,e[e.RGBA16_SNORM_EXT=36763]=`RGBA16_SNORM_EXT`,e[e.COMPRESSED_RGB_S3TC_DXT1_EXT=33776]=`COMPRESSED_RGB_S3TC_DXT1_EXT`,e[e.COMPRESSED_RGBA_S3TC_DXT1_EXT=33777]=`COMPRESSED_RGBA_S3TC_DXT1_EXT`,e[e.COMPRESSED_RGBA_S3TC_DXT3_EXT=33778]=`COMPRESSED_RGBA_S3TC_DXT3_EXT`,e[e.COMPRESSED_RGBA_S3TC_DXT5_EXT=33779]=`COMPRESSED_RGBA_S3TC_DXT5_EXT`,e[e.COMPRESSED_SRGB_S3TC_DXT1_EXT=35916]=`COMPRESSED_SRGB_S3TC_DXT1_EXT`,e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT=35917]=`COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT`,e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT=35918]=`COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT`,e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT=35919]=`COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT`,e[e.COMPRESSED_RED_RGTC1_EXT=36283]=`COMPRESSED_RED_RGTC1_EXT`,e[e.COMPRESSED_SIGNED_RED_RGTC1_EXT=36284]=`COMPRESSED_SIGNED_RED_RGTC1_EXT`,e[e.COMPRESSED_RED_GREEN_RGTC2_EXT=36285]=`COMPRESSED_RED_GREEN_RGTC2_EXT`,e[e.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT=36286]=`COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT`,e[e.COMPRESSED_RGBA_BPTC_UNORM_EXT=36492]=`COMPRESSED_RGBA_BPTC_UNORM_EXT`,e[e.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT=36493]=`COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT`,e[e.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT=36494]=`COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT`,e[e.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT=36495]=`COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT`,e[e.COMPRESSED_R11_EAC=37488]=`COMPRESSED_R11_EAC`,e[e.COMPRESSED_SIGNED_R11_EAC=37489]=`COMPRESSED_SIGNED_R11_EAC`,e[e.COMPRESSED_RG11_EAC=37490]=`COMPRESSED_RG11_EAC`,e[e.COMPRESSED_SIGNED_RG11_EAC=37491]=`COMPRESSED_SIGNED_RG11_EAC`,e[e.COMPRESSED_RGB8_ETC2=37492]=`COMPRESSED_RGB8_ETC2`,e[e.COMPRESSED_RGBA8_ETC2_EAC=37493]=`COMPRESSED_RGBA8_ETC2_EAC`,e[e.COMPRESSED_SRGB8_ETC2=37494]=`COMPRESSED_SRGB8_ETC2`,e[e.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC=37495]=`COMPRESSED_SRGB8_ALPHA8_ETC2_EAC`,e[e.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2=37496]=`COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2`,e[e.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2=37497]=`COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2`,e[e.COMPRESSED_RGB_PVRTC_4BPPV1_IMG=35840]=`COMPRESSED_RGB_PVRTC_4BPPV1_IMG`,e[e.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG=35842]=`COMPRESSED_RGBA_PVRTC_4BPPV1_IMG`,e[e.COMPRESSED_RGB_PVRTC_2BPPV1_IMG=35841]=`COMPRESSED_RGB_PVRTC_2BPPV1_IMG`,e[e.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG=35843]=`COMPRESSED_RGBA_PVRTC_2BPPV1_IMG`,e[e.COMPRESSED_RGB_ETC1_WEBGL=36196]=`COMPRESSED_RGB_ETC1_WEBGL`,e[e.COMPRESSED_RGB_ATC_WEBGL=35986]=`COMPRESSED_RGB_ATC_WEBGL`,e[e.COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL=35986]=`COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL`,e[e.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL=34798]=`COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL`,e[e.COMPRESSED_RGBA_ASTC_4x4_KHR=37808]=`COMPRESSED_RGBA_ASTC_4x4_KHR`,e[e.COMPRESSED_RGBA_ASTC_5x4_KHR=37809]=`COMPRESSED_RGBA_ASTC_5x4_KHR`,e[e.COMPRESSED_RGBA_ASTC_5x5_KHR=37810]=`COMPRESSED_RGBA_ASTC_5x5_KHR`,e[e.COMPRESSED_RGBA_ASTC_6x5_KHR=37811]=`COMPRESSED_RGBA_ASTC_6x5_KHR`,e[e.COMPRESSED_RGBA_ASTC_6x6_KHR=37812]=`COMPRESSED_RGBA_ASTC_6x6_KHR`,e[e.COMPRESSED_RGBA_ASTC_8x5_KHR=37813]=`COMPRESSED_RGBA_ASTC_8x5_KHR`,e[e.COMPRESSED_RGBA_ASTC_8x6_KHR=37814]=`COMPRESSED_RGBA_ASTC_8x6_KHR`,e[e.COMPRESSED_RGBA_ASTC_8x8_KHR=37815]=`COMPRESSED_RGBA_ASTC_8x8_KHR`,e[e.COMPRESSED_RGBA_ASTC_10x5_KHR=37816]=`COMPRESSED_RGBA_ASTC_10x5_KHR`,e[e.COMPRESSED_RGBA_ASTC_10x6_KHR=37817]=`COMPRESSED_RGBA_ASTC_10x6_KHR`,e[e.COMPRESSED_RGBA_ASTC_10x8_KHR=37818]=`COMPRESSED_RGBA_ASTC_10x8_KHR`,e[e.COMPRESSED_RGBA_ASTC_10x10_KHR=37819]=`COMPRESSED_RGBA_ASTC_10x10_KHR`,e[e.COMPRESSED_RGBA_ASTC_12x10_KHR=37820]=`COMPRESSED_RGBA_ASTC_12x10_KHR`,e[e.COMPRESSED_RGBA_ASTC_12x12_KHR=37821]=`COMPRESSED_RGBA_ASTC_12x12_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR=37840]=`COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR=37841]=`COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR=37842]=`COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR=37843]=`COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR=37844]=`COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR=37845]=`COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR=37846]=`COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR=37847]=`COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR=37848]=`COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR=37849]=`COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR=37850]=`COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR=37851]=`COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR=37852]=`COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR`,e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR=37853]=`COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR`,e[e.QUERY_COUNTER_BITS_EXT=34916]=`QUERY_COUNTER_BITS_EXT`,e[e.CURRENT_QUERY_EXT=34917]=`CURRENT_QUERY_EXT`,e[e.QUERY_RESULT_EXT=34918]=`QUERY_RESULT_EXT`,e[e.QUERY_RESULT_AVAILABLE_EXT=34919]=`QUERY_RESULT_AVAILABLE_EXT`,e[e.TIME_ELAPSED_EXT=35007]=`TIME_ELAPSED_EXT`,e[e.TIMESTAMP_EXT=36392]=`TIMESTAMP_EXT`,e[e.GPU_DISJOINT_EXT=36795]=`GPU_DISJOINT_EXT`,e[e.COMPLETION_STATUS_KHR=37297]=`COMPLETION_STATUS_KHR`,e[e.DEPTH_CLAMP_EXT=34383]=`DEPTH_CLAMP_EXT`,e[e.FIRST_VERTEX_CONVENTION_WEBGL=36429]=`FIRST_VERTEX_CONVENTION_WEBGL`,e[e.LAST_VERTEX_CONVENTION_WEBGL=36430]=`LAST_VERTEX_CONVENTION_WEBGL`,e[e.PROVOKING_VERTEX_WEBL=36431]=`PROVOKING_VERTEX_WEBL`,e[e.POLYGON_MODE_WEBGL=2880]=`POLYGON_MODE_WEBGL`,e[e.POLYGON_OFFSET_LINE_WEBGL=10754]=`POLYGON_OFFSET_LINE_WEBGL`,e[e.LINE_WEBGL=6913]=`LINE_WEBGL`,e[e.FILL_WEBGL=6914]=`FILL_WEBGL`,e[e.MAX_CLIP_DISTANCES_WEBGL=3378]=`MAX_CLIP_DISTANCES_WEBGL`,e[e.MAX_CULL_DISTANCES_WEBGL=33529]=`MAX_CULL_DISTANCES_WEBGL`,e[e.MAX_COMBINED_CLIP_AND_CULL_DISTANCES_WEBGL=33530]=`MAX_COMBINED_CLIP_AND_CULL_DISTANCES_WEBGL`,e[e.CLIP_DISTANCE0_WEBGL=12288]=`CLIP_DISTANCE0_WEBGL`,e[e.CLIP_DISTANCE1_WEBGL=12289]=`CLIP_DISTANCE1_WEBGL`,e[e.CLIP_DISTANCE2_WEBGL=12290]=`CLIP_DISTANCE2_WEBGL`,e[e.CLIP_DISTANCE3_WEBGL=12291]=`CLIP_DISTANCE3_WEBGL`,e[e.CLIP_DISTANCE4_WEBGL=12292]=`CLIP_DISTANCE4_WEBGL`,e[e.CLIP_DISTANCE5_WEBGL=12293]=`CLIP_DISTANCE5_WEBGL`,e[e.CLIP_DISTANCE6_WEBGL=12294]=`CLIP_DISTANCE6_WEBGL`,e[e.CLIP_DISTANCE7_WEBGL=12295]=`CLIP_DISTANCE7_WEBGL`,e[e.POLYGON_OFFSET_CLAMP_EXT=36379]=`POLYGON_OFFSET_CLAMP_EXT`,e[e.LOWER_LEFT_EXT=36001]=`LOWER_LEFT_EXT`,e[e.UPPER_LEFT_EXT=36002]=`UPPER_LEFT_EXT`,e[e.NEGATIVE_ONE_TO_ONE_EXT=37726]=`NEGATIVE_ONE_TO_ONE_EXT`,e[e.ZERO_TO_ONE_EXT=37727]=`ZERO_TO_ONE_EXT`,e[e.CLIP_ORIGIN_EXT=37724]=`CLIP_ORIGIN_EXT`,e[e.CLIP_DEPTH_MODE_EXT=37725]=`CLIP_DEPTH_MODE_EXT`,e[e.SRC1_COLOR_WEBGL=35065]=`SRC1_COLOR_WEBGL`,e[e.SRC1_ALPHA_WEBGL=34185]=`SRC1_ALPHA_WEBGL`,e[e.ONE_MINUS_SRC1_COLOR_WEBGL=35066]=`ONE_MINUS_SRC1_COLOR_WEBGL`,e[e.ONE_MINUS_SRC1_ALPHA_WEBGL=35067]=`ONE_MINUS_SRC1_ALPHA_WEBGL`,e[e.MAX_DUAL_SOURCE_DRAW_BUFFERS_WEBGL=35068]=`MAX_DUAL_SOURCE_DRAW_BUFFERS_WEBGL`,e[e.MIRROR_CLAMP_TO_EDGE_EXT=34627]=`MIRROR_CLAMP_TO_EDGE_EXT`})(m_||={});async function h_(e,t){let n=document.getElementsByTagName(`head`)[0];if(!n)throw Error(`loadScript`);let r=document.createElement(`script`);return r.setAttribute(`type`,`text/javascript`),r.setAttribute(`src`,e),t&&(r.id=t),new Promise((t,i)=>{r.onload=t,r.onerror=t=>i(Error(`Unable to load script '${e}': ${t}`)),n.appendChild(r)})}function g_(e){let t=e.luma||{_polyfilled:!1,extensions:{},softwareRenderer:!1};return t._polyfilled??=!1,t.extensions||={},e.luma=t,t}var __=1,v_=null,y_=!1,b_={debugSpectorJS:M.get(`debug-spectorjs`),debugSpectorJSUrl:`https://cdn.jsdelivr.net/npm/spectorjs@0.9.30/dist/spector.bundle.js`,gl:void 0};async function x_(e){if(!globalThis.SPECTOR)try{await h_(e.debugSpectorJSUrl||b_.debugSpectorJSUrl)}catch(e){M.warn(String(e))}}function S_(e){if(e={...b_,...e},!e.debugSpectorJS)return null;if(!v_&&globalThis.SPECTOR&&!globalThis.luma?.spector){M.probe(__,"SPECTOR found and initialized. Start with `luma.spector.displayUI()`")();let{Spector:e}=globalThis.SPECTOR;v_=new e,globalThis.luma&&(globalThis.luma.spector=v_)}if(!v_)return null;if(y_||(y_=!0,v_.spyCanvases(),v_?.onCaptureStarted.add(e=>M.info(`Spector capture started:`,e)()),v_?.onCapture.add(e=>{M.info(`Spector capture complete:`,e)(),v_?.getResultUI(),v_?.resultView.display(),v_?.resultView.addCapture(e)})),e.gl){let t=e.gl,n=g_(t),r=n.device;v_?.startCapture(e.gl,500),n.device=r,new Promise(e=>setTimeout(e,2e3)).then(e=>{M.info(`Spector capture stopped after 2 seconds`)(),v_?.stopCapture()})}return v_}var C_=`https://unpkg.com/webgl-debug@2.0.1/index.js`;function w_(e){return e.luma=e.luma||{},e.luma}async function T_(){a()&&!globalThis.WebGLDebugUtils&&(globalThis.global=globalThis.global||globalThis,globalThis.global.module={},await h_(C_))}function E_(e,t={}){return t.debugWebGL||t.traceWebGL?O_(e,t):D_(e)}function D_(e){let t=w_(e);return t.realContext?t.realContext:e}function O_(e,t){if(!globalThis.WebGLDebugUtils)return M.warn(`webgl-debug not loaded`)(),e;let n=w_(e);if(n.debugContext)return n.debugContext;globalThis.WebGLDebugUtils.init({...m_,...e});let r=globalThis.WebGLDebugUtils.makeDebugContext(e,A_.bind(null,t),j_.bind(null,t));for(let e in m_)!(e in r)&&typeof m_[e]==`number`&&(r[e]=m_[e]);class i{}Object.setPrototypeOf(r,Object.getPrototypeOf(e)),Object.setPrototypeOf(i,r);let a=Object.create(i);return n.realContext=e,n.debugContext=a,a.luma=n,a.debug=!0,a}function k_(e,t){t=Array.from(t).map(e=>e===void 0?`undefined`:e);let n=globalThis.WebGLDebugUtils.glFunctionArgsToString(e,t);return n=`${n.slice(0,100)}${n.length>100?`...`:``}`,`gl.${e}(${n})`}function A_(e,t,n,r){r=Array.from(r).map(e=>e===void 0?`undefined`:e);let i=`${globalThis.WebGLDebugUtils.glEnumToString(t)} in gl.${n}(${globalThis.WebGLDebugUtils.glFunctionArgsToString(n,r)})`;throw M.error(`%cWebGL`,`color: white; background: red; padding: 2px 6px; border-radius: 3px;`,i)(),Error(i)}function j_(e,t,n){let r=``;e.traceWebGL&&M.level>=1&&(r=k_(t,n),M.info(1,`%cWebGL`,`color: white; background: blue; padding: 2px 6px; border-radius: 3px;`,r)());for(let e of n)e===void 0&&(r||=k_(t,n))}var M_={3042:!1,32773:new Float32Array([0,0,0,0]),32777:32774,34877:32774,32969:1,32968:0,32971:1,32970:0,3106:new Float32Array([0,0,0,0]),3107:[!0,!0,!0,!0],2884:!1,2885:1029,2929:!1,2931:1,2932:513,2928:new Float32Array([0,1]),2930:!0,3024:!0,35725:null,36006:null,36007:null,34229:null,34964:null,2886:2305,33170:4352,2849:1,32823:!1,32824:0,10752:0,32926:!1,32928:!1,32938:1,32939:!1,3089:!1,3088:new Int32Array([0,0,1024,1024]),2960:!1,2961:0,2968:4294967295,36005:4294967295,2962:519,2967:0,2963:4294967295,34816:519,36003:0,36004:4294967295,2964:7680,2965:7680,2966:7680,34817:7680,34818:7680,34819:7680,2978:[0,0,1024,1024],36389:null,36662:null,36663:null,35053:null,35055:null,35723:4352,36010:null,35977:!1,3333:4,3317:4,37440:!1,37441:!1,37443:37444,3330:0,3332:0,3331:0,3314:0,32878:0,3316:0,3315:0,32877:0},U=(e,t,n)=>t?e.enable(n):e.disable(n),N_=(e,t,n)=>e.hint(n,t),P_=(e,t,n)=>e.pixelStorei(n,t),F_=(e,t,n)=>{let r=n===36006?36009:36008;return e.bindFramebuffer(r,t)},I_=(e,t,n)=>{let r={34964:34962,36662:36662,36663:36663,35053:35051,35055:35052}[n];e.bindBuffer(r,t)};function L_(e){return Array.isArray(e)||ArrayBuffer.isView(e)&&!(e instanceof DataView)}var R_={3042:U,32773:(e,t)=>e.blendColor(...t),32777:`blendEquation`,34877:`blendEquation`,32969:`blendFunc`,32968:`blendFunc`,32971:`blendFunc`,32970:`blendFunc`,3106:(e,t)=>e.clearColor(...t),3107:(e,t)=>e.colorMask(...t),2884:U,2885:(e,t)=>e.cullFace(t),2929:U,2931:(e,t)=>e.clearDepth(t),2932:(e,t)=>e.depthFunc(t),2928:(e,t)=>e.depthRange(...t),2930:(e,t)=>e.depthMask(t),3024:U,35723:N_,35725:(e,t)=>e.useProgram(t),36007:(e,t)=>e.bindRenderbuffer(36161,t),36389:(e,t)=>e.bindTransformFeedback?.(36386,t),34229:(e,t)=>e.bindVertexArray(t),36006:F_,36010:F_,34964:I_,36662:I_,36663:I_,35053:I_,35055:I_,2886:(e,t)=>e.frontFace(t),33170:N_,2849:(e,t)=>e.lineWidth(t),32823:U,32824:`polygonOffset`,10752:`polygonOffset`,35977:U,32926:U,32928:U,32938:`sampleCoverage`,32939:`sampleCoverage`,3089:U,3088:(e,t)=>e.scissor(...t),2960:U,2961:(e,t)=>e.clearStencil(t),2968:(e,t)=>e.stencilMaskSeparate(1028,t),36005:(e,t)=>e.stencilMaskSeparate(1029,t),2962:`stencilFuncFront`,2967:`stencilFuncFront`,2963:`stencilFuncFront`,34816:`stencilFuncBack`,36003:`stencilFuncBack`,36004:`stencilFuncBack`,2964:`stencilOpFront`,2965:`stencilOpFront`,2966:`stencilOpFront`,34817:`stencilOpBack`,34818:`stencilOpBack`,34819:`stencilOpBack`,2978:(e,t)=>e.viewport(...t),34383:U,10754:U,12288:U,12289:U,12290:U,12291:U,12292:U,12293:U,12294:U,12295:U,3333:P_,3317:P_,37440:P_,37441:P_,37443:P_,3330:P_,3332:P_,3331:P_,3314:P_,32878:P_,3316:P_,3315:P_,32877:P_,framebuffer:(e,t)=>{let n=t&&`handle`in t?t.handle:t;return e.bindFramebuffer(36160,n)},blend:(e,t)=>t?e.enable(3042):e.disable(3042),blendColor:(e,t)=>e.blendColor(...t),blendEquation:(e,t)=>{let n=typeof t==`number`?[t,t]:t;e.blendEquationSeparate(...n)},blendFunc:(e,t)=>{let n=t?.length===2?[...t,...t]:t;e.blendFuncSeparate(...n)},clearColor:(e,t)=>e.clearColor(...t),clearDepth:(e,t)=>e.clearDepth(t),clearStencil:(e,t)=>e.clearStencil(t),colorMask:(e,t)=>e.colorMask(...t),cull:(e,t)=>t?e.enable(2884):e.disable(2884),cullFace:(e,t)=>e.cullFace(t),depthTest:(e,t)=>t?e.enable(2929):e.disable(2929),depthFunc:(e,t)=>e.depthFunc(t),depthMask:(e,t)=>e.depthMask(t),depthRange:(e,t)=>e.depthRange(...t),dither:(e,t)=>t?e.enable(3024):e.disable(3024),derivativeHint:(e,t)=>{e.hint(35723,t)},frontFace:(e,t)=>e.frontFace(t),mipmapHint:(e,t)=>e.hint(33170,t),lineWidth:(e,t)=>e.lineWidth(t),polygonOffsetFill:(e,t)=>t?e.enable(32823):e.disable(32823),polygonOffset:(e,t)=>e.polygonOffset(...t),sampleCoverage:(e,t)=>e.sampleCoverage(t[0],t[1]||!1),scissorTest:(e,t)=>t?e.enable(3089):e.disable(3089),scissor:(e,t)=>e.scissor(...t),stencilTest:(e,t)=>t?e.enable(2960):e.disable(2960),stencilMask:(e,t)=>{t=L_(t)?t:[t,t];let[n,r]=t;e.stencilMaskSeparate(1028,n),e.stencilMaskSeparate(1029,r)},stencilFunc:(e,t)=>{t=L_(t)&&t.length===3?[...t,...t]:t;let[n,r,i,a,o,s]=t;e.stencilFuncSeparate(1028,n,r,i),e.stencilFuncSeparate(1029,a,o,s)},stencilOp:(e,t)=>{t=L_(t)&&t.length===3?[...t,...t]:t;let[n,r,i,a,o,s]=t;e.stencilOpSeparate(1028,n,r,i),e.stencilOpSeparate(1029,a,o,s)},viewport:(e,t)=>e.viewport(...t)};function W(e,t,n){return t[e]===void 0?n[e]:t[e]}var z_={blendEquation:(e,t,n)=>e.blendEquationSeparate(W(32777,t,n),W(34877,t,n)),blendFunc:(e,t,n)=>e.blendFuncSeparate(W(32969,t,n),W(32968,t,n),W(32971,t,n),W(32970,t,n)),polygonOffset:(e,t,n)=>e.polygonOffset(W(32824,t,n),W(10752,t,n)),sampleCoverage:(e,t,n)=>e.sampleCoverage(W(32938,t,n),W(32939,t,n)),stencilFuncFront:(e,t,n)=>e.stencilFuncSeparate(1028,W(2962,t,n),W(2967,t,n),W(2963,t,n)),stencilFuncBack:(e,t,n)=>e.stencilFuncSeparate(1029,W(34816,t,n),W(36003,t,n),W(36004,t,n)),stencilOpFront:(e,t,n)=>e.stencilOpSeparate(1028,W(2964,t,n),W(2965,t,n),W(2966,t,n)),stencilOpBack:(e,t,n)=>e.stencilOpSeparate(1029,W(34817,t,n),W(34818,t,n),W(34819,t,n))},B_={enable:(e,t)=>e({[t]:!0}),disable:(e,t)=>e({[t]:!1}),pixelStorei:(e,t,n)=>e({[t]:n}),hint:(e,t,n)=>e({[t]:n}),useProgram:(e,t)=>e({35725:t}),bindRenderbuffer:(e,t,n)=>e({36007:n}),bindTransformFeedback:(e,t,n)=>e({36389:n}),bindVertexArray:(e,t)=>e({34229:t}),bindFramebuffer:(e,t,n)=>{switch(t){case 36160:return e({36006:n,36010:n});case 36009:return e({36006:n});case 36008:return e({36010:n});default:return null}},bindBuffer:(e,t,n)=>{let r={34962:[34964],36662:[36662],36663:[36663],35051:[35053],35052:[35055]}[t];return r?e({[r]:n}):{valueChanged:!0}},blendColor:(e,t,n,r,i)=>e({32773:new Float32Array([t,n,r,i])}),blendEquation:(e,t)=>e({32777:t,34877:t}),blendEquationSeparate:(e,t,n)=>e({32777:t,34877:n}),blendFunc:(e,t,n)=>e({32969:t,32968:n,32971:t,32970:n}),blendFuncSeparate:(e,t,n,r,i)=>e({32969:t,32968:n,32971:r,32970:i}),clearColor:(e,t,n,r,i)=>e({3106:new Float32Array([t,n,r,i])}),clearDepth:(e,t)=>e({2931:t}),clearStencil:(e,t)=>e({2961:t}),colorMask:(e,t,n,r,i)=>e({3107:[t,n,r,i]}),cullFace:(e,t)=>e({2885:t}),depthFunc:(e,t)=>e({2932:t}),depthRange:(e,t,n)=>e({2928:new Float32Array([t,n])}),depthMask:(e,t)=>e({2930:t}),frontFace:(e,t)=>e({2886:t}),lineWidth:(e,t)=>e({2849:t}),polygonOffset:(e,t,n)=>e({32824:t,10752:n}),sampleCoverage:(e,t,n)=>e({32938:t,32939:n}),scissor:(e,t,n,r,i)=>e({3088:new Int32Array([t,n,r,i])}),stencilMask:(e,t)=>e({2968:t,36005:t}),stencilMaskSeparate:(e,t,n)=>e({[t===1028?2968:36005]:n}),stencilFunc:(e,t,n,r)=>e({2962:t,2967:n,2963:r,34816:t,36003:n,36004:r}),stencilFuncSeparate:(e,t,n,r,i)=>e({[t===1028?2962:34816]:n,[t===1028?2967:36003]:r,[t===1028?2963:36004]:i}),stencilOp:(e,t,n,r)=>e({2964:t,2965:n,2966:r,34817:t,34818:n,34819:r}),stencilOpSeparate:(e,t,n,r,i)=>e({[t===1028?2964:34817]:n,[t===1028?2965:34818]:r,[t===1028?2966:34819]:i}),viewport:(e,t,n,r,i)=>e({2978:[t,n,r,i]})},V_=(e,t)=>e.isEnabled(t),H_={3042:V_,2884:V_,2929:V_,3024:V_,32823:V_,32926:V_,32928:V_,3089:V_,2960:V_,35977:V_},U_=new Set([34016,36388,36387,35983,35368,34965,35739,35738,3074,34853,34854,34855,34856,34857,34858,34859,34860,34861,34862,34863,34864,34865,34866,34867,34868,35097,32873,35869,32874,34068]);function W_(e,t){if(q_(t))return;let n={};for(let r in t){let i=Number(r),a=R_[r];a&&(typeof a==`string`?n[a]=!0:a(e,t[r],i))}let r=e.lumaState?.cache;if(r)for(let i in n){let n=z_[i];n(e,t,r)}}function G_(e,t=M_){if(typeof t==`number`){let n=t,r=H_[n];return r?r(e,n):e.getParameter(n)}let n=Array.isArray(t)?t:Object.keys(t),r={};for(let t of n){let n=H_[t];r[t]=n?n(e,Number(t)):e.getParameter(Number(t))}return r}function K_(e){W_(e,M_)}function q_(e){for(let t in e)return!1;return!0}function J_(e,t){if(e===t)return!0;if(Y_(e)&&Y_(t)&&e.length===t.length){for(let n=0;n<e.length;++n)if(e[n]!==t[n])return!1;return!0}return!1}function Y_(e){return Array.isArray(e)||ArrayBuffer.isView(e)}var X_=class{static get(e){return e.lumaState}gl;program=null;stateStack=[];enable=!0;cache=null;log;initialized=!1;constructor(e,t){this.gl=e,this.log=t?.log||(()=>{}),this._updateCache=this._updateCache.bind(this),Object.seal(this)}push(e={}){this.stateStack.push({})}pop(){let e=this.stateStack[this.stateStack.length-1];W_(this.gl,e),this.stateStack.pop()}trackState(e,t){if(this.cache=t?.copyState?G_(e):Object.assign({},M_),this.initialized)throw Error(`WebGLStateTracker`);this.initialized=!0,this.gl.lumaState=this,$_(e);for(let t in B_){let n=B_[t];Q_(e,t,n)}Z_(e,`getParameter`),Z_(e,`isEnabled`)}_updateCache(e){let t=!1,n,r=this.stateStack.length>0?this.stateStack[this.stateStack.length-1]:null;for(let i in e){let a=e[i],o=this.cache[i];J_(a,o)||(t=!0,n=o,r&&!(i in r)&&(r[i]=o),this.cache[i]=a)}return{valueChanged:t,oldValue:n}}};function Z_(e,t){let n=e[t].bind(e);e[t]=function(t){if(t===void 0||U_.has(t))return n(t);let r=X_.get(e);return t in r.cache||(r.cache[t]=n(t)),r.enable?r.cache[t]:n(t)},Object.defineProperty(e[t],"name",{value:`${t}-from-cache`,configurable:!1})}function Q_(e,t,n){if(!e[t])return;let r=e[t].bind(e);e[t]=function(...t){let{valueChanged:i,oldValue:a}=n(X_.get(e)._updateCache,...t);return i&&r(...t),a},Object.defineProperty(e[t],"name",{value:`${t}-to-cache`,configurable:!1})}function $_(e){let t=e.useProgram.bind(e);e.useProgram=function(n){let r=X_.get(e);r.program!==n&&(t(n),r.program=n)}}function ev(e,t,n){let r=``,i=e=>{let t=e.statusMessage;t&&(r||=t)};e.addEventListener(`webglcontextcreationerror`,i,!1);let a=n.failIfMajorPerformanceCaveat!==!0,o={preserveDrawingBuffer:!0,...n,failIfMajorPerformanceCaveat:!0},s=null;try{s||=e.getContext(`webgl2`,o),!s&&o.failIfMajorPerformanceCaveat&&(r||="Only software GPU is available. Set `failIfMajorPerformanceCaveat: false` to allow.");let n=!1;if(!s&&a&&(o.failIfMajorPerformanceCaveat=!1,s=e.getContext(`webgl2`,o),n=!0),s||(s=e.getContext(`webgl`,{}),s&&(s=null,r||=`Your browser only supports WebGL1`)),!s)throw r||=`Your browser does not support WebGL`,Error(`Failed to create WebGL context: ${r}`);let i=g_(s);i.softwareRenderer=n;let{onContextLost:c,onContextRestored:l}=t;return e.addEventListener(`webglcontextlost`,e=>c(e),!1),e.addEventListener(`webglcontextrestored`,e=>l(e),!1),s}finally{e.removeEventListener(`webglcontextcreationerror`,i,!1)}}function tv(e,t,n){return n[t]===void 0&&(n[t]=e.getExtension(t)||null),n[t]}function nv(e,t){let n=e.getParameter(7936),r=e.getParameter(7937);tv(e,`WEBGL_debug_renderer_info`,t);let i=t.WEBGL_debug_renderer_info,a=e.getParameter(i?i.UNMASKED_VENDOR_WEBGL:7936),o=e.getParameter(i?i.UNMASKED_RENDERER_WEBGL:7937),s=a||n,c=o||r,l=e.getParameter(7938),u=rv(s,c),d=iv(s,c);return{type:`webgl`,gpu:u,gpuType:av(s,c),gpuBackend:d,vendor:s,renderer:c,version:l,shadingLanguage:`glsl`,shadingLanguageVersion:300}}function rv(e,t){return/NVIDIA/i.exec(e)||/NVIDIA/i.exec(t)?`nvidia`:/INTEL/i.exec(e)||/INTEL/i.exec(t)?`intel`:/Apple/i.exec(e)||/Apple/i.exec(t)?`apple`:/AMD/i.exec(e)||/AMD/i.exec(t)||/ATI/i.exec(e)||/ATI/i.exec(t)?`amd`:/SwiftShader/i.exec(e)||/SwiftShader/i.exec(t)?`software`:`unknown`}function iv(e,t){return/Metal/i.exec(e)||/Metal/i.exec(t)?`metal`:/ANGLE/i.exec(e)||/ANGLE/i.exec(t)?`opengl`:`unknown`}function av(e,t){if(/SwiftShader/i.exec(e)||/SwiftShader/i.exec(t))return`cpu`;switch(rv(e,t)){case`apple`:return ov(e,t)?`integrated`:`unknown`;case`intel`:return`integrated`;case`software`:return`cpu`;case`unknown`:return`unknown`;default:return`discrete`}}function ov(e,t){return/Apple (M\d|A\d|GPU)/i.test(`${e} ${t}`)}function sv(e){switch(e){case`uint8`:return 5121;case`sint8`:return 5120;case`unorm8`:return 5121;case`snorm8`:return 5120;case`uint16`:return 5123;case`sint16`:return 5122;case`unorm16`:return 5123;case`snorm16`:return 5122;case`uint32`:return 5125;case`sint32`:return 5124;case`float16`:return 5131;case`float32`:return 5126}throw Error(String(e))}var cv=`WEBGL_compressed_texture_s3tc`,lv=`WEBGL_compressed_texture_s3tc_srgb`,uv=`EXT_texture_compression_rgtc`,dv=`EXT_texture_compression_bptc`,fv=`WEBGL_compressed_texture_etc`,pv=`WEBGL_compressed_texture_astc`,mv=`WEBGL_compressed_texture_etc1`,hv=`WEBGL_compressed_texture_pvrtc`,gv=`WEBGL_compressed_texture_atc`,_v=`EXT_texture_norm16`,vv=`EXT_render_snorm`,yv=`EXT_color_buffer_float`,bv=`snorm8-renderable-webgl`,xv=`norm16-renderable-webgl`,Sv=`snorm16-renderable-webgl`,Cv=`float16-renderable-webgl`,wv=`float32-renderable-webgl`,Tv=`rgb9e5ufloat-renderable-webgl`,Ev={"float32-renderable-webgl":{extensions:[yv]},"float16-renderable-webgl":{extensions:[`EXT_color_buffer_half_float`]},"rgb9e5ufloat-renderable-webgl":{extensions:[`WEBGL_render_shared_exponent`]},"snorm8-renderable-webgl":{extensions:[vv]},"norm16-webgl":{extensions:[_v]},"norm16-renderable-webgl":{features:[`norm16-webgl`]},"snorm16-renderable-webgl":{features:[`norm16-webgl`],extensions:[vv]},"float32-filterable":{extensions:[`OES_texture_float_linear`]},"float16-filterable-webgl":{extensions:[`OES_texture_half_float_linear`]},"texture-filterable-anisotropic-webgl":{extensions:[`EXT_texture_filter_anisotropic`]},"texture-blend-float-webgl":{extensions:[`EXT_float_blend`]},"texture-compression-bc":{extensions:[cv,lv,uv,dv]},"texture-compression-bc5-webgl":{extensions:[uv]},"texture-compression-bc7-webgl":{extensions:[dv]},"texture-compression-etc2":{extensions:[fv]},"texture-compression-astc":{extensions:[pv]},"texture-compression-etc1-webgl":{extensions:[mv]},"texture-compression-pvrtc-webgl":{extensions:[hv]},"texture-compression-atc-webgl":{extensions:[gv]}};function Dv(e){return e in Ev}function Ov(e,t,n){return kv(e,t,n,new Set)}function kv(e,t,n,r){let i=Ev[t];if(!i||r.has(t))return!1;r.add(t);let a=(i.features||[]).every(t=>kv(e,t,n,r));return r.delete(t),a?(i.extensions||[]).every(t=>!!tv(e,t,n)):!1}var Av={r8unorm:{gl:33321,rb:!0},r8snorm:{gl:36756,r:bv},r8uint:{gl:33330,rb:!0},r8sint:{gl:33329,rb:!0},rg8unorm:{gl:33323,rb:!0},rg8snorm:{gl:36757,r:bv},rg8uint:{gl:33336,rb:!0},rg8sint:{gl:33335,rb:!0},r16uint:{gl:33332,rb:!0},r16sint:{gl:33331,rb:!0},r16float:{gl:33325,rb:!0,r:Cv},r16unorm:{gl:33322,rb:!0,r:xv},r16snorm:{gl:36760,r:Sv},"rgba4unorm-webgl":{gl:32854,rb:!0},"rgb565unorm-webgl":{gl:36194,rb:!0},"rgb5a1unorm-webgl":{gl:32855,rb:!0},"rgb8unorm-webgl":{gl:32849},"rgb8snorm-webgl":{gl:36758},rgba8unorm:{gl:32856},"rgba8unorm-srgb":{gl:35907},rgba8snorm:{gl:36759,r:bv},rgba8uint:{gl:36220},rgba8sint:{gl:36238},bgra8unorm:{},"bgra8unorm-srgb":{},rg16uint:{gl:33338},rg16sint:{gl:33337},rg16float:{gl:33327,rb:!0,r:Cv},rg16unorm:{gl:33324,r:xv},rg16snorm:{gl:36761,r:Sv},r32uint:{gl:33334,rb:!0},r32sint:{gl:33333,rb:!0},r32float:{gl:33326,r:wv},rgb9e5ufloat:{gl:35901,r:Tv},rg11b10ufloat:{gl:35898,rb:!0},rgb10a2unorm:{gl:32857,rb:!0},rgb10a2uint:{gl:36975,rb:!0},"rgb16unorm-webgl":{gl:32852,r:!1},"rgb16snorm-webgl":{gl:36762,r:!1},rg32uint:{gl:33340,rb:!0},rg32sint:{gl:33339,rb:!0},rg32float:{gl:33328,rb:!0,r:wv},rgba16uint:{gl:36214,rb:!0},rgba16sint:{gl:36232,rb:!0},rgba16float:{gl:34842,r:Cv},rgba16unorm:{gl:32859,rb:!0,r:xv},rgba16snorm:{gl:36763,r:Sv},"rgb32float-webgl":{gl:34837,x:yv,r:wv,dataFormat:6407,types:[5126]},rgba32uint:{gl:36208,rb:!0},rgba32sint:{gl:36226,rb:!0},rgba32float:{gl:34836,rb:!0,r:wv},stencil8:{gl:36168,rb:!0},depth16unorm:{gl:33189,dataFormat:6402,types:[5123],rb:!0},depth24plus:{gl:33190,dataFormat:6402,types:[5125]},depth32float:{gl:36012,dataFormat:6402,types:[5126],rb:!0},"depth24plus-stencil8":{gl:35056,rb:!0,depthTexture:!0,dataFormat:34041,types:[34042]},"depth32float-stencil8":{gl:36013,dataFormat:34041,types:[36269],rb:!0},"bc1-rgb-unorm-webgl":{gl:33776,x:cv},"bc1-rgb-unorm-srgb-webgl":{gl:35916,x:lv},"bc1-rgba-unorm":{gl:33777,x:cv},"bc1-rgba-unorm-srgb":{gl:35916,x:lv},"bc2-rgba-unorm":{gl:33778,x:cv},"bc2-rgba-unorm-srgb":{gl:35918,x:lv},"bc3-rgba-unorm":{gl:33779,x:cv},"bc3-rgba-unorm-srgb":{gl:35919,x:lv},"bc4-r-unorm":{gl:36283,x:uv},"bc4-r-snorm":{gl:36284,x:uv},"bc5-rg-unorm":{gl:36285,x:uv},"bc5-rg-snorm":{gl:36286,x:uv},"bc6h-rgb-ufloat":{gl:36495,x:dv},"bc6h-rgb-float":{gl:36494,x:dv},"bc7-rgba-unorm":{gl:36492,x:dv},"bc7-rgba-unorm-srgb":{gl:36493,x:dv},"etc2-rgb8unorm":{gl:37492},"etc2-rgb8unorm-srgb":{gl:37494},"etc2-rgb8a1unorm":{gl:37496},"etc2-rgb8a1unorm-srgb":{gl:37497},"etc2-rgba8unorm":{gl:37493},"etc2-rgba8unorm-srgb":{gl:37495},"eac-r11unorm":{gl:37488},"eac-r11snorm":{gl:37489},"eac-rg11unorm":{gl:37490},"eac-rg11snorm":{gl:37491},"astc-4x4-unorm":{gl:37808},"astc-4x4-unorm-srgb":{gl:37840},"astc-5x4-unorm":{gl:37809},"astc-5x4-unorm-srgb":{gl:37841},"astc-5x5-unorm":{gl:37810},"astc-5x5-unorm-srgb":{gl:37842},"astc-6x5-unorm":{gl:37811},"astc-6x5-unorm-srgb":{gl:37843},"astc-6x6-unorm":{gl:37812},"astc-6x6-unorm-srgb":{gl:37844},"astc-8x5-unorm":{gl:37813},"astc-8x5-unorm-srgb":{gl:37845},"astc-8x6-unorm":{gl:37814},"astc-8x6-unorm-srgb":{gl:37846},"astc-8x8-unorm":{gl:37815},"astc-8x8-unorm-srgb":{gl:37847},"astc-10x5-unorm":{gl:37816},"astc-10x5-unorm-srgb":{gl:37848},"astc-10x6-unorm":{gl:37817},"astc-10x6-unorm-srgb":{gl:37849},"astc-10x8-unorm":{gl:37818},"astc-10x8-unorm-srgb":{gl:37850},"astc-10x10-unorm":{gl:37819},"astc-10x10-unorm-srgb":{gl:37851},"astc-12x10-unorm":{gl:37820},"astc-12x10-unorm-srgb":{gl:37852},"astc-12x12-unorm":{gl:37821},"astc-12x12-unorm-srgb":{gl:37853},"pvrtc-rgb4unorm-webgl":{gl:35840},"pvrtc-rgba4unorm-webgl":{gl:35842},"pvrtc-rgb2unorm-webgl":{gl:35841},"pvrtc-rgba2unorm-webgl":{gl:35843},"etc1-rbg-unorm-webgl":{gl:36196},"atc-rgb-unorm-webgl":{gl:35986},"atc-rgba-unorm-webgl":{gl:35986},"atc-rgbai-unorm-webgl":{gl:34798}};function jv(e,t,n){let r=t.create,i=Av[t.format];i?.gl===void 0&&(r=!1),i?.x&&(r&&=!!tv(e,i.x,n)),t.format===`stencil8`&&(r=!1);let a=i?.r===!1?!1:i?.r===void 0||Ov(e,i.r,n),o=r&&t.render&&a&&Mv(e,t.format,n);return{format:t.format,create:r&&t.create,render:o,filter:r&&t.filter,blend:r&&t.blend,store:r&&t.store}}function Mv(e,t,n){let r=Av[t],i=r?.gl;if(i===void 0||r?.x&&!tv(e,r.x,n))return!1;let a=e.getParameter(32873),o=e.getParameter(36006),s=e.createTexture(),c=e.createFramebuffer();if(!s||!c)return!1;let l=Number(e.getError());for(;l!==0;)l=e.getError();let u=!1;try{if(e.bindTexture(3553,s),e.texStorage2D(3553,1,i,1,1),Number(e.getError())!==0)return!1;e.bindFramebuffer(36160,c),e.framebufferTexture2D(36160,36064,3553,s,0),u=Number(e.checkFramebufferStatus(36160))===36053&&Number(e.getError())===0}finally{e.bindFramebuffer(36160,o),e.deleteFramebuffer(c),e.bindTexture(3553,a),e.deleteTexture(s)}return u}function Nv(e){let t=Av[e],n=Iv(e),r=kn.getInfo(e);return r.compressed&&(t.dataFormat=n),{internalFormat:n,format:t?.dataFormat||Fv(r.channels,r.integer,r.normalized,n),type:r.dataType?sv(r.dataType):t?.types?.[0]||5121,compressed:r.compressed||!1}}function Pv(e){switch(kn.getInfo(e).attachment){case`depth`:return 36096;case`stencil`:return 36128;case`depth-stencil`:return 33306;default:throw Error(`Not a depth stencil format: ${e}`)}}function Fv(e,t,n,r){if(r===6408||r===6407)return r;switch(e){case`r`:return t&&!n?36244:6403;case`rg`:return t&&!n?33320:33319;case`rgb`:return t&&!n?36248:6407;case`rgba`:return t&&!n?36249:6408;case`bgra`:throw Error(`bgra pixels not supported by WebGL`);default:return 6408}}function Iv(e){let t=Av[e]?.gl;if(t===void 0)throw Error(`Unsupported texture format ${e}`);return t}var Lv={"depth-clip-control":`EXT_depth_clamp`,"timestamp-query":`EXT_disjoint_timer_query_webgl2`,"compilation-status-async-webgl":`KHR_parallel_shader_compile`,"polygon-mode-webgl":`WEBGL_polygon_mode`,"provoking-vertex-webgl":`WEBGL_provoking_vertex`,"shader-clip-cull-distance-webgl":`WEBGL_clip_cull_distance`,"shader-noperspective-interpolation-webgl":`NV_shader_noperspective_interpolation`,"shader-conservative-depth-webgl":`EXT_conservative_depth`},Rv=class extends Wn{gl;extensions;testedFeatures=new Set;constructor(e,t,n){super([],n),this.gl=e,this.extensions=t,tv(e,`EXT_color_buffer_float`,t)}*[Symbol.iterator](){let e=this.getFeatures();for(let t of e)this.has(t)&&(yield t);return[]}has(e){return this.disabledFeatures?.[e]?!1:(this.testedFeatures.has(e)||(this.testedFeatures.add(e),Dv(e)&&Ov(this.gl,e,this.extensions)&&this.features.add(e),this.getWebGLFeature(e)&&this.features.add(e)),this.features.has(e))}initializeFeatures(){let e=this.getFeatures().filter(e=>e!==`polygon-mode-webgl`);for(let t of e)this.has(t)}getFeatures(){return[...Object.keys(Lv),...Object.keys(Ev)]}getWebGLFeature(e){let t=Lv[e];return typeof t==`string`?!!tv(this.gl,t,this.extensions):!!t}},zv=class extends Rn{get maxTextureDimension1D(){return 0}get maxTextureDimension2D(){return this.getParameter(3379)}get maxTextureDimension3D(){return this.getParameter(32883)}get maxTextureArrayLayers(){return this.getParameter(35071)}get maxBindGroups(){return 0}get maxDynamicUniformBuffersPerPipelineLayout(){return 0}get maxDynamicStorageBuffersPerPipelineLayout(){return 0}get maxSampledTexturesPerShaderStage(){return this.getParameter(35660)}get maxSamplersPerShaderStage(){return this.getParameter(35661)}get maxStorageBuffersPerShaderStage(){return 0}get maxStorageTexturesPerShaderStage(){return 0}get maxUniformBuffersPerShaderStage(){return this.getParameter(35375)}get maxUniformBufferBindingSize(){return this.getParameter(35376)}get maxStorageBufferBindingSize(){return 0}get minUniformBufferOffsetAlignment(){return this.getParameter(35380)}get minStorageBufferOffsetAlignment(){return 0}get maxVertexBuffers(){return 16}get maxVertexAttributes(){return this.getParameter(34921)}get maxVertexBufferArrayStride(){return 2048}get maxInterStageShaderVariables(){return this.getParameter(35659)}get maxComputeWorkgroupStorageSize(){return 0}get maxComputeInvocationsPerWorkgroup(){return 0}get maxComputeWorkgroupSizeX(){return 0}get maxComputeWorkgroupSizeY(){return 0}get maxComputeWorkgroupSizeZ(){return 0}get maxComputeWorkgroupsPerDimension(){return 0}gl;limits={};constructor(e){super(),this.gl=e}getParameter(e){return this.limits[e]===void 0&&(this.limits[e]=this.gl.getParameter(e)),this.limits[e]||0}},Bv=class extends br{device;gl;handle;colorAttachments=[];depthStencilAttachment=null;constructor(e,t){super(e,t);let n=t.handle===null;this.device=e,this.gl=e.gl,this.handle=this.props.handle||n?this.props.handle:this.gl.createFramebuffer(),n||(e._setWebGLDebugMetadata(this.handle,this,{spector:this.props}),t.handle||(this.autoCreateAttachmentTextures(),this.updateAttachments()))}destroy(){super.destroy(),!this.destroyed&&this.handle!==null&&!this.props.handle&&this.gl.deleteFramebuffer(this.handle)}updateAttachments(){let e=this.gl.bindFramebuffer(36160,this.handle);for(let e=0;e<this.colorAttachments.length;++e){let t=this.colorAttachments[e];if(t){let n=36064+e;this._attachTextureView(n,t)}}if(this.depthStencilAttachment){let e=Pv(this.depthStencilAttachment.props.format);this._attachTextureView(e,this.depthStencilAttachment)}if(this.device.props.debug){let e=this.gl.checkFramebufferStatus(36160);if(e!==36053)throw Error(`Framebuffer ${Hv(e)}`)}this.gl.bindFramebuffer(36160,e)}_attachTextureView(e,t){let{gl:n}=this.device,{texture:r}=t,i=t.props.baseMipLevel,a=t.props.baseArrayLayer;switch(n.bindTexture(r.glTarget,r.handle),r.glTarget){case 35866:case 32879:n.framebufferTextureLayer(36160,e,r.handle,i,a);break;case 34067:let t=Vv(a);n.framebufferTexture2D(36160,e,t,r.handle,i);break;case 3553:n.framebufferTexture2D(36160,e,3553,r.handle,i);break;default:throw Error(`Illegal texture type`)}n.bindTexture(r.glTarget,null)}resizeAttachments(e,t){if(this.handle===null){this.width=e,this.height=t;return}super.resizeAttachments(e,t)}};function Vv(e){return e<34069?e+34069:e}function Hv(e){switch(e){case 36053:return`success`;case 36054:return`Mismatched attachments`;case 36055:return`No attachments`;case 36057:return`Height/width mismatch`;case 36061:return`Unsupported or split attachments`;case 36182:return`Samples mismatch`;default:return`${e}`}}var Uv=class extends or{device;handle=null;_framebuffer=null;get[Symbol.toStringTag](){return`WebGLCanvasContext`}constructor(e,t){super(t),this.device=e,this._setAutoCreatedCanvasId(`${this.device.id}-canvas`),this._configureDevice()}_configureDevice(){(this.drawingBufferWidth!==this._framebuffer?.width||this.drawingBufferHeight!==this._framebuffer?.height)&&this._framebuffer?.resize([this.drawingBufferWidth,this.drawingBufferHeight])}_getCurrentFramebuffer(){return this._framebuffer||=new Bv(this.device,{id:`canvas-context-framebuffer`,handle:null,width:this.drawingBufferWidth,height:this.drawingBufferHeight}),this._framebuffer}},Wv=class extends sr{device;handle=null;context2d;get[Symbol.toStringTag](){return`WebGLPresentationContext`}constructor(e,t={}){super(t),this.device=e;let n=`${this[Symbol.toStringTag]}(${this.id})`;if(!this.device.getDefaultCanvasContext().offscreenCanvas)throw Error(`${n}: WebGL PresentationContext requires the default CanvasContext canvas to be an OffscreenCanvas`);let r=this.canvas.getContext(`2d`);if(!r)throw Error(`${n}: Failed to create 2d presentation context`);this.context2d=r,this._setAutoCreatedCanvasId(`${this.device.id}-presentation-canvas`),this._configureDevice(),this._startObservers()}present(){this._resizeDrawingBufferIfNeeded(),this.device.submit();let e=this.device.getDefaultCanvasContext(),[t,n]=e.getDrawingBufferSize();if(!(this.drawingBufferWidth===0||this.drawingBufferHeight===0||t===0||n===0||e.canvas.width===0||e.canvas.height===0)){if(t!==this.drawingBufferWidth||n!==this.drawingBufferHeight||e.canvas.width!==this.drawingBufferWidth||e.canvas.height!==this.drawingBufferHeight)throw Error(`${this[Symbol.toStringTag]}(${this.id}): Default canvas context size ${t}x${n} does not match presentation size ${this.drawingBufferWidth}x${this.drawingBufferHeight}`);this.context2d.clearRect(0,0,this.drawingBufferWidth,this.drawingBufferHeight),this.context2d.drawImage(e.canvas,0,0)}}_configureDevice(){}_getCurrentFramebuffer(e){let t=this.device.getDefaultCanvasContext();return t.setDrawingBufferSize(this.drawingBufferWidth,this.drawingBufferHeight),t.getCurrentFramebuffer(e)}},Gv={};function Kv(e=`id`){return Gv[e]=Gv[e]||1,`${e}-${Gv[e]++}`}var qv=class extends P{device;gl;handle;glTarget;glUsage;glIndexType=5123;byteLength=0;bytesUsed=0;constructor(e,t={}){super(e,t),this.device=e,this.gl=this.device.gl;let n=typeof t==`object`?t.handle:void 0;this.handle=n||this.gl.createBuffer(),e._setWebGLDebugMetadata(this.handle,this,{spector:{...this.props,data:typeof this.props.data}}),this.glTarget=Jv(this.props.usage),this.glUsage=Yv(this.props.usage),this.glIndexType=this.props.indexType===`uint32`?5125:5123,t.data?this._initWithData(t.data,t.byteOffset,t.byteLength):this._initWithByteLength(t.byteLength||0)}destroy(){!this.destroyed&&this.handle&&(this.removeStats(),this.props.handle?this.trackDeallocatedReferencedMemory(`Buffer`):(this.trackDeallocatedMemory(),this.gl.deleteBuffer(this.handle)),this.destroyed=!0,this.handle=null)}_initWithData(e,t=0,n=e.byteLength+t){let r=this.glTarget;this.gl.bindBuffer(r,this.handle),this.gl.bufferData(r,n,this.glUsage),this.gl.bufferSubData(r,t,e),this.gl.bindBuffer(r,null),this.bytesUsed=n,this.byteLength=n,this._setDebugData(e,t,n),this.props.handle?this.trackReferencedMemory(n,`Buffer`):this.trackAllocatedMemory(n)}_initWithByteLength(e){let t=e;e===0&&(t=new Float32Array);let n=this.glTarget;return this.gl.bindBuffer(n,this.handle),this.gl.bufferData(n,t,this.glUsage),this.gl.bindBuffer(n,null),this.bytesUsed=e,this.byteLength=e,this._setDebugData(null,0,e),this.props.handle?this.trackReferencedMemory(e,`Buffer`):this.trackAllocatedMemory(e),this}write(e,t=0){let n=ArrayBuffer.isView(e)?e:new Uint8Array(e),r=36663;this.gl.bindBuffer(r,this.handle),this.gl.bufferSubData(r,t,n),this.gl.bindBuffer(r,null),this._setDebugData(e,t,e.byteLength)}async mapAndWriteAsync(e,t=0,n=this.byteLength-t){let r=new ArrayBuffer(n);await e(r,`copied`),this.write(r,t)}async readAsync(e=0,t){return this.readSyncWebGL(e,t)}async mapAndReadAsync(e,t=0,n){return await e((await this.readAsync(t,n)).buffer,`copied`)}readSyncWebGL(e=0,t){t??=this.byteLength-e;let n=new Uint8Array(t);return this.gl.bindBuffer(36662,this.handle),this.gl.getBufferSubData(36662,e,n,0,t),this.gl.bindBuffer(36662,null),this._setDebugData(n,e,t),n}};function Jv(e){return e&P.INDEX?34963:e&P.VERTEX?34962:e&P.UNIFORM?35345:34962}function Yv(e){return e&P.INDEX||e&P.VERTEX?35044:e&P.UNIFORM?35048:35044}function Xv(e){let t=e.split(/\r?\n/),n=[];for(let e of t){if(e.length<=1)continue;let t=e.trim(),r=e.split(`:`),i=r[0]?.trim();if(r.length===2){let[e,a]=r;if(!e||!a){n.push({message:t,type:Zv(i||`info`),lineNum:0,linePos:0});continue}n.push({message:a.trim(),type:Zv(e),lineNum:0,linePos:0});continue}let[a,o,s,...c]=r;if(!a||!o||!s){n.push({message:r.slice(1).join(`:`).trim()||t,type:Zv(i||`info`),lineNum:0,linePos:0});continue}let l=parseInt(s,10);Number.isNaN(l)&&(l=0);let u=parseInt(o,10);Number.isNaN(u)&&(u=0),n.push({message:c.join(`:`).trim(),type:Zv(a),lineNum:l,linePos:u})}return n}function Zv(e){let t=[`warning`,`error`,`info`],n=e.toLowerCase();return t.includes(n)?n:`info`}var Qv=class extends _r{device;handle;constructor(e,t){switch(super(e,t),this.device=e,this.props.stage){case`vertex`:this.handle=this.props.handle||this.device.gl.createShader(35633);break;case`fragment`:this.handle=this.props.handle||this.device.gl.createShader(35632);break;default:throw Error(this.props.stage)}e._setWebGLDebugMetadata(this.handle,this,{spector:this.props});let n=this._compile(this.source);n&&typeof n.catch==`function`&&n.catch(()=>{this.compilationStatus=`error`})}destroy(){this.handle&&(this.removeStats(),this.device.gl.deleteShader(this.handle),this.destroyed=!0,this.handle.destroyed=!0)}get asyncCompilationStatus(){return this._waitForCompilationComplete().then(()=>(this._getCompilationStatus(),this.compilationStatus))}async getCompilationInfo(){return await this._waitForCompilationComplete(),this.getCompilationInfoSync()}getCompilationInfoSync(){let e=this.device.gl.getShaderInfoLog(this.handle);return e?Xv(e):[]}getTranslatedSource(){return this.device.getExtension(`WEBGL_debug_shaders`).WEBGL_debug_shaders?.getTranslatedShaderSource(this.handle)||null}_compile(e){e=e.startsWith(`#version `)?e:`#version 300 es\n${e}`;let{gl:t}=this.device;if(t.shaderSource(this.handle,e),t.compileShader(this.handle),!this.device.props.debug){this.compilationStatus=`pending`;return}if(!this.device.features.has(`compilation-status-async-webgl`)){if(this._getCompilationStatus(),this.debugShader(),this.compilationStatus===`error`)throw Error(`GLSL compilation errors in ${this.props.stage} shader ${this.props.id}`);return}return M.once(1,`Shader compilation is asynchronous`)(),this._waitForCompilationComplete().then(()=>{M.info(2,`Shader ${this.id} - async compilation complete: ${this.compilationStatus}`)(),this._getCompilationStatus(),this.debugShader()})}async _waitForCompilationComplete(){let e=async e=>await new Promise(t=>setTimeout(t,e));if(!this.device.features.has(`compilation-status-async-webgl`)){await e(10);return}let{gl:t}=this.device;for(;;){if(t.getShaderParameter(this.handle,37297))return;await e(10)}}_getCompilationStatus(){this.compilationStatus=this.device.gl.getShaderParameter(this.handle,35713)?`success`:`error`}};function $v(e,t,n,r){if(cy(t))return r(e);let i=e;i.pushState();try{return ey(e,t),W_(i.gl,n),r(e)}finally{i.popState()}}function ey(e,t){let n=e,{gl:r}=n;if(t.cullMode)switch(t.cullMode){case`none`:r.disable(2884);break;case`front`:r.enable(2884),r.cullFace(1028);break;case`back`:r.enable(2884),r.cullFace(1029);break}if(t.frontFace&&r.frontFace(oy(`frontFace`,t.frontFace,{ccw:2305,cw:2304})),t.unclippedDepth&&e.features.has(`depth-clip-control`)&&r.enable(34383),t.depthBias!==void 0&&(r.enable(32823),r.polygonOffset(t.depthBias,t.depthBiasSlopeScale||0)),t.provokingVertex&&e.features.has(`provoking-vertex-webgl`)){let e=n.getExtension(`WEBGL_provoking_vertex`).WEBGL_provoking_vertex,r=oy(`provokingVertex`,t.provokingVertex,{first:36429,last:36430});e?.provokingVertexWEBGL(r)}if((t.polygonMode||t.polygonOffsetLine)&&e.features.has(`polygon-mode-webgl`)){if(t.polygonMode){let e=n.getExtension(`WEBGL_polygon_mode`).WEBGL_polygon_mode,r=oy(`polygonMode`,t.polygonMode,{fill:6914,line:6913});e?.polygonModeWEBGL(1028,r),e?.polygonModeWEBGL(1029,r)}t.polygonOffsetLine&&r.enable(10754)}if(e.features.has(`shader-clip-cull-distance-webgl`)&&(t.clipDistance0&&r.enable(12288),t.clipDistance1&&r.enable(12289),t.clipDistance2&&r.enable(12290),t.clipDistance3&&r.enable(12291),t.clipDistance4&&r.enable(12292),t.clipDistance5&&r.enable(12293),t.clipDistance6&&r.enable(12294),t.clipDistance7&&r.enable(12295)),t.depthWriteEnabled!==void 0&&r.depthMask(sy(`depthWriteEnabled`,t.depthWriteEnabled)),t.depthCompare&&(t.depthCompare===`always`?r.disable(2929):r.enable(2929),r.depthFunc(ty(`depthCompare`,t.depthCompare))),t.clearDepth!==void 0&&r.clearDepth(t.clearDepth),t.stencilWriteMask){let e=t.stencilWriteMask;r.stencilMaskSeparate(1028,e),r.stencilMaskSeparate(1029,e)}if(t.stencilReadMask&&M.warn(`stencilReadMask not supported under WebGL`),t.stencilCompare){let e=t.stencilReadMask||4294967295,n=ty(`depthCompare`,t.stencilCompare);t.stencilCompare===`always`?r.disable(2960):r.enable(2960),r.stencilFuncSeparate(1028,n,0,e),r.stencilFuncSeparate(1029,n,0,e)}if(t.stencilPassOperation&&t.stencilFailOperation&&t.stencilDepthFailOperation){let e=ny(`stencilPassOperation`,t.stencilPassOperation),n=ny(`stencilFailOperation`,t.stencilFailOperation),i=ny(`stencilDepthFailOperation`,t.stencilDepthFailOperation);r.stencilOpSeparate(1028,n,i,e),r.stencilOpSeparate(1029,n,i,e)}switch(t.blend){case!0:r.enable(3042);break;case!1:r.disable(3042);break;default:}if(t.blendColorOperation||t.blendAlphaOperation){let e=ry(`blendColorOperation`,t.blendColorOperation||`add`),n=ry(`blendAlphaOperation`,t.blendAlphaOperation||`add`);r.blendEquationSeparate(e,n);let i=iy(`blendColorSrcFactor`,t.blendColorSrcFactor||`one`),a=iy(`blendColorDstFactor`,t.blendColorDstFactor||`zero`),o=iy(`blendAlphaSrcFactor`,t.blendAlphaSrcFactor||`one`),s=iy(`blendAlphaDstFactor`,t.blendAlphaDstFactor||`zero`);r.blendFuncSeparate(i,a,o,s)}}function ty(e,t){return oy(e,t,{never:512,less:513,equal:514,"less-equal":515,greater:516,"not-equal":517,"greater-equal":518,always:519})}function ny(e,t){return oy(e,t,{keep:7680,zero:0,replace:7681,invert:5386,"increment-clamp":7682,"decrement-clamp":7683,"increment-wrap":34055,"decrement-wrap":34056})}function ry(e,t){return oy(e,t,{add:32774,subtract:32778,"reverse-subtract":32779,min:32775,max:32776})}function iy(e,t,n=`color`){return oy(e,t,{one:1,zero:0,src:768,"one-minus-src":769,dst:774,"one-minus-dst":775,"src-alpha":770,"one-minus-src-alpha":771,"dst-alpha":772,"one-minus-dst-alpha":773,"src-alpha-saturated":776,constant:n===`color`?32769:32771,"one-minus-constant":n===`color`?32770:32772,src1:768,"one-minus-src1":769,"src1-alpha":770,"one-minus-src1-alpha":771})}function ay(e,t){return`Illegal parameter ${t} for ${e}`}function oy(e,t,n){if(!(t in n))throw Error(ay(e,t));return n[t]}function sy(e,t){return t}function cy(e){let t=!0;for(let n in e){t=!1;break}return t}function ly(e){let t={};return e.addressModeU&&(t[10242]=uy(e.addressModeU)),e.addressModeV&&(t[10243]=uy(e.addressModeV)),e.addressModeW&&(t[32882]=uy(e.addressModeW)),e.magFilter&&(t[10240]=dy(e.magFilter)),(e.minFilter||e.mipmapFilter)&&(t[10241]=fy(e.minFilter||`linear`,e.mipmapFilter)),e.lodMinClamp!==void 0&&(t[33082]=e.lodMinClamp),e.lodMaxClamp!==void 0&&(t[33083]=e.lodMaxClamp),e.type===`comparison-sampler`&&(t[34892]=34894),e.compare&&(t[34893]=ty(`compare`,e.compare)),e.maxAnisotropy&&(t[34046]=e.maxAnisotropy),t}function uy(e){switch(e){case`clamp-to-edge`:return 33071;case`repeat`:return 10497;case`mirror-repeat`:return 33648}}function dy(e){switch(e){case`nearest`:return 9728;case`linear`:return 9729}}function fy(e,t=`none`){if(!t)return dy(e);switch(t){case`none`:return dy(e);case`nearest`:switch(e){case`nearest`:return 9984;case`linear`:return 9985}break;case`linear`:switch(e){case`nearest`:return 9986;case`linear`:return 9987}}}var py=class extends cr{device;handle;parameters;constructor(e,t){super(e,t),this.device=e,this.parameters=ly(t),this.handle=t.handle||this.device.gl.createSampler(),this._setSamplerParameters(this.parameters)}destroy(){this.handle&&=(this.device.gl.deleteSampler(this.handle),void 0)}toString(){return`Sampler(${this.id},${JSON.stringify(this.props)})`}_setSamplerParameters(e){for(let[t,n]of Object.entries(e)){let e=Number(t);switch(e){case 33082:case 33083:this.device.gl.samplerParameterf(this.handle,e,n);break;default:this.device.gl.samplerParameteri(this.handle,e,n);break}}}};function my(e,t,n){if(hy(t))return n(e);let{nocatch:r=!0}=t,i=X_.get(e);i.push(),W_(e,t);let a;if(r)a=n(e),i.pop();else try{a=n(e)}finally{i.pop()}return a}function hy(e){for(let t in e)return!1;return!0}var gy=class extends ur{device;gl;handle;texture;constructor(e,t){super(e,{...I.defaultProps,...t}),this.device=e,this.gl=this.device.gl,this.handle=null,this.texture=t.texture}};function _y(e){return vy[e]}var vy={5124:`sint32`,5125:`uint32`,5122:`sint16`,5123:`uint16`,5120:`sint8`,5121:`uint8`,5126:`float32`,5131:`float16`,33635:`uint16`,32819:`uint16`,32820:`uint16`,33640:`uint32`,35899:`uint32`,35902:`uint32`,34042:`uint32`,36269:`uint32`},yy=class extends I{device;gl;handle;sampler=void 0;view;glTarget;glFormat;glType;glInternalFormat;compressed;_textureUnit=0;_framebuffer=null;_framebufferAttachmentKey=null;constructor(e,t){super(e,t,{byteAlignment:1}),this.device=e,this.gl=this.device.gl;let n=Nv(this.props.format);this.glTarget=Sy(this.props.dimension),this.glInternalFormat=n.internalFormat,this.glFormat=n.format,this.glType=n.type,this.compressed=n.compressed,this.handle=this.props.handle||this.gl.createTexture(),this.device._setWebGLDebugMetadata(this.handle,this,{spector:this.props}),this.gl.bindTexture(this.glTarget,this.handle);let{dimension:r,width:i,height:a,depth:o,mipLevels:s,glTarget:c,glInternalFormat:l}=this;if(!this.compressed)switch(r){case`2d`:case`cube`:this.gl.texStorage2D(c,s,l,i,a);break;case`2d-array`:case`3d`:this.gl.texStorage3D(c,s,l,i,a,o);break;default:throw Error(r)}this.gl.bindTexture(this.glTarget,null),this._initializeData(t.data),this.props.handle?this.trackReferencedMemory(this.getAllocatedByteLength(),`Texture`):this.trackAllocatedMemory(this.getAllocatedByteLength(),`Texture`),this.setSampler(this.props.sampler),this.view=new gy(this.device,{...this.props,texture:this}),Object.seal(this)}destroy(){this.handle&&(this._framebuffer?.destroy(),this._framebuffer=null,this._framebufferAttachmentKey=null,this.removeStats(),this.props.handle?this.trackDeallocatedReferencedMemory(`Texture`):(this.gl.deleteTexture(this.handle),this.trackDeallocatedMemory(`Texture`)),this.destroyed=!0)}createView(e){return new gy(this.device,{...e,texture:this})}setSampler(e={}){super.setSampler(e);let t=ly(this.sampler.props);this._setSamplerParameters(t)}copyExternalImage(e){let t=this._normalizeCopyExternalImageOptions(e);if(t.sourceX||t.sourceY)throw Error(`WebGL does not support sourceX/sourceY)`);let{glFormat:n,glType:r}=this,{image:i,depth:a,mipLevel:o,x:s,y:c,z:l,width:u,height:d}=t,f=Cy(this.glTarget,this.dimension,l),p=t.flipY?{37440:!0}:{};return this.gl.bindTexture(this.glTarget,this.handle),my(this.gl,p,()=>{switch(this.dimension){case`2d`:case`cube`:this.gl.texSubImage2D(f,o,s,c,u,d,n,r,i);break;case`2d-array`:case`3d`:this.gl.texSubImage3D(f,o,s,c,l,u,d,a,n,r,i);break;default:}}),this.gl.bindTexture(this.glTarget,null),{width:t.width,height:t.height}}copyImageData(e){super.copyImageData(e)}readBuffer(e={},t){if(!t)throw Error(`${this} readBuffer requires a destination buffer`);let n=this._getSupportedColorReadOptions(e),r=e.byteOffset??0,i=this.computeMemoryLayout(n);if(t.byteLength<r+i.byteLength)throw Error(`${this} readBuffer target is too small (${t.byteLength} < ${r+i.byteLength})`);let a=t;this.gl.bindBuffer(35051,a.handle);try{this._readColorTextureLayers(n,i,e=>{this.gl.readPixels(n.x,n.y,n.width,n.height,this.glFormat,this.glType,r+e)})}finally{this.gl.bindBuffer(35051,null)}return t}async readDataAsync(e={}){throw Error(`${this} readDataAsync is deprecated; use readBuffer() with an explicit destination buffer or DynamicTexture.readAsync()`)}writeBuffer(e,t={}){let n=this._normalizeTextureWriteOptions(t),{width:r,height:i,depthOrArrayLayers:a,mipLevel:o,byteOffset:s,x:c,y:l,z:u}=n,{glFormat:d,glType:f,compressed:p}=this,m=Cy(this.glTarget,this.dimension,u);if(p)throw Error(`writeBuffer for compressed textures is not implemented in WebGL`);let{bytesPerPixel:h}=this.device.getTextureFormatInfo(this.format),g=h?n.bytesPerRow/h:void 0,_={3317:this.byteAlignment,...g===void 0?{}:{3314:g},32878:n.rowsPerImage};this.gl.bindTexture(this.glTarget,this.handle),this.gl.bindBuffer(35052,e.handle),my(this.gl,_,()=>{switch(this.dimension){case`2d`:case`cube`:this.gl.texSubImage2D(m,o,c,l,r,i,d,f,s);break;case`2d-array`:case`3d`:this.gl.texSubImage3D(m,o,c,l,u,r,i,a,d,f,s);break;default:}}),this.gl.bindBuffer(35052,null),this.gl.bindTexture(this.glTarget,null)}writeData(e,t={}){let n=this._normalizeTextureWriteOptions(t),r=ArrayBuffer.isView(e)?e:new Uint8Array(e),{width:i,height:a,depthOrArrayLayers:o,mipLevel:s,x:c,y:l,z:u,byteOffset:d}=n,{glFormat:f,glType:p,compressed:m}=this,h=Cy(this.glTarget,this.dimension,u),g;if(!m){let{bytesPerPixel:e}=this.device.getTextureFormatInfo(this.format);e&&(g=n.bytesPerRow/e)}let _=this.compressed?{}:{3317:this.byteAlignment,...g===void 0?{}:{3314:g},32878:n.rowsPerImage},v=xy(r,d),y=m?by(r,d):r,b=this._getMipLevelSize(s),x=c===0&&l===0&&u===0&&i===b.width&&a===b.height&&o===b.depthOrArrayLayers;this.gl.bindTexture(this.glTarget,this.handle),this.gl.bindBuffer(35052,null),my(this.gl,_,()=>{switch(this.dimension){case`2d`:case`cube`:m?x?this.gl.compressedTexImage2D(h,s,f,i,a,0,y):this.gl.compressedTexSubImage2D(h,s,c,l,i,a,f,y):this.gl.texSubImage2D(h,s,c,l,i,a,f,p,r,v);break;case`2d-array`:case`3d`:m?x?this.gl.compressedTexImage3D(h,s,f,i,a,o,0,y):this.gl.compressedTexSubImage3D(h,s,c,l,u,i,a,o,f,y):this.gl.texSubImage3D(h,s,c,l,u,i,a,o,f,p,r,v);break;default:}}),this.gl.bindTexture(this.glTarget,null)}_getRowByteAlignment(e,t){return 1}_getFramebuffer(){return this._framebuffer||=this.device.createFramebuffer({id:`framebuffer-for-${this.id}`,width:this.width,height:this.height,colorAttachments:[this]}),this._framebuffer}readDataSyncWebGL(e={}){let t=this._getSupportedColorReadOptions(e),n=this.computeMemoryLayout(t),r=ei(_y(this.glType)),i=new r(n.byteLength/r.BYTES_PER_ELEMENT);return this._readColorTextureLayers(t,n,e=>{let a=new r(i.buffer,i.byteOffset+e,n.bytesPerImage/r.BYTES_PER_ELEMENT);this.gl.readPixels(t.x,t.y,t.width,t.height,this.glFormat,this.glType,a)}),i.buffer}_readColorTextureLayers(e,t,n){let r=this._getFramebuffer(),i=t.bytesPerRow/t.bytesPerPixel,a={3333:this.byteAlignment,...i===e.width?{}:{3330:i}},o=this.gl.getParameter(3074),s=this.gl.bindFramebuffer(36160,r.handle);try{this.gl.readBuffer(36064),my(this.gl,a,()=>{for(let i=0;i<e.depthOrArrayLayers;i++)this._attachReadSubresource(r,e.mipLevel,e.z+i),n(i*t.bytesPerImage)})}finally{this.gl.bindFramebuffer(36160,s||null),this.gl.readBuffer(o)}}_attachReadSubresource(e,t,n){let r=`${t}:${n}`;if(this._framebufferAttachmentKey!==r){switch(this.dimension){case`2d`:this.gl.framebufferTexture2D(36160,36064,3553,this.handle,t);break;case`cube`:this.gl.framebufferTexture2D(36160,36064,Cy(this.glTarget,this.dimension,n),this.handle,t);break;case`2d-array`:case`3d`:this.gl.framebufferTextureLayer(36160,36064,this.handle,t,n);break;default:throw Error(`${this} color readback does not support ${this.dimension} textures`)}if(this.device.props.debug){let t=Number(this.gl.checkFramebufferStatus(36160));if(t!==36053)throw Error(`${e} incomplete for ${this} readback (${t})`)}this._framebufferAttachmentKey=r}}generateMipmapsWebGL(e){if(!(!(this.device.isTextureFormatRenderable(this.props.format)&&this.device.isTextureFormatFilterable(this.props.format))&&(M.warn(`${this} is not renderable or filterable, may not be able to generate mipmaps`)(),!e?.force)))try{this.gl.bindTexture(this.glTarget,this.handle),this.gl.generateMipmap(this.glTarget)}catch(e){M.warn(`Error generating mipmap for ${this}: ${e.message}`)()}finally{this.gl.bindTexture(this.glTarget,null)}}_setSamplerParameters(e){M.log(2,`${this.id} sampler parameters`,this.device.getGLKeys(e))(),this.gl.bindTexture(this.glTarget,this.handle);for(let[t,n]of Object.entries(e)){let e=Number(t),r=n;switch(e){case 33082:case 33083:this.gl.texParameterf(this.glTarget,e,r);break;case 10240:case 10241:this.gl.texParameteri(this.glTarget,e,r);break;case 10242:case 10243:case 32882:this.gl.texParameteri(this.glTarget,e,r);break;case 34046:this.device.features.has(`texture-filterable-anisotropic-webgl`)&&this.gl.texParameteri(this.glTarget,e,r);break;case 34892:case 34893:this.gl.texParameteri(this.glTarget,e,r);break}}this.gl.bindTexture(this.glTarget,null)}_getActiveUnit(){return this.gl.getParameter(34016)-33984}_bind(e){let{gl:t}=this;return e!==void 0&&(this._textureUnit=e,t.activeTexture(33984+e)),t.bindTexture(this.glTarget,this.handle),e}_unbind(e){let{gl:t}=this;return e!==void 0&&(this._textureUnit=e,t.activeTexture(33984+e)),t.bindTexture(this.glTarget,null),e}};function by(e,t=0){return t?new e.constructor(e.buffer,e.byteOffset+t,(e.byteLength-t)/e.BYTES_PER_ELEMENT):e}function xy(e,t){if(t%e.BYTES_PER_ELEMENT!==0)throw Error(`Texture byteOffset ${t} must align to typed array element size ${e.BYTES_PER_ELEMENT}`);return t/e.BYTES_PER_ELEMENT}function Sy(e){switch(e){case`1d`:break;case`2d`:return 3553;case`3d`:return 32879;case`cube`:return 34067;case`2d-array`:return 35866;case`cube-array`:break}throw Error(e)}function Cy(e,t,n){return t===`cube`?34069+n:e}function wy(e,t,n,r){let i=e,a=r;a===!0&&(a=1),a===!1&&(a=0);let o=typeof a==`number`?[a]:a;switch(n){case 35678:case 35680:case 35679:case 35682:case 36289:case 36292:case 36293:case 36298:case 36299:case 36300:case 36303:case 36306:case 36307:case 36308:case 36311:if(typeof r!=`number`)throw Error(`samplers must be set to integers`);return e.uniform1i(t,r);case 5126:return e.uniform1fv(t,o);case 35664:return e.uniform2fv(t,o);case 35665:return e.uniform3fv(t,o);case 35666:return e.uniform4fv(t,o);case 5124:return e.uniform1iv(t,o);case 35667:return e.uniform2iv(t,o);case 35668:return e.uniform3iv(t,o);case 35669:return e.uniform4iv(t,o);case 35670:return e.uniform1iv(t,o);case 35671:return e.uniform2iv(t,o);case 35672:return e.uniform3iv(t,o);case 35673:return e.uniform4iv(t,o);case 5125:return i.uniform1uiv(t,o,1);case 36294:return i.uniform2uiv(t,o,2);case 36295:return i.uniform3uiv(t,o,3);case 36296:return i.uniform4uiv(t,o,4);case 35674:return e.uniformMatrix2fv(t,!1,o);case 35675:return e.uniformMatrix3fv(t,!1,o);case 35676:return e.uniformMatrix4fv(t,!1,o);case 35685:return i.uniformMatrix2x3fv(t,!1,o);case 35686:return i.uniformMatrix2x4fv(t,!1,o);case 35687:return i.uniformMatrix3x2fv(t,!1,o);case 35688:return i.uniformMatrix3x4fv(t,!1,o);case 35689:return i.uniformMatrix4x2fv(t,!1,o);case 35690:return i.uniformMatrix4x3fv(t,!1,o)}throw Error(`Illegal uniform`)}function Ty(e){switch(e){case`point-list`:return 0;case`line-list`:return 1;case`line-strip`:return 3;case`triangle-list`:return 4;case`triangle-strip`:return 5;default:throw Error(e)}}function Ey(e){switch(e){case`point-list`:return 0;case`line-list`:return 1;case`line-strip`:return 1;case`triangle-list`:return 4;case`triangle-strip`:return 4;default:throw Error(e)}}var Dy=class extends xr{device;handle;vs;fs;introspectedLayout;bindings={};uniforms={};varyings=null;_uniformCount=0;_uniformSetters={};get[Symbol.toStringTag](){return`WEBGLRenderPipeline`}constructor(e,t){super(e,t),this.device=e;let n=this.sharedRenderPipeline||this.device._createSharedRenderPipelineWebGL(t);this.sharedRenderPipeline=n,this.handle=n.handle,this.vs=n.vs,this.fs=n.fs,this.linkStatus=n.linkStatus,this.introspectedLayout=n.introspectedLayout,this.device._setWebGLDebugMetadata(this.handle,this,{spector:{id:this.props.id}}),this.shaderLayout=t.shaderLayout?Oy(this.introspectedLayout,t.shaderLayout):this.introspectedLayout}destroy(){this.destroyed||(this.sharedRenderPipeline&&!this.props._sharedRenderPipeline&&this.sharedRenderPipeline.destroy(),this.destroyResource())}setBindings(e,t){let n=ji(Ai(this.shaderLayout,e));for(let[e,r]of Object.entries(n)){let n=ky(this.shaderLayout,e);if(n){switch(r||M.warn(`Unsetting binding "${e}" in render pipeline "${this.id}"`)(),n.type){case`uniform`:if(!(r instanceof qv)&&!(r.buffer instanceof qv))throw Error(`buffer value`);break;case`texture`:if(!(r instanceof gy||r instanceof yy||r instanceof Bv))throw Error(`${this} Bad texture binding for ${e}`);break;case`sampler`:M.warn(`Ignoring sampler ${e}`)();break;default:throw Error(n.type)}this.bindings[e]=r}else{let n=this.shaderLayout.bindings.map(e=>`"${e.name}"`).join(`, `);t?.disableWarnings||M.warn(`No binding "${e}" in render pipeline "${this.id}", expected one of ${n}`,r)()}}}draw(e){this._syncLinkStatus();let t=e.bindGroups?ji(e.bindGroups):e.bindings||this.bindings,{renderPass:n,parameters:r=this.props.parameters,topology:i=this.props.topology,vertexArray:a,vertexCount:o,instanceCount:s,isInstanced:c=!1,firstVertex:l=0,transformFeedback:u,uniforms:d=this.uniforms}=e,f=Ty(i),p=!!a.indexBuffer,m=a.indexBuffer?.glIndexType;if(this.linkStatus!==`success`)return M.info(2,`RenderPipeline:${this.id}.draw() aborted - waiting for shader linking`)(),!1;if(!this._areTexturesRenderable(t))return M.info(2,`RenderPipeline:${this.id}.draw() aborted - textures not yet loaded`)(),!1;this.device.gl.useProgram(this.handle),a.bindBeforeRender(n),u&&u.begin(this.props.topology),this._applyBindings(t,{disableWarnings:this.props.disableWarnings}),this._applyUniforms(d);let h=n;return $v(this.device,r,h.glParameters,()=>{p&&c?this.device.gl.drawElementsInstanced(f,o||0,m,l,s||0):p?this.device.gl.drawElements(f,o||0,m,l):c?this.device.gl.drawArraysInstanced(f,l,o||0,s||0):this.device.gl.drawArrays(f,l,o||0),u&&u.end()}),a.unbindAfterRender(n),!0}_areTexturesRenderable(e){let t=!0;for(let n of this.shaderLayout.bindings)Ay(e,n.name)||(M.warn(`Binding ${n.name} not found in ${this.id}`)(),t=!1);return t}_applyBindings(e,t){if(this._syncLinkStatus(),this.linkStatus!==`success`)return;let{gl:n}=this.device;n.useProgram(this.handle);let r=0,i=0;for(let t of this.shaderLayout.bindings){let a=Ay(e,t.name);if(!a)throw Error(`No value for binding ${t.name} in ${this.id}`);switch(t.type){case`uniform`:let{name:e}=t,o=n.getUniformBlockIndex(this.handle,e);if(o===4294967295)throw Error(`Invalid uniform block name ${e}`);if(n.uniformBlockBinding(this.handle,o,i),a instanceof qv)n.bindBufferBase(35345,i,a.handle);else{let e=a;n.bindBufferRange(35345,i,e.buffer.handle,e.offset||0,e.size||e.buffer.byteLength-(e.offset||0))}i+=1;break;case`texture`:if(!(a instanceof gy||a instanceof yy||a instanceof Bv))throw Error(`texture`);let s;if(a instanceof gy)s=a.texture;else if(a instanceof yy)s=a;else if(a instanceof Bv&&a.colorAttachments[0]instanceof gy)M.warn(`Passing framebuffer in texture binding may be deprecated. Use fbo.colorAttachments[0] instead`)(),s=a.colorAttachments[0].texture;else throw Error(`No texture`);n.activeTexture(33984+r),n.bindTexture(s.glTarget,s.handle),r+=1;break;case`sampler`:break;case`storage`:case`read-only-storage`:throw Error(`binding type '${t.type}' not supported in WebGL`)}}}_applyUniforms(e){for(let t of this.shaderLayout.uniforms||[]){let{name:n,location:r,type:i,textureUnit:a}=t,o=e[n]??a;o!==void 0&&wy(this.device.gl,r,i,o)}}_syncLinkStatus(){this.linkStatus=this.sharedRenderPipeline.linkStatus}};function Oy(e,t){let n={...e,attributes:e.attributes.map(e=>({...e})),bindings:e.bindings.map(e=>({...e}))};for(let e of t?.attributes||[]){let t=n.attributes.find(t=>t.name===e.name);t?(t.type=e.type||t.type,t.stepMode=e.stepMode||t.stepMode):M.warn(`shader layout attribute ${e.name} not present in shader`)}for(let e of t?.bindings||[]){let t=ky(n,e.name);if(!t){M.warn(`shader layout binding ${e.name} not present in shader`);continue}Object.assign(t,e)}return n}function ky(e,t){return e.bindings.find(e=>e.name===t||e.name===`${t}Uniforms`||`${e.name}Uniforms`===t)}function Ay(e,t){return e[t]||e[`${t}Uniforms`]||e[t.replace(/Uniforms$/,``)]}function jy(e){return Ly[e]}function My(e){return Fy[e]}function Ny(e){return!!Iy[e]}function Py(e){return Iy[e]}var Fy={5126:`f32`,35664:`vec2<f32>`,35665:`vec3<f32>`,35666:`vec4<f32>`,5124:`i32`,35667:`vec2<i32>`,35668:`vec3<i32>`,35669:`vec4<i32>`,5125:`u32`,36294:`vec2<u32>`,36295:`vec3<u32>`,36296:`vec4<u32>`,35670:`f32`,35671:`vec2<f32>`,35672:`vec3<f32>`,35673:`vec4<f32>`,35674:`mat2x2<f32>`,35685:`mat2x3<f32>`,35686:`mat2x4<f32>`,35687:`mat3x2<f32>`,35675:`mat3x3<f32>`,35688:`mat3x4<f32>`,35689:`mat4x2<f32>`,35690:`mat4x3<f32>`,35676:`mat4x4<f32>`},Iy={35678:{viewDimension:`2d`,sampleType:`float`},35680:{viewDimension:`cube`,sampleType:`float`},35679:{viewDimension:`3d`,sampleType:`float`},35682:{viewDimension:`3d`,sampleType:`depth`},36289:{viewDimension:`2d-array`,sampleType:`float`},36292:{viewDimension:`2d-array`,sampleType:`depth`},36293:{viewDimension:`cube`,sampleType:`float`},36298:{viewDimension:`2d`,sampleType:`sint`},36299:{viewDimension:`3d`,sampleType:`sint`},36300:{viewDimension:`cube`,sampleType:`sint`},36303:{viewDimension:`2d-array`,sampleType:`uint`},36306:{viewDimension:`2d`,sampleType:`uint`},36307:{viewDimension:`3d`,sampleType:`uint`},36308:{viewDimension:`cube`,sampleType:`uint`},36311:{viewDimension:`2d-array`,sampleType:`uint`}},Ly={uint8:5121,sint8:5120,unorm8:5121,snorm8:5120,uint16:5123,sint16:5122,unorm16:5123,snorm16:5122,uint32:5125,sint32:5124,float16:5131,float32:5126};function Ry(e,t){let n={attributes:[],bindings:[]};n.attributes=zy(e,t);let r=Hy(e,t);for(let e of r){let t=e.uniforms.map(e=>({name:e.name,format:e.format,byteOffset:e.byteOffset,byteStride:e.byteStride,arrayLength:e.arrayLength}));n.bindings.push({type:`uniform`,name:e.name,group:0,location:e.location,visibility:!!e.vertex&(e.fragment?2:0),minBindingSize:e.byteLength,uniforms:t})}let i=Vy(e,t),a=0;for(let e of i)if(Ny(e.type)){let{viewDimension:t,sampleType:r}=Py(e.type);n.bindings.push({type:`texture`,name:e.name,group:0,location:a,viewDimension:t,sampleType:r}),e.textureUnit=a,a+=1}i.length&&(n.uniforms=i);let o=By(e,t);return o?.length&&(n.varyings=o),n}function zy(e,t){let n=[],r=e.getProgramParameter(t,35721);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i);if(!r)throw Error(`activeInfo`);let{name:a,type:o}=r,s=e.getAttribLocation(t,a);if(s>=0){let e=My(o),t=/instance/i.test(a)?`instance`:`vertex`;n.push({name:a,location:s,stepMode:t,type:e})}}return n.sort((e,t)=>e.location-t.location),n}function By(e,t){let n=[],r=e.getProgramParameter(t,35971);for(let i=0;i<r;i++){let r=e.getTransformFeedbackVarying(t,i);if(!r)throw Error(`activeInfo`);let{name:a,type:o,size:s}=r,{type:c,components:l}=kr(My(o));n.push({location:i,name:a,type:c,size:s*l})}return n.sort((e,t)=>e.location-t.location),n}function Vy(e,t){let n=[],r=e.getProgramParameter(t,35718);for(let i=0;i<r;i++){let r=e.getActiveUniform(t,i);if(!r)throw Error(`activeInfo`);let{name:a,size:o,type:s}=r,{name:c,isArray:l}=Uy(a),u=e.getUniformLocation(t,c),d={location:u,name:c,size:o,type:s,isArray:l};if(n.push(d),d.size>1)for(let r=0;r<d.size;r++){let i=`${c}[${r}]`;u=e.getUniformLocation(t,i);let a={...d,name:i,location:u};n.push(a)}}return n}function Hy(e,t){let n=(n,r)=>e.getActiveUniformBlockParameter(t,n,r),r=[],i=e.getProgramParameter(t,35382);for(let a=0;a<i;a++){let i={name:e.getActiveUniformBlockName(t,a)||``,location:n(a,35391),byteLength:n(a,35392),vertex:n(a,35396),fragment:n(a,35398),uniformCount:n(a,35394),uniforms:[]},o=n(a,35395)||[],s=e.getActiveUniforms(t,o,35383),c=e.getActiveUniforms(t,o,35384),l=e.getActiveUniforms(t,o,35387),u=e.getActiveUniforms(t,o,35388);for(let n=0;n<i.uniformCount;++n){let r=o[n];if(r!==void 0){let a=e.getActiveUniform(t,r);if(!a)throw Error(`activeInfo`);let o=My(s[n]);i.uniforms.push({name:a.name,format:o,type:s[n],arrayLength:c[n],byteOffset:l[n],byteStride:u[n]})}}let d=new Set(i.uniforms.map(e=>e.name.split(`.`)[0]).filter(e=>!!e)),f=i.name.replace(/Uniforms$/,``);if(d.size===1&&!d.has(i.name)&&!d.has(f)){let[e]=d;M.warn(`Uniform block "${i.name}" uses GLSL instance "${e}". luma.gl binds uniform buffers by block name ("${i.name}") and alias ("${f}"). Prefer matching the instance name to one of those to avoid confusing silent mismatches.`)()}r.push(i)}return r.sort((e,t)=>e.location-t.location),r}function Uy(e){if(e[e.length-1]!==`]`)return{name:e,length:1,isArray:!1};let t=/([^[]*)(\[[0-9]+\])?/.exec(e);return{name:Qn(t?.[1],`Failed to parse GLSL uniform name ${e}`),length:+!!t?.[2],isArray:!!t?.[2]}}var Wy=4,Gy=class extends Sr{device;handle;vs;fs;introspectedLayout={attributes:[],bindings:[],uniforms:[]};linkStatus=`pending`;constructor(e,t){super(e,t),this.device=e,this.handle=t.handle||this.device.gl.createProgram(),this.vs=t.vs,this.fs=t.fs,t.varyings&&t.varyings.length>0&&this.device.gl.transformFeedbackVaryings(this.handle,t.varyings,t.bufferMode||35981),this._linkShaders(),M.time(3,`RenderPipeline ${this.id} - shaderLayout introspection`)(),this.introspectedLayout=Ry(this.device.gl,this.handle),M.timeEnd(3,`RenderPipeline ${this.id} - shaderLayout introspection`)()}destroy(){this.destroyed||(this.device.gl.useProgram(null),this.device.gl.deleteProgram(this.handle),this.handle.destroyed=!0,this.destroyResource())}async _linkShaders(){let{gl:e}=this.device;if(e.attachShader(this.handle,this.vs.handle),e.attachShader(this.handle,this.fs.handle),M.time(Wy,`linkProgram for ${this.id}`)(),e.linkProgram(this.handle),M.timeEnd(Wy,`linkProgram for ${this.id}`)(),!this.device.features.has(`compilation-status-async-webgl`)){let e=this._getLinkStatus();this._reportLinkStatus(e);return}M.once(1,`RenderPipeline linking is asynchronous`)(),await this._waitForLinkComplete(),M.info(2,`RenderPipeline ${this.id} - async linking complete: ${this.linkStatus}`)();let t=this._getLinkStatus();this._reportLinkStatus(t)}async _reportLinkStatus(e){switch(e){case`success`:return;default:let t=e===`link-error`?`Link error`:`Validation error`;switch(this.vs.compilationStatus){case`error`:throw this.vs.debugShader(),Error(`${this} ${t} during compilation of ${this.vs}`);case`pending`:await this.vs.asyncCompilationStatus,this.vs.debugShader();break;case`success`:break}switch(this.fs?.compilationStatus){case`error`:throw this.fs.debugShader(),Error(`${this} ${t} during compilation of ${this.fs}`);case`pending`:await this.fs.asyncCompilationStatus,this.fs.debugShader();break;case`success`:break}let n=this.device.gl.getProgramInfoLog(this.handle);this.device.reportError(Error(`${t} during ${e}: ${n}`),this)(),this.device.debug()}}_getLinkStatus(){let{gl:e}=this.device;return e.getProgramParameter(this.handle,35714)?(this._initializeSamplerUniforms(),e.validateProgram(this.handle),e.getProgramParameter(this.handle,35715)?(this.linkStatus=`success`,`success`):(this.linkStatus=`error`,`validation-error`)):(this.linkStatus=`error`,`link-error`)}_initializeSamplerUniforms(){let{gl:e}=this.device;e.useProgram(this.handle);let t=0,n=e.getProgramParameter(this.handle,35718);for(let r=0;r<n;r++){let n=e.getActiveUniform(this.handle,r);if(n&&Ny(n.type)){let r=n.name.endsWith(`[0]`),i=r?n.name.slice(0,-3):n.name,a=e.getUniformLocation(this.handle,i);a!==null&&(t=this._assignSamplerUniform(a,n,r,t))}}}_assignSamplerUniform(e,t,n,r){let{gl:i}=this.device;if(n&&t.size>1){let n=Int32Array.from({length:t.size},(e,t)=>r+t);return i.uniform1iv(e,n),r+t.size}return i.uniform1i(e,r),r+1}async _waitForLinkComplete(){let e=async e=>await new Promise(t=>setTimeout(t,e));if(!this.device.features.has(`compilation-status-async-webgl`)){await e(10);return}let{gl:t}=this.device;for(;;){if(t.getProgramParameter(this.handle,37297))return;await e(10)}}},Ky=class extends Or{device;handle=null;commands=[];constructor(e,t={}){super(e,t),this.device=e}_executeCommands(e=this.commands){for(let t of e)switch(t.name){case`copy-buffer-to-buffer`:qy(this.device,t.options);break;case`copy-buffer-to-texture`:Jy(this.device,t.options);break;case`copy-texture-to-buffer`:Yy(this.device,t.options);break;case`copy-texture-to-texture`:Xy(this.device,t.options);break;default:throw Error(t.name)}}};function qy(e,t){let n=t.sourceBuffer,r=t.destinationBuffer;e.gl.bindBuffer(36662,n.handle),e.gl.bindBuffer(36663,r.handle),e.gl.copyBufferSubData(36662,36663,t.sourceOffset??0,t.destinationOffset??0,t.size),e.gl.bindBuffer(36662,null),e.gl.bindBuffer(36663,null)}function Jy(e,t){throw Error(`copyBufferToTexture is not supported in WebGL`)}function Yy(e,t){let{sourceTexture:n,mipLevel:r=0,aspect:i=`all`,width:a=t.sourceTexture.width,height:o=t.sourceTexture.height,depthOrArrayLayers:s,origin:c=[0,0,0],destinationBuffer:l,byteOffset:u=0,bytesPerRow:d,rowsPerImage:f}=t;if(n instanceof I){n.readBuffer({x:c[0]??0,y:c[1]??0,z:c[2]??0,width:a,height:o,depthOrArrayLayers:s,mipLevel:r,aspect:i,byteOffset:u},l);return}if(i!==`all`)throw Error(`aspect not supported in WebGL`);if(r!==0||s!==void 0||d||f)throw Error(`not implemented`);let{framebuffer:p,destroyFramebuffer:m}=Zy(n),h;try{let t=l,n=a||p.width,r=o||p.height,i=Nv(Qn(p.colorAttachments[0]).texture.props.format),s=i.format,d=i.type;e.gl.bindBuffer(35051,t.handle),h=e.gl.bindFramebuffer(36160,p.handle),e.gl.readPixels(c[0],c[1],n,r,s,d,u)}finally{e.gl.bindBuffer(35051,null),h!==void 0&&e.gl.bindFramebuffer(36160,h),m&&p.destroy()}}function Xy(e,t){let{sourceTexture:n,destinationMipLevel:r=0,origin:i=[0,0],destinationOrigin:a=[0,0,0],destinationTexture:o}=t,{width:s=t.destinationTexture.width,height:c=t.destinationTexture.height}=t,{framebuffer:l,destroyFramebuffer:u}=Zy(n),[d=0,f=0]=i,[p,m,h]=a,g=e.gl.bindFramebuffer(36160,l.handle),_,v;if(o instanceof yy)_=o,s=Number.isFinite(s)?s:_.width,c=Number.isFinite(c)?c:_.height,_._bind(0),v=_.glTarget;else throw Error(`invalid destination`);switch(v){case 3553:case 34067:e.gl.copyTexSubImage2D(v,r,p,m,d,f,s,c);break;case 35866:case 32879:e.gl.copyTexSubImage3D(v,r,p,m,h,d,f,s,c);break;default:}_&&_._unbind(),e.gl.bindFramebuffer(36160,g),u&&l.destroy()}function Zy(e){if(e instanceof I){let{width:t,height:n,id:r}=e;return{framebuffer:e.device.createFramebuffer({id:`framebuffer-for-${r}`,width:t,height:n,colorAttachments:[e]}),destroyFramebuffer:!0}}return{framebuffer:e,destroyFramebuffer:!1}}var Qy=[1,2,4,8],$y=class extends Er{device;handle=null;glParameters={};constructor(e,t){super(e,t),this.device=e;let n=this.props.framebuffer,r=!n||n.handle===null;r&&e.getDefaultCanvasContext()._resizeDrawingBufferIfNeeded();let i;if(!t?.parameters?.viewport)if(!r&&n){let{width:e,height:t}=n;i=[0,0,e,t]}else{let[t,n]=e.getDefaultCanvasContext().getDrawingBufferSize();i=[0,0,t,n]}if(this.device.pushState(),this.setParameters({viewport:i,...this.props.parameters}),!r&&n?.colorAttachments.length){let e=n.colorAttachments.map((e,t)=>36064+t);this.device.gl.drawBuffers(e)}else r&&this.device.gl.drawBuffers([1029]);this.clear(),this.props.timestampQuerySet&&this.props.beginTimestampIndex!==void 0&&this.props.timestampQuerySet.writeTimestamp(this.props.beginTimestampIndex)}end(){this.destroyed||(this.props.timestampQuerySet&&this.props.endTimestampIndex!==void 0&&this.props.timestampQuerySet.writeTimestamp(this.props.endTimestampIndex),this.device.popState(),this.destroy())}pushDebugGroup(e){}popDebugGroup(){}insertDebugMarker(e){}setParameters(e={}){let t={...this.glParameters};t.framebuffer=this.props.framebuffer||null,this.props.depthReadOnly&&(t.depthMask=!this.props.depthReadOnly),t.stencilMask=+!this.props.stencilReadOnly,t[35977]=this.props.discard,e.viewport&&(e.viewport.length>=6?(t.viewport=e.viewport.slice(0,4),t.depthRange=[e.viewport[4],e.viewport[5]]):t.viewport=e.viewport),e.scissorRect&&(t.scissorTest=!0,t.scissor=e.scissorRect),e.blendConstant&&(t.blendColor=e.blendConstant),e.stencilReference!==void 0&&(t[2967]=e.stencilReference,t[36003]=e.stencilReference),`colorMask`in e&&(t.colorMask=Qy.map(t=>!!(t&e.colorMask))),this.glParameters=t,W_(this.device.gl,t)}beginOcclusionQuery(e){this.props.occlusionQuerySet?.beginOcclusionQuery()}endOcclusionQuery(){this.props.occlusionQuerySet?.endOcclusionQuery()}clear(){let e={...this.glParameters},t=0;this.props.clearColors&&this.props.clearColors.forEach((e,t)=>{e&&this.clearColorBuffer(t,e)}),this.props.clearColor!==!1&&this.props.clearColors===void 0&&(t|=16384,e.clearColor=this.props.clearColor),this.props.clearDepth!==!1&&(t|=256,e.clearDepth=this.props.clearDepth),this.props.clearStencil!==!1&&(t|=1024,e.clearStencil=this.props.clearStencil),t!==0&&my(this.device.gl,e,()=>{this.device.gl.clear(t)})}clearColorBuffer(e=0,t=[0,0,0,0]){my(this.device.gl,{framebuffer:this.props.framebuffer},()=>{switch(t.constructor){case Int8Array:case Int16Array:case Int32Array:this.device.gl.clearBufferiv(6144,e,t);break;case Uint8Array:case Uint8ClampedArray:case Uint16Array:case Uint32Array:this.device.gl.clearBufferuiv(6144,e,t);break;case Float32Array:this.device.gl.clearBufferfv(6144,e,t);break;default:throw Error(`clearColorBuffer: color must be typed array`)}})}},eb=class extends Dr{device;handle=null;commandBuffer;constructor(e,t){super(e,t),this.device=e,this.commandBuffer=new Ky(e,{id:`${this.props.id}-command-buffer`})}destroy(){this.destroyResource()}finish(e){return e?.id&&this.commandBuffer.id!==e.id&&(this.commandBuffer.id=e.id,this.commandBuffer.props.id=e.id),this.destroy(),this.commandBuffer}beginRenderPass(e={}){return new $y(this.device,this._applyTimeProfilingToPassProps(e))}beginComputePass(e={}){throw Error(`ComputePass not supported in WebGL`)}copyBufferToBuffer(e){this.commandBuffer.commands.push({name:`copy-buffer-to-buffer`,options:e})}copyBufferToTexture(e){this.commandBuffer.commands.push({name:`copy-buffer-to-texture`,options:e})}copyTextureToBuffer(e){this.commandBuffer.commands.push({name:`copy-texture-to-buffer`,options:e})}copyTextureToTexture(e){this.commandBuffer.commands.push({name:`copy-texture-to-texture`,options:e})}pushDebugGroup(e){}popDebugGroup(){}insertDebugMarker(e){}resolveQuerySet(e,t,n){throw Error(`resolveQuerySet is not supported in WebGL`)}writeTimestamp(e,t){e.writeTimestamp(t)}};function tb(e){let{target:t,source:n,start:r=0,count:i=1}=e,a=n.length,o=i*a,s=0;for(let e=r;s<a;s++)t[e++]=n[s]??0;for(;s<o;)s<o-s?(t.copyWithin(r+s,r,r+s),s*=2):(t.copyWithin(r+s,r,r+o-s),s=o);return e.target}var nb=class e extends Yr{get[Symbol.toStringTag](){return`VertexArray`}device;handle;buffer=null;bufferValue=null;static isConstantAttributeZeroSupported(e){return o()===`Chrome`}constructor(e,t){super(e,t),this.device=e,this.handle=this.device.gl.createVertexArray()}destroy(){super.destroy(),this.buffer&&this.buffer?.destroy(),this.handle&&=(this.device.gl.deleteVertexArray(this.handle),void 0)}setIndexBuffer(e){let t=e;if(t&&t.glTarget!==34963)throw Error(`Use .setBuffer()`);this.device.gl.bindVertexArray(this.handle),this.device.gl.bindBuffer(34963,t?t.handle:null),this.indexBuffer=t,this.device.gl.bindVertexArray(null)}setBuffer(e,t){let n=t;if(n.glTarget===34963)throw Error(`Use .setIndexBuffer()`);let{size:r,type:i,stride:a,offset:o,normalized:s,integer:c,divisor:l}=this._getAccessor(e);this.device.gl.bindVertexArray(this.handle),this.device.gl.bindBuffer(34962,n.handle),c?this.device.gl.vertexAttribIPointer(e,r,i,a,o):this.device.gl.vertexAttribPointer(e,r,i,s,a,o),this.device.gl.bindBuffer(34962,null),this.device.gl.enableVertexAttribArray(e),this.device.gl.vertexAttribDivisor(e,l||0),this.attributes[e]=n,this.device.gl.bindVertexArray(null)}setConstantWebGL(e,t){this._enable(e,!1),this.attributes[e]=t}bindBeforeRender(){this.device.gl.bindVertexArray(this.handle),this._applyConstantAttributes()}unbindAfterRender(){this.device.gl.bindVertexArray(null)}_applyConstantAttributes(){for(let e=0;e<this.maxVertexAttributes;++e){let t=this.attributes[e];ArrayBuffer.isView(t)&&this.device.setConstantAttributeWebGL(e,t)}}_getAccessor(e){let t=this.attributeInfos[e];if(!t)throw Error(`Unknown attribute location ${e}`);let n=sv(t.bufferDataType);return{size:t.bufferComponents,type:n,stride:t.byteStride,offset:t.byteOffset,normalized:t.normalized,integer:t.integer,divisor:+(t.stepMode===`instance`)}}_enable(t,n=!0){let r=e.isConstantAttributeZeroSupported(this.device)||t!==0;(n||r)&&(t=Number(t),this.device.gl.bindVertexArray(this.handle),n?this.device.gl.enableVertexAttribArray(t):this.device.gl.disableVertexAttribArray(t),this.device.gl.bindVertexArray(null))}getConstantBuffer(e,t){let n=rb(t),r=n.byteLength*e,i=n.length*e;if(this.buffer&&r!==this.buffer.byteLength)throw Error(`Buffer size is immutable, byte length ${r} !== ${this.buffer.byteLength}.`);let a=!this.buffer;if(this.buffer=this.buffer||this.device.createBuffer({byteLength:r}),a||=!ib(n,this.bufferValue),a){let e=Si(t.constructor,i);tb({target:e,source:n,start:0,count:i}),this.buffer.write(e),this.bufferValue=t}return this.buffer}};function rb(e){return Array.isArray(e)?new Float32Array(e):e}function ib(e,t){if(!e||!t||e.length!==t.length||e.constructor!==t.constructor)return!1;for(let n=0;n<e.length;++n)if(e[n]!==t[n])return!1;return!0}var ab=class extends Xr{device;gl;handle;layout;buffers={};unusedBuffers={};bindOnUse=!0;_bound=!1;constructor(e,t){super(e,t),this.device=e,this.gl=e.gl,this.handle=this.props.handle||this.gl.createTransformFeedback(),this.layout=this.props.layout,t.buffers&&this.setBuffers(t.buffers),Object.seal(this)}destroy(){this.gl.deleteTransformFeedback(this.handle),super.destroy()}begin(e=`point-list`){this.gl.bindTransformFeedback(36386,this.handle),this.bindOnUse&&this._bindBuffers(),this.gl.beginTransformFeedback(Ey(e))}end(){this.gl.endTransformFeedback(),this.bindOnUse&&this._unbindBuffers(),this.gl.bindTransformFeedback(36386,null)}setBuffers(e){this.buffers={},this.unusedBuffers={},this.bind(()=>{for(let[t,n]of Object.entries(e))this.setBuffer(t,n)})}setBuffer(e,t){let n=this._getVaryingIndex(e),{buffer:r,byteLength:i,byteOffset:a}=this._getBufferRange(t);if(n<0){this.unusedBuffers[e]=r,M.warn(`${this.id} unusedBuffers varying buffer ${e}`)();return}this.buffers[n]={buffer:r,byteLength:i,byteOffset:a},this.bindOnUse||this._bindBuffer(n,r,a,i)}getBuffer(e){if(ob(e))return this.buffers[e]||null;let t=this._getVaryingIndex(e);return this.buffers[t]??null}bind(e=this.handle){if(typeof e!=`function`)return this.gl.bindTransformFeedback(36386,e),this;let t;return this._bound?t=e():(this.gl.bindTransformFeedback(36386,this.handle),this._bound=!0,t=e(),this._bound=!1,this.gl.bindTransformFeedback(36386,null)),t}unbind(){this.bind(null)}_getBufferRange(e){if(e instanceof qv)return{buffer:e,byteOffset:0,byteLength:e.byteLength};let{buffer:t,byteOffset:n=0,byteLength:r=e.buffer.byteLength}=e;return{buffer:t,byteOffset:n,byteLength:r}}_getVaryingIndex(e){if(ob(e))return Number(e);for(let t of this.layout.varyings||[])if(e===t.name)return t.location;return-1}_bindBuffers(){for(let[e,t]of Object.entries(this.buffers)){let{buffer:n,byteLength:r,byteOffset:i}=this._getBufferRange(t);this._bindBuffer(Number(e),n,i,r)}}_unbindBuffers(){for(let e in this.buffers)this.gl.bindBufferBase(35982,Number(e),null)}_bindBuffer(e,t,n=0,r){let i=t&&t.handle;!i||r===void 0?this.gl.bindBufferBase(35982,e,i):this.gl.bindBufferRange(35982,e,i,n,r)}};function ob(e){return typeof e==`number`?Number.isInteger(e):/^\d+$/.test(e)}var sb=class extends Zr{device;handle;_timestampPairs=[];_pendingReads=new Set;_occlusionQuery=null;_occlusionActive=!1;get[Symbol.toStringTag](){return`QuerySet`}constructor(e,t){if(super(e,t),this.device=e,t.type===`timestamp`){if(t.count<2)throw Error(`Timestamp QuerySet requires at least two query slots`);this._timestampPairs=Array(Math.ceil(t.count/2)).fill(null).map(()=>({activeQuery:null,completedQueries:[]})),this.handle=null}else{if(t.count>1)throw Error(`WebGL occlusion QuerySet can only have one value`);let e=this.device.gl.createQuery();if(!e)throw Error(`WebGL query not supported`);this.handle=e}Object.seal(this)}destroy(){if(!this.destroyed){this.handle&&this.device.gl.deleteQuery(this.handle);for(let e of this._timestampPairs){e.activeQuery&&(this._cancelPendingQuery(e.activeQuery),this.device.gl.deleteQuery(e.activeQuery.handle));for(let t of e.completedQueries)this._cancelPendingQuery(t),this.device.gl.deleteQuery(t.handle)}this._occlusionQuery&&(this._cancelPendingQuery(this._occlusionQuery),this.device.gl.deleteQuery(this._occlusionQuery.handle));for(let e of Array.from(this._pendingReads))this._cancelPendingQuery(e);this.destroyResource()}}isResultAvailable(e){return this.props.type===`timestamp`?e===void 0?this._timestampPairs.some((e,t)=>this._isTimestampPairAvailable(t)):this._isTimestampPairAvailable(this._getTimestampPairIndex(e)):this._occlusionQuery?this._pollQueryAvailability(this._occlusionQuery):!1}async readResults(e){let t=e?.firstQuery||0,n=e?.queryCount||this.props.count-t;if(this._validateRange(t,n),this.props.type===`timestamp`){let e=Array(n).fill(0n),r=Math.floor(t/2),i=Math.floor((t+n-1)/2);for(let a=r;a<=i;a++){let r=await this._consumeTimestampPairResult(a),i=a*2,o=i+1;i>=t&&i<t+n&&(e[i-t]=0n),o>=t&&o<t+n&&(e[o-t]=r)}return e}if(!this._occlusionQuery)throw Error(`Occlusion query has not been started`);return[await this._consumeQueryResult(this._occlusionQuery)]}async readTimestampDuration(e,t){if(this.props.type!==`timestamp`)throw Error(`Timestamp durations require a timestamp QuerySet`);if(e<0||t>=this.props.count||t<=e)throw Error(`Timestamp duration range is out of bounds`);if(e%2!=0||t!==e+1)throw Error(`WebGL timestamp durations require adjacent even/odd query indices`);let n=await this._consumeTimestampPairResult(this._getTimestampPairIndex(e));return Number(n)/1e6}beginOcclusionQuery(){if(this.props.type!==`occlusion`)throw Error(`Occlusion queries require an occlusion QuerySet`);if(!this.handle)throw Error(`WebGL occlusion query is not available`);if(this._occlusionActive)throw Error(`Occlusion query is already active`);this.device.gl.beginQuery(35887,this.handle),this._occlusionQuery={handle:this.handle,promise:null,result:null,disjoint:!1,cancelled:!1,pollRequestId:null,resolve:null,reject:null},this._occlusionActive=!0}endOcclusionQuery(){if(!this._occlusionActive)throw Error(`Occlusion query is not active`);this.device.gl.endQuery(35887),this._occlusionActive=!1}writeTimestamp(e){if(this.props.type!==`timestamp`)throw Error(`Timestamp writes require a timestamp QuerySet`);let t=this._getTimestampPairIndex(e),n=this._timestampPairs[t];if(e%2==0){if(n.activeQuery)throw Error(`Timestamp query pair is already active`);let e=this.device.gl.createQuery();if(!e)throw Error(`WebGL query not supported`);let t={handle:e,promise:null,result:null,disjoint:!1,cancelled:!1,pollRequestId:null,resolve:null,reject:null};this.device.gl.beginQuery(35007,e),n.activeQuery=t;return}if(!n.activeQuery)throw Error(`Timestamp query pair was ended before it was started`);this.device.gl.endQuery(35007),n.completedQueries.push(n.activeQuery),n.activeQuery=null}_validateRange(e,t){if(e<0||t<0||e+t>this.props.count)throw Error(`Query read range is out of bounds`)}_getTimestampPairIndex(e){if(e<0||e>=this.props.count)throw Error(`Query index is out of bounds`);return Math.floor(e/2)}_isTimestampPairAvailable(e){let t=this._timestampPairs[e];return!t||t.completedQueries.length===0?!1:this._pollQueryAvailability(t.completedQueries[0])}_pollQueryAvailability(e){if(e.cancelled||this.destroyed)return e.result=0n,!0;if(e.result!==null||e.disjoint)return!0;if(!this.device.gl.getQueryParameter(e.handle,34919))return!1;let t=!!this.device.gl.getParameter(36795);return e.disjoint=t,e.result=t?0n:BigInt(this.device.gl.getQueryParameter(e.handle,34918)),!0}async _consumeTimestampPairResult(e){let t=this._timestampPairs[e];if(!t||t.completedQueries.length===0)throw Error(`Timestamp query pair has no completed result`);let n=t.completedQueries.shift();try{return await this._consumeQueryResult(n)}finally{this.device.gl.deleteQuery(n.handle)}}_consumeQueryResult(e){return e.promise?e.promise:(this._pendingReads.add(e),e.promise=new Promise((t,n)=>{e.resolve=t,e.reject=n;let r=()=>{if(e.pollRequestId=null,e.cancelled||this.destroyed){this._pendingReads.delete(e),e.promise=null,e.resolve=null,e.reject=null,t(0n);return}if(!this._pollQueryAvailability(e)){e.pollRequestId=this._requestAnimationFrame(r);return}this._pendingReads.delete(e),e.promise=null,e.resolve=null,e.reject=null,e.disjoint?n(Error(`GPU timestamp query was invalidated by a disjoint event`)):t(e.result||0n)};r()}),e.promise)}_cancelPendingQuery(e){if(this._pendingReads.delete(e),e.cancelled=!0,e.pollRequestId!==null&&(this._cancelAnimationFrame(e.pollRequestId),e.pollRequestId=null),e.resolve){let t=e.resolve;e.promise=null,e.resolve=null,e.reject=null,t(0n)}}_requestAnimationFrame(e){return requestAnimationFrame(e)}_cancelAnimationFrame(e){cancelAnimationFrame(e)}},cb=class extends Qr{device;gl;handle;signaled;_signaled=!1;constructor(e,t={}){super(e,{}),this.device=e,this.gl=e.gl;let n=this.props.handle||this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!n)throw Error(`Failed to create WebGL fence`);this.handle=n,this.signaled=new Promise(e=>{let t=()=>{let n=this.gl.clientWaitSync(this.handle,0,0);n===this.gl.ALREADY_SIGNALED||n===this.gl.CONDITION_SATISFIED?(this._signaled=!0,e()):setTimeout(t,1)};t()})}isSignaled(){if(this._signaled)return!0;let e=this.gl.getSyncParameter(this.handle,this.gl.SYNC_STATUS);return this._signaled=e===this.gl.SIGNALED,this._signaled}destroy(){this.destroyed||this.gl.deleteSync(this.handle)}};function lb(e){switch(e){case 6406:case 33326:case 6403:case 36244:return 1;case 33339:case 33340:case 33328:case 33320:case 33319:return 2;case 6407:case 36248:case 34837:return 3;case 6408:case 36249:case 34836:return 4;default:return 0}}function ub(e){switch(e){case 5121:return 1;case 33635:case 32819:case 32820:return 2;case 5126:return 4;default:return 0}}function db(e,t){let{sourceX:n=0,sourceY:r=0,sourceAttachment:i=0}=t||{},{target:a=null,sourceWidth:o,sourceHeight:s,sourceDepth:c,sourceFormat:l,sourceType:u}=t||{},{framebuffer:d,deleteFramebuffer:f}=pb(e),{gl:p,handle:m}=d;o||=d.width,s||=d.height;let h=d.colorAttachments[i]?.texture;if(!h)throw Error(`Invalid framebuffer attachment ${i}`);c=h?.depth||1,l||=h?.glFormat||6408,u||=h?.glType||5121,a=hb(a,u,l,o,s,c);let g=nn.getDataType(a);u||=jy(g);let _=p.bindFramebuffer(36160,m);return p.readBuffer(36064+i),p.readPixels(n,r,o,s,l,u,a),p.readBuffer(36064),p.bindFramebuffer(36160,_||null),f&&d.destroy(),a}function fb(e,t){let{target:n,sourceX:r=0,sourceY:i=0,sourceFormat:a=6408,targetByteOffset:o=0}=t||{},{sourceWidth:s,sourceHeight:c,sourceType:l}=t||{},{framebuffer:u,deleteFramebuffer:d}=pb(e);s||=u.width,c||=u.height;let f=u;l||=5121;let p=n;if(!p){let e=lb(a),t=ub(l),n=o+s*c*e*t;p=f.device.createBuffer({byteLength:n})}let m=e.device.createCommandEncoder();return m.copyTextureToBuffer({sourceTexture:e,width:s,height:c,origin:[r,i],destinationBuffer:p,byteOffset:o}),m.destroy(),d&&u.destroy(),p}function pb(e){return e instanceof br?{framebuffer:e,deleteFramebuffer:!1}:{framebuffer:mb(e),deleteFramebuffer:!0}}function mb(e,t){let{device:n,width:r,height:i,id:a}=e;return n.createFramebuffer({...t,id:`framebuffer-for-${a}`,width:r,height:i,colorAttachments:[e]})}function hb(e,t,n,r,i,a){if(e)return e;t||=5121;let o=_y(t),s=nn.getTypedArrayConstructor(o),c=lb(n);return new s(r*i*c)}var gb=e({WebGLDevice:()=>_b}),_b=class e extends Gn{static getDeviceFromContext(e){return e?e.luma?.device??null:null}type=`webgl`;handle;features;limits;info;canvasContext;preferredColorFormat=`rgba8unorm`;preferredDepthFormat=`depth24plus`;commandEncoder;lost;_resolveContextLost;gl;_constants;extensions;_polyfilled=!1;spectorJS;get[Symbol.toStringTag](){return`WebGLDevice`}toString(){return`${this[Symbol.toStringTag]}(${this.id})`}isVertexFormatSupported(e){switch(e){case`unorm8x4-bgra`:return!1;default:return!0}}constructor(t){super({...t,id:t.id||Kv(`webgl-device`)});let n=Gn._getCanvasContextProps(t);if(!n)throw Error(`WebGLDevice requires props.createCanvasContext to be set`);let r=n.canvas?.gl??null,i=e.getDeviceFromContext(r);if(i)throw Error(`WebGL context already attached to device ${i.id}`);this.canvasContext=new Uv(this,n),this.lost=new Promise(e=>{this._resolveContextLost=e});let a={...t.webgl};n.alphaMode===`premultiplied`&&(a.premultipliedAlpha=!0),t.powerPreference!==void 0&&(a.powerPreference=t.powerPreference),t.failIfMajorPerformanceCaveat!==void 0&&(a.failIfMajorPerformanceCaveat=t.failIfMajorPerformanceCaveat);let o=this.props._handle||ev(this.canvasContext.canvas,{onContextLost:e=>this._resolveContextLost?.({reason:`destroyed`,message:`Entered sleep mode, or too many apps or browser tabs are using the GPU.`}),onContextRestored:e=>console.log(`WebGL context restored`)},a);if(!o)throw Error(`WebGL context creation failed`);if(i=e.getDeviceFromContext(o),i){if(t._reuseDevices)return M.log(1,`Not creating a new Device, instead returning a reference to Device ${i.id} already attached to WebGL context`,i)(),this.canvasContext.destroy(),i._reused=!0,i;throw Error(`WebGL context already attached to device ${i.id}`)}this.handle=o,this.gl=o,this.spectorJS=S_({...this.props,gl:this.handle});let s=g_(this.handle);s.device=this,s.extensions||={},this.extensions=s.extensions,this.info=nv(this.gl,this.extensions),this.limits=new zv(this.gl),this.features=new Rv(this.gl,this.extensions,this.props._disabledFeatures),this.props._initializeFeatures&&this.features.initializeFeatures(),new X_(this.gl,{log:(...e)=>M.log(1,...e)()}).trackState(this.gl,{copyState:!1}),(t.debug||t.debugWebGL)&&(this.gl=E_(this.gl,{debugWebGL:!0,traceWebGL:t.debugWebGL}),M.warn(`WebGL debug mode activated. Performance reduced.`)()),t.debugWebGL&&(M.level=Math.max(M.level,1)),this.commandEncoder=new eb(this,{id:`${this}-command-encoder`}),this.canvasContext._startObservers()}destroy(){if(this.commandEncoder?.destroy(),!this.props._reuseDevices&&!this._reused){let e=g_(this.handle);e.device=null}}get isLost(){return this.gl.isContextLost()}createCanvasContext(e){throw Error(`WebGL only supports a single canvas`)}createPresentationContext(e){return new Wv(this,e||{})}createBuffer(e){let t=this._normalizeBufferProps(e);return new qv(this,t)}createTexture(e){return new yy(this,e)}createExternalTexture(e){throw Error(`createExternalTexture() not implemented`)}createSampler(e){return new py(this,e)}createShader(e){return new Qv(this,e)}createFramebuffer(e){return new Bv(this,e)}createVertexArray(e){return new nb(this,e)}createTransformFeedback(e){return new ab(this,e)}createQuerySet(e){return new sb(this,e)}createFence(){return new cb(this)}createRenderPipeline(e){return new Dy(this,e)}_createSharedRenderPipelineWebGL(e){return new Gy(this,e)}createComputePipeline(e){throw Error(`ComputePipeline not supported in WebGL`)}createCommandEncoder(e={}){return new eb(this,e)}submit(e){let t=null;e||({submittedCommandEncoder:t,commandBuffer:e}=this._finalizeDefaultCommandEncoderForSubmit());try{e._executeCommands(),t&&t.resolveTimeProfilingQuerySet().then(()=>{this.commandEncoder._gpuTimeMs=t._gpuTimeMs}).catch(()=>{})}finally{e.destroy()}}_finalizeDefaultCommandEncoderForSubmit(){let e=this.commandEncoder,t=e.finish();return this.commandEncoder.destroy(),this.commandEncoder=this.createCommandEncoder({id:e.props.id,timeProfilingQuerySet:e.getTimeProfilingQuerySet()}),{submittedCommandEncoder:e,commandBuffer:t}}readPixelsToArrayWebGL(e,t){return db(e,t)}readPixelsToBufferWebGL(e,t){return fb(e,t)}setParametersWebGL(e){W_(this.gl,e)}getParametersWebGL(e){return G_(this.gl,e)}withParametersWebGL(e,t){return my(this.gl,e,t)}resetWebGL(){M.warn(`WebGLDevice.resetWebGL is deprecated, use only for debugging`)(),K_(this.gl)}_getDeviceSpecificTextureFormatCapabilities(e){return jv(this.gl,e,this.extensions)}loseDevice(){let e=!1,t=this.getExtension(`WEBGL_lose_context`).WEBGL_lose_context;return t&&(e=!0,t.loseContext()),this._resolveContextLost?.({reason:`destroyed`,message:`Application triggered context loss`}),e}pushState(){X_.get(this.gl).push()}popState(){X_.get(this.gl).pop()}getGLKey(e,t){let n=Number(e);for(let e in this.gl)if(this.gl[e]===n)return`GL.${e}`;return t?.emptyIfUnknown?``:String(e)}getGLKeys(e){let t={emptyIfUnknown:!0};return Object.entries(e).reduce((e,[n,r])=>(e[`${n}:${this.getGLKey(n,t)}`]=`${r}:${this.getGLKey(r,t)}`,e),{})}setConstantAttributeWebGL(e,t){let n=this.limits.maxVertexAttributes;this._constants=this._constants||Array(n).fill(null);let r=this._constants[e];switch(r&&xb(r,t)&&M.info(1,`setConstantAttributeWebGL(${e}) could have been skipped, value unchanged`)(),this._constants[e]=t,t.constructor){case Float32Array:vb(this,e,t);break;case Int32Array:yb(this,e,t);break;case Uint32Array:bb(this,e,t);break;default:throw Error(`constant`)}}getExtension(e){return tv(this.gl,e,this.extensions),this.extensions}_setWebGLDebugMetadata(e,t,n){e.luma=t,e.__SPECTOR_Metadata={props:n.spector,id:n.spector.id}}};function vb(e,t,n){switch(n.length){case 1:e.gl.vertexAttrib1fv(t,n);break;case 2:e.gl.vertexAttrib2fv(t,n);break;case 3:e.gl.vertexAttrib3fv(t,n);break;case 4:e.gl.vertexAttrib4fv(t,n);break;default:}}function yb(e,t,n){e.gl.vertexAttribI4iv(t,n)}function bb(e,t,n){e.gl.vertexAttribI4uiv(t,n)}function xb(e,t){if(!e||!t||e.length!==t.length||e.constructor!==t.constructor)return!1;for(let n=0;n<e.length;++n)if(e[n]!==t[n])return!1;return!0}function Sb(e){switch(e){case`float64`:return Float64Array;case`uint8`:case`unorm8`:return Uint8ClampedArray;default:return ei(e)}}var Cb=nn.getDataType.bind(nn);function wb(e,t,n){if(t.size>4)return null;let r=n===`webgpu`&&t.type===`uint8`?`unorm8`:t.type;return{attribute:e,format:t.size>1?`${r}x${t.size}`:t.type,byteOffset:t.offset||0}}function Tb(e){return e.stride||e.size*e.bytesPerElement}function Eb(e,t){return e.type===t.type&&e.size===t.size&&Tb(e)===Tb(t)&&(e.offset||0)===(t.offset||0)}function Db(e,t){t.offset&&O.removed(`shaderAttribute.offset`,`vertexOffset, elementOffset`)();let n=Tb(e),r=t.vertexOffset===void 0?e.vertexOffset||0:t.vertexOffset,i=t.elementOffset||0,a=r*n+i*e.bytesPerElement+(e.offset||0);return{...t,offset:a,stride:n}}function Ob(e,t){let n=Db(e,t);return{high:n,low:{...n,offset:n.offset+e.size*4}}}var kb=class{constructor(e,t,n){this._buffer=null,this.device=e,this.id=t.id||``,this.size=t.size||1;let r=t.logicalType||t.type,i=r===`float64`,{defaultValue:a}=t;a=Number.isFinite(a)?[a]:a||Array(this.size).fill(0);let o;o=i?`float32`:!r&&t.isIndexed?`uint32`:r||`float32`;let s=Sb(r||o);this.doublePrecision=i,i&&t.fp64===!1&&(s=Float32Array),this.value=null,this.settings={...t,defaultType:s,defaultValue:a,logicalType:r,type:o,normalized:o.includes(`norm`),size:this.size,bytesPerElement:s.BYTES_PER_ELEMENT},this.state={...n,externalBuffer:null,bufferAccessor:this.settings,allocatedValue:null,numInstances:0,bounds:null,constant:!1}}get isConstant(){return this.state.constant}get buffer(){return this._buffer}get byteOffset(){let e=this.getAccessor();return e.vertexOffset?e.vertexOffset*Tb(e):0}get numInstances(){return this.state.numInstances}set numInstances(e){this.state.numInstances=e}delete(){this._buffer&&=(this._buffer.delete(),null),ng.release(this.state.allocatedValue)}getBuffer(){return this.state.constant?null:this.state.externalBuffer||this._buffer}getValue(e=this.id,t=null){let n={};if(this.state.constant){let r=this.value;if(t){let i=Db(this.getAccessor(),t),a=i.offset/r.BYTES_PER_ELEMENT,o=i.size||this.size;n[e]=r.subarray(a,a+o)}else n[e]=r}else n[e]=this.getBuffer();return this.doublePrecision&&(this.value instanceof Float64Array?n[`${e}64Low`]=n[e]:n[`${e}64Low`]=new Float32Array(this.size)),n}_getBufferLayout(e=this.id,t=null){let n=this.getAccessor(),r=[],i={name:this.id,byteStride:Tb(n)};if(this.doublePrecision){let i=Ob(n,t||{});r.push(wb(e,{...n,...i.high},this.device.type),wb(`${e}64Low`,{...n,...i.low},this.device.type))}else if(t){let i=Db(n,t);r.push(wb(e,{...n,...i},this.device.type))}else r.push(wb(e,n,this.device.type));return i.attributes=r.filter(Boolean),i}setAccessor(e){this.state.bufferAccessor=e}getAccessor(){return this.state.bufferAccessor}getBounds(){if(this.state.bounds)return this.state.bounds;let e=null;if(this.state.constant&&this.value){let t=Array.from(this.value);e=[t,t]}else{let{value:t,numInstances:n,size:r}=this,i=n*r;if(t&&i&&t.length>=i){let n=Array(r).fill(1/0),a=Array(r).fill(-1/0);for(let e=0;e<i;)for(let i=0;i<r;i++){let r=t[e++];r<n[i]&&(n[i]=r),r>a[i]&&(a[i]=r)}e=[n,a]}}return this.state.bounds=e,e}setData(e){let{state:t}=this,n;n=ArrayBuffer.isView(e)?{value:e}:e instanceof P?{buffer:e}:e;let r={...this.settings,...n};if(ArrayBuffer.isView(n.value)){if(!n.type)if(this.doublePrecision&&n.value instanceof Float64Array)r.type=`float32`;else{let e=Cb(n.value);r.type=r.normalized?e.replace(`int`,`norm`):e}r.bytesPerElement=n.value.BYTES_PER_ELEMENT,r.stride=Tb(r)}if(t.bounds=null,n.constant){let e=n.value;if(e=this._normalizeValue(e,[],0),this.settings.normalized&&(e=this.normalizeConstant(e)),!(!t.constant||!this._areValuesEqual(e,this.value)))return!1;t.externalBuffer=null,t.constant=!0,this.value=ArrayBuffer.isView(e)?e:new Float32Array(e)}else if(n.buffer)t.externalBuffer=n.buffer,t.constant=!1,this.value=n.value||null;else if(n.value){this._checkExternalBuffer(n);let e=n.value;t.externalBuffer=null,t.constant=!1,this.value=e;let{buffer:i}=this,a=Tb(r),o=(r.vertexOffset||0)*a;if(this.doublePrecision&&e instanceof Float64Array&&(e=dg(e,r)),this.settings.isIndexed){let t=this.settings.defaultType;e.constructor!==t&&(e=new t(e))}let s=e.byteLength+o+a*2;(!i||i.byteLength<s)&&(i=this._createBuffer(s)),i.write(e,o)}return this.setAccessor(r),!0}updateSubBuffer(e={}){this.state.bounds=null;let t=this.value,{startOffset:n=0,endOffset:r}=e;this.buffer.write(this.doublePrecision&&t instanceof Float64Array?dg(t,{size:this.size,startIndex:n,endIndex:r}):t.subarray(n,r),n*t.BYTES_PER_ELEMENT+this.byteOffset)}allocate(e,t=!1){let{state:n}=this,r=n.allocatedValue,i=ng.allocate(r,e+1,{size:this.size,type:this.settings.defaultType,copy:t});this.value=i;let{byteOffset:a}=this,{buffer:o}=this;return(!o||o.byteLength<i.byteLength+a)&&(o=this._createBuffer(i.byteLength+a),t&&r&&o.write(r instanceof Float64Array?dg(r,this):r,a)),n.allocatedValue=i,n.constant=!1,n.externalBuffer=null,this.setAccessor(this.settings),!0}_checkExternalBuffer(e){let{value:t}=e;if(!ArrayBuffer.isView(t))throw Error(`Attribute ${this.id} value is not TypedArray`);let n=this.settings.defaultType,r=!1;if(this.doublePrecision&&(r=t.BYTES_PER_ELEMENT<4),r)throw Error(`Attribute ${this.id} does not support ${t.constructor.name}`);!(t instanceof n)&&this.settings.normalized&&!(`normalized`in e)&&O.warn(`Attribute ${this.id} is normalized`)()}normalizeConstant(e){switch(this.settings.type){case`snorm8`:return new Float32Array(e).map(e=>(e+128)/255*2-1);case`snorm16`:return new Float32Array(e).map(e=>(e+32768)/65535*2-1);case`unorm8`:return new Float32Array(e).map(e=>e/255);case`unorm16`:return new Float32Array(e).map(e=>e/65535);default:return e}}_normalizeValue(e,t,n){let{defaultValue:r,size:i}=this.settings;if(Number.isFinite(e))return t[n]=e,t;if(!e){let e=i;for(;--e>=0;)t[n+e]=r[e];return t}switch(i){case 4:t[n+3]=Number.isFinite(e[3])?e[3]:r[3];case 3:t[n+2]=Number.isFinite(e[2])?e[2]:r[2];case 2:t[n+1]=Number.isFinite(e[1])?e[1]:r[1];case 1:t[n+0]=Number.isFinite(e[0])?e[0]:r[0];break;default:let a=i;for(;--a>=0;)t[n+a]=Number.isFinite(e[a])?e[a]:r[a]}return t}_areValuesEqual(e,t){if(!e||!t)return!1;let{size:n}=this;for(let r=0;r<n;r++)if(e[r]!==t[r])return!1;return!0}_createBuffer(e){this._buffer&&this._buffer.destroy();let{isIndexed:t,type:n}=this.settings;return this._buffer=this.device.createBuffer({...this._buffer?.props,id:this.id,usage:(t?P.INDEX:P.VERTEX)|P.COPY_DST,indexType:t?n:void 0,byteLength:e}),this._buffer}},Ab=[],jb=[];function Mb(e,t=0,n=1/0){let r=Ab,i={index:-1,data:e,target:[]};return e?typeof e[Symbol.iterator]==`function`?r=e:e.length>0&&(jb.length=e.length,r=jb):r=Ab,(t>0||Number.isFinite(n))&&(r=(Array.isArray(r)?r:Array.from(r)).slice(t,n),i.index=t-1),{iterable:r,objectInfo:i}}function Nb(e){return e&&e[Symbol.asyncIterator]}function Pb(e,t){let{size:n,stride:r,offset:i,startIndices:a,nested:o}=t,s=e.BYTES_PER_ELEMENT,c=r?r/s:n,l=i?i/s:0,u=Math.floor((e.length-l)/c);return(t,{index:r,target:i})=>{if(!a){let t=r*c+l;for(let r=0;r<n;r++)i[r]=e[t+r];return i}let s=a[r],d=a[r+1]||u,f;if(o){f=Array(d-s);for(let t=s;t<d;t++){let r=t*c+l;i=Array(n);for(let t=0;t<n;t++)i[t]=e[r+t];f[t-s]=i}}else if(c===n)f=e.subarray(s*n+l,d*n+l);else{f=new e.constructor((d-s)*n);let t=0;for(let r=s;r<d;r++){let i=r*c+l;for(let r=0;r<n;r++)f[t++]=e[i+r]}}return f}}var Fb=[],Ib=[[0,1/0]];function Lb(e,t){if(e===Ib||(t[0]<0&&(t[0]=0),t[0]>=t[1]))return e;let n=[],r=e.length,i=0;for(let a=0;a<r;a++){let r=e[a];r[1]<t[0]?(n.push(r),i=a+1):r[0]>t[1]?n.push(r):t=[Math.min(r[0],t[0]),Math.max(r[1],t[1])]}return n.splice(i,0,t),n}var Rb={interpolation:{duration:0,easing:e=>e},spring:{stiffness:.05,damping:.5}};function zb(e,t){if(!e)return null;Number.isFinite(e)&&(e={type:`interpolation`,duration:e});let n=e.type||`interpolation`;return{...Rb[n],...t,...e,type:n}}var Bb=class extends kb{constructor(e,t){super(e,t,{startIndices:null,lastExternalBuffer:null,binaryValue:null,binaryAccessor:null,needsUpdate:!0,needsRedraw:!1,layoutChanged:!1,updateRanges:Ib}),this.constant=!1,this.settings.update=t.update||(t.accessor?this._autoUpdater:void 0),Object.seal(this.settings),Object.seal(this.state),this._validateAttributeUpdaters()}get startIndices(){return this.state.startIndices}set startIndices(e){this.state.startIndices=e}needsUpdate(){return this.state.needsUpdate}needsRedraw({clearChangedFlags:e=!1}={}){let t=this.state.needsRedraw;return this.state.needsRedraw=t&&!e,t}layoutChanged(){return this.state.layoutChanged}setAccessor(e){var t;(t=this.state).layoutChanged||(t.layoutChanged=!Eb(e,this.getAccessor())),super.setAccessor(e)}getUpdateTriggers(){let{accessor:e}=this.settings;return[this.id].concat(typeof e!=`function`&&e||[])}supportsTransition(){return!!this.settings.transition}getTransitionSetting(e){if(!e||!this.supportsTransition())return null;let{accessor:t}=this.settings,n=this.settings.transition;return zb(Array.isArray(t)?e[t.find(t=>e[t])]:e[t],n)}setNeedsUpdate(e=this.id,t){if(this.state.needsUpdate=this.state.needsUpdate||e,this.setNeedsRedraw(e),t){let{startRow:e=0,endRow:n=1/0}=t;this.state.updateRanges=Lb(this.state.updateRanges,[e,n])}else this.state.updateRanges=Ib}clearNeedsUpdate(){this.state.needsUpdate=!1,this.state.updateRanges=Fb}setNeedsRedraw(e=this.id){this.state.needsRedraw=this.state.needsRedraw||e}allocate(e){let{state:t,settings:n}=this;return n.noAlloc?!1:n.update?(super.allocate(e,t.updateRanges!==Ib),!0):!1}updateBuffer({numInstances:e,data:t,props:n,context:r}){if(!this.needsUpdate())return!1;let{state:{updateRanges:i},settings:{update:a,noAlloc:o}}=this,s=!0;if(a){for(let[o,s]of i)a.call(r,this,{data:t,startRow:o,endRow:s,props:n,numInstances:e});if(this.value)if(this.constant||!this.buffer||this.buffer.byteLength<this.value.byteLength+this.byteOffset)this.constant?this.setConstantValue(r,this.value):this.setData({value:this.value,constant:this.constant}),this.constant=!1;else for(let[t,n]of i){let r=Number.isFinite(t)?this.getVertexOffset(t):0,i=Number.isFinite(n)?this.getVertexOffset(n):o||!Number.isFinite(e)?this.value.length:e*this.size;super.updateSubBuffer({startOffset:r,endOffset:i})}this._checkAttributeArray()}else s=!1;return this.clearNeedsUpdate(),this.setNeedsRedraw(),s}setConstantValue(e,t){if(t===void 0||typeof t==`function`)return!1;let n=this.settings.transform&&e?this.settings.transform.call(e,t):t;return this.device.type===`webgpu`?this.setConstantBufferValue(n,this.numInstances):(this.setData({constant:!0,value:n})&&this.setNeedsRedraw(),this.clearNeedsUpdate(),!0)}setConstantBufferValue(e,t){let n=this.settings.defaultType,r=this._normalizeValue(e,new n(this.size),0);if(this._hasConstantBufferValue(r,t))return this.constant=!1,this.clearNeedsUpdate(),!1;let i=new n(Math.max(t,1)*this.size);for(let e=0;e<i.length;e+=this.size)i.set(r,e);let a=this.setData({value:i});return this.constant=!1,this.clearNeedsUpdate(),a&&this.setNeedsRedraw(),a}_hasConstantBufferValue(e,t){let n=this.value,r=Math.max(t,1)*this.size;if(!ArrayBuffer.isView(n)||n.length!==r||n.length%this.size!==0)return!1;for(let t=0;t<n.length;t+=this.size)for(let r=0;r<this.size;r++)if(n[t+r]!==e[r])return!1;return!0}setExternalBuffer(e){let{state:t}=this;return e?(this.clearNeedsUpdate(),t.lastExternalBuffer===e?!0:(t.lastExternalBuffer=e,this.setNeedsRedraw(),this.setData(e),!0)):(t.lastExternalBuffer=null,!1)}setBinaryValue(e,t=null){let{state:n,settings:r}=this;if(!e)return n.binaryValue=null,n.binaryAccessor=null,!1;if(r.noAlloc)return!1;if(n.binaryValue===e)return this.clearNeedsUpdate(),!0;if(n.binaryValue=e,this.setNeedsRedraw(),r.transform||t!==this.startIndices){ArrayBuffer.isView(e)&&(e={value:e});let i=e;Sg(ArrayBuffer.isView(i.value),`invalid ${r.accessor}`);let a=!!i.size&&i.size!==this.size;return n.binaryAccessor=Pb(i.value,{size:i.size||this.size,stride:i.stride,offset:i.offset,startIndices:t,nested:a}),!1}return this.clearNeedsUpdate(),this.setData(e),!0}getVertexOffset(e){let{startIndices:t}=this;return(t?e<t.length?t[e]:this.numInstances:e)*this.size}getValue(){let e=this.settings.shaderAttributes,t=super.getValue();if(!e)return t;for(let n in e)Object.assign(t,super.getValue(n,e[n]));return t}getBufferLayout(e){this.state.layoutChanged=!1;let t=this.settings.shaderAttributes,n=super._getBufferLayout(),{stepMode:r}=this.settings;if(r===`dynamic`?n.stepMode=e?e.isInstanced?`instance`:`vertex`:`instance`:n.stepMode=r??`vertex`,!t)return n;for(let e in t){let r=super._getBufferLayout(e,t[e]);n.attributes.push(...r.attributes)}return n}_autoUpdater(e,{data:t,startRow:n,endRow:r,props:i,numInstances:a}){let{settings:o,state:s,value:c,size:l,startIndices:u}=e,{accessor:d,transform:f}=o,p=s.binaryAccessor||(typeof d==`function`?d:i[d]);Sg(typeof p==`function`,`accessor "${d}" is not a function`);let m=e.getVertexOffset(n),{iterable:h,objectInfo:g}=Mb(t,n,r);for(let t of h){g.index++;let n=p(t,g);if(f&&(n=f.call(this,n)),u){let t=(g.index<u.length-1?u[g.index+1]:a)-u[g.index];if(n&&Array.isArray(n[0])){let t=m;for(let r of n)e._normalizeValue(r,c,t),t+=l}else n&&n.length>l?c.set(n,m):(e._normalizeValue(n,g.target,0),Vf({target:c,source:g.target,start:m,count:t}));m+=t*l}else e._normalizeValue(n,c,m),m+=l}}_validateAttributeUpdaters(){let{settings:e}=this;if(!(e.noAlloc||typeof e.update==`function`))throw Error(`Attribute ${this.id} missing update or accessor`)}_checkAttributeArray(){let{value:e}=this,t=Math.min(4,this.size);if(e&&e.length>=t){let n=!0;switch(t){case 4:n&&=Number.isFinite(e[3]);case 3:n&&=Number.isFinite(e[2]);case 2:n&&=Number.isFinite(e[1]);case 1:n&&=Number.isFinite(e[0]);break;default:n=!1}if(!n)throw Error(`Illegal attribute generated for ${this.id}`)}}};function Vb(e){let{source:t,target:n,start:r=0,size:i,getData:a}=e,o=e.end||n.length,s=t.length,c=o-r;if(s>c){n.set(t.subarray(0,c),r);return}if(n.set(t,r),!a)return;let l=s;for(;l<c;){let e=a(l,t);for(let t=0;t<i;t++)n[r+l]=e[t]||0,l++}}function Hb({source:e,target:t,size:n,getData:r,sourceStartIndices:i,targetStartIndices:a}){if(!i||!a)return Vb({source:e,target:t,size:n,getData:r}),t;let o=0,s=0,c=r&&((e,t)=>r(e+s,t)),l=Math.min(i.length,a.length);for(let r=1;r<l;r++){let l=i[r]*n,u=a[r]*n;Vb({source:e.subarray(o,l),target:t,start:s,end:u,size:n,getData:c}),o=l,s=u}return s<t.length&&Vb({source:[],target:t,start:s,size:n,getData:c}),t}function Ub(e){let{device:t,settings:n,value:r}=e,i=new Bb(t,n);return i.setData({value:r instanceof Float64Array?new Float64Array:new Float32Array,normalized:n.normalized}),i}function Wb(e){switch(e){case 1:return`float`;case 2:return`vec2`;case 3:return`vec3`;case 4:return`vec4`;default:throw Error(`No defined attribute type for size "${e}"`)}}function Gb(e){switch(e){case 1:return`float32`;case 2:return`float32x2`;case 3:return`float32x3`;case 4:return`float32x4`;default:throw Error(`invalid type size`)}}function Kb(e){e.push(e.shift())}function qb(e,t){let{doublePrecision:n,settings:r,value:i,size:a}=e,o=n&&i instanceof Float64Array?2:1,s=0,{shaderAttributes:c}=e.settings;if(c)for(let e of Object.values(c))s=Math.max(s,e.vertexOffset??0);return(r.noAlloc?i.length:(t+s)*a)*o}function Jb({device:e,source:t,target:n}){return(!n||n.byteLength<t.byteLength)&&(n?.destroy(),n=e.createBuffer({byteLength:t.byteLength,usage:t.usage})),n}function Yb({device:e,buffer:t,attribute:n,fromLength:r,toLength:i,fromStartIndices:a,getData:o=e=>e}){let s=n.doublePrecision&&n.value instanceof Float64Array?2:1,c=n.size*s,l=n.byteOffset,u=n.settings.bytesPerElement<4?l/n.settings.bytesPerElement*4:l,d=n.startIndices,f=a&&d,p=n.isConstant;if(!f&&t&&r>=i)return t;let m=n.value instanceof Float64Array?Float32Array:n.value.constructor,h=p?n.value:new m(n.getBuffer().readSyncWebGL(l,i*m.BYTES_PER_ELEMENT).buffer);if(n.settings.normalized&&!p){let e=o;o=(t,r)=>n.normalizeConstant(e(t,r))}let g=p?(e,t)=>o(h,t):(e,t)=>o(h.subarray(e+l,e+l+c),t),_=t?new Float32Array(t.readSyncWebGL(u,r*4).buffer):new Float32Array,v=new Float32Array(i);return Hb({source:_,target:v,sourceStartIndices:a,targetStartIndices:d,size:c,getData:g}),(!t||t.byteLength<v.byteLength+u)&&(t?.destroy(),t=e.createBuffer({byteLength:v.byteLength+u,usage:35050})),t.write(v,u),t}var Xb=class{constructor({device:e,attribute:t,timeline:n}){this.buffers=[],this.currentLength=0,this.device=e,this.transition=new xg(n),this.attribute=t,this.attributeInTransition=Ub(t),this.currentStartIndices=t.startIndices}get inProgress(){return this.transition.inProgress}start(e,t,n=1/0){this.settings=e,this.currentStartIndices=this.attribute.startIndices,this.currentLength=qb(this.attribute,t),this.transition.start({...e,duration:n})}update(){let e=this.transition.update();return e&&this.onUpdate(),e}setBuffer(e){this.attributeInTransition.setData({buffer:e,normalized:this.attribute.settings.normalized,value:this.attributeInTransition.value})}cancel(){this.transition.cancel()}delete(){this.cancel();for(let e of this.buffers)e.destroy();this.buffers.length=0}},Zb=class extends Xb{constructor({device:e,attribute:t,timeline:n}){super({device:e,attribute:t,timeline:n}),this.type=`interpolation`,this.transform=nx(e,t)}start(e,t){let n=this.currentLength,r=this.currentStartIndices;if(super.start(e,t,e.duration),e.duration<=0){this.transition.cancel();return}let{buffers:i,attribute:a}=this;Kb(i),i[0]=Yb({device:this.device,buffer:i[0],attribute:a,fromLength:n,toLength:this.currentLength,fromStartIndices:r,getData:e.enter}),i[1]=Jb({device:this.device,source:i[0],target:i[1]}),this.setBuffer(i[1]);let{transform:o}=this,s=o.model,c=Math.floor(this.currentLength/a.size);tx(a)&&(c/=2),s.setVertexCount(c),a.isConstant?(s.setAttributes({aFrom:i[0]}),s.setConstantAttributes({aTo:a.value})):s.setAttributes({aFrom:i[0],aTo:a.getBuffer()}),o.transformFeedback.setBuffers({vCurrent:i[1]})}onUpdate(){let{duration:e,easing:t}=this.settings,{time:n}=this.transition,r=n/e;t&&(r=t(r));let{model:i}=this.transform,a={time:r};i.shaderInputs.setProps({interpolation:a}),this.transform.run({discard:!0})}delete(){super.delete(),this.transform.destroy()}},Qb={name:`interpolation`,vs:`layout(std140) uniform interpolationUniforms {
  float time;
} interpolation;
`,uniformTypes:{time:`f32`}},$b=`#version 300 es
#define SHADER_NAME interpolation-transition-vertex-shader

in ATTRIBUTE_TYPE aFrom;
in ATTRIBUTE_TYPE aTo;
out ATTRIBUTE_TYPE vCurrent;

void main(void) {
  vCurrent = mix(aFrom, aTo, interpolation.time);
  gl_Position = vec4(0.0);
}
`,ex=`#version 300 es
#define SHADER_NAME interpolation-transition-vertex-shader

in ATTRIBUTE_TYPE aFrom;
in ATTRIBUTE_TYPE aFrom64Low;
in ATTRIBUTE_TYPE aTo;
in ATTRIBUTE_TYPE aTo64Low;
out ATTRIBUTE_TYPE vCurrent;
out ATTRIBUTE_TYPE vCurrent64Low;

vec2 mix_fp64(vec2 a, vec2 b, float x) {
  vec2 range = sub_fp64(b, a);
  return sum_fp64(a, mul_fp64(range, vec2(x, 0.0)));
}

void main(void) {
  for (int i=0; i<ATTRIBUTE_SIZE; i++) {
    vec2 value = mix_fp64(vec2(aFrom[i], aFrom64Low[i]), vec2(aTo[i], aTo64Low[i]), interpolation.time);
    vCurrent[i] = value.x;
    vCurrent64Low[i] = value.y;
  }
  gl_Position = vec4(0.0);
}
`;function tx(e){return e.doublePrecision&&e.value instanceof Float64Array}function nx(e,t){let n=t.size,r=Wb(n),i=Gb(n),a=t.getBufferLayout();return tx(t)?new vd(e,{vs:ex,bufferLayout:[{name:`aFrom`,byteStride:8*n,attributes:[{attribute:`aFrom`,format:i,byteOffset:0},{attribute:`aFrom64Low`,format:i,byteOffset:4*n}]},{name:`aTo`,byteStride:8*n,attributes:[{attribute:`aTo`,format:i,byteOffset:0},{attribute:`aTo64Low`,format:i,byteOffset:4*n}]}],modules:[Ho,Qb],defines:{ATTRIBUTE_TYPE:r,ATTRIBUTE_SIZE:n},moduleSettings:{},varyings:[`vCurrent`,`vCurrent64Low`],bufferMode:35980,disableWarnings:!0}):new vd(e,{vs:$b,bufferLayout:[{name:`aFrom`,format:i},{name:`aTo`,format:a.attributes[0].format}],modules:[Qb],defines:{ATTRIBUTE_TYPE:r},varyings:[`vCurrent`],disableWarnings:!0})}var rx=class extends Xb{constructor({device:e,attribute:t,timeline:n}){super({device:e,attribute:t,timeline:n}),this.type=`spring`,this.texture=cx(e),this.framebuffer=lx(e,this.texture),this.transform=sx(e,t)}start(e,t){let n=this.currentLength,r=this.currentStartIndices;super.start(e,t);let{buffers:i,attribute:a}=this;for(let t=0;t<2;t++)i[t]=Yb({device:this.device,buffer:i[t],attribute:a,fromLength:n,toLength:this.currentLength,fromStartIndices:r,getData:e.enter});i[2]=Jb({device:this.device,source:i[0],target:i[2]}),this.setBuffer(i[1]);let{model:o}=this.transform;o.setVertexCount(Math.floor(this.currentLength/a.size)),a.isConstant?o.setConstantAttributes({aTo:a.value}):o.setAttributes({aTo:a.getBuffer()})}onUpdate(){let{buffers:e,transform:t,framebuffer:n,transition:r}=this,i=this.settings;t.model.setAttributes({aPrev:e[0],aCur:e[1]}),t.transformFeedback.setBuffers({vNext:e[2]});let a={stiffness:i.stiffness,damping:i.damping};t.model.shaderInputs.setProps({spring:a}),t.run({framebuffer:n,discard:!1,parameters:{viewport:[0,0,1,1]},clearColor:[0,0,0,0]}),Kb(e),this.setBuffer(e[1]),this.device.readPixelsToArrayWebGL(n)[0]>0||r.end()}delete(){super.delete(),this.transform.destroy(),this.texture.destroy(),this.framebuffer.destroy()}},ix={name:`spring`,vs:`layout(std140) uniform springUniforms {
  float damping;
  float stiffness;
} spring;
`,uniformTypes:{damping:`f32`,stiffness:`f32`}},ax=`#version 300 es
#define SHADER_NAME spring-transition-vertex-shader

#define EPSILON 0.00001

in ATTRIBUTE_TYPE aPrev;
in ATTRIBUTE_TYPE aCur;
in ATTRIBUTE_TYPE aTo;
out ATTRIBUTE_TYPE vNext;
out float vIsTransitioningFlag;

ATTRIBUTE_TYPE getNextValue(ATTRIBUTE_TYPE cur, ATTRIBUTE_TYPE prev, ATTRIBUTE_TYPE dest) {
  ATTRIBUTE_TYPE velocity = cur - prev;
  ATTRIBUTE_TYPE delta = dest - cur;
  ATTRIBUTE_TYPE force = delta * spring.stiffness;
  ATTRIBUTE_TYPE resistance = velocity * spring.damping;
  return force - resistance + velocity + cur;
}

void main(void) {
  bool isTransitioning = length(aCur - aPrev) > EPSILON || length(aTo - aCur) > EPSILON;
  vIsTransitioningFlag = isTransitioning ? 1.0 : 0.0;

  vNext = getNextValue(aCur, aPrev, aTo);
  gl_Position = vec4(0, 0, 0, 1);
  gl_PointSize = 100.0;
}
`,ox=`#version 300 es
#define SHADER_NAME spring-transition-is-transitioning-fragment-shader

in float vIsTransitioningFlag;

out vec4 fragColor;

void main(void) {
  if (vIsTransitioningFlag == 0.0) {
    discard;
  }
  fragColor = vec4(1.0);
}`;function sx(e,t){let n=Wb(t.size),r=Gb(t.size);return new vd(e,{vs:ax,fs:ox,bufferLayout:[{name:`aPrev`,format:r},{name:`aCur`,format:r},{name:`aTo`,format:t.getBufferLayout().attributes[0].format}],varyings:[`vNext`],modules:[ix],defines:{ATTRIBUTE_TYPE:n},parameters:{depthCompare:`always`,blendColorOperation:`max`,blendColorSrcFactor:`one`,blendColorDstFactor:`one`,blendAlphaOperation:`max`,blendAlphaSrcFactor:`one`,blendAlphaDstFactor:`one`}})}function cx(e){return e.createTexture({data:new Uint8Array(4),format:`rgba8unorm`,width:1,height:1})}function lx(e,t){return e.createFramebuffer({id:`spring-transition-is-transitioning-framebuffer`,width:1,height:1,colorAttachments:[t]})}var ux={interpolation:Zb,spring:rx},dx=class{constructor(e,{id:t,timeline:n}){if(!e)throw Error(`AttributeTransitionManager is constructed without device`);this.id=t,this.device=e,this.timeline=n,this.transitions={},this.needsRedraw=!1,this.numInstances=1}finalize(){for(let e in this.transitions)this._removeTransition(e)}update({attributes:e,transitions:t,numInstances:n}){this.numInstances=n||1;for(let n in e){let r=e[n],i=r.getTransitionSetting(t);i&&this._updateAttribute(n,r,i)}for(let n in this.transitions){let r=e[n];(!r||!r.getTransitionSetting(t))&&this._removeTransition(n)}}hasAttribute(e){let t=this.transitions[e];return t&&t.inProgress}getAttributes(){let e={};for(let t in this.transitions){let n=this.transitions[t];n.inProgress&&(e[t]=n.attributeInTransition)}return e}run(){if(this.numInstances===0)return!1;for(let e in this.transitions)this.transitions[e].update()&&(this.needsRedraw=!0);let e=this.needsRedraw;return this.needsRedraw=!1,e}_removeTransition(e){this.transitions[e].delete(),delete this.transitions[e]}_updateAttribute(e,t,n){let r=this.transitions[e],i=!r||r.type!==n.type;if(i){r&&this._removeTransition(e);let a=ux[n.type];a?this.transitions[e]=new a({attribute:t,timeline:this.timeline,device:this.device}):(O.error(`unsupported transition type '${n.type}'`)(),i=!1)}(i||t.needsRedraw())&&(this.needsRedraw=!0,this.transitions[e].start(n,this.numInstances))}},fx=`attributeManager.invalidate`,px=`attributeManager.updateStart`,mx=`attributeManager.updateEnd`,hx=`attribute.updateStart`,gx=`attribute.allocate`,_x=`attribute.updateEnd`,vx=class{constructor(e,{id:t=`attribute-manager`,stats:n,timeline:r}={}){this.mergeBoundsMemoized=kd(fg),this.id=t,this.device=e,this.attributes={},this.updateTriggers={},this.needsRedraw=!0,this.userData={},this.stats=n,this.attributeTransitionManager=new dx(e,{id:`${t}-transitions`,timeline:r}),Object.seal(this)}finalize(){for(let e in this.attributes)this.attributes[e].delete();this.attributeTransitionManager.finalize()}getNeedsRedraw(e={clearRedrawFlags:!1}){let t=this.needsRedraw;return this.needsRedraw=this.needsRedraw&&!e.clearRedrawFlags,t&&this.id}setNeedsRedraw(){this.needsRedraw=!0}add(e){this._add(e)}addInstanced(e){this._add(e,{stepMode:`instance`})}remove(e){for(let t of e)this.attributes[t]!==void 0&&(this.attributes[t].delete(),delete this.attributes[t])}invalidate(e,t){let n=this._invalidateTrigger(e,t);Rf(fx,this,e,n)}invalidateAll(e){for(let t in this.attributes)this.attributes[t].setNeedsUpdate(t,e);Rf(fx,this,`all`)}update({data:e,numInstances:t,startIndices:n=null,transitions:r,props:i={},buffers:a={},context:o={}}){let s=!1;Rf(px,this),this.stats&&this.stats.get(`Update Attributes`).timeStart();for(let r in this.attributes){let c=this.attributes[r],l=c.settings.accessor;c.startIndices=n,c.numInstances=t,i[r]&&O.removed(`props.${r}`,`data.attributes.${r}`)(),c.setExternalBuffer(a[r])||c.setBinaryValue(typeof l==`string`?a[l]:void 0,e.startIndices)||typeof l==`string`&&!a[l]&&c.setConstantValue(o,i[l])||c.needsUpdate()&&(s=!0,this._updateAttribute({attribute:c,numInstances:t,data:e,props:i,context:o})),this.needsRedraw=this.needsRedraw||c.needsRedraw()}s&&Rf(mx,this,t),this.stats&&(this.stats.get(`Update Attributes`).timeEnd(),s&&this.stats.get(`Attributes updated`).incrementCount()),this.attributeTransitionManager.update({attributes:this.attributes,numInstances:t,transitions:r})}updateTransition(){let{attributeTransitionManager:e}=this,t=e.run();return this.needsRedraw=this.needsRedraw||t,t}getAttributes(){return{...this.attributes,...this.attributeTransitionManager.getAttributes()}}getBounds(e){let t=e.map(e=>this.attributes[e]?.getBounds());return this.mergeBoundsMemoized(t)}getChangedAttributes(e={clearChangedFlags:!1}){let{attributes:t,attributeTransitionManager:n}=this,r={...n.getAttributes()};for(let i in t){let a=t[i];a.needsRedraw(e)&&!n.hasAttribute(i)&&(r[i]=a)}return r}getBufferLayouts(e){return Object.values(this.getAttributes()).map(t=>t.getBufferLayout(e))}_add(e,t){for(let n in e){let r=e[n],i={...r,id:n,size:r.isIndexed&&1||r.size||1,...t};this.attributes[n]=new Bb(this.device,i)}this._mapUpdateTriggersToAttributes()}_mapUpdateTriggersToAttributes(){let e={};for(let t in this.attributes)this.attributes[t].getUpdateTriggers().forEach(n=>{e[n]||(e[n]=[]),e[n].push(t)});this.updateTriggers=e}_invalidateTrigger(e,t){let{attributes:n,updateTriggers:r}=this,i=r[e];return i&&i.forEach(e=>{let r=n[e];r&&r.setNeedsUpdate(r.id,t)}),i}_updateAttribute(e){let{attribute:t,numInstances:n}=e;if(Rf(hx,t),t.constant){t.setConstantValue(e.context,t.value);return}t.allocate(n)&&Rf(gx,t,n),t.updateBuffer(e)&&(this.needsRedraw=!0,Rf(_x,t,n))}},yx=class extends xg{get value(){return this._value}_onUpdate(){let{time:e,settings:{fromValue:t,toValue:n,duration:r,easing:i}}=this,a=i(e/r);this._value=es(t,n,a)}},bx=1e-5;function xx(e,t,n,r,i){let a=t-e;return(n-t)*i+-a*r+a+t}function Sx(e,t,n,r,i){if(Array.isArray(n)){let a=[];for(let o=0;o<n.length;o++)a[o]=xx(e[o],t[o],n[o],r,i);return a}return xx(e,t,n,r,i)}function Cx(e,t){if(Array.isArray(e)){let n=0;for(let r=0;r<e.length;r++){let i=e[r]-t[r];n+=i*i}return Math.sqrt(n)}return Math.abs(e-t)}var wx={interpolation:yx,spring:class extends xg{get value(){return this._currValue}_onUpdate(){let{fromValue:e,toValue:t,damping:n,stiffness:r}=this.settings,{_prevValue:i=e,_currValue:a=e}=this,o=Sx(i,a,t,n,r),s=Cx(o,t),c=Cx(o,a);s<bx&&c<bx&&(o=t,this.end()),this._prevValue=a,this._currValue=o}}},Tx=class{constructor(e){this.transitions=new Map,this.timeline=e}get active(){return this.transitions.size>0}add(e,t,n,r){let{transitions:i}=this;if(i.has(e)){let n=i.get(e),{value:r=n.settings.fromValue}=n;t=r,this.remove(e)}if(r=zb(r),!r)return;let a=wx[r.type];if(!a){O.error(`unsupported transition type '${r.type}'`)();return}let o=new a(this.timeline);o.start({...r,fromValue:t,toValue:n}),i.set(e,o)}remove(e){let{transitions:t}=this;t.has(e)&&(t.get(e).cancel(),t.delete(e))}update(){let e={};for(let[t,n]of this.transitions)n.update(),e[t]=n.value,n.inProgress||this.remove(t);return e}clear(){for(let e of this.transitions.keys())this.remove(e)}};function Ex(e){let t=e[jf];for(let n in t){let r=t[n],{validate:i}=r;if(i&&!i(e[n],r))throw Error(`Invalid prop ${n}: ${e[n]}`)}}function Dx(e,t){let n=kx({newProps:e,oldProps:t,propTypes:e[jf],ignoreProps:{data:null,updateTriggers:null,extensions:null,transitions:null}}),r=jx(e,t),i=!1;return r||(i=Mx(e,t)),{dataChanged:r,propsChanged:n,updateTriggersChanged:i,extensionsChanged:Nx(e,t),transitionsChanged:Ox(e,t)}}function Ox(e,t){if(!e.transitions)return!1;let n={},r=e[jf],i=!1;for(let a in e.transitions){let o=r[a],s=o&&o.type;(s===`number`||s===`color`||s===`array`)&&Ax(e[a],t[a],o)&&(n[a]=!0,i=!0)}return i?n:!1}function kx({newProps:e,oldProps:t,ignoreProps:n={},propTypes:r={},triggerName:i=`props`}){if(t===e)return!1;if(typeof e!=`object`||!e||typeof t!=`object`||!t)return`${i} changed shallowly`;for(let a of Object.keys(e))if(!(a in n)){if(!(a in t))return`${i}.${a} added`;let n=Ax(e[a],t[a],r[a]);if(n)return`${i}.${a} ${n}`}for(let a of Object.keys(t))if(!(a in n)){if(!(a in e))return`${i}.${a} dropped`;if(!Object.hasOwnProperty.call(e,a)){let n=Ax(e[a],t[a],r[a]);if(n)return`${i}.${a} ${n}`}}return!1}function Ax(e,t,n){let r=n&&n.equal;return r&&!r(e,t,n)||!r&&(r=e&&t&&e.equals,r&&!r.call(e,t))?`changed deeply`:!r&&t!==e?`changed shallowly`:null}function jx(e,t){if(t===null)return`oldProps is null, initial diff`;let n=!1,{dataComparator:r,_dataDiff:i}=e;return r?r(e.data,t.data)||(n=`Data comparator detected a change`):e.data!==t.data&&(n=`A new data container was supplied`),n&&i&&(n=i(e.data,t.data)||n),n}function Mx(e,t){if(t===null||`all`in e.updateTriggers&&Px(e,t,`all`))return{all:!0};let n={},r=!1;for(let i in e.updateTriggers)i!==`all`&&Px(e,t,i)&&(n[i]=!0,r=!0);return r?n:!1}function Nx(e,t){if(t===null)return!0;let n=t.extensions,{extensions:r}=e;if(r===n)return!1;if(!n||!r||r.length!==n.length)return!0;for(let e=0;e<r.length;e++)if(!r[e].equals(n[e]))return!0;return!1}function Px(e,t,n){let r=e.updateTriggers[n];r??={};let i=t.updateTriggers[n];return i??={},kx({oldProps:i,newProps:r,triggerName:n})}var Fx=`count(): argument not an object`,Ix=`count(): argument not a container`;function Lx(e){if(!zx(e))throw Error(Fx);if(typeof e.count==`function`)return e.count();if(Number.isFinite(e.size))return e.size;if(Number.isFinite(e.length))return e.length;if(Rx(e))return Object.keys(e).length;throw Error(Ix)}function Rx(e){return typeof e==`object`&&!!e&&e.constructor===Object}function zx(e){return typeof e==`object`&&!!e}function Bx(e,t){if(!t)return e;let n={...e,...t};if(`defines`in t&&(n.defines={...e.defines,...t.defines}),`modules`in t&&(n.modules=(e.modules||[]).concat(t.modules),t.modules.some(e=>e.name===`project64`))){let e=n.modules.findIndex(e=>e.name===`project32`);e>=0&&n.modules.splice(e,1)}if(`inject`in t)if(!e.inject)n.inject=t.inject;else{let r={...e.inject};for(let e in t.inject)r[e]=(r[e]||``)+t.inject[e];n.inject=r}return n}var Vx=[0,0,0];function Hx(e,t,n=!1){let r=t.projectPosition(e);if(n&&t instanceof bg){let[n,i,a=0]=e;r[2]=a*t.getDistanceScales([n,i]).unitsPerMeter[2]}return r}function Ux(e){let{viewport:t,modelMatrix:n,coordinateOrigin:r}=e,{coordinateSystem:i,fromCoordinateSystem:a,fromCoordinateOrigin:o}=e;return i==="default"&&(i=t.isGeospatial?`lnglat`:`cartesian`),a===void 0?a=i:a==="default"&&(a=t.isGeospatial?`lnglat`:`cartesian`),o===void 0&&(o=r),{viewport:t,coordinateSystem:i,coordinateOrigin:r,modelMatrix:n,fromCoordinateSystem:a,fromCoordinateOrigin:o}}function Wx(e,{viewport:t,modelMatrix:n,coordinateSystem:r,coordinateOrigin:i,offsetMode:a}){let[o,s,c=0]=e;switch(n&&([o,s,c]=Bc([],[o,s,c,1],n)),r){case`default`:return Wx(e,{viewport:t,modelMatrix:n,coordinateSystem:t.isGeospatial?`lnglat`:`cartesian`,coordinateOrigin:i,offsetMode:a});case`lnglat`:return Hx([o,s,c],t,a);case`lnglat-offsets`:return Hx([o+i[0],s+i[1],c+(i[2]||0)],t,a);case`meter-offsets`:return Hx(hf(i,[o,s,c]),t,a);case`cartesian`:return t.isGeospatial?[o+i[0],s+i[1],c+i[2]]:t.projectPosition([o,s,c]);default:throw Error(`Invalid coordinateSystem: ${r}`)}}function Gx(e,t){let{viewport:n,coordinateSystem:r,coordinateOrigin:i,modelMatrix:a,fromCoordinateSystem:o,fromCoordinateOrigin:s}=Ux(t),{autoOffset:c=!0}=t,{geospatialOrigin:l=Vx,shaderCoordinateOrigin:u=Vx,offsetMode:d=!1}=c?Rd(n,r,i):{},f=Wx(e,{viewport:n,modelMatrix:a,coordinateSystem:o,coordinateOrigin:s,offsetMode:d});return d&&Gs(f,f,n.projectPosition(l||u)),f}var Kx={minFilter:`linear`,mipmapFilter:`linear`,magFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`},qx={};function Jx(e,t,n,r){if(n instanceof I)return n;n.constructor&&n.constructor.name!==`Object`&&(n={data:n});let i=null;n.compressed&&(i={minFilter:`linear`,mipmapFilter:n.data.length>1?`nearest`:`linear`});let{width:a,height:o}=n.data,s=t.createTexture({...n,sampler:{...Kx,...i,...r},mipLevels:t.getMipLevelCount(a,o)});return t.type===`webgl`?s.generateMipmapsWebGL():t.type===`webgpu`&&t.generateMipmapsWebGPU(s),qx[s.id]=e,s}function Yx(e,t){!t||!(t instanceof I)||qx[t.id]===e&&(t.delete(),delete qx[t.id])}var Xx={boolean:{validate(e,t){return!0},equal(e,t,n){return!!e==!!t}},number:{validate(e,t){return Number.isFinite(e)&&(!(`max`in t)||e<=t.max)&&(!(`min`in t)||e>=t.min)}},color:{validate(e,t){return t.optional&&!e||eS(e)&&(e.length===3||e.length===4)},equal(e,t,n){return yg(e,t,1)}},accessor:{validate(e,t){let n=tS(e);return n===`function`||n===tS(t.value)},equal(e,t,n){return typeof t==`function`?!0:yg(e,t,1)}},array:{validate(e,t){return t.optional&&!e||eS(e)},equal(e,t,n){let{compare:r}=n;return r?yg(e,t,Number.isInteger(r)?r:+!!r):e===t}},object:{equal(e,t,n){if(n.ignore)return!0;let{compare:r}=n;return r?yg(e,t,Number.isInteger(r)?r:+!!r):e===t}},function:{validate(e,t){return t.optional&&!e||typeof e==`function`},equal(e,t,n){return!n.compare&&n.ignore!==!1||e===t}},data:{transform:(e,t,n)=>{if(!e)return e;let{dataTransform:r}=n.props;return r?r(e):typeof e.shape==`string`&&e.shape.endsWith(`-table`)&&Array.isArray(e.data)?e.data:e}},image:{transform:(e,t,n)=>{let r=n.context;return!r||!r.device?null:Jx(n.id,r.device,e,{...t.parameters,...n.props.textureParameters})},release:(e,t,n)=>{Yx(n.id,e)}}};function Zx(e){let t={},n={},r={};for(let[i,a]of Object.entries(e)){let e=a?.deprecatedFor;if(e)r[i]=Array.isArray(e)?e:[e];else{let e=Qx(i,a);t[i]=e,n[i]=e.value}}return{propTypes:t,defaultProps:n,deprecatedProps:r}}function Qx(e,t){switch(tS(t)){case`object`:return $x(e,t);case`array`:return $x(e,{type:`array`,value:t,compare:!1});case`boolean`:return $x(e,{type:`boolean`,value:t});case`number`:return $x(e,{type:`number`,value:t});case`function`:return $x(e,{type:`function`,value:t,compare:!0});default:return{name:e,type:`unknown`,value:t}}}function $x(e,t){return`type`in t?{name:e,...Xx[t.type],...t}:`value`in t?{name:e,type:tS(t.value),...t}:{name:e,type:`object`,value:t}}function eS(e){return Array.isArray(e)||ArrayBuffer.isView(e)}function tS(e){return eS(e)?`array`:e===null?`null`:typeof e}function nS(e,t){let n;for(let e=t.length-1;e>=0;e--){let r=t[e];`extensions`in r&&(n=r.extensions)}let r=iS(e.constructor,n),i=Object.create(r);i[Af]=e,i[Pf]={},i[Ff]={};for(let e=0;e<t.length;++e){let n=t[e];for(let e in n)i[e]=n[e]}return Object.freeze(i),i}var rS=`_mergedDefaultProps`;function iS(e,t){if(!(e instanceof mS.constructor))return{};let n=rS;if(t)for(let e of t){let t=e.constructor;t&&(n+=`:${t.extensionName||t.name}`)}return dS(e,n)||(e[n]=aS(e,t||[]))}function aS(e,t){if(!e.prototype)return null;let n=iS(Object.getPrototypeOf(e)),r=Zx(dS(e,`defaultProps`)||{}),i=Object.assign(Object.create(null),n,r.defaultProps),a=Object.assign(Object.create(null),n?.[jf],r.propTypes),o=Object.assign(Object.create(null),n?.[Mf],r.deprecatedProps);for(let e of t){let t=iS(e.constructor);t&&(Object.assign(i,t),Object.assign(a,t[jf]),Object.assign(o,t[Mf]))}return oS(i,e),cS(i,a),sS(i,o),i[jf]=a,i[Mf]=o,t.length===0&&!uS(e,`_propTypes`)&&(e._propTypes=a),i}function oS(e,t){let n=fS(t);Object.defineProperties(e,{id:{writable:!0,value:n}})}function sS(e,t){for(let n in t)Object.defineProperty(e,n,{enumerable:!1,set(e){let r=`${this.id}: ${n}`;for(let r of t[n])uS(this,r)||(this[r]=e);O.deprecated(r,t[n].join(`/`))()}})}function cS(e,t){let n={},r={};for(let e in t){let i=t[e],{name:a,value:o}=i;i.async&&(n[a]=o,r[a]=lS(a))}e[Nf]=n,e[Pf]={},Object.defineProperties(e,r)}function lS(e){return{enumerable:!0,set(t){typeof t==`string`||t instanceof Promise||Nb(t)?this[Pf][e]=t:this[Ff][e]=t},get(){if(this[Ff]){if(e in this[Ff])return this[Ff][e]||this[Nf][e];if(e in this[Pf]){let t=this[Af]&&this[Af].internalState;if(t&&t.hasAsyncProp(e))return t.getAsyncProp(e)||this[Nf][e]}}return this[Nf][e]}}}function uS(e,t){return Object.prototype.hasOwnProperty.call(e,t)}function dS(e,t){return uS(e,t)&&e[t]}function fS(e){let t=e.componentName;return t||O.warn(`${e.name}.componentName not specified`)(),t||e.name}var pS=0,mS=class{constructor(...e){this.props=nS(this,e),this.id=this.props.id,this.count=pS++}clone(e){let{props:t}=this,n={};for(let e in t[Nf])e in t[Ff]?n[e]=t[Ff][e]:e in t[Pf]&&(n[e]=t[Pf][e]);return new this.constructor({...t,...n,...e})}};mS.componentName=`Component`,mS.defaultProps={};var hS=Object.freeze({}),gS=class{constructor(e){this.component=e,this.asyncProps={},this.onAsyncPropUpdated=()=>{},this.oldProps=null,this.oldAsyncProps=null}finalize(){for(let e in this.asyncProps){let t=this.asyncProps[e];t&&t.type&&t.type.release&&t.type.release(t.resolvedValue,t.type,this.component)}this.asyncProps={},this.component=null,this.resetOldProps()}getOldProps(){return this.oldAsyncProps||this.oldProps||hS}resetOldProps(){this.oldAsyncProps=null,this.oldProps=this.component?this.component.props:null}hasAsyncProp(e){return e in this.asyncProps}getAsyncProp(e){let t=this.asyncProps[e];return t&&t.resolvedValue}isAsyncPropLoading(e){if(e){let t=this.asyncProps[e];return!!(t&&t.pendingLoadCount>0&&t.pendingLoadCount!==t.resolvedLoadCount)}for(let e in this.asyncProps)if(this.isAsyncPropLoading(e))return!0;return!1}reloadAsyncProp(e,t){this._watchPromise(e,Promise.resolve(t))}setAsyncProps(e){this.component=e[Af]||this.component;let t=e[Ff]||{},n=e[Pf]||e,r=e[Nf]||{};for(let e in t){let n=t[e];this._createAsyncPropData(e,r[e]),this._updateAsyncProp(e,n),t[e]=this.getAsyncProp(e)}for(let e in n){let t=n[e];this._createAsyncPropData(e,r[e]),this._updateAsyncProp(e,t)}}_fetch(e,t){return null}_onResolve(e,t){}_onError(e,t){}_updateAsyncProp(e,t){if(this._didAsyncInputValueChange(e,t)){if(typeof t==`string`&&(t=this._fetch(e,t)),t instanceof Promise){this._watchPromise(e,t);return}if(Nb(t)){this._resolveAsyncIterable(e,t);return}this._setPropValue(e,t)}}_freezeAsyncOldProps(){if(!this.oldAsyncProps&&this.oldProps){this.oldAsyncProps=Object.create(this.oldProps);for(let e in this.asyncProps)Object.defineProperty(this.oldAsyncProps,e,{enumerable:!0,value:this.oldProps[e]})}}_didAsyncInputValueChange(e,t){let n=this.asyncProps[e];return t===n.resolvedValue||t===n.lastValue?!1:(n.lastValue=t,!0)}_setPropValue(e,t){this._freezeAsyncOldProps();let n=this.asyncProps[e];n&&(t=this._postProcessValue(n,t),n.resolvedValue=t,n.pendingLoadCount++,n.resolvedLoadCount=n.pendingLoadCount)}_setAsyncPropValue(e,t,n){let r=this.asyncProps[e];r&&n>=r.resolvedLoadCount&&t!==void 0&&(this._freezeAsyncOldProps(),r.resolvedValue=t,r.resolvedLoadCount=n,this.onAsyncPropUpdated(e,t))}_watchPromise(e,t){let n=this.asyncProps[e];if(n){n.pendingLoadCount++;let r=n.pendingLoadCount;t.then(t=>{this.component&&(t=this._postProcessValue(n,t),this._setAsyncPropValue(e,t,r),this._onResolve(e,t))}).catch(t=>{this._onError(e,t)})}}async _resolveAsyncIterable(e,t){if(e!==`data`){this._setPropValue(e,t);return}let n=this.asyncProps[e];if(!n)return;n.pendingLoadCount++;let r=n.pendingLoadCount,i=[],a=0;for await(let n of t){if(!this.component)return;let{dataTransform:t}=this.component.props;i=t?t(n,i):i.concat(n),Object.defineProperty(i,"__diff",{enumerable:!1,value:[{startRow:a,endRow:i.length}]}),a=i.length,this._setAsyncPropValue(e,i,r)}this._onResolve(e,i)}_postProcessValue(e,t){let n=e.type;return n&&this.component&&(n.release&&n.release(e.resolvedValue,n,this.component),n.transform)?n.transform(t,n,this.component):t}_createAsyncPropData(e,t){if(!this.asyncProps[e]){let n=this.component&&this.component.props[jf];this.asyncProps[e]={type:n&&n[e],lastValue:null,resolvedValue:t,pendingLoadCount:0,resolvedLoadCount:0}}}},_S=class extends gS{constructor({attributeManager:e,layer:t}){super(t),this.attributeManager=e,this.needsRedraw=!0,this.needsUpdate=!0,this.subLayers=null,this.usesPickingColorCache=!1}get layer(){return this.component}_fetch(e,t){let n=this.layer,r=n?.props.fetch;return r?r(t,{propName:e,layer:n}):super._fetch(e,t)}_onResolve(e,t){let n=this.layer;if(n){let r=n.props.onDataLoad;e===`data`&&r&&r(t,{propName:e,layer:n})}}_onError(e,t){let n=this.layer;n&&n.raiseError(t,`loading ${e} of ${this.layer}`)}},vS=`layer.changeFlag`,yS=`layer.initialize`,bS=`layer.update`,xS=`layer.finalize`,SS=`layer.matched`,CS=2**24-1,wS=Object.freeze([]),TS=kd(({oldViewport:e,viewport:t})=>e.equals(t)),ES=new Uint8ClampedArray,DS={data:{type:`data`,value:wS,async:!0},dataComparator:{type:`function`,value:null,optional:!0},_dataDiff:{type:`function`,value:e=>e&&e.__diff,optional:!0},dataTransform:{type:`function`,value:null,optional:!0},onDataLoad:{type:`function`,value:null,optional:!0},onError:{type:`function`,value:null,optional:!0},fetch:{type:`function`,value:(e,{propName:t,layer:n,loaders:r,loadOptions:i,signal:a})=>{let{resourceManager:o}=n.context;i||=n.getLoadOptions(),r||=n.props.loaders,a&&(i={...i,core:{...i?.core,fetch:{...i?.core?.fetch,signal:a}}});let s=o.contains(e);return!s&&!i&&(o.add({resourceId:e,data:tg(e,r),persistent:!1}),s=!0),s?o.subscribe({resourceId:e,onChange:e=>n.internalState?.reloadAsyncProp(t,e),consumerId:n.id,requestId:t}):tg(e,r,i)}},updateTriggers:{},visible:!0,pickable:!1,opacity:{type:`number`,min:0,max:1,value:1},operation:`draw`,onHover:{type:`function`,value:null,optional:!0},onClick:{type:`function`,value:null,optional:!0},onDragStart:{type:`function`,value:null,optional:!0},onDrag:{type:`function`,value:null,optional:!0},onDragEnd:{type:`function`,value:null,optional:!0},coordinateSystem:`default`,coordinateOrigin:{type:`array`,value:[0,0,0],compare:!0},modelMatrix:{type:`array`,value:null,compare:!0,optional:!0},wrapLongitude:!1,positionFormat:`XYZ`,colorFormat:`RGBA`,parameters:{type:`object`,value:{},optional:!0,compare:2},loadOptions:{type:`object`,value:null,optional:!0,ignore:!0},transitions:null,extensions:[],loaders:{type:`array`,value:[],optional:!0,ignore:!0},getPolygonOffset:{type:`function`,value:({layerIndex:e})=>[0,-e*100]},highlightedObjectIndex:null,autoHighlight:!1,highlightColor:{type:`accessor`,value:[0,0,128,128]}},OS=class extends mS{constructor(){super(...arguments),this.internalState=null,this.lifecycle=kf.NO_STATE,this.parent=null}static get componentName(){return Object.prototype.hasOwnProperty.call(this,`layerName`)?this.layerName:``}get root(){let e=this;for(;e.parent;)e=e.parent;return e}toString(){return`${this.constructor.layerName||this.constructor.name}({id: '${this.props.id}'})`}project(e){Sg(this.internalState);let t=this.internalState.viewport||this.context.viewport,[n,r,i]=bf(Wx(e,{viewport:t,modelMatrix:this.props.modelMatrix,coordinateOrigin:this.props.coordinateOrigin,coordinateSystem:this.props.coordinateSystem}),t.pixelProjectionMatrix);return e.length===2?[n,r]:[n,r,i]}unproject(e){return Sg(this.internalState),(this.internalState.viewport||this.context.viewport).unproject(e)}projectPosition(e,t){return Sg(this.internalState),Gx(e,{viewport:this.internalState.viewport||this.context.viewport,modelMatrix:this.props.modelMatrix,coordinateOrigin:this.props.coordinateOrigin,coordinateSystem:this.props.coordinateSystem,...t})}get isComposite(){return!1}get isDrawable(){return!0}setState(e){this.setChangeFlags({stateChanged:!0}),Object.assign(this.state,e),this.setNeedsRedraw()}setNeedsRedraw(){this.internalState&&(this.internalState.needsRedraw=!0)}setNeedsUpdate(){this.internalState&&(this.context.layerManager.setNeedsUpdate(String(this)),this.internalState.needsUpdate=!0)}get isLoaded(){return this.internalState?!this.internalState.isAsyncPropLoading():!1}get wrapLongitude(){return this.props.wrapLongitude}isPickable(){return this.props.pickable&&this.props.visible}getModels(){let e=this.state;return e&&(e.models||e.model&&[e.model])||[]}setShaderModuleProps(...e){for(let t of this.getModels())t.shaderInputs.setProps(...e)}getAttributeManager(){return this.internalState&&this.internalState.attributeManager}getCurrentLayer(){return this.internalState&&this.internalState.layer}getLoadOptions(){return this.props.loadOptions}use64bitPositions(){let{coordinateSystem:e}=this.props;return e==="default"||e===`lnglat`||e===`cartesian`}onHover(e,t){return this.props.onHover&&this.props.onHover(e,t)||!1}onClick(e,t){return this.props.onClick&&this.props.onClick(e,t)||!1}nullPickingColor(){return[0,0,0]}encodePickingColor(e,t=[]){return t[0]=e+1&255,t[1]=e+1>>8&255,t[2]=e+1>>8>>8&255,t}decodePickingColor(e){Sg(e instanceof Uint8Array);let[t,n,r]=e;return t+n*256+r*65536-1}getNumInstances(){return Number.isFinite(this.props.numInstances)?this.props.numInstances:this.state&&this.state.numInstances!==void 0?this.state.numInstances:Lx(this.props.data)}getStartIndices(){return this.props.startIndices?this.props.startIndices:this.state&&this.state.startIndices?this.state.startIndices:null}getBounds(){return this.getAttributeManager()?.getBounds([`positions`,`instancePositions`])}getShaders(e){e=Bx(e,{disableWarnings:!0,modules:this.context.defaultShaderModules});for(let t of this.props.extensions)e=Bx(e,t.getShaders.call(this,t));return e}shouldUpdateState(e){return e.changeFlags.propsOrDataChanged}updateState(e){let t=this.getAttributeManager(),{dataChanged:n}=e.changeFlags;if(n&&t)if(Array.isArray(n))for(let e of n)t.invalidateAll(e);else t.invalidateAll();if(t){let{props:n}=e,r=this.internalState.hasPickingBuffer,i=Number.isInteger(n.highlightedObjectIndex)||!!n.pickable||n.extensions.some(e=>e.getNeedsPickingBuffer.call(this,e));if(r!==i){this.internalState.hasPickingBuffer=i;let{pickingColors:e,instancePickingColors:n}=t.attributes,r=e||n;r&&(i&&r.constant&&(r.constant=!1,t.invalidate(r.id)),!r.value&&!i&&(r.constant=!0,r.value=[0,0,0]))}}}finalizeState(e){for(let e of this.getModels())e.destroy();let t=this.getAttributeManager();t&&t.finalize(),this.context&&this.context.resourceManager.unsubscribe({consumerId:this.id}),this.internalState&&(this.internalState.uniformTransitions.clear(),this.internalState.finalize())}draw(e){for(let t of this.getModels())t.draw(e.renderPass)}getPickingInfo({info:e,mode:t,sourceLayer:n}){let{index:r}=e;return r>=0&&Array.isArray(this.props.data)&&(e.object=this.props.data[r]),e}raiseError(e,t){t&&(e=Error(`${t}: ${e.message}`,{cause:e})),this.props.onError?.(e)||this.context?.onError?.(e,this)}getNeedsRedraw(e={clearRedrawFlags:!1}){return this._getNeedsRedraw(e)}needsUpdate(){return this.internalState?this.internalState.needsUpdate||this.hasUniformTransition()||this.shouldUpdateState(this._getUpdateParams()):!1}hasUniformTransition(){return this.internalState?.uniformTransitions.active||!1}activateViewport(e){if(!this.internalState)return;let t=this.internalState.viewport;this.internalState.viewport=e,(!t||!TS({oldViewport:t,viewport:e}))&&(this.setChangeFlags({viewportChanged:!0}),this.isComposite?this.needsUpdate()&&this.setNeedsUpdate():this._update())}invalidateAttribute(e=`all`){let t=this.getAttributeManager();t&&(e===`all`?t.invalidateAll():t.invalidate(e))}updateAttributes(e){let t=!1;for(let n in e)e[n].layoutChanged()&&(t=!0);for(let n of this.getModels())this._setModelAttributes(n,e,t)}_updateAttributes(){let e=this.getAttributeManager();if(!e)return;let t=this.props,n=this.getNumInstances(),r=this.getStartIndices();e.update({data:t.data,numInstances:n,startIndices:r,props:t,transitions:t.transitions,buffers:t.data.attributes,context:this});let i=e.getChangedAttributes({clearChangedFlags:!0});this.updateAttributes(i)}_updateAttributeTransition(){let e=this.getAttributeManager();e&&e.updateTransition()}_updateUniformTransition(){let{uniformTransitions:e}=this.internalState;if(e.active){let t=e.update(),n=Object.create(this.props);for(let e in t)Object.defineProperty(n,e,{value:t[e]});return n}return this.props}calculateInstancePickingColors(e,{numInstances:t}){if(e.constant)return;let n=Math.floor(ES.length/4);this.internalState.usesPickingColorCache=!0;let r=t>0&&ES[0]===0;if(n<t||r){t>CS&&O.warn(`Layer has too many data objects. Picking might not be able to distinguish all objects.`)(),ES=ng.allocate(ES,t,{size:4,copy:!0,maxCount:Math.max(t,CS)});let e=Math.floor(ES.length/4),i=[0,0,0],a=r?0:n;for(let t=a;t<e;t++)this.encodePickingColor(t,i),ES[t*4+0]=i[0],ES[t*4+1]=i[1],ES[t*4+2]=i[2],ES[t*4+3]=0}e.value=ES.subarray(0,t*4)}_setModelAttributes(e,t,n=!1){if(!Object.keys(t).length)return;if(n){let n=this.getAttributeManager();e.setBufferLayout(n.getBufferLayouts(e)),t=n.getAttributes()}let r=e.userData?.excludeAttributes||{},i={},a={};for(let n in t){if(r[n])continue;let o=t[n].getValue();for(let r in o){let s=o[r];s instanceof P?t[n].settings.isIndexed?e.setIndexBuffer(s):i[r]=s:s&&(a[r]=s)}}e.setAttributes(i),e.setConstantAttributes(a)}disablePickingIndex(e){let t=this.props.data;if(!(`attributes`in t)){this._disablePickingIndex(e);return}let{pickingColors:n,instancePickingColors:r}=this.getAttributeManager().attributes,i=n||r,a=i&&t.attributes&&t.attributes[i.id];if(a&&a.value){let n=a.value,r=this.encodePickingColor(e);for(let e=0;e<t.length;e++){let t=i.getVertexOffset(e);n[t]===r[0]&&n[t+1]===r[1]&&n[t+2]===r[2]&&this._disablePickingIndex(e)}}else this._disablePickingIndex(e)}_disablePickingIndex(e){let{pickingColors:t,instancePickingColors:n}=this.getAttributeManager().attributes,r=t||n;if(!r)return;let i=r.getVertexOffset(e),a=r.getVertexOffset(e+1);r.buffer.write(new Uint8Array(a-i),i)}restorePickingColors(){let{pickingColors:e,instancePickingColors:t}=this.getAttributeManager().attributes,n=e||t;n&&(this.internalState.usesPickingColorCache&&n.value.buffer!==ES.buffer&&(n.value=ES.subarray(0,n.value.length)),n.updateSubBuffer({startOffset:0}))}_initialize(){Sg(!this.internalState),Rf(yS,this);let e=this._getAttributeManager();e&&e.addInstanced({instancePickingColors:{type:`uint8`,size:4,noAlloc:!0,update:this.calculateInstancePickingColors}}),this.internalState=new _S({attributeManager:e,layer:this}),this._clearChangeFlags(),this.state={},Object.defineProperty(this.state,"attributeManager",{get:()=>(O.deprecated(`layer.state.attributeManager`,`layer.getAttributeManager()`)(),e)}),this.internalState.uniformTransitions=new Tx(this.context.timeline),this.internalState.onAsyncPropUpdated=this._onAsyncPropUpdated.bind(this),this.internalState.setAsyncProps(this.props),this.initializeState(this.context);for(let e of this.props.extensions)e.initializeState.call(this,this.context,e);this.setChangeFlags({dataChanged:`init`,propsChanged:`init`,viewportChanged:!0,extensionsChanged:!0}),this._update()}_transferState(e){Rf(SS,this,this===e);let{state:t,internalState:n}=e;this!==e&&(this.internalState=n,this.state=t,this.internalState.setAsyncProps(this.props),this._diffProps(this.props,this.internalState.getOldProps()))}_update(){let e=this.needsUpdate();if(Rf(bS,this,e),!e)return;this.context.stats.get(`Layer updates`).incrementCount();let t=this.props,n=this.context,r=this.internalState,i=n.viewport,a=this._updateUniformTransition();r.propsInTransition=a,n.viewport=r.viewport||i,this.props=a;try{let e=this._getUpdateParams(),t=this.getModels();if(n.device)this.updateState(e);else try{this.updateState(e)}catch{}for(let t of this.props.extensions)t.updateState.call(this,e,t);this.setNeedsRedraw(),this._updateAttributes();let r=this.getModels()[0]!==t[0];this._postUpdate(e,r)}finally{n.viewport=i,this.props=t,this._clearChangeFlags(),r.needsUpdate=!1,r.resetOldProps()}}_finalize(){Rf(xS,this),this.finalizeState(this.context);for(let e of this.props.extensions)e.finalizeState.call(this,this.context,e)}_drawLayer({renderPass:e,shaderModuleProps:t=null,uniforms:n={},parameters:r={}}){this._updateAttributeTransition();let i=this.props,a=this.context;this.props=this.internalState.propsInTransition||i;try{t&&this.setShaderModuleProps(t);let{getPolygonOffset:i}=this.props,o=i&&i(n)||[0,0];a.device instanceof _b&&a.device.setParametersWebGL({polygonOffset:o});let s=a.device instanceof _b?null:kS(r);if(AS(this.getModels(),e,r,s),a.device instanceof _b)a.device.withParametersWebGL(r,()=>{let i={renderPass:e,shaderModuleProps:t,uniforms:n,parameters:r,context:a};for(let e of this.props.extensions)e.draw.call(this,i,e);this.draw(i)});else{s?.renderPassParameters&&e.setParameters(s.renderPassParameters);let i={renderPass:e,shaderModuleProps:t,uniforms:n,parameters:r,context:a};for(let e of this.props.extensions)e.draw.call(this,i,e);this.draw(i)}}finally{this.props=i}}getChangeFlags(){return this.internalState?.changeFlags}setChangeFlags(e){if(!this.internalState)return;let{changeFlags:t}=this.internalState;for(let n in e)if(e[n]){let r=!1;switch(n){case`dataChanged`:let i=e[n],a=t[n];i&&Array.isArray(a)&&(t.dataChanged=Array.isArray(i)?a.concat(i):i,r=!0);default:t[n]||(t[n]=e[n],r=!0)}r&&Rf(vS,this,n,e)}let n=!!(t.dataChanged||t.updateTriggersChanged||t.propsChanged||t.extensionsChanged);t.propsOrDataChanged=n,t.somethingChanged=n||t.viewportChanged||t.stateChanged}_clearChangeFlags(){this.internalState.changeFlags={dataChanged:!1,propsChanged:!1,updateTriggersChanged:!1,viewportChanged:!1,stateChanged:!1,extensionsChanged:!1,propsOrDataChanged:!1,somethingChanged:!1}}_diffProps(e,t){let n=Dx(e,t);if(n.updateTriggersChanged)for(let e in n.updateTriggersChanged)n.updateTriggersChanged[e]&&this.invalidateAttribute(e);if(n.transitionsChanged)for(let r in n.transitionsChanged)this.internalState.uniformTransitions.add(r,t[r],e[r],e.transitions?.[r]);return this.setChangeFlags(n)}validateProps(){Ex(this.props)}updateAutoHighlight(e){this.props.autoHighlight&&!Number.isInteger(this.props.highlightedObjectIndex)&&this._updateAutoHighlight(e)}_updateAutoHighlight(e){let t={highlightedObjectColor:e.picked?e.color:null},{highlightColor:n}=this.props;e.picked&&typeof n==`function`&&(t.highlightColor=n(e)),this.setShaderModuleProps({picking:t}),this.setNeedsRedraw()}_getAttributeManager(){let e=this.context;return new vx(e.device,{id:this.props.id,stats:e.stats,timeline:e.timeline})}_postUpdate(e,t){let{props:n,oldProps:r}=e,i=this.state.model;i?.isInstanced&&i.setInstanceCount(this.getNumInstances());let{autoHighlight:a,highlightedObjectIndex:o,highlightColor:s}=n;if(t||r.autoHighlight!==a||r.highlightedObjectIndex!==o||r.highlightColor!==s){let e={};Array.isArray(s)&&(e.highlightColor=s),(t||r.autoHighlight!==a||o!==r.highlightedObjectIndex)&&(e.highlightedObjectColor=Number.isFinite(o)&&o>=0?this.encodePickingColor(o):null),this.setShaderModuleProps({picking:e})}}_getUpdateParams(){return{props:this.props,oldProps:this.internalState.getOldProps(),context:this.context,changeFlags:this.internalState.changeFlags}}_getNeedsRedraw(e){if(!this.internalState)return!1;let t=!1;t||=this.internalState.needsRedraw&&this.id;let n=this.getAttributeManager(),r=n?n.getNeedsRedraw(e):!1;if(t||=r,t)for(let e of this.props.extensions)e.onNeedsRedraw.call(this,e);return this.internalState.needsRedraw=this.internalState.needsRedraw&&!e.clearRedrawFlags,t}_onAsyncPropUpdated(){this._diffProps(this.props,this.internalState.getOldProps()),this.setNeedsUpdate()}};OS.defaultProps=DS,OS.layerName=`Layer`;function kS(e){let{blendConstant:t,...n}=e;return t?{pipelineParameters:n,renderPassParameters:{blendConstant:t}}:{pipelineParameters:n}}function AS(e,t,n,r){for(let i of e)i.device.type===`webgpu`?(jS(i,t),i.setParameters({...i.parameters,...r?.pipelineParameters})):i.setParameters(n)}function jS(e,t){let n=t.props.framebuffer||(t.framebuffer??null);if(!n)return;let r=n.colorAttachments.map(e=>e?.texture?.format??null),i=n.depthStencilAttachment?.texture?.format,a=e;(!MS(a.props.colorAttachmentFormats,r)||a.props.depthStencilAttachmentFormat!==i)&&(a.props.colorAttachmentFormats=r,a.props.depthStencilAttachmentFormat=i,a._setPipelineNeedsUpdate(`attachment formats`))}function MS(e,t){if(e===t)return!0;if(!e||!t||e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}var NS=`compositeLayer.renderLayers`,PS=class extends OS{get isComposite(){return!0}get isDrawable(){return!1}get isLoaded(){return super.isLoaded&&this.getSubLayers().every(e=>e.isLoaded)}getSubLayers(){return this.internalState&&this.internalState.subLayers||[]}initializeState(e){}setState(e){super.setState(e),this.setNeedsUpdate()}getPickingInfo({info:e}){let{object:t}=e;return t&&t.__source&&t.__source.parent&&t.__source.parent.id===this.id?(e.object=t.__source.object,e.index=t.__source.index,e):e}filterSubLayer(e){return!0}shouldRenderSubLayer(e,t){return t&&t.length}getSubLayerClass(e,t){let{_subLayerProps:n}=this.props;return n&&n[e]&&n[e].type||t}getSubLayerRow(e,t,n){return e.__source={parent:this,object:t,index:n},e}getSubLayerAccessor(e){if(typeof e==`function`){let t={index:-1,data:this.props.data,target:[]};return(n,r)=>n&&n.__source?(t.index=n.__source.index,e(n.__source.object,t)):e(n,r)}return e}getSubLayerProps(e={}){let{opacity:t,pickable:n,visible:r,parameters:i,getPolygonOffset:a,highlightedObjectIndex:o,autoHighlight:s,highlightColor:c,coordinateSystem:l,coordinateOrigin:u,wrapLongitude:d,positionFormat:f,modelMatrix:p,extensions:m,fetch:h,operation:g,_subLayerProps:_}=this.props,v={id:``,updateTriggers:{},opacity:t,pickable:n,visible:r,parameters:i,getPolygonOffset:a,highlightedObjectIndex:o,autoHighlight:s,highlightColor:c,coordinateSystem:l,coordinateOrigin:u,wrapLongitude:d,positionFormat:f,modelMatrix:p,extensions:m,fetch:h,operation:g},y=_&&e.id&&_[e.id],b=y&&y.updateTriggers,x=e.id||`sublayer`;if(y){let t=this.props[jf],n=e.type?e.type._propTypes:{};for(let e in y){let r=n[e]||t[e];r&&r.type===`accessor`&&(y[e]=this.getSubLayerAccessor(y[e]))}}Object.assign(v,e,y),v.id=`${this.props.id}-${x}`,v.updateTriggers={all:this.props.updateTriggers?.all,...e.updateTriggers,...b};for(let e of m){let t=e.getSubLayerProps.call(this,e);t&&Object.assign(v,t,{updateTriggers:Object.assign(v.updateTriggers,t.updateTriggers)})}return v}_updateAutoHighlight(e){for(let t of this.getSubLayers())t.updateAutoHighlight(e)}_getAttributeManager(){return null}_postUpdate(e,t){let n=this.internalState.subLayers,r=!n||this.needsUpdate();r&&(n=zf(this.renderLayers(),Boolean),this.internalState.subLayers=n),Rf(NS,this,r,n);for(let e of n)e.parent=this}};PS.layerName=`CompositeLayer`;var FS=class{static get componentName(){return Object.prototype.hasOwnProperty.call(this,`extensionName`)?this.extensionName:``}constructor(e){e&&(this.opts=e)}equals(e){return this===e?!0:this.constructor===e.constructor&&yg(this.opts,e.opts,1)}getShaders(e){return null}getSubLayerProps(e){let{defaultProps:t}=e.constructor,n={updateTriggers:{}};for(let e in t)if(e in this.props){let r=t[e],i=this.props[e];n[e]=i,r&&r.type===`accessor`&&(n.updateTriggers[e]=this.props.updateTriggers[e],typeof i==`function`&&(n[e]=this.getSubLayerAccessor(i)))}return n}initializeState(e,t){}updateState(e,t){}onNeedsRedraw(e){}getNeedsPickingBuffer(e){return!1}draw(e,t){}finalizeState(e,t){}};FS.defaultProps={},FS.extensionName=`LayerExtension`;var IS=`layout(std140) uniform pointCloudUniforms {
  float radiusPixels;
  highp int sizeUnits;
} pointCloud;
`,LS={name:`pointCloud`,source:``,vs:IS,fs:IS,uniformTypes:{radiusPixels:`f32`,sizeUnits:`i32`}},RS=`#version 300 es
#define SHADER_NAME point-cloud-layer-vertex-shader
in vec3 positions;
in vec3 instanceNormals;
in vec4 instanceColors;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec3 instancePickingColors;
out vec4 vColor;
out vec2 unitPosition;
void main(void) {
geometry.worldPosition = instancePositions;
geometry.normal = project_normal(instanceNormals);
unitPosition = positions.xy;
geometry.uv = unitPosition;
geometry.pickingColor = instancePickingColors;
vec3 offset = vec3(positions.xy * project_size_to_pixel(pointCloud.radiusPixels, pointCloud.sizeUnits), 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
vec3 lightColor = lighting_getLightColor(instanceColors.rgb, project.cameraPosition, geometry.position.xyz, geometry.normal);
vColor = vec4(lightColor, instanceColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,zS=`#version 300 es
#define SHADER_NAME point-cloud-layer-fragment-shader
precision highp float;
in vec4 vColor;
in vec2 unitPosition;
out vec4 fragColor;
void main(void) {
geometry.uv = unitPosition.xy;
float distToCenter = length(unitPosition);
if (distToCenter > 1.0) {
discard;
}
fragColor = vColor;
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,BS=`struct PointCloudUniforms {
  radiusPixels: f32,
  sizeUnits: i32,
};

@group(0) @binding(0)
var<uniform> pointCloudUniforms: PointCloudUniforms;

struct ConstantAttributes {
  instanceNormals: vec3<f32>,
  instanceColors: vec4<f32>,
  instancePositions: vec3<f32>,
  instancePositions64Low: vec3<f32>,
  instancePickingColors: vec3<f32>
};

const constants = ConstantAttributes(
  vec3<f32>(1.0, 0.0, 0.0),
  vec4<f32>(0.0, 0.0, 0.0, 1.0),
  vec3<f32>(0.0),
  vec3<f32>(0.0),
  vec3<f32>(0.0)
);

struct Attributes {
  @builtin(instance_index) instanceIndex : u32,
  @builtin(vertex_index) vertexIndex : u32,
  @location(0) positions: vec3<f32>,
  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceNormals: vec3<f32>,
  @location(4) instanceColors: vec4<f32>,
  @location(5) instancePickingColors: vec3<f32>
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) unitPosition: vec2<f32>,
  @location(2) pickingColor: vec3<f32>,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var varyings: Varyings;

  geometry.worldPosition = attributes.instancePositions;

  let centerResult = project_position_to_clipspace_and_commonspace(
    attributes.instancePositions,
    attributes.instancePositions64Low,
    vec3<f32>(0.0)
  );
  geometry.position = centerResult.commonPosition;
  geometry.normal = project_normal(attributes.instanceNormals);

  // position on the containing square in [-1, 1] space
  varyings.unitPosition = attributes.positions.xy;
  geometry.uv = varyings.unitPosition;
  geometry.pickingColor = attributes.instancePickingColors;

  // Find the center of the point and add the current vertex
  let offset = vec3<f32>(
    attributes.positions.xy *
      project_unit_size_to_pixel(pointCloudUniforms.radiusPixels, pointCloudUniforms.sizeUnits),
    0.0
  );
  // DECKGL_FILTER_SIZE(offset, geometry);

  varyings.position = centerResult.clipPosition;
  // DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  let clipPixels = project_pixel_size_to_clipspace(offset.xy);
  varyings.position.x += clipPixels.x;
  varyings.position.y += clipPixels.y;

  // Apply lighting
  let lightColor = lighting_getLightColor2(attributes.instanceColors.rgb, project.cameraPosition, geometry.position.xyz, geometry.normal);

  // Apply opacity to instance color, or return instance picking color
  varyings.vColor = vec4(lightColor, attributes.instanceColors.a * layer.opacity);
  // DECKGL_FILTER_COLOR(vColor, geometry);
  varyings.pickingColor = attributes.instancePickingColors;

  return varyings;
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
  // var geometry: Geometry;
  // geometry.uv = unitPosition.xy;

  let distToCenter = length(varyings.unitPosition);
  if (distToCenter > 1.0) {
    discard;
  }

  var fragColor: vec4<f32>;

  fragColor = varyings.vColor;

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(varyings.pickingColor)) {
      discard;
    }
    return vec4<f32>(varyings.pickingColor, 1.0);
  }

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(varyings.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  // Apply premultiplied alpha as required by transparent canvas
  fragColor = deckgl_premultiplied_alpha(fragColor);

  return fragColor;
}
`,VS=[0,0,0,255],HS=[0,0,1],US={sizeUnits:`pixels`,pointSize:{type:`number`,min:0,value:10},getPosition:{type:`accessor`,value:e=>e.position},getNormal:{type:`accessor`,value:HS},getColor:{type:`accessor`,value:VS},material:!0,radiusPixels:{deprecatedFor:`pointSize`}};function WS(e){let{header:t,attributes:n}=e;if(!(!t||!n)&&(e.length=t.vertexCount,n.POSITION&&(n.instancePositions=n.POSITION),n.NORMAL&&(n.instanceNormals=n.NORMAL),n.COLOR_0)){let{size:e,value:t}=n.COLOR_0;n.instanceColors={size:e,type:`unorm8`,value:t}}}var GS=class extends OS{getShaders(){return super.getShaders({vs:RS,fs:zS,source:BS,modules:[qd,wd,ql,Of,LS]})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:`float64`,fp64:this.use64bitPositions(),transition:!0,accessor:`getPosition`},instanceNormals:{size:3,transition:!0,accessor:`getNormal`,defaultValue:HS},instanceColors:{size:this.props.colorFormat.length,type:`unorm8`,transition:!0,accessor:`getColor`,defaultValue:VS}})}updateState(e){let{changeFlags:t,props:n}=e;super.updateState(e),t.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll()),t.dataChanged&&WS(n.data)}draw({uniforms:e}){let{pointSize:t,sizeUnits:n}=this.props,r=this.state.model,i={sizeUnits:wt[n],radiusPixels:t};r.shaderInputs.setProps({pointCloud:i}),r.draw(this.context.renderPass)}_getModel(){let e=[];for(let t=0;t<3;t++){let n=t/3*Math.PI*2;e.push(Math.cos(n)*2,Math.sin(n)*2,0)}return new dd(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new Cd({topology:`triangle-list`,attributes:{positions:new Float32Array(e)}}),isInstanced:!0})}};GS.layerName=`PointCloudLayer`,GS.defaultProps=US;var KS=Math.PI/180,qS=new Float32Array(16),JS=new Float32Array(12);function YS(e,t,n){let r=t[0]*KS,i=t[1]*KS,a=t[2]*KS,o=Math.sin(a),s=Math.sin(r),c=Math.sin(i),l=Math.cos(a),u=Math.cos(r),d=Math.cos(i),f=n[0],p=n[1],m=n[2];e[0]=f*d*u,e[1]=f*c*u,e[2]=f*-s,e[3]=p*(-c*l+d*s*o),e[4]=p*(d*l+c*s*o),e[5]=p*u*o,e[6]=m*(c*o+d*s*l),e[7]=m*(-d*o+c*s*l),e[8]=m*u*l}function XS(e){return e[0]=e[0],e[1]=e[1],e[2]=e[2],e[3]=e[4],e[4]=e[5],e[5]=e[6],e[6]=e[8],e[7]=e[9],e[8]=e[10],e[9]=e[12],e[10]=e[13],e[11]=e[14],e.subarray(0,12)}var ZS={size:12,accessor:[`getOrientation`,`getScale`,`getTranslation`,`getTransformMatrix`],shaderAttributes:{instanceModelMatrixCol0:{size:3,elementOffset:0},instanceModelMatrixCol1:{size:3,elementOffset:3},instanceModelMatrixCol2:{size:3,elementOffset:6},instanceTranslation:{size:3,elementOffset:9}},update(e,{startRow:t,endRow:n}){let{data:r,getOrientation:i,getScale:a,getTranslation:o,getTransformMatrix:s}=this.props,c=Array.isArray(s),l=c&&s.length===16,u=Array.isArray(a),d=Array.isArray(i),f=Array.isArray(o),p=l||!c&&!!s(r[0]);p?e.constant=l:e.constant=d&&u&&f;let m=e.value;if(e.constant){let t;p?(qS.set(s),t=XS(qS)):(t=JS,YS(t,i,a),t.set(o,9)),e.value=new Float32Array(t)}else{let c=t*e.size,{iterable:h,objectInfo:g}=Mb(r,t,n);for(let e of h){g.index++;let t;if(p)qS.set(l?s:s(e,g)),t=XS(qS);else{t=JS;let n=d?i:i(e,g),r=u?a:a(e,g);YS(t,n,r),t.set(f?o:o(e,g),9)}m[c++]=t[0],m[c++]=t[1],m[c++]=t[2],m[c++]=t[3],m[c++]=t[4],m[c++]=t[5],m[c++]=t[6],m[c++]=t[7],m[c++]=t[8],m[c++]=t[9],m[c++]=t[10],m[c++]=t[11]}}}};function QS(e,t){return t===`cartesian`||t===`meter-offsets`||t==="default"&&!e.isGeospatial}var $S=`layout(std140) uniform simpleMeshUniforms {
  float sizeScale;
  bool composeModelMatrix;
  bool hasTexture;
  bool flatShading;
} simpleMesh;
`,eC={name:`simpleMesh`,vs:$S,fs:$S,uniformTypes:{sizeScale:`f32`,composeModelMatrix:`f32`,hasTexture:`f32`,flatShading:`f32`}},tC=`#version 300 es
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
`,nC=`#version 300 es
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
`;function rC(e){let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0,s=e.POSITION?e.POSITION.value:[],c=s&&s.length;for(let e=0;e<c;e+=3){let c=s[e],l=s[e+1],u=s[e+2];t=c<t?c:t,n=l<n?l:n,r=u<r?u:r,i=c>i?c:i,a=l>a?l:a,o=u>o?u:o}return[[t,n,r],[i,a,o]]}function iC(e){let t=e.positions||e.POSITION;O.assert(t,`no "postions" or "POSITION" attribute in mesh`);let n=t.value.length/t.size,r=e.COLOR_0||e.colors;r||={size:3,value:new Float32Array(n*3).fill(1)};let i=e.NORMAL||e.normals;i||={size:3,value:new Float32Array(n*3).fill(0)};let a=e.TEXCOORD_0||e.texCoords;return a||={size:2,value:new Float32Array(n*2).fill(0)},{positions:t,colors:r,normals:i,texCoords:a}}function aC(e){return e instanceof Cd?(e.attributes=iC(e.attributes),e):e.attributes?new Cd({...e,topology:`triangle-list`,attributes:iC(e.attributes)}):new Cd({topology:`triangle-list`,attributes:iC(e)})}var oC={mesh:{type:`object`,value:null,async:!0},texture:{type:`image`,value:null,async:!0},sizeScale:{type:`number`,value:1,min:0},_instanced:!0,wireframe:!1,material:!0,getPosition:{type:`accessor`,value:e=>e.position},getColor:{type:`accessor`,value:[0,0,0,255]},getOrientation:{type:`accessor`,value:[0,0,0]},getScale:{type:`accessor`,value:[1,1,1]},getTranslation:{type:`accessor`,value:[0,0,0]},getTransformMatrix:{type:`accessor`,value:[]},textureParameters:{type:`object`,ignore:!0,value:null}},sC=class extends OS{getShaders(){return super.getShaders({vs:tC,fs:nC,modules:[qd,Jl,Of,eC]})}getBounds(){if(this.props._instanced)return super.getBounds();let e=this.state.positionBounds;if(e)return e;let{mesh:t}=this.props;if(!t)return null;if(e=t.header?.boundingBox,!e){let{attributes:n}=aC(t);n.POSITION=n.POSITION||n.positions,e=rC(n)}return this.state.positionBounds=e,e}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{transition:!0,type:`float64`,fp64:this.use64bitPositions(),size:3,accessor:`getPosition`},instanceColors:{type:`unorm8`,transition:!0,size:this.props.colorFormat.length,accessor:`getColor`,defaultValue:[0,0,0,255]},instanceModelMatrix:ZS}),this.setState({emptyTexture:this.context.device.createTexture({data:new Uint8Array(4),width:1,height:1})})}updateState(e){super.updateState(e);let{props:t,oldProps:n,changeFlags:r}=e;if(t.mesh!==n.mesh||r.extensionsChanged){if(this.state.positionBounds=null,this.state.model?.destroy(),t.mesh){this.state.model=this.getModel(t.mesh);let e=t.mesh.attributes||t.mesh;this.setState({hasNormals:!!(e.NORMAL||e.normals)})}this.getAttributeManager().invalidateAll()}t.texture!==n.texture&&t.texture instanceof I&&this.setTexture(t.texture),this.state.model&&this.state.model.setTopology(this.props.wireframe?`line-strip`:`triangle-list`)}finalizeState(e){super.finalizeState(e),this.state.emptyTexture.delete()}draw({uniforms:e}){let{model:t}=this.state;if(!t)return;let{viewport:n,renderPass:r}=this.context,{sizeScale:i,coordinateSystem:a,_instanced:o}=this.props,s={sizeScale:i,composeModelMatrix:!o||QS(n,a),flatShading:!this.state.hasNormals};t.shaderInputs.setProps({simpleMesh:s}),t.draw(r)}get isLoaded(){return!!(this.state?.model&&super.isLoaded)}getModel(e){let t=new dd(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:aC(e),isInstanced:!0}),{texture:n}=this.props,{emptyTexture:r}=this.state,i={sampler:n||r,hasTexture:!!n};return t.shaderInputs.setProps({simpleMesh:i}),t}setTexture(e){let{emptyTexture:t,model:n}=this.state;if(n){let r={sampler:e||t,hasTexture:!!e};n.shaderInputs.setProps({simpleMesh:r})}}};sC.defaultProps=oC,sC.layerName=`SimpleMeshLayer`;var G;(function(e){e[e.POINTS=0]=`POINTS`,e[e.LINES=1]=`LINES`,e[e.LINE_LOOP=2]=`LINE_LOOP`,e[e.LINE_STRIP=3]=`LINE_STRIP`,e[e.TRIANGLES=4]=`TRIANGLES`,e[e.TRIANGLE_STRIP=5]=`TRIANGLE_STRIP`,e[e.TRIANGLE_FAN=6]=`TRIANGLE_FAN`,e[e.ONE=1]=`ONE`,e[e.SRC_ALPHA=770]=`SRC_ALPHA`,e[e.ONE_MINUS_SRC_ALPHA=771]=`ONE_MINUS_SRC_ALPHA`,e[e.FUNC_ADD=32774]=`FUNC_ADD`,e[e.LINEAR=9729]=`LINEAR`,e[e.NEAREST=9728]=`NEAREST`,e[e.NEAREST_MIPMAP_NEAREST=9984]=`NEAREST_MIPMAP_NEAREST`,e[e.LINEAR_MIPMAP_NEAREST=9985]=`LINEAR_MIPMAP_NEAREST`,e[e.NEAREST_MIPMAP_LINEAR=9986]=`NEAREST_MIPMAP_LINEAR`,e[e.LINEAR_MIPMAP_LINEAR=9987]=`LINEAR_MIPMAP_LINEAR`,e[e.TEXTURE_MIN_FILTER=10241]=`TEXTURE_MIN_FILTER`,e[e.TEXTURE_WRAP_S=10242]=`TEXTURE_WRAP_S`,e[e.TEXTURE_WRAP_T=10243]=`TEXTURE_WRAP_T`,e[e.REPEAT=10497]=`REPEAT`,e[e.CLAMP_TO_EDGE=33071]=`CLAMP_TO_EDGE`,e[e.MIRRORED_REPEAT=33648]=`MIRRORED_REPEAT`,e[e.UNPACK_FLIP_Y_WEBGL=37440]=`UNPACK_FLIP_Y_WEBGL`})(G||={});function cC(e){return{addressModeU:lC(e.wrapS),addressModeV:lC(e.wrapT),magFilter:uC(e.magFilter),...dC(e.minFilter)}}function lC(e){switch(e){case G.CLAMP_TO_EDGE:return`clamp-to-edge`;case G.REPEAT:return`repeat`;case G.MIRRORED_REPEAT:return`mirror-repeat`;default:return}}function uC(e){switch(e){case G.NEAREST:return`nearest`;case G.LINEAR:return`linear`;default:return}}function dC(e){switch(e){case G.NEAREST:return{minFilter:`nearest`};case G.LINEAR:return{minFilter:`linear`};case G.NEAREST_MIPMAP_NEAREST:return{minFilter:`nearest`,mipmapFilter:`nearest`};case G.LINEAR_MIPMAP_NEAREST:return{minFilter:`linear`,mipmapFilter:`nearest`};case G.NEAREST_MIPMAP_LINEAR:return{minFilter:`nearest`,mipmapFilter:`linear`};case G.LINEAR_MIPMAP_LINEAR:return{minFilter:`linear`,mipmapFilter:`linear`};default:return{}}}var fC=[mC(`baseColor`,`pbr_baseColorSampler`,`baseColorTexture`,[`pbrMetallicRoughness`,`baseColorTexture`]),mC(`metallicRoughness`,`pbr_metallicRoughnessSampler`,`metallicRoughnessTexture`,[`pbrMetallicRoughness`,`metallicRoughnessTexture`]),mC(`normal`,`pbr_normalSampler`,`normalTexture`,[`normalTexture`]),mC(`occlusion`,`pbr_occlusionSampler`,`occlusionTexture`,[`occlusionTexture`]),mC(`emissive`,`pbr_emissiveSampler`,`emissiveTexture`,[`emissiveTexture`]),mC(`specularColor`,`pbr_specularColorSampler`,`KHR_materials_specular.specularColorTexture`,[`extensions`,`KHR_materials_specular`,`specularColorTexture`]),mC(`specularIntensity`,`pbr_specularIntensitySampler`,`KHR_materials_specular.specularTexture`,[`extensions`,`KHR_materials_specular`,`specularTexture`]),mC(`transmission`,`pbr_transmissionSampler`,`KHR_materials_transmission.transmissionTexture`,[`extensions`,`KHR_materials_transmission`,`transmissionTexture`]),mC(`thickness`,`pbr_thicknessSampler`,`KHR_materials_volume.thicknessTexture`,[`extensions`,`KHR_materials_volume`,`thicknessTexture`]),mC(`clearcoat`,`pbr_clearcoatSampler`,`KHR_materials_clearcoat.clearcoatTexture`,[`extensions`,`KHR_materials_clearcoat`,`clearcoatTexture`]),mC(`clearcoatRoughness`,`pbr_clearcoatRoughnessSampler`,`KHR_materials_clearcoat.clearcoatRoughnessTexture`,[`extensions`,`KHR_materials_clearcoat`,`clearcoatRoughnessTexture`]),mC(`clearcoatNormal`,`pbr_clearcoatNormalSampler`,`KHR_materials_clearcoat.clearcoatNormalTexture`,[`extensions`,`KHR_materials_clearcoat`,`clearcoatNormalTexture`]),mC(`sheenColor`,`pbr_sheenColorSampler`,`KHR_materials_sheen.sheenColorTexture`,[`extensions`,`KHR_materials_sheen`,`sheenColorTexture`]),mC(`sheenRoughness`,`pbr_sheenRoughnessSampler`,`KHR_materials_sheen.sheenRoughnessTexture`,[`extensions`,`KHR_materials_sheen`,`sheenRoughnessTexture`]),mC(`iridescence`,`pbr_iridescenceSampler`,`KHR_materials_iridescence.iridescenceTexture`,[`extensions`,`KHR_materials_iridescence`,`iridescenceTexture`]),mC(`iridescenceThickness`,`pbr_iridescenceThicknessSampler`,`KHR_materials_iridescence.iridescenceThicknessTexture`,[`extensions`,`KHR_materials_iridescence`,`iridescenceThicknessTexture`]),mC(`anisotropy`,`pbr_anisotropySampler`,`KHR_materials_anisotropy.anisotropyTexture`,[`extensions`,`KHR_materials_anisotropy`,`anisotropyTexture`])],pC=new Map(fC.map(e=>[e.slot,e]));function mC(e,t,n,r){return{slot:e,binding:t,displayName:n,pathSegments:r,uvSetUniform:`${e}UVSet`,uvTransformUniform:`${e}UVTransform`}}function hC(){return fC}function gC(e){let t=pC.get(e);if(!t)throw Error(`Unknown PBR texture transform slot ${e}`);return t}function _C(e){let t=e?.extensions?.KHR_texture_transform;return{offset:t?.offset?[t.offset[0],t.offset[1]]:[0,0],rotation:t?.rotation??0,scale:t?.scale?[t.scale[0],t.scale[1]]:[1,1]}}function vC(e){return e?.extensions?.KHR_texture_transform?.texCoord??e?.texCoord??0}function yC(e){return fC.find(t=>t.pathSegments.length===e.length&&t.pathSegments.every((t,n)=>e[n]===t))||null}function bC(e){let t=new B().set(1,0,0,0,1,0,e.offset[0],e.offset[1],1),n=new B().set(Math.cos(e.rotation),Math.sin(e.rotation),0,-Math.sin(e.rotation),Math.cos(e.rotation),0,0,0,1),r=new B().set(e.scale[0],0,0,0,e.scale[1],0,0,0,1);return Array.from(t.multiplyRight(n).multiplyRight(r))}function xC(e,t){let n=new B(bC(e)),r=new B(bC(t)),i=new B(n).invert();return Array.from(r.multiplyRight(i))}function SC(e,t,n,r){let i={defines:{MANUAL_SRGB:!0,SRGB_FAST_APPROXIMATION:!0},bindings:{},uniforms:{camera:[0,0,0],metallicRoughnessValues:[1,1]},parameters:{},glParameters:{},generatedTextures:[]};i.defines.USE_TEX_LOD=!0;let{imageBasedLightingEnvironment:a}=r;return a&&(i.bindings.pbr_diffuseEnvSampler=a.diffuseEnvSampler.texture,i.bindings.pbr_specularEnvSampler=a.specularEnvSampler.texture,i.bindings.pbr_brdfLUT=a.brdfLutTexture.texture,i.uniforms.IBLenabled=!0,i.uniforms.scaleIBLAmbient=[1,1]),r?.pbrDebug&&(i.defines.PBR_DEBUG=!0,i.uniforms.scaleDiffBaseMR=[0,0,0,0],i.uniforms.scaleFGDSpec=[0,0,0,0]),n.NORMAL&&(i.defines.HAS_NORMALS=!0),n.TANGENT&&r?.useTangents&&(i.defines.HAS_TANGENTS=!0),n.TEXCOORD_0&&(i.defines.HAS_UV=!0),n.TEXCOORD_1&&(i.defines.HAS_UV_1=!0),n.JOINTS_0&&n.WEIGHTS_0&&(i.defines.HAS_SKIN=!0),n.COLOR_0&&(i.defines.HAS_COLORS=!0),r?.imageBasedLightingEnvironment&&(i.defines.USE_IBL=!0),r?.lights&&(i.defines.USE_LIGHTS=!0),t&&(r.validateAttributes!==!1&&CC(t,n),EC(e,t,i,n,r.gltf)),i}function CC(e,t){let n=wC(e,0);n.length>0&&!t.TEXCOORD_0&&M.warn(`glTF material uses ${n.join(`, `)} but primitive is missing TEXCOORD_0; textured shading will sample the default UV coordinates`)();let r=wC(e,1);if(r.length>0&&!t.TEXCOORD_1&&M.warn(`glTF material uses ${r.join(`, `)} with TEXCOORD_1 but primitive is missing TEXCOORD_1; those textures will be skipped`)(),e.unlit||e.extensions?.KHR_materials_unlit||t.NORMAL)return;let i=e.normalTexture?`lit PBR shading with normalTexture`:`lit PBR shading`;M.warn(`glTF primitive is missing NORMAL while using ${i}; shading will fall back to geometric normals`)()}function wC(e,t){let n=[];for(let r of hC()){let i=TC(e,r.pathSegments);i&&vC(i)===t&&n.push(r.displayName)}return n}function TC(e,t){let n=e;for(let e of t)if(n=n?.[e],!n)return null;return n}function EC(e,t,n,r,i){if(n.uniforms.unlit=!!(t.unlit||t.extensions?.KHR_materials_unlit),t.pbrMetallicRoughness&&kC(e,t.pbrMetallicRoughness,n,r,i),t.normalTexture){VC(e,t.normalTexture,`pbr_normalSampler`,n,{featureOptions:{define:`HAS_NORMALMAP`,enabledUniformName:`normalMapEnabled`},gltf:i,attributes:r,textureTransformSlot:`normal`});let{scale:a=1}=t.normalTexture;n.uniforms.normalScale=a}if(t.occlusionTexture){VC(e,t.occlusionTexture,`pbr_occlusionSampler`,n,{featureOptions:{define:`HAS_OCCLUSIONMAP`,enabledUniformName:`occlusionMapEnabled`},gltf:i,attributes:r,textureTransformSlot:`occlusion`});let{strength:a=1}=t.occlusionTexture;n.uniforms.occlusionStrength=a}switch(n.uniforms.emissiveFactor=t.emissiveFactor||[0,0,0],t.emissiveTexture&&VC(e,t.emissiveTexture,`pbr_emissiveSampler`,n,{featureOptions:{define:`HAS_EMISSIVEMAP`,enabledUniformName:`emissiveMapEnabled`},gltf:i,attributes:r,textureTransformSlot:`emissive`}),AC(e,t.extensions,n,i,r),t.alphaMode||`OPAQUE`){case`OPAQUE`:break;case`MASK`:{let{alphaCutoff:e=.5}=t;n.defines.ALPHA_CUTOFF=!0,n.uniforms.alphaCutoffEnabled=!0,n.uniforms.alphaCutoff=e;break}case`BLEND`:M.warn(`glTF BLEND alphaMode might not work well because it requires mesh sorting`)(),DC(n);break}}function DC(e){e.parameters.blend=!0,e.parameters.blendColorOperation=`add`,e.parameters.blendColorSrcFactor=`src-alpha`,e.parameters.blendColorDstFactor=`one-minus-src-alpha`,e.parameters.blendAlphaOperation=`add`,e.parameters.blendAlphaSrcFactor=`one`,e.parameters.blendAlphaDstFactor=`one-minus-src-alpha`,e.glParameters.blend=!0,e.glParameters.blendEquation=G.FUNC_ADD,e.glParameters.blendFunc=[G.SRC_ALPHA,G.ONE_MINUS_SRC_ALPHA,G.ONE,G.ONE_MINUS_SRC_ALPHA]}function OC(e){e.parameters.blend=!0,e.parameters.depthWriteEnabled=!1,e.parameters.blendColorOperation=`add`,e.parameters.blendColorSrcFactor=`one`,e.parameters.blendColorDstFactor=`one-minus-src-alpha`,e.parameters.blendAlphaOperation=`add`,e.parameters.blendAlphaSrcFactor=`one`,e.parameters.blendAlphaDstFactor=`one-minus-src-alpha`,e.glParameters.blend=!0,e.glParameters.depthMask=!1,e.glParameters.blendEquation=G.FUNC_ADD,e.glParameters.blendFunc=[G.ONE,G.ONE_MINUS_SRC_ALPHA,G.ONE,G.ONE_MINUS_SRC_ALPHA]}function kC(e,t,n,r,i){t.baseColorTexture&&VC(e,t.baseColorTexture,`pbr_baseColorSampler`,n,{featureOptions:{define:`HAS_BASECOLORMAP`,enabledUniformName:`baseColorMapEnabled`},gltf:i,attributes:r,textureTransformSlot:`baseColor`}),n.uniforms.baseColorFactor=t.baseColorFactor||[1,1,1,1],t.metallicRoughnessTexture&&VC(e,t.metallicRoughnessTexture,`pbr_metallicRoughnessSampler`,n,{featureOptions:{define:`HAS_METALROUGHNESSMAP`,enabledUniformName:`metallicRoughnessMapEnabled`},gltf:i,attributes:r,textureTransformSlot:`metallicRoughness`});let{metallicFactor:a=1,roughnessFactor:o=1}=t;n.uniforms.metallicRoughnessValues=[a,o]}function AC(e,t,n,r,i={}){t&&(jC(t)&&(n.defines.USE_MATERIAL_EXTENSIONS=!0),MC(e,t.KHR_materials_specular,n,r,i),NC(t.KHR_materials_ior,n),PC(e,t.KHR_materials_transmission,n,r,i),FC(e,t.KHR_materials_volume,n,r,i),IC(e,t.KHR_materials_clearcoat,n,r,i),LC(e,t.KHR_materials_sheen,n,r,i),RC(e,t.KHR_materials_iridescence,n,r,i),zC(e,t.KHR_materials_anisotropy,n,r,i),BC(t.KHR_materials_emissive_strength,n))}function jC(e){return!!(e.KHR_materials_specular||e.KHR_materials_ior||e.KHR_materials_transmission||e.KHR_materials_volume||e.KHR_materials_clearcoat||e.KHR_materials_sheen||e.KHR_materials_iridescence||e.KHR_materials_anisotropy)}function MC(e,t,n,r,i={}){t&&(t.specularColorFactor&&(n.uniforms.specularColorFactor=t.specularColorFactor),t.specularFactor!==void 0&&(n.uniforms.specularIntensityFactor=t.specularFactor),t.specularColorTexture&&VC(e,t.specularColorTexture,`pbr_specularColorSampler`,n,{featureOptions:{define:`HAS_SPECULARCOLORMAP`,enabledUniformName:`specularColorMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`specularColor`}),t.specularTexture&&VC(e,t.specularTexture,`pbr_specularIntensitySampler`,n,{featureOptions:{define:`HAS_SPECULARINTENSITYMAP`,enabledUniformName:`specularIntensityMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`specularIntensity`}))}function NC(e,t){e?.ior!==void 0&&(t.uniforms.ior=e.ior)}function PC(e,t,n,r,i={}){t&&(t.transmissionFactor!==void 0&&(n.uniforms.transmissionFactor=t.transmissionFactor),t.transmissionTexture&&VC(e,t.transmissionTexture,`pbr_transmissionSampler`,n,{featureOptions:{define:`HAS_TRANSMISSIONMAP`,enabledUniformName:`transmissionMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`transmission`}),((t.transmissionFactor??0)>0||t.transmissionTexture)&&(M.warn(`KHR_materials_transmission uses a premultiplied-alpha blending approximation and may require mesh sorting`)(),OC(n)))}function FC(e,t,n,r,i={}){t&&(t.thicknessFactor!==void 0&&(n.uniforms.thicknessFactor=t.thicknessFactor),t.thicknessTexture&&VC(e,t.thicknessTexture,`pbr_thicknessSampler`,n,{featureOptions:{define:`HAS_THICKNESSMAP`},gltf:r,attributes:i,textureTransformSlot:`thickness`}),t.attenuationDistance!==void 0&&(n.uniforms.attenuationDistance=t.attenuationDistance),t.attenuationColor&&(n.uniforms.attenuationColor=t.attenuationColor))}function IC(e,t,n,r,i={}){t&&(t.clearcoatFactor!==void 0&&(n.uniforms.clearcoatFactor=t.clearcoatFactor),t.clearcoatRoughnessFactor!==void 0&&(n.uniforms.clearcoatRoughnessFactor=t.clearcoatRoughnessFactor),t.clearcoatTexture&&VC(e,t.clearcoatTexture,`pbr_clearcoatSampler`,n,{featureOptions:{define:`HAS_CLEARCOATMAP`,enabledUniformName:`clearcoatMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`clearcoat`}),t.clearcoatRoughnessTexture&&VC(e,t.clearcoatRoughnessTexture,`pbr_clearcoatRoughnessSampler`,n,{featureOptions:{define:`HAS_CLEARCOATROUGHNESSMAP`,enabledUniformName:`clearcoatRoughnessMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`clearcoatRoughness`}),t.clearcoatNormalTexture&&VC(e,t.clearcoatNormalTexture,`pbr_clearcoatNormalSampler`,n,{featureOptions:{define:`HAS_CLEARCOATNORMALMAP`},gltf:r,attributes:i,textureTransformSlot:`clearcoatNormal`}))}function LC(e,t,n,r,i={}){t&&(t.sheenColorFactor&&(n.uniforms.sheenColorFactor=t.sheenColorFactor),t.sheenRoughnessFactor!==void 0&&(n.uniforms.sheenRoughnessFactor=t.sheenRoughnessFactor),t.sheenColorTexture&&VC(e,t.sheenColorTexture,`pbr_sheenColorSampler`,n,{featureOptions:{define:`HAS_SHEENCOLORMAP`,enabledUniformName:`sheenColorMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`sheenColor`}),t.sheenRoughnessTexture&&VC(e,t.sheenRoughnessTexture,`pbr_sheenRoughnessSampler`,n,{featureOptions:{define:`HAS_SHEENROUGHNESSMAP`,enabledUniformName:`sheenRoughnessMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`sheenRoughness`}))}function RC(e,t,n,r,i={}){t&&(t.iridescenceFactor!==void 0&&(n.uniforms.iridescenceFactor=t.iridescenceFactor),t.iridescenceIor!==void 0&&(n.uniforms.iridescenceIor=t.iridescenceIor),(t.iridescenceThicknessMinimum!==void 0||t.iridescenceThicknessMaximum!==void 0)&&(n.uniforms.iridescenceThicknessRange=[t.iridescenceThicknessMinimum??100,t.iridescenceThicknessMaximum??400]),t.iridescenceTexture&&VC(e,t.iridescenceTexture,`pbr_iridescenceSampler`,n,{featureOptions:{define:`HAS_IRIDESCENCEMAP`,enabledUniformName:`iridescenceMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`iridescence`}),t.iridescenceThicknessTexture&&VC(e,t.iridescenceThicknessTexture,`pbr_iridescenceThicknessSampler`,n,{featureOptions:{define:`HAS_IRIDESCENCETHICKNESSMAP`},gltf:r,attributes:i,textureTransformSlot:`iridescenceThickness`}))}function zC(e,t,n,r,i={}){t&&(t.anisotropyStrength!==void 0&&(n.uniforms.anisotropyStrength=t.anisotropyStrength),t.anisotropyRotation!==void 0&&(n.uniforms.anisotropyRotation=t.anisotropyRotation),t.anisotropyTexture&&VC(e,t.anisotropyTexture,`pbr_anisotropySampler`,n,{featureOptions:{define:`HAS_ANISOTROPYMAP`,enabledUniformName:`anisotropyMapEnabled`},gltf:r,attributes:i,textureTransformSlot:`anisotropy`}))}function BC(e,t){e?.emissiveStrength!==void 0&&(t.uniforms.emissiveStrength=e.emissiveStrength)}function VC(e,t,n,r,i={}){let{featureOptions:a={},gltf:o,attributes:s={},textureTransformSlot:c}=i,{define:l,enabledUniformName:u}=a,d=vC(t);if(d>1){M.warn(`Skipping ${String(n)} because ${d} is not supported; only TEXCOORD_0 and TEXCOORD_1 are currently available`)();return}if(d===1&&!s.TEXCOORD_1){M.warn(`Skipping ${String(n)} because it requires TEXCOORD_1 but the primitive does not provide TEXCOORD_1`)();return}let f=HC(t,o),p=f.texture?.source?.image;if(!p){M.warn(`Skipping unresolved glTF texture for ${String(n)}`)();return}let m={wrapS:10497,wrapT:10497,minFilter:9729,magFilter:9729,...f?.texture?.sampler},h={id:f.uniformName||f.id,sampler:cC(m)},g;if(p.compressed)g=KC(e,p,h);else{let{width:t,height:n}=e.getExternalImageSize(p);g=e.createTexture({...h,width:t,height:n,data:p})}if(r.bindings[n]=g,l&&(r.defines[l]=!0),u&&(r.uniforms[u]=!0),c){let e=gC(c);r.uniforms[e.uvSetUniform]=d,r.uniforms[e.uvTransformUniform]=bC(_C(t))}r.generatedTextures.push(g)}function HC(e,t){if(e.texture||e.index===void 0||!t?.textures)return e;let n=t.textures[e.index];return n?`texture`in n&&n.texture?{...n,...e,texture:n.texture}:`source`in n?{...e,texture:n}:e:e}function UC(e,t){return e.createTexture({...t,format:`rgba8unorm`,width:1,height:1,mipLevels:1})}function WC(e){return e.textureFormat}function GC(e,t,n){let{blockWidth:r=1,blockHeight:i=1}=kn.getInfo(n),a=1;for(let n=1;;n++){let o=Math.max(1,e>>n),s=Math.max(1,t>>n);if(o<r||s<i)break;a++}return a}function KC(e,t,n){let r;if(r=Array.isArray(t.data)&&t.data[0]?.data?t.data:`mipmaps`in t&&Array.isArray(t.mipmaps)?t.mipmaps:[],r.length===0||!r[0]?.data)return M.warn(`createCompressedTexture: compressed image has no valid mip levels, creating fallback`)(),UC(e,n);let i=r[0],a=i.width??t.width??0,o=i.height??t.height??0;if(a<=0||o<=0)return M.warn(`createCompressedTexture: base level has invalid dimensions, creating fallback`)(),UC(e,n);let s=WC(i);if(!s)return M.warn(`createCompressedTexture: compressed image has no textureFormat, creating fallback`)(),UC(e,n);let c=GC(a,o,s),l=Math.min(r.length,c),u=1;for(let e=1;e<l;e++){let t=r[e];if(!t.data||t.width<=0||t.height<=0){M.warn(`createCompressedTexture: mip level ${e} has invalid data/dimensions, truncating`)();break}let n=WC(t);if(n&&n!==s){M.warn(`createCompressedTexture: mip level ${e} format '${n}' differs from base '${s}', truncating`)();break}let i=Math.max(1,a>>e),c=Math.max(1,o>>e);if(t.width!==i||t.height!==c){M.warn(`createCompressedTexture: mip level ${e} dimensions ${t.width}x${t.height} don't match expected ${i}x${c}, truncating`)();break}u++}let d=e.createTexture({...n,format:s,usage:I.TEXTURE|I.COPY_DST,width:a,height:o,mipLevels:u,data:i.data});for(let e=1;e<u;e++)d.writeData(r[e].data,{width:r[e].width,height:r[e].height,mipLevel:e});return d}function qC(e){switch(e){case G.POINTS:return`point-list`;case G.LINES:return`line-list`;case G.LINE_STRIP:return`line-strip`;case G.TRIANGLES:return`triangle-list`;case G.TRIANGLE_STRIP:return`triangle-strip`;default:throw Error(String(e))}}var JC=`
struct VertexInputs {
  @location(0) positions: vec3f,
#ifdef HAS_NORMALS
  @location(1) normals: vec3f,
#endif
#ifdef HAS_TANGENTS
  @location(2) TANGENT: vec4f,
#endif
#ifdef HAS_UV
  @location(3) texCoords: vec2f,
#endif
#ifdef HAS_UV_1
  @location(4) texCoords1: vec2f,
#endif
#ifdef HAS_SKIN
  @location(5) JOINTS_0: vec4u,
  @location(6) WEIGHTS_0: vec4f,
#endif
};

struct FragmentInputs {
  @builtin(position) position: vec4f,
  @location(0) pbrPosition: vec3f,
  @location(1) pbrUV0: vec2f,
  @location(2) pbrUV1: vec2f,
  @location(3) pbrNormal: vec3f,
#ifdef HAS_TANGENTS
  @location(4) pbrTangent: vec4f,
#endif
};

@vertex
fn vertexMain(inputs: VertexInputs) -> FragmentInputs {
  var outputs: FragmentInputs;
  var position = vec4f(inputs.positions, 1.0);
  var normal = vec3f(0.0, 0.0, 1.0);
  var tangent = vec4f(1.0, 0.0, 0.0, 1.0);
  var uv0 = vec2f(0.0, 0.0);
  var uv1 = vec2f(0.0, 0.0);

#ifdef HAS_NORMALS
  normal = inputs.normals;
#endif
#ifdef HAS_UV
  uv0 = inputs.texCoords;
#endif
#ifdef HAS_UV_1
  uv1 = inputs.texCoords1;
#endif
#ifdef HAS_TANGENTS
  tangent = inputs.TANGENT;
#endif
#ifdef HAS_SKIN
  let skinMatrix = getSkinMatrix(inputs.WEIGHTS_0, inputs.JOINTS_0);
  position = skinMatrix * position;
  normal = normalize((skinMatrix * vec4f(normal, 0.0)).xyz);
#ifdef HAS_TANGENTS
  tangent = vec4f(normalize((skinMatrix * vec4f(tangent.xyz, 0.0)).xyz), tangent.w);
#endif
#endif

  let worldPosition = pbrProjection.modelMatrix * position;

#ifdef HAS_NORMALS
  normal = normalize((pbrProjection.normalMatrix * vec4f(normal, 0.0)).xyz);
#endif
#ifdef HAS_TANGENTS
  let worldTangent = normalize((pbrProjection.modelMatrix * vec4f(tangent.xyz, 0.0)).xyz);
  outputs.pbrTangent = vec4f(worldTangent, tangent.w);
#endif

  outputs.position = pbrProjection.modelViewProjectionMatrix * position;
  outputs.pbrPosition = worldPosition.xyz / worldPosition.w;
  outputs.pbrUV0 = uv0;
  outputs.pbrUV1 = uv1;
  outputs.pbrNormal = normal;
  return outputs;
}

@fragment
fn fragmentMain(inputs: FragmentInputs) -> @location(0) vec4f {
  fragmentInputs.pbr_vPosition = inputs.pbrPosition;
  fragmentInputs.pbr_vUV0 = inputs.pbrUV0;
  fragmentInputs.pbr_vUV1 = inputs.pbrUV1;
  fragmentInputs.pbr_vNormal = inputs.pbrNormal;
#ifdef HAS_TANGENTS
  let tangent = normalize(inputs.pbrTangent.xyz);
  let bitangent = normalize(cross(inputs.pbrNormal, tangent)) * inputs.pbrTangent.w;
  fragmentInputs.pbr_vTBN = mat3x3f(tangent, bitangent, inputs.pbrNormal);
#endif
  return pbr_filterColor(vec4f(1.0));
}
`,YC=`#version 300 es

  // in vec4 POSITION;
  in vec4 positions;

  #ifdef HAS_NORMALS
    // in vec4 NORMAL;
    in vec4 normals;
  #endif

  #ifdef HAS_TANGENTS
    in vec4 TANGENT;
  #endif

  #ifdef HAS_UV
    // in vec2 TEXCOORD_0;
    in vec2 texCoords;
  #endif

  #ifdef HAS_UV_1
    in vec2 texCoords1;
  #endif

  #ifdef HAS_SKIN
    in uvec4 JOINTS_0;
    in vec4 WEIGHTS_0;
  #endif

  void main(void) {
    vec4 _NORMAL = vec4(0.);
    vec4 _TANGENT = vec4(0.);
    vec2 _TEXCOORD_0 = vec2(0.);
    vec2 _TEXCOORD_1 = vec2(0.);

    #ifdef HAS_NORMALS
      _NORMAL = normals;
    #endif

    #ifdef HAS_TANGENTS
      _TANGENT = TANGENT;
    #endif

    #ifdef HAS_UV
      _TEXCOORD_0 = texCoords;
    #endif

    #ifdef HAS_UV_1
      _TEXCOORD_1 = texCoords1;
    #endif

    vec4 pos = positions;

    #ifdef HAS_SKIN
      mat4 skinMat = getSkinMatrix(WEIGHTS_0, JOINTS_0);
      pos = skinMat * pos;
      _NORMAL = skinMat * _NORMAL;
      _TANGENT = vec4((skinMat * vec4(_TANGENT.xyz, 0.)).xyz, _TANGENT.w);
    #endif

    pbr_setPositionNormalTangentUV(pos, _NORMAL, _TANGENT, _TEXCOORD_0, _TEXCOORD_1);
    gl_Position = pbrProjection.modelViewProjectionMatrix * pos;
  }
`,XC=`#version 300 es
  out vec4 fragmentColor;

  void main(void) {
    vec3 pos = pbr_vPosition;
    fragmentColor = pbr_filterColor(vec4(1.0));
  }
`;function ZC(e,t){let n=t.materialFactory||new md(e,{modules:[nu]}),r={...t.parsedPPBRMaterial.uniforms};delete r.camera;let i=Object.fromEntries(Object.entries({...r,...t.parsedPPBRMaterial.bindings}).filter(([e,t])=>n.ownsBinding(e)&&$C(t))),a=n.createMaterial({id:t.id,bindings:i});return a.setProps({pbrMaterial:r}),a}function QC(e,t){let{id:n,geometry:r,parsedPPBRMaterial:i,vertexCount:a,modelOptions:o={}}=t;M.info(4,`createGLTFModel defines: `,i.defines)();let s=[],c={depthWriteEnabled:!0,depthCompare:`less`,depthFormat:`depth24plus`,cullMode:`back`},l={id:n,source:JC,vs:YC,fs:XC,geometry:r,topology:r.topology,vertexCount:a,modules:[nu,kl],...o,defines:{...i.defines,...o.defines},parameters:{...c,...i.parameters,...o.parameters}},u=t.material||ZC(e,{id:n?`${n}-material`:void 0,parsedPPBRMaterial:i});l.material=u;let d=new dd(e,l),f={...i.uniforms,...o.uniforms,...i.bindings,...o.bindings},p=ew(d.shaderInputs.getModules(),u,f);return d.shaderInputs.setProps(p),new Sd({managedResources:s,model:d})}function $C(e){return e instanceof P||e instanceof td||e instanceof cr||e instanceof I||e instanceof ur}function ew(e,t,n){let r=new Map;for(let t of e){for(let e of Object.keys(t.uniformTypes||{}))r.set(e,t.name);for(let e of t.bindingLayout||[])r.set(e.name,t.name)}let i={};for(let[e,a]of Object.entries(n)){if(a===void 0)continue;let n=r.get(e);!n||t.ownsModule(n)||(i[n]||={},i[n][e]=a)}return i}var tw={modelOptions:{},pbrDebug:!1,imageBasedLightingEnvironment:void 0,lights:!0,useTangents:!1,useByteColors:!0};function nw(e,t,n={}){let r={...tw,...n},i=new md(e,{modules:[nu]}),a=(t.materials||[]).map((n,a)=>ZC(e,{id:cw(n,a),parsedPPBRMaterial:SC(e,n,{},{...r,gltf:t,validateAttributes:!1}),materialFactory:i})),o=new Map;(t.materials||[]).forEach((e,t)=>{o.set(e.id,a[t])});let s=new Map;t.meshes.forEach((n,i)=>{let a=iw(e,n,t,o,r);s.set(n.id,a)});let c=new Map,l=new Map;return t.nodes.forEach((t,n)=>{let i=rw(e,t,r);c.set(n,i),l.set(t.id,i)}),t.nodes.forEach((e,t)=>{if(c.get(t).add((e.children??[]).map(({id:e})=>{let n=l.get(e);if(!n)throw Error(`Cannot find child ${e} of node ${t}`);return n})),e.mesh){let n=s.get(e.mesh.id);if(!n)throw Error(`Cannot find mesh child ${e.mesh.id} of node ${t}`);c.get(t).add(n)}}),{scenes:t.scenes.map(e=>{let t=(e.nodes||[]).map(({id:t})=>{let n=l.get(t);if(!n)throw Error(`Cannot find child ${t} of scene ${e.name||e.id}`);return n});return new xd({id:e.name||e.id,children:t})}),materials:a,gltfMeshIdToNodeMap:s,gltfNodeIdToNodeMap:l,gltfNodeIndexToNodeMap:c}}function rw(e,t,n){return new xd({id:t.name||t.id,children:[],matrix:t.matrix,position:t.translation,rotation:t.rotation,scale:t.scale})}function iw(e,t,n,r,i){let a=(t.primitives||[]).map((a,o)=>aw({device:e,gltfPrimitive:a,primitiveIndex:o,gltfMesh:t,gltf:n,gltfMaterialIdToMaterialMap:r,options:i}));return new xd({id:t.name||t.id,children:a})}function aw({device:e,gltfPrimitive:t,primitiveIndex:n,gltfMesh:r,gltf:i,gltfMaterialIdToMaterialMap:a,options:o}){let s=t.name||`${r.name||r.id}-primitive-${n}`,c=qC(t.mode??4),l=t.indices?t.indices.count:ow(t.attributes),u=sw(s,t,c),d=SC(e,t.material,u.attributes,{...o,gltf:i}),f=QC(e,{id:s,geometry:u,material:t.material&&a.get(t.material.id)||null,parsedPPBRMaterial:d,modelOptions:o.modelOptions,vertexCount:l});return f.bounds=[t.attributes.POSITION.min,t.attributes.POSITION.max],f}function ow(e){let t=1/0;for(let n of Object.values(e))if(n){let{value:e,size:r,components:i}=n,a=r??i;e?.length!==void 0&&a>=1&&(t=Math.min(t,e.length/a))}if(!Number.isFinite(t))throw Error(`Could not determine vertex count from attributes`);return t}function sw(e,t,n){let r={};for(let[e,n]of Object.entries(t.attributes)){let{components:t,size:i,value:a,normalized:o}=n;r[e]={size:i??t,value:a,normalized:o}}return new Cd({id:e,topology:n,indices:t.indices?.value,attributes:r})}function cw(e,t){return e.name||e.id||`material-${t}`}function lw(e,t={}){let n=e.lights||e.extensions?.KHR_lights_punctual?.lights;if(!n||!Array.isArray(n)||n.length===0)return[];let r=[],i=mw(e.nodes||[]),a=new Map;for(let o of e.nodes||[]){let e=o.light??o.extensions?.KHR_lights_punctual?.light;if(typeof e!=`number`)continue;let s=n[e];if(!s)continue;let c=uw(s.color||[1,1,1],t.useByteColors??!0),l=s.intensity??1,u=s.range,d=hw(o,i,a);switch(s.type){case`directional`:r.push(fw(d,c,l));break;case`point`:r.push(dw(d,c,l,u));break;case`spot`:r.push(pw(d,c,l,u,s.spot));break;default:break}}return r}function uw(e,t){return t?e.map(e=>e*255):Fo(e,!1)}function dw(e,t,n,r){let i=_w(e),a=[1,0,0];return r!==void 0&&r>0&&(a=[1,0,1/(r*r)]),{type:`point`,position:i,color:t,intensity:n,attenuation:a}}function fw(e,t,n){return{type:`directional`,direction:vw(e),color:t,intensity:n}}function pw(e,t,n,r,i={}){let a=_w(e),o=vw(e),s=[1,0,0];return r!==void 0&&r>0&&(s=[1,0,1/(r*r)]),{type:`spot`,position:a,direction:o,color:t,intensity:n,attenuation:s,innerConeAngle:i.innerConeAngle??0,outerConeAngle:i.outerConeAngle??Math.PI/4}}function mw(e){let t=new Map;for(let n of e)for(let e of n.children||[])t.set(e.id,n);return t}function hw(e,t,n){let r=n.get(e.id);if(r)return r;let i=gw(e),a=t.get(e.id),o=a?new V(hw(a,t,n)).multiplyRight(i):i;return n.set(e.id,o),o}function gw(e){if(e.matrix)return new V(e.matrix);let t=new V;return e.translation&&t.translate(e.translation),e.rotation&&t.multiplyRight(new V().fromQuaternion(e.rotation)),e.scale&&t.scale(e.scale),t}function _w(e){return e.transformAsPoint([0,0,0])}function vw(e){return e.transformDirection([0,0,-1])}function yw(e,t,n){switch(t){case`translation`:return e.setPosition(n).updateMatrix();case`rotation`:return e.setRotation(n).updateMatrix();case`scale`:return e.setScale(n).updateMatrix();default:return M.warn(`Bad animation path ${t}`)(),null}}function bw(e,{input:t,interpolation:n,output:r},i,a){let o=xw(e,{input:t,interpolation:n,output:r},a);o&&yw(i,a,o)}function xw(e,{input:t,interpolation:n,output:r},i){let a=t[t.length-1];if(!Number.isFinite(a)||a<=0)return r[0]||null;let o=e%a,s=t.findIndex(e=>e>=o);if(s<0)return r[r.length-1]||null;let c=Math.max(0,s-1),l=t[c],u=t[s];switch(n){case`STEP`:return r[c];case`LINEAR`:if(u>l){let e=(o-l)/(u-l);return Sw(i,r[c],r[s],e)}return r[c]||null;case`CUBICSPLINE`:if(u>l){let e=(o-l)/(u-l),t=u-l,n=r[3*c+1],i=r[3*c+2],a=r[3*s+0],d=r[3*s+1];return Cw({p0:n,outTangent0:i,inTangent1:a,p1:d,tDiff:t,ratio:e})}return r[3*c+1]||null;default:return M.warn(`Interpolation ${n} not supported`)(),null}}function Sw(e,t,n,r){if(e===`rotation`)return new Cl().slerp({start:t,target:n,ratio:r});let i=[];for(let e=0;e<t.length;e++)i[e]=r*n[e]+(1-r)*t[e];return i}function Cw({p0:e,outTangent0:t,inTangent1:n,p1:r,tDiff:i,ratio:a}){let o=[];for(let s=0;s<e.length;s++){let c=t[s]*i,l=n[s]*i;o[s]=(2*a**3-3*a**2+1)*e[s]+(a**3-2*a**2+a)*c+(-2*a**3+3*a**2)*r[s]+(a**3-a**2)*l}return o}var ww=class{animation;gltfNodeIdToNodeMap;materials;startTime=0;playing=!0;speed=1;materialTextureTransformState=new Map;constructor(e){if(this.animation=e.animation,this.gltfNodeIdToNodeMap=e.gltfNodeIdToNodeMap,this.materials=e.materials||[],this.animation.name||=`unnamed`,Object.assign(this,e),this.animation.channels.some(e=>e.type!==`node`)&&!this.materials.length)throw Error(`Animation ${this.animation.name} targets materials, but GLTFAnimator was created without a materials array`)}setTime(e){if(!this.playing)return;let t=(e/1e3-this.startTime)*this.speed;this.animation.channels.forEach(e=>{if(e.type===`node`){let{sampler:n,targetNodeId:r,path:i}=e,a=this.gltfNodeIdToNodeMap.get(r);if(!a)throw Error(`Cannot find animation target node ${r}`);bw(t,n,a,i);return}let n=this.materials[e.targetMaterialIndex];if(!n)throw Error(`Cannot find animation target material ${e.targetMaterialIndex} for ${e.pointer}`);let r=xw(t,e.sampler);r&&(e.type===`material`?Ew(n,e,r):kw(n,e,r,this.materialTextureTransformState))})}},Tw=class{animations;constructor(e){this.animations=e.animations.map((t,n)=>{let r=t.name||`Animation-${n}`;return new ww({gltfNodeIdToNodeMap:e.gltfNodeIdToNodeMap,materials:e.materials,animation:{name:r,channels:t.channels}})})}animate(e){M.warn(`GLTFAnimator#animate is deprecated. Use GLTFAnimator#setTime instead`)(),this.setTime(e)}setTime(e){this.animations.forEach(t=>t.setTime(e))}getAnimations(){return this.animations}};function Ew(e,t,n){let r=t.component===void 0?{[t.property]:n.length===1?n[0]:n}:{[t.property]:Ow(Dw(e,t.property),t.component,n[0])};e.setProps({pbrMaterial:r})}function Dw(e,t){let n=e.shaderInputs.getUniformValues().pbrMaterial?.[t];return Array.isArray(n)?[...n]:[]}function Ow(e,t,n){let r=[...e];return r[t]=n,r}function kw(e,t,n,r){let i=gC(t.textureSlot),a=Aw(r,e,t);switch(t.path){case`offset`:t.component===void 0?a.offset=[n[0],n[1]]:a.offset[t.component]=n[0];break;case`rotation`:a.rotation=n[0];break;case`scale`:t.component===void 0?a.scale=[n[0],n[1]]:a.scale[t.component]=n[0];break}e.setProps({pbrMaterial:{[i.uvTransformUniform]:xC(t.baseTransform,a)}})}function Aw(e,t,n){let r=e.get(t)||{},i=r[n.textureSlot];return i||(i={offset:[...n.baseTransform.offset],rotation:n.baseTransform.rotation,scale:[...n.baseTransform.scale]},r[n.textureSlot]=i,e.set(t,r)),i}var jw={supportLevel:`none`,comment:`Not currently listed in the luma.gl glTF extension support registry.`},Mw={KHR_draco_mesh_compression:{supportLevel:`built-in`,comment:`Decoded by loaders.gl before luma.gl builds the scenegraph.`},EXT_meshopt_compression:{supportLevel:`built-in`,comment:`Meshopt-compressed primitives are decoded during load.`},KHR_mesh_quantization:{supportLevel:`built-in`,comment:`Quantized accessors are unpacked before geometry creation.`},KHR_lights_punctual:{supportLevel:`built-in`,comment:`Parsed into luma.gl Light objects.`},KHR_materials_unlit:{supportLevel:`built-in`,comment:`Unlit materials bypass the default lighting path.`},KHR_materials_emissive_strength:{supportLevel:`built-in`,comment:`Applied by the stock PBR shader.`},KHR_texture_basisu:{supportLevel:`built-in`,comment:`BasisU / KTX2 textures pass through when the device supports them.`},KHR_texture_transform:{supportLevel:`built-in`,comment:`UV transforms are applied during load.`},EXT_texture_webp:{supportLevel:`loader-only`,comment:`Texture source is resolved during load; final support depends on browser and device decode support.`},EXT_texture_avif:{supportLevel:`loader-only`,comment:`Texture source is resolved during load; final support depends on browser and device decode support.`},KHR_materials_specular:{supportLevel:`built-in`,comment:`The stock shader now applies specular factors and textures to the dielectric F0 term.`},KHR_materials_ior:{supportLevel:`built-in`,comment:`The stock shader now drives dielectric reflectance from the glTF IOR value.`},KHR_materials_transmission:{supportLevel:`built-in`,comment:`The stock shader now applies transmission to the base layer and exposes transparency through alpha, without a scene-color refraction buffer.`},KHR_materials_volume:{supportLevel:`built-in`,comment:`Thickness and attenuation now tint transmitted light in the stock shader.`},KHR_materials_clearcoat:{supportLevel:`built-in`,comment:`The stock shader now adds a secondary clearcoat specular lobe.`},KHR_materials_sheen:{supportLevel:`built-in`,comment:`The stock shader now adds a sheen lobe for cloth-like materials.`},KHR_materials_iridescence:{supportLevel:`built-in`,comment:`The stock shader now tints specular response with a view-dependent thin-film iridescence approximation.`},KHR_materials_anisotropy:{supportLevel:`built-in`,comment:`The stock shader now shapes highlights and IBL response with an anisotropy-direction approximation.`},KHR_materials_pbrSpecularGlossiness:{supportLevel:`loader-only`,comment:`Extension data can be loaded, but it is not translated into the default metallic-roughness material path.`},KHR_materials_variants:{supportLevel:`loader-only`,comment:`Variant metadata can be loaded, but applications must choose and apply variants.`},EXT_mesh_gpu_instancing:{supportLevel:`none`,comment:`GPU instancing data is not yet converted into luma.gl instanced draw setup.`},KHR_node_visibility:{supportLevel:`none`,comment:`Node-visibility animations and toggles are not mapped onto runtime scenegraph state.`},KHR_animation_pointer:{supportLevel:`parsed-and-wired`,comment:`Selected node TRS, material factor, and KHR_texture_transform offset/rotation/scale pointers are wired to runtime updates; unsupported targets are skipped.`},KHR_materials_diffuse_transmission:{supportLevel:`none`,comment:`Diffuse-transmission shading is not implemented in the stock PBR shader.`},KHR_materials_dispersion:{supportLevel:`none`,comment:`Chromatic dispersion is not implemented in the stock PBR shader.`},KHR_materials_volume_scatter:{supportLevel:`none`,comment:`Volume scattering is not implemented in the stock PBR shader.`},KHR_xmp:{supportLevel:`none`,comment:`Metadata payloads remain in the loaded glTF, but luma.gl does not interpret them.`},KHR_xmp_json_ld:{supportLevel:`none`,comment:`Metadata is preserved in the glTF, but luma.gl does not interpret it.`},EXT_lights_image_based:{supportLevel:`none`,comment:`Use loadPBREnvironment() or custom environment setup instead.`},EXT_texture_video:{supportLevel:`none`,comment:`Video textures are not created automatically by the stock pipeline.`},MSFT_lod:{supportLevel:`none`,comment:`Level-of-detail switching is not implemented in the stock scenegraph loader.`}};function Nw(e){let t=Array.from(Fw(e)).sort().map(e=>{let t=Mw[e]||jw;return[e,{extensionName:e,supported:t.supportLevel===`built-in`||t.supportLevel===`parsed-and-wired`,supportLevel:t.supportLevel,comment:t.comment}]});return new Map(t)}function Pw(e){return Mw[e]||null}function Fw(e){let t=e,n=new Set;return Iw(n,e.extensionsUsed),Iw(n,e.extensionsRequired),Iw(n,t.extensionsRemoved),Iw(n,Object.keys(e.extensions||{})),(t.lights?.length||(e.nodes||[]).some(e=>`light`in e))&&n.add(`KHR_lights_punctual`),(e.materials||[]).some(e=>{let t=e;return t.unlit||t.extensions?.KHR_materials_unlit})&&n.add(`KHR_materials_unlit`),n}function Iw(e,t=[]){for(let n of t)e.add(n)}var Lw={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Rw={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};function zw(e){let t=Rw[e.componentType],n=Lw[e.type],r=n*e.count,{buffer:i,byteOffset:a=0}=e.bufferView?.data??{};return{typedArray:new t(i,a+(e.byteOffset||0),r),components:n}}function Bw(e){let t=e.animations||[],n=new Map,r=new Map;return t.flatMap((t,i)=>{let a=t.name||`Animation-${i}`,o=new Map,s=t.channels.flatMap(({sampler:i,target:a})=>{let s=o.get(i);if(!s){let a=t.samplers[i];if(!a)throw Error(`Cannot find animation sampler ${i}`);let{input:c,interpolation:l=`LINEAR`,output:u}=a;s={input:$w(e.accessors[c],n),interpolation:l,output:eT(e.accessors[u],r)},o.set(i,s)}let c=Vw(e,a,s);return c?[c]:[]});return s.length?[{name:a,channels:s}]:[]})}function Vw(e,t,n){if(t.path===`pointer`)return Hw(e,t,n);let r=Gw(t.path);if(!r)return null;let i=e.nodes[t.node??0];if(!i)throw Error(`Cannot find animation target ${t.node}`);return{type:`node`,sampler:n,targetNodeId:i.id,path:r}}function Hw(e,t,n){let r=t.extensions?.KHR_animation_pointer?.pointer;if(typeof r!=`string`||!r.startsWith(`/`))return M.warn(`KHR_animation_pointer channel is missing a valid JSON pointer and will be skipped`)(),null;let i=Yw(r);switch(i[0]){case`nodes`:return Uw(e,i,n,r);case`materials`:return Ww(e,i,n,r);default:return Qw(r,`top-level target "${i[0]}" has no runtime animation mapping`),null}}function Uw(e,t,n,r){if(t.length!==3)return Qw(r,`node pointers must use /nodes/{index}/{translation|rotation|scale|weights}`),null;let i=Number(t[1]),a=e.nodes[i];if(!Number.isInteger(i)||!a)return M.warn(`KHR_animation_pointer target ${r} references a missing node and will be skipped`)(),null;let o=Gw(t[2]);return o?o===`weights`?(M.warn(`KHR_animation_pointer target ${r} will be skipped because morph weights are not implemented in GLTFAnimator`)(),null):{type:`node`,sampler:n,targetNodeId:a.id,path:o}:(Qw(r,`node property "${t[2]}" has no runtime animation mapping`),null)}function Ww(e,t,n,r){if(t.length<3)return Qw(r,`material pointers must include a material index and target property path`),null;let i=Number(t[1]),a=e.materials[i];if(!Number.isInteger(i)||!a)return M.warn(`KHR_animation_pointer target ${r} references a missing material and will be skipped`)(),null;let o=Kw(a,t.slice(2));return`reason`in o?(Qw(r,o.reason),null):{sampler:n,pointer:r,targetMaterialIndex:i,...o}}function Gw(e){switch(e){case`translation`:case`rotation`:case`scale`:case`weights`:return e;default:return null}}function Kw(e,t){let n=qw(e,t);if(!(`reason`in n)||n.reason!==`not-a-texture-transform-target`)return n;switch(t.join(`/`)){case`pbrMetallicRoughness/baseColorFactor`:return e.pbrMetallicRoughness?{type:`material`,property:`baseColorFactor`}:{reason:K(t)};case`pbrMetallicRoughness/metallicFactor`:return e.pbrMetallicRoughness?{type:`material`,property:`metallicRoughnessValues`,component:0}:{reason:K(t)};case`pbrMetallicRoughness/roughnessFactor`:return e.pbrMetallicRoughness?{type:`material`,property:`metallicRoughnessValues`,component:1}:{reason:K(t)};case`normalTexture/scale`:return e.normalTexture?{type:`material`,property:`normalScale`}:{reason:K(t)};case`occlusionTexture/strength`:return e.occlusionTexture?{type:`material`,property:`occlusionStrength`}:{reason:K(t)};case`emissiveFactor`:return{type:`material`,property:`emissiveFactor`};case`alphaCutoff`:return{type:`material`,property:`alphaCutoff`};case`extensions/KHR_materials_specular/specularFactor`:return e.extensions?.KHR_materials_specular?{type:`material`,property:`specularIntensityFactor`}:{reason:K(t)};case`extensions/KHR_materials_specular/specularColorFactor`:return e.extensions?.KHR_materials_specular?{type:`material`,property:`specularColorFactor`}:{reason:K(t)};case`extensions/KHR_materials_ior/ior`:return e.extensions?.KHR_materials_ior?{type:`material`,property:`ior`}:{reason:K(t)};case`extensions/KHR_materials_transmission/transmissionFactor`:return e.extensions?.KHR_materials_transmission?{type:`material`,property:`transmissionFactor`}:{reason:K(t)};case`extensions/KHR_materials_volume/thicknessFactor`:return e.extensions?.KHR_materials_volume?{type:`material`,property:`thicknessFactor`}:{reason:K(t)};case`extensions/KHR_materials_volume/attenuationDistance`:return e.extensions?.KHR_materials_volume?{type:`material`,property:`attenuationDistance`}:{reason:K(t)};case`extensions/KHR_materials_volume/attenuationColor`:return e.extensions?.KHR_materials_volume?{type:`material`,property:`attenuationColor`}:{reason:K(t)};case`extensions/KHR_materials_clearcoat/clearcoatFactor`:return e.extensions?.KHR_materials_clearcoat?{type:`material`,property:`clearcoatFactor`}:{reason:K(t)};case`extensions/KHR_materials_clearcoat/clearcoatRoughnessFactor`:return e.extensions?.KHR_materials_clearcoat?{type:`material`,property:`clearcoatRoughnessFactor`}:{reason:K(t)};case`extensions/KHR_materials_sheen/sheenColorFactor`:return e.extensions?.KHR_materials_sheen?{type:`material`,property:`sheenColorFactor`}:{reason:K(t)};case`extensions/KHR_materials_sheen/sheenRoughnessFactor`:return e.extensions?.KHR_materials_sheen?{type:`material`,property:`sheenRoughnessFactor`}:{reason:K(t)};case`extensions/KHR_materials_iridescence/iridescenceFactor`:return e.extensions?.KHR_materials_iridescence?{type:`material`,property:`iridescenceFactor`}:{reason:K(t)};case`extensions/KHR_materials_iridescence/iridescenceIor`:return e.extensions?.KHR_materials_iridescence?{type:`material`,property:`iridescenceIor`}:{reason:K(t)};case`extensions/KHR_materials_iridescence/iridescenceThicknessMinimum`:return e.extensions?.KHR_materials_iridescence?{type:`material`,property:`iridescenceThicknessRange`,component:0}:{reason:K(t)};case`extensions/KHR_materials_iridescence/iridescenceThicknessMaximum`:return e.extensions?.KHR_materials_iridescence?{type:`material`,property:`iridescenceThicknessRange`,component:1}:{reason:K(t)};case`extensions/KHR_materials_anisotropy/anisotropyStrength`:return e.extensions?.KHR_materials_anisotropy?{type:`material`,property:`anisotropyStrength`}:{reason:K(t)};case`extensions/KHR_materials_anisotropy/anisotropyRotation`:return e.extensions?.KHR_materials_anisotropy?{type:`material`,property:`anisotropyRotation`}:{reason:K(t)};case`extensions/KHR_materials_emissive_strength/emissiveStrength`:return e.extensions?.KHR_materials_emissive_strength?{type:`material`,property:`emissiveStrength`}:{reason:K(t)};default:return{reason:K(t)}}}function qw(e,t){let n=t.lastIndexOf(`extensions`);if(n<0||t[n+1]!==`KHR_texture_transform`||n<1)return{reason:`not-a-texture-transform-target`};let r=yC(t.slice(0,n));if(!r)return{reason:Xw(t.slice(0,n))};let i=Jw(e,r.pathSegments);if(!i)return{reason:`texture-transform target "${t.slice(0,n).join(`/`)}" does not exist on the referenced material`};let a=t[n+2];if(a===`texCoord`)return{reason:`animated KHR_texture_transform.texCoord is unsupported because texCoord selection is structural, not a runtime float/vector update`};if(a!==`offset`&&a!==`rotation`&&a!==`scale`)return{reason:`KHR_texture_transform property "${a}" is not animatable; supported properties are offset, rotation, and scale`};let o=t[n+3];if(t.length>n+4)return{reason:`KHR_texture_transform.${a} does not support nested property paths`};let s;if(o!==void 0){if(s=Number(o),a===`rotation`)return{reason:`KHR_texture_transform.rotation does not support component indices`};if(!Number.isInteger(s)||s<0||s>1)return{reason:`KHR_texture_transform.${a} component index "${o}" is invalid; only 0 and 1 are supported`}}return{type:`textureTransform`,textureSlot:r.slot,path:a,component:s,baseTransform:_C(i)}}function Jw(e,t){let n=e;for(let e of t)if(n=n?.[e],!n)return null;return n}function Yw(e){return e.slice(1).split(`/`).map(e=>e.replace(/~1/g,`/`).replace(/~0/g,`~`))}function K(e){let t=Zw(e);if(t){let e=Pw(t);if(e?.supportLevel===`none`)return`${t} is referenced by this pointer, but ${e.comment.charAt(0).toLowerCase()}${e.comment.slice(1)}`}return`no runtime target exists for material property "${e.join(`/`)}"`}function Xw(e){let t=Zw(e);if(t){let e=Pw(t);if(e?.supportLevel===`none`)return`${t} is referenced by this pointer, but ${e.comment.charAt(0).toLowerCase()}${e.comment.slice(1)}`}return`texture-transform target "${e.join(`/`)}" has no runtime texture-slot mapping`}function Zw(e){let t=e.indexOf(`extensions`),n=e[t+1];return t>=0&&n?n:null}function Qw(e,t){M.warn(`KHR_animation_pointer target ${e} will be skipped because ${t}`)()}function $w(e,t){if(t.has(e))return t.get(e);let{typedArray:n,components:r}=zw(e);tT(r===1,`accessorToJsArray1D must have exactly 1 component`);let i=Array.from(n);return t.set(e,i),i}function eT(e,t){if(t.has(e))return t.get(e);let{typedArray:n,components:r}=zw(e);tT(r>=1,`accessorToJsArray2D must have at least 1 component`);let i=[];for(let e=0;e<n.length;e+=r)i.push(Array.from(n.slice(e,e+r)));return t.set(e,i),i}function tT(e,t){if(!e)throw Error(t)}function nT(e,t,n){let{scenes:r,materials:i,gltfMeshIdToNodeMap:a,gltfNodeIdToNodeMap:o,gltfNodeIndexToNodeMap:s}=nw(e,t,n),c=new Tw({animations:Bw(t),gltfNodeIdToNodeMap:o,materials:i}),l=lw(t,{useByteColors:n?.useByteColors??!0}),u=Nw(t),d=r.map(e=>rT(e.getBounds()));return{scenes:r,materials:i,animator:c,lights:l,extensionSupport:u,sceneBounds:d,modelBounds:iT(d),gltfMeshIdToNodeMap:a,gltfNodeIdToNodeMap:o,gltfNodeIndexToNodeMap:s,gltf:t}}function rT(e){if(!e)return{bounds:null,center:[0,0,0],size:[0,0,0],radius:.5,recommendedOrbitDistance:1};let t=[[e[0][0],e[0][1],e[0][2]],[e[1][0],e[1][1],e[1][2]]],n=[t[1][0]-t[0][0],t[1][1]-t[0][1],t[1][2]-t[0][2]],r=[t[0][0]+n[0]*.5,t[0][1]+n[1]*.5,t[0][2]+n[2]*.5],i=Math.max(n[0],n[1],n[2])*.5,a=Math.max(.5*Math.hypot(n[0],n[1],n[2]),.001);return{bounds:t,center:r,size:n,radius:a,recommendedOrbitDistance:Math.max(Math.max(i,.001)/Math.tan(Math.PI/6)*1.15,a*1.1)}}function iT(e){let t=null;for(let n of e)if(n.bounds){if(!t){t=[[...n.bounds[0]],[...n.bounds[1]]];continue}for(let e=0;e<3;e++)t[0][e]=Math.min(t[0][e],n.bounds[0][e]),t[1][e]=Math.max(t[1][e],n.bounds[1][e])}return rT(t)}var aT=`4.4.3`,oT=`4.4.3`,sT={TRANSCODER:`basis_transcoder.js`,TRANSCODER_WASM:`basis_transcoder.wasm`,ENCODER:`basis_encoder.js`,ENCODER_WASM:`basis_encoder.wasm`},cT;async function lT(e){return up(e.modules),dp(`basis`)||(cT||=uT(e),await cT)}async function uT(e){let t=null,n=null;return[t,n]=await Promise.all([await zp(sT.TRANSCODER,`textures`,e),await zp(sT.TRANSCODER_WASM,`textures`,e)]),t||=globalThis.BASIS,await dT(t,n)}function dT(e,t){let n={};return t&&(n.wasmBinary=t),new Promise(t=>{e(n).then(e=>{let{BasisFile:n,initializeBasis:r}=e;r(),t({BasisFile:n})})})}var fT;async function pT(e){let t=e.modules||{};return t.basisEncoder?t.basisEncoder:(fT||=mT(e),await fT)}async function mT(e){let t=null,n=null;return[t,n]=await Promise.all([await zp(sT.ENCODER,`textures`,e),await zp(sT.ENCODER_WASM,`textures`,e)]),t||=globalThis.BASIS,await hT(t,n)}function hT(e,t){let n={};return t&&(n.wasmBinary=t),new Promise(t=>{e(n).then(e=>{let{BasisFile:n,KTX2File:r,initializeBasis:i,BasisEncoder:a}=e;i(),t({BasisFile:n,KTX2File:r,BasisEncoder:a})})})}var gT=32854,_T=32856,vT=36194,yT=33776,bT=33779,xT=37493,ST=35840,CT=35842,wT=36196,TT=35986,ET=34798,DT=37808,OT=36283,kT=36285,AT=36492,jT=[``,`WEBKIT_`,`MOZ_`],MT={WEBGL_compressed_texture_s3tc:[`bc1-rgb-unorm-webgl`,`bc1-rgba-unorm`,`bc2-rgba-unorm`,`bc3-rgba-unorm`],WEBGL_compressed_texture_s3tc_srgb:[`bc1-rgb-unorm-srgb-webgl`,`bc1-rgba-unorm-srgb`,`bc2-rgba-unorm-srgb`,`bc3-rgba-unorm-srgb`],EXT_texture_compression_rgtc:[`bc4-r-unorm`,`bc4-r-snorm`,`bc5-rg-unorm`,`bc5-rg-snorm`],EXT_texture_compression_bptc:[`bc6h-rgb-ufloat`,`bc6h-rgb-float`,`bc7-rgba-unorm`,`bc7-rgba-unorm-srgb`],WEBGL_compressed_texture_etc1:[`etc1-rgb-unorm-webgl`],WEBGL_compressed_texture_etc:[`etc2-rgb8unorm`,`etc2-rgb8unorm-srgb`,`etc2-rgb8a1unorm`,`etc2-rgb8a1unorm-srgb`,`etc2-rgba8unorm`,`etc2-rgba8unorm-srgb`,`eac-r11unorm`,`eac-r11snorm`,`eac-rg11unorm`,`eac-rg11snorm`],WEBGL_compressed_texture_pvrtc:[`pvrtc-rgb4unorm-webgl`,`pvrtc-rgba4unorm-webgl`,`pvrtc-rgb2unorm-webgl`,`pvrtc-rgba2unorm-webgl`],WEBGL_compressed_texture_atc:[`atc-rgb-unorm-webgl`,`atc-rgba-unorm-webgl`,`atc-rgbai-unorm-webgl`],WEBGL_compressed_texture_astc:`astc-4x4-unorm.astc-4x4-unorm-srgb.astc-5x4-unorm.astc-5x4-unorm-srgb.astc-5x5-unorm.astc-5x5-unorm-srgb.astc-6x5-unorm.astc-6x5-unorm-srgb.astc-6x6-unorm.astc-6x6-unorm-srgb.astc-8x5-unorm.astc-8x5-unorm-srgb.astc-8x6-unorm.astc-8x6-unorm-srgb.astc-8x8-unorm.astc-8x8-unorm-srgb.astc-10x5-unorm.astc-10x5-unorm-srgb.astc-10x6-unorm.astc-10x6-unorm-srgb.astc-10x8-unorm.astc-10x8-unorm-srgb.astc-10x10-unorm.astc-10x10-unorm-srgb.astc-12x10-unorm.astc-12x10-unorm-srgb.astc-12x12-unorm.astc-12x12-unorm-srgb`.split(`.`)},NT=null;function PT(e){if(!NT){e=e||FT()||void 0,NT=new Set;for(let t of jT)for(let n in MT)if(e&&e.getExtension(`${t}${n}`))for(let e of MT[n])NT.add(e)}return NT}function FT(){try{return document.createElement(`canvas`).getContext(`webgl`)}catch{return null}}var IT=[171,75,84,88,32,50,48,187,13,10,26,10];function LT(e){let t=new Uint8Array(e);return!(t.byteLength<IT.length||t[0]!==IT[0]||t[1]!==IT[1]||t[2]!==IT[2]||t[3]!==IT[3]||t[4]!==IT[4]||t[5]!==IT[5]||t[6]!==IT[6]||t[7]!==IT[7]||t[8]!==IT[8]||t[9]!==IT[9]||t[10]!==IT[10]||t[11]!==IT[11])}var RT=Promise.resolve(),zT={etc1:{basisFormat:0,compressed:!0,format:wT,textureFormat:`etc1-rgb-unorm-webgl`},etc2:{basisFormat:1,compressed:!0,format:xT,textureFormat:`etc2-rgba8unorm`},bc1:{basisFormat:2,compressed:!0,format:yT,textureFormat:`bc1-rgb-unorm-webgl`},bc3:{basisFormat:3,compressed:!0,format:bT,textureFormat:`bc3-rgba-unorm`},bc4:{basisFormat:4,compressed:!0,format:OT,textureFormat:`bc4-r-unorm`},bc5:{basisFormat:5,compressed:!0,format:kT,textureFormat:`bc5-rg-unorm`},"bc7-m6-opaque-only":{basisFormat:6,compressed:!0,format:AT,textureFormat:`bc7-rgba-unorm`},"bc7-m5":{basisFormat:7,compressed:!0,format:AT,textureFormat:`bc7-rgba-unorm`},"pvrtc1-4-rgb":{basisFormat:8,compressed:!0,format:ST,textureFormat:`pvrtc-rgb4unorm-webgl`},"pvrtc1-4-rgba":{basisFormat:9,compressed:!0,format:CT,textureFormat:`pvrtc-rgba4unorm-webgl`},"astc-4x4":{basisFormat:10,compressed:!0,format:DT,textureFormat:`astc-4x4-unorm`},"atc-rgb":{basisFormat:11,compressed:!0,format:TT,textureFormat:`atc-rgb-unorm-webgl`},"atc-rgba-interpolated-alpha":{basisFormat:12,compressed:!0,format:ET,textureFormat:`atc-rgbai-unorm-webgl`},rgba32:{basisFormat:13,compressed:!1,format:_T,textureFormat:`rgba8unorm`},rgb565:{basisFormat:14,compressed:!1,format:vT,textureFormat:`rgb565unorm-webgl`},bgr565:{basisFormat:15,compressed:!1,format:vT,textureFormat:`rgb565unorm-webgl`},rgba4444:{basisFormat:16,compressed:!1,format:gT,textureFormat:`rgba4unorm-webgl`}};Object.freeze(Object.keys(zT));async function BT(e){let t=RT,n;RT=new Promise(e=>{n=e}),await t;try{return await e()}finally{n()}}async function VT(e,t={}){let n=Rp(t);return await BT(async()=>{if(!t.basis?.containerFormat||t.basis.containerFormat===`auto`){if(LT(e))return WT((await pT(n)).KTX2File,e,t);let{BasisFile:r}=await lT(n);return HT(r,e,t)}switch(t.basis.module){case`encoder`:let r=await pT(n);switch(t.basis.containerFormat){case`ktx2`:return WT(r.KTX2File,e,t);default:return HT(r.BasisFile,e,t)}default:let{BasisFile:i}=await lT(n);return HT(i,e,t)}})}function HT(e,t,n){let r=new e(new Uint8Array(t));try{if(!r.startTranscoding())throw Error(`Failed to start basis transcoding`);let e=r.getNumImages(),t=[];for(let i=0;i<e;i++){let e=r.getNumLevels(i),a=[];for(let t=0;t<e;t++)a.push(UT(r,i,t,n));t.push(a)}return t}finally{r.close(),r.delete()}}function UT(e,t,n,r){let i=e.getImageWidth(t,n),a=e.getImageHeight(t,n),o=e.getHasAlpha(),{compressed:s,format:c,basisFormat:l,textureFormat:u}=KT(r,o),d=e.getImageTranscodedSizeInBytes(t,n,l),f=new Uint8Array(d);if(!e.transcodeImage(f,t,n,l,0,0))throw Error(`failed to start Basis transcoding`);return{shape:`texture-level`,width:i,height:a,data:f,compressed:s,...c===void 0?{}:{format:c},...u===void 0?{}:{textureFormat:u},hasAlpha:o}}function WT(e,t,n){let r=new e(new Uint8Array(t));try{if(!r.startTranscoding())throw Error(`failed to start KTX2 transcoding`);let e=r.getLevels(),t=[];for(let i=0;i<e;i++)t.push(GT(r,i,n));return[t]}finally{r.close(),r.delete()}}function GT(e,t,n){let{alphaFlag:r,height:i,width:a}=e.getImageLevelInfo(t,0,0),{compressed:o,format:s,basisFormat:c,textureFormat:l}=KT(n,r),u=e.getImageTranscodedSizeInBytes(t,0,0,c),d=new Uint8Array(u);if(!e.transcodeImage(d,t,0,0,c,0,-1,-1))throw Error(`Failed to transcode KTX2 image`);return{shape:`texture-level`,width:a,height:i,data:d,compressed:o,...s===void 0?{}:{format:s},...l===void 0?{}:{textureFormat:l},levelSize:u,hasAlpha:r}}function KT(e,t){let n=e.basis?.format||`auto`;n===`auto`&&(n=e.basis?.supportedTextureFormats?qT(e.basis.supportedTextureFormats):qT()),typeof n==`object`&&(n=t?n.alpha:n.noAlpha);let r=zT[n.toLowerCase()];if(!r)throw Error(`Unknown Basis format ${n}`);return r}function qT(e=PT()){let t=new Set(e);return JT(t,[`astc-4x4-unorm`,`astc-4x4-unorm-srgb`])?`astc-4x4`:JT(t,[`bc7-rgba-unorm`,`bc7-rgba-unorm-srgb`])?{alpha:`bc7-m5`,noAlpha:`bc7-m6-opaque-only`}:JT(t,[`bc1-rgb-unorm-webgl`,`bc1-rgb-unorm-srgb-webgl`,`bc1-rgba-unorm`,`bc1-rgba-unorm-srgb`,`bc2-rgba-unorm`,`bc2-rgba-unorm-srgb`,`bc3-rgba-unorm`,`bc3-rgba-unorm-srgb`])?{alpha:`bc3`,noAlpha:`bc1`}:JT(t,[`pvrtc-rgb4unorm-webgl`,`pvrtc-rgba4unorm-webgl`,`pvrtc-rgb2unorm-webgl`,`pvrtc-rgba2unorm-webgl`])?{alpha:`pvrtc1-4-rgba`,noAlpha:`pvrtc1-4-rgb`}:JT(t,[`etc2-rgb8unorm`,`etc2-rgb8unorm-srgb`,`etc2-rgb8a1unorm`,`etc2-rgb8a1unorm-srgb`,`etc2-rgba8unorm`,`etc2-rgba8unorm-srgb`,`eac-r11unorm`,`eac-r11snorm`,`eac-rg11unorm`,`eac-rg11snorm`])?`etc2`:t.has(`etc1-rgb-unorm-webgl`)?`etc1`:JT(t,[`atc-rgb-unorm-webgl`,`atc-rgba-unorm-webgl`,`atc-rgbai-unorm-webgl`])?{alpha:`atc-rgba-interpolated-alpha`,noAlpha:`atc-rgb`}:`rgb565`}function JT(e,t){return t.some(t=>e.has(t))}var YT={dataType:null,batchType:null,name:`Basis`,id:`basis`,module:`textures`,version:oT,worker:!0,extensions:[`basis`,`ktx2`],mimeTypes:[`application/octet-stream`,`image/ktx2`],tests:[`sB`],binary:!0,options:{basis:{format:`auto`,containerFormat:`auto`,module:`transcoder`}},parse:VT};function XT(e,t){if(!e)throw Error(t||`assert failed: gltf`)}var ZT=!0,QT=1735152710,$T=12,eE=8,tE=1313821514,nE=5130562,rE=0,iE=0,aE=1;function oE(e,t=0){return`\
${String.fromCharCode(e.getUint8(t+0))}\
${String.fromCharCode(e.getUint8(t+1))}\
${String.fromCharCode(e.getUint8(t+2))}\
${String.fromCharCode(e.getUint8(t+3))}`}function sE(e,t=0,n={}){let r=new DataView(e),{magic:i=QT}=n,a=r.getUint32(t,!1);return a===i||a===QT}function cE(e,t,n=0,r={}){let i=new DataView(t),a=oE(i,n+0),o=i.getUint32(n+4,ZT),s=i.getUint32(n+8,ZT);switch(Object.assign(e,{header:{byteOffset:n,byteLength:s,hasBinChunk:!1},type:a,version:o,json:{},binChunks:[]}),n+=$T,e.version){case 1:return lE(e,i,n);case 2:return uE(e,i,n,r={});default:throw Error(`Invalid GLB version ${e.version}. Only supports version 1 and 2.`)}}function lE(e,t,n){H(e.header.byteLength>20);let r=t.getUint32(n+0,ZT),i=t.getUint32(n+4,ZT);return n+=eE,H(i===rE),fE(e,t,n,r),n+=r,n+=pE(e,t,n,e.header.byteLength),n}function uE(e,t,n,r){return H(e.header.byteLength>20),dE(e,t,n,r),n+e.header.byteLength}function dE(e,t,n,r){for(;n+8<=e.header.byteLength;){let i=t.getUint32(n+0,ZT),a=t.getUint32(n+4,ZT);switch(n+=eE,a){case tE:fE(e,t,n,i);break;case nE:pE(e,t,n,i);break;case iE:r.strict||fE(e,t,n,i);break;case aE:r.strict||pE(e,t,n,i);break;default:break}n+=tm(i,4)}return n}function fE(e,t,n,r){let i=new Uint8Array(t.buffer,n,r),a=new TextDecoder(`utf8`).decode(i);return e.json=JSON.parse(a),tm(r,4)}function pE(e,t,n,r){return e.header.hasBinChunk=!0,e.binChunks.push({byteOffset:n,byteLength:r,arrayBuffer:t.buffer}),tm(r,4)}function mE(e,t,n){if(e.startsWith(`data:`)||e.startsWith(`http:`)||e.startsWith(`https:`))return e;let r=n?.baseUrl||hE(t?.core?.baseUrl);if(!r)throw Error(`'baseUrl' must be provided to resolve relative url ${e}`);return r.endsWith(`/`)?`${r}${e}`:`${r}/${e}`}function hE(e){if(!e)return;if(e.endsWith(`/`))return e;let t=e.lastIndexOf(`/`);return t>=0?e.slice(0,t+1):``}var gE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},_E={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},vE=1.33,yE=[`SCALAR`,`VEC2`,`VEC3`,`VEC4`],bE=new Map([[Int8Array,5120],[Uint8Array,5121],[Int16Array,5122],[Uint16Array,5123],[Uint32Array,5125],[Float32Array,5126],[Float64Array,5130]]),xE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},SE={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},CE={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};function wE(e){return yE[e-1]||yE[0]}function TE(e){let t=bE.get(e.constructor);if(!t)throw Error(`Illegal typed array`);return t}function EE(e,t){let n=CE[e.componentType],r=xE[e.type],i=SE[e.componentType],a=e.count*r,o=e.count*r*i;return XT(o>=0&&o<=t.byteLength),{ArrayType:n,length:a,byteLength:o,componentByteSize:_E[e.componentType],numberOfComponentsInElement:gE[e.type]}}function DE(e){let{images:t,bufferViews:n}=e;t||=[],n||=[];let r=t.map(e=>e.bufferView);n=n.filter(e=>!r.includes(e));let i=n.reduce((e,t)=>e+t.byteLength,0),a=t.reduce((e,t)=>{let{width:n,height:r}=t.image;return e+n*r},0);return i+Math.ceil(4*a*vE)}function OE(e,t,n){let r=e.bufferViews[n];XT(r);let i=t[r.buffer];XT(i);let a=(r.byteOffset||0)+i.byteOffset;return new Uint8Array(i.arrayBuffer,a,r.byteLength)}function kE(e,t,n){let r=typeof n==`number`?e.accessors?.[n]:n;if(!r)throw Error(`No gltf accessor ${JSON.stringify(n)}`);let i=e.bufferViews?.[r.bufferView||0];if(!i)throw Error(`No gltf buffer view for accessor ${i}`);let{arrayBuffer:a,byteOffset:o}=t[i.buffer],s=(o||0)+(r.byteOffset||0)+(i.byteOffset||0),{ArrayType:c,length:l,componentByteSize:u,numberOfComponentsInElement:d}=EE(r,i),f=u*d,p=i.byteStride||f;if(i.byteStride===void 0||i.byteStride===f)return new c(a,s,l);let m=new c(l);for(let e=0;e<r.count;e++){let t=new c(a,s+e*p,d);m.set(t,e*d)}return m}function AE(){return{asset:{version:`2.0`,generator:`loaders.gl`},buffers:[],extensions:{},extensionsRequired:[],extensionsUsed:[]}}var q=class{gltf;sourceBuffers;byteLength;constructor(e){this.gltf={json:e?.json||AE(),buffers:e?.buffers||[],images:e?.images||[]},this.sourceBuffers=[],this.byteLength=0,this.gltf.buffers&&this.gltf.buffers[0]&&(this.byteLength=this.gltf.buffers[0].byteLength,this.sourceBuffers=[this.gltf.buffers[0]])}get json(){return this.gltf.json}getApplicationData(e){return this.json[e]}getExtraData(e){return(this.json.extras||{})[e]}hasExtension(e){let t=this.getUsedExtensions().find(t=>t===e),n=this.getRequiredExtensions().find(t=>t===e);return typeof t==`string`||typeof n==`string`}getExtension(e){let t=this.getUsedExtensions().find(t=>t===e),n=this.json.extensions||{};return t?n[e]:null}getRequiredExtension(e){return this.getRequiredExtensions().find(t=>t===e)?this.getExtension(e):null}getRequiredExtensions(){return this.json.extensionsRequired||[]}getUsedExtensions(){return this.json.extensionsUsed||[]}getRemovedExtensions(){return this.json.extensionsRemoved||[]}getObjectExtension(e,t){return(e.extensions||{})[t]}getScene(e){return this.getObject(`scenes`,e)}getNode(e){return this.getObject(`nodes`,e)}getSkin(e){return this.getObject(`skins`,e)}getMesh(e){return this.getObject(`meshes`,e)}getMaterial(e){return this.getObject(`materials`,e)}getAccessor(e){return this.getObject(`accessors`,e)}getTexture(e){return this.getObject(`textures`,e)}getSampler(e){return this.getObject(`samplers`,e)}getImage(e){return this.getObject(`images`,e)}getBufferView(e){return this.getObject(`bufferViews`,e)}getBuffer(e){return this.getObject(`buffers`,e)}getObject(e,t){if(typeof t==`object`)return t;let n=this.json[e]&&this.json[e][t];if(!n)throw Error(`glTF file error: Could not find ${e}[${t}]`);return n}getTypedArrayForBufferView(e){e=this.getBufferView(e);let t=e.buffer,n=this.gltf.buffers[t];XT(n);let r=(e.byteOffset||0)+n.byteOffset;return new Uint8Array(n.arrayBuffer,r,e.byteLength)}getTypedArrayForAccessor(e){let t=this.getAccessor(e);return kE(this.gltf.json,this.gltf.buffers,t)}getTypedArrayForImageData(e){e=this.getAccessor(e);let t=this.getBufferView(e.bufferView),n=this.getBuffer(t.buffer).data,r=t.byteOffset||0;return new Uint8Array(n,r,t.byteLength)}addApplicationData(e,t){return this.json[e]=t,this}addExtraData(e,t){return this.json.extras=this.json.extras||{},this.json.extras[e]=t,this}addObjectExtension(e,t,n){return e.extensions=e.extensions||{},e.extensions[t]=n,this.registerUsedExtension(t),this}setObjectExtension(e,t,n){let r=e.extensions||{};r[t]=n}removeObjectExtension(e,t){let n=e?.extensions||{};if(n[t]){this.json.extensionsRemoved=this.json.extensionsRemoved||[];let e=this.json.extensionsRemoved;e.includes(t)||e.push(t)}delete n[t]}addExtension(e,t={}){return XT(t),this.json.extensions=this.json.extensions||{},this.json.extensions[e]=t,this.registerUsedExtension(e),t}addRequiredExtension(e,t={}){return XT(t),this.addExtension(e,t),this.registerRequiredExtension(e),t}registerUsedExtension(e){this.json.extensionsUsed=this.json.extensionsUsed||[],this.json.extensionsUsed.find(t=>t===e)||this.json.extensionsUsed.push(e)}registerRequiredExtension(e){this.registerUsedExtension(e),this.json.extensionsRequired=this.json.extensionsRequired||[],this.json.extensionsRequired.find(t=>t===e)||this.json.extensionsRequired.push(e)}removeExtension(e){if(this.json.extensions?.[e]){this.json.extensionsRemoved=this.json.extensionsRemoved||[];let t=this.json.extensionsRemoved;t.includes(e)||t.push(e)}this.json.extensions&&delete this.json.extensions[e],this.json.extensionsRequired&&this._removeStringFromArray(this.json.extensionsRequired,e),this.json.extensionsUsed&&this._removeStringFromArray(this.json.extensionsUsed,e)}setDefaultScene(e){this.json.scene=e}addScene(e){let{nodeIndices:t}=e;return this.json.scenes=this.json.scenes||[],this.json.scenes.push({nodes:t}),this.json.scenes.length-1}addNode(e){let{meshIndex:t,matrix:n}=e;this.json.nodes=this.json.nodes||[];let r={mesh:t};return n&&(r.matrix=n),this.json.nodes.push(r),this.json.nodes.length-1}addMesh(e){let{attributes:t,indices:n,material:r,mode:i=4}=e,a={primitives:[{attributes:this._addAttributes(t),mode:i}]};if(n){let e=this._addIndices(n);a.primitives[0].indices=e}return Number.isFinite(r)&&(a.primitives[0].material=r),this.json.meshes=this.json.meshes||[],this.json.meshes.push(a),this.json.meshes.length-1}addPointCloud(e){let t={primitives:[{attributes:this._addAttributes(e),mode:0}]};return this.json.meshes=this.json.meshes||[],this.json.meshes.push(t),this.json.meshes.length-1}addImage(e,t){let n=Zg(e),r=t||n?.mimeType,i={bufferView:this.addBufferView(e),mimeType:r};return this.json.images=this.json.images||[],this.json.images.push(i),this.json.images.length-1}addBufferView(e,t=0,n=this.byteLength){let r=e.byteLength;XT(Number.isFinite(r)),this.sourceBuffers=this.sourceBuffers||[],this.sourceBuffers.push(e);let i={buffer:t,byteOffset:n,byteLength:r};return this.byteLength+=tm(r,4),this.json.bufferViews=this.json.bufferViews||[],this.json.bufferViews.push(i),this.json.bufferViews.length-1}addAccessor(e,t){let n={bufferView:e,type:wE(t.size),componentType:t.componentType,count:t.count,max:t.max,min:t.min};return this.json.accessors=this.json.accessors||[],this.json.accessors.push(n),this.json.accessors.length-1}addBinaryBuffer(e,t={size:3}){let n=this.addBufferView(e),r={min:t.min,max:t.max};(!r.min||!r.max)&&(r=this._getAccessorMinMax(e,t.size));let i={size:t.size,componentType:TE(e),count:Math.round(e.length/t.size),min:r.min,max:r.max};return this.addAccessor(n,Object.assign(i,t))}addTexture(e){let{imageIndex:t}=e,n={source:t};return this.json.textures=this.json.textures||[],this.json.textures.push(n),this.json.textures.length-1}addMaterial(e){return this.json.materials=this.json.materials||[],this.json.materials.push(e),this.json.materials.length-1}createBinaryChunk(){let e=this.byteLength,t=new ArrayBuffer(e),n=new Uint8Array(t),r=0;for(let e of this.sourceBuffers||[])r=nm(e,n,r);this.json?.buffers?.[0]?this.json.buffers[0].byteLength=e:this.json.buffers=[{byteLength:e}],this.gltf.binary=t,this.sourceBuffers=[t],this.gltf.buffers=[{arrayBuffer:t,byteOffset:0,byteLength:t.byteLength}]}_removeStringFromArray(e,t){let n=!0;for(;n;){let r=e.indexOf(t);r>-1?e.splice(r,1):n=!1}}_addAttributes(e={}){let t={};for(let n in e){let r=e[n],i=this._getGltfAttributeName(n);t[i]=this.addBinaryBuffer(r.value,r)}return t}_addIndices(e){return this.addBinaryBuffer(e,{size:1})}_getGltfAttributeName(e){switch(e.toLowerCase()){case`position`:case`positions`:case`vertices`:return`POSITION`;case`normal`:case`normals`:return`NORMAL`;case`color`:case`colors`:return`COLOR_0`;case`texcoord`:case`texcoords`:return`TEXCOORD_0`;default:return e}}_getAccessorMinMax(e,t){let n={min:null,max:null};if(e.length<t)return n;n.min=[],n.max=[];let r=e.subarray(0,t);for(let e of r)n.min.push(e),n.max.push(e);for(let r=t;r<e.length;r+=t)for(let i=0;i<t;i++)n.min[0+i]=Math.min(n.min[0+i],e[r+i]),n.max[0+i]=Math.max(n.max[0+i],e[r+i]);return n}};function jE(e){return(e%1+1)%1}var ME={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16,BOOLEAN:1,STRING:1,ENUM:1},NE={INT8:Int8Array,UINT8:Uint8Array,INT16:Int16Array,UINT16:Uint16Array,INT32:Int32Array,UINT32:Uint32Array,INT64:BigInt64Array,UINT64:BigUint64Array,FLOAT32:Float32Array,FLOAT64:Float64Array},PE={INT8:1,UINT8:1,INT16:2,UINT16:2,INT32:4,UINT32:4,INT64:8,UINT64:8,FLOAT32:4,FLOAT64:8};function FE(e,t){return PE[t]*ME[e]}function IE(e,t,n,r){if(n!==`UINT8`&&n!==`UINT16`&&n!==`UINT32`&&n!==`UINT64`)return null;let i=LE(e.getTypedArrayForBufferView(t),`SCALAR`,n,r+1);return i instanceof BigInt64Array||i instanceof BigUint64Array?null:i}function LE(e,t,n,r=1){let i=ME[t],a=NE[n],o=PE[n],s=r*i,c=s*o,l=e.buffer,u=e.byteOffset;return u%o!==0&&(l=new Uint8Array(l).slice(u,u+c).buffer,u=0),new a(ym(l),u,s)}function RE(e,t,n){let r=`TEXCOORD_${t.texCoord||0}`,i=n.attributes[r],a=e.getTypedArrayForAccessor(i),o=e.gltf.json,s=t.index,c=o.textures?.[s]?.source;if(c!==void 0){let n=o.images?.[c]?.mimeType,r=e.gltf.images?.[c];if(r&&r.width!==void 0){let e=[];for(let i=0;i<a.length;i+=2){let o=BE(r,n,a,i,t.channels);e.push(o)}return e}}return[]}function zE(e,t,n,r,i){if(!n?.length)return;let a=[];for(let e of n){let t=r.findIndex(t=>t===e);t===-1&&(t=r.push(e)-1),a.push(t)}let o=new Uint32Array(a),s=e.gltf.buffers.push({arrayBuffer:o.buffer,byteOffset:o.byteOffset,byteLength:o.byteLength})-1,c=e.addBufferView(o,s,0),l=e.addAccessor(c,{size:1,componentType:TE(o),count:o.length});i.attributes[t]=l}function BE(e,t,n,r,i=[0]){let a={r:{offset:0,shift:0},g:{offset:1,shift:8},b:{offset:2,shift:16},a:{offset:3,shift:24}},o=n[r],s=n[r+1],c=1;t&&(t.indexOf(`image/jpeg`)!==-1||t.indexOf(`image/png`)!==-1)&&(c=4);let l=VE(o,s,e,c),u=0;for(let t of i){let n=typeof t==`number`?Object.values(a)[t]:a[t],r=l+n.offset,i=jg(e);if(i.data.length<=r)throw Error(`${i.data.length} <= ${r}`);let o=i.data[r];u|=o<<n.shift}return u}function VE(e,t,n,r=1){let i=n.width,a=jE(e)*(i-1),o=Math.round(a),s=n.height,c=jE(t)*(s-1),l=Math.round(c),u=n.components?n.components:r;return(l*i+o)*u}function HE(e,t,n,r,i){let a=[];for(let o=0;o<t;o++){let t=n[o],s=n[o+1]-n[o];if(s+t>r)break;let c=t/i,l=s/i;a.push(e.slice(c,c+l))}return a}function UE(e,t,n){let r=[];for(let i=0;i<t;i++){let t=i*n;r.push(e.slice(t,t+n))}return r}function WE(e,t,n,r){if(n)throw Error(`Not implemented - arrayOffsets for strings is specified`);if(r){let n=[],i=new TextDecoder(`utf8`),a=0;for(let o=0;o<e;o++){let e=r[o+1]-r[o];if(e+a<=t.length){let r=t.subarray(a,e+a),o=i.decode(r);n.push(o),a+=e}}return n}return[]}var GE=e({createExtMeshFeatures:()=>$E,decode:()=>JE,encode:()=>YE,name:()=>qE}),KE=`EXT_mesh_features`,qE=KE;async function JE(e,t){XE(new q(e),t)}function YE(e,t){let n=new q(e);return QE(n,t),n.createBinaryChunk(),n.gltf}function XE(e,t){let n=e.gltf.json;if(n.meshes)for(let r of n.meshes)for(let n of r.primitives)ZE(e,n,t)}function ZE(e,t,n){if(!n?.gltf?.loadBuffers)return;let r=t.extensions?.[KE]?.featureIds;if(r)for(let i of r){let r;if(i.attribute!==void 0){let n=`_FEATURE_ID_${i.attribute}`,a=t.attributes[n];r=e.getTypedArrayForAccessor(a)}else r=i.texture!==void 0&&n?.gltf?.loadImages?RE(e,i.texture,t):[];i.data=r}}function QE(e,t){let n=e.gltf.json.meshes;if(n)for(let t of n)for(let n of t.primitives)eD(e,n)}function $E(e,t,n,r){t.extensions||={};let i=t.extensions[KE];i||(i={featureIds:[]},t.extensions[KE]=i);let{featureIds:a}=i,o={featureCount:n.length,propertyTable:r,data:n};a.push(o),e.addObjectExtension(t,KE,i)}function eD(e,t){let n=t.extensions?.[KE];if(!n)return;let r=n.featureIds;r.forEach((n,i)=>{if(n.data){let{accessorKey:a,index:o}=tD(t.attributes),s=new Uint32Array(n.data);r[i]={featureCount:s.length,propertyTable:n.propertyTable,attribute:o},e.gltf.buffers.push({arrayBuffer:s.buffer,byteOffset:s.byteOffset,byteLength:s.byteLength});let c=e.addBufferView(s),l=e.addAccessor(c,{size:1,componentType:TE(s),count:s.length});t.attributes[a]=l}})}function tD(e){let t=`_FEATURE_ID_`,n=Object.keys(e).filter(e=>e.indexOf(t)===0),r=-1;for(let e of n){let t=Number(e.substring(12));t>r&&(r=t)}return r++,{accessorKey:`${t}${r}`,index:r}}var nD=e({createExtStructuralMetadata:()=>ED,decode:()=>aD,encode:()=>oD,name:()=>iD}),rD=`EXT_structural_metadata`,iD=rD;async function aD(e,t){sD(new q(e),t)}function oD(e,t){let n=new q(e);return wD(n,t),n.createBinaryChunk(),n.gltf}function sD(e,t){if(!t.gltf?.loadBuffers)return;let n=e.getExtension(rD);n&&(t.gltf?.loadImages&&cD(e,n),lD(e,n))}function cD(e,t){let n=t.propertyTextures,r=e.gltf.json;if(n&&r.meshes)for(let i of r.meshes)for(let r of i.primitives)dD(e,n,r,t)}function lD(e,t){let n=t.schema;if(!n)return;let r=n.classes,i=t.propertyTables;if(r&&i)for(let t in r){let r=uD(i,t);r&&pD(e,n,r)}}function uD(e,t){for(let n of e)if(n.class===t)return n;return null}function dD(e,t,n,r){if(!t)return;let i=n.extensions?.[rD]?.propertyTextures;if(i)for(let a of i){let i=t[a];fD(e,i,n,r)}}function fD(e,t,n,r){if(!t.properties)return;r.dataAttributeNames||=[];let i=t.class;for(let a in t.properties){let o=`${i}_${a}`,s=t.properties?.[a];if(!s)continue;s.data||=[];let c=s.data,l=RE(e,s,n);l!==null&&(zE(e,o,l,c,n),s.data=c,r.dataAttributeNames.push(o))}}function pD(e,t,n){let r=t.classes?.[n.class];if(!r)throw Error(`Incorrect data in the EXT_structural_metadata extension: no schema class with name ${n.class}`);let i=n.count;for(let a in r.properties){let o=r.properties[a],s=n.properties?.[a];s&&(s.data=mD(e,t,o,i,s))}}function mD(e,t,n,r,i){let a=[],o=i.values,s=e.getTypedArrayForBufferView(o),c=hD(e,n,i,r),l=gD(e,i,r);switch(n.type){case`SCALAR`:case`VEC2`:case`VEC3`:case`VEC4`:case`MAT2`:case`MAT3`:case`MAT4`:a=_D(n,r,s,c);break;case`BOOLEAN`:throw Error(`Not implemented - classProperty.type=${n.type}`);case`STRING`:a=WE(r,s,c,l);break;case`ENUM`:a=vD(t,n,r,s,c);break;default:throw Error(`Unknown classProperty type ${n.type}`)}return a}function hD(e,t,n,r){return t.array&&t.count===void 0&&n.arrayOffsets!==void 0?IE(e,n.arrayOffsets,n.arrayOffsetType||`UINT32`,r):null}function gD(e,t,n){return t.stringOffsets===void 0?null:IE(e,t.stringOffsets,t.stringOffsetType||`UINT32`,n)}function _D(e,t,n,r){let i=e.array,a=e.count,o=FE(e.type,e.componentType),s=n.byteLength/o,c;return c=e.componentType?LE(n,e.type,e.componentType,s):n,i?r?HE(c,t,r,n.length,o):a?UE(c,t,a):[]:c}function vD(e,t,n,r,i){let a=t.enumType;if(!a)throw Error(`Incorrect data in the EXT_structural_metadata extension: classProperty.enumType is not set for type ENUM`);let o=e.enums?.[a];if(!o)throw Error(`Incorrect data in the EXT_structural_metadata extension: schema.enums does't contain ${a}`);let s=o.valueType||`UINT16`,c=FE(t.type,s),l=r.byteLength/c,u=LE(r,t.type,s,l);if(u||=r,t.array){if(i)return yD({valuesData:u,numberOfElements:n,arrayOffsets:i,valuesDataBytesLength:r.length,elementSize:c,enumEntry:o});let e=t.count;return e?bD(u,n,e,o):[]}return xD(u,0,n,o)}function yD(e){let{valuesData:t,numberOfElements:n,arrayOffsets:r,valuesDataBytesLength:i,elementSize:a,enumEntry:o}=e,s=[];for(let e=0;e<n;e++){let n=r[e],c=r[e+1]-r[e];if(c+n>i)break;let l=xD(t,n/a,c/a,o);s.push(l)}return s}function bD(e,t,n,r){let i=[];for(let a=0;a<t;a++){let t=xD(e,n*a,n,r);i.push(t)}return i}function xD(e,t,n,r){let i=[];for(let a=0;a<n;a++)if(e instanceof BigInt64Array||e instanceof BigUint64Array)i.push(``);else{let n=e[t+a],o=SD(r,n);o?i.push(o.name):i.push(``)}return i}function SD(e,t){for(let n of e.values)if(n.value===t)return n;return null}var CD=`schemaClassId`;function wD(e,t){let n=e.getExtension(rD);if(n&&n.propertyTables)for(let t of n.propertyTables){let r=t.class,i=n.schema?.classes?.[r];t.properties&&i&&TD(t,i,e)}}function TD(e,t,n){for(let r in e.properties){let i=e.properties[r].data;if(i){let a=t.properties[r];if(a){let t=kD(i,a,n);e.properties[r]=t}}}}function ED(e,t,n=CD){let r=e.getExtension(rD);r||=e.addExtension(rD),r.schema=DD(t,n,r.schema);let i=OD(t,n,r.schema);return r.propertyTables||=[],r.propertyTables.push(i)-1}function DD(e,t,n){let r=n??{id:`schema_id`},i={properties:{}};for(let t of e){let e={type:t.elementType,componentType:t.componentType};i.properties[t.name]=e}return r.classes={},r.classes[t]=i,r}function OD(e,t,n){let r={class:t,count:0},i=0,a=n.classes?.[t];for(let t of e){if(i===0&&(i=t.values.length),i!==t.values.length&&t.values.length)throw Error(`Illegal values in attributes`);a?.properties[t.name]&&(r.properties||={},r.properties[t.name]={values:0,data:t.values})}return r.count=i,r}function kD(e,t,n){let r={values:0};if(t.type===`STRING`){let{stringData:t,stringOffsets:i}=MD(e);r.stringOffsets=ND(i,n),r.values=ND(t,n)}else t.type===`SCALAR`&&t.componentType&&(r.values=ND(jD(e,t.componentType),n));return r}var AD={INT8:Int8Array,UINT8:Uint8Array,INT16:Int16Array,UINT16:Uint16Array,INT32:Int32Array,UINT32:Uint32Array,INT64:Int32Array,UINT64:Uint32Array,FLOAT32:Float32Array,FLOAT64:Float64Array};function jD(e,t){let n=[];for(let t of e)n.push(Number(t));let r=AD[t];if(!r)throw Error(`Illegal component type`);return new r(n)}function MD(e){let t=new TextEncoder,n=[],r=0;for(let i of e){let e=t.encode(i);r+=e.length,n.push(e)}let i=new Uint8Array(r),a=[],o=0;for(let e of n)i.set(e,o),a.push(o),o+=e.length;return a.push(o),{stringData:i,stringOffsets:new Uint32Array(a)}}function ND(e,t){return t.gltf.buffers.push({arrayBuffer:ym(e.buffer),byteOffset:e.byteOffset,byteLength:e.byteLength}),t.addBufferView(e)}var PD=`B9h9z9tFBBBF8fL9gBB9gLaaaaaFa9gEaaaB9gFaFa9gEaaaFaEMcBFFFGGGEIIILF9wFFFLEFBFKNFaFCx/IFMO/LFVK9tv9t9vq95GBt9f9f939h9z9t9f9j9h9s9s9f9jW9vq9zBBp9tv9z9o9v9wW9f9kv9j9v9kv9WvqWv94h919m9mvqBF8Z9tv9z9o9v9wW9f9kv9j9v9kv9J9u9kv94h919m9mvqBGy9tv9z9o9v9wW9f9kv9j9v9kv9J9u9kv949TvZ91v9u9jvBEn9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9P9jWBIi9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9R919hWBLn9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9F949wBKI9z9iqlBOc+x8ycGBM/qQFTa8jUUUUBCU/EBlHL8kUUUUBC9+RKGXAGCFJAI9LQBCaRKAE2BBC+gF9HQBALAEAIJHOAGlAGTkUUUBRNCUoBAG9uC/wgBZHKCUGAKCUG9JyRVAECFJRICBRcGXEXAcAF9PQFAVAFAclAcAVJAF9JyRMGXGXAG9FQBAMCbJHKC9wZRSAKCIrCEJCGrRQANCUGJRfCBRbAIRTEXGXAOATlAQ9PQBCBRISEMATAQJRIGXAS9FQBCBRtCBREEXGXAOAIlCi9PQBCBRISLMANCU/CBJAEJRKGXGXGXGXGXATAECKrJ2BBAtCKZrCEZfIBFGEBMAKhB83EBAKCNJhB83EBSEMAKAI2BIAI2BBHmCKrHYAYCE6HYy86BBAKCFJAICIJAYJHY2BBAmCIrCEZHPAPCE6HPy86BBAKCGJAYAPJHY2BBAmCGrCEZHPAPCE6HPy86BBAKCEJAYAPJHY2BBAmCEZHmAmCE6Hmy86BBAKCIJAYAmJHY2BBAI2BFHmCKrHPAPCE6HPy86BBAKCLJAYAPJHY2BBAmCIrCEZHPAPCE6HPy86BBAKCKJAYAPJHY2BBAmCGrCEZHPAPCE6HPy86BBAKCOJAYAPJHY2BBAmCEZHmAmCE6Hmy86BBAKCNJAYAmJHY2BBAI2BGHmCKrHPAPCE6HPy86BBAKCVJAYAPJHY2BBAmCIrCEZHPAPCE6HPy86BBAKCcJAYAPJHY2BBAmCGrCEZHPAPCE6HPy86BBAKCMJAYAPJHY2BBAmCEZHmAmCE6Hmy86BBAKCSJAYAmJHm2BBAI2BEHICKrHYAYCE6HYy86BBAKCQJAmAYJHm2BBAICIrCEZHYAYCE6HYy86BBAKCfJAmAYJHm2BBAICGrCEZHYAYCE6HYy86BBAKCbJAmAYJHK2BBAICEZHIAICE6HIy86BBAKAIJRISGMAKAI2BNAI2BBHmCIrHYAYCb6HYy86BBAKCFJAICNJAYJHY2BBAmCbZHmAmCb6Hmy86BBAKCGJAYAmJHm2BBAI2BFHYCIrHPAPCb6HPy86BBAKCEJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCIJAmAYJHm2BBAI2BGHYCIrHPAPCb6HPy86BBAKCLJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCKJAmAYJHm2BBAI2BEHYCIrHPAPCb6HPy86BBAKCOJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCNJAmAYJHm2BBAI2BIHYCIrHPAPCb6HPy86BBAKCVJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCcJAmAYJHm2BBAI2BLHYCIrHPAPCb6HPy86BBAKCMJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCSJAmAYJHm2BBAI2BKHYCIrHPAPCb6HPy86BBAKCQJAmAPJHm2BBAYCbZHYAYCb6HYy86BBAKCfJAmAYJHm2BBAI2BOHICIrHYAYCb6HYy86BBAKCbJAmAYJHK2BBAICbZHIAICb6HIy86BBAKAIJRISFMAKAI8pBB83BBAKCNJAICNJ8pBB83BBAICTJRIMAtCGJRtAECTJHEAS9JQBMMGXAIQBCBRISEMGXAM9FQBANAbJ2BBRtCBRKAfREEXAEANCU/CBJAKJ2BBHTCFrCBATCFZl9zAtJHt86BBAEAGJREAKCFJHKAM9HQBMMAfCFJRfAIRTAbCFJHbAG9HQBMMABAcAG9sJANCUGJAMAG9sTkUUUBpANANCUGJAMCaJAG9sJAGTkUUUBpMAMCBAIyAcJRcAIQBMC9+RKSFMCBC99AOAIlAGCAAGCA9Ly6yRKMALCU/EBJ8kUUUUBAKM+OmFTa8jUUUUBCoFlHL8kUUUUBC9+RKGXAFCE9uHOCtJAI9LQBCaRKAE2BBHNC/wFZC/gF9HQBANCbZHVCF9LQBALCoBJCgFCUFT+JUUUBpALC84Jha83EBALC8wJha83EBALC8oJha83EBALCAJha83EBALCiJha83EBALCTJha83EBALha83ENALha83EBAEAIJC9wJRcAECFJHNAOJRMGXAF9FQBCQCbAVCF6yRSABRECBRVCBRQCBRfCBRICBRKEXGXAMAcuQBC9+RKSEMGXGXAN2BBHOC/vF9LQBALCoBJAOCIrCa9zAKJCbZCEWJHb8oGIRTAb8oGBRtGXAOCbZHbAS9PQBALAOCa9zAIJCbZCGWJ8oGBAVAbyROAb9FRbGXGXAGCG9HQBABAt87FBABCIJAO87FBABCGJAT87FBSFMAEAtjGBAECNJAOjGBAECIJATjGBMAVAbJRVALCoBJAKCEWJHmAOjGBAmATjGIALAICGWJAOjGBALCoBJAKCFJCbZHKCEWJHTAtjGBATAOjGIAIAbJRIAKCFJRKSGMGXGXAbCb6QBAQAbJAbC989zJCFJRQSFMAM1BBHbCgFZROGXGXAbCa9MQBAMCFJRMSFMAM1BFHbCgBZCOWAOCgBZqROGXAbCa9MQBAMCGJRMSFMAM1BGHbCgBZCfWAOqROGXAbCa9MQBAMCEJRMSFMAM1BEHbCgBZCdWAOqROGXAbCa9MQBAMCIJRMSFMAM2BIC8cWAOqROAMCLJRMMAOCFrCBAOCFZl9zAQJRQMGXGXAGCG9HQBABAt87FBABCIJAQ87FBABCGJAT87FBSFMAEAtjGBAECNJAQjGBAECIJATjGBMALCoBJAKCEWJHOAQjGBAOATjGIALAICGWJAQjGBALCoBJAKCFJCbZHKCEWJHOAtjGBAOAQjGIAICFJRIAKCFJRKSFMGXAOCDF9LQBALAIAcAOCbZJ2BBHbCIrHTlCbZCGWJ8oGBAVCFJHtATyROALAIAblCbZCGWJ8oGBAtAT9FHmJHtAbCbZHTyRbAT9FRTGXGXAGCG9HQBABAV87FBABCIJAb87FBABCGJAO87FBSFMAEAVjGBAECNJAbjGBAECIJAOjGBMALAICGWJAVjGBALCoBJAKCEWJHYAOjGBAYAVjGIALAICFJHICbZCGWJAOjGBALCoBJAKCFJCbZCEWJHYAbjGBAYAOjGIALAIAmJCbZHICGWJAbjGBALCoBJAKCGJCbZHKCEWJHOAVjGBAOAbjGIAKCFJRKAIATJRIAtATJRVSFMAVCBAM2BBHYyHTAOC/+F6HPJROAYCbZRtGXGXAYCIrHmQBAOCFJRbSFMAORbALAIAmlCbZCGWJ8oGBROMGXGXAtQBAbCFJRVSFMAbRVALAIAYlCbZCGWJ8oGBRbMGXGXAP9FQBAMCFJRYSFMAM1BFHYCgFZRTGXGXAYCa9MQBAMCGJRYSFMAM1BGHYCgBZCOWATCgBZqRTGXAYCa9MQBAMCEJRYSFMAM1BEHYCgBZCfWATqRTGXAYCa9MQBAMCIJRYSFMAM1BIHYCgBZCdWATqRTGXAYCa9MQBAMCLJRYSFMAMCKJRYAM2BLC8cWATqRTMATCFrCBATCFZl9zAQJHQRTMGXGXAmCb6QBAYRPSFMAY1BBHMCgFZROGXGXAMCa9MQBAYCFJRPSFMAY1BFHMCgBZCOWAOCgBZqROGXAMCa9MQBAYCGJRPSFMAY1BGHMCgBZCfWAOqROGXAMCa9MQBAYCEJRPSFMAY1BEHMCgBZCdWAOqROGXAMCa9MQBAYCIJRPSFMAYCLJRPAY2BIC8cWAOqROMAOCFrCBAOCFZl9zAQJHQROMGXGXAtCb6QBAPRMSFMAP1BBHMCgFZRbGXGXAMCa9MQBAPCFJRMSFMAP1BFHMCgBZCOWAbCgBZqRbGXAMCa9MQBAPCGJRMSFMAP1BGHMCgBZCfWAbqRbGXAMCa9MQBAPCEJRMSFMAP1BEHMCgBZCdWAbqRbGXAMCa9MQBAPCIJRMSFMAPCLJRMAP2BIC8cWAbqRbMAbCFrCBAbCFZl9zAQJHQRbMGXGXAGCG9HQBABAT87FBABCIJAb87FBABCGJAO87FBSFMAEATjGBAECNJAbjGBAECIJAOjGBMALCoBJAKCEWJHYAOjGBAYATjGIALAICGWJATjGBALCoBJAKCFJCbZCEWJHYAbjGBAYAOjGIALAICFJHICbZCGWJAOjGBALCoBJAKCGJCbZCEWJHOATjGBAOAbjGIALAIAm9FAmCb6qJHICbZCGWJAbjGBAIAt9FAtCb6qJRIAKCEJRKMANCFJRNABCKJRBAECSJREAKCbZRKAICbZRIAfCEJHfAF9JQBMMCBC99AMAc6yRKMALCoFJ8kUUUUBAKM/tIFGa8jUUUUBCTlRLC9+RKGXAFCLJAI9LQBCaRKAE2BBC/+FZC/QF9HQBALhB83ENAECFJRKAEAIJC98JREGXAF9FQBGXAGCG6QBEXGXAKAE9JQBC9+bMAK1BBHGCgFZRIGXGXAGCa9MQBAKCFJRKSFMAK1BFHGCgBZCOWAICgBZqRIGXAGCa9MQBAKCGJRKSFMAK1BGHGCgBZCfWAIqRIGXAGCa9MQBAKCEJRKSFMAK1BEHGCgBZCdWAIqRIGXAGCa9MQBAKCIJRKSFMAK2BIC8cWAIqRIAKCLJRKMALCNJAICFZCGWqHGAICGrCBAICFrCFZl9zAG8oGBJHIjGBABAIjGBABCIJRBAFCaJHFQBSGMMEXGXAKAE9JQBC9+bMAK1BBHGCgFZRIGXGXAGCa9MQBAKCFJRKSFMAK1BFHGCgBZCOWAICgBZqRIGXAGCa9MQBAKCGJRKSFMAK1BGHGCgBZCfWAIqRIGXAGCa9MQBAKCEJRKSFMAK1BEHGCgBZCdWAIqRIGXAGCa9MQBAKCIJRKSFMAK2BIC8cWAIqRIAKCLJRKMABAICGrCBAICFrCFZl9zALCNJAICFZCGWqHI8oGBJHG87FBAIAGjGBABCGJRBAFCaJHFQBMMCBC99AKAE6yRKMAKM+lLKFaF99GaG99FaG99GXGXAGCI9HQBAF9FQFEXGXGX9DBBB8/9DBBB+/ABCGJHG1BB+yAB1BBHE+yHI+L+TABCFJHL1BBHK+yHO+L+THN9DBBBB9gHVyAN9DBB/+hANAN+U9DBBBBANAVyHcAc+MHMAECa3yAI+SHIAI+UAcAMAKCa3yAO+SHcAc+U+S+S+R+VHO+U+SHN+L9DBBB9P9d9FQBAN+oRESFMCUUUU94REMAGAE86BBGXGX9DBBB8/9DBBB+/Ac9DBBBB9gyAcAO+U+SHN+L9DBBB9P9d9FQBAN+oRGSFMCUUUU94RGMALAG86BBGXGX9DBBB8/9DBBB+/AI9DBBBB9gyAIAO+U+SHN+L9DBBB9P9d9FQBAN+oRGSFMCUUUU94RGMABAG86BBABCIJRBAFCaJHFQBSGMMAF9FQBEXGXGX9DBBB8/9DBBB+/ABCIJHG8uFB+yAB8uFBHE+yHI+L+TABCGJHL8uFBHK+yHO+L+THN9DBBBB9gHVyAN9DB/+g6ANAN+U9DBBBBANAVyHcAc+MHMAECa3yAI+SHIAI+UAcAMAKCa3yAO+SHcAc+U+S+S+R+VHO+U+SHN+L9DBBB9P9d9FQBAN+oRESFMCUUUU94REMAGAE87FBGXGX9DBBB8/9DBBB+/Ac9DBBBB9gyAcAO+U+SHN+L9DBBB9P9d9FQBAN+oRGSFMCUUUU94RGMALAG87FBGXGX9DBBB8/9DBBB+/AI9DBBBB9gyAIAO+U+SHN+L9DBBB9P9d9FQBAN+oRGSFMCUUUU94RGMABAG87FBABCNJRBAFCaJHFQBMMM/SEIEaE99EaF99GXAF9FQBCBREABRIEXGXGX9D/zI818/AICKJ8uFBHLCEq+y+VHKAI8uFB+y+UHO9DB/+g6+U9DBBB8/9DBBB+/AO9DBBBB9gy+SHN+L9DBBB9P9d9FQBAN+oRVSFMCUUUU94RVMAICIJ8uFBRcAICGJ8uFBRMABALCFJCEZAEqCFWJAV87FBGXGXAKAM+y+UHN9DB/+g6+U9DBBB8/9DBBB+/AN9DBBBB9gy+SHS+L9DBBB9P9d9FQBAS+oRMSFMCUUUU94RMMABALCGJCEZAEqCFWJAM87FBGXGXAKAc+y+UHK9DB/+g6+U9DBBB8/9DBBB+/AK9DBBBB9gy+SHS+L9DBBB9P9d9FQBAS+oRcSFMCUUUU94RcMABALCaJCEZAEqCFWJAc87FBGXGX9DBBU8/AOAO+U+TANAN+U+TAKAK+U+THO9DBBBBAO9DBBBB9gy+R9DB/+g6+U9DBBB8/+SHO+L9DBBB9P9d9FQBAO+oRcSFMCUUUU94RcMABALCEZAEqCFWJAc87FBAICNJRIAECIJREAFCaJHFQBMMM9JBGXAGCGrAF9sHF9FQBEXABAB8oGBHGCNWCN91+yAGCi91CnWCUUU/8EJ+++U84GBABCIJRBAFCaJHFQBMMM9TFEaCBCB8oGUkUUBHFABCEJC98ZJHBjGUkUUBGXGXAB8/BCTWHGuQBCaREABAGlCggEJCTrXBCa6QFMAFREMAEM/lFFFaGXGXAFABqCEZ9FQBABRESFMGXGXAGCT9PQBABRESFMABREEXAEAF8oGBjGBAECIJAFCIJ8oGBjGBAECNJAFCNJ8oGBjGBAECSJAFCSJ8oGBjGBAECTJREAFCTJRFAGC9wJHGCb9LQBMMAGCI9JQBEXAEAF8oGBjGBAFCIJRFAECIJREAGC98JHGCE9LQBMMGXAG9FQBEXAEAF2BB86BBAECFJREAFCFJRFAGCaJHGQBMMABMoFFGaGXGXABCEZ9FQBABRESFMAFCgFZC+BwsN9sRIGXGXAGCT9PQBABRESFMABREEXAEAIjGBAECSJAIjGBAECNJAIjGBAECIJAIjGBAECTJREAGC9wJHGCb9LQBMMAGCI9JQBEXAEAIjGBAECIJREAGC98JHGCE9LQBMMGXAG9FQBEXAEAF86BBAECFJREAGCaJHGQBMMABMMMFBCUNMIT9kBB`,FD=`B9h9z9tFBBBF8dL9gBB9gLaaaaaFa9gEaaaB9gGaaB9gFaFaEQSBBFBFFGEGEGIILF9wFFFLEFBFKNFaFCx/aFMO/LFVK9tv9t9vq95GBt9f9f939h9z9t9f9j9h9s9s9f9jW9vq9zBBp9tv9z9o9v9wW9f9kv9j9v9kv9WvqWv94h919m9mvqBG8Z9tv9z9o9v9wW9f9kv9j9v9kv9J9u9kv94h919m9mvqBIy9tv9z9o9v9wW9f9kv9j9v9kv9J9u9kv949TvZ91v9u9jvBLn9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9P9jWBKi9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9R919hWBNn9tv9z9o9v9wW9f9kv9j9v9kv69p9sWvq9F949wBcI9z9iqlBMc/j9JSIBTEM9+FLa8jUUUUBCTlRBCBRFEXCBRGCBREEXABCNJAGJAECUaAFAGrCFZHIy86BBAEAIJREAGCFJHGCN9HQBMAFCx+YUUBJAE86BBAFCEWCxkUUBJAB8pEN83EBAFCFJHFCUG9HQBMMkRIbaG97FaK978jUUUUBCU/KBlHL8kUUUUBC9+RKGXAGCFJAI9LQBCaRKAE2BBC+gF9HQBALAEAIJHOAGlAG/8cBBCUoBAG9uC/wgBZHKCUGAKCUG9JyRNAECFJRKCBRVGXEXAVAF9PQFANAFAVlAVANJAF9JyRcGXGXAG9FQBAcCbJHIC9wZHMCE9sRSAMCFWRQAICIrCEJCGrRfCBRbEXAKRTCBRtGXEXGXAOATlAf9PQBCBRKSLMALCU/CBJAtAM9sJRmATAfJRKCBREGXAMCoB9JQBAOAKlC/gB9JQBCBRIEXAmAIJREGXGXGXGXGXATAICKrJ2BBHYCEZfIBFGEBMAECBDtDMIBSEMAEAKDBBIAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnHPCGD+MFAPDQBTFtGmEYIPLdKeOnC0+G+MiDtD9OHdCEDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIBAKCIJAnDeBJAeCx+YUUBJ2BBJRKSGMAEAKDBBNAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnC+P+e+8/4BDtD9OHdCbDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIBAKCNJAnDeBJAeCx+YUUBJ2BBJRKSFMAEAKDBBBDMIBAKCTJRKMGXGXGXGXGXAYCGrCEZfIBFGEBMAECBDtDMITSEMAEAKDBBIAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnHPCGD+MFAPDQBTFtGmEYIPLdKeOnC0+G+MiDtD9OHdCEDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMITAKCIJAnDeBJAeCx+YUUBJ2BBJRKSGMAEAKDBBNAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnC+P+e+8/4BDtD9OHdCbDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMITAKCNJAnDeBJAeCx+YUUBJ2BBJRKSFMAEAKDBBBDMITAKCTJRKMGXGXGXGXGXAYCIrCEZfIBFGEBMAECBDtDMIASEMAEAKDBBIAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnHPCGD+MFAPDQBTFtGmEYIPLdKeOnC0+G+MiDtD9OHdCEDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIAAKCIJAnDeBJAeCx+YUUBJ2BBJRKSGMAEAKDBBNAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnC+P+e+8/4BDtD9OHdCbDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIAAKCNJAnDeBJAeCx+YUUBJ2BBJRKSFMAEAKDBBBDMIAAKCTJRKMGXGXGXGXGXAYCKrfIBFGEBMAECBDtDMI8wSEMAEAKDBBIAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnHPCGD+MFAPDQBTFtGmEYIPLdKeOnC0+G+MiDtD9OHdCEDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HYCEWCxkUUBJDBEBAYCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HYCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMI8wAKCIJAnDeBJAYCx+YUUBJ2BBJRKSGMAEAKDBBNAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnC+P+e+8/4BDtD9OHdCbDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HYCEWCxkUUBJDBEBAYCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HYCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMI8wAKCNJAnDeBJAYCx+YUUBJ2BBJRKSFMAEAKDBBBDMI8wAKCTJRKMAICoBJREAICUFJAM9LQFAERIAOAKlC/fB9LQBMMGXAEAM9PQBAECErRIEXGXAOAKlCi9PQBCBRKSOMAmAEJRYGXGXGXGXGXATAECKrJ2BBAICKZrCEZfIBFGEBMAYCBDtDMIBSEMAYAKDBBIAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnHPCGD+MFAPDQBTFtGmEYIPLdKeOnC0+G+MiDtD9OHdCEDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIBAKCIJAnDeBJAeCx+YUUBJ2BBJRKSGMAYAKDBBNAKDBBBHPCID+MFAPDQBTFtGmEYIPLdKeOnC+P+e+8/4BDtD9OHdCbDbD8jHPD8dBhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBAeCx+YUUBJDBBBHnAnDQBBBBBBBBBBBBBBBBAPD8dFhUg/8/4/w/goB9+h84k7HeCEWCxkUUBJDBEBD9uDQBFGEILKOTtmYPdenDfAdAPD9SDMIBAKCNJAnDeBJAeCx+YUUBJ2BBJRKSFMAYAKDBBBDMIBAKCTJRKMAICGJRIAECTJHEAM9JQBMMGXAK9FQBAKRTAtCFJHtCI6QGSFMMCBRKSEMGXAM9FQBALCUGJAbJREALAbJDBGBRnCBRYEXAEALCU/CBJAYJHIDBIBHdCFD9tAdCFDbHPD9OD9hD9RHdAIAMJDBIBHiCFD9tAiAPD9OD9hD9RHiDQBTFtGmEYIPLdKeOnH8ZAIAQJDBIBHpCFD9tApAPD9OD9hD9RHpAIASJDBIBHyCFD9tAyAPD9OD9hD9RHyDQBTFtGmEYIPLdKeOnH8cDQBFTtGEmYILPdKOenHPAPDQBFGEBFGEBFGEBFGEAnD9uHnDyBjGBAEAGJHIAnAPAPDQILKOILKOILKOILKOD9uHnDyBjGBAIAGJHIAnAPAPDQNVcMNVcMNVcMNVcMD9uHnDyBjGBAIAGJHIAnAPAPDQSQfbSQfbSQfbSQfbD9uHnDyBjGBAIAGJHIAnA8ZA8cDQNVi8ZcMpySQ8c8dfb8e8fHPAPDQBFGEBFGEBFGEBFGED9uHnDyBjGBAIAGJHIAnAPAPDQILKOILKOILKOILKOD9uHnDyBjGBAIAGJHIAnAPAPDQNVcMNVcMNVcMNVcMD9uHnDyBjGBAIAGJHIAnAPAPDQSQfbSQfbSQfbSQfbD9uHnDyBjGBAIAGJHIAnAdAiDQNiV8ZcpMyS8cQ8df8eb8fHdApAyDQNiV8ZcpMyS8cQ8df8eb8fHiDQBFTtGEmYILPdKOenHPAPDQBFGEBFGEBFGEBFGED9uHnDyBjGBAIAGJHIAnAPAPDQILKOILKOILKOILKOD9uHnDyBjGBAIAGJHIAnAPAPDQNVcMNVcMNVcMNVcMD9uHnDyBjGBAIAGJHIAnAPAPDQSQfbSQfbSQfbSQfbD9uHnDyBjGBAIAGJHIAnAdAiDQNVi8ZcMpySQ8c8dfb8e8fHPAPDQBFGEBFGEBFGEBFGED9uHnDyBjGBAIAGJHIAnAPAPDQILKOILKOILKOILKOD9uHnDyBjGBAIAGJHIAnAPAPDQNVcMNVcMNVcMNVcMD9uHnDyBjGBAIAGJHIAnAPAPDQSQfbSQfbSQfbSQfbD9uHnDyBjGBAIAGJREAYCTJHYAM9JQBMMAbCIJHbAG9JQBMMABAVAG9sJALCUGJAcAG9s/8cBBALALCUGJAcCaJAG9sJAG/8cBBMAcCBAKyAVJRVAKQBMC9+RKSFMCBC99AOAKlAGCAAGCA9Ly6yRKMALCU/KBJ8kUUUUBAKMNBT+BUUUBM+KmFTa8jUUUUBCoFlHL8kUUUUBC9+RKGXAFCE9uHOCtJAI9LQBCaRKAE2BBHNC/wFZC/gF9HQBANCbZHVCF9LQBALCoBJCgFCUF/8MBALC84Jha83EBALC8wJha83EBALC8oJha83EBALCAJha83EBALCiJha83EBALCTJha83EBALha83ENALha83EBAEAIJC9wJRcAECFJHNAOJRMGXAF9FQBCQCbAVCF6yRSABRECBRVCBRQCBRfCBRICBRKEXGXAMAcuQBC9+RKSEMGXGXAN2BBHOC/vF9LQBALCoBJAOCIrCa9zAKJCbZCEWJHb8oGIRTAb8oGBRtGXAOCbZHbAS9PQBALAOCa9zAIJCbZCGWJ8oGBAVAbyROAb9FRbGXGXAGCG9HQBABAt87FBABCIJAO87FBABCGJAT87FBSFMAEAtjGBAECNJAOjGBAECIJATjGBMAVAbJRVALCoBJAKCEWJHmAOjGBAmATjGIALAICGWJAOjGBALCoBJAKCFJCbZHKCEWJHTAtjGBATAOjGIAIAbJRIAKCFJRKSGMGXGXAbCb6QBAQAbJAbC989zJCFJRQSFMAM1BBHbCgFZROGXGXAbCa9MQBAMCFJRMSFMAM1BFHbCgBZCOWAOCgBZqROGXAbCa9MQBAMCGJRMSFMAM1BGHbCgBZCfWAOqROGXAbCa9MQBAMCEJRMSFMAM1BEHbCgBZCdWAOqROGXAbCa9MQBAMCIJRMSFMAM2BIC8cWAOqROAMCLJRMMAOCFrCBAOCFZl9zAQJRQMGXGXAGCG9HQBABAt87FBABCIJAQ87FBABCGJAT87FBSFMAEAtjGBAECNJAQjGBAECIJATjGBMALCoBJAKCEWJHOAQjGBAOATjGIALAICGWJAQjGBALCoBJAKCFJCbZHKCEWJHOAtjGBAOAQjGIAICFJRIAKCFJRKSFMGXAOCDF9LQBALAIAcAOCbZJ2BBHbCIrHTlCbZCGWJ8oGBAVCFJHtATyROALAIAblCbZCGWJ8oGBAtAT9FHmJHtAbCbZHTyRbAT9FRTGXGXAGCG9HQBABAV87FBABCIJAb87FBABCGJAO87FBSFMAEAVjGBAECNJAbjGBAECIJAOjGBMALAICGWJAVjGBALCoBJAKCEWJHYAOjGBAYAVjGIALAICFJHICbZCGWJAOjGBALCoBJAKCFJCbZCEWJHYAbjGBAYAOjGIALAIAmJCbZHICGWJAbjGBALCoBJAKCGJCbZHKCEWJHOAVjGBAOAbjGIAKCFJRKAIATJRIAtATJRVSFMAVCBAM2BBHYyHTAOC/+F6HPJROAYCbZRtGXGXAYCIrHmQBAOCFJRbSFMAORbALAIAmlCbZCGWJ8oGBROMGXGXAtQBAbCFJRVSFMAbRVALAIAYlCbZCGWJ8oGBRbMGXGXAP9FQBAMCFJRYSFMAM1BFHYCgFZRTGXGXAYCa9MQBAMCGJRYSFMAM1BGHYCgBZCOWATCgBZqRTGXAYCa9MQBAMCEJRYSFMAM1BEHYCgBZCfWATqRTGXAYCa9MQBAMCIJRYSFMAM1BIHYCgBZCdWATqRTGXAYCa9MQBAMCLJRYSFMAMCKJRYAM2BLC8cWATqRTMATCFrCBATCFZl9zAQJHQRTMGXGXAmCb6QBAYRPSFMAY1BBHMCgFZROGXGXAMCa9MQBAYCFJRPSFMAY1BFHMCgBZCOWAOCgBZqROGXAMCa9MQBAYCGJRPSFMAY1BGHMCgBZCfWAOqROGXAMCa9MQBAYCEJRPSFMAY1BEHMCgBZCdWAOqROGXAMCa9MQBAYCIJRPSFMAYCLJRPAY2BIC8cWAOqROMAOCFrCBAOCFZl9zAQJHQROMGXGXAtCb6QBAPRMSFMAP1BBHMCgFZRbGXGXAMCa9MQBAPCFJRMSFMAP1BFHMCgBZCOWAbCgBZqRbGXAMCa9MQBAPCGJRMSFMAP1BGHMCgBZCfWAbqRbGXAMCa9MQBAPCEJRMSFMAP1BEHMCgBZCdWAbqRbGXAMCa9MQBAPCIJRMSFMAPCLJRMAP2BIC8cWAbqRbMAbCFrCBAbCFZl9zAQJHQRbMGXGXAGCG9HQBABAT87FBABCIJAb87FBABCGJAO87FBSFMAEATjGBAECNJAbjGBAECIJAOjGBMALCoBJAKCEWJHYAOjGBAYATjGIALAICGWJATjGBALCoBJAKCFJCbZCEWJHYAbjGBAYAOjGIALAICFJHICbZCGWJAOjGBALCoBJAKCGJCbZCEWJHOATjGBAOAbjGIALAIAm9FAmCb6qJHICbZCGWJAbjGBAIAt9FAtCb6qJRIAKCEJRKMANCFJRNABCKJRBAECSJREAKCbZRKAICbZRIAfCEJHfAF9JQBMMCBC99AMAc6yRKMALCoFJ8kUUUUBAKM/tIFGa8jUUUUBCTlRLC9+RKGXAFCLJAI9LQBCaRKAE2BBC/+FZC/QF9HQBALhB83ENAECFJRKAEAIJC98JREGXAF9FQBGXAGCG6QBEXGXAKAE9JQBC9+bMAK1BBHGCgFZRIGXGXAGCa9MQBAKCFJRKSFMAK1BFHGCgBZCOWAICgBZqRIGXAGCa9MQBAKCGJRKSFMAK1BGHGCgBZCfWAIqRIGXAGCa9MQBAKCEJRKSFMAK1BEHGCgBZCdWAIqRIGXAGCa9MQBAKCIJRKSFMAK2BIC8cWAIqRIAKCLJRKMALCNJAICFZCGWqHGAICGrCBAICFrCFZl9zAG8oGBJHIjGBABAIjGBABCIJRBAFCaJHFQBSGMMEXGXAKAE9JQBC9+bMAK1BBHGCgFZRIGXGXAGCa9MQBAKCFJRKSFMAK1BFHGCgBZCOWAICgBZqRIGXAGCa9MQBAKCGJRKSFMAK1BGHGCgBZCfWAIqRIGXAGCa9MQBAKCEJRKSFMAK1BEHGCgBZCdWAIqRIGXAGCa9MQBAKCIJRKSFMAK2BIC8cWAIqRIAKCLJRKMABAICGrCBAICFrCFZl9zALCNJAICFZCGWqHI8oGBJHG87FBAIAGjGBABCGJRBAFCaJHFQBMMCBC99AKAE6yRKMAKM/xLGEaK978jUUUUBCAlHE8kUUUUBGXGXAGCI9HQBGXAFC98ZHI9FQBABRGCBRLEXAGAGDBBBHKCiD+rFCiD+sFD/6FHOAKCND+rFCiD+sFD/6FAOD/gFAKCTD+rFCiD+sFD/6FHND/gFD/kFD/lFHVCBDtD+2FHcAOCUUUU94DtHMD9OD9RD/kFHO9DBB/+hDYAOAOD/mFAVAVD/mFANAcANAMD9OD9RD/kFHOAOD/mFD/kFD/kFD/jFD/nFHND/mF9DBBX9LDYHcD/kFCgFDtD9OAKCUUU94DtD9OD9QAOAND/mFAcD/kFCND+rFCU/+EDtD9OD9QAVAND/mFAcD/kFCTD+rFCUU/8ODtD9OD9QDMBBAGCTJRGALCIJHLAI9JQBMMAIAF9PQFAEAFCEZHLCGWHGqCBCTAGl/8MBAEABAICGWJHIAG/8cBBGXAL9FQBAEAEDBIBHKCiD+rFCiD+sFD/6FHOAKCND+rFCiD+sFD/6FAOD/gFAKCTD+rFCiD+sFD/6FHND/gFD/kFD/lFHVCBDtD+2FHcAOCUUUU94DtHMD9OD9RD/kFHO9DBB/+hDYAOAOD/mFAVAVD/mFANAcANAMD9OD9RD/kFHOAOD/mFD/kFD/kFD/jFD/nFHND/mF9DBBX9LDYHcD/kFCgFDtD9OAKCUUU94DtD9OD9QAOAND/mFAcD/kFCND+rFCU/+EDtD9OD9QAVAND/mFAcD/kFCTD+rFCUU/8ODtD9OD9QDMIBMAIAEAG/8cBBSFMABAFC98ZHGT+HUUUBAGAF9PQBAEAFCEZHICEWHLJCBCAALl/8MBAEABAGCEWJHGAL/8cBBAEAIT+HUUUBAGAEAL/8cBBMAECAJ8kUUUUBM+yEGGaO97GXAF9FQBCBRGEXABCTJHEAEDBBBHICBDtHLCUU98D8cFCUU98D8cEHKD9OABDBBBHOAIDQILKOSQfbPden8c8d8e8fCggFDtD9OD/6FAOAIDQBFGENVcMTtmYi8ZpyHICTD+sFD/6FHND/gFAICTD+rFCTD+sFD/6FHVD/gFD/kFD/lFHI9DB/+g6DYAVAIALD+2FHLAVCUUUU94DtHcD9OD9RD/kFHVAVD/mFAIAID/mFANALANAcD9OD9RD/kFHIAID/mFD/kFD/kFD/jFD/nFHND/mF9DBBX9LDYHLD/kFCTD+rFAVAND/mFALD/kFCggEDtD9OD9QHVAIAND/mFALD/kFCaDbCBDnGCBDnECBDnKCBDnOCBDncCBDnMCBDnfCBDnbD9OHIDQNVi8ZcMpySQ8c8dfb8e8fD9QDMBBABAOAKD9OAVAIDQBFTtGEmYILPdKOenD9QDMBBABCAJRBAGCIJHGAF9JQBMMM94FEa8jUUUUBCAlHE8kUUUUBABAFC98ZHIT+JUUUBGXAIAF9PQBAEAFCEZHLCEWHFJCBCAAFl/8MBAEABAICEWJHBAF/8cBBAEALT+JUUUBABAEAF/8cBBMAECAJ8kUUUUBM/hEIGaF97FaL978jUUUUBCTlRGGXAF9FQBCBREEXAGABDBBBHIABCTJHLDBBBHKDQILKOSQfbPden8c8d8e8fHOCTD+sFHNCID+rFDMIBAB9DBBU8/DY9D/zI818/DYANCEDtD9QD/6FD/nFHNAIAKDQBFGENVcMTtmYi8ZpyHICTD+rFCTD+sFD/6FD/mFHKAKD/mFANAICTD+sFD/6FD/mFHVAVD/mFANAOCTD+rFCTD+sFD/6FD/mFHOAOD/mFD/kFD/kFD/lFCBDtD+4FD/jF9DB/+g6DYHND/mF9DBBX9LDYHID/kFCggEDtHcD9OAVAND/mFAID/kFCTD+rFD9QHVAOAND/mFAID/kFCTD+rFAKAND/mFAID/kFAcD9OD9QHNDQBFTtGEmYILPdKOenHID8dBAGDBIBDyB+t+J83EBABCNJAID8dFAGDBIBDyF+t+J83EBALAVANDQNVi8ZcMpySQ8c8dfb8e8fHND8dBAGDBIBDyG+t+J83EBABCiJAND8dFAGDBIBDyE+t+J83EBABCAJRBAECIJHEAF9JQBMMM/3FGEaF978jUUUUBCoBlREGXAGCGrAF9sHIC98ZHL9FQBCBRGABRFEXAFAFDBBBHKCND+rFCND+sFD/6FAKCiD+sFCnD+rFCUUU/8EDtD+uFD/mFDMBBAFCTJRFAGCIJHGAL9JQBMMGXALAI9PQBAEAICEZHGCGWHFqCBCoBAFl/8MBAEABALCGWJHLAF/8cBBGXAG9FQBAEAEDBIBHKCND+rFCND+sFD/6FAKCiD+sFCnD+rFCUUU/8EDtD+uFD/mFDMIBMALAEAF/8cBBMM9TFEaCBCB8oGUkUUBHFABCEJC98ZJHBjGUkUUBGXGXAB8/BCTWHGuQBCaREABAGlCggEJCTrXBCa6QFMAFREMAEMMMFBCUNMIT9tBB`,ID=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),LD=new Uint8Array([32,0,65,253,3,1,2,34,4,106,6,5,11,8,7,20,13,33,12,16,128,9,116,64,19,113,127,15,10,21,22,14,255,66,24,54,136,107,18,23,192,26,114,118,132,17,77,101,130,144,27,87,131,44,45,74,156,154,70,167]),RD={0:``,1:`meshopt_decodeFilterOct`,2:`meshopt_decodeFilterQuat`,3:`meshopt_decodeFilterExp`,NONE:``,OCTAHEDRAL:`meshopt_decodeFilterOct`,QUATERNION:`meshopt_decodeFilterQuat`,EXPONENTIAL:`meshopt_decodeFilterExp`},zD={0:`meshopt_decodeVertexBuffer`,1:`meshopt_decodeIndexBuffer`,2:`meshopt_decodeIndexSequence`,ATTRIBUTES:`meshopt_decodeVertexBuffer`,TRIANGLES:`meshopt_decodeIndexBuffer`,INDICES:`meshopt_decodeIndexSequence`};async function BD(e,t,n,r,i,a=`NONE`){let o=await HD();GD(o,o.exports[zD[i]],e,t,n,r,o.exports[RD[a||`NONE`]])}var VD;async function HD(){return VD||=UD(),VD}async function UD(){let e=PD;WebAssembly.validate(ID)&&(e=FD,console.log(`Warning: meshopt_decoder is using experimental SIMD support`));let t=await WebAssembly.instantiate(WD(e),{});return await t.instance.exports.__wasm_call_ctors(),t.instance}function WD(e){let t=new Uint8Array(e.length);for(let n=0;n<e.length;++n){let r=e.charCodeAt(n);t[n]=r>96?r-71:r>64?r-65:r>47?r+4:r>46?63:62}let n=0;for(let r=0;r<e.length;++r)t[n++]=t[r]<60?LD[t[r]]:(t[r]-60)*64+t[++r];return t.buffer.slice(0,n)}function GD(e,t,n,r,i,a,o){let s=e.exports.sbrk,c=r+3&-4,l=s(c*i),u=s(a.length),d=new Uint8Array(e.exports.memory.buffer);d.set(a,u);let f=t(l,r,i,u,a.length);if(f===0&&o&&o(l,c,i),n.set(d.subarray(l,l+r*i)),s(l-s(0)),f!==0)throw Error(`Malformed buffer data: ${f}`)}var KD=e({decode:()=>YD,name:()=>JD}),qD=`EXT_meshopt_compression`,JD=qD;async function YD(e,t){let n=new q(e);if(!t?.gltf?.decompressMeshes||!t.gltf?.loadBuffers)return;let r=[];for(let t of e.json.bufferViews||[])r.push(XD(n,t));await Promise.all(r),n.removeExtension(qD)}async function XD(e,t){let n=e.getObjectExtension(t,qD);if(n){let{byteOffset:r=0,byteLength:i=0,byteStride:a,count:o,mode:s,filter:c=`NONE`,buffer:l}=n,u=e.gltf.buffers[l],d=new Uint8Array(u.arrayBuffer,u.byteOffset+r,i);await BD(new Uint8Array(e.gltf.buffers[t.buffer].arrayBuffer,t.byteOffset,t.byteLength),o,a,d,s,c),e.removeObjectExtension(t,qD)}}var ZD=e({name:()=>$D,preprocess:()=>eO}),QD=`EXT_texture_webp`,$D=QD;function eO(e,t){let n=new q(e);if(!u_(`image/webp`)){if(n.getRequiredExtensions().includes(QD))throw Error(`gltf: Required extension ${QD} not supported by browser`);return}let{json:r}=n;for(let e of r.textures||[]){let t=n.getObjectExtension(e,QD);t&&(e.source=t.source),n.removeObjectExtension(e,QD)}n.removeExtension(QD)}var tO=e({name:()=>rO,preprocess:()=>iO}),nO=`KHR_texture_basisu`,rO=nO;function iO(e,t){let n=new q(e),{json:r}=n;for(let e of r.textures||[]){let t=n.getObjectExtension(e,nO);t&&(e.source=t.source,n.removeObjectExtension(e,nO))}n.removeExtension(nO)}var aO=`4.4.3`;function oO(e){let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0,s=e.POSITION?e.POSITION.value:[],c=s&&s.length;for(let e=0;e<c;e+=3){let c=s[e],l=s[e+1],u=s[e+2];t=c<t?c:t,n=l<n?l:n,r=u<r?u:r,i=c>i?c:i,a=l>a?l:a,o=u>o?u:o}return[[t,n,r],[i,a,o]]}function sO(e){switch(e.constructor){case Int8Array:return`int8`;case Uint8Array:case Uint8ClampedArray:return`uint8`;case Int16Array:return`int16`;case Uint16Array:return`uint16`;case Int32Array:return`int32`;case Uint32Array:return`uint32`;case Float32Array:return`float32`;case Float64Array:return`float64`;default:return`null`}}function cO(e,t,n){let r=sO(t.value),i=n||lO(t);return{name:e,type:{type:`fixed-size-list`,listSize:t.size,children:[{name:`value`,type:r}]},nullable:!1,metadata:i}}function lO(e){let t={};return`byteOffset`in e&&(t.byteOffset=e.byteOffset.toString(10)),`byteStride`in e&&(t.byteStride=e.byteStride.toString(10)),`normalized`in e&&(t.normalized=e.normalized.toString()),t}function uO(e,t,n){let r=pO(t.metadata),i=[],a=dO(t.attributes);for(let t in e){let n=e[t],r=fO(t,n,a[t]);i.push(r)}if(n){let e=fO(`indices`,n);i.push(e)}return{fields:i,metadata:r}}function dO(e){let t={};for(let n in e){let r=e[n];t[r.name||`undefined`]=r}return t}function fO(e,t,n){return cO(e,t,n?pO(n.metadata):void 0)}function pO(e){Object.entries(e);let t={};for(let n in e)t[`${n}.string`]=JSON.stringify(e[n]);return t}var mO={POSITION:`POSITION`,NORMAL:`NORMAL`,COLOR:`COLOR_0`,TEX_COORD:`TEXCOORD_0`},hO={1:Int8Array,2:Uint8Array,3:Int16Array,4:Uint16Array,5:Int32Array,6:Uint32Array,9:Float32Array},gO=4,_O=class{draco;decoder;metadataQuerier;constructor(e){this.draco=e,this.decoder=new this.draco.Decoder,this.metadataQuerier=new this.draco.MetadataQuerier}destroy(){this.draco.destroy(this.decoder),this.draco.destroy(this.metadataQuerier)}parseSync(e,t={}){let n=new this.draco.DecoderBuffer;n.Init(new Int8Array(e),e.byteLength),this._disableAttributeTransforms(t);let r=this.decoder.GetEncodedGeometryType(n),i=r===this.draco.TRIANGULAR_MESH?new this.draco.Mesh:new this.draco.PointCloud;try{let e;switch(r){case this.draco.TRIANGULAR_MESH:e=this.decoder.DecodeBufferToMesh(n,i);break;case this.draco.POINT_CLOUD:e=this.decoder.DecodeBufferToPointCloud(n,i);break;default:throw Error(`DRACO: Unknown geometry type.`)}if(!e.ok()||!i.ptr){let t=`DRACO decompression failed: ${e.error_msg()}`;throw Error(t)}let a=this._getDracoLoaderData(i,r,t),o=this._getMeshData(i,a,t),s=oO(o.attributes),c=uO(o.attributes,a,o.indices);return{loader:`draco`,loaderData:a,header:{vertexCount:i.num_points(),boundingBox:s},...o,schema:c}}finally{this.draco.destroy(n),i&&this.draco.destroy(i)}}_getDracoLoaderData(e,t,n){let r=this._getTopLevelMetadata(e),i=this._getDracoAttributes(e,n);return{geometry_type:t,num_attributes:e.num_attributes(),num_points:e.num_points(),num_faces:e instanceof this.draco.Mesh?e.num_faces():0,metadata:r,attributes:i}}_getDracoAttributes(e,t){let n={};for(let r=0;r<e.num_attributes();r++){let i=this.decoder.GetAttribute(e,r),a=this._getAttributeMetadata(e,r);n[i.unique_id()]={unique_id:i.unique_id(),attribute_type:i.attribute_type(),data_type:i.data_type(),num_components:i.num_components(),byte_offset:i.byte_offset(),byte_stride:i.byte_stride(),normalized:i.normalized(),attribute_index:r,metadata:a};let o=this._getQuantizationTransform(i,t);o&&(n[i.unique_id()].quantization_transform=o);let s=this._getOctahedronTransform(i,t);s&&(n[i.unique_id()].octahedron_transform=s)}return n}_getMeshData(e,t,n){let r=this._getMeshAttributes(t,e,n);if(!r.POSITION)throw Error(`DRACO: No position attribute found.`);if(e instanceof this.draco.Mesh)switch(n.topology){case`triangle-strip`:return{topology:`triangle-strip`,mode:4,attributes:r,indices:{value:this._getTriangleStripIndices(e),size:1}};default:return{topology:`triangle-list`,mode:5,attributes:r,indices:{value:this._getTriangleListIndices(e),size:1}}}return{topology:`point-list`,mode:0,attributes:r}}_getMeshAttributes(e,t,n){let r={};for(let i of Object.values(e.attributes)){let e=this._deduceAttributeName(i,n);i.name=e;let a=this._getAttributeValues(t,i);if(a){let{value:t,size:n}=a;r[e]={value:t,size:n,byteOffset:i.byte_offset,byteStride:i.byte_stride,normalized:i.normalized}}}return r}_getTriangleListIndices(e){let t=e.num_faces()*3,n=t*gO,r=this.draco._malloc(n);try{return this.decoder.GetTrianglesUInt32Array(e,n,r),new Uint32Array(this.draco.HEAPF32.buffer,r,t).slice()}finally{this.draco._free(r)}}_getTriangleStripIndices(e){let t=new this.draco.DracoInt32Array;try{return this.decoder.GetTriangleStripsFromMesh(e,t),bO(t)}finally{this.draco.destroy(t)}}_getAttributeValues(e,t){let n=hO[t.data_type];if(!n)return console.warn(`DRACO: Unsupported attribute type ${t.data_type}`),null;let r=t.num_components,i=e.num_points()*r,a=i*n.BYTES_PER_ELEMENT,o=vO(this.draco,n),s,c=this.draco._malloc(a);try{let r=this.decoder.GetAttribute(e,t.attribute_index);this.decoder.GetAttributeDataArrayForAllPoints(e,r,o,a,c),s=new n(this.draco.HEAPF32.buffer,c,i).slice()}finally{this.draco._free(c)}return{value:s,size:r}}_deduceAttributeName(e,t){let n=e.unique_id;for(let[e,r]of Object.entries(t.extraAttributes||{}))if(r===n)return e;let r=e.attribute_type;for(let e in mO)if(this.draco[e]===r)return mO[e];let i=t.attributeNameEntry||`name`;return e.metadata[i]?e.metadata[i].string:`CUSTOM_ATTRIBUTE_${n}`}_getTopLevelMetadata(e){let t=this.decoder.GetMetadata(e);return this._getDracoMetadata(t)}_getAttributeMetadata(e,t){let n=this.decoder.GetAttributeMetadata(e,t);return this._getDracoMetadata(n)}_getDracoMetadata(e){if(!e||!e.ptr)return{};let t={},n=this.metadataQuerier.NumEntries(e);for(let r=0;r<n;r++){let n=this.metadataQuerier.GetEntryName(e,r);t[n]=this._getDracoMetadataField(e,n)}return t}_getDracoMetadataField(e,t){let n=new this.draco.DracoInt32Array;try{this.metadataQuerier.GetIntEntryArray(e,t,n);let r=yO(n);return{int:this.metadataQuerier.GetIntEntry(e,t),string:this.metadataQuerier.GetStringEntry(e,t),double:this.metadataQuerier.GetDoubleEntry(e,t),intArray:r}}finally{this.draco.destroy(n)}}_disableAttributeTransforms(e){let{quantizedAttributes:t=[],octahedronAttributes:n=[]}=e,r=[...t,...n];for(let e of r)this.decoder.SkipAttributeTransform(this.draco[e])}_getQuantizationTransform(e,t){let{quantizedAttributes:n=[]}=t,r=e.attribute_type();if(n.map(e=>this.decoder[e]).includes(r)){let t=new this.draco.AttributeQuantizationTransform;try{if(t.InitFromAttribute(e))return{quantization_bits:t.quantization_bits(),range:t.range(),min_values:new Float32Array([1,2,3]).map(e=>t.min_value(e))}}finally{this.draco.destroy(t)}}return null}_getOctahedronTransform(e,t){let{octahedronAttributes:n=[]}=t,r=e.attribute_type();if(n.map(e=>this.decoder[e]).includes(r)){let t=new this.draco.AttributeQuantizationTransform;try{if(t.InitFromAttribute(e))return{quantization_bits:t.quantization_bits()}}finally{this.draco.destroy(t)}}return null}};function vO(e,t){switch(t){case Float32Array:return e.DT_FLOAT32;case Int8Array:return e.DT_INT8;case Int16Array:return e.DT_INT16;case Int32Array:return e.DT_INT32;case Uint8Array:return e.DT_UINT8;case Uint16Array:return e.DT_UINT16;case Uint32Array:return e.DT_UINT32;default:return e.DT_INVALID}}function yO(e){let t=e.size(),n=new Int32Array(t);for(let r=0;r<t;r++)n[r]=e.GetValue(r);return n}function bO(e){let t=e.size(),n=new Int32Array(t);for(let r=0;r<t;r++)n[r]=e.GetValue(r);return n}var xO=`1.5.6`,SO=`1.4.1`,CO=`https://www.gstatic.com/draco/versioned/decoders/${xO}`,wO={DECODER:`draco_wasm_wrapper.js`,DECODER_WASM:`draco_decoder.wasm`,FALLBACK_DECODER:`draco_decoder.js`,ENCODER:`draco_encoder.js`},TO={[wO.DECODER]:`${CO}/${wO.DECODER}`,[wO.DECODER_WASM]:`${CO}/${wO.DECODER_WASM}`,[wO.FALLBACK_DECODER]:`${CO}/${wO.FALLBACK_DECODER}`,[wO.ENCODER]:`https://raw.githubusercontent.com/google/draco/${SO}/javascript/${wO.ENCODER}`},EO;async function DO(e={},t){let n=e.modules||{};return n.draco3d?EO||=n.draco3d.createDecoderModule({}).then(e=>({draco:e})):EO||=kO(e,t),await EO}function OO(e,t){if(e&&typeof e==`object`){if(e.default)return e.default;if(e[t])return e[t]}return e}async function kO(e,t){let n,r;switch(t){case`js`:n=await zp(TO[wO.FALLBACK_DECODER],`draco`,e,wO.FALLBACK_DECODER);break;default:try{[n,r]=await Promise.all([await zp(TO[wO.DECODER],`draco`,e,wO.DECODER),await zp(TO[wO.DECODER_WASM],`draco`,e,wO.DECODER_WASM)])}catch{n=null,r=null}}return n=OO(n,`DracoDecoderModule`),n||=globalThis.DracoDecoderModule,!n&&!mp&&([n,r]=await Promise.all([await zp(TO[wO.DECODER],`draco`,{...e,useLocalLibraries:!0},wO.DECODER),await zp(TO[wO.DECODER_WASM],`draco`,{...e,useLocalLibraries:!0},wO.DECODER_WASM)]),n=OO(n,`DracoDecoderModule`),n||=globalThis.DracoDecoderModule),await AO(n,r)}function AO(e,t){if(typeof e!=`function`)throw Error(`DracoDecoderModule could not be loaded`);let n={};return t&&(n.wasmBinary=t),new Promise(t=>{e({...n,onModuleLoaded:e=>t({draco:e})})})}var jO={dataType:null,batchType:null,name:`Draco`,id:`draco`,module:`draco`,version:aO,worker:!0,extensions:[`drc`],mimeTypes:[`application/octet-stream`],binary:!0,tests:[`DRACO`],options:{draco:{decoderType:typeof WebAssembly==`object`?`wasm`:`js`,extraAttributes:{},attributeNameEntry:void 0}},parse:MO};async function MO(e,t){let{draco:n}=await DO(Rp(t),t?.draco?.decoderType||`wasm`),r=new _O(n);try{return r.parseSync(e,t?.draco)}finally{r.destroy()}}function NO(e){let t={};for(let n in e){let r=e[n];n!==`indices`&&(t[n]=PO(r))}return t}function PO(e){let{buffer:t,size:n,count:r}=FO(e);return{value:t,size:n,byteOffset:0,count:r,type:wE(n),componentType:TE(t)}}function FO(e){let t=e,n=1,r=0;return e&&e.value&&(t=e.value,n=e.size||1),t&&(ArrayBuffer.isView(t)||(t=IO(t,Float32Array)),r=t.length/n),{buffer:t,size:n,count:r}}function IO(e,t,n=!1){return e?Array.isArray(e)||n&&!(e instanceof t)?new t(e):e:null}var LO=e({decode:()=>VO,encode:()=>HO,name:()=>zO,preprocess:()=>BO}),RO=`KHR_draco_mesh_compression`,zO=RO;function BO(e,t,n){let r=new q(e);for(let e of KO(r))r.getObjectExtension(e,RO)}async function VO(e,t,n){if(!t?.gltf?.decompressMeshes)return;let r=new q(e),i=[];for(let e of KO(r))r.getObjectExtension(e,RO)&&i.push(UO(r,e,t,n));await Promise.all(i),r.removeExtension(RO)}function HO(e,t={}){let n=new q(e);for(let e of n.json.meshes||[])WO(e,t),n.addRequiredExtension(RO)}async function UO(e,t,n,r){let i=e.getObjectExtension(t,RO);if(!i)return;let a=e.getTypedArrayForBufferView(i.bufferView),o=em(a.buffer,a.byteOffset),s={...n};delete s[`3d-tiles`];let c=await Hf(o,jO,s,r),l=NO(c.attributes);for(let[n,r]of Object.entries(l))if(n in t.attributes){let i=t.attributes[n],a=e.getAccessor(i);a?.min&&a?.max&&(r.min=a.min,r.max=a.max)}t.attributes=l,c.indices&&(t.indices=PO(c.indices)),e.removeObjectExtension(t,RO),GO(t)}function WO(e,t,n=4,r,i){if(!r.DracoWriter)throw Error(`options.gltf.DracoWriter not provided`);let a=r.DracoWriter.encodeSync({attributes:e}),o=i?.parseSync?.({attributes:e}),s=r._addFauxAttributes(o.attributes),c=r.addBufferView(a);return{primitives:[{attributes:s,mode:n,extensions:{[RO]:{bufferView:c,attributes:s}}}]}}function GO(e){if(!e.attributes&&Object.keys(e.attributes).length>0)throw Error(`glTF: Empty primitive detected: Draco decompression failure?`)}function*KO(e){for(let t of e.json.meshes||[])for(let e of t.primitives)yield e}var qO=e({decode:()=>$O,name:()=>YO}),JO=`KHR_texture_transform`,YO=JO,XO=new z,ZO=new B,QO=new B;async function $O(e,t){if(!new q(e).hasExtension(JO)||!t.gltf?.loadBuffers)return;let n=e.json.materials||[];for(let t=0;t<n.length;t++)ek(t,e)}function ek(e,t){let n=t.json.materials?.[e],r=[n?.pbrMetallicRoughness?.baseColorTexture,n?.emissiveTexture,n?.normalTexture,n?.occlusionTexture,n?.pbrMetallicRoughness?.metallicRoughnessTexture],i=[];for(let n of r)n&&n?.extensions?.[JO]&&tk(t,e,n,i)}function tk(e,t,n,r){let i=nk(n,r);if(!i)return;let a=e.json.meshes||[];for(let n of a)for(let r of n.primitives){let n=r.material;Number.isFinite(n)&&t===n&&rk(e,r,i)}}function nk(e,t){let n=e.extensions?.[JO],{texCoord:r=0}=e,{texCoord:i=r}=n;if(t.findIndex(([e,t])=>e===r&&t===i)===-1){let a=ok(n);return r!==i&&(e.texCoord=i),t.push([r,i]),{originalTexCoord:r,texCoord:i,matrix:a}}return null}function rk(e,t,n){let{originalTexCoord:r,texCoord:i,matrix:a}=n,o=t.attributes[`TEXCOORD_${r}`];if(Number.isFinite(o)){let n=e.json.accessors?.[o];if(n&&n.bufferView!==void 0){let o=e.json.bufferViews?.[n.bufferView];if(o){let{arrayBuffer:s,byteOffset:c}=e.buffers[o.buffer],l=(c||0)+(n.byteOffset||0)+(o.byteOffset||0),{ArrayType:u,length:d}=EE(n,o),f=_E[n.componentType],p=gE[n.type],m=o.byteStride||f*p,h=new Float32Array(d);for(let e=0;e<n.count;e++){let t=new u(s,l+e*m,2);XO.set(t[0],t[1],1),XO.transformByMatrix3(a),h.set([XO[0],XO[1]],e*p)}r===i?ik(n,e,h,n.bufferView):ak(i,n,t,e,h)}}}}function ik(e,t,n,r){e.componentType=5126,e.byteOffset=0;let i=(t.json.accessors||[]).reduce((e,t)=>t.bufferView===r?e+1:e,0)>1;t.buffers.push({arrayBuffer:ym(n.buffer),byteOffset:0,byteLength:n.buffer.byteLength});let a=t.buffers.length-1;if(t.json.bufferViews=t.json.bufferViews||[],i){t.json.bufferViews.push({buffer:a,byteLength:n.buffer.byteLength,byteOffset:0}),e.bufferView=t.json.bufferViews.length-1;return}let o=t.json.bufferViews[r];o&&(o.buffer=a,o.byteOffset=0,o.byteLength=n.buffer.byteLength,o.byteStride!==void 0&&delete o.byteStride)}function ak(e,t,n,r,i){r.buffers.push({arrayBuffer:ym(i.buffer),byteOffset:0,byteLength:i.buffer.byteLength}),r.json.bufferViews=r.json.bufferViews||[];let a=r.json.bufferViews;a.push({buffer:r.buffers.length-1,byteLength:i.buffer.byteLength,byteOffset:0});let o=r.json.accessors;o&&(o.push({bufferView:a?.length-1,byteOffset:0,componentType:5126,count:t.count,type:`VEC2`}),n.attributes[`TEXCOORD_${e}`]=o.length-1)}function ok(e){let{offset:t=[0,0],rotation:n=0,scale:r=[1,1]}=e,i=new B().set(1,0,0,0,1,0,t[0],t[1],1),a=ZO.set(Math.cos(n),Math.sin(n),0,-Math.sin(n),Math.cos(n),0,0,0,1),o=QO.set(r[0],0,0,0,r[1],0,0,0,1);return i.multiplyRight(a).multiplyRight(o)}var sk=e({decode:()=>uk,encode:()=>dk,name:()=>lk}),ck=`KHR_lights_punctual`,lk=ck;async function uk(e){let t=new q(e),{json:n}=t,r=t.getExtension(ck);r&&(t.json.lights=r.lights,t.removeExtension(ck));for(let e of n.nodes||[]){let n=t.getObjectExtension(e,ck);n&&(e.light=n.light),t.removeObjectExtension(e,ck)}}async function dk(e){let t=new q(e),{json:n}=t;if(n.lights){let e=t.addExtension(ck);XT(!e.lights),e.lights=n.lights,delete n.lights}if(t.json.lights){for(let e of t.json.lights){let n=e.node;t.addObjectExtension(n,ck,e)}delete t.json.lights}}var fk=e({decode:()=>hk,encode:()=>gk,name:()=>mk}),pk=`KHR_materials_unlit`,mk=pk;async function hk(e){let t=new q(e),{json:n}=t;for(let e of n.materials||[])e.extensions&&e.extensions.KHR_materials_unlit&&(e.unlit=!0),t.removeObjectExtension(e,pk);t.removeExtension(pk)}function gk(e){let t=new q(e),{json:n}=t;if(t.materials)for(let e of n.materials||[])e.unlit&&(delete e.unlit,t.addObjectExtension(e,pk,{}),t.addExtension(pk))}var _k=e({decode:()=>bk,encode:()=>xk,name:()=>yk}),vk=`KHR_techniques_webgl`,yk=vk;async function bk(e){let t=new q(e),{json:n}=t,r=t.getExtension(vk);if(r){let e=Sk(r,t);for(let r of n.materials||[]){let n=t.getObjectExtension(r,vk);n&&(r.technique=Object.assign({},n,e[n.technique]),r.technique.values=Ck(r.technique,t)),t.removeObjectExtension(r,vk)}t.removeExtension(vk)}}async function xk(e,t){}function Sk(e,t){let{programs:n=[],shaders:r=[],techniques:i=[]}=e,a=new TextDecoder;return r.forEach(e=>{if(Number.isFinite(e.bufferView))e.code=a.decode(t.getTypedArrayForBufferView(e.bufferView));else throw Error(`KHR_techniques_webgl: no shader code`)}),n.forEach(e=>{e.fragmentShader=r[e.fragmentShader],e.vertexShader=r[e.vertexShader]}),i.forEach(e=>{e.program=n[e.program]}),i}function Ck(e,t){let n=Object.assign({},e.values);return Object.keys(e.uniforms||{}).forEach(t=>{e.uniforms[t].value&&!(t in n)&&(n[t]=e.uniforms[t].value)}),Object.keys(n).forEach(e=>{typeof n[e]==`object`&&n[e].index!==void 0&&(n[e].texture=t.getTexture(n[e].index))}),n}var wk=e({decode:()=>Dk,name:()=>Ek}),Tk=`EXT_feature_metadata`,Ek=Tk;async function Dk(e,t){Ok(new q(e),t)}function Ok(e,t){if(!t.gltf?.loadBuffers)return;let n=e.getExtension(Tk);n&&(t.gltf?.loadImages&&kk(e,n),Ak(e,n))}function kk(e,t){let n=t.schema;if(!n)return;let r=n.classes,{featureTextures:i}=t;if(r&&i)for(let t in r){let n=r[t],a=Mk(i,t);a&&Pk(e,a,n)}}function Ak(e,t){let n=t.schema;if(!n)return;let r=n.classes,i=t.featureTables;if(r&&i)for(let t in r){let r=jk(i,t);r&&Nk(e,n,r)}}function jk(e,t){for(let n in e){let r=e[n];if(r.class===t)return r}return null}function Mk(e,t){for(let n in e){let r=e[n];if(r.class===t)return r}return null}function Nk(e,t,n){if(!n.class)return;let r=t.classes?.[n.class];if(!r)throw Error(`Incorrect data in the EXT_structural_metadata extension: no schema class with name ${n.class}`);let i=n.count;for(let a in r.properties){let o=r.properties[a],s=n.properties?.[a];s&&(s.data=Fk(e,t,o,i,s))}}function Pk(e,t,n){let r=t.class;for(let i in n.properties){let n=t?.properties?.[i];n&&(n.data=Bk(e,n,r))}}function Fk(e,t,n,r,i){let a=[],o=i.bufferView,s=e.getTypedArrayForBufferView(o),c=Ik(e,n,i,r),l=Lk(e,n,i,r);return n.type===`STRING`||n.componentType===`STRING`?a=WE(r,s,c,l):Rk(n)&&(a=zk(n,r,s,c)),a}function Ik(e,t,n,r){return t.type===`ARRAY`&&t.componentCount===void 0&&n.arrayOffsetBufferView!==void 0?IE(e,n.arrayOffsetBufferView,n.offsetType||`UINT32`,r):null}function Lk(e,t,n,r){return n.stringOffsetBufferView===void 0?null:IE(e,n.stringOffsetBufferView,n.offsetType||`UINT32`,r)}function Rk(e){let t=[`UINT8`,`INT16`,`UINT16`,`INT32`,`UINT32`,`INT64`,`UINT64`,`FLOAT32`,`FLOAT64`];return t.includes(e.type)||e.componentType!==void 0&&t.includes(e.componentType)}function zk(e,t,n,r){let i=e.type===`ARRAY`,a=e.componentCount,o=`SCALAR`,s=e.componentType||e.type,c=FE(o,s),l=LE(n,o,s,n.byteLength/c);return i?r?HE(l,t,r,n.length,c):a?UE(l,t,a):[]:l}function Bk(e,t,n){let r=e.gltf.json;if(!r.meshes)return[];let i=[];for(let a of r.meshes)for(let r of a.primitives)Vk(e,n,t,i,r);return i}function Vk(e,t,n,r,i){let a=RE(e,{channels:n.channels,...n.texture},i);a&&zE(e,t,a,r,i)}var Hk=[nD,GE,KD,ZD,tO,LO,sk,fk,_k,qO,wk];function Uk(e,t={},n){let r=Hk.filter(e=>Gk(e.name,t));for(let i of r)i.preprocess?.(e,t,n)}async function Wk(e,t={},n){let r=Hk.filter(e=>Gk(e.name,t));for(let i of r)await i.decode?.(e,t,n)}function Gk(e,t){let n=t?.gltf?.excludeExtensions||{};return!(e in n&&!n[e])}var Kk=`KHR_binary_glTF`;function qk(e){let t=new q(e),{json:n}=t;for(let e of n.images||[]){let n=t.getObjectExtension(e,Kk);n&&Object.assign(e,n),t.removeObjectExtension(e,Kk)}n.buffers&&n.buffers[0]&&delete n.buffers[0].uri,t.removeExtension(Kk)}var Jk={accessors:`accessor`,animations:`animation`,buffers:`buffer`,bufferViews:`bufferView`,images:`image`,materials:`material`,meshes:`mesh`,nodes:`node`,samplers:`sampler`,scenes:`scene`,skins:`skin`,textures:`texture`},Yk={accessor:`accessors`,animations:`animation`,buffer:`buffers`,bufferView:`bufferViews`,image:`images`,material:`materials`,mesh:`meshes`,node:`nodes`,sampler:`samplers`,scene:`scenes`,skin:`skins`,texture:`textures`},Xk=class{idToIndexMap={animations:{},accessors:{},buffers:{},bufferViews:{},images:{},materials:{},meshes:{},nodes:{},samplers:{},scenes:{},skins:{},textures:{}};json;normalize(e,t){this.json=e.json;let n=e.json;switch(n.asset&&n.asset.version){case`2.0`:return;case void 0:case`1.0`:break;default:console.warn(`glTF: Unknown version ${n.asset.version}`);return}if(!t.normalize)throw Error(`glTF v1 is not supported.`);console.warn(`Converting glTF v1 to glTF v2 format. This is experimental and may fail.`),this._addAsset(n),this._convertTopLevelObjectsToArrays(n),qk(e),this._convertObjectIdsToArrayIndices(n),this._updateObjects(n),this._updateMaterial(n)}_addAsset(e){e.asset=e.asset||{},e.asset.version=`2.0`,e.asset.generator=e.asset.generator||`Normalized to glTF 2.0 by loaders.gl`}_convertTopLevelObjectsToArrays(e){for(let t in Jk)this._convertTopLevelObjectToArray(e,t)}_convertTopLevelObjectToArray(e,t){let n=e[t];if(!(!n||Array.isArray(n))){e[t]=[];for(let r in n){let i=n[r];i.id=i.id||r;let a=e[t].length;e[t].push(i),this.idToIndexMap[t][r]=a}}}_convertObjectIdsToArrayIndices(e){for(let t in Jk)this._convertIdsToIndices(e,t);`scene`in e&&(e.scene=this._convertIdToIndex(e.scene,`scene`));for(let t of e.textures)this._convertTextureIds(t);for(let t of e.meshes)this._convertMeshIds(t);for(let t of e.nodes)this._convertNodeIds(t);for(let t of e.scenes)this._convertSceneIds(t)}_convertTextureIds(e){e.source&&=this._convertIdToIndex(e.source,`image`)}_convertMeshIds(e){for(let t of e.primitives){let{attributes:e,indices:n,material:r}=t;for(let t in e)e[t]=this._convertIdToIndex(e[t],`accessor`);n&&(t.indices=this._convertIdToIndex(n,`accessor`)),r&&(t.material=this._convertIdToIndex(r,`material`))}}_convertNodeIds(e){e.children&&=e.children.map(e=>this._convertIdToIndex(e,`node`)),e.meshes&&=e.meshes.map(e=>this._convertIdToIndex(e,`mesh`))}_convertSceneIds(e){e.nodes&&=e.nodes.map(e=>this._convertIdToIndex(e,`node`))}_convertIdsToIndices(e,t){e[t]||(console.warn(`gltf v1: json doesn't contain attribute ${t}`),e[t]=[]);for(let n of e[t])for(let e in n){let t=n[e];n[e]=this._convertIdToIndex(t,e)}}_convertIdToIndex(e,t){let n=Yk[t];if(n in this.idToIndexMap){let r=this.idToIndexMap[n][e];if(!Number.isFinite(r))throw Error(`gltf v1: failed to resolve ${t} with id ${e}`);return r}return e}_updateObjects(e){for(let e of this.json.buffers)delete e.type}_updateMaterial(e){for(let t of e.materials){t.pbrMetallicRoughness={baseColorFactor:[1,1,1,1],metallicFactor:1,roughnessFactor:1};let n=t.values?.tex||t.values?.texture2d_0||t.values?.diffuseTex,r=e.textures.findIndex(e=>e.id===n);r!==-1&&(t.pbrMetallicRoughness.baseColorTexture={index:r})}}};function Zk(e,t={}){return new Xk().normalize(e,t)}async function Qk(e,t,n=0,r,i){return $k(e,t,n,r),Zk(e,{normalize:r?.gltf?.normalize}),Uk(e,r,i),r?.gltf?.loadBuffers&&e.json.buffers&&await eA(e,r,i),r?.gltf?.loadImages&&await tA(e,r,i),await Wk(e,r,i),e}function $k(e,t,n,r){if(r.core?.baseUrl&&(e.baseUri=r.core?.baseUrl),t instanceof ArrayBuffer&&!sE(t,n,r.glb)&&(t=new TextDecoder().decode(t)),typeof t==`string`)e.json=Xp(t);else if(t instanceof ArrayBuffer){let i={};n=cE(i,t,n,r.glb),XT(i.type===`glTF`,`Invalid GLB magic string ${i.type}`),e._glb=i,e.json=i.json}else XT(!1,`GLTF: must be ArrayBuffer or string`);let i=e.json.buffers||[];if(e.buffers=Array(i.length).fill(null),e._glb&&e._glb.header.hasBinChunk){let{binChunks:t}=e._glb;e.buffers[0]={arrayBuffer:t[0].arrayBuffer,byteOffset:t[0].byteOffset,byteLength:t[0].byteLength}}let a=e.json.images||[];e.images=Array(a.length).fill({})}async function eA(e,t,n){let r=e.json.buffers||[];for(let i=0;i<r.length;++i){let a=r[i];if(a.uri){let{fetch:r}=n;XT(r);let o=mE(a.uri,t,n),s=await(await n?.fetch?.(o))?.arrayBuffer?.();e.buffers[i]={arrayBuffer:s,byteOffset:0,byteLength:s.byteLength},delete a.uri}else e.buffers[i]===null&&(e.buffers[i]={arrayBuffer:new ArrayBuffer(a.byteLength),byteOffset:0,byteLength:a.byteLength})}}async function tA(e,t,n){let r=nA(e),i=e.json.images||[],a=[];for(let o of r)a.push(rA(e,i[o],o,t,n));return await Promise.all(a)}function nA(e){let t=new Set,n=e.json.textures||[];for(let e of n)e.source!==void 0&&t.add(e.source);return Array.from(t).sort()}async function rA(e,t,n,r,i){let a;if(t.uri&&!t.hasOwnProperty(`bufferView`)){let e=mE(t.uri,r,i),{fetch:n}=i;a=await(await n(e)).arrayBuffer(),t.bufferView={data:a}}if(Number.isFinite(t.bufferView)){let n=OE(e.json,e.buffers,t.bufferView);a=em(n.buffer,n.byteOffset,n.byteLength)}XT(a,`glTF image has no data`);let o=r,s={...o,core:{...o?.core,mimeType:t.mimeType}},c=await Hf(a,[c_,YT],s,i);c&&c[0]&&(c={compressed:!0,mipmaps:!1,width:c[0].width,height:c[0].height,data:c[0]}),e.images=e.images||[],e.images[n]=c}var iA={dataType:null,batchType:null,name:`glTF`,id:`gltf`,module:`gltf`,version:aT,extensions:[`gltf`,`glb`],mimeTypes:[`model/gltf+json`,`model/gltf-binary`],text:!0,binary:!0,tests:[`glTF`],parse:aA,options:{gltf:{normalize:!0,loadBuffers:!0,loadImages:!0,decompressMeshes:!0}}};async function aA(e,t={},n){let r={...iA.options,...t};return r.gltf={...iA.options.gltf,...r.gltf},await Qk({},e,t?.glb?.byteOffset||0,r,n)}var oA={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},sA={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},cA={TEXTURE_MAG_FILTER:10240,TEXTURE_MIN_FILTER:10241,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,REPEAT:10497,LINEAR:9729,NEAREST_MIPMAP_LINEAR:9986},lA={magFilter:cA.TEXTURE_MAG_FILTER,minFilter:cA.TEXTURE_MIN_FILTER,wrapS:cA.TEXTURE_WRAP_S,wrapT:cA.TEXTURE_WRAP_T},uA={[cA.TEXTURE_MAG_FILTER]:cA.LINEAR,[cA.TEXTURE_MIN_FILTER]:cA.NEAREST_MIPMAP_LINEAR,[cA.TEXTURE_WRAP_S]:cA.REPEAT,[cA.TEXTURE_WRAP_T]:cA.REPEAT};function dA(){return{id:`default-sampler`,parameters:uA}}function fA(e){return sA[e]}function pA(e){return oA[e]}var mA=class{baseUri=``;jsonUnprocessed;json;buffers=[];images=[];postProcess(e,t={}){let{json:n,buffers:r=[],images:i=[]}=e,{baseUri:a=``}=e;return XT(n),this.baseUri=a,this.buffers=r,this.images=i,this.jsonUnprocessed=n,this.json=this._resolveTree(e.json,t),this.json}_resolveTree(e,t={}){let n={...e};return this.json=n,e.bufferViews&&(n.bufferViews=e.bufferViews.map((e,t)=>this._resolveBufferView(e,t))),e.images&&(n.images=e.images.map((e,t)=>this._resolveImage(e,t))),e.samplers&&(n.samplers=e.samplers.map((e,t)=>this._resolveSampler(e,t))),e.textures&&(n.textures=e.textures.map((e,t)=>this._resolveTexture(e,t))),e.accessors&&(n.accessors=e.accessors.map((e,t)=>this._resolveAccessor(e,t))),e.materials&&(n.materials=e.materials.map((e,t)=>this._resolveMaterial(e,t))),e.meshes&&(n.meshes=e.meshes.map((e,t)=>this._resolveMesh(e,t))),e.nodes&&(n.nodes=e.nodes.map((e,t)=>this._resolveNode(e,t)),n.nodes=n.nodes.map((e,t)=>this._resolveNodeChildren(e))),e.skins&&(n.skins=e.skins.map((e,t)=>this._resolveSkin(e,t))),e.scenes&&(n.scenes=e.scenes.map((e,t)=>this._resolveScene(e,t))),typeof this.json.scene==`number`&&n.scenes&&(n.scene=n.scenes[this.json.scene]),n}getScene(e){return this._get(this.json.scenes,e)}getNode(e){return this._get(this.json.nodes,e)}getSkin(e){return this._get(this.json.skins,e)}getMesh(e){return this._get(this.json.meshes,e)}getMaterial(e){return this._get(this.json.materials,e)}getAccessor(e){return this._get(this.json.accessors,e)}getCamera(e){return this._get(this.json.cameras,e)}getTexture(e){return this._get(this.json.textures,e)}getSampler(e){return this._get(this.json.samplers,e)}getImage(e){return this._get(this.json.images,e)}getBufferView(e){return this._get(this.json.bufferViews,e)}getBuffer(e){return this._get(this.json.buffers,e)}_get(e,t){if(typeof t==`object`)return t;let n=e&&e[t];return n||console.warn(`glTF file error: Could not find ${e}[${t}]`),n}_resolveScene(e,t){return{...e,id:e.id||`scene-${t}`,nodes:(e.nodes||[]).map(e=>this.getNode(e))}}_resolveNode(e,t){let n={...e,id:e?.id||`node-${t}`};return e.mesh!==void 0&&(n.mesh=this.getMesh(e.mesh)),e.camera!==void 0&&(n.camera=this.getCamera(e.camera)),e.skin!==void 0&&(n.skin=this.getSkin(e.skin)),e.meshes!==void 0&&e.meshes.length&&(n.mesh=e.meshes.reduce((e,t)=>{let n=this.getMesh(t);return e.id=n.id,e.primitives=e.primitives.concat(n.primitives),e},{primitives:[]})),n}_resolveNodeChildren(e){return e.children&&=e.children.map(e=>this.getNode(e)),e}_resolveSkin(e,t){let n=typeof e.inverseBindMatrices==`number`?this.getAccessor(e.inverseBindMatrices):void 0;return{...e,id:e.id||`skin-${t}`,inverseBindMatrices:n}}_resolveMesh(e,t){let n={...e,id:e.id||`mesh-${t}`,primitives:[]};return e.primitives&&(n.primitives=e.primitives.map(e=>{let t={...e,attributes:{},indices:void 0,material:void 0},n=e.attributes;for(let e in n)t.attributes[e]=this.getAccessor(n[e]);return e.indices!==void 0&&(t.indices=this.getAccessor(e.indices)),e.material!==void 0&&(t.material=this.getMaterial(e.material)),t})),n}_resolveMaterial(e,t){let n={...e,id:e.id||`material-${t}`};if(n.normalTexture&&(n.normalTexture={...n.normalTexture},n.normalTexture.texture=this.getTexture(n.normalTexture.index)),n.occlusionTexture&&(n.occlusionTexture={...n.occlusionTexture},n.occlusionTexture.texture=this.getTexture(n.occlusionTexture.index)),n.emissiveTexture&&(n.emissiveTexture={...n.emissiveTexture},n.emissiveTexture.texture=this.getTexture(n.emissiveTexture.index)),n.emissiveFactor||=n.emissiveTexture?[1,1,1]:[0,0,0],n.pbrMetallicRoughness){n.pbrMetallicRoughness={...n.pbrMetallicRoughness};let e=n.pbrMetallicRoughness;e.baseColorTexture&&(e.baseColorTexture={...e.baseColorTexture},e.baseColorTexture.texture=this.getTexture(e.baseColorTexture.index)),e.metallicRoughnessTexture&&(e.metallicRoughnessTexture={...e.metallicRoughnessTexture},e.metallicRoughnessTexture.texture=this.getTexture(e.metallicRoughnessTexture.index))}return n}_resolveAccessor(e,t){let n=fA(e.componentType),r=pA(e.type),i=n*r,a={...e,id:e.id||`accessor-${t}`,bytesPerComponent:n,components:r,bytesPerElement:i,value:void 0,bufferView:void 0,sparse:void 0};if(e.bufferView!==void 0&&(a.bufferView=this.getBufferView(e.bufferView)),a.bufferView){let e=a.bufferView.buffer,{ArrayType:t,byteLength:n}=EE(a,a.bufferView),r=(a.bufferView.byteOffset||0)+(a.byteOffset||0)+e.byteOffset,i=bm(e.arrayBuffer,r,n);a.bufferView.byteStride&&(i=this._getValueFromInterleavedBuffer(e,r,a.bufferView.byteStride,a.bytesPerElement,a.count)),a.value=new t(i)}return a}_getValueFromInterleavedBuffer(e,t,n,r,i){let a=new Uint8Array(i*r);for(let o=0;o<i;o++){let i=t+o*n;a.set(new Uint8Array(e.arrayBuffer.slice(i,i+r)),o*r)}return a.buffer}_resolveTexture(e,t){return{...e,id:e.id||`texture-${t}`,sampler:typeof e.sampler==`number`?this.getSampler(e.sampler):dA(),source:typeof e.source==`number`?this.getImage(e.source):void 0}}_resolveSampler(e,t){let n={id:e.id||`sampler-${t}`,...e,parameters:{}};for(let e in n){let t=this._enumSamplerParameter(e);t!==void 0&&(n.parameters[t]=n[e])}return n}_enumSamplerParameter(e){return lA[e]}_resolveImage(e,t){let n={...e,id:e.id||`image-${t}`,image:null,bufferView:e.bufferView===void 0?void 0:this.getBufferView(e.bufferView)},r=this.images[t];return r&&(n.image=r),n}_resolveBufferView(e,t){let n=e.buffer,r=this.buffers[n].arrayBuffer,i=this.buffers[n].byteOffset||0;return e.byteOffset&&(i+=e.byteOffset),{id:`bufferView-${t}`,...e,buffer:this.buffers[n],data:new Uint8Array(r,i,e.byteLength)}}_resolveCamera(e,t){let n={...e,id:e.id||`camera-${t}`};return n.perspective,n.orthographic,n}};function hA(e,t){return new mA().postProcess(e,t)}async function gA(e){let t=[];return e.scenes.forEach(e=>{e.traverse(e=>{})}),await _A(()=>t.some(e=>!e.loaded))}async function _A(e){for(;e();)await new Promise(e=>requestAnimationFrame(e))}var vA=`layout(std140) uniform scenegraphUniforms {
  float sizeScale;
  float sizeMinPixels;
  float sizeMaxPixels;
  mat4 sceneModelMatrix;
  bool composeModelMatrix;
} scenegraph;
`,yA={name:`scenegraph`,vs:vA,fs:vA,uniformTypes:{sizeScale:`f32`,sizeMinPixels:`f32`,sizeMaxPixels:`f32`,sceneModelMatrix:`mat4x4<f32>`,composeModelMatrix:`f32`}},bA=`#version 300 es
#define SHADER_NAME scenegraph-layer-vertex-shader
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec3 instanceModelMatrixCol0;
in vec3 instanceModelMatrixCol1;
in vec3 instanceModelMatrixCol2;
in vec3 instanceTranslation;
in vec3 positions;
#ifdef HAS_UV
in vec2 texCoords;
#endif
#ifdef LIGHTING_PBR
#ifdef HAS_NORMALS
in vec3 normals;
#endif
#endif
out vec4 vColor;
#ifndef LIGHTING_PBR
#ifdef HAS_UV
out vec2 vTEXCOORD_0;
#endif
#endif
void main(void) {
#if defined(HAS_UV) && !defined(LIGHTING_PBR)
vTEXCOORD_0 = texCoords;
geometry.uv = texCoords;
#endif
geometry.worldPosition = instancePositions;
geometry.pickingColor = instancePickingColors;
mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);
vec3 normal = vec3(0.0, 0.0, 1.0);
#ifdef LIGHTING_PBR
#ifdef HAS_NORMALS
normal = instanceModelMatrix * (scenegraph.sceneModelMatrix * vec4(normals, 0.0)).xyz;
#endif
#endif
float originalSize = project_size_to_pixel(scenegraph.sizeScale);
float clampedSize = clamp(originalSize, scenegraph.sizeMinPixels, scenegraph.sizeMaxPixels);
vec3 pos = (instanceModelMatrix * (scenegraph.sceneModelMatrix * vec4(positions, 1.0)).xyz) * scenegraph.sizeScale * (clampedSize / originalSize) + instanceTranslation;
if(scenegraph.composeModelMatrix) {
DECKGL_FILTER_SIZE(pos, geometry);
geometry.normal = project_normal(normal);
geometry.worldPosition += pos;
gl_Position = project_position_to_clipspace(pos + instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
}
else {
pos = project_size(pos);
DECKGL_FILTER_SIZE(pos, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, pos, geometry.position);
geometry.normal = project_normal(normal);
}
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
#ifdef LIGHTING_PBR
pbr_vPosition = geometry.position.xyz;
#ifdef HAS_NORMALS
pbr_vNormal = geometry.normal;
#endif
#ifdef HAS_UV
pbr_vUV0 = texCoords;
#else
pbr_vUV0 = vec2(0., 0.);
#endif
pbr_vUV1 = vec2(0., 0.);
geometry.uv = pbr_vUV0;
#endif
vColor = instanceColors;
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,xA=`#version 300 es
#define SHADER_NAME scenegraph-layer-fragment-shader
in vec4 vColor;
out vec4 fragColor;
#ifndef LIGHTING_PBR
#if defined(HAS_UV) && defined(HAS_BASECOLORMAP)
in vec2 vTEXCOORD_0;
uniform sampler2D pbr_baseColorSampler;
#endif
#endif
void main(void) {
#ifdef LIGHTING_PBR
fragColor = vColor * pbr_filterColor(vec4(0));
geometry.uv = pbr_vUV0;
#else
#if defined(HAS_UV) && defined(HAS_BASECOLORMAP)
fragColor = vColor * texture(pbr_baseColorSampler, vTEXCOORD_0);
geometry.uv = vTEXCOORD_0;
#else
fragColor = vColor;
#endif
#endif
fragColor.a *= layer.opacity;
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,SA=[255,255,255,255],CA={scenegraph:{type:`object`,value:null,async:!0},getScene:e=>e&&e.scenes?typeof e.scene==`object`?e.scene:e.scenes[e.scene||0]:e,getAnimator:e=>e&&e.animator,_animations:null,onFirstDraw:{type:`function`,value:()=>{}},sizeScale:{type:`number`,value:1,min:0},sizeMinPixels:{type:`number`,min:0,value:0},sizeMaxPixels:{type:`number`,min:0,value:2**53-1},getPosition:{type:`accessor`,value:e=>e.position},getColor:{type:`accessor`,value:SA},_lighting:`flat`,_imageBasedLightingEnvironment:void 0,getOrientation:{type:`accessor`,value:[0,0,0]},getScale:{type:`accessor`,value:[1,1,1]},getTranslation:{type:`accessor`,value:[0,0,0]},getTransformMatrix:{type:`accessor`,value:[]},loaders:[iA]},wA=class extends OS{getShaders(){let e={},t;this.props._lighting===`pbr`?(t=nu,e.LIGHTING_PBR=1):t={name:`pbrMaterial`};let n=[qd,Of,yA,t];return super.getShaders({defines:e,vs:bA,fs:xA,modules:n})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:`float64`,fp64:this.use64bitPositions(),accessor:`getPosition`,transition:!0},instanceColors:{type:`unorm8`,size:this.props.colorFormat.length,accessor:`getColor`,defaultValue:SA,transition:!0},instanceModelMatrix:ZS})}updateState(e){super.updateState(e);let{props:t,oldProps:n}=e;t.scenegraph===n.scenegraph?t._animations!==n._animations&&this._applyAnimationsProp(this.state.animator,t._animations):this._updateScenegraph()}finalizeState(e){super.finalizeState(e),this._destroyScenegraphAssets()}get isLoaded(){return!!(this.state?.scenegraph&&super.isLoaded)}_updateScenegraph(){let e=this.props,{device:t}=this.context,n=null;if(e.scenegraph instanceof bd)n={scenes:[e.scenegraph]};else if(e.scenegraph&&typeof e.scenegraph==`object`){let r=e.scenegraph,i=nT(t,r.json?hA(r):r,this._getModelOptions());n=i,gA(i).then(()=>this.setNeedsRedraw()).catch(e=>{this.raiseError(e,`loading glTF`)})}let r={layer:this,device:this.context.device},i=e.getScene(n,r),a=e.getAnimator(n,r);if(i instanceof xd){this._destroyScenegraphAssets(),this._applyAnimationsProp(a,e._animations);let t=[];i.traverse(e=>{e instanceof Sd&&t.push(e.model)}),this.setState({scenegraph:i,animator:a,materials:n?.materials||null,models:t,firstDrawSignaled:!1}),this.getAttributeManager().invalidateAll()}else i!==null&&O.warn(`invalid scenegraph:`,i)()}_destroyScenegraphAssets(){this.state.scenegraph?.destroy(),this.state.materials?.forEach(e=>e.destroy()),this.state.scenegraph=null,this.state.animator=null,this.state.materials=null,this.state.models=[]}_applyAnimationsProp(e,t){if(!e||!t)return;let n=e.getAnimations();Object.keys(t).sort().forEach(e=>{let r=t[e];if(e===`*`)n.forEach(e=>{Object.assign(e,r)});else if(Number.isFinite(Number(e))){let t=Number(e);t>=0&&t<n.length?Object.assign(n[t],r):O.warn(`animation ${e} not found`)()}else{let t=n.find(({animation:t})=>t.name===e);t?Object.assign(t,r):O.warn(`animation ${e} not found`)()}})}_getModelOptions(){let{_imageBasedLightingEnvironment:e}=this.props,t;return e&&(t=typeof e==`function`?e({gl:this.context.gl,layer:this}):e),{imageBasedLightingEnvironment:t,modelOptions:{id:this.props.id,isInstanced:!0,bufferLayout:this.getAttributeManager().getBufferLayouts(),...this.getShaders()},useTangents:!1}}draw({context:e}){if(!this.state.scenegraph)return;this.props._animations&&this.state.animator&&(this.state.animator.setTime(e.timeline.getTime()),this.setNeedsRedraw());let{viewport:t,renderPass:n}=this.context,{sizeScale:r,sizeMinPixels:i,sizeMaxPixels:a,coordinateSystem:o}=this.props,s={camera:t.cameraPosition},c=this.getNumInstances();this.state.scenegraph.traverse((e,{worldMatrix:l})=>{if(e instanceof Sd){let{model:u}=e;u.setInstanceCount(c);let d={sizeScale:r,sizeMinPixels:i,sizeMaxPixels:a,composeModelMatrix:QS(t,o),sceneModelMatrix:l};u.shaderInputs.setProps({pbrProjection:s,scenegraph:d}),u.draw(n)}}),this.state.firstDrawSignaled||(this.state.firstDrawSignaled=!0,this.props.onFirstDraw?.())}};wA.defaultProps=CA,wA.layerName=`ScenegraphLayer`;var TA=`layout(std140) uniform meshUniforms {
  bool pickFeatureIds;
} mesh;
`,EA={name:`mesh`,vs:TA,fs:TA,uniformTypes:{pickFeatureIds:`f32`}},DA=`#version 300 es
#define SHADER_NAME simple-mesh-layer-vs
in vec3 positions;
in vec3 normals;
in vec3 colors;
in vec2 texCoords;
in vec4 uvRegions;
in vec3 featureIdsPickingColors;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec3 instanceModelMatrixCol0;
in vec3 instanceModelMatrixCol1;
in vec3 instanceModelMatrixCol2;
out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;
out vec4 vColor;
vec2 applyUVRegion(vec2 uv) {
#ifdef HAS_UV_REGIONS
return fract(uv) * (uvRegions.zw - uvRegions.xy) + uvRegions.xy;
#else
return uv;
#endif
}
void main(void) {
vec2 uv = applyUVRegion(texCoords);
geometry.uv = uv;
if (mesh.pickFeatureIds) {
geometry.pickingColor = featureIdsPickingColors;
} else {
geometry.pickingColor = instancePickingColors;
}
mat3 instanceModelMatrix = mat3(instanceModelMatrixCol0, instanceModelMatrixCol1, instanceModelMatrixCol2);
vTexCoord = uv;
cameraPosition = project.cameraPosition;
vColor = vec4(colors * instanceColors.rgb, instanceColors.a);
vec3 pos = (instanceModelMatrix * positions) * simpleMesh.sizeScale;
vec3 projectedPosition = project_position(positions);
position_commonspace = vec4(projectedPosition, 1.0);
gl_Position = project_common_position_to_clipspace(position_commonspace);
geometry.position = position_commonspace;
normals_commonspace = project_normal(instanceModelMatrix * normals);
geometry.normal = normals_commonspace;
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
#ifdef MODULE_PBRMATERIAL
pbr_vPosition = geometry.position.xyz;
#ifdef HAS_NORMALS
pbr_vNormal = geometry.normal;
#endif
#ifdef HAS_UV
pbr_vUV0 = uv;
#else
pbr_vUV0 = vec2(0., 0.);
#endif
pbr_vUV1 = vec2(0., 0.);
geometry.uv = pbr_vUV0;
#endif
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,OA=`#version 300 es
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
#ifdef MODULE_PBRMATERIAL
fragColor = vColor * pbr_filterColor(vec4(0));
geometry.uv = pbr_vUV0;
fragColor.a *= layer.opacity;
#else
geometry.uv = vTexCoord;
vec3 normal;
if (simpleMesh.flatShading) {
normal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
} else {
normal = normals_commonspace;
}
vec4 color = simpleMesh.hasTexture ? texture(sampler, vTexCoord) : vColor;
vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, normal);
fragColor = vec4(lightColor, color.a * layer.opacity);
#endif
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;function kA(e){let t=e.positions||e.POSITION,n=t.value.length/t.size;e.COLOR_0||e.colors||(e.colors={size:4,value:new Uint8Array(n*4).fill(255),normalized:!0})}var AA={pbrMaterial:{type:`object`,value:null},featureIds:{type:`array`,value:null,optional:!0}},jA=class extends sC{getShaders(){let e=super.getShaders();return e.modules.push(nu,EA),{...e,vs:DA,fs:OA}}initializeState(){let{featureIds:e}=this.props;super.initializeState();let t=this.getAttributeManager();e&&t.add({featureIdsPickingColors:{type:`uint8`,size:3,noAlloc:!0,update:this.calculateFeatureIdsPickingColors}})}updateState(e){super.updateState(e);let{props:t,oldProps:n}=e;t.pbrMaterial!==n.pbrMaterial&&this.updatePbrMaterialUniforms(t.pbrMaterial)}draw(e){let{featureIds:t}=this.props,{model:n}=this.state;if(!n)return;let r={pickFeatureIds:!!t},i={camera:this.context.viewport.cameraPosition};n.shaderInputs.setProps({pbrProjection:i,mesh:r}),super.draw(e)}getModel(e){let{id:t}=this.props,n=this.parseMaterial(this.props.pbrMaterial,e);this.setState({parsedPBRMaterial:n});let r=this.getShaders();return kA(e.attributes),new dd(this.context.device,{...this.getShaders(),id:t,geometry:e,bufferLayout:this.getAttributeManager().getBufferLayouts(),defines:{...r.defines,...n?.defines,HAS_UV_REGIONS:+!!e.attributes.uvRegions},parameters:n?.parameters,isInstanced:!0})}updatePbrMaterialUniforms(e){let{model:t}=this.state;if(t){let{mesh:n}=this.props,r=this.parseMaterial(e,n);this.setState({parsedPBRMaterial:r});let{pbr_baseColorSampler:i}=r.bindings,{emptyTexture:a}=this.state,o={sampler:i||a,hasTexture:!!i},{camera:s,...c}={...r.bindings,...r.uniforms};t.shaderInputs.setProps({simpleMesh:o,pbrMaterial:c})}}parseMaterial(e,t){let n=!!(e.pbrMetallicRoughness&&e.pbrMetallicRoughness.baseColorTexture);return SC(this.context.device,{unlit:n,...e},{NORMAL:t.attributes.normals,TEXCOORD_0:t.attributes.texCoords},{pbrDebug:!1,lights:!0,useTangents:!1})}calculateFeatureIdsPickingColors(e){let t=this.props.featureIds,n=new Uint8ClampedArray(t.length*e.size),r=[];for(let e=0;e<t.length;e++)this.encodePickingColor(t[e],r),n[e*3]=r[0],n[e*3+1]=r[1],n[e*3+2]=r[2];e.value=n}finalizeState(e){super.finalizeState(e),this.state.parsedPBRMaterial?.generatedTextures.forEach(e=>e.destroy()),this.setState({parsedPBRMaterial:null})}};jA.layerName=`MeshLayer`,jA.defaultProps=AA;var MA=6378137,NA=6378137,PA=6356752.314245179;MA*MA,NA*NA,PA*PA,1/MA,1/NA,1/PA,1/(MA*MA),1/(NA*NA),1/(PA*PA);function FA(e){return e}new z;function IA(e,t=[],n=FA){return`longitude`in e?(t[0]=n(e.longitude),t[1]=n(e.latitude),t[2]=e.height):`x`in e?(t[0]=n(e.x),t[1]=n(e.y),t[2]=e.z):(t[0]=n(e[0]),t[1]=n(e[1]),t[2]=e[2]),t}function LA(e,t=[]){return IA(e,t,L._cartographicRadians?FA:Yo)}function RA(e,t,n=FA){return`longitude`in t?(t.longitude=n(e[0]),t.latitude=n(e[1]),t.height=e[2]):`x`in t?(t.x=n(e[0]),t.y=n(e[1]),t.z=e[2]):(t[0]=n(e[0]),t[1]=n(e[1]),t[2]=e[2]),t}function zA(e,t){return RA(e,t,L._cartographicRadians?FA:Xo)}var BA=1e-14,VA=new z,HA={up:{south:`east`,north:`west`,west:`south`,east:`north`},down:{south:`west`,north:`east`,west:`north`,east:`south`},south:{up:`west`,down:`east`,west:`down`,east:`up`},north:{up:`east`,down:`west`,west:`up`,east:`down`},west:{up:`north`,down:`south`,north:`down`,south:`up`},east:{up:`south`,down:`north`,north:`up`,south:`down`}},UA={north:[-1,0,0],east:[0,1,0],up:[0,0,1],south:[1,0,0],west:[0,-1,0],down:[0,0,-1]},WA={east:new z,north:new z,up:new z,west:new z,south:new z,down:new z},GA=new z,KA=new z,qA=new z;function JA(e,t,n,r,i,a){let o=HA[t]&&HA[t][n];cs(o&&(!r||r===o));let s,c,l,u=VA.copy(i);if(ts(u.x,0,BA)&&ts(u.y,0,BA)){let e=Math.sign(u.z);s=GA.fromArray(UA[t]),t!==`east`&&t!==`west`&&s.scale(e),c=KA.fromArray(UA[n]),n!==`east`&&n!==`west`&&c.scale(e),l=qA.fromArray(UA[r]),r!==`east`&&r!==`west`&&l.scale(e)}else{let{up:i,east:a,north:o}=WA;a.set(-u.y,u.x,0).normalize(),e.geodeticSurfaceNormal(u,i),o.copy(i).cross(a);let{down:d,west:f,south:p}=WA;d.copy(i).scale(-1),f.copy(a).scale(-1),p.copy(o).scale(-1),s=WA[t],c=WA[n],l=WA[r]}return a[0]=s.x,a[1]=s.y,a[2]=s.z,a[3]=0,a[4]=c.x,a[5]=c.y,a[6]=c.z,a[7]=0,a[8]=l.x,a[9]=l.y,a[10]=l.z,a[11]=0,a[12]=u.x,a[13]=u.y,a[14]=u.z,a[15]=1,a}var YA=new z,XA=new z,ZA=new z;function QA(e,t,n=[]){let{oneOverRadii:r,oneOverRadiiSquared:i,centerToleranceSquared:a}=t;YA.from(e);let o=YA.x,s=YA.y,c=YA.z,l=r.x,u=r.y,d=r.z,f=o*o*l*l,p=s*s*u*u,m=c*c*d*d,h=f+p+m,g=Math.sqrt(1/h);if(!Number.isFinite(g))return;let _=XA;if(_.copy(e).scale(g),h<a)return _.to(n);let v=i.x,y=i.y,b=i.z,x=ZA;x.set(_.x*v*2,_.y*y*2,_.z*b*2);let S=(1-g)*YA.len()/(.5*x.len()),C=0,w,T,E,D;do{S-=C,w=1/(1+S*v),T=1/(1+S*y),E=1/(1+S*b);let e=w*w,t=T*T,n=E*E,r=e*w,i=t*T,a=n*E;D=f*e+p*t+m*n-1;let o=-2*(f*r*v+p*i*y+m*a*b);C=D/o}while(Math.abs(D)>Tl);return YA.scale([w,T,E]).to(n)}var $A=new z,ej=new z,tj=new z,nj=new z,rj=new z,ij=new z,J=class{constructor(e=0,t=0,n=0){this.centerToleranceSquared=wl,cs(e>=0),cs(t>=0),cs(n>=0),this.radii=new z(e,t,n),this.radiiSquared=new z(e*e,t*t,n*n),this.radiiToTheFourth=new z(e*e*e*e,t*t*t*t,n*n*n*n),this.oneOverRadii=new z(e===0?0:1/e,t===0?0:1/t,n===0?0:1/n),this.oneOverRadiiSquared=new z(e===0?0:1/(e*e),t===0?0:1/(t*t),n===0?0:1/(n*n)),this.minimumRadius=Math.min(e,t,n),this.maximumRadius=Math.max(e,t,n),this.radiiSquared.z!==0&&(this.squaredXOverSquaredZ=this.radiiSquared.x/this.radiiSquared.z),Object.freeze(this)}equals(e){return this===e||!!(e&&this.radii.equals(e.radii))}toString(){return this.radii.toString()}cartographicToCartesian(e,t=[0,0,0]){let n=ej,r=tj,[,,i]=e;this.geodeticSurfaceNormalCartographic(e,n),r.copy(this.radiiSquared).scale(n);let a=Math.sqrt(n.dot(r));return r.scale(1/a),n.scale(i),r.add(n),r.to(t)}cartesianToCartographic(e,t=[0,0,0]){ij.from(e);let n=this.scaleToGeodeticSurface(ij,nj);if(!n)return;let r=this.geodeticSurfaceNormal(n,ej),i=rj;return i.copy(ij).subtract(n),zA([Math.atan2(r.y,r.x),Math.asin(r.z),Math.sign(Fs(i,ij))*Os(i)],t)}eastNorthUpToFixedFrame(e,t=new V){return JA(this,`east`,`north`,`up`,e,t)}localFrameToFixedFrame(e,t,n,r,i=new V){return JA(this,e,t,n,r,i)}geocentricSurfaceNormal(e,t=[0,0,0]){return $A.from(e).normalize().to(t)}geodeticSurfaceNormalCartographic(e,t=[0,0,0]){let n=LA(e),r=n[0],i=n[1],a=Math.cos(i);return $A.set(a*Math.cos(r),a*Math.sin(r),Math.sin(i)).normalize(),$A.to(t)}geodeticSurfaceNormal(e,t=[0,0,0]){return $A.from(e).scale(this.oneOverRadiiSquared).normalize().to(t)}scaleToGeodeticSurface(e,t){return QA(e,this,t)}scaleToGeocentricSurface(e,t=[0,0,0]){nj.from(e);let n=nj.x,r=nj.y,i=nj.z,a=this.oneOverRadiiSquared,o=1/Math.sqrt(n*n*a.x+r*r*a.y+i*i*a.z);return nj.multiplyScalar(o).to(t)}transformPositionToScaledSpace(e,t=[0,0,0]){return nj.from(e).scale(this.oneOverRadii).to(t)}transformPositionFromScaledSpace(e,t=[0,0,0]){return nj.from(e).scale(this.radii).to(t)}getSurfaceNormalIntersectionWithZAxis(e,t=0,n=[0,0,0]){cs(ts(this.radii.x,this.radii.y,El)),cs(this.radii.z>0),nj.from(e);let r=nj.z*(1-this.squaredXOverSquaredZ);if(!(Math.abs(r)>=this.radii.z-t))return nj.set(0,0,r).to(n)}};J.WGS84=new J(MA,NA,PA);var aj=class{item;previous;next;constructor(e,t,n){this.item=e,this.previous=t,this.next=n}},oj=class{head=null;tail=null;_length=0;get length(){return this._length}add(e){let t=new aj(e,this.tail,null);return this.tail?(this.tail.next=t,this.tail=t):(this.head=t,this.tail=t),++this._length,t}remove(e){e&&(e.previous&&e.next?(e.previous.next=e.next,e.next.previous=e.previous):e.previous?(e.previous.next=null,this.tail=e.previous):e.next?(e.next.previous=null,this.head=e.next):(this.head=null,this.tail=null),e.next=null,e.previous=null,--this._length)}splice(e,t){e!==t&&(this.remove(t),this._insert(e,t))}_insert(e,t){let n=e.next;e.next=t,this.tail===e?this.tail=t:n.previous=t,t.next=n,t.previous=e,++this._length}},sj=class{_list;_sentinel;_trimTiles;constructor(){this._list=new oj,this._sentinel=this._list.add(`sentinel`),this._trimTiles=!1}reset(){this._list.splice(this._list.tail,this._sentinel)}touch(e){let t=e._cacheNode;t&&this._list.splice(this._sentinel,t)}add(e,t,n){t._cacheNode||(t._cacheNode=this._list.add(t),n&&n(e,t))}unloadTile(e,t,n){let r=t._cacheNode;r&&(this._list.remove(r),t._cacheNode=null,n&&n(e,t))}unloadTiles(e,t){let n=this._trimTiles;this._trimTiles=!1;let r=this._list,i=e.maximumMemoryUsage*1024*1024,a=this._sentinel,o=r.head;for(;o!==a&&(e.gpuMemoryUsageInBytes>i||n);){let n=o.item;o=o.next,this.unloadTile(e,n,t)}}trim(){this._trimTiles=!0}};function cj(e,t){H(e),H(t);let{rtcCenter:n,gltfUpAxis:r}=t,{computedTransform:i,boundingVolume:{center:a}}=e,o=new V(i);switch(n&&o.translate(n),r){case`Z`:break;case`Y`:let e=new V().rotateX(Math.PI/2);o=o.multiplyRight(e);break;case`X`:let t=new V().rotateY(-Math.PI/2);o=o.multiplyRight(t);break;default:break}t.isQuantized&&o.translate(t.quantizedVolumeOffset).scale(t.quantizedVolumeScale);let s=new z(a);t.cartesianModelMatrix=o,t.cartesianOrigin=s;let c=J.WGS84.cartesianToCartographic(s,new z);t.cartographicModelMatrix=J.WGS84.eastNorthUpToFixedFrame(s).invert().multiplyRight(o),t.cartographicOrigin=c;let l=uj(t);l&&(t.cartesianModelMatrix=new V(o).multiplyRight(l.matrix),t.cartographicModelMatrix.multiplyRight(l.matrix),l.matrix=V.IDENTITY),t.coordinateSystem||(t.modelMatrix=t.cartographicModelMatrix)}var lj=1e6**2;function uj(e){let t=e.gltf;if(!t)return null;let n=typeof t.scene==`number`?t.scene:0,r=(t.scenes?.[n])?.nodes?.[0];if(!r?.matrix)return null;let i=r.matrix;return i[12]*i[12]+i[13]*i[13]+i[14]*i[14]<=lj?null:r}var dj={OUTSIDE:-1,INTERSECTING:0,INSIDE:1};new z,new z;var fj=new z,pj=new z,mj=class e{constructor(e=[0,0,0],t=0){this.radius=-0,this.center=new z,this.fromCenterRadius(e,t)}fromCenterRadius(e,t){return this.center.from(e),this.radius=t,this}fromCornerPoints(e,t){return t=fj.from(t),this.center=new z().from(e).add(t).scale(.5),this.radius=this.center.distance(t),this}equals(e){return this===e||!!e&&this.center.equals(e.center)&&this.radius===e.radius}clone(){return new e(this.center,this.radius)}union(e){let t=this.center,n=this.radius,r=e.center,i=e.radius,a=fj.copy(r).subtract(t),o=a.magnitude();if(n>=o+i)return this.clone();if(i>=o+n)return e.clone();let s=(n+o+i)*.5;return pj.copy(a).scale((-n+s)/o).add(t),this.center.copy(pj),this.radius=s,this}expand(e){let t=fj.from(e).subtract(this.center).magnitude();return t>this.radius&&(this.radius=t),this}transform(e){this.center.transform(e);let t=wc(fj,e);return this.radius=Math.max(t[0],Math.max(t[1],t[2]))*this.radius,this}distanceSquaredTo(e){let t=this.distanceTo(e);return t*t}distanceTo(e){let t=fj.from(e).subtract(this.center);return Math.max(0,t.len()-this.radius)}intersectPlane(e){let t=this.center,n=this.radius,r=e.normal.dot(t)+e.distance;return r<-n?dj.OUTSIDE:r<n?dj.INTERSECTING:dj.INSIDE}},hj=new z,gj=new z,_j=new z,vj=new z,yj=new z,bj=new z,xj=new z,Sj={COLUMN0ROW0:0,COLUMN0ROW1:1,COLUMN0ROW2:2,COLUMN1ROW0:3,COLUMN1ROW1:4,COLUMN1ROW2:5,COLUMN2ROW0:6,COLUMN2ROW1:7,COLUMN2ROW2:8},Cj=class e{constructor(e=[0,0,0],t=[0,0,0,0,0,0,0,0,0]){this.center=new z().from(e),this.halfAxes=new B(t)}get halfSize(){let e=this.halfAxes.getColumn(0),t=this.halfAxes.getColumn(1),n=this.halfAxes.getColumn(2);return[new z(e).len(),new z(t).len(),new z(n).len()]}get quaternion(){let e=this.halfAxes.getColumn(0),t=this.halfAxes.getColumn(1),n=this.halfAxes.getColumn(2),r=new z(e).normalize(),i=new z(t).normalize(),a=new z(n).normalize();return new Cl().fromMatrix3(new B([...r,...i,...a]))}fromCenterHalfSizeQuaternion(e,t,n){let r=new Cl(n),i=new B().fromQuaternion(r);return i[0]*=t[0],i[1]*=t[0],i[2]*=t[0],i[3]*=t[1],i[4]*=t[1],i[5]*=t[1],i[6]*=t[2],i[7]*=t[2],i[8]*=t[2],this.center=new z().from(e),this.halfAxes=i,this}clone(){return new e(this.center,this.halfAxes)}equals(e){return this===e||!!e&&this.center.equals(e.center)&&this.halfAxes.equals(e.halfAxes)}getBoundingSphere(e=new mj){let t=this.halfAxes,n=t.getColumn(0,_j),r=t.getColumn(1,vj),i=t.getColumn(2,yj),a=hj.copy(n).add(r).add(i);return e.center.copy(this.center),e.radius=a.magnitude(),e}intersectPlane(e){let t=this.center,n=e.normal,r=this.halfAxes,i=n.x,a=n.y,o=n.z,s=Math.abs(i*r[Sj.COLUMN0ROW0]+a*r[Sj.COLUMN0ROW1]+o*r[Sj.COLUMN0ROW2])+Math.abs(i*r[Sj.COLUMN1ROW0]+a*r[Sj.COLUMN1ROW1]+o*r[Sj.COLUMN1ROW2])+Math.abs(i*r[Sj.COLUMN2ROW0]+a*r[Sj.COLUMN2ROW1]+o*r[Sj.COLUMN2ROW2]),c=n.dot(t)+e.distance;return c<=-s?dj.OUTSIDE:c>=s?dj.INSIDE:dj.INTERSECTING}distanceTo(e){return Math.sqrt(this.distanceSquaredTo(e))}distanceSquaredTo(e){let t=gj.from(e).subtract(this.center),n=this.halfAxes,r=n.getColumn(0,_j),i=n.getColumn(1,vj),a=n.getColumn(2,yj),o=r.magnitude(),s=i.magnitude(),c=a.magnitude();r.normalize(),i.normalize(),a.normalize();let l=0,u;return u=Math.abs(t.dot(r))-o,u>0&&(l+=u*u),u=Math.abs(t.dot(i))-s,u>0&&(l+=u*u),u=Math.abs(t.dot(a))-c,u>0&&(l+=u*u),l}computePlaneDistances(e,t,n=[-0,-0]){let r=1/0,i=-1/0,a=this.center,o=this.halfAxes,s=o.getColumn(0,_j),c=o.getColumn(1,vj),l=o.getColumn(2,yj),u=bj.copy(s).add(c).add(l).add(a),d=xj.copy(u).subtract(e),f=t.dot(d);return r=Math.min(f,r),i=Math.max(f,i),u.copy(a).add(s).add(c).subtract(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),u.copy(a).add(s).subtract(c).add(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),u.copy(a).add(s).subtract(c).subtract(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),a.copy(u).subtract(s).add(c).add(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),a.copy(u).subtract(s).add(c).subtract(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),a.copy(u).subtract(s).subtract(c).add(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),a.copy(u).subtract(s).subtract(c).subtract(l),d.copy(u).subtract(e),f=t.dot(d),r=Math.min(f,r),i=Math.max(f,i),n[0]=r,n[1]=i,n}transform(e){this.center.transformAsPoint(e);let t=this.halfAxes.getColumn(0,_j);t.transformAsPoint(e);let n=this.halfAxes.getColumn(1,vj);n.transformAsPoint(e);let r=this.halfAxes.getColumn(2,yj);return r.transformAsPoint(e),this.halfAxes=new B([...t,...n,...r]),this}getTransform(){throw Error(`not implemented`)}},wj=new z,Tj=new z,Ej=class e{constructor(e=[0,0,1],t=0){this.normal=new z,this.distance=-0,this.fromNormalDistance(e,t)}fromNormalDistance(e,t){return cs(Number.isFinite(t)),this.normal.from(e).normalize(),this.distance=t,this}fromPointNormal(e,t){e=wj.from(e),this.normal.from(t).normalize();let n=-this.normal.dot(e);return this.distance=n,this}fromCoefficients(e,t,n,r){return this.normal.set(e,t,n),cs(ts(this.normal.len(),1)),this.distance=r,this}clone(){return new e(this.normal,this.distance)}equals(e){return ts(this.distance,e.distance)&&ts(this.normal,e.normal)}getPointDistance(e){return this.normal.dot(e)+this.distance}transform(e){let t=Tj.copy(this.normal).transformAsVector(e).normalize(),n=this.normal.scale(-this.distance).transform(e);return this.fromPointNormal(n,t)}projectPointOntoPlane(e,t=[0,0,0]){let n=wj.from(e),r=this.getPointDistance(n),i=Tj.copy(this.normal).scale(r);return n.subtract(i).to(t)}},Dj=[new z([1,0,0]),new z([0,1,0]),new z([0,0,1])],Oj=new z,kj=new z,Aj=class e{constructor(e=[]){this.planes=e}fromBoundingSphere(e){this.planes.length=2*Dj.length;let t=e.center,n=e.radius,r=0;for(let e of Dj){let i=this.planes[r],a=this.planes[r+1];i||=this.planes[r]=new Ej,a||=this.planes[r+1]=new Ej;let o=Oj.copy(e).scale(-n).add(t);i.fromPointNormal(o,e);let s=Oj.copy(e).scale(n).add(t),c=kj.copy(e).negate();a.fromPointNormal(s,c),r+=2}return this}computeVisibility(e){let t=dj.INSIDE;for(let n of this.planes)switch(e.intersectPlane(n)){case dj.OUTSIDE:return dj.OUTSIDE;case dj.INTERSECTING:t=dj.INTERSECTING;break;default:}return t}computeVisibilityWithPlaneMask(t,n){if(cs(Number.isFinite(n),`parentPlaneMask is required.`),n===e.MASK_OUTSIDE||n===e.MASK_INSIDE)return n;let r=e.MASK_INSIDE,i=this.planes;for(let a=0;a<this.planes.length;++a){let o=a<31?1<<a:0;if(a<31&&(n&o)===0)continue;let s=i[a],c=t.intersectPlane(s);if(c===dj.OUTSIDE)return e.MASK_OUTSIDE;c===dj.INTERSECTING&&(r|=o)}return r}};Aj.MASK_OUTSIDE=4294967295,Aj.MASK_INSIDE=0,Aj.MASK_INDETERMINATE=2147483647,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z,new z;var jj=new B,Mj=new B,Nj=new B,Pj=new B,Fj=new B;function Ij(e,t={}){let n=Dl,r=0,i=0,a=Mj,o=Nj;a.identity(),o.copy(e);let s=n*Lj(o);for(;i<10&&Bj(o)>s;)Vj(o,Pj),Fj.copy(Pj).transpose(),o.multiplyRight(Pj),o.multiplyLeft(Fj),a.multiplyRight(Pj),++r>2&&(++i,r=0);return t.unitary=a.toTarget(t.unitary),t.diagonal=o.toTarget(t.diagonal),t}function Lj(e){let t=0;for(let n=0;n<9;++n){let r=e[n];t+=r*r}return Math.sqrt(t)}var Rj=[1,0,0],zj=[2,2,1];function Bj(e){let t=0;for(let n=0;n<3;++n){let r=e[jj.getElementIndex(zj[n],Rj[n])];t+=2*r*r}return Math.sqrt(t)}function Vj(e,t){let n=El,r=0,i=1;for(let t=0;t<3;++t){let n=Math.abs(e[jj.getElementIndex(zj[t],Rj[t])]);n>r&&(i=t,r=n)}let a=Rj[i],o=zj[i],s=1,c=0;if(Math.abs(e[jj.getElementIndex(o,a)])>n){let t=e[jj.getElementIndex(o,o)],n=e[jj.getElementIndex(a,a)],r=e[jj.getElementIndex(o,a)],i=(t-n)/2/r,l;l=i<0?-1/(-i+Math.sqrt(1+i*i)):1/(i+Math.sqrt(1+i*i)),s=1/Math.sqrt(1+l*l),c=l*s}return B.IDENTITY.to(t),t[jj.getElementIndex(a,a)]=t[jj.getElementIndex(o,o)]=s,t[jj.getElementIndex(o,a)]=c,t[jj.getElementIndex(a,o)]=-c,t}var Hj=new z,Uj=new z,Wj=new z,Gj=new z,Kj=new z,qj=new B,Jj={diagonal:new B,unitary:new B};function Yj(e,t=new Cj){if(!e||e.length===0)return t.halfAxes=new B([0,0,0,0,0,0,0,0,0]),t.center=new z,t;let n=e.length,r=new z(0,0,0);for(let t of e)r.add(t);let i=1/n;r.multiplyByScalar(i);let a=0,o=0,s=0,c=0,l=0,u=0;for(let t of e){let e=Hj.copy(t).subtract(r);a+=e.x*e.x,o+=e.x*e.y,s+=e.x*e.z,c+=e.y*e.y,l+=e.y*e.z,u+=e.z*e.z}a*=i,o*=i,s*=i,c*=i,l*=i,u*=i;let d=qj;d[0]=a,d[1]=o,d[2]=s,d[3]=o,d[4]=c,d[5]=l,d[6]=s,d[7]=l,d[8]=u;let{unitary:f}=Ij(d,Jj),p=t.halfAxes.copy(f),m=p.getColumn(0,Wj),h=p.getColumn(1,Gj),g=p.getColumn(2,Kj),_=-Number.MAX_VALUE,v=-Number.MAX_VALUE,y=-Number.MAX_VALUE,b=Number.MAX_VALUE,x=Number.MAX_VALUE,S=Number.MAX_VALUE;for(let t of e)Hj.copy(t),_=Math.max(Hj.dot(m),_),v=Math.max(Hj.dot(h),v),y=Math.max(Hj.dot(g),y),b=Math.min(Hj.dot(m),b),x=Math.min(Hj.dot(h),x),S=Math.min(Hj.dot(g),S);m=m.multiplyByScalar(.5*(b+_)),h=h.multiplyByScalar(.5*(x+v)),g=g.multiplyByScalar(.5*(S+y)),t.center.copy(m).add(h).add(g);let C=Uj.set(_-b,v-x,y-S).multiplyByScalar(.5),w=new B([C[0],0,0,0,C[1],0,0,0,C[2]]);return t.halfAxes.multiplyRight(w),t}var Xj=new z,Zj=new z,Qj=new Aj([new Ej,new Ej,new Ej,new Ej,new Ej,new Ej]);function $j(e,t){let{cameraDirection:n,cameraUp:r,height:i}=e,{metersPerUnit:a}=e.distanceScales,o=rM(e,e.center),s=J.WGS84.eastNorthUpToFixedFrame(o),c=e.unprojectPosition(e.cameraPosition),l=J.WGS84.cartographicToCartesian(c,new z),u=new z(s.transformAsVector(new z(n).scale(a))).normalize(),d=new z(s.transformAsVector(new z(r).scale(a))).normalize();tM(e);let f=e.constructor,{longitude:p,latitude:m,width:h,bearing:g,zoom:_}=e,v=new f({longitude:p,latitude:m,height:i,width:h,bearing:g,zoom:_,pitch:0});return{camera:{position:l,direction:u,up:d},viewport:e,topDownViewport:v,height:i,cullingVolume:Qj,frameNumber:t,sseDenominator:1.15}}function eM(e,t,n){if(n===0||e.length<=n)return[e,[]];let r=[],{longitude:i,latitude:a}=t.viewport;for(let[t,n]of e.entries()){let[e,o]=n.header.mbs,s=Math.abs(i-e),c=Math.abs(a-o),l=Math.sqrt(c*c+s*s);r.push([t,l])}let o=r.sort((e,t)=>e[1]-t[1]),s=[];for(let t=0;t<n;t++)s.push(e[o[t][0]]);let c=[];for(let t=n;t<o.length;t++)c.push(e[o[t][0]]);return[s,c]}function tM(e){let t=e.getFrustumPlanes(),n=nM(t.near,e.cameraPosition),r=rM(e,n),i=rM(e,e.cameraPosition,Zj),a=0;Qj.planes[a++].fromPointNormal(r,Xj.copy(r).subtract(i));for(let i in t){if(i===`near`)continue;let o=t[i],s=rM(e,nM(o,n,Zj),Zj);Qj.planes[a++].fromPointNormal(s,Xj.copy(r).subtract(s))}}function nM(e,t,n=new z){let r=e.normal.dot(t);return n.copy(e.normal).scale(e.distance-r).add(t),n}function rM(e,t,n=new z){let r=e.unprojectPosition(t);return J.WGS84.cartographicToCartesian(r,n)}var iM=6378137,aM=6378137,oM=6356752.314245179,sM=new z;function cM(e,t){if(e instanceof Cj){let{halfAxes:n}=e,r=dM(n);return Math.log2(oM/(r+t[2]))}else if(e instanceof mj){let{radius:n}=e;return Math.log2(oM/(n+t[2]))}else if(e.width&&e.height){let{width:t,height:n}=e;return(Math.log2(iM/t)+Math.log2(aM/n))/2}return 1}function lM(e,t,n){J.WGS84.cartographicToCartesian([e.xmax,e.ymax,e.zmax],sM);let r=Math.sqrt((sM[0]-n[0])**2+(sM[1]-n[1])**2+(sM[2]-n[2])**2);return Math.log2(oM/(r+t[2]))}function uM(e,t,n){let[r,i,a,o]=e;return lM({xmin:r,xmax:a,ymin:i,ymax:o,zmin:0,zmax:0},t,n)}function dM(e){e.getColumn(0,sM);let t=e.getColumn(1),n=e.getColumn(2);return sM.add(t).add(n).len()}var fM={UNLOADED:0,LOADING:1,PROCESSING:2,READY:3,EXPIRED:4,FAILED:5},pM;(function(e){e[e.ADD=1]=`ADD`,e[e.REPLACE=2]=`REPLACE`})(pM||={});var mM;(function(e){e.EMPTY=`empty`,e.SCENEGRAPH=`scenegraph`,e.POINTCLOUD=`pointcloud`,e.MESH=`mesh`})(mM||={});var hM;(function(e){e.I3S=`I3S`,e.TILES3D=`TILES3D`})(hM||={});var gM;(function(e){e.GEOMETRIC_ERROR=`geometricError`,e.MAX_SCREEN_THRESHOLD=`maxScreenThreshold`})(gM||={});var _M={NOT_COMPUTED:-1,USE_OPTIMIZATION:1,SKIP_OPTIMIZATION:0};function vM(e){return e!=null}var yM=new z,bM=new z,xM=new z,SM=new z,CM=new z,wM=new z,TM=new z,EM=new z;function DM(e,t,n){if(H(e,`3D Tile: boundingVolume must be defined`),e.box)return kM(e.box,t,n);if(e.region)return jM(e.region);if(e.sphere)return AM(e.sphere,t,n);throw Error(`3D Tile: boundingVolume must contain a sphere, region, or box`)}function OM(e,t){if(e.box)return MM(t);if(e.region){let[t,n,r,i,a,o]=e.region;return[[Qo(t),Qo(n),a],[Qo(r),Qo(i),o]]}if(e.sphere)return NM(t);throw Error(`Unkown boundingVolume type`)}function kM(e,t,n){let r=new z(e[0],e[1],e[2]);t.transform(r,r);let i=[];if(e.length===10){let t=e.slice(3,6),n=new Cl;n.fromArray(e,6);let r=new z([1,0,0]),a=new z([0,1,0]),o=new z([0,0,1]);r.transformByQuaternion(n),r.scale(t[0]),a.transformByQuaternion(n),a.scale(t[1]),o.transformByQuaternion(n),o.scale(t[2]),i=[...r.toArray(),...a.toArray(),...o.toArray()]}else i=[...e.slice(3,6),...e.slice(6,9),...e.slice(9,12)];let a=t.transformAsVector(i.slice(0,3)),o=t.transformAsVector(i.slice(3,6)),s=t.transformAsVector(i.slice(6,9)),c=new B([a[0],a[1],a[2],o[0],o[1],o[2],s[0],s[1],s[2]]);return vM(n)?(n.center=r,n.halfAxes=c,n):new Cj(r,c)}function AM(e,t,n){let r=new z(e[0],e[1],e[2]);t.transform(r,r);let i=t.getScale(bM),a=Math.max(Math.max(i[0],i[1]),i[2]),o=e[3]*a;return vM(n)?(n.center=r,n.radius=o,n):new mj(r,o)}function jM(e){let[t,n,r,i,a,o]=e,s=J.WGS84.cartographicToCartesian([Qo(t),Qo(i),a],xM),c=J.WGS84.cartographicToCartesian([Qo(r),Qo(n),o],SM),l=new z().addVectors(s,c).multiplyByScalar(.5);return J.WGS84.cartesianToCartographic(l,CM),J.WGS84.cartographicToCartesian([Qo(r),CM[1],CM[2]],wM),J.WGS84.cartographicToCartesian([CM[0],Qo(i),CM[2]],TM),J.WGS84.cartographicToCartesian([CM[0],CM[1],o],EM),kM([...l,...wM.subtract(l),...TM.subtract(l),...EM.subtract(l)],new V)}function MM(e){let t=PM(),{halfAxes:n}=e,r=new z(n.getColumn(0)),i=new z(n.getColumn(1)),a=new z(n.getColumn(2));for(let n=0;n<2;n++){for(let n=0;n<2;n++){for(let n=0;n<2;n++)yM.copy(e.center),yM.add(r),yM.add(i),yM.add(a),FM(t,yM),a.negate();i.negate()}r.negate()}return t}function NM(e){let t=PM(),{center:n,radius:r}=e,i=J.WGS84.scaleToGeodeticSurface(n,yM),a;a=i?J.WGS84.geodeticSurfaceNormal(i):new z(0,0,1);let o=new z(a[2],-a[1],0);o.len()>0?o.normalize():o=new z(0,1,0);let s=o.clone().cross(a);for(let e of[o,s,a]){bM.copy(e).scale(r);for(let e=0;e<2;e++)yM.copy(n),yM.add(bM),FM(t,yM),bM.negate()}return t}function PM(){return[[1/0,1/0,1/0],[-1/0,-1/0,-1/0]]}function FM(e,t){J.WGS84.cartesianToCartographic(t,yM),e[0][0]=Math.min(e[0][0],yM[0]),e[0][1]=Math.min(e[0][1],yM[1]),e[0][2]=Math.min(e[0][2],yM[2]),e[1][0]=Math.max(e[1][0],yM[0]),e[1][1]=Math.max(e[1][1],yM[1]),e[1][2]=Math.max(e[1][2],yM[2])}new z,new z,new V,new z,new z,new z;function IM(e,t){let n=e*t;return 1-Math.exp(-(n*n))}function LM(e,t){if(e.dynamicScreenSpaceError&&e.dynamicScreenSpaceErrorComputedDensity){let n=e.dynamicScreenSpaceErrorComputedDensity,r=e.dynamicScreenSpaceErrorFactor;return IM(t,n)*r}return 0}function RM(e,t,n){let r=e.tileset,i=e.parent&&e.parent.lodMetricValue||e.lodMetricValue,a=n?i:e.lodMetricValue;if(a===0)return 0;let o=Math.max(e._distanceToCamera,1e-7),{height:s,sseDenominator:c}=t,{viewDistanceScale:l}=r.options,u=a*s*(l||1)/(o*c);return u-=LM(r,o),u}var zM=new z,BM=new z,VM=new z,HM=new z,UM=new z,WM=new V,GM=new V;function KM(e,t){if(e.lodMetricValue===0||isNaN(e.lodMetricValue))return`DIG`;let n=2*qM(e,t);return n<2?`OUT`:!e.header.children||n<=e.lodMetricValue?`DRAW`:e.header.children?`DIG`:`OUT`}function qM(e,t){let{topDownViewport:n}=t,r=e.header.mbs[1],i=e.header.mbs[0],a=e.header.mbs[2],o=e.header.mbs[3],s=[...e.boundingVolume.center],c=n.unprojectPosition(n.cameraPosition);J.WGS84.cartographicToCartesian(c,zM),BM.copy(zM).subtract(s).normalize(),J.WGS84.eastNorthUpToFixedFrame(s,WM),GM.copy(WM).invert(),VM.copy(zM).transform(GM);let l=Math.sqrt(VM[0]*VM[0]+VM[1]*VM[1]),u=l*l/VM[2];HM.copy([VM[0],VM[1],u]);let d=HM.transform(WM).subtract(s).normalize(),f=BM.cross(d).normalize().scale(o).add(s),p=J.WGS84.cartesianToCartographic(f),m=n.project([i,r,a]),h=n.project(p);return UM.copy(m).subtract(h).magnitude()}function JM(e){return{assetGltfUpAxis:e.asset&&e.asset.gltfUpAxis||`Y`}}var YM=class{_map=new Map;_array;_length;constructor(e=0){this._array=Array(e),this._length=e}get length(){return this._length}set length(e){this._length=e,e>this._array.length&&(this._array.length=e)}get values(){return this._array}get(e){return H(e<this._array.length),this._array[e]}set(e,t){H(e>=0),e>=this.length&&(this.length=e+1),this._map.has(this._array[e])&&this._map.delete(this._array[e]),this._array[e]=t,this._map.set(t,e)}delete(e){let t=this._map.get(e);t>=0&&(this._array.splice(t,1),this._map.delete(e),this.length--)}peek(){return this._array[this._length-1]}push(e){if(!this._map.has(e)){let t=this.length++;this._array[t]=e,this._map.set(e,t)}}pop(){let e=this._array[--this.length];return this._map.delete(e),e}reserve(e){H(e>=0),e>this._array.length&&(this._array.length=e)}resize(e){H(e>=0),this.length=e}trim(e){e??=this.length,this._array.length=e}reset(){this._array=[],this._map=new Map,this._length=0}find(e){return this._map.has(e)}},XM={loadSiblings:!1,skipLevelOfDetail:!1,updateTransforms:!0,onTraversalEnd:()=>{},viewportTraversersMap:{},basePath:``},ZM=class{options;root=null;selectedTiles={};requestedTiles={};emptyTiles={};lastUpdate=new Date().getTime();updateDebounceTime=1e3;_traversalStack=new YM;_emptyTraversalStack=new YM;_frameNumber=null;traversalFinished(e){return!0}constructor(e){this.options={...XM,...e}}traverse(e,t,n){this.root=e,this.options={...this.options,...n},this.reset(),this.updateTile(e,t),this._frameNumber=t.frameNumber,this.executeTraversal(e,t)}reset(){this.requestedTiles={},this.selectedTiles={},this.emptyTiles={},this._traversalStack.reset(),this._emptyTraversalStack.reset()}executeTraversal(e,t){let n=this._traversalStack;for(e._selectionDepth=1,n.push(e);n.length>0;){let e=n.pop(),r=!1;this.canTraverse(e,t)&&(this.updateChildTiles(e,t),r=this.updateAndPushChildren(e,t,n,e.hasRenderContent?e._selectionDepth+1:e._selectionDepth));let i=e.parent,a=!!(!i||i._shouldRefine),o=!r;e.hasRenderContent?e.refine===pM.ADD?(this.loadTile(e,t),this.selectTile(e,t)):e.refine===pM.REPLACE&&(this.loadTile(e,t),o&&this.selectTile(e,t)):(this.emptyTiles[e.id]=e,this.loadTile(e,t),o&&this.selectTile(e,t)),this.touchTile(e,t),e._shouldRefine=r&&a}let r=new Date().getTime();(this.traversalFinished(t)||r-this.lastUpdate>this.updateDebounceTime)&&(this.lastUpdate=r,this.options.onTraversalEnd(t))}updateChildTiles(e,t){let n=e.children;for(let e of n)this.updateTile(e,t)}updateAndPushChildren(e,t,n,r){let{loadSiblings:i,skipLevelOfDetail:a}=this.options,o=e.children;o.sort(this.compareDistanceToCamera.bind(this));let s=e.refine===pM.REPLACE&&e.hasRenderContent&&!a,c=!1,l=!0;for(let e of o)if(e._selectionDepth=r,e.isVisibleAndInRequestVolume?(n.find(e)&&n.delete(e),n.push(e),c=!0):(s||i)&&(this.loadTile(e,t),this.touchTile(e,t)),s){let n;if(n=e._inRequestVolume?e.hasRenderContent?e.contentAvailable:this.executeEmptyTraversal(e,t):!1,l&&=n,!l)return!1}return c||(l=!1),l}updateTile(e,t){this.updateTileVisibility(e,t)}selectTile(e,t){this.shouldSelectTile(e)&&(e._selectedFrame=t.frameNumber,this.selectedTiles[e.id]=e)}loadTile(e,t){this.shouldLoadTile(e)&&(e._requestedFrame=t.frameNumber,e._priority=e._getPriority(),this.requestedTiles[e.id]=e)}touchTile(e,t){e.tileset._cache.touch(e),e._touchedFrame=t.frameNumber}canTraverse(e,t){return e.hasChildren?e.hasTilesetContent?!e.contentExpired:this.shouldRefine(e,t):!1}shouldLoadTile(e){return e.hasUnloadedContent||e.contentExpired}shouldSelectTile(e){return e.contentAvailable&&!this.options.skipLevelOfDetail}shouldRefine(e,t,n=!1){let r=e._screenSpaceError;return n&&(r=e.getScreenSpaceError(t,!0)),r>e.tileset.memoryAdjustedScreenSpaceError}updateTileVisibility(e,t){let n=[];if(this.options.viewportTraversersMap)for(let e in this.options.viewportTraversersMap)this.options.viewportTraversersMap[e]===t.viewport.id&&n.push(e);else n.push(t.viewport.id);e.updateVisibility(t,n)}compareDistanceToCamera(e,t){return e._distanceToCamera-t._distanceToCamera}anyChildrenVisible(e,t){let n=!1;for(let r of e.children)r.updateVisibility(t),n||=r.isVisibleAndInRequestVolume;return n}executeEmptyTraversal(e,t){let n=!0,r=this._emptyTraversalStack;for(r.push(e);r.length>0;){let e=r.pop(),i=!e.hasRenderContent&&this.canTraverse(e,t),a=!e.hasRenderContent&&e.children.length===0;if(!i&&!e.contentAvailable&&!a&&(n=!1),this.updateTile(e,t),e.isVisibleAndInRequestVolume||(this.loadTile(e,t),this.touchTile(e,t)),i){let t=e.children;for(let e of t)r.push(e)}}return e.hasEmptyContent||n}},QM=new z;function $M(e){return e!=null}var eN=class{tileset;header;id;url;parent;refine;type;contentUrl;lodMetricType=`geometricError`;lodMetricValue=0;boundingVolume=null;content=null;contentState=fM.UNLOADED;gpuMemoryUsageInBytes=0;children=[];depth=0;viewportIds=[];transform=new V;extensions=null;implicitTiling=null;userData={};computedTransform;hasEmptyContent=!1;hasTilesetContent=!1;traverser=new ZM({});_cacheNode=null;_frameNumber=null;_expireDate=null;_expiredContent=null;_boundingBox=void 0;_distanceToCamera=0;_screenSpaceError=0;_visibilityPlaneMask;_visible=void 0;_contentBoundingVolume;_viewerRequestVolume;_initialTransform=new V;_priority=0;_selectedFrame=0;_requestedFrame=0;_selectionDepth=0;_touchedFrame=0;_centerZDepth=0;_shouldRefine=!1;_stackLength=0;_visitedFrame=0;_inRequestVolume=!1;_lodJudge=null;tileDrawn=!0;constructor(e,t,n,r=``){this.header=t,this.tileset=e,this.id=r||t.id,this.url=t.url,this.parent=n,this.refine=this._getRefine(t.refine),this.type=t.type,this.contentUrl=t.contentUrl,this._initializeLodMetric(t),this._initializeTransforms(t),this._initializeBoundingVolumes(t),this._initializeContent(t),this._initializeRenderingState(t),Object.seal(this)}destroy(){this.header=null}isDestroyed(){return this.header===null}get selected(){return this._selectedFrame===this.tileset._frameNumber}get isVisible(){return this._visible}get isVisibleAndInRequestVolume(){return this._visible&&this._inRequestVolume}get hasRenderContent(){return!this.hasEmptyContent&&!this.hasTilesetContent}get hasChildren(){return this.children.length>0||this.header.children&&this.header.children.length>0}get contentReady(){return this.contentState===fM.READY||this.hasEmptyContent}get contentAvailable(){return!!(this.contentReady&&this.hasRenderContent||this._expiredContent&&!this.contentFailed)}get hasUnloadedContent(){return this.hasRenderContent&&this.contentUnloaded}get contentUnloaded(){return this.contentState===fM.UNLOADED}get contentExpired(){return this.contentState===fM.EXPIRED}get contentFailed(){return this.contentState===fM.FAILED}get distanceToCamera(){return this._distanceToCamera}get screenSpaceError(){return this._screenSpaceError}get boundingBox(){return this._boundingBox||=OM(this.header.boundingVolume,this.boundingVolume),this._boundingBox}getScreenSpaceError(e,t){switch(this.tileset.type){case hM.I3S:return qM(this,e);case hM.TILES3D:return RM(this,e,t);default:throw Error(`Unsupported tileset type`)}}unselect(){this._selectedFrame=0}_getGpuMemoryUsageInBytes(){return this.content.gpuMemoryUsageInBytes||this.content.byteLength||0}_getPriority(){let e=this.tileset._traverser,{skipLevelOfDetail:t}=e.options,n=this.refine===pM.ADD||t;if(n&&!this.isVisible&&this._visible!==void 0||this.tileset._frameNumber-this._touchedFrame>=1||this.contentState===fM.UNLOADED)return-1;let r=this.parent,i=r&&(!n||this._screenSpaceError===0||r.hasTilesetContent)?r._screenSpaceError:this._screenSpaceError,a=e.root?e.root._screenSpaceError:0;return Math.max(a-i,0)}async loadContent(){if(this.hasEmptyContent)return!1;if(this.content)return!0;this.contentExpired&&(this._expireDate=null),this.contentState=fM.LOADING;let e=await this.tileset._requestScheduler.scheduleRequest(this.id,this._getPriority.bind(this));if(!e)return this.contentState=fM.UNLOADED,!1;try{let e=this.tileset.getTileUrl(this.contentUrl),t=this.tileset.loader,n=this.tileset.loadOptions[t.id]||{},r={...this.tileset.loadOptions,[t.id]:{...n,isTileset:this.type===`json`,...this._getLoaderSpecificOptions(t.id)}};return this.content=await tg(e,t,r),this.tileset.options.contentLoader&&await this.tileset.options.contentLoader(this),this._isTileset()&&this.tileset._initializeTileHeaders(this.content,this),this.contentState=fM.READY,this._onContentLoaded(),!0}catch(e){throw this.contentState=fM.FAILED,e}finally{e.done()}}unloadContent(){return this.content&&this.content.destroy&&this.content.destroy(),this.content=null,this.header.content&&this.header.content.destroy&&this.header.content.destroy(),this.header.content=null,this.contentState=fM.UNLOADED,this.tileDrawn=!0,!0}updateVisibility(e,t){if(this._frameNumber===e.frameNumber)return;let n=this.parent,r=n?n._visibilityPlaneMask:Aj.MASK_INDETERMINATE;if(this.tileset._traverser.options.updateTransforms){let e=n?n.computedTransform:this.tileset.modelMatrix;this._updateTransform(e)}this._distanceToCamera=this.distanceToTile(e),this._screenSpaceError=this.getScreenSpaceError(e,!1),this._visibilityPlaneMask=this.visibility(e,r),this._visible=this._visibilityPlaneMask!==Aj.MASK_OUTSIDE,this._inRequestVolume=this.insideViewerRequestVolume(e),this._frameNumber=e.frameNumber,this.viewportIds=t}visibility(e,t){let{cullingVolume:n}=e,{boundingVolume:r}=this;return n.computeVisibilityWithPlaneMask(r,t)}contentVisibility(){return!0}distanceToTile(e){let t=this.boundingVolume;return Math.sqrt(Math.max(t.distanceSquaredTo(e.camera.position),0))}cameraSpaceZDepth({camera:e}){let t=this.boundingVolume;return QM.subVectors(t.center,e.position),e.direction.dot(QM)}insideViewerRequestVolume(e){let t=this._viewerRequestVolume;return!t||t.distanceSquaredTo(e.camera.position)<=0}updateExpiration(){if($M(this._expireDate)&&this.contentReady&&!this.hasEmptyContent){let e=Date.now();Date.lessThan(this._expireDate,e)&&(this.contentState=fM.EXPIRED,this._expiredContent=this.content)}}get extras(){return this.header.extras}_initializeLodMetric(e){`lodMetricType`in e?this.lodMetricType=e.lodMetricType:(this.lodMetricType=this.parent&&this.parent.lodMetricType||this.tileset.lodMetricType,console.warn(`3D Tile: Required prop lodMetricType is undefined. Using parent lodMetricType`)),`lodMetricValue`in e?this.lodMetricValue=e.lodMetricValue:(this.lodMetricValue=this.parent&&this.parent.lodMetricValue||this.tileset.lodMetricValue,console.warn(`3D Tile: Required prop lodMetricValue is undefined. Using parent lodMetricValue`))}_initializeTransforms(e){this.transform=e.transform?new V(e.transform):new V;let t=this.parent,n=this.tileset,r=t&&t.computedTransform?t.computedTransform.clone():n.modelMatrix.clone();this.computedTransform=new V(r).multiplyRight(this.transform);let i=t&&t._initialTransform?t._initialTransform.clone():new V;this._initialTransform=new V(i).multiplyRight(this.transform)}_initializeBoundingVolumes(e){this._contentBoundingVolume=null,this._viewerRequestVolume=null,this._updateBoundingVolume(e)}_initializeContent(e){this.content={_tileset:this.tileset,_tile:this},this.hasEmptyContent=!0,this.contentState=fM.UNLOADED,this.hasTilesetContent=!1,e.contentUrl&&(this.content=null,this.hasEmptyContent=!1)}_initializeRenderingState(e){this.depth=e.level||(this.parent?this.parent.depth+1:0),this._shouldRefine=!1,this._distanceToCamera=0,this._centerZDepth=0,this._screenSpaceError=0,this._visibilityPlaneMask=Aj.MASK_INDETERMINATE,this._visible=void 0,this._inRequestVolume=!1,this._stackLength=0,this._selectionDepth=0,this._frameNumber=0,this._touchedFrame=0,this._visitedFrame=0,this._selectedFrame=0,this._requestedFrame=0,this._priority=0}_getRefine(e){return e||this.parent&&this.parent.refine||pM.REPLACE}_isTileset(){return this.contentUrl.indexOf(`.json`)!==-1}_onContentLoaded(){switch(this.content&&this.content.type){case`vctr`:case`geom`:this.tileset._traverser.disableSkipLevelOfDetail=!0;break;default:}this._isTileset()?this.hasTilesetContent=!0:this.gpuMemoryUsageInBytes=this._getGpuMemoryUsageInBytes()}_updateBoundingVolume(e){this.boundingVolume=DM(e.boundingVolume,this.computedTransform,this.boundingVolume);let t=e.content;t&&(t.boundingVolume&&(this._contentBoundingVolume=DM(t.boundingVolume,this.computedTransform,this._contentBoundingVolume)),e.viewerRequestVolume&&(this._viewerRequestVolume=DM(e.viewerRequestVolume,this.computedTransform,this._viewerRequestVolume)))}_updateTransform(e=new V){let t=e.clone().multiplyRight(this.transform);t.equals(this.computedTransform)||(this.computedTransform=t,this._updateBoundingVolume(this.header))}_getLoaderSpecificOptions(e){switch(e){case`i3s`:return{...this.tileset.options.i3s,_tileOptions:{attributeUrls:this.header.attributeUrls,textureUrl:this.header.textureUrl,textureFormat:this.header.textureFormat,textureLoaderOptions:this.header.textureLoaderOptions,materialDefinition:this.header.materialDefinition,isDracoGeometry:this.header.isDracoGeometry,mbs:this.header.mbs},_tilesetOptions:{store:this.tileset.tileset.store,attributeStorageInfo:this.tileset.tileset.attributeStorageInfo,fields:this.tileset.tileset.fields},isTileHeader:!1};default:return JM(this.tileset.tileset)}}},tN=class extends ZM{compareDistanceToCamera(e,t){return t._distanceToCamera===0&&e._distanceToCamera===0?t._centerZDepth-e._centerZDepth:t._distanceToCamera-e._distanceToCamera}updateTileVisibility(e,t){if(super.updateTileVisibility(e,t),!e.isVisibleAndInRequestVolume)return;let n=e.children.length>0;if(e.hasTilesetContent&&n){let n=e.children[0];this.updateTileVisibility(n,t),e._visible=n._visible;return}if(this.meetsScreenSpaceErrorEarly(e,t)){e._visible=!1;return}let r=e.refine===pM.REPLACE,i=e._optimChildrenWithinParent===_M.USE_OPTIMIZATION;if(r&&i&&n&&!this.anyChildrenVisible(e,t)){e._visible=!1;return}}meetsScreenSpaceErrorEarly(e,t){let{parent:n}=e;return!n||n.hasTilesetContent||n.refine!==pM.ADD?!1:!this.shouldRefine(e,t,!0)}},nN=class{frameNumberMap=new Map;register(e,t){let n=this.frameNumberMap.get(e)||new Map,r=n.get(t)||0;n.set(t,r+1),this.frameNumberMap.set(e,n)}deregister(e,t){let n=this.frameNumberMap.get(e);if(!n)return;let r=n.get(t)||1;n.set(t,r-1)}isZero(e,t){return(this.frameNumberMap.get(e)?.get(t)||0)===0}},rN={REQUESTED:`REQUESTED`,COMPLETED:`COMPLETED`,ERROR:`ERROR`},iN=class{_statusMap;pendingTilesRegister=new nN;constructor(){this._statusMap={}}add(e,t,n,r){if(!this._statusMap[t]){let{frameNumber:i,viewport:{id:a}}=r;this._statusMap[t]={request:e,callback:n,key:t,frameState:r,status:rN.REQUESTED},this.pendingTilesRegister.register(a,i),e().then(e=>{this._statusMap[t].status=rN.COMPLETED;let{frameNumber:n,viewport:{id:i}}=this._statusMap[t].frameState;this.pendingTilesRegister.deregister(i,n),this._statusMap[t].callback(e,r)}).catch(e=>{this._statusMap[t].status=rN.ERROR;let{frameNumber:r,viewport:{id:i}}=this._statusMap[t].frameState;this.pendingTilesRegister.deregister(i,r),n(e)})}}update(e,t){if(this._statusMap[e]){let{frameNumber:n,viewport:{id:r}}=this._statusMap[e].frameState;this.pendingTilesRegister.deregister(r,n);let{frameNumber:i,viewport:{id:a}}=t;this.pendingTilesRegister.register(a,i),this._statusMap[e].frameState=t}}find(e){return this._statusMap[e]}hasPendingTiles(e,t){return!this.pendingTilesRegister.isZero(e,t)}},aN=class extends ZM{_tileManager;constructor(e){super(e),this._tileManager=new iN}traversalFinished(e){return!this._tileManager.hasPendingTiles(e.viewport.id,this._frameNumber||0)}shouldRefine(e,t){return e._lodJudge=KM(e,t),e._lodJudge===`DIG`}updateChildTiles(e,t){let n=e.header.children||[],r=e.children,i=e.tileset;for(let a of n){let n=`${a.id}-${t.viewport.id}`,o=r&&r.find(e=>e.id===n);if(o)o&&this.updateTile(o,t);else{let r=()=>this._loadTile(a.id,i);this._tileManager.find(n)?this._tileManager.update(n,t):(i.tileset.nodePages&&(r=()=>i.tileset.nodePagesTile.formTileFromNodePages(a.id)),this._tileManager.add(r,n,t=>this._onTileLoad(t,e,n),t))}}return!1}async _loadTile(e,t){let{loader:n}=t;return await tg(t.getTileUrl(`${t.url}/nodes/${e}`),n,{...t.loadOptions,i3s:{...t.loadOptions.i3s,isTileHeader:!0}})}_onTileLoad(e,t,n){let r=new eN(t.tileset,e,t,n);t.children.push(r);let i=this._tileManager.find(r.id).frameState;this.updateTile(r,i),this._frameNumber===i.frameNumber&&(this.traversalFinished(i)||new Date().getTime()-this.lastUpdate>this.updateDebounceTime)&&this.executeTraversal(r,i)}},oN={description:``,ellipsoid:J.WGS84,modelMatrix:new V,throttleRequests:!0,maxRequests:64,maximumMemoryUsage:32,memoryCacheOverflow:1,maximumTilesSelected:0,debounceTime:0,onTileLoad:()=>{},onTileUnload:()=>{},onTileError:()=>{},onTraversalComplete:e=>e,onUpdate:()=>{},contentLoader:void 0,viewDistanceScale:1,maximumScreenSpaceError:8,memoryAdjustedScreenSpaceError:!1,loadTiles:!0,updateTransforms:!0,viewportTraversersMap:null,loadOptions:{fetch:{}},attributions:[],basePath:``,i3s:{}},sN=`Tiles In Tileset(s)`,cN=`Tiles In Memory`,lN=`Tiles In View`,uN=`Tiles To Render`,dN=`Tiles Loaded`,fN=`Tiles Loading`,pN=`Tiles Unloaded`,mN=`Failed Tile Loads`,hN=`Points/Vertices`,gN=`Tile Memory Use`,_N=`Maximum Screen Space Error`,vN=class{options;loadOptions;type;tileset;loader;url;basePath;modelMatrix;ellipsoid;lodMetricType;lodMetricValue;refine;root=null;roots={};asset={};description=``;properties;extras=null;attributions={};credits={};stats;contentFormats={draco:!1,meshopt:!1,dds:!1,ktx2:!1};cartographicCenter=null;cartesianCenter=null;zoom=1;boundingVolume=null;dynamicScreenSpaceErrorComputedDensity=0;maximumMemoryUsage=32;gpuMemoryUsageInBytes=0;memoryAdjustedScreenSpaceError=0;_cacheBytes=0;_cacheOverflowBytes=0;_frameNumber=0;_queryParams={};_extensionsUsed=[];_tiles={};_pendingCount=0;selectedTiles=[];traverseCounter=0;geometricError=0;lastUpdatedVieports=null;_requestedTiles=[];_emptyTiles=[];frameStateData={};_traverser;_cache=new sj;_requestScheduler;_heldTiles=new Set;updatePromise=null;tilesetInitializationPromise;constructor(e,t){this.options={...oN,...t},this.tileset=e,this.loader=e.loader,this.type=e.type,this.url=e.url,this.basePath=e.basePath||wm(this.url),this.modelMatrix=this.options.modelMatrix,this.ellipsoid=this.options.ellipsoid,this.lodMetricType=e.lodMetricType,this.lodMetricValue=e.lodMetricValue,this.refine=e.root.refine,this.loadOptions=this.options.loadOptions||{},this._traverser=this._initializeTraverser(),this._requestScheduler=new fm({throttleRequests:this.options.throttleRequests,maxRequests:this.options.maxRequests}),this.memoryAdjustedScreenSpaceError=this.options.maximumScreenSpaceError,this._cacheBytes=this.options.maximumMemoryUsage*1024*1024,this._cacheOverflowBytes=this.options.memoryCacheOverflow*1024*1024,this.stats=new kt({id:this.url}),this._initializeStats(),this.tilesetInitializationPromise=this._initializeTileSet(e)}destroy(){this._destroy()}isLoaded(){return this._pendingCount===0&&this._frameNumber!==0&&this._requestedTiles.length===0}get tiles(){return Object.values(this._tiles)}get frameNumber(){return this._frameNumber}get queryParams(){return new URLSearchParams(this._queryParams).toString()}setProps(e){this.options={...this.options,...e}}getTileUrl(e){if(e.startsWith(`data:`))return e;let t=e;return this.queryParams.length&&(t=`${e}${e.includes(`?`)?`&`:`?`}${this.queryParams}`),t}hasExtension(e){return this._extensionsUsed.indexOf(e)>-1}update(e=null){this.tilesetInitializationPromise.then(()=>{!e&&this.lastUpdatedVieports?e=this.lastUpdatedVieports:this.lastUpdatedVieports=e,e&&this.doUpdate(e)})}async selectTiles(e=null){return await this.tilesetInitializationPromise,e&&(this.lastUpdatedVieports=e),this.updatePromise||=new Promise(e=>{setTimeout(()=>{this.lastUpdatedVieports&&this.doUpdate(this.lastUpdatedVieports),e(this._frameNumber),this.updatePromise=null},this.options.debounceTime)}),this.updatePromise}adjustScreenSpaceError(){this.gpuMemoryUsageInBytes<this._cacheBytes?this.memoryAdjustedScreenSpaceError=Math.max(this.memoryAdjustedScreenSpaceError/1.02,this.options.maximumScreenSpaceError):this.gpuMemoryUsageInBytes>this._cacheBytes+this._cacheOverflowBytes&&(this.memoryAdjustedScreenSpaceError*=1.02)}doUpdate(e){if(`loadTiles`in this.options&&!this.options.loadTiles||this.traverseCounter>0)return;let t=e instanceof Array?e:[e];this._cache.reset(),this._frameNumber++,this.traverseCounter=t.length;let n=[];for(let e of t){let t=e.id;this._needTraverse(t)?n.push(t):this.traverseCounter--}for(let e of t){let t=e.id;if(this.roots[t]||(this.roots[t]=this._initializeTileHeaders(this.tileset,null)),!n.includes(t))continue;let r=$j(e,this._frameNumber);this._traverser.traverse(this.roots[t],r,this.options)}}_needTraverse(e){let t=e;return this.options.viewportTraversersMap&&(t=this.options.viewportTraversersMap[e]),t===e}_onTraversalEnd(e){let t=e.viewport.id;this.frameStateData[t]||(this.frameStateData[t]={selectedTiles:[],_requestedTiles:[],_emptyTiles:[]});let n=this.frameStateData[t],[r,i]=eM(Object.values(this._traverser.selectedTiles),e,this.options.maximumTilesSelected);n.selectedTiles=r;for(let e of i)e.unselect();n._requestedTiles=Object.values(this._traverser.requestedTiles),n._emptyTiles=Object.values(this._traverser.emptyTiles),this.traverseCounter--,!(this.traverseCounter>0)&&this._updateTiles()}_updateTiles(){let e=this.selectedTiles;this.selectedTiles=[],this._requestedTiles=[],this._emptyTiles=[];for(let e in this.frameStateData){let t=this.frameStateData[e];this.selectedTiles=this.selectedTiles.concat(t.selectedTiles),this._requestedTiles=this._requestedTiles.concat(t._requestedTiles),this._emptyTiles=this._emptyTiles.concat(t._emptyTiles)}this.selectedTiles=this.options.onTraversalComplete(this.selectedTiles);let t=new Set(this.selectedTiles.map(e=>e.id)),n=this.selectedTiles.some(e=>!e.tileDrawn),r=0;if(n){for(let e of t)this._heldTiles.add(e);for(let e of this._heldTiles){if(t.has(e))continue;let n=this._tiles[e];n&&n.contentAvailable?(n._selectedFrame=this._frameNumber,this.selectedTiles.push(n),r++):this._heldTiles.delete(e)}}else this._heldTiles=t;r>0&&setTimeout(()=>{this.selectTiles()},0);for(let e of this.selectedTiles)this._tiles[e.id]=e;this._loadTiles(),this._unloadTiles(),this._updateStats(),this._tilesChanged(e,this.selectedTiles)&&this.options.onUpdate()}_tilesChanged(e,t){if(e.length!==t.length)return!0;let n=new Set(e.map(e=>e.id)),r=new Set(t.map(e=>e.id)),i=e.filter(e=>!r.has(e.id)).length>0;return i||=t.filter(e=>!n.has(e.id)).length>0,i}_loadTiles(){this._requestedTiles.sort((e,t)=>e._priority-t._priority);for(let e of this._requestedTiles)e.contentUnloaded&&this._loadTile(e)}_unloadTiles(){this._cache.unloadTiles(this,(e,t)=>e._unloadTile(t))}_updateStats(){let e=0,t=0;for(let n of this.selectedTiles)n.contentAvailable&&n.content&&(e++,n.content.pointCount?t+=n.content.pointCount:t+=n.content.vertexCount);this.stats.get(lN).count=this.selectedTiles.length,this.stats.get(uN).count=e,this.stats.get(hN).count=t,this.stats.get(_N).count=this.memoryAdjustedScreenSpaceError}async _initializeTileSet(e){this.type===hM.I3S&&(this.calculateViewPropsI3S(),e.root=await e.root),this.root=this._initializeTileHeaders(e,null),this.type===hM.TILES3D&&(this._initializeTiles3DTileset(e),this.calculateViewPropsTiles3D()),this.type===hM.I3S&&this._initializeI3STileset()}calculateViewPropsI3S(){let e=this.tileset.fullExtent;if(e){let{xmin:t,xmax:n,ymin:r,ymax:i,zmin:a,zmax:o}=e;this.cartographicCenter=new z(t+(n-t)/2,r+(i-r)/2,a+(o-a)/2),this.cartesianCenter=new z,J.WGS84.cartographicToCartesian(this.cartographicCenter,this.cartesianCenter),this.zoom=lM(e,this.cartographicCenter,this.cartesianCenter);return}let t=this.tileset.store?.extent;if(t){let[e,n,r,i]=t;this.cartographicCenter=new z(e+(r-e)/2,n+(i-n)/2,0),this.cartesianCenter=new z,J.WGS84.cartographicToCartesian(this.cartographicCenter,this.cartesianCenter),this.zoom=uM(t,this.cartographicCenter,this.cartesianCenter);return}console.warn(`Extent is not defined in the tileset header`),this.cartographicCenter=new z,this.zoom=1}calculateViewPropsTiles3D(){let e=this.root,{center:t}=e.boundingVolume;if(!t){console.warn(`center was not pre-calculated for the root tile`),this.cartographicCenter=new z,this.zoom=1;return}t[0]!==0||t[1]!==0||t[2]!==0?(this.cartographicCenter=new z,J.WGS84.cartesianToCartographic(t,this.cartographicCenter)):this.cartographicCenter=new z(0,0,-J.WGS84.radii[0]),this.cartesianCenter=t,this.zoom=cM(e.boundingVolume,this.cartographicCenter)}_initializeStats(){this.stats.get(sN),this.stats.get(fN),this.stats.get(cN),this.stats.get(lN),this.stats.get(uN),this.stats.get(dN),this.stats.get(pN),this.stats.get(mN),this.stats.get(hN),this.stats.get(gN,`memory`),this.stats.get(_N)}_initializeTileHeaders(e,t){let n=new eN(this,e.root,t);if(t&&(t.children.push(n),n.depth=t.depth+1),this.type===hM.TILES3D){let e=[];for(e.push(n);e.length>0;){let t=e.pop();this.stats.get(sN).incrementCount();let n=t.header.children||[];for(let r of n){let n=new eN(this,r,t);if(n.contentUrl?.includes(`?session=`)){let e=new URL(n.contentUrl).searchParams.get(`session`);e&&(this._queryParams.session=e)}t.children.push(n),n.depth=t.depth+1,e.push(n)}}}return n}_initializeTraverser(){let e;switch(this.type){case hM.TILES3D:e=tN;break;case hM.I3S:e=aN;break;default:e=ZM}return new e({basePath:this.basePath,onTraversalEnd:this._onTraversalEnd.bind(this)})}_destroyTileHeaders(e){this._destroySubtree(e)}async _loadTile(e){let t;try{this._onStartTileLoading(),t=await e.loadContent()}catch(t){this._onTileLoadError(e,t instanceof Error?t:Error(`load failed`))}finally{this._onEndTileLoading(),this._onTileLoad(e,t)}}_onTileLoadError(e,t){this.stats.get(mN).incrementCount();let n=t.message||t.toString(),r=e.url;console.error(`A 3D tile failed to load: ${e.url} ${n}`),this.options.onTileError(e,n,r)}_onTileLoad(e,t){if(t){if(this.type===hM.I3S){let e=this.tileset?.nodePagesTile?.nodesInNodePages||0;this.stats.get(sN).reset(),this.stats.get(sN).addCount(e)}e&&e.content&&cj(e,e.content),this.updateContentTypes(e),this._addTileToCache(e),this.options.onTileLoad(e)}}updateContentTypes(e){if(this.type===hM.I3S)switch(e.header.isDracoGeometry&&(this.contentFormats.draco=!0),e.header.textureFormat){case`dds`:this.contentFormats.dds=!0;break;case`ktx2`:this.contentFormats.ktx2=!0;break;default:}else if(this.type===hM.TILES3D){let{extensionsRemoved:t=[]}=e.content?.gltf||{};t.includes(`KHR_draco_mesh_compression`)&&(this.contentFormats.draco=!0),t.includes(`EXT_meshopt_compression`)&&(this.contentFormats.meshopt=!0),t.includes(`KHR_texture_basisu`)&&(this.contentFormats.ktx2=!0)}}_onStartTileLoading(){this._pendingCount++,this.stats.get(fN).incrementCount()}_onEndTileLoading(){this._pendingCount--,this.stats.get(fN).decrementCount()}_addTileToCache(e){this._cache.add(this,e,t=>t._updateCacheStats(e))}_updateCacheStats(e){this.stats.get(dN).incrementCount(),this.stats.get(cN).incrementCount(),this.gpuMemoryUsageInBytes+=e.gpuMemoryUsageInBytes||0,this.stats.get(gN).count=this.gpuMemoryUsageInBytes,this.options.memoryAdjustedScreenSpaceError&&this.adjustScreenSpaceError()}_unloadTile(e){this.gpuMemoryUsageInBytes-=e.gpuMemoryUsageInBytes||0,this.stats.get(cN).decrementCount(),this.stats.get(pN).incrementCount(),this.stats.get(gN).count=this.gpuMemoryUsageInBytes,this.options.onTileUnload(e),e.unloadContent()}_destroy(){let e=[];for(this.root&&e.push(this.root);e.length>0;){let t=e.pop();for(let n of t.children)e.push(n);this._destroyTile(t)}this.root=null}_destroySubtree(e){let t=e,n=[];for(n.push(t);n.length>0;){e=n.pop();for(let t of e.children)n.push(t);e!==t&&this._destroyTile(e)}t.children=[]}_destroyTile(e){this._cache.unloadTile(this,e),this._unloadTile(e),e.destroy()}_initializeTiles3DTileset(e){if(e.queryString){let t=new URLSearchParams(e.queryString),n=Object.fromEntries(t.entries());this._queryParams={...this._queryParams,...n}}if(this.asset=e.asset,!this.asset)throw Error(`Tileset must have an asset property.`);if(this.asset.version!==`0.0`&&this.asset.version!==`1.0`&&this.asset.version!==`1.1`)throw Error(`The tileset must be 3D Tiles version either 0.0 or 1.0 or 1.1.`);`tilesetVersion`in this.asset&&(this._queryParams.v=this.asset.tilesetVersion),this.credits={attributions:this.options.attributions||[]},this.description=this.options.description||``,this.properties=e.properties,this.geometricError=e.geometricError,this._extensionsUsed=e.extensionsUsed||[],this.extras=e.extras}_initializeI3STileset(){let e=this.loadOptions.i3s;e&&typeof e==`object`&&`token`in e&&(this._queryParams.token=e.token)}},yN=`4.4.3`,bN={COMPOSITE:`cmpt`,POINT_CLOUD:`pnts`,BATCHED_3D_MODEL:`b3dm`,INSTANCED_3D_MODEL:`i3dm`,GEOMETRY:`geom`,VECTOR:`vect`,GLTF:`glTF`};Object.keys(bN);function xN(e,t,n){H(e instanceof ArrayBuffer);let r=new TextDecoder(`utf8`),i=new Uint8Array(e,t,n);return r.decode(i)}function SN(e,t=0){let n=new DataView(e);return`\
${String.fromCharCode(n.getUint8(t+0))}\
${String.fromCharCode(n.getUint8(t+1))}\
${String.fromCharCode(n.getUint8(t+2))}\
${String.fromCharCode(n.getUint8(t+3))}`}var CN={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Y={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,INT:5124,UNSIGNED_INT:5125,FLOAT:5126,DOUBLE:5130},X={...CN,...Y},wN={[Y.DOUBLE]:Float64Array,[Y.FLOAT]:Float32Array,[Y.UNSIGNED_SHORT]:Uint16Array,[Y.UNSIGNED_INT]:Uint32Array,[Y.UNSIGNED_BYTE]:Uint8Array,[Y.BYTE]:Int8Array,[Y.SHORT]:Int16Array,[Y.INT]:Int32Array},TN={DOUBLE:Y.DOUBLE,FLOAT:Y.FLOAT,UNSIGNED_SHORT:Y.UNSIGNED_SHORT,UNSIGNED_INT:Y.UNSIGNED_INT,UNSIGNED_BYTE:Y.UNSIGNED_BYTE,BYTE:Y.BYTE,SHORT:Y.SHORT,INT:Y.INT},EN=`Failed to convert GL type`,DN=class e{static fromTypedArray(e){e=ArrayBuffer.isView(e)?e.constructor:e;for(let t in wN)if(wN[t]===e)return t;throw Error(EN)}static fromName(e){let t=TN[e];if(!t)throw Error(EN);return t}static getArrayType(e){switch(e){case Y.UNSIGNED_SHORT_5_6_5:case Y.UNSIGNED_SHORT_4_4_4_4:case Y.UNSIGNED_SHORT_5_5_5_1:return Uint16Array;default:let t=wN[e];if(!t)throw Error(EN);return t}}static getByteSize(t){return e.getArrayType(t).BYTES_PER_ELEMENT}static validate(t){return!!e.getArrayType(t)}static createTypedArray(t,n,r=0,i){i===void 0&&(i=(n.byteLength-r)/e.getByteSize(t));let a=ArrayBuffer.isView(n)?n.buffer:n;return new(e.getArrayType(t))(a,r,i)}};function ON(e,t=[0,0,0]){let n=e>>11&31,r=e>>5&63,i=e&31;return t[0]=n<<3,t[1]=r<<2,t[2]=i<<3,t}function kN(e,t){if(!e)throw Error(`math.gl assertion failed. ${t}`)}new Es,new z,new Es,new Es;function AN(e,t=255){return $o(e,0,t)/t*2-1}function jN(e){return e<0?-1:1}function MN(e,t,n,r){if(kN(r),e<0||e>n||t<0||t>n)throw Error(`x and y must be unsigned normalized integers between 0 and ${n}`);if(r.x=AN(e,n),r.y=AN(t,n),r.z=1-(Math.abs(r.x)+Math.abs(r.y)),r.z<0){let e=r.x;r.x=(1-Math.abs(r.y))*jN(e),r.y=(1-Math.abs(e))*jN(r.y)}return r.normalize()}function NN(e,t,n){return MN(e,t,255,n)}var PN=class{json;buffer;featuresLength=0;_cachedTypedArrays={};constructor(e,t){this.json=e,this.buffer=t}getExtension(e){return this.json.extensions&&this.json.extensions[e]}hasProperty(e){return!!this.json[e]}getGlobalProperty(e,t=X.UNSIGNED_INT,n=1){let r=this.json[e];return r&&Number.isFinite(r.byteOffset)?this._getTypedArrayFromBinary(e,t,n,1,r.byteOffset):r}getPropertyArray(e,t,n){let r=this.json[e];return r&&Number.isFinite(r.byteOffset)?(`componentType`in r&&(t=DN.fromName(r.componentType)),this._getTypedArrayFromBinary(e,t,n,this.featuresLength,r.byteOffset)):this._getTypedArrayFromArray(e,t,r)}getProperty(e,t,n,r,i){let a=this.json[e];if(!a)return a;let o=this.getPropertyArray(e,t,n);if(n===1)return o[r];for(let e=0;e<n;++e)i[e]=o[n*r+e];return i}_getTypedArrayFromBinary(e,t,n,r,i){let a=this._cachedTypedArrays,o=a[e];return o||(o=DN.createTypedArray(t,this.buffer.buffer,this.buffer.byteOffset+i,r*n),a[e]=o),o}_getTypedArrayFromArray(e,t,n){let r=this._cachedTypedArrays,i=r[e];if(!i){if(ArrayBuffer.isView(n)){let e=n.byteOffset,r=n.byteLength/DN.getByteSize(t);i=DN.createTypedArray(t,n.buffer,e,r)}else i=n instanceof ArrayBuffer?DN.createTypedArray(t,n):new(DN.getArrayType(t))(n);r[e]=i}return i}},FN={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},IN={SCALAR:(e,t)=>e[t],VEC2:(e,t)=>[e[2*t+0],e[2*t+1]],VEC3:(e,t)=>[e[3*t+0],e[3*t+1],e[3*t+2]],VEC4:(e,t)=>[e[4*t+0],e[4*t+1],e[4*t+2],e[4*t+3]],MAT2:(e,t)=>[e[4*t+0],e[4*t+1],e[4*t+2],e[4*t+3]],MAT3:(e,t)=>[e[9*t+0],e[9*t+1],e[9*t+2],e[9*t+3],e[9*t+4],e[9*t+5],e[9*t+6],e[9*t+7],e[9*t+8]],MAT4:(e,t)=>[e[16*t+0],e[16*t+1],e[16*t+2],e[16*t+3],e[16*t+4],e[16*t+5],e[16*t+6],e[16*t+7],e[16*t+8],e[16*t+9],e[16*t+10],e[16*t+11],e[16*t+12],e[16*t+13],e[16*t+14],e[16*t+15]]},LN={SCALAR:(e,t,n)=>{t[n]=e},VEC2:(e,t,n)=>{t[2*n+0]=e[0],t[2*n+1]=e[1]},VEC3:(e,t,n)=>{t[3*n+0]=e[0],t[3*n+1]=e[1],t[3*n+2]=e[2]},VEC4:(e,t,n)=>{t[4*n+0]=e[0],t[4*n+1]=e[1],t[4*n+2]=e[2],t[4*n+3]=e[3]},MAT2:(e,t,n)=>{t[4*n+0]=e[0],t[4*n+1]=e[1],t[4*n+2]=e[2],t[4*n+3]=e[3]},MAT3:(e,t,n)=>{t[9*n+0]=e[0],t[9*n+1]=e[1],t[9*n+2]=e[2],t[9*n+3]=e[3],t[9*n+4]=e[4],t[9*n+5]=e[5],t[9*n+6]=e[6],t[9*n+7]=e[7],t[9*n+8]=e[8],t[9*n+9]=e[9]},MAT4:(e,t,n)=>{t[16*n+0]=e[0],t[16*n+1]=e[1],t[16*n+2]=e[2],t[16*n+3]=e[3],t[16*n+4]=e[4],t[16*n+5]=e[5],t[16*n+6]=e[6],t[16*n+7]=e[7],t[16*n+8]=e[8],t[16*n+9]=e[9],t[16*n+10]=e[10],t[16*n+11]=e[11],t[16*n+12]=e[12],t[16*n+13]=e[13],t[16*n+14]=e[14],t[16*n+15]=e[15]}};function RN(e,t,n,r){let{componentType:i}=e;H(e.componentType);let a=typeof i==`string`?DN.fromName(i):i,o=FN[e.type],s=IN[e.type],c=LN[e.type];return n+=e.byteOffset,{values:DN.createTypedArray(a,t,n,o*r),type:a,size:o,unpacker:s,packer:c}}var zN=e=>e!==void 0;function BN(e,t,n){if(!t)return null;let r=e.getExtension(`3DTILES_batch_table_hierarchy`),i=t.HIERARCHY;return i&&(console.warn(`3D Tile Parser: HIERARCHY is deprecated. Use 3DTILES_batch_table_hierarchy.`),t.extensions=t.extensions||{},t.extensions[`3DTILES_batch_table_hierarchy`]=i,r=i),r?VN(r,n):null}function VN(e,t){let n,r,i,a=e.instancesLength,o=e.classes,s=e.classIds,c=e.parentCounts,l=e.parentIds,u=a;zN(s.byteOffset)&&(s.componentType=defaultValue(s.componentType,GL.UNSIGNED_SHORT),s.type=AttributeType.SCALAR,i=getBinaryAccessor(s),s=i.createArrayBufferView(t.buffer,t.byteOffset+s.byteOffset,a));let d;if(zN(c))for(zN(c.byteOffset)&&(c.componentType=defaultValue(c.componentType,GL.UNSIGNED_SHORT),c.type=AttributeType.SCALAR,i=getBinaryAccessor(c),c=i.createArrayBufferView(t.buffer,t.byteOffset+c.byteOffset,a)),d=new Uint16Array(a),u=0,n=0;n<a;++n)d[n]=u,u+=c[n];zN(l)&&zN(l.byteOffset)&&(l.componentType=defaultValue(l.componentType,GL.UNSIGNED_SHORT),l.type=AttributeType.SCALAR,i=getBinaryAccessor(l),l=i.createArrayBufferView(t.buffer,t.byteOffset+l.byteOffset,u));let f=o.length;for(n=0;n<f;++n){let e=o[n].length,r=o[n].instances,i=getBinaryProperties(e,r,t);o[n].instances=combine(i,r)}let p=Array(f).fill(0),m=new Uint16Array(a);for(n=0;n<a;++n)r=s[n],m[n]=p[r],++p[r];let h={classes:o,classIds:s,classIndexes:m,parentCounts:c,parentIndexes:d,parentIds:l};return GN(h),h}function HN(e,t,n){if(!e)return;let r=e.parentCounts;return e.parentIds?n(e,t):r>0?UN(e,t,n):WN(e,t,n)}function UN(e,t,n){let r=e.classIds,i=e.parentCounts,a=e.parentIds,o=e.parentIndexes,s=r.length,c=scratchVisited;c.length=Math.max(c.length,s);let l=++marker,u=scratchStack;for(u.length=0,u.push(t);u.length>0;){if(t=u.pop(),c[t]===l)continue;c[t]=l;let r=n(e,t);if(zN(r))return r;let s=i[t],d=o[t];for(let e=0;e<s;++e){let n=a[d+e];n!==t&&u.push(n)}}return null}function WN(e,t,n){let r=!0;for(;r;){let i=n(e,t);if(zN(i))return i;let a=e.parentIds[t];r=a!==t,t=a}throw Error(`traverseHierarchySingleParent`)}function GN(e){let t=e.classIds.length;for(let n=0;n<t;++n)KN(e,n,stack)}function KN(e,t,n){let r=e.parentCounts,i=e.parentIds,a=e.parentIndexes,o=e.classIds.length;if(!zN(i))return;assert(t<o,`Parent index ${t} exceeds the total number of instances: ${o}`),assert(n.indexOf(t)===-1,`Circular dependency detected in the batch table hierarchy.`),n.push(t);let s=zN(r)?r[t]:1,c=zN(r)?a[t]:t;for(let r=0;r<s;++r){let a=i[c+r];a!==t&&KN(e,a,n)}n.pop(t)}function qN(e){return e!=null}var JN=(e,t)=>e,YN={HIERARCHY:!0,extensions:!0,extras:!0},XN=class{json;binary;featureCount;_extensions;_properties;_binaryProperties;_hierarchy;constructor(e,t,n,r={}){H(n>=0),this.json=e||{},this.binary=t,this.featureCount=n,this._extensions=this.json?.extensions||{},this._properties={};for(let e in this.json)YN[e]||(this._properties[e]=this.json[e]);this._binaryProperties=this._initializeBinaryProperties(),r[`3DTILES_batch_table_hierarchy`]&&(this._hierarchy=BN(this,this.json,this.binary))}getExtension(e){return this.json&&this.json.extensions&&this.json.extensions[e]}memorySizeInBytes(){return 0}isClass(e,t){return this._checkBatchId(e),H(typeof t==`string`,t),this._hierarchy?qN(HN(this._hierarchy,e,(e,n)=>{let r=e.classIds[n];return e.classes[r].name===t})):!1}isExactClass(e,t){return H(typeof t==`string`,t),this.getExactClassName(e)===t}getExactClassName(e){if(this._checkBatchId(e),this._hierarchy){let t=this._hierarchy.classIds[e];return this._hierarchy.classes[t].name}}hasProperty(e,t){return this._checkBatchId(e),H(typeof t==`string`,t),qN(this._properties[t])||this._hasPropertyInHierarchy(e,t)}getPropertyNames(e,t){this._checkBatchId(e),t=qN(t)?t:[],t.length=0;let n=Object.keys(this._properties);return t.push(...n),this._hierarchy&&this._getPropertyNamesInHierarchy(e,t),t}getProperty(e,t){if(this._checkBatchId(e),H(typeof t==`string`,t),this._binaryProperties){let n=this._binaryProperties[t];if(qN(n))return this._getBinaryProperty(n,e)}let n=this._properties[t];if(qN(n))return JN(n[e],!0);if(this._hierarchy){let n=this._getHierarchyProperty(e,t);if(qN(n))return n}}setProperty(e,t,n){let r=this.featureCount;if(this._checkBatchId(e),H(typeof t==`string`,t),this._binaryProperties){let r=this._binaryProperties[t];if(r){this._setBinaryProperty(r,e,n);return}}if(this._hierarchy&&this._setHierarchyProperty(this,e,t,n))return;let i=this._properties[t];qN(i)||(this._properties[t]=Array(r),i=this._properties[t]),i[e]=JN(n,!0)}_checkBatchId(e){if(!(e>=0&&e<this.featureCount))throw Error(`batchId not in range [0, featureCount - 1].`)}_getBinaryProperty(e,t){return e.unpack(e.typedArray,t)}_setBinaryProperty(e,t,n){e.pack(n,e.typedArray,t)}_initializeBinaryProperties(){let e=null;for(let t in this._properties){let n=this._properties[t],r=this._initializeBinaryProperty(t,n);r&&(e||={},e[t]=r)}return e}_initializeBinaryProperty(e,t){if(`byteOffset`in t){let n=t;H(this.binary,`Property ${e} requires a batch table binary.`),H(n.type,`Property ${e} requires a type.`);let r=RN(n,this.binary.buffer,this.binary.byteOffset|0,this.featureCount);return{typedArray:r.values,componentCount:r.size,unpack:r.unpacker,pack:r.packer}}return null}_hasPropertyInHierarchy(e,t){return this._hierarchy?qN(HN(this._hierarchy,e,(e,n)=>{let r=e.classIds[n],i=e.classes[r].instances;return qN(i[t])})):!1}_getPropertyNamesInHierarchy(e,t){HN(this._hierarchy,e,(e,n)=>{let r=e.classIds[n],i=e.classes[r].instances;for(let e in i)i.hasOwnProperty(e)&&t.indexOf(e)===-1&&t.push(e)})}_getHierarchyProperty(e,t){return HN(this._hierarchy,e,(e,n)=>{let r=e.classIds[n],i=e.classes[r],a=e.classIndexes[n],o=i.instances[t];return qN(o)?qN(o.typedArray)?this._getBinaryProperty(o,a):JN(o[a],!0):null})}_setHierarchyProperty(e,t,n,r){return qN(HN(this._hierarchy,t,(e,i)=>{let a=e.classIds[i],o=e.classes[a],s=e.classIndexes[i],c=o.instances[n];return qN(c)?(H(i===t,`Inherited property "${n}" is read-only.`),qN(c.typedArray)?this._setBinaryProperty(c,s,r):c[s]=JN(r,!0),!0):!1}))}},ZN=4;function QN(e,t,n=0){let r=new DataView(t);if(e.magic=r.getUint32(n,!0),n+=ZN,e.version=r.getUint32(n,!0),n+=ZN,e.byteLength=r.getUint32(n,!0),n+=ZN,e.version!==1)throw Error(`3D Tile Version ${e.version} not supported`);return n}var $N=4,eP=`b3dm tile in legacy format.`;function tP(e,t,n){let r=new DataView(t),i;e.header=e.header||{};let a=r.getUint32(n,!0);n+=$N;let o=r.getUint32(n,!0);n+=$N;let s=r.getUint32(n,!0);n+=$N;let c=r.getUint32(n,!0);return n+=$N,s>=570425344?(n-=$N*2,i=a,s=o,c=0,a=0,o=0,console.warn(eP)):c>=570425344&&(n-=$N,i=s,s=a,c=o,a=0,o=0,console.warn(eP)),e.header.featureTableJsonByteLength=a,e.header.featureTableBinaryByteLength=o,e.header.batchTableJsonByteLength=s,e.header.batchTableBinaryByteLength=c,e.header.batchLength=i,n}function nP(e,t,n,r){return n=rP(e,t,n,r),n=iP(e,t,n,r),n}function rP(e,t,n,r){let{featureTableJsonByteLength:i,featureTableBinaryByteLength:a,batchLength:o}=e.header||{};if(e.featureTableJson={BATCH_LENGTH:o||0},i&&i>0){let r=xN(t,n,i);e.featureTableJson=JSON.parse(r)}return n+=i||0,e.featureTableBinary=new Uint8Array(t,n,a),n+=a||0,n}function iP(e,t,n,r){let{batchTableJsonByteLength:i,batchTableBinaryByteLength:a}=e.header||{};if(i&&i>0){let r=xN(t,n,i);e.batchTableJson=JSON.parse(r),n+=i,a&&a>0&&(e.batchTableBinary=new Uint8Array(t,n,a),e.batchTableBinary=new Uint8Array(e.batchTableBinary),n+=a)}return n}function aP(e,t,n){if(!t&&(!e||!e.batchIds||!n))return null;let{batchIds:r,isRGB565:i,pointCount:a=0}=e;if(r&&n){let e=new Uint8ClampedArray(a*3);for(let t=0;t<a;t++){let i=r[t],a=n.getProperty(i,`dimensions`).map(e=>e*255);e[t*3]=a[0],e[t*3+1]=a[1],e[t*3+2]=a[2]}return{type:X.UNSIGNED_BYTE,value:e,size:3,normalized:!0}}if(t&&i){let e=new Uint8ClampedArray(a*3);for(let n=0;n<a;n++){let r=ON(t[n]);e[n*3]=r[0],e[n*3+1]=r[1],e[n*3+2]=r[2]}return{type:X.UNSIGNED_BYTE,value:e,size:3,normalized:!0}}return t&&t.length===a*3?{type:X.UNSIGNED_BYTE,value:t,size:3,normalized:!0}:{type:X.UNSIGNED_BYTE,value:t||new Uint8ClampedArray,size:4,normalized:!0}}var oP=new z;function sP(e,t){if(!t)return null;if(e.isOctEncoded16P){let n=new Float32Array((e.pointsLength||0)*3);for(let r=0;r<(e.pointsLength||0);r++)NN(t[r*2],t[r*2+1],oP),oP.toArray(n,r*3);return{type:X.FLOAT,size:2,value:n}}return{type:X.FLOAT,size:2,value:t}}function cP(e,t,n){return e.isQuantized?n[`3d-tiles`]&&n[`3d-tiles`].decodeQuantizedPositions?(e.isQuantized=!1,lP(e,t)):{type:X.UNSIGNED_SHORT,value:t,size:3,normalized:!0}:t}function lP(e,t){let n=new z,r=new Float32Array(e.pointCount*3);for(let i=0;i<e.pointCount;i++)n.set(t[i*3],t[i*3+1],t[i*3+2]).scale(1/e.quantizedRange).multiply(e.quantizedVolumeScale).add(e.quantizedVolumeOffset).toArray(r,i*3);return r}async function uP(e,t,n,r,i){n=QN(e,t,n),n=tP(e,t,n),n=nP(e,t,n,r),dP(e);let{featureTable:a,batchTable:o}=fP(e);return await _P(e,a,o,r,i),pP(e,a,r),mP(e,a,o),hP(e,a),n}function dP(e){e.attributes={positions:null,colors:null,normals:null,batchIds:null},e.isQuantized=!1,e.isTranslucent=!1,e.isRGB565=!1,e.isOctEncoded16P=!1}function fP(e){let t=new PN(e.featureTableJson,e.featureTableBinary),n=t.getGlobalProperty(`POINTS_LENGTH`);if(!Number.isFinite(n))throw Error(`POINTS_LENGTH must be defined`);return t.featuresLength=n,e.featuresLength=n,e.pointsLength=n,e.pointCount=n,e.rtcCenter=t.getGlobalProperty(`RTC_CENTER`,X.FLOAT,3),{featureTable:t,batchTable:gP(e,t)}}function pP(e,t,n){if(e.attributes=e.attributes||{positions:null,colors:null,normals:null,batchIds:null},!e.attributes.positions){if(t.hasProperty(`POSITION`))e.attributes.positions=t.getPropertyArray(`POSITION`,X.FLOAT,3);else if(t.hasProperty(`POSITION_QUANTIZED`)){let r=t.getPropertyArray(`POSITION_QUANTIZED`,X.UNSIGNED_SHORT,3);if(e.isQuantized=!0,e.quantizedRange=65535,e.quantizedVolumeScale=t.getGlobalProperty(`QUANTIZED_VOLUME_SCALE`,X.FLOAT,3),!e.quantizedVolumeScale)throw Error(`QUANTIZED_VOLUME_SCALE must be defined for quantized positions.`);if(e.quantizedVolumeOffset=t.getGlobalProperty(`QUANTIZED_VOLUME_OFFSET`,X.FLOAT,3),!e.quantizedVolumeOffset)throw Error(`QUANTIZED_VOLUME_OFFSET must be defined for quantized positions.`);e.attributes.positions=cP(e,r,n)}}if(!e.attributes.positions)throw Error(`Either POSITION or POSITION_QUANTIZED must be defined.`)}function mP(e,t,n){if(e.attributes=e.attributes||{positions:null,colors:null,normals:null,batchIds:null},!e.attributes.colors){let r=null;t.hasProperty(`RGBA`)?(r=t.getPropertyArray(`RGBA`,X.UNSIGNED_BYTE,4),e.isTranslucent=!0):t.hasProperty(`RGB`)?r=t.getPropertyArray(`RGB`,X.UNSIGNED_BYTE,3):t.hasProperty(`RGB565`)&&(r=t.getPropertyArray(`RGB565`,X.UNSIGNED_SHORT,1),e.isRGB565=!0),e.attributes.colors=aP(e,r,n)}t.hasProperty(`CONSTANT_RGBA`)&&(e.constantRGBA=t.getGlobalProperty(`CONSTANT_RGBA`,X.UNSIGNED_BYTE,4))}function hP(e,t){if(e.attributes=e.attributes||{positions:null,colors:null,normals:null,batchIds:null},!e.attributes.normals){let n=null;t.hasProperty(`NORMAL`)?n=t.getPropertyArray(`NORMAL`,X.FLOAT,3):t.hasProperty(`NORMAL_OCT16P`)&&(n=t.getPropertyArray(`NORMAL_OCT16P`,X.UNSIGNED_BYTE,2),e.isOctEncoded16P=!0),e.attributes.normals=sP(e,n)}}function gP(e,t){let n=null;if(!e.batchIds&&t.hasProperty(`BATCH_ID`)&&(e.batchIds=t.getPropertyArray(`BATCH_ID`,X.UNSIGNED_SHORT,1),e.batchIds)){let r=t.getGlobalProperty(`BATCH_LENGTH`);if(!r)throw Error(`Global property: BATCH_LENGTH must be defined when BATCH_ID is defined.`);let{batchTableJson:i,batchTableBinary:a}=e;n=new XN(i,a,r)}return n}async function _P(e,t,n,r,i){let a,o,s,c=e.batchTableJson&&e.batchTableJson.extensions&&e.batchTableJson.extensions[`3DTILES_draco_point_compression`];c&&(s=c.properties);let l=t.getExtension(`3DTILES_draco_point_compression`);if(l){o=l.properties;let t=l.byteOffset,n=l.byteLength;if(!o||!Number.isFinite(t)||!n)throw Error(`Draco properties, byteOffset, and byteLength must be defined`);a=(e.featureTableBinary||[]).slice(t,t+n),e.hasPositions=Number.isFinite(o.POSITION),e.hasColors=Number.isFinite(o.RGB)||Number.isFinite(o.RGBA),e.hasNormals=Number.isFinite(o.NORMAL),e.hasBatchIds=Number.isFinite(o.BATCH_ID),e.isTranslucent=Number.isFinite(o.RGBA)}return a?await vP(e,{buffer:a,properties:{...o,...s},featureTableProperties:o,batchTableProperties:s,dequantizeInShader:!1},r,i):!0}async function vP(e,t,n,r){if(!r)return;let i={...n,draco:{...n?.draco,extraAttributes:t.batchTableProperties||{}}};delete i[`3d-tiles`];let a=await Hf(t.buffer,jO,i,r),o=a.attributes.POSITION&&a.attributes.POSITION.value,s=a.attributes.COLOR_0&&a.attributes.COLOR_0.value,c=a.attributes.NORMAL&&a.attributes.NORMAL.value,l=a.attributes.BATCH_ID&&a.attributes.BATCH_ID.value,u=o&&a.attributes.POSITION.value.quantization,d=c&&a.attributes.NORMAL.value.quantization;if(u){let t=a.POSITION.data.quantization,n=t.range;e.quantizedVolumeScale=new z(n,n,n),e.quantizedVolumeOffset=new z(t.minValues),e.quantizedRange=(1<<t.quantizationBits)-1,e.isQuantizedDraco=!0}d&&(e.octEncodedRange=(1<<a.NORMAL.data.quantization.quantizationBits)-1,e.isOctEncodedDraco=!0);let f={};if(t.batchTableProperties)for(let e of Object.keys(t.batchTableProperties))a.attributes[e]&&a.attributes[e].value&&(f[e.toLowerCase()]=a.attributes[e].value);e.attributes={positions:o,colors:aP(e,s,void 0),normals:c,batchIds:l,...f}}var yP={URI:0,EMBEDDED:1};function bP(e,t,n,r){e.rotateYtoZ=!0;let i=(e.byteOffset||0)+(e.byteLength||0)-n;if(i===0)throw Error(`glTF byte length must be greater than 0.`);return e.gltfUpAxis=r?.[`3d-tiles`]&&r[`3d-tiles`].assetGltfUpAxis?r[`3d-tiles`].assetGltfUpAxis:`Y`,e.gltfArrayBuffer=em(t,n,i),e.gltfByteOffset=0,e.gltfByteLength=i,n%4==0||console.warn(`${e.type}: embedded glb is not aligned to a 4-byte boundary.`),(e.byteOffset||0)+(e.byteLength||0)}async function xP(e,t,n,r){let i=n?.[`3d-tiles`]||{};if(SP(e,t,n),i.loadGLTF){if(!r)return;if(e.gltfUrl){let{fetch:t}=r;e.gltfArrayBuffer=await(await t(e.gltfUrl,n?.core)).arrayBuffer(),e.gltfByteOffset=0}e.gltfArrayBuffer&&(e.gltf=hA(await Hf(e.gltfArrayBuffer,iA,n,r)),e.gpuMemoryUsageInBytes=DE(e.gltf),delete e.gltfArrayBuffer,delete e.gltfByteOffset,delete e.gltfByteLength)}}function SP(e,t,n){switch(t){case yP.URI:if(e.gltfArrayBuffer){let t=new Uint8Array(e.gltfArrayBuffer,e.gltfByteOffset);e.gltfUrl=new TextDecoder().decode(t).replace(/[\s\0]+$/,``)}delete e.gltfArrayBuffer,delete e.gltfByteOffset,delete e.gltfByteLength;break;case yP.EMBEDDED:break;default:throw Error(`b3dm: Illegal glTF format field`)}}async function CP(e,t,n,r,i){n=wP(e,t,n,r,i),await xP(e,yP.EMBEDDED,r,i);let a=e?.gltf?.extensions;return a&&a.CESIUM_RTC&&(e.rtcCenter=a.CESIUM_RTC.center),n}function wP(e,t,n,r,i){return n=QN(e,t,n),n=tP(e,t,n),n=nP(e,t,n,r),n=bP(e,t,n,r),e.rtcCenter=new PN(e.featureTableJson,e.featureTableBinary).getGlobalProperty(`RTC_CENTER`,X.FLOAT,3),n}async function TP(e,t,n,r,i){return n=EP(e,t,n,r,i),await xP(e,e.gltfFormat||0,r,i),n}function EP(e,t,n,r,i){if(n=QN(e,t,n),e.version!==1)throw Error(`Instanced 3D Model version ${e.version} is not supported`);if(n=tP(e,t,n),e.gltfFormat=new DataView(t).getUint32(n,!0),n+=4,n=nP(e,t,n,r),n=bP(e,t,n,r),!e?.header?.featureTableJsonByteLength||e.header.featureTableJsonByteLength===0)throw Error(`i3dm parser: featureTableJsonByteLength is zero.`);let a=new PN(e.featureTableJson,e.featureTableBinary),o=a.getGlobalProperty(`INSTANCES_LENGTH`);if(a.featuresLength=o,!Number.isFinite(o))throw Error(`i3dm parser: INSTANCES_LENGTH must be defined`);return e.eastNorthUp=a.getGlobalProperty(`EAST_NORTH_UP`),e.rtcCenter=a.getGlobalProperty(`RTC_CENTER`,X.FLOAT,3),DP(e,a,new XN(e.batchTableJson,e.batchTableBinary,o),o),n}function DP(e,t,n,r){let i=Array(r),a=new z;new z,new z,new z;let o=new B,s=new Cl,c=new z,l={},u=new V,d=[],f=[],p=[],m=[];for(let n=0;n<r;n++){let r;if(t.hasProperty(`POSITION`))r=t.getProperty(`POSITION`,X.FLOAT,3,n,a);else if(t.hasProperty(`POSITION_QUANTIZED`)){r=t.getProperty(`POSITION_QUANTIZED`,X.UNSIGNED_SHORT,3,n,a);let e=t.getGlobalProperty(`QUANTIZED_VOLUME_OFFSET`,X.FLOAT,3);if(!e)throw Error(`i3dm parser: QUANTIZED_VOLUME_OFFSET must be defined for quantized positions.`);let i=t.getGlobalProperty(`QUANTIZED_VOLUME_SCALE`,X.FLOAT,3);if(!i)throw Error(`i3dm parser: QUANTIZED_VOLUME_SCALE must be defined for quantized positions.`);for(let t=0;t<3;t++)r[t]=r[t]/65535*i[t]+e[t]}if(!r)throw Error(`i3dm: POSITION or POSITION_QUANTIZED must be defined for each instance.`);if(a.copy(r),l.translation=a,e.normalUp=t.getProperty(`NORMAL_UP`,X.FLOAT,3,n,d),e.normalRight=t.getProperty(`NORMAL_RIGHT`,X.FLOAT,3,n,f),e.normalUp){if(!e.normalRight)throw Error(`i3dm: Custom orientation requires both NORMAL_UP and NORMAL_RIGHT.`);e.hasCustomOrientation=!0}else{if(e.octNormalUp=t.getProperty(`NORMAL_UP_OCT32P`,X.UNSIGNED_SHORT,2,n,d),e.octNormalRight=t.getProperty(`NORMAL_RIGHT_OCT32P`,X.UNSIGNED_SHORT,2,n,f),e.octNormalUp)throw e.octNormalRight?Error(`i3dm: oct-encoded orientation not implemented`):Error(`i3dm: oct-encoded orientation requires NORMAL_UP_OCT32P and NORMAL_RIGHT_OCT32P`);e.eastNorthUp?(J.WGS84.eastNorthUpToFixedFrame(a,u),u.getRotationMatrix3(o)):o.identity()}s.fromMatrix3(o),l.rotation=s,c.set(1,1,1);let h=t.getProperty(`SCALE`,X.FLOAT,1,n,p);Number.isFinite(h)&&c.multiplyByScalar(h);let g=t.getProperty(`SCALE_NON_UNIFORM`,X.FLOAT,3,n,d);g&&c.scale(g),l.scale=c;let _=t.getProperty(`BATCH_ID`,X.UNSIGNED_SHORT,1,n,m);_===void 0&&(_=n);let v=new V().fromQuaternion(l.rotation);u.identity(),u.translate(l.translation),u.multiplyRight(v),u.scale(l.scale),i[n]={modelMatrix:u.clone(),batchId:_}}e.instances=i}async function OP(e,t,n,r,i,a){for(n=QN(e,t,n),e.tilesLength=new DataView(t).getUint32(n,!0),n+=4,e.tiles=[];e.tiles.length<e.tilesLength&&(e.byteLength||0)-n>12;){let o={shape:`tile3d`};e.tiles.push(o),n=await a(t,n,r,i,o)}return n}async function kP(e,t,n,r){if(e.rotateYtoZ=!0,e.gltfUpAxis=n?.[`3d-tiles`]?.assetGltfUpAxis?n[`3d-tiles`].assetGltfUpAxis:`Y`,n?.[`3d-tiles`]?.loadGLTF){if(!r)return t.byteLength;e.gltf=hA(await Hf(t,iA,n,r)),e.gpuMemoryUsageInBytes=DE(e.gltf)}else e.gltfArrayBuffer=t;return t.byteLength}async function AP(e,t=0,n,r,i={shape:`tile3d`}){switch(i.byteOffset=t,i.type=SN(e,t),i.type){case bN.COMPOSITE:return await OP(i,e,t,n,r,AP);case bN.BATCHED_3D_MODEL:return await CP(i,e,t,n,r);case bN.GLTF:return await kP(i,e,n,r);case bN.INSTANCED_3D_MODEL:return await TP(i,e,t,n,r);case bN.POINT_CLOUD:return await uP(i,e,t,n,r);default:throw Error(`3DTileLoader: unknown type ${i.type}`)}}var jP=1952609651,MP=1;async function NP(e,t,n){if(new Uint32Array(e.slice(0,4))[0]!==jP)throw Error(`Wrong subtree file magic number`);if(new Uint32Array(e.slice(4,8))[0]!==MP)throw Error(`Wrong subtree file verson, must be 1`);let r=FP(e.slice(8,16)),i=new Uint8Array(e,24,r),a=new TextDecoder(`utf8`).decode(i),o=JSON.parse(a),s=FP(e.slice(16,24)),c=new ArrayBuffer(0);if(s&&(c=e.slice(24+r)),await PP(o,o.tileAvailability,c,n),Array.isArray(o.contentAvailability))for(let e of o.contentAvailability)await PP(o,e,c,n);else await PP(o,o.contentAvailability,c,n);return await PP(o,o.childSubtreeAvailability,c,n),o}async function PP(e,t,n,r){let i=Number.isFinite(t.bitstream)?t.bitstream:t.bufferView;if(typeof i!=`number`)return;let a=e.bufferViews[i],o=e.buffers[a.buffer];if(!r?.baseUrl)throw Error(`Url is not provided`);if(!r.fetch)throw Error(`fetch is not provided`);if(o.uri){let e=`${r?.baseUrl||``}/${o.uri}`,n=await(await r.fetch(e)).arrayBuffer();t.explicitBitstream=new Uint8Array(n,a.byteOffset,a.byteLength);return}let s=e.buffers.slice(0,a.buffer).reduce((e,t)=>e+t.byteLength,0);t.explicitBitstream=new Uint8Array(n.slice(s,s+o.byteLength),a.byteOffset,a.byteLength)}function FP(e){let t=new DataView(e);return t.getUint32(0,!0)+2**32*t.getUint32(4,!0)}var IP={dataType:null,batchType:null,id:`3d-tiles-subtree`,name:`3D Tiles Subtree`,module:`3d-tiles`,version:yN,extensions:[`subtree`],mimeTypes:[`application/octet-stream`],tests:[`subtree`],parse:NP,options:{}},LP=null;try{LP=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function Z(e,t,n){this.low=e|0,this.high=t|0,this.unsigned=!!n}Z.prototype.__isLong__,Object.defineProperty(Z.prototype,"__isLong__",{value:!0});function RP(e){return(e&&e.__isLong__)===!0}function zP(e){var t=Math.clz32(e&-e);return e?31-t:t}Z.isLong=RP;var BP={},VP={};function HP(e,t){var n,r,i;return t?(e>>>=0,(i=0<=e&&e<256)&&(r=VP[e],r)?r:(n=Q(e,0,!0),i&&(VP[e]=n),n)):(e|=0,(i=-128<=e&&e<128)&&(r=BP[e],r)?r:(n=Q(e,e<0?-1:0,!1),i&&(BP[e]=n),n))}Z.fromInt=HP;function UP(e,t){if(isNaN(e))return t?eF:$P;if(t){if(e<0)return eF;if(e>=XP)return aF}else{if(e<=-ZP)return oF;if(e+1>=ZP)return iF}return e<0?UP(-e,t).neg():Q(e%YP|0,e/YP|0,t)}Z.fromNumber=UP;function Q(e,t,n){return new Z(e,t,n)}Z.fromBits=Q;var WP=Math.pow;function GP(e,t,n){if(e.length===0)throw Error(`empty string`);if(typeof t==`number`?(n=t,t=!1):t=!!t,e===`NaN`||e===`Infinity`||e===`+Infinity`||e===`-Infinity`)return t?eF:$P;if(n||=10,n<2||36<n)throw RangeError(`radix`);var r;if((r=e.indexOf(`-`))>0)throw Error(`interior hyphen`);if(r===0)return GP(e.substring(1),t,n).neg();for(var i=UP(WP(n,8)),a=$P,o=0;o<e.length;o+=8){var s=Math.min(8,e.length-o),c=parseInt(e.substring(o,o+s),n);if(s<8){var l=UP(WP(n,s));a=a.mul(l).add(UP(c))}else a=a.mul(i),a=a.add(UP(c))}return a.unsigned=t,a}Z.fromString=GP;function KP(e,t){return typeof e==`number`?UP(e,t):typeof e==`string`?GP(e,t):Q(e.low,e.high,typeof t==`boolean`?t:e.unsigned)}Z.fromValue=KP;var qP=65536,JP=1<<24,YP=qP*qP,XP=YP*YP,ZP=XP/2,QP=HP(JP),$P=HP(0);Z.ZERO=$P;var eF=HP(0,!0);Z.UZERO=eF;var tF=HP(1);Z.ONE=tF;var nF=HP(1,!0);Z.UONE=nF;var rF=HP(-1);Z.NEG_ONE=rF;var iF=Q(-1,2147483647,!1);Z.MAX_VALUE=iF;var aF=Q(-1,-1,!0);Z.MAX_UNSIGNED_VALUE=aF;var oF=Q(0,-2147483648,!1);Z.MIN_VALUE=oF;var $=Z.prototype;$.toInt=function(){return this.unsigned?this.low>>>0:this.low},$.toNumber=function(){return this.unsigned?(this.high>>>0)*YP+(this.low>>>0):this.high*YP+(this.low>>>0)},$.toString=function(e){if(e||=10,e<2||36<e)throw RangeError(`radix`);if(this.isZero())return`0`;if(this.isNegative())if(this.eq(oF)){var t=UP(e),n=this.div(t),r=n.mul(t).sub(this);return n.toString(e)+r.toInt().toString(e)}else return`-`+this.neg().toString(e);for(var i=UP(WP(e,6),this.unsigned),a=this,o=``;;){var s=a.div(i),c=(a.sub(s.mul(i)).toInt()>>>0).toString(e);if(a=s,a.isZero())return c+o;for(;c.length<6;)c=`0`+c;o=``+c+o}},$.getHighBits=function(){return this.high},$.getHighBitsUnsigned=function(){return this.high>>>0},$.getLowBits=function(){return this.low},$.getLowBitsUnsigned=function(){return this.low>>>0},$.getNumBitsAbs=function(){if(this.isNegative())return this.eq(oF)?64:this.neg().getNumBitsAbs();for(var e=this.high==0?this.low:this.high,t=31;t>0&&!(e&1<<t);t--);return this.high==0?t+1:t+33},$.isSafeInteger=function(){var e=this.high>>21;return e?this.unsigned?!1:e===-1&&!(this.low===0&&this.high===-2097152):!0},$.isZero=function(){return this.high===0&&this.low===0},$.eqz=$.isZero,$.isNegative=function(){return!this.unsigned&&this.high<0},$.isPositive=function(){return this.unsigned||this.high>=0},$.isOdd=function(){return(this.low&1)==1},$.isEven=function(){return(this.low&1)==0},$.equals=function(e){return RP(e)||(e=KP(e)),this.unsigned!==e.unsigned&&this.high>>>31==1&&e.high>>>31==1?!1:this.high===e.high&&this.low===e.low},$.eq=$.equals,$.notEquals=function(e){return!this.eq(e)},$.neq=$.notEquals,$.ne=$.notEquals,$.lessThan=function(e){return this.comp(e)<0},$.lt=$.lessThan,$.lessThanOrEqual=function(e){return this.comp(e)<=0},$.lte=$.lessThanOrEqual,$.le=$.lessThanOrEqual,$.greaterThan=function(e){return this.comp(e)>0},$.gt=$.greaterThan,$.greaterThanOrEqual=function(e){return this.comp(e)>=0},$.gte=$.greaterThanOrEqual,$.ge=$.greaterThanOrEqual,$.compare=function(e){if(RP(e)||(e=KP(e)),this.eq(e))return 0;var t=this.isNegative(),n=e.isNegative();return t&&!n?-1:!t&&n?1:this.unsigned?e.high>>>0>this.high>>>0||e.high===this.high&&e.low>>>0>this.low>>>0?-1:1:this.sub(e).isNegative()?-1:1},$.comp=$.compare,$.negate=function(){return!this.unsigned&&this.eq(oF)?oF:this.not().add(tF)},$.neg=$.negate,$.add=function(e){RP(e)||(e=KP(e));var t=this.high>>>16,n=this.high&65535,r=this.low>>>16,i=this.low&65535,a=e.high>>>16,o=e.high&65535,s=e.low>>>16,c=e.low&65535,l=0,u=0,d=0,f=0;return f+=i+c,d+=f>>>16,f&=65535,d+=r+s,u+=d>>>16,d&=65535,u+=n+o,l+=u>>>16,u&=65535,l+=t+a,l&=65535,Q(d<<16|f,l<<16|u,this.unsigned)},$.subtract=function(e){return RP(e)||(e=KP(e)),this.add(e.neg())},$.sub=$.subtract,$.multiply=function(e){if(this.isZero())return this;if(RP(e)||(e=KP(e)),LP)return Q(LP.mul(this.low,this.high,e.low,e.high),LP.get_high(),this.unsigned);if(e.isZero())return this.unsigned?eF:$P;if(this.eq(oF))return e.isOdd()?oF:$P;if(e.eq(oF))return this.isOdd()?oF:$P;if(this.isNegative())return e.isNegative()?this.neg().mul(e.neg()):this.neg().mul(e).neg();if(e.isNegative())return this.mul(e.neg()).neg();if(this.lt(QP)&&e.lt(QP))return UP(this.toNumber()*e.toNumber(),this.unsigned);var t=this.high>>>16,n=this.high&65535,r=this.low>>>16,i=this.low&65535,a=e.high>>>16,o=e.high&65535,s=e.low>>>16,c=e.low&65535,l=0,u=0,d=0,f=0;return f+=i*c,d+=f>>>16,f&=65535,d+=r*c,u+=d>>>16,d&=65535,d+=i*s,u+=d>>>16,d&=65535,u+=n*c,l+=u>>>16,u&=65535,u+=r*s,l+=u>>>16,u&=65535,u+=i*o,l+=u>>>16,u&=65535,l+=t*c+n*s+r*o+i*a,l&=65535,Q(d<<16|f,l<<16|u,this.unsigned)},$.mul=$.multiply,$.divide=function(e){if(RP(e)||(e=KP(e)),e.isZero())throw Error(`division by zero`);if(LP)return!this.unsigned&&this.high===-2147483648&&e.low===-1&&e.high===-1?this:Q((this.unsigned?LP.div_u:LP.div_s)(this.low,this.high,e.low,e.high),LP.get_high(),this.unsigned);if(this.isZero())return this.unsigned?eF:$P;var t,n,r;if(this.unsigned){if(e.unsigned||(e=e.toUnsigned()),e.gt(this))return eF;if(e.gt(this.shru(1)))return nF;r=eF}else{if(this.eq(oF))return e.eq(tF)||e.eq(rF)?oF:e.eq(oF)?tF:(t=this.shr(1).div(e).shl(1),t.eq($P)?e.isNegative()?tF:rF:(n=this.sub(e.mul(t)),r=t.add(n.div(e)),r));if(e.eq(oF))return this.unsigned?eF:$P;if(this.isNegative())return e.isNegative()?this.neg().div(e.neg()):this.neg().div(e).neg();if(e.isNegative())return this.div(e.neg()).neg();r=$P}for(n=this;n.gte(e);){t=Math.max(1,Math.floor(n.toNumber()/e.toNumber()));for(var i=Math.ceil(Math.log(t)/Math.LN2),a=i<=48?1:WP(2,i-48),o=UP(t),s=o.mul(e);s.isNegative()||s.gt(n);)t-=a,o=UP(t,this.unsigned),s=o.mul(e);o.isZero()&&(o=tF),r=r.add(o),n=n.sub(s)}return r},$.div=$.divide,$.modulo=function(e){return RP(e)||(e=KP(e)),LP?Q((this.unsigned?LP.rem_u:LP.rem_s)(this.low,this.high,e.low,e.high),LP.get_high(),this.unsigned):this.sub(this.div(e).mul(e))},$.mod=$.modulo,$.rem=$.modulo,$.not=function(){return Q(~this.low,~this.high,this.unsigned)},$.countLeadingZeros=function(){return this.high?Math.clz32(this.high):Math.clz32(this.low)+32},$.clz=$.countLeadingZeros,$.countTrailingZeros=function(){return this.low?zP(this.low):zP(this.high)+32},$.ctz=$.countTrailingZeros,$.and=function(e){return RP(e)||(e=KP(e)),Q(this.low&e.low,this.high&e.high,this.unsigned)},$.or=function(e){return RP(e)||(e=KP(e)),Q(this.low|e.low,this.high|e.high,this.unsigned)},$.xor=function(e){return RP(e)||(e=KP(e)),Q(this.low^e.low,this.high^e.high,this.unsigned)},$.shiftLeft=function(e){return RP(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?Q(this.low<<e,this.high<<e|this.low>>>32-e,this.unsigned):Q(0,this.low<<e-32,this.unsigned)},$.shl=$.shiftLeft,$.shiftRight=function(e){return RP(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?Q(this.low>>>e|this.high<<32-e,this.high>>e,this.unsigned):Q(this.high>>e-32,this.high>=0?0:-1,this.unsigned)},$.shr=$.shiftRight,$.shiftRightUnsigned=function(e){return RP(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?Q(this.low>>>e|this.high<<32-e,this.high>>>e,this.unsigned):Q(e===32?this.high:this.high>>>e-32,0,this.unsigned)},$.shru=$.shiftRightUnsigned,$.shr_u=$.shiftRightUnsigned,$.rotateLeft=function(e){var t;return RP(e)&&(e=e.toInt()),(e&=63)==0?this:e===32?Q(this.high,this.low,this.unsigned):e<32?(t=32-e,Q(this.low<<e|this.high>>>t,this.high<<e|this.low>>>t,this.unsigned)):(e-=32,t=32-e,Q(this.high<<e|this.low>>>t,this.low<<e|this.high>>>t,this.unsigned))},$.rotl=$.rotateLeft,$.rotateRight=function(e){var t;return RP(e)&&(e=e.toInt()),(e&=63)==0?this:e===32?Q(this.high,this.low,this.unsigned):e<32?(t=32-e,Q(this.high<<t|this.low>>>e,this.low<<t|this.high>>>e,this.unsigned)):(e-=32,t=32-e,Q(this.low<<t|this.high>>>e,this.high<<t|this.low>>>e,this.unsigned))},$.rotr=$.rotateRight,$.toSigned=function(){return this.unsigned?Q(this.low,this.high,!1):this},$.toUnsigned=function(){return this.unsigned?this:Q(this.low,this.high,!0)},$.toBytes=function(e){return e?this.toBytesLE():this.toBytesBE()},$.toBytesLE=function(){var e=this.high,t=this.low;return[t&255,t>>>8&255,t>>>16&255,t>>>24,e&255,e>>>8&255,e>>>16&255,e>>>24]},$.toBytesBE=function(){var e=this.high,t=this.low;return[e>>>24,e>>>16&255,e>>>8&255,e&255,t>>>24,t>>>16&255,t>>>8&255,t&255]},Z.fromBytes=function(e,t,n){return n?Z.fromBytesLE(e,t):Z.fromBytesBE(e,t)},Z.fromBytesLE=function(e,t){return new Z(e[0]|e[1]<<8|e[2]<<16|e[3]<<24,e[4]|e[5]<<8|e[6]<<16|e[7]<<24,t)},Z.fromBytesBE=function(e,t){return new Z(e[4]<<24|e[5]<<16|e[6]<<8|e[7],e[0]<<24|e[1]<<16|e[2]<<8|e[3],t)},typeof BigInt==`function`&&(Z.fromBigInt=function(e,t){return Q(Number(BigInt.asIntN(32,e)),Number(BigInt.asIntN(32,e>>BigInt(32))),t)},Z.fromValue=function(e,t){return typeof e==`bigint`?Z.fromBigInt(e,t):KP(e,t)},$.toBigInt=function(){var e=BigInt(this.low>>>0);return BigInt(this.unsigned?this.high>>>0:this.high)<<BigInt(32)|e});var sF=16;function cF(e){e===`X`&&(e=``);let t=e.padEnd(sF,`0`);return Z.fromString(t,!0,16)}function lF(e){if(e.isZero())return`X`;let t=e.countTrailingZeros(),n=t%4;t=(t-n)/4;let r=t;t*=4;let i=e.shiftRightUnsigned(t).toString(16).replace(/0+$/,``);return Array(17-r-i.length).join(`0`)+i}function uF(e,t){let n=dF(e).shiftRightUnsigned(2);return e.add(Z.fromNumber(2*t+1-4).multiply(n))}function dF(e){return e.and(e.not().add(1))}var fF=180/Math.PI;function pF(e){if(e.length===0)throw Error(`Invalid Hilbert quad key ${e}`);let t=e.split(`/`),n=parseInt(t[0],10),r=t[1],i=r.length,a=0,o=[0,0];for(let e=i-1;e>=0;e--){a=i-e;let t=r[e],n=0,s=0;t===`1`?s=1:t===`2`?(n=1,s=1):t===`3`&&(n=1);let c=2**(a-1);bF(c,o,n,s),o[0]+=c*n,o[1]+=c*s}if(n%2==1){let e=o[0];o[0]=o[1],o[1]=e}return{face:n,ij:o,level:a}}function mF(e){if(e.isZero())return``;let t=e.toString(2);for(;t.length<64;)t=`0`+t;let n=t.lastIndexOf(`1`),r=t.substring(0,3),i=t.substring(3,n),a=i.length/2,o=Z.fromString(r,!0,2).toString(10),s=``;if(a!==0)for(s=Z.fromString(i,!0,2).toString(4);s.length<a;)s=`0`+s;return`${o}/${s}`}function hF(e,t,n){let r=1<<t;return[(e[0]+n[0])/r,(e[1]+n[1])/r]}function gF(e){return e>=.5?1/3*(4*e*e-1):1/3*(1-4*(1-e)*(1-e))}function _F(e){return[gF(e[0]),gF(e[1])]}function vF(e,[t,n]){switch(e){case 0:return[1,t,n];case 1:return[-t,1,n];case 2:return[-t,-n,1];case 3:return[-1,-n,-t];case 4:return[n,-1,-t];case 5:return[n,t,-1];default:throw Error(`Invalid face`)}}function yF([e,t,n]){let r=Math.atan2(n,Math.sqrt(e*e+t*t));return[Math.atan2(t,e)*fF,r*fF]}function bF(e,t,n,r){if(r===0){n===1&&(t[0]=e-1-t[0],t[1]=e-1-t[1]);let r=t[0];t[0]=t[1],t[1]=r}}function xF(e){let t=_F(hF(e.ij,e.level,[.5,.5]));return yF(vF(e.face,t))}var SF=100;function CF(e){let{face:t,ij:n,level:r}=e,i=[[0,0],[0,1],[1,1],[1,0],[0,0]],a=Math.max(1,Math.ceil(SF*2**-r)),o=new Float64Array(4*a*2+2),s=0,c=0;for(let e=0;e<4;e++){let l=i[e].slice(0),u=i[e+1],d=(u[0]-l[0])/a,f=(u[1]-l[1])/a;for(let e=0;e<a;e++){l[0]+=d,l[1]+=f;let e=yF(vF(t,_F(hF(n,r,l))));Math.abs(e[1])>89.999&&(e[0]=c);let i=e[0]-c;e[0]+=i>180?-360:i<-180?360:0,o[s++]=e[0],o[s++]=e[1],c=e[0]}}return o[s++]=o[0],o[s++]=o[1],o}function wF(e){return pF(TF(e))}function TF(e){return e.indexOf(`/`)>0?e:mF(cF(e))}function EF(e){return xF(wF(e))}function DF(e){let t;if(e.face===2||e.face===5){let n=null,r=0;for(let t=0;t<4;t++){let i=CF(wF(`${e.face}/${t}`));n??=new Float64Array(4*i.length),n.set(i,r),r+=i.length}t=OF(n)}else t=OF(CF(e));return t}function OF(e){if(e.length%2!=0)throw Error(`Invalid corners`);let t=[],n=[];for(let r=0;r<e.length;r+=2)t.push(e[r]),n.push(e[r+1]);return t.sort((e,t)=>e-t),n.sort((e,t)=>e-t),{west:t[0],east:t[t.length-1],north:n[n.length-1],south:n[0]}}function kF(e,t){let n=t?.minimumHeight||0,r=t?.maximumHeight||0,i=DF(wF(e)),a=i.west,o=i.south,s=i.east,c=i.north,l=[];return l.push(new z(a,c,n)),l.push(new z(s,c,n)),l.push(new z(s,o,n)),l.push(new z(a,o,n)),l.push(new z(a,c,r)),l.push(new z(s,c,r)),l.push(new z(s,o,r)),l.push(new z(a,o,r)),l}function AF(e){let t=e.token,n={minimumHeight:e.minimumHeight,maximumHeight:e.maximumHeight},r=kF(t,n),i=EF(t),a=i[0],o=i[1],s=J.WGS84.cartographicToCartesian([a,o,n.maximumHeight]),c=new z(s[0],s[1],s[2]);r.push(c);let l=Yj(r);return[...l.center,...l.halfAxes]}var jF={QUADTREE:4,OCTREE:8};function MF(e,t,n){if(e?.box){let r=lF(uF(cF(e.s2VolumeInfo.token),t)),i={...e.s2VolumeInfo};switch(i.token=r,n){case`OCTREE`:let t=e.s2VolumeInfo,n=t.maximumHeight-t.minimumHeight,r=n/2,i=t.minimumHeight+n/2;t.minimumHeight=i-r,t.maximumHeight=i+r;break;default:break}return{box:AF(i),s2VolumeInfo:i}}}async function NF(e){let{subtree:t,subtreeData:n={level:0,x:0,y:0,z:0},parentData:r={mortonIndex:0,localLevel:-1,localX:0,localY:0,localZ:0},childIndex:i=0,implicitOptions:a,loaderOptions:o,s2VolumeBox:s}=e,{subdivisionScheme:c,subtreeLevels:l,maximumLevel:u,contentUrlTemplate:d,subtreesUriTemplate:f,basePath:p}=a,m={children:[],lodMetricValue:0,contentUrl:``};if(!u)return ee.once(`Missing 'maximumLevel' or 'availableLevels' property. The subtree ${d} won't be loaded...`),m;let h=r.localLevel+1,g=n.level+h;if(g>u)return m;let _=jF[c],v=Math.log2(_),y=i&1,b=i>>1&1,x=i>>2&1,S=LF(r.localX,y,1),C=LF(r.localY,b,1),w=LF(r.localZ,x,1),T=LF(n.x,S,h),E=LF(n.y,C,h),D=LF(n.z,w,h),O=LF(r.mortonIndex,i,v),k=h===l&&PF(t.childSubtreeAvailability,O),A,j,te,ne;if(k?(A=await tg(RF(`${p}/${f}`,g,T,E,D),IP,o),ne=0,j={level:g,x:T,y:E,z:D},te={mortonIndex:0,localLevel:0,localX:0,localY:0,localZ:0}):(A=t,ne=(_**h-1)/(_-1)+O,j=n,te={mortonIndex:O,localLevel:h,localX:S,localY:C,localZ:w}),!PF(A.tileAvailability,ne))return m;PF(A.contentAvailability,ne)&&(m.contentUrl=RF(d,g,T,E,D));for(let e=0;e<_;e++){let t=MF(s,e,c),n=await NF({subtree:A,subtreeData:j,parentData:te,childIndex:e,implicitOptions:a,loaderOptions:o,s2VolumeBox:t});(n.contentUrl||n.children.length)&&m.children.push(n)}return m.contentUrl||m.children.length?FF(m,{level:g,x:T,y:E,z:D},a,s):m}function PF(e,t){let n;return Array.isArray(e)?(n=e[0],e.length>1&&ee.once(`Not supported extension "3DTILES_multiple_contents" has been detected`)):n=e,`constant`in n?!!n.constant:n.explicitBitstream?BF(t,n.explicitBitstream):!1}function FF(e,t,n,r){let{basePath:i,refine:a,getRefine:o,lodMetricType:s,getTileType:c,rootLodMetricValue:l,rootBoundingVolume:u}=n,d=e.contentUrl&&e.contentUrl.replace(`${i}/`,``),f=l/2**t.level,p=IF(r?.box?{box:r.box}:u,t,n.subdivisionScheme);return{children:e.children,contentUrl:e.contentUrl,content:{uri:d},id:e.contentUrl,refine:o(a),type:c(e),lodMetricType:s,lodMetricValue:f,geometricError:f,transform:e.transform,boundingVolume:p}}function IF(e,t,n){if(e.region){let{level:r,x:i,y:a,z:o}=t,[s,c,l,u,d,f]=e.region,p=2**r,m=(l-s)/p,[h,g]=[s+m*i,s+m*(i+1)],_=(u-c)/p,[v,y]=[c+_*a,c+_*(a+1)],b,x;if(n===`OCTREE`){let e=(f-d)/p;[b,x]=[d+e*o,d+e*(o+1)]}else[b,x]=[d,f];return{region:[h,v,g,y,b,x]}}if(e.box)return e;throw Error(`Unsupported bounding volume type ${JSON.stringify(e)}`)}function LF(e,t,n){return(e<<n)+t}function RF(e,t,n,r,i){let a=zF({level:t,x:n,y:r,z:i});return e.replace(/{level}|{x}|{y}|{z}/gi,e=>a[e])}function zF(e){let t={};for(let n in e)t[`{${n}}`]=e[n];return t}function BF(e,t){let n=Math.floor(e/8),r=e%8;return(t[n]>>r&1)==1}function VF(e,t=``){if(!t)return mM.EMPTY;let n=t.split(`?`)[0].split(`.`).pop();switch(n){case`pnts`:return mM.POINTCLOUD;case`i3dm`:case`b3dm`:case`glb`:case`gltf`:return mM.SCENEGRAPH;default:return n||mM.EMPTY}}function HF(e){switch(e){case`REPLACE`:case`replace`:return pM.REPLACE;case`ADD`:case`add`:return pM.ADD;default:return e}}function UF(e,t){if(/^[a-z][0-9a-z+.-]*:/i.test(t)){let n=new URL(e,`${t}/`);return decodeURI(n.toString())}else if(e.startsWith(`/`))return e;return Tm(t,e)}function WF(e,t){if(!e)return null;let n;if(e.content){let r=e.content.uri||e.content?.url;r!==void 0&&(n=UF(r,t))}return{...e,id:n,contentUrl:n,lodMetricType:gM.GEOMETRIC_ERROR,lodMetricValue:e.geometricError,transformMatrix:e.transform,type:VF(e,n),refine:HF(e.refine)}}async function GF(e,t,n){let r=null,i=JF(e.root);r=i&&e.root?await KF(e.root,e,t,i,n):WF(e.root,t);let a=[];for(a.push(r);a.length>0;){let r=a.pop()||{},i=r.children||[],o=[];for(let r of i){let i=JF(r),s;s=i?await KF(r,e,t,i,n):WF(r,t),s&&(o.push(s),a.push(s))}r.children=o}return r}async function KF(e,t,n,r,i){let{subdivisionScheme:a,maximumLevel:o,availableLevels:s,subtreeLevels:c,subtrees:{uri:l}}=r,u=await tg(UF(RF(l,0,0,0,0),n),IP,i),d=e.content?.uri,f=d?UF(d,n):``,p=t?.root?.refine,m=e.geometricError,h=e.boundingVolume.extensions?.[`3DTILES_bounding_volume_S2`];h&&(e.boundingVolume={box:AF(h),s2VolumeInfo:h});let g=e.boundingVolume;return await qF(e,n,u,{contentUrlTemplate:f,subtreesUriTemplate:l,subdivisionScheme:a,subtreeLevels:c,maximumLevel:Number.isFinite(s)?s-1:o,refine:p,basePath:n,lodMetricType:gM.GEOMETRIC_ERROR,rootLodMetricValue:m,rootBoundingVolume:g,getTileType:VF,getRefine:HF},i)}async function qF(e,t,n,r,i){if(!e)return null;let{children:a,contentUrl:o}=await NF({subtree:n,implicitOptions:r,loaderOptions:i}),s,c=null;return o&&(s=o,c={uri:o.replace(`${t}/`,``)}),{...e,id:s,contentUrl:s,lodMetricType:gM.GEOMETRIC_ERROR,lodMetricValue:e.geometricError,transformMatrix:e.transform,type:VF(e,s),refine:HF(e.refine),content:c||e.content,children:a}}function JF(e){return e?.extensions?.[`3DTILES_implicit_tiling`]||e?.implicitTiling}var YF={dataType:null,batchType:null,id:`3d-tiles`,name:`3D Tiles`,module:`3d-tiles`,version:yN,extensions:[`cmpt`,`pnts`,`b3dm`,`i3dm`],mimeTypes:[`application/octet-stream`],tests:[`cmpt`,`pnts`,`b3dm`,`i3dm`],parse:XF,options:{"3d-tiles":{loadGLTF:!0,decodeQuantizedPositions:!1,isTileset:`auto`,assetGltfUpAxis:null}}};async function XF(e,t={},n){let r=t[`3d-tiles`]||{},i;return i=r.isTileset===`auto`?n?.url&&n.url.indexOf(`.json`)!==-1:r.isTileset,i?ZF(e,t,n):QF(e,t,n)}async function ZF(e,t,n){let r=JSON.parse(new TextDecoder().decode(e)),i=n?.url||``,a=$F(i),o=await GF(r,a,t||{});return{...r,shape:`tileset3d`,loader:YF,url:i,queryString:n?.queryString||``,basePath:a,root:o||r.root,type:hM.TILES3D,lodMetricType:gM.GEOMETRIC_ERROR,lodMetricValue:r.root?.geometricError||0}}async function QF(e,t,n){let r={content:{shape:`tile3d`,featureIds:null}};return await AP(e,0,t,n,r.content),r.content}function $F(e){return wm(e)}var eI=[0],tI={getPointColor:{type:`accessor`,value:[0,0,0,255]},pointSize:1,data:``,loader:YF,onTilesetLoad:{type:`function`,value:e=>{}},onTileLoad:{type:`function`,value:e=>{}},onTileUnload:{type:`function`,value:e=>{}},onTileError:{type:`function`,value:(e,t,n)=>{}},_getMeshColor:{type:`function`,value:e=>[255,255,255]}},nI=class extends PS{initializeState(){`onTileLoadFail`in this.props&&O.removed(`onTileLoadFail`,`onTileError`)(),this.state={layerMap:{},tileset3d:null,activeViewports:{},lastUpdatedViewports:null}}get isLoaded(){return!!(this.state?.tileset3d?.isLoaded()&&super.isLoaded)}shouldUpdateState({changeFlags:e}){return e.somethingChanged}updateState({props:e,oldProps:t,changeFlags:n}){if(e.data&&e.data!==t.data&&this._loadTileset(e.data),n.viewportChanged){let{activeViewports:e}=this.state;Object.keys(e).length&&(this._updateTileset(e),this.state.lastUpdatedViewports=e,this.state.activeViewports={})}if(n.propsChanged){let{layerMap:e}=this.state;for(let t in e)e[t].needsUpdate=!0}}finalizeState(e){this.state.tileset3d?.destroy(),this.state.tileset3d=null,this.state.layerMap={},this.state.activeViewports={},this.state.lastUpdatedViewports=null,super.finalizeState(e)}activateViewport(e){let{activeViewports:t,lastUpdatedViewports:n}=this.state;this.internalState.viewport=e,t[e.id]=e;let r=n?.[e.id];(!r||!e.equals(r))&&(this.setChangeFlags({viewportChanged:!0}),this.setNeedsUpdate())}getPickingInfo({info:e,sourceLayer:t}){let n=t&&t.props.tile;return e.picked&&(e.object=n),e.sourceTile=n,e}filterSubLayer({layer:e,viewport:t,cullRect:n,isPicking:r}){let{tile:i}=e.props,{id:a}=t;if(!i.selected||!i.viewportIds.includes(a))return!1;if(r&&n&&i.content?.cartographicOrigin){let[e,r]=t.project(i.content.cartographicOrigin),a=n.x+n.width/2,o=n.y+n.height/2,s=Math.max(t.width,t.height)/4,c=e-a,l=r-o;if(c*c+l*l>s*s)return!1}return!0}_updateAutoHighlight(e){let t=e.sourceTile,n=this.state.layerMap[t?.id];n&&n.layer&&n.layer.updateAutoHighlight(e)}async _loadTileset(e){let t=this.props.loadOptions||{},n=this.props.loaders?.length?this.props.loaders:this.props.loader,r=Array.isArray(n)?n[0]:n,{tileset:i,...a}=t,o={loadOptions:{...a},...i},s=e;if(`preload`in r&&typeof r.preload==`function`){let n=await r.preload(e,t);n.url&&(s=n.url),n.headers&&(o.loadOptions.core={...o.loadOptions.core,fetch:{...o.loadOptions.core?.fetch,headers:n.headers}}),Object.assign(o,n)}let c=new vN(await tg(s,r,o.loadOptions),{onTileLoad:this._onTileLoad.bind(this),onTileUnload:this._onTileUnload.bind(this),onTileError:this.props.onTileError,onUpdate:()=>this.setNeedsUpdate(),...o});this.setState({tileset3d:c,layerMap:{}}),this._updateTileset(this.state.activeViewports),this.props.onTilesetLoad(c)}_onTileLoad(e){let{lastUpdatedViewports:t}=this.state;e.tileDrawn=!1,this.props.onTileLoad(e),this._updateTileset(t),this.setNeedsUpdate()}_onTileUnload(e){delete this.state.layerMap[e.id],this.props.onTileUnload(e)}_updateTileset(e){if(!e)return;let{tileset3d:t}=this.state,{timeline:n}=this.context,r=Object.keys(e).length;!n||!r||!t||t.selectTiles(Object.values(e)).then(e=>{this.state.frameNumber!==e&&this.setState({frameNumber:e})})}_getSubLayer(e,t){if(!e.content)return null;switch(e.type){case mM.POINTCLOUD:return this._makePointCloudLayer(e,t);case mM.SCENEGRAPH:return this._make3DModelLayer(e);case mM.MESH:return this._makeSimpleMeshLayer(e,t);default:throw Error(`Tile3DLayer: Failed to render layer of type ${e.content.type}`)}}_makePointCloudLayer(e,t){let{attributes:n,pointCount:r,constantRGBA:i,cartographicOrigin:a,modelMatrix:o}=e.content,{positions:s,normals:c,colors:l}=n;if(!s)return null;let u=t&&t.props.data||{header:{vertexCount:r},attributes:{POSITION:s,NORMAL:c,COLOR_0:l}},{pointSize:d,getPointColor:f}=this.props;return new(this.getSubLayerClass(`pointcloud`,GS))({pointSize:d},this.getSubLayerProps({id:`pointcloud`}),{id:`${this.id}-pointcloud-${e.id}`,tile:e,data:u,coordinateSystem:St.METER_OFFSETS,coordinateOrigin:a,modelMatrix:o,getColor:i||f,_offset:0})}_make3DModelLayer(e){let{gltf:t,instances:n,cartographicOrigin:r,modelMatrix:i}=e.content;return new(this.getSubLayerClass(`scenegraph`,wA))({_lighting:`pbr`},this.getSubLayerProps({id:`scenegraph`}),{id:`${this.id}-scenegraph-${e.id}`,tile:e,data:n||eI,scenegraph:t,coordinateSystem:St.METER_OFFSETS,coordinateOrigin:r,modelMatrix:i,getTransformMatrix:e=>e.modelMatrix,getPosition:[0,0,0],_offset:0,onFirstDraw:()=>{e.tileDrawn=!0}})}_makeSimpleMeshLayer(e,t){let{attributes:n,indices:r,modelMatrix:i,cartographicOrigin:a,coordinateSystem:o=St.METER_OFFSETS,material:s,featureIds:c}=e.content,{_getMeshColor:l}=this.props,u=t&&t.props.mesh||new Cd({topology:`triangle-list`,attributes:rI(n),indices:r});return new(this.getSubLayerClass(`mesh`,jA))(this.getSubLayerProps({id:`mesh`}),{id:`${this.id}-mesh-${e.id}`,tile:e,mesh:u,data:eI,getColor:l(e),pbrMaterial:s,modelMatrix:i,coordinateOrigin:a,coordinateSystem:o,featureIds:c,_offset:0})}renderLayers(){let{tileset3d:e,layerMap:t}=this.state;return e?e.tiles.map(e=>{let n=t[e.id]=t[e.id]||{tile:e},{layer:r}=n;return e.selected&&(r?n.needsUpdate&&=(r=this._getSubLayer(e,r),!1):r=this._getSubLayer(e)),n.layer=r,r}).filter(Boolean):null}};nI.defaultProps=tI,nI.layerName=`Tile3DLayer`;function rI(e){let t={};return t.positions={...e.positions,value:new Float32Array(e.positions.value)},e.normals&&(t.normals=e.normals),e.texCoords&&(t.texCoords=e.texCoords),e.colors&&(t.colors=e.colors),e.uvRegions&&(t.uvRegions=e.uvRegions),t}var iI={inject:{"vs:#decl":`
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
`}},aI={inject:{"vs:#decl":`
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
`}},oI={inject:{"vs:#decl":`
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
`}},sI={inject:{"vs:#decl":`
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
`}},cI={getDashArray:{type:`accessor`,value:[0,0]},getOffset:{type:`accessor`,value:0},dashJustified:!1,dashGapPickable:!1},lI=class extends FS{constructor({dash:e=!1,offset:t=!1,highPrecisionDash:n=!1}={}){super({dash:e||n,offset:t,highPrecisionDash:n})}getLayerType(e){if(`pathTesselator`in e.state)return`path`;let t=e.constructor.layerName;return t===`ScatterplotLayer`?`scatterplot`:t===`TextBackgroundLayer`?`textBackground`:null}isEnabled(e){return this.getLayerType(e)!==null}getShaders(e){let t=e.getLayerType(this);if(!t)return null;if(t===`scatterplot`||t===`textBackground`)return e.opts.dash?{modules:[{name:`pathStyle`,inject:t===`scatterplot`?aI.inject:oI.inject,uniformTypes:{dashGapPickable:`i32`}}]}:null;let n={},r={};e.opts.dash&&(n=Bx(n,iI),e.opts.highPrecisionDash&&(r.HIGH_PRECISION_DASH=!0)),e.opts.offset&&(n=Bx(n,sI));let{inject:i}=n;return{modules:[{name:`pathStyle`,inject:i,uniformTypes:{dashAlignMode:`f32`,dashGapPickable:`i32`}}],defines:r}}initializeState(e,t){let n=this.getAttributeManager(),r=t.getLayerType(this);!n||!r||(t.opts.dash&&n.addInstanced({instanceDashArrays:{size:2,accessor:`getDashArray`},...r===`path`&&t.opts.highPrecisionDash?{instanceDashOffsets:{size:1,accessor:`getPath`,transform:t.getDashOffsets.bind(this)}}:{}}),r===`path`&&t.opts.offset&&n.addInstanced({instanceOffsets:{size:1,accessor:`getOffset`}}))}updateState(e,t){if(t.isEnabled(this)&&t.opts.dash){let e=t.getLayerType(this);if(e===`scatterplot`||e===`textBackground`){let e={dashGapPickable:!!this.props.dashGapPickable};this.setShaderModuleProps({pathStyle:e})}else{let e={dashAlignMode:+!!this.props.dashJustified,dashGapPickable:!!this.props.dashGapPickable};this.setShaderModuleProps({pathStyle:e})}}}getDashOffsets(e){let t=[0],n=this.props.positionFormat===`XY`?2:3,r=Array.isArray(e[0]),i=r?e.length:e.length/n,a,o;for(let s=0;s<i-1;s++)a=r?e[s]:e.slice(s*n,s*n+n),a=this.projectPosition(a),s>0&&(t[s]=t[s-1]+Ks(o,a)),o=a;return t[i-1]=0,t}};lI.defaultProps=cI,lI.extensionName=`PathStyleExtension`;export{es as $,uf as A,Cd as B,Rf as C,sf as D,Of as E,Kd as F,Bc as G,ql as H,Id as I,Ls as J,z as K,kd as L,pf as M,df as N,vf as O,qd as P,ts as Q,Dd as R,zf as S,kf as T,V as U,dd as V,Pc as W,Gs as X,Js as Y,$o as Z,vg as _,OS as a,Pt as at,tg as b,gb as c,Tt as ct,x_ as d,wt as dt,ko as et,c_ as f,xt as ft,yg as g,bg as h,PS as i,M as it,xf as j,yf as k,T_ as l,Ct as lt,xg as m,a as mt,nI as n,Gn as nt,Mb as o,kt as ot,Sg as p,O as pt,qs as q,sC as r,P as rt,Pb as s,St as st,lI as t,I as tt,b_ as u,Et as ut,ig as v,Lf as w,eh as x,ng as y,wd as z};