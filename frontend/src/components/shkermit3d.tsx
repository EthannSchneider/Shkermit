import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
// @ts-expect-error: no types
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

export default function Shkermit3D() {
  const obj = useLoader(OBJLoader, "/models/shkermit.obj");
  return (
    <Canvas
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 3, 3]} />

      <primitive object={obj} scale={2.5} position={[0, -1, 0]} />

      <group
        onUpdate={() => {
          // @ts-expect-error: traverse exists
          obj.traverse((child) => {
            if (child.isMesh) {
              const mat = child.material;
              if (Array.isArray(mat)) {
                mat.forEach((m) => m.color && m.color.set("green"));
              } else if (mat && mat.color) {
                mat.color.set("green");
              }
              if (mat) mat.needsUpdate = true;
            }
          });
        }}
      />

      <OrbitControls enableZoom={false} />
    </Canvas>
  );
}
