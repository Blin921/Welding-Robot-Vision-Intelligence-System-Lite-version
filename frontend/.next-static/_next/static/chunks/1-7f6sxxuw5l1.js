(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,13988,e=>{"use strict";let t,i;var n=e.i(43476),r=e.i(71645),a=e.i(90072),o=e.i(8560),s=e.i(61742),l=a,d=a;let c=new d.VQ,f=new d.cE;class u extends d.Kx{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry",this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute("position",new d.ki([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute("uv",new d.ki([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,i=this.attributes.instanceEnd;return void 0!==t&&(t.applyMatrix4(e),i.applyMatrix4(e),t.needsUpdate=!0),null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let i=new d.hC(t,6,1);return this.setAttribute("instanceStart",new d.Zq(i,3,0)),this.setAttribute("instanceEnd",new d.Zq(i,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let i=new d.hC(t,6,1);return this.setAttribute("instanceColorStart",new d.Zq(i,3,0)),this.setAttribute("instanceColorEnd",new d.Zq(i,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new d.nw(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){null===this.boundingBox&&(this.boundingBox=new d.VQ);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;void 0!==e&&void 0!==t&&(this.boundingBox.setFromBufferAttribute(e),c.setFromBufferAttribute(t),this.boundingBox.union(c))}computeBoundingSphere(){null===this.boundingSphere&&(this.boundingSphere=new d.L0),null===this.boundingBox&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(void 0!==e&&void 0!==t){let i=this.boundingSphere.center;this.boundingBox.getCenter(i);let n=0;for(let r=0,a=e.count;r<a;r++)f.fromBufferAttribute(e,r),n=Math.max(n,i.distanceToSquared(f)),f.fromBufferAttribute(t,r),n=Math.max(n,i.distanceToSquared(f));this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}}var p=a;o.O.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new p.wq(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}},o._.line={uniforms:p.SP.merge([o.O.common,o.O.fog,o.O.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};class h extends p.Zg{constructor(e){super({type:"LineMaterial",uniforms:p.SP.clone(o._.line.uniforms),vertexShader:o._.line.vertexShader,fragmentShader:o._.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){!0===e?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){!0===e!==this.dashed&&(this.needsUpdate=!0),!0===e?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(!0===e!==this.alphaToCoverage&&(this.needsUpdate=!0),!0===e?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}let m=new l.$h,v=new l.cE,w=new l.cE,y=new l.$h,g=new l.$h,x=new l.$h,S=new l.cE,b=new l.nd,E=new l._i,z=new l.cE,A=new l.VQ,_=new l.L0,M=new l.$h;function P(e,t,n){return M.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),M.multiplyScalar(1/M.w),M.x=i/n.width,M.y=i/n.height,M.applyMatrix4(e.projectionMatrixInverse),M.multiplyScalar(1/M.w),Math.abs(Math.max(M.x,M.y))}class U extends l.kE{constructor(e=new u,t=new h({color:0xffffff*Math.random()})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,i=e.attributes.instanceEnd,n=new Float32Array(2*t.count);for(let e=0,r=0,a=t.count;e<a;e++,r+=2)v.fromBufferAttribute(t,e),w.fromBufferAttribute(i,e),n[r]=0===r?0:n[r-1],n[r+1]=n[r]+v.distanceTo(w);let r=new l.hC(n,2,1);return e.setAttribute("instanceDistanceStart",new l.Zq(r,1,0)),e.setAttribute("instanceDistanceEnd",new l.Zq(r,1,1)),this}raycast(e,n){let r,a,o=this.material.worldUnits,s=e.camera;null!==s||o||console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');let d=void 0!==e.params.Line2&&e.params.Line2.threshold||0;t=e.ray;let c=this.matrixWorld,f=this.geometry,u=this.material;if(i=u.linewidth+d,null===f.boundingSphere&&f.computeBoundingSphere(),_.copy(f.boundingSphere).applyMatrix4(c),o)r=.5*i;else{let e=Math.max(s.near,_.distanceToPoint(t.origin));r=P(s,e,u.resolution)}if(_.radius+=r,!1!==t.intersectsSphere(_)){if(null===f.boundingBox&&f.computeBoundingBox(),A.copy(f.boundingBox).applyMatrix4(c),o)a=.5*i;else{let e=Math.max(s.near,A.distanceToPoint(t.origin));a=P(s,e,u.resolution)}A.expandByScalar(a),!1!==t.intersectsBox(A)&&(o?function(e,n){let r=e.matrixWorld,a=e.geometry,o=a.attributes.instanceStart,s=a.attributes.instanceEnd,d=Math.min(a.instanceCount,o.count);for(let a=0;a<d;a++){E.start.fromBufferAttribute(o,a),E.end.fromBufferAttribute(s,a),E.applyMatrix4(r);let d=new l.cE,c=new l.cE;t.distanceSqToSegment(E.start,E.end,c,d),c.distanceTo(d)<.5*i&&n.push({point:c,pointOnLine:d,distance:t.origin.distanceTo(c),object:e,face:null,faceIndex:a,uv:null,uv1:null})}}(this,n):function(e,n,r){let a=n.projectionMatrix,o=e.material.resolution,s=e.matrixWorld,d=e.geometry,c=d.attributes.instanceStart,f=d.attributes.instanceEnd,u=Math.min(d.instanceCount,c.count),p=-n.near;t.at(1,x),x.w=1,x.applyMatrix4(n.matrixWorldInverse),x.applyMatrix4(a),x.multiplyScalar(1/x.w),x.x*=o.x/2,x.y*=o.y/2,x.z=0,S.copy(x),b.multiplyMatrices(n.matrixWorldInverse,s);for(let n=0;n<u;n++){if(y.fromBufferAttribute(c,n),g.fromBufferAttribute(f,n),y.w=1,g.w=1,y.applyMatrix4(b),g.applyMatrix4(b),y.z>p&&g.z>p)continue;if(y.z>p){let e=y.z-g.z,t=(y.z-p)/e;y.lerp(g,t)}else if(g.z>p){let e=g.z-y.z,t=(g.z-p)/e;g.lerp(y,t)}y.applyMatrix4(a),g.applyMatrix4(a),y.multiplyScalar(1/y.w),g.multiplyScalar(1/g.w),y.x*=o.x/2,y.y*=o.y/2,g.x*=o.x/2,g.y*=o.y/2,E.start.copy(y),E.start.z=0,E.end.copy(g),E.end.z=0;let d=E.closestPointToPointParameter(S,!0);E.at(d,z);let u=l.rA.lerp(y.z,g.z,d),h=u>=-1&&u<=1,m=S.distanceTo(z)<.5*i;if(h&&m){E.start.fromBufferAttribute(c,n),E.end.fromBufferAttribute(f,n),E.start.applyMatrix4(s),E.end.applyMatrix4(s);let i=new l.cE,a=new l.cE;t.distanceSqToSegment(E.start,E.end,a,i),r.push({point:a,pointOnLine:i,distance:t.origin.distanceTo(a),object:e,face:null,faceIndex:n,uv:null,uv1:null})}}}(this,s,n))}}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(m),this.material.uniforms.resolution.value.set(m.z,m.w))}}class L extends u{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){let t=e.length-3,i=new Float32Array(2*t);for(let n=0;n<t;n+=3)i[2*n]=e[n],i[2*n+1]=e[n+1],i[2*n+2]=e[n+2],i[2*n+3]=e[n+3],i[2*n+4]=e[n+4],i[2*n+5]=e[n+5];return super.setPositions(i),this}setColors(e){let t=e.length-3,i=new Float32Array(2*t);for(let n=0;n<t;n+=3)i[2*n]=e[n],i[2*n+1]=e[n+1],i[2*n+2]=e[n+2],i[2*n+3]=e[n+3],i[2*n+4]=e[n+4],i[2*n+5]=e[n+5];return super.setColors(i),this}setFromPoints(e){let t=e.length-1,i=new Float32Array(6*t);for(let n=0;n<t;n++)i[6*n]=e[n].x,i[6*n+1]=e[n].y,i[6*n+2]=e[n].z||0,i[6*n+3]=e[n+1].x,i[6*n+4]=e[n+1].y,i[6*n+5]=e[n+1].z||0;return super.setPositions(i),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}}class T extends U{constructor(e=new L,t=new h({color:0xffffff*Math.random()})){super(e,t),this.isLine2=!0,this.type="Line2"}}var C=e.i(4058);e.s(["default",0,function(e){let t=(0,r.useRef)(null),i=(0,r.useRef)(null),[l,d]=(0,r.useState)(!1),{cloud:c,seams:f,interactive:u=!0,reset:p}=e;return(0,r.useEffect)(()=>{let e,n,r,l,p,m=t.current;try{e=new o.T({antialias:!0,alpha:!0,powerPreference:"high-performance"})}catch{queueMicrotask(()=>d(!0));return}let v=new a.P6,w=new a.C9;w.scale.set(1,-1,1),v.add(w);let y=new a.zm(38,1,.1,1e5),g=new a.Sc(-1,1,1,-1,.1,1e5),x=y;e.setPixelRatio(Math.min(devicePixelRatio,2)),m.appendChild(e.domElement);let S=new s.f(x,e.domElement);S.enableDamping=!0,S.enabled=u,S.enablePan=u,S.enableZoom=u;let b=new a.cE(...(0,C.b)(c.header.center)),E=c.header.extent,z=Math.max(1,Math.hypot(E[3]-E[0],E[4]-E[1],E[5]-E[2])/2),A=()=>{let e=a.rA.degToRad(y.fov),t=z/Math.sin(Math.min(e,2*Math.atan(Math.tan(e/2)*y.aspect))/2)*(u?.68:.58),i=b.clone();i.y-=.12*z,x.position.copy(i).add(new a.cE(.62,.5,.72).normalize().multiplyScalar(t)),S.target.copy(i),x.near=Math.max(.1,z/1e4),x.far=100*z,x.updateProjectionMatrix(),S.minDistance=.25*z,S.maxDistance=8*z,S.update()},_=new a.ld;_.setAttribute("position",new a.f5(c.xyz,3));let M=new a.f5(c.rgb,3,!0),P=new a.f5(c.instanceColors,3,!0);_.setAttribute("color",M);let U=new Float32Array(c.header.n).fill(1);if("demo"===c.header.source)for(let e=0;e<c.header.n;e++){let t=c.instance[e],i=c.xyz[3*e]-c.header.center[0],n=-(c.xyz[3*e+1]-c.header.center[1]),r=c.xyz[3*e+2]-c.header.center[2];if(t>=1&&t<=3){let a=i-(t-2)*160,o=n-12,s=Math.hypot(a,o);U[e]=s<46?.07:Math.abs(r)>309?.6:.16+.84*Math.max(0,(-(.35*a)+.86*o)/s)}else if(t>=4&&t<=7){let r=i-(t-5.5)*160,a=n+12,o=Math.hypot(r,a);U[e]=.18+.82*Math.max(0,(-(.35*r)+.86*a)/Math.max(o,1))}else U[e]=0===t?.43:.7}_.setAttribute("surfaceShade",new a.f5(U,1));let O=new a.Nj({size:2,vertexColors:!0,sizeAttenuation:!1,transparent:!0,opacity:.84});O.onBeforeCompile=e=>{e.vertexShader="attribute float surfaceShade; varying float vSurfaceShade;\n"+e.vertexShader.replace("#include <color_vertex>","#include <color_vertex>\nvSurfaceShade=surfaceShade;"),e.fragmentShader="varying float vSurfaceShade;\n"+e.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
       vec2 dotOffset=gl_PointCoord-vec2(0.5);if(dot(dotOffset,dotOffset)>0.25)discard;
       diffuseColor.rgb=mix(pow((diffuseColor.rgb+vec3(0.055))/1.055,vec3(2.4)),diffuseColor.rgb/12.92,lessThanEqual(diffuseColor.rgb,vec3(0.04045)))*vSurfaceShade;
      `)};let D=new a.sy(_,O);w.add(D);let B=10*Math.ceil(1.8*z/10),j=new a.TK(B,B/10,4412778,2965587);j.position.set(b.x,-E[4]-10,b.z),j.material.transparent=!0,j.material.opacity=.35,v.add(j);let R=new Map,F=new Map;for(let e of f){if(e.trajectory_mm.length<2)continue;let t=new L;t.setPositions(e.trajectory_mm.flat());let i=new T(t,new h({color:2873807,side:a.Vs,linewidth:1.5,worldUnits:!1,depthTest:!1,transparent:!0,opacity:.85}));i.renderOrder=2,w.add(i),R.set(e.id,i);let n=new a.YJ(new a.Gu(4,8,8),new a.p$({color:0xffffff,depthTest:!1}),e.trajectory_mm.length),r=new a.nd;e.trajectory_mm.forEach((e,t)=>{r.makeTranslation(...e),n.setMatrixAt(t,r)}),n.renderOrder=3,n.instanceMatrix.needsUpdate=!0,w.add(n),F.set(e.id,n)}let N=new a.C9;N.scale.setScalar(3),v.add(new a.VF(0xffffff,3360349,2));let k=new a.ya(0xffffff,2.5);k.position.set(1,2,3),v.add(k);let H=new a.kE(new a.e0(9,30,64),new a.aV({color:0xf5a13c,metalness:.35,roughness:.28}));H.rotation.x=Math.PI/2,H.position.z=-15,N.add(H);let I=new a.kE(new a.o1(10,10,4,64),new a.aV({color:1461348,metalness:.45,roughness:.3}));I.rotation.x=Math.PI/2,I.position.z=-30,N.add(I);let V=new a.kE(new a.Gu(1.4,20,12),new a.p$({color:0xfff3ce}));N.add(V),N.visible=!1,N.traverse(e=>{e.renderOrder=5,(e instanceof a.kE||e instanceof a.DL)&&(Array.isArray(e.material)?e.material:[e.material]).forEach(e=>{e.transparent=!0,e.depthTest=!1,e.depthWrite=!1})}),w.add(N);let W=new L,q=1;W.setPositions([0,0,0,0,0,0]);let G=new T(W,new h({color:0xf39a42,side:a.Vs,linewidth:4,worldUnits:!1,depthTest:!1}));G.visible=!1,G.renderOrder=4,w.add(G);let $=new a.C9;v.add($);let Z=()=>{$.traverse(e=>{(e instanceof a.kE||e instanceof a.DL)&&(e.geometry.dispose(),(Array.isArray(e.material)?e.material:[e.material]).forEach(e=>e.dispose())),e instanceof a.r$&&(e.material.map?.dispose(),e.material.dispose())}),$.clear()},K="语义",X=0,Y=null,Q=!1,J={x:0,y:0},ee=e=>{J={x:e.clientX,y:e.clientY}},et=t=>{if(!Q||!p||!D.visible||Math.hypot(t.clientX-J.x,t.clientY-J.y)>5)return;let i=e.domElement.getBoundingClientRect(),n=new a.zx;n.params.Points.threshold=.014*z,n.setFromCamera(new a.wq((t.clientX-i.left)/i.width*2-1,-(t.clientY-i.top)/i.height*2+1),x);let r=n.intersectObject(D,!1)[0];r?.index!==void 0&&p(Array.from(c.xyz.subarray(3*r.index,3*r.index+3)))};e.domElement.addEventListener("pointerdown",ee),e.domElement.addEventListener("click",et);let ei=0,en=0,er=!1,ea=()=>{let t=m.clientWidth,i=m.clientHeight;if(!(er=t>0&&i>0))return;if(t===ei&&i===en)return void e.render(v,x);let n=!ei||!en;ei=t,en=i,e.setSize(t,i),y.aspect=t/i;let r=.68*z;for(let e of(g.left=-r*y.aspect,g.right=r*y.aspect,g.top=r,g.bottom=-r,y.setViewOffset(t,i,0,.1*i,t,i),g.setViewOffset(t,i,0,.1*i,t,i),x.updateProjectionMatrix(),R.values()))e.material.resolution.set(t,i);G.material.resolution.set(t,i),n&&A(),e.render(v,x)},eo=new ResizeObserver(ea);eo.observe(m),ea(),A(),i.current={update:e=>{let t="orthographic"===e.projection?g:y;t!==x&&(t.position.copy(x.position),t.quaternion.copy(x.quaternion),t.near=x.near,t.far=x.far,S.object=x=t,x.updateProjectionMatrix(),S.update()),w.visible=!e.hidden,D.visible=!e.hidden,e.bounds&&!l&&(l=new a.av(D,6518151),v.add(l)),l&&(l.visible=!!(e.bounds&&!e.hidden)),p=e.onPointPick,Q=!!e.measuring,S.enabled=u&&!Q,(n!==e.calibrationPairs||r!==e.light)&&(Z(),n=e.calibrationPairs,r=e.light,e.calibrationPairs?.forEach((t,i)=>{if(!t.cam.every(Number.isFinite))return;let n=[0xe9ad23,3439076,2665056][i%3],r=new a.cE(...(0,C.b)(t.cam)),o=r.clone().add(new a.cE(0,130+18*i,0)),s=new a.kE(new a.Gu(5,10,10),new a.p$({color:n,depthTest:!1}));s.position.copy(r),s.renderOrder=6,$.add(s);let l=new a.DL(new a.ld().setFromPoints([r,o]),new a.rd({color:n,dashSize:6,gapSize:3,depthTest:!1}));l.computeLineDistances(),l.renderOrder=6,$.add(l);let d=document.createElement("canvas");d.width=512,d.height=140;let c=d.getContext("2d");c&&(c.fillStyle=e.light?"#eaf0f3ee":"#1e2b35ee",c.fillRect(0,0,512,140),c.fillStyle=new a.Es(n).getStyle(),c.font="bold 29px sans-serif",c.fillText(`${i+1}  点对 ${i+1}`,12,39),c.fillStyle=e.light?"#24343f":"#e1e7e9",c.font="21px monospace",c.fillText(`C (${t.cam.map(e=>e.toFixed(1)).join(", ")})`,12,80),c.fillText(`R (${t.base.map(e=>e.toFixed(1)).join(", ")})`,12,115));let f=new a.Nk(d);f.colorSpace=a.nj;let u=new a.r$(new a.xK({map:f,depthTest:!1,transparent:!0}));u.scale.set(190,52,1),u.position.copy(o).add(new a.cE(65,25,0)),u.renderOrder=7,$.add(u)})),S.mouseButtons.LEFT="pan"===e.interaction?a.vN.PAN:a.vN.ROTATE;let i=e.zoom??0;if(i!==X){let e=x.position.clone().sub(S.target),t=Math.max(S.minDistance,Math.min(S.maxDistance,e.length()*Math.pow(.84,i-X)));x.position.copy(S.target).add(e.setLength(t)),X=i}if(e.mode!==K&&(_.setAttribute("color","实例"===e.mode?P:M),K=e.mode),O.size=e.size,j.visible=e.grid??!0,j.material.opacity=e.light?.12:.2,Y!==e.selected){for(let[t,i]of R){let n=t===e.selected;i.material.color.set(n?0xffc449:2677204),i.material.linewidth=n?5:1.5,F.get(t).visible=n}Y=e.selected}if(N.visible=!!e.tcp,G.visible=!1,e.tcp){N.position.set(...e.tcp.position);let[t,i,n]=e.tcp.wpr.map(a.rA.degToRad);N.rotation.set(t,i,n,"ZYX");let r=e.tcpPath??[];if(r.length>1&&e.tcp.distance>0){r.length>q&&(W.dispose(),(W=new L).setPositions(new Float32Array((r.length+1)*3)),G.geometry=W,q=r.length);let t=W.attributes.instanceStart,i=t.data.array,n=0;for(let t=0;t<=e.tcp.index&&t<r.length;t++){let a=r[t],o=t===e.tcp.index?e.tcp.position:r[t+1];!(!o||a.every((e,t)=>e===o[t]))&&(i.set(a,6*n),i.set(o,6*n+3),n++)}t.data.needsUpdate=!0,W.instanceCount=n,G.frustumCulled=!1,G.visible=n>0}}},fit:A};let es=0;!function t(){es=requestAnimationFrame(t),!document.hidden&&er&&(S.update(),e.render(v,x))}();let el=e=>{e.preventDefault(),d(!0)};return e.domElement.addEventListener("webglcontextlost",el),()=>{cancelAnimationFrame(es),i.current=null,eo.disconnect(),S.dispose(),e.domElement.removeEventListener("pointerdown",ee),e.domElement.removeEventListener("click",et),e.domElement.removeEventListener("webglcontextlost",el),Z(),v.traverse(e=>{(e instanceof a.kE||e instanceof a.sy||e instanceof a.DL||e instanceof T)&&(e.geometry.dispose(),(Array.isArray(e.material)?e.material:[e.material]).forEach(e=>e.dispose()))}),e.dispose(),e.domElement.remove()}},[c,f,u]),(0,r.useEffect)(()=>{i.current?.update(e)},[e]),(0,r.useEffect)(()=>{i.current?.fit()},[p]),(0,n.jsx)("div",{className:`cloud-canvas ${u?"":"static-cloud"}`,ref:t,"aria-label":u?"三维点云视图，拖动旋转，滚轮缩放":"焊缝三维点云展示",children:l&&(0,n.jsx)("div",{className:"cloud-loading",role:"alert",children:"WebGL 不可用或显卡上下文丢失，请启用硬件加速并刷新页面。"})})}],13988)},33419,e=>{"use strict";var t=e.i(43476),i=e.i(71645),n=e.i(13988),r=e.i(56662);let a=(0,i.forwardRef)(function(e,a){let{state:o}=(0,r.U)(),{onMeasure:s}=e,[l,d]=(0,i.useState)(0),[c,f]=(0,i.useState)(0),[u,p]=(0,i.useState)("perspective"),h=(0,i.useRef)(null),m=(0,i.useCallback)(()=>{h.current=null,s(null)},[s]);(0,i.useImperativeHandle)(a,()=>({reset:()=>{f(0),p("perspective"),d(e=>e+1)},zoomIn:()=>f(e=>e+1),toggleProjection:()=>p(e=>"perspective"===e?"orthographic":"perspective"),clearMeasurement:m}),[m]);let v=(0,i.useCallback)(e=>{h.current?(s({first:h.current,second:e,distance:Math.hypot(...e.map((e,t)=>e-h.current[t])),reference:!1}),h.current=null):(h.current=e,s({first:e,reference:!1}))},[s]);return(0,t.jsx)(n.default,{cloud:e.cloud,seams:o.seams,selected:o.selected,light:e.light,mode:"semantic"===e.mode?"语义":"实例",size:e.size,reset:l,grid:!0,interaction:"pan"===e.tool?"pan":"orbit",zoom:c,hidden:e.hidden,bounds:e.bounds,projection:u,measuring:"measure"===e.tool,onPointPick:v})});e.s(["default",0,a])},56123,function(e){e.n(e.i(33419))}]);