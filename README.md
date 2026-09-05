# 3D Node Graph Visualization

This project is a 3D interactive graph visualization built with React, Next.js, and Three.js. It features a custom physics-based layout, interactive orbital camera controls, and a smooth "spinning globe" transition effect when navigating between nodes. 

## Glossary & Core Concepts

Before diving into the implementation, here are the key algorithms, terms, and libraries used to build this:

- **`Three.js`**: The foundational WebGL library used to render the 3D scene (spheres, lines, lights, cameras).
- **`d3-force-3d`**: A physics engine used to calculate the positions of nodes. It simulates forces (like gravity pulling everything to the center, or repulsion pushing nodes apart) to naturally organize the graph in 3D space.
- **`camera-controls`**: A library built on top of Three.js that provides smooth, damping-based user interactions (drag to rotate, scroll to zoom) around a fixed focal point.
- **`Quaternion`**: A mathematical construct used to represent 3D rotations without encountering "gimbal lock" (where axes align and lose a degree of freedom). We use quaternions to calculate the shortest rotational path between the camera and a clicked node.
- **`Slerp` (Spherical Linear Interpolation)**: An algorithm to smoothly transition between two quaternions. This is what creates the curved, natural "globe spinning" effect.
- **`Lerp` (Linear Interpolation)**: An algorithm to smoothly transition between two values (like distance, color, or scale).
- **`Easing (easeInOutCubic)`**: A mathematical function that modifies the speed of an animation. Instead of moving at a constant speed, the animation accelerates from a stop, moves quickly through the middle, and decelerates gently to a stop.
- **`Raycaster`**: A technique in 3D graphics that shoots an invisible line from the mouse pointer into the 3D scene to determine which objects it intersects (used for hover and click detection).
- **DOM Projection**: The technique of calculating the 2D screen coordinates of a 3D object and placing standard HTML elements (like `<div>` text labels) at those coordinates, allowing crisp text rendering and standard CSS styling.

## The Data Model (Static Structure)

The graph currently runs on **static, hardcoded data** generated inside `src/lib/graphLogic.ts`. 

- **No Semantic Meaning**: Currently, the links between nodes (e.g., React -> TypeScript, or Tailwind -> Next.js) are arbitrary for demonstration purposes. There is no underlying binding function dynamically calculating relevance or semantic meaning between concepts.
- **Data Structure**: The data is a simple array of `nodes` (having an `id` and `label`) and `links` (having a `source` and `target` id).

## Step-by-Step Implementation Guide

The core application logic is encapsulated inside the `<Graph3D />` React component. Here is exactly how the visualization works under the hood:

### 1. Initialization and Physics Layout
When the component mounts, a `THREE.Scene`, `WebGLRenderer`, and `PerspectiveCamera` are created. We generate the static node data and feed it into `d3-force-3d`. 
- **`forceRadial` & `forceManyBody`**: We apply these forces to pull the nodes into a soft, spherical cluster around the central "3d-Graph" node, while making sure they repel each other enough to remain readable.
- We aggressively tick the physics simulation 300 times instantly so the nodes start in their final, stable positions before the first frame is ever drawn.

### 2. Scene Graph Hierarchy
Everything (nodes, lines, and text labels) is attached to a master `THREE.Group` called `graphGroup`.
- The camera is fixed and looks exclusively at the origin `(0, 0, 0)`.
- When the user rotates the view using the mouse, they are physically moving the camera in an orbit around the origin.

### 3. Click Interaction & The "Spinning Globe" Math
When a user clicks a node, we do **not** move the camera. Instead, we move the entire universe (`graphGroup`) so the node arrives at the origin, facing the camera.

1. **Calculate Direction**: We take the clicked node's local position and figure out where it is pointing in world space.
2. **Calculate Rotation (`qDiff`)**: We calculate the exact rotational difference between the node's current direction and the camera's fixed direction.
3. **Set Targets**: We apply this rotation difference to the `graphGroup`'s target quaternion. We also calculate the target distance to push the group away from the camera just enough so the node sits exactly at `(0, 0, 0)`.
4. **Trigger Animation**: We record the start time, the start quaternion, and the start position, and set an `isAnimating` flag.

### 4. The Animation Loop (Tweening & DOM Sync)
The `requestAnimationFrame` loop handles the fluid transitions:
- **Movement (`slerp` & `lerp`)**: Using the `easeInOutCubic` curve, we calculate an interpolation factor (`t`) from `0.0` to `1.0` over `800ms`. We apply this to the group's rotation (`slerpQuaternions`) and translation (`lerpVectors`).
- **Visuals**: Inside the same loop, we smoothly interpolate the `THREE.Color` of the nodes, their scale, and the opacity of the connecting lines, so the highlighting happens perfectly in sync with the movement.
- **Labels (DOM Projection)**: For the text labels, we ask Three.js where each node's 3D position currently lives on the 2D screen (`vTemp.project(camera)`). We convert this to CSS pixel coordinates and apply a CSS `transform: translate(x, y)` to the corresponding HTML `<div>`. This keeps the text crisp and easily selectable while feeling perfectly glued to the 3D objects.
