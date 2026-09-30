"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import CameraControls from "camera-controls";
import { computeLayout, nodeRadius } from "@/lib/graphLogic";
import {
  buildAdjacency,
  graph,
  LAW_COLORS,
  LAW_NAMES,
  searchTerms,
  type Law,
  type RelationType,
} from "@/lib/graphData";

CameraControls.install({ THREE });

// ── Static data derived once ─────────────────────────────────────────────────
const TERM_BY_ID = new Map(graph.terms.map((t) => [t.id, t]));
const TOPIC_NAME = new Map(graph.topics.map((t) => [t.id, t.name]));
const ADJ = buildAdjacency(graph);

// Selected at launch and by "Reset view"
const DEFAULT_TERM = "ai-act";

// Node and topic labels share one type style; size, weight and colour set the hierarchy.
const LABEL_TYPE = "font-mono uppercase tracking-[0.14em]";

// ── Palette ──────────────────────────────────────────────────────────────────
const INK = "#121A2E";
const CONTRAST = LAW_COLORS.both;
const BG = "#eaeaec";
const FADE_TOWARD_BG = 0.72;

// ── Node scale multipliers (on top of the degree-based radius) ───────────────
const S_SELECTED = 1.7;
const S_NEIGHBOR = 1.2;
const S_FADED = 0.85;

// ── Edges ────────────────────────────────────────────────────────────────────
const TUBE_RADIUS = 0.15;
const TUBE_SEGMENTS_LEN = 24;
const TUBE_SEGMENTS_RAD = 4;
const TUBE_OPACITY: Record<RelationType, number> = {
  related: 0.5,
  contrasts: 0.85,
};
const TUBE_LERP = 0.1;
const CTRL_BULGE = 1.15; // how far outward the tube's control point bows
const DASH_LEN = 4; // world units per dash + gap on contrasts tubes
// Faint always-on lines so the structure reads before anything is selected
const LINE_OPACITY = { related: [0.14, 0.04], contrasts: [0.45, 0.1] } as const; // [idle, selected]

// ── Camera ───────────────────────────────────────────────────────────────────
const FOV = 50;
const SELECT_ZOOM = 0.6; // selecting flies in to this fraction of the vertical fit distance
const PANEL_WIDTH_PX = 416; // sm:w-104 — the side panel on wide screens
const PANEL_HEIGHT = 0.58; // max-sm:h-[58%] — the bottom sheet on phones
// Fog as a depth cue: clusters at the back fade toward the background
const FOG_NEAR = -0.3; // × graph radius, relative to the camera's distance
const FOG_FAR = 1.4;
const ANIM_DURATION = 0.8; // seconds

/** A slice [t0, t1] of another curve, used to cut a tube into dashes. */
class SubCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    readonly base: THREE.Curve<THREE.Vector3>,
    readonly t0: number,
    readonly t1: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    return this.base.getPoint(this.t0 + (this.t1 - this.t0) * t, target);
  }
}

interface GraphApi {
  select: (id: string) => void;
  deselect: () => void;
  reset: () => void;
}

