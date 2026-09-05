'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { generateGraphData, createSimulation, Node } from '@/lib/graphLogic';

CameraControls.install({ THREE });

// ── Palette ────────────────────────────────────────────────────────────────
const COL_DEFAULT  = new THREE.Color('#666666');
const COL_SELECTED = new THREE.Color('#0d0d0d');
const COL_NEIGHBOR = new THREE.Color('#555555');
const COL_FADED    = new THREE.Color('#d4d4d4');
const BG           = '#eaeaec';

// Node radii
const R_DEFAULT  = 6;
const R_SELECTED = 12;
const R_NEIGHBOR = 8;
const R_FADED    = 4;

// Lerp speed for graph group translation (per frame, exponential ease-out)
const GROUP_LERP = 0.04;

export default function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ label: string; connectedLabels: string[] } | null>(null);

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const mount = mountRef.current;
    const labelsMount = labelsRef.current;
    
    let hoveredId: string | null = null;
    let pointerDownPos = { x: 0, y: 0 };
    let handleNodeClick: (id: string) => void = () => {};

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(BG));
    mount.appendChild(renderer.domElement);

    // ── Camera — fixed orbit, always looks at origin ─────────────────────
    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      1,
      5000
    );
    camera.position.set(0, 0, 350);

    // ── Camera Controls — for user drag/rotate/zoom only ────────────────
    // The camera orbits around (0,0,0). We NEVER move the target.
    // The graph group moves instead.
    const clock = new THREE.Clock();
    const cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dampingFactor = 0.12;
    cameraControls.draggingDampingFactor = 0.2;
    cameraControls.dollyToCursor = false;
    cameraControls.minDistance = 80;
    cameraControls.maxDistance = 800;

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(200, 300, 400);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-150, -100, -200);
    scene.add(fill);

    // ── Graph Group — all nodes & edges live here ────────────────────────
    // When we want to "center" a node, we translate this group
    // so the node's local position maps to world origin (0,0,0).
    // The camera stays put; the graph slides under it.
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // ── Graph data — full 3D force simulation ────────────────────────────
    const data = generateGraphData();
    const simulation = createSimulation(data);
    for (let i = 0; i < 300; ++i) simulation.tick();

    // Adjacency map
    const adj = new Map<string, Set<string>>();
    data.nodes.forEach(n => adj.set(n.id, new Set()));
    data.links.forEach(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as Node).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as Node).id;
      adj.get(sId)?.add(tId);
      adj.get(tId)?.add(sId);
    });

    // ── Node meshes — added to graphGroup ────────────────────────────────
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeMats: THREE.MeshBasicMaterial[] = [];
    const labelDivs: HTMLDivElement[] = [];
    const baseSphere = new THREE.SphereGeometry(1, 32, 32);

    data.nodes.forEach(node => {
      const mat  = new THREE.MeshBasicMaterial({
        color: COL_DEFAULT.clone(),
      });
      const mesh = new THREE.Mesh(baseSphere, mat);
      mesh.scale.setScalar(R_DEFAULT);
      // Position is LOCAL to graphGroup
      mesh.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      mesh.userData.nodeId = node.id;
      graphGroup.add(mesh);
      nodeMeshes.push(mesh);
      nodeMats.push(mat);

      // DOM Label
      const div = document.createElement('div');
      div.className = 'absolute top-0 left-0 text-[11px] text-black/40 font-medium tracking-wide cursor-pointer transition-colors duration-200 pointer-events-auto whitespace-nowrap select-none px-2 py-1 -mt-4';
      div.textContent = node.label;
      div.onpointerenter = () => {
        hoveredId = node.id;
        renderer.domElement.style.cursor = 'pointer';
        div.classList.replace('text-black/40', 'text-black');
      };
      div.onpointerleave = () => {
        if (hoveredId === node.id) hoveredId = null;
        renderer.domElement.style.cursor = 'default';
        div.classList.replace('text-black', 'text-black/40');
      };
      div.onpointerdown = (e) => {
        e.stopPropagation();
        pointerDownPos = { x: e.clientX, y: e.clientY };
      };
      div.onpointerup = (e) => {
        e.stopPropagation();
        const dx = Math.abs(e.clientX - pointerDownPos.x);
        const dy = Math.abs(e.clientY - pointerDownPos.y);
        if (dx > 5 || dy > 5) return;
        handleNodeClick(node.id);
      };
      labelsMount.appendChild(div);
      labelDivs.push(div);
    });

    // ── Edges — also in graphGroup ───────────────────────────────────────
    const edgePosArr = new Float32Array(data.links.length * 6);
    const edgeGeo    = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePosArr, 3));
    const edgeMat    = new THREE.LineBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.5,
    });
    data.links.forEach((link, i) => {
      const src = link.source as Node;
      const tgt = link.target as Node;
      edgePosArr[i * 6 + 0] = src.x ?? 0;
      edgePosArr[i * 6 + 1] = src.y ?? 0;
      edgePosArr[i * 6 + 2] = src.z ?? 0;
      edgePosArr[i * 6 + 3] = tgt.x ?? 0;
      edgePosArr[i * 6 + 4] = tgt.y ?? 0;
      edgePosArr[i * 6 + 5] = tgt.z ?? 0;
    });
    graphGroup.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // ── Graph animation state (Spinning Globe) ───────────────────────────
    const targetPosition = new THREE.Vector3(0, 0, 0);
    const targetQuaternion = new THREE.Quaternion();
    const startPosition = new THREE.Vector3(0, 0, 0);
    const startQuaternion = new THREE.Quaternion();
    
    const targetColors = data.nodes.map(() => COL_DEFAULT.clone());
    const startColors = data.nodes.map(() => COL_DEFAULT.clone());
    const targetScales = data.nodes.map(() => R_DEFAULT);
    const startScales = data.nodes.map(() => R_DEFAULT);
    
    const targetEdgeColor = new THREE.Color(0xaaaaaa);
    const startEdgeColor = new THREE.Color(0xaaaaaa);
    let targetEdgeOpacity = 0.5;
    let startEdgeOpacity = 0.5;

    let isAnimating = false;
    let animStartTime = 0;
    const ANIM_DURATION = 0.8; // seconds

    // Easing function (cubic in-out)
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let selectedId: string | null = null;

    const selectNode = (id: string) => {
      if (id === selectedId) return;
      selectedId = id;

      const node      = data.nodes.find(n => n.id === id)!;
      const neighbors = adj.get(id) ?? new Set<string>();

      // Set targets for visual state
      data.nodes.forEach((n, i) => {
        startColors[i].copy(nodeMats[i].color);
        startScales[i] = nodeMeshes[i].scale.x;

        if (n.id === id) {
          targetColors[i].copy(COL_SELECTED);
          targetScales[i] = R_SELECTED;
        } else if (neighbors.has(n.id)) {
          targetColors[i].copy(COL_NEIGHBOR);
          targetScales[i] = R_NEIGHBOR;
        } else {
          targetColors[i].copy(COL_FADED);
          targetScales[i] = R_FADED;
        }
      });
      
      startEdgeColor.copy(edgeMat.color);
      startEdgeOpacity = edgeMat.opacity;
      targetEdgeColor.set(0x999999);
      targetEdgeOpacity = 0.35;

      // ── THE KEY: Spin and translate the graph group ─────────────────────
      const nodeLocalPos = nodeMeshes[data.nodes.indexOf(node)].position.clone();
      const pLen = nodeLocalPos.length();
      
      if (pLen > 0.001) {
        // Current world direction of the node relative to the group's center
        const vCurr = nodeLocalPos.clone().applyQuaternion(graphGroup.quaternion).normalize();
        // The direction to the camera from the origin
        const camDir = camera.position.clone().normalize();
        
        // Shortest rotation to bring the node to face the camera
        const qDiff = new THREE.Quaternion().setFromUnitVectors(vCurr, camDir);
        
        // Target rotation: apply the difference to the current rotation
        targetQuaternion.copy(qDiff).multiply(graphGroup.quaternion).normalize();
        
        // Target position: push the group away from the camera by the node's distance
        targetPosition.copy(camDir).multiplyScalar(-pLen);
      } else {
        targetQuaternion.copy(graphGroup.quaternion);
        targetPosition.set(0, 0, 0);
      }
      startPosition.copy(graphGroup.position);
      startQuaternion.copy(graphGroup.quaternion);
      animStartTime = clock.getElapsedTime();
      isAnimating = true;

      const connectedLabels = data.nodes
        .filter(n => neighbors.has(n.id))
        .map(n => n.label);
      setSelected({ label: node.label, connectedLabels });
    };

    const deselect = () => {
      selectedId = null;
      setSelected(null);
      
      // Set targets to default
      data.nodes.forEach((_, i) => {
        startColors[i].copy(nodeMats[i].color);
        startScales[i] = nodeMeshes[i].scale.x;
        targetColors[i].copy(COL_DEFAULT);
        targetScales[i] = R_DEFAULT;
      });
      
      startEdgeColor.copy(edgeMat.color);
      startEdgeOpacity = edgeMat.opacity;
      targetEdgeColor.set(0xaaaaaa);
      targetEdgeOpacity = 0.5;
      // Return graph to initial state
      targetPosition.set(0, 0, 0);
      targetQuaternion.identity();
      startPosition.copy(graphGroup.position);
      startQuaternion.copy(graphGroup.quaternion);
      animStartTime = clock.getElapsedTime();
      isAnimating = true;
    };

    handleNodeClick = (id: string) => {
      id === selectedId ? deselect() : selectNode(id);
    };

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2(-9, -9);

    const onPointerMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
      pointer.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    };

    // Distinguish click from drag
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      if (dx > 5 || dy > 5) return; // drag, not click

      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(
         ((e.clientX - r.left) / r.width)  * 2 - 1,
        -((e.clientY - r.top)  / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(p, camera);
      // Raycast against graphGroup children
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.nodeId as string;
        id === selectedId ? deselect() : selectNode(id);
      } else {
        if (selectedId) deselect();
      }
    };

    mount.addEventListener('pointermove', onPointerMove);
    mount.addEventListener('pointerdown', onPointerDown);
    mount.addEventListener('pointerup', onPointerUp);

    // ── Animation loop ─────────────────────────────────────────────────────
    let rafId: number;

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      // camera-controls handles user orbit/zoom (camera moves around origin)
      cameraControls.update(delta);

      // Smooth graph group rotation & translation — "Globe spin" effect
      if (isAnimating) {
        const elapsed = clock.getElapsedTime() - animStartTime;
        let t = Math.min(elapsed / ANIM_DURATION, 1.0);
        t = easeInOutCubic(t);
        
        graphGroup.position.lerpVectors(startPosition, targetPosition, t);
        graphGroup.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, t);
        
        // Sync visual transitions
        data.nodes.forEach((_, i) => {
          nodeMats[i].color.lerpColors(startColors[i], targetColors[i], t);
          nodeMeshes[i].scale.setScalar(THREE.MathUtils.lerp(startScales[i], targetScales[i], t));
        });
        edgeMat.color.lerpColors(startEdgeColor, targetEdgeColor, t);
        edgeMat.opacity = THREE.MathUtils.lerp(startEdgeOpacity, targetEdgeOpacity, t);
        
        if (elapsed >= ANIM_DURATION) {
          graphGroup.position.copy(targetPosition);
          graphGroup.quaternion.copy(targetQuaternion);
          data.nodes.forEach((_, i) => {
            nodeMats[i].color.copy(targetColors[i]);
            nodeMeshes[i].scale.setScalar(targetScales[i]);
          });
          edgeMat.color.copy(targetEdgeColor);
          edgeMat.opacity = targetEdgeOpacity;
          isAnimating = false;
        }
      }

      // Hover cursor
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      const newHover = hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
      if (newHover !== hoveredId) {
        hoveredId = newHover;
        renderer.domElement.style.cursor = hoveredId ? 'pointer' : 'default';
      }

      // Sync DOM labels
      const vTemp = new THREE.Vector3();
      data.nodes.forEach((_, i) => {
        nodeMeshes[i].getWorldPosition(vTemp);
        vTemp.project(camera);
        // Map to CSS coordinates
        const x = (vTemp.x *  .5 + .5) * mount.clientWidth;
        const y = (vTemp.y * -.5 + .5) * mount.clientHeight;
        
        labelDivs[i].style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        // Hide if behind camera or too far
        labelDivs[i].style.opacity = vTemp.z > 1 ? '0' : '1';
        labelDivs[i].style.pointerEvents = vTemp.z > 1 ? 'none' : 'auto';
      });

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerdown', onPointerDown);
      mount.removeEventListener('pointerup', onPointerUp);
      cancelAnimationFrame(rafId);
      simulation.stop();
      cameraControls.dispose();
      renderer.domElement.style.cursor = 'default';
      mount.removeChild(renderer.domElement);
      nodeMeshes.forEach(m => m.geometry.dispose());
      nodeMats.forEach(m => m.dispose());
      edgeGeo.dispose();
      edgeMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <div ref={labelsRef} className="absolute inset-0 z-10 pointer-events-none overflow-hidden" />

      {/* Side panel */}
      {selected && (
        <div
          key={selected.label}
          className="absolute top-0 right-0 h-full w-72 bg-white/55 backdrop-blur-2xl border-l border-black/10 z-20 p-10 flex flex-col gap-6"
          style={{ animation: 'slideIn 0.4s cubic-bezier(.4,0,.2,1)' }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">Selected</p>
            <h2 className="text-4xl font-bold text-black leading-none tracking-tight">{selected.label}</h2>
          </div>
          {selected.connectedLabels.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">Connects to</p>
              <div className="flex flex-wrap gap-2">
                {selected.connectedLabels.map(l => (
                  <span key={l} className="px-3 py-1 rounded-full border border-black/20 text-xs text-black/60 bg-white/50">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {!selected && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] uppercase text-black/30 pointer-events-none select-none">
          Click any node to explore · Drag to rotate · Scroll to zoom
        </p>
      )}
    </div>
  );
}
