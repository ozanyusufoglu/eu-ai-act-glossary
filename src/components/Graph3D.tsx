'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { generateGraphData, createSimulation, Node } from '@/lib/graphLogic';

// ── Edge tube constants ────────────────────────────────────────────────────
const TUBE_RADIUS = 0.1;  // world units
const TUBE_SEGMENTS_LEN = 24;    // curve subdivisions
const TUBE_SEGMENTS_RAD = 4;     // radial subdivisions
const TUBE_OPACITY_ON = 0.55;
const TUBE_OPACITY_OFF = 0;
const TUBE_LERP = 0.08;  // per-frame opacity lerp speed
const CTRL_BULGE = 1.15;  // how far outward the control point bows

CameraControls.install({ THREE });

// ── Palette ────────────────────────────────────────────────────────────────
const COL_DEFAULT = new THREE.Color('#666666');
const COL_SELECTED = new THREE.Color('#0d0d0d');
const COL_NEIGHBOR = new THREE.Color('#555555');
const COL_FADED = new THREE.Color('#d4d4d4');
const BG = '#eaeaec';

// Node radii
const R_DEFAULT = 6;
const R_SELECTED = 12;
const R_NEIGHBOR = 8;
const R_FADED = 4;

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
    let handleNodeClick: (id: string) => void = () => { };

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
      const mat = new THREE.MeshBasicMaterial({
        color: COL_FADED.clone(),
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

    // ── Edges — curved tubes, one per link ───────────────────────────────
    // Each tube follows a QuadraticBezierCurve3 whose control point is pushed
    // outward from the graph centre, giving a gentle arc on the sphere surface.
    interface EdgeEntry {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      srcId: string;
      tgtId: string;
      opacity: number; // current lerped opacity
    }
    const edgeEntries: EdgeEntry[] = [];

    // Shared material template — cloned per edge so opacity is independent
    data.links.forEach((link) => {
      const src = link.source as Node;
      const tgt = link.target as Node;
      const srcId = src.id;
      const tgtId = tgt.id;

      const A = new THREE.Vector3(src.x ?? 0, src.y ?? 0, src.z ?? 0);
      const B = new THREE.Vector3(tgt.x ?? 0, tgt.y ?? 0, tgt.z ?? 0);

      // Control point: midpoint pushed outward from the origin
      const ctrl = new THREE.Vector3().lerpVectors(A, B, 0.5).multiplyScalar(CTRL_BULGE);

      const curve = new THREE.QuadraticBezierCurve3(A, ctrl, B);
      const tubeGeo = new THREE.TubeGeometry(curve, TUBE_SEGMENTS_LEN, TUBE_RADIUS, TUBE_SEGMENTS_RAD, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x222222),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tubeGeo, tubeMat);
      mesh.renderOrder = -1; // draw behind nodes
      graphGroup.add(mesh);
      edgeEntries.push({ mesh, mat: tubeMat, srcId, tgtId, opacity: 0 });
    });

    // Dummy vars kept so old selectNode/deselect references compile cleanly
    const edgeMat = new THREE.LineBasicMaterial(); // unused, just satisfies TS refs below
    const edgeGeo = new THREE.BufferGeometry();    // same

    // ── Graph animation state (Spinning Globe) ───────────────────────────
    const targetPosition = new THREE.Vector3(0, 0, 0);
    const targetQuaternion = new THREE.Quaternion();
    const startPosition = new THREE.Vector3(0, 0, 0);
    const startQuaternion = new THREE.Quaternion();

    const targetColors = data.nodes.map(() => COL_FADED.clone());
    const startColors = data.nodes.map(() => COL_FADED.clone());
    const targetScales = data.nodes.map(() => R_DEFAULT);
    const startScales = data.nodes.map(() => R_DEFAULT);

    // (Legacy edge animation vars removed — tubes handle their own opacity)

    let isAnimating = false;
    let animStartTime = 0;
    const ANIM_DURATION = 0.8; // seconds

    // Easing function (cubic in-out)
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let selectedId: string | null = null;

    const selectNode = (id: string) => {
      if (id === selectedId) return;
      selectedId = id;

      const node = data.nodes.find(n => n.id === id)!;
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

      // Tube edges will respond to selectedId in the animate loop

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
        targetColors[i].copy(COL_FADED);
        targetScales[i] = R_DEFAULT;
      });

      // Tube edges fade out automatically in the animate loop
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
    const pointer = new THREE.Vector2(-9, -9);

    const onPointerMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
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
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
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

      // Subtle idle rotation — "floating in space" effect
      if (!isAnimating && !cameraControls.active) {
        graphGroup.rotateY(0.0006);
        graphGroup.rotateX(0.00015);
      }

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

        if (elapsed >= ANIM_DURATION) {
          graphGroup.position.copy(targetPosition);
          graphGroup.quaternion.copy(targetQuaternion);
          data.nodes.forEach((_, i) => {
            nodeMats[i].color.copy(targetColors[i]);
            nodeMeshes[i].scale.setScalar(targetScales[i]);
          });
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

      // ── Tube edge opacity ───────────────────────────────────────────────
      // Determine which node (if any) is "active" for edge display:
      //   priority: hovered > selected
      const activeId = hoveredId ?? selectedId;
      edgeEntries.forEach((e) => {
        const isConnected = activeId !== null &&
          (e.srcId === activeId || e.tgtId === activeId);
        const target = isConnected ? TUBE_OPACITY_ON : TUBE_OPACITY_OFF;

        // Nudge colour: highlight selected-node edges slightly warmer
        if (isConnected && selectedId && (e.srcId === selectedId || e.tgtId === selectedId)) {
          e.mat.color.set(0x111111);
        } else {
          e.mat.color.set(0x444444);
        }

        if (Math.abs(e.opacity - target) > 0.001) {
          e.opacity += (target - e.opacity) * TUBE_LERP * (60 * delta);
          e.mat.opacity = e.opacity;
          // Toggle visibility for GPU performance
          e.mesh.visible = e.opacity > 0.005;
        } else {
          e.opacity = target;
          e.mat.opacity = target;
          e.mesh.visible = target > 0.005;
        }
      });

      // Sync DOM labels
      const vTemp = new THREE.Vector3();
      data.nodes.forEach((_, i) => {
        nodeMeshes[i].getWorldPosition(vTemp);

        // Check if node is behind the camera (z > 1 after projection = behind near plane)
        const nodeCopy = vTemp.clone();
        nodeCopy.project(camera);

        const isBehind = nodeCopy.z > 1;
        // Also hide if projected outside NDC bounds (node is off-screen)
        const isOffScreen = Math.abs(nodeCopy.x) > 1.1 || Math.abs(nodeCopy.y) > 1.1;

        if (isBehind || isOffScreen) {
          labelDivs[i].style.opacity = '0';
          labelDivs[i].style.pointerEvents = 'none';
          return;
        }

        // Map to CSS coordinates
        const x = (nodeCopy.x * .5 + .5) * mount.clientWidth;
        const y = (nodeCopy.y * -.5 + .5) * mount.clientHeight;

        // Offset label below the node by the current visual scale (radius in px)
        const currentScale = nodeMeshes[i].scale.x;
        const yOffset = currentScale * 2.2 + 10;

        labelDivs[i].style.transform = `translate(-50%, 0) translate(${x}px, ${y + yOffset}px)`;
        labelDivs[i].style.opacity = '1';
        labelDivs[i].style.pointerEvents = 'auto';
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
      labelsMount.innerHTML = '';
      nodeMeshes.forEach(m => m.geometry.dispose());
      nodeMats.forEach(m => m.dispose());
      edgeEntries.forEach(e => { e.mesh.geometry.dispose(); e.mat.dispose(); });
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