export default function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GraphApi | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const mount = mountRef.current;
    const labelsMount = labelsRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animDuration = reduceMotion ? 0.001 : ANIM_DURATION;

    let hoveredId: string | null = null;
    let selectedId: string | null = null;
    let pointerDownPos = { x: 0, y: 0 };

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(BG));
    mount.appendChild(renderer.domElement);

    // ── Layout (seeded, so identical on every load) ───────────────────────
    const layout = computeLayout(graph);
    const nodes = layout.nodes;
    const indexOf = new Map(nodes.map((n, i) => [n.id, i]));

    // ── Camera — orbits the origin; the graph moves, never the target ─────
    const camera = new THREE.PerspectiveCamera(
      FOV,
      mount.clientWidth / mount.clientHeight,
      1,
      8000,
    );
    const halfV = THREE.MathUtils.degToRad(FOV / 2);
    const fitDistance = () => {
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      return (layout.radius * 0.95) / Math.sin(Math.min(halfV, halfH));
    };
    // Based on the vertical fit only, so portrait phones don't select from miles away.
    const selectDistance = () =>
      ((layout.radius * 0.95) / Math.sin(halfV)) * SELECT_ZOOM;
    camera.position.set(0, 0, fitDistance());

    const timer = new THREE.Timer();
    const cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.smoothTime = 0.25;
    cameraControls.draggingSmoothTime = 0.1;
    cameraControls.dollyToCursor = false;
    cameraControls.minDistance = 40;
    cameraControls.maxDistance = fitDistance() * 2;
    cameraControls.saveState();

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    const fog = new THREE.Fog(BG, 1, 2);
    scene.fog = fog;

    // Shift the view so the selected node sits in the part of the screen the panel leaves free.
    const panelOffset = (distance: number) => {
      const worldPerPx =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) /
        mount.clientHeight;
      return window.innerWidth >= 640
        ? { x: (PANEL_WIDTH_PX / 2) * worldPerPx, y: 0 }
        : // camera-controls' focal offset y is screen-space (down is positive)
          { x: 0, y: ((PANEL_HEIGHT * mount.clientHeight) / 2) * worldPerPx };
    };
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // ── Nodes ─────────────────────────────────────────────────────────────
    const lawColor = nodes.map(
      (n) => new THREE.Color(LAW_COLORS[TERM_BY_ID.get(n.id)!.law]),
    );
    const fadedColor = lawColor.map((c) =>
      c.clone().lerp(new THREE.Color(BG), FADE_TOWARD_BG),
    );
    const baseRadius = nodes.map((n) => nodeRadius(n.degree));

    const sphere = new THREE.SphereGeometry(1, 24, 24);
    const nodeMats: THREE.MeshBasicMaterial[] = [];
    const nodeMeshes: THREE.Mesh[] = nodes.map((n, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: lawColor[i].clone() });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.position.set(n.x, n.y, n.z);
      mesh.scale.setScalar(baseRadius[i]);
      mesh.userData.nodeId = n.id;
      graphGroup.add(mesh);
      nodeMats.push(mat);
      return mesh;
    });

    // ── Node labels (DOM, shown only for selected / neighbours / hovered) ─
    const labelDivs = nodes.map((n) => {
      const div = document.createElement("div");
      div.className = `absolute top-0 left-0 whitespace-nowrap select-none cursor-pointer pointer-events-auto px-1.5 py-0.5 rounded ${LABEL_TYPE}`;
      div.style.display = "none";
      div.style.color = INK;
      div.style.textShadow = `0 0 3px ${BG}, 0 0 6px ${BG}`;
      div.textContent = TERM_BY_ID.get(n.id)!.name;
      div.onpointerenter = () => {
        hoveredId = n.id;
      };
      div.onpointerleave = () => {
        if (hoveredId === n.id) hoveredId = null;
      };
      div.onpointerdown = (e) => {
        e.stopPropagation();
        pointerDownPos = { x: e.clientX, y: e.clientY };
      };
      div.onpointerup = (e) => {
        e.stopPropagation();
        if (
          Math.abs(e.clientX - pointerDownPos.x) > 5 ||
          Math.abs(e.clientY - pointerDownPos.y) > 5
        )
          return;
        toggle(n.id);
      };
      labelsMount.appendChild(div);
      return div;
    });

    // ── Topic labels at each cluster's centre, pushed slightly outward ────
    const topicLabels = graph.topics.map((t) => {
      const c = layout.topicCenters.get(t.id)!;
      const div = document.createElement("div");
      div.className = `absolute top-0 left-0 whitespace-nowrap select-none pointer-events-none text-[10px] ${LABEL_TYPE}`;
      div.style.color = "rgba(18,26,46,0.5)";
      div.style.transition = "opacity 0.3s ease";
      div.style.textShadow = `0 0 4px ${BG}, 0 0 8px ${BG}`;
      div.textContent = t.name;
      labelsMount.appendChild(div);
      return {
        div,
        pos: new THREE.Vector3(c.x, c.y, c.z).multiplyScalar(1.12),
      };
    });

    // ── Edges: faint straight lines, always on ────────────────────────────
    const linePositions: Record<RelationType, number[]> = {
      related: [],
      contrasts: [],
    };
    for (const r of graph.relations) {
      const a = nodes[indexOf.get(r.from)!],
        b = nodes[indexOf.get(r.to)!];
      linePositions[r.type].push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const makeLines = (
      type: RelationType,
      mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
    ) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions[type], 3),
      );
      const lines = new THREE.LineSegments(geo, mat);
      lines.computeLineDistances();
      lines.renderOrder = -2;
      graphGroup.add(lines);
      return lines;
    };
    const relatedLines = makeLines(
      "related",
      new THREE.LineBasicMaterial({
        color: INK,
        transparent: true,
        opacity: LINE_OPACITY.related[0],
        depthWrite: false,
      }),
    );
    const contrastLines = makeLines(
      "contrasts",
      new THREE.LineDashedMaterial({
        color: CONTRAST,
        transparent: true,
        opacity: LINE_OPACITY.contrasts[0],
        depthWrite: false,
        dashSize: 3,
        gapSize: 2.5,
      }),
    );

    // ── Edges: curved tubes for the active node's relations ───────────────
    interface EdgeEntry {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      srcId: string;
      tgtId: string;
      type: RelationType;
      opacity: number;
    }
    const edgeEntries: EdgeEntry[] = graph.relations.map((r) => {
      const a = nodes[indexOf.get(r.from)!],
        b = nodes[indexOf.get(r.to)!];
      const A = new THREE.Vector3(a.x, a.y, a.z);
      const B = new THREE.Vector3(b.x, b.y, b.z);
      const ctrl = new THREE.Vector3()
        .lerpVectors(A, B, 0.5)
        .multiplyScalar(CTRL_BULGE);
      const curve = new THREE.QuadraticBezierCurve3(A, ctrl, B);

      let geo: THREE.BufferGeometry;
      if (r.type === "contrasts") {
        const dashes = Math.max(3, Math.round(curve.getLength() / DASH_LEN));
        const parts = Array.from(
          { length: dashes },
          (_, i) =>
            new THREE.TubeGeometry(
              new SubCurve(curve, i / dashes, (i + 0.55) / dashes),
              4,
              TUBE_RADIUS,
              TUBE_SEGMENTS_RAD,
              false,
            ),
        );
        geo = mergeGeometries(parts)!;
        parts.forEach((p) => p.dispose());
      } else {
        geo = new THREE.TubeGeometry(
          curve,
          TUBE_SEGMENTS_LEN,
          TUBE_RADIUS,
          TUBE_SEGMENTS_RAD,
          false,
        );
      }
      const mat = new THREE.MeshBasicMaterial({
        color: r.type === "contrasts" ? CONTRAST : INK,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = -1;
      graphGroup.add(mesh);
      return {
        mesh,
        mat,
        srcId: r.from,
        tgtId: r.to,
        type: r.type,
        opacity: 0,
      };
    });

    // ── Selection animation state ("spinning globe") ──────────────────────
    const targetPosition = new THREE.Vector3();
    const targetQuaternion = new THREE.Quaternion();
    const startPosition = new THREE.Vector3();
    const startQuaternion = new THREE.Quaternion();
    const startColors = lawColor.map((c) => c.clone());
    const targetColors = lawColor.map((c) => c.clone());
    const startScales = [...baseRadius];
    const targetScales = [...baseRadius];
    let isAnimating = false;
    let animStartTime = 0;
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const beginTransition = () => {
      nodes.forEach((_, i) => {
        startColors[i].copy(nodeMats[i].color);
        startScales[i] = nodeMeshes[i].scale.x;
      });
      startPosition.copy(graphGroup.position);
      startQuaternion.copy(graphGroup.quaternion);
      animStartTime = timer.getElapsed();
      isAnimating = true;
    };

    /** `fresh`: starting over (launch or reset), so always fly to the standard distance. */
    const select = (id: string, fresh = false) => {
      const index = indexOf.get(id);
      if (index === undefined || id === selectedId) return;
      selectedId = id;
      const neighbors = new Set(ADJ.get(id)!.map((n) => n.id));

      beginTransition();
      nodes.forEach((n, i) => {
        if (n.id === id) {
          targetColors[i].copy(lawColor[i]);
          targetScales[i] = baseRadius[i] * S_SELECTED;
        } else if (neighbors.has(n.id)) {
          targetColors[i].copy(lawColor[i]);
          targetScales[i] = baseRadius[i] * S_NEIGHBOR;
        } else {
          targetColors[i].copy(fadedColor[i]);
          targetScales[i] = baseRadius[i] * S_FADED;
        }
      });

      // Rotate the whole graph so the node faces the camera, then slide it to the origin.
      const local = nodeMeshes[index].position.clone();
      const dist = local.length();
      if (dist > 0.001) {
        const current = local
          .clone()
          .applyQuaternion(graphGroup.quaternion)
          .normalize();
        // Where the camera is heading, not where it is: a reset may still be animating it.
        const camDir = cameraControls
          .getPosition(new THREE.Vector3(), true)
          .normalize();
        targetQuaternion
          .copy(new THREE.Quaternion().setFromUnitVectors(current, camDir))
          .multiply(graphGroup.quaternion)
          .normalize();
        targetPosition.copy(camDir).multiplyScalar(-dist);
      } else {
        targetQuaternion.copy(graphGroup.quaternion);
        targetPosition.set(0, 0, 0);
      }

      // Fly in, but never zoom out if the viewer is already closer (unless starting over).
      const distance = fresh
        ? selectDistance()
        : Math.min(cameraControls.distance, selectDistance());
      const offset = panelOffset(distance);
      cameraControls.dollyTo(distance, !reduceMotion);
      cameraControls.setFocalOffset(offset.x, offset.y, 0, !reduceMotion);
      setSelectedId(id);
    };

    const deselect = () => {
      if (selectedId === null) return;
      selectedId = null;
      beginTransition();
      nodes.forEach((_, i) => {
        targetColors[i].copy(lawColor[i]);
        targetScales[i] = baseRadius[i];
      });
      targetPosition.set(0, 0, 0);
      targetQuaternion.identity();
      cameraControls.dollyTo(fitDistance(), !reduceMotion);
      cameraControls.setFocalOffset(0, 0, 0, !reduceMotion);
      setSelectedId(null);
    };

    // Back to the launch state: original orbit, default term selected.
    const reset = () => {
      deselect();
      cameraControls.reset(!reduceMotion);
      select(DEFAULT_TERM, true);
    };

    const toggle = (id: string) =>
      id === selectedId ? deselect() : select(id);
    apiRef.current = { select, deselect, reset };
    select(DEFAULT_TERM, true);

    // ── Pointer: hover via raycast, click vs drag by distance ─────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-9, -9);
    const toNdc = (e: PointerEvent, out: THREE.Vector2) => {
      const r = renderer.domElement.getBoundingClientRect();
      return out.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };
    const onPointerMove = (e: PointerEvent) => {
      toNdc(e, pointer);
    };
    const onPointerLeave = () => {
      pointer.set(-9, -9);
    };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (
        Math.abs(e.clientX - pointerDownPos.x) > 5 ||
        Math.abs(e.clientY - pointerDownPos.y) > 5
      )
        return;
      raycaster.setFromCamera(toNdc(e, new THREE.Vector2()), camera);
      const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
      if (hit) toggle(hit.object.userData.nodeId as string);
      else deselect();
    };
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerleave", onPointerLeave);
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointerup", onPointerUp);

    // ── Animation loop ────────────────────────────────────────────────────
    const vTemp = new THREE.Vector3();
    const project = (world: THREE.Vector3) => {
      vTemp.copy(world).project(camera);
      const onScreen =
        vTemp.z < 1 && Math.abs(vTemp.x) < 1.1 && Math.abs(vTemp.y) < 1.1;
      return {
        onScreen,
        x: (vTemp.x * 0.5 + 0.5) * mount.clientWidth,
        y: (vTemp.y * -0.5 + 0.5) * mount.clientHeight,
      };
    };
    const lerpOpacity = (mat: THREE.Material, target: number, k: number) => {
      mat.opacity += (target - mat.opacity) * k;
    };

    let rafId = 0;
    const animate = (timestamp?: number) => {
      rafId = requestAnimationFrame(animate);
      timer.update(timestamp);
      const delta = timer.getDelta();
      cameraControls.update(delta);
      fog.near = cameraControls.distance + FOG_NEAR * layout.radius;
      fog.far = cameraControls.distance + FOG_FAR * layout.radius;
      const k = Math.min(1, TUBE_LERP * 60 * delta);

      // Slow drift; when a node is selected, spin about the view axis so it stays centred.
      if (!isAnimating && !reduceMotion) {
        if (selectedId) {
          const camDir = camera.position.clone().normalize();
          graphGroup.quaternion.premultiply(
            new THREE.Quaternion().setFromAxisAngle(camDir, 0.0006),
          );
        } else {
          graphGroup.rotateY(0.0006);
          graphGroup.rotateX(0.00015);
        }
      }

      if (isAnimating) {
        const elapsed = timer.getElapsed() - animStartTime;
        const t = easeInOutCubic(Math.min(elapsed / animDuration, 1));
        graphGroup.position.lerpVectors(startPosition, targetPosition, t);
        graphGroup.quaternion.slerpQuaternions(
          startQuaternion,
          targetQuaternion,
          t,
        );
        nodes.forEach((_, i) => {
          nodeMats[i].color.lerpColors(startColors[i], targetColors[i], t);
          nodeMeshes[i].scale.setScalar(
            THREE.MathUtils.lerp(startScales[i], targetScales[i], t),
          );
        });
        if (elapsed >= animDuration) isAnimating = false;
      }

      // Hover
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
      const overLabel =
        hoveredId !== null &&
        labelDivs[indexOf.get(hoveredId)!].matches(":hover");
      if (!overLabel)
        hoveredId = hit ? (hit.object.userData.nodeId as string) : null;
      renderer.domElement.style.cursor = hoveredId ? "pointer" : "default";

      // Background lines dim while a node is selected
      const sel = selectedId ? 1 : 0;
      lerpOpacity(relatedLines.material, LINE_OPACITY.related[sel], k);
      lerpOpacity(contrastLines.material, LINE_OPACITY.contrasts[sel], k);

      // Tubes for the selected and the hovered node's relations
      const touches = (e: EdgeEntry, id: string | null) =>
        id !== null && (e.srcId === id || e.tgtId === id);
      for (const e of edgeEntries) {
        const target =
          touches(e, selectedId) || touches(e, hoveredId)
            ? TUBE_OPACITY[e.type]
            : 0;
        if (target === 0 && !e.mesh.visible) continue;
        e.opacity =
          Math.abs(e.opacity - target) < 0.005
            ? target
            : e.opacity + (target - e.opacity) * k;
        e.mat.opacity = e.opacity;
        e.mesh.visible = e.opacity > 0.005;
      }

      // Node labels
      const neighbors = selectedId ? ADJ.get(selectedId)! : [];
      const show = new Map<string, "selected" | "hovered" | "neighbor">();
      neighbors.forEach((n) => show.set(n.id, "neighbor"));
      if (hoveredId) show.set(hoveredId, "hovered");
      if (selectedId) show.set(selectedId, "selected");

      nodes.forEach((n, i) => {
        const div = labelDivs[i];
        const state = show.get(n.id);
        const p = state ? project(nodeMeshes[i].getWorldPosition(vTemp)) : null;
        if (!state || !p?.onScreen) {
          if (div.style.display !== "none") div.style.display = "none";
          return;
        }
        div.style.display = "block";
        const offset = nodeMeshes[i].scale.x * 1.6 + 8;
        div.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y - offset}px)`;
        div.style.fontSize =
          state === "selected" ? "12px" : state === "hovered" ? "11px" : "10px";
        div.style.fontWeight = state === "selected" ? "600" : "400";
        div.style.opacity = state === "neighbor" ? "0.75" : "1";
        div.style.zIndex = state === "neighbor" ? "1" : "2";
      });

      // Topic labels: fade with depth like the fog, and recede while a node is selected
      for (const { div, pos } of topicLabels) {
        const world = graphGroup.localToWorld(vTemp.copy(pos));
        const depth =
          1 -
          THREE.MathUtils.smoothstep(
            world.distanceTo(camera.position),
            fog.near,
            fog.far,
          );
        const p = project(world);
        div.style.display = p.onScreen ? "block" : "none";
        div.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`;
        div.style.opacity = String(
          (selectedId ? 0.25 : 1) * (0.25 + 0.75 * depth),
        );
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement))
        deselect();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(rafId);
      apiRef.current = null;
      cameraControls.dispose();
      mount.removeChild(renderer.domElement);
      labelsMount.innerHTML = "";
      sphere.dispose();
      nodeMats.forEach((m) => m.dispose());
      edgeEntries.forEach((e) => {
        e.mesh.geometry.dispose();
        e.mat.dispose();
      });
      [relatedLines, contrastLines].forEach((l) => {
        l.geometry.dispose();
        l.material.dispose();
      });
      renderer.dispose();
    };
  }, []);

  const select = (id: string) => apiRef.current?.select(id);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <div
        ref={labelsRef}
        className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      />

      <div className="absolute top-14 left-4 sm:left-8 z-30 flex items-start gap-2 max-sm:right-4">
        <Search onPick={select} />
        <button
          type="button"
          onClick={() => apiRef.current?.reset()}
          className="h-9 shrink-0 rounded-lg border border-black/10 bg-white/70 backdrop-blur px-3 text-xs font-medium text-black/70 hover:bg-white hover:text-black"
        >
          Reset view
        </button>
      </div>

      {selectedId && (
        <TermPanel
          key={selectedId}
          id={selectedId}
          onPick={select}
          onClose={() => apiRef.current?.deselect()}
        />
      )}

      <Legend />

      {!selectedId && (
        <p className="max-sm:hidden absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] uppercase text-black/30 pointer-events-none select-none">
          Click a node to explore · Drag to rotate · Scroll to zoom
        </p>
      )}
    </div>
  );
}

// ── Search ───────────────────────────────────────────────────────────────────
function Search({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchTerms(graph.terms, query), [query]);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-72 max-sm:flex-1">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active])
            pick(results[active].id);
          else if (e.key === "Escape") setQuery("");
        }}
        placeholder="Search a term or abbreviation, e.g. DPIA"
        aria-label="Search terms and abbreviations"
        aria-controls="search-results"
        aria-activedescendant={
          results[active] ? `search-${results[active].id}` : undefined
        }
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-black/10 bg-white/70 backdrop-blur px-3 text-sm text-black placeholder:text-black/40 outline-none focus:border-black/30 focus:bg-white"
      />
      {query.trim() && (
        <ul
          id="search-results"
          role="listbox"
          className="absolute top-11 left-0 right-0 rounded-lg border border-black/10 bg-white shadow-lg p-1 text-sm"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-black/50">No matching term</li>
          )}
          {results.map((t, i) => (
            <li
              key={t.id}
              id={`search-${t.id}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(t.id);
              }}
              onPointerEnter={() => setActive(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer ${i === active ? "bg-black/5" : ""}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: LAW_COLORS[t.law] }}
              />
              <span className="flex-1 truncate text-black">{t.name}</span>
              {t.abbreviations.length > 0 && (
                <span className="font-mono text-xs text-black/45">
                  {t.abbreviations.join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Side panel ───────────────────────────────────────────────────────────────
function TermPanel({
  id,
  onPick,
  onClose,
}: {
  id: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const term = TERM_BY_ID.get(id)!;
  const neighbors = ADJ.get(id)!;
  const contrasts = neighbors.filter((n) => n.type === "contrasts");
  const related = neighbors
    .filter((n) => n.type === "related")
    .map((n) => TERM_BY_ID.get(n.id)!)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <aside
      aria-label={term.name}
      className="absolute z-20 bg-white/75 backdrop-blur-2xl border-black/10 overflow-y-auto flex flex-col gap-6
        sm:top-0 sm:right-0 sm:h-full sm:w-104 sm:border-l sm:p-10
        max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[58%] max-sm:border-t max-sm:p-6"
      style={{ animation: "slideIn 0.4s cubic-bezier(.4,0,.2,1)" }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-8 h-8 rounded-full text-black/40 hover:bg-black/5 hover:text-black text-lg leading-none"
      >
        ×
      </button>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
          {TOPIC_NAME.get(term.topic)}
        </p>
        <h2 className="text-3xl font-bold text-black leading-tight tracking-tight pr-6">
          {term.name}
        </h2>
        {term.abbreviations.length > 0 && (
          <p className="mt-2 font-mono text-sm text-black/50">
            {term.abbreviations.join(" · ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px]"
            style={{
              color: LAW_COLORS[term.law],
              background: `${LAW_COLORS[term.law]}14`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: LAW_COLORS[term.law] }}
            />
            {LAW_NAMES[term.law]}
          </span>
          {term.source && (
            <span className="font-mono text-[11px] text-black/60 border-l-2 border-black/20 pl-2">
              {term.source}
            </span>
          )}
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-black/80">
        {term.definition}
      </p>

      {contrasts.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
            Often confused with
          </h3>
          <div className="flex flex-col gap-3">
            {contrasts.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-dashed p-3"
                style={{ borderColor: CONTRAST }}
              >
                <TermChip id={c.id} onPick={onPick} />
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {c.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
            Connected terms · {related.length}
          </h3>
          <div className="flex flex-wrap gap-2">
            {related.map((t) => (
              <TermChip key={t.id} id={t.id} onPick={onPick} />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function TermChip({
  id,
  onPick,
}: {
  id: string;
  onPick: (id: string) => void;
}) {
  const t = TERM_BY_ID.get(id)!;
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/15 text-xs text-black/70 bg-white/60 hover:border-black/40 hover:text-black"
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: LAW_COLORS[t.law] }}
      />
      {t.name}
    </button>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="max-sm:hidden absolute bottom-6 left-8 z-10 flex flex-col gap-1.5 text-[11px] text-black/55 pointer-events-none select-none">
      {(Object.keys(LAW_COLORS) as Law[]).map((law) => (
        <span key={law} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: LAW_COLORS[law] }}
          />
          {LAW_NAMES[law]}
        </span>
      ))}
      <span className="flex items-center gap-2 mt-1">
        <svg width="18" height="4" aria-hidden="true">
          <line
            x1="0"
            y1="2"
            x2="18"
            y2="2"
            stroke={INK}
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        </svg>
        Connected
      </span>
      <span className="flex items-center gap-2">
        <svg width="18" height="4" aria-hidden="true">
          <line
            x1="0"
            y1="2"
            x2="18"
            y2="2"
            stroke={CONTRAST}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </svg>
        Often confused
      </span>
    </div>
  );
}
