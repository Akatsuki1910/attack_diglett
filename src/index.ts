import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  CreateGround,
  CreateSphere,
  DirectionalLight,
  Engine,
  HavokPlugin,
  Matrix,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Ray,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  Vector3,
  WebGPUEngine,
  type ISceneLoaderAsyncResult,
} from "@babylonjs/core";
import * as Debug from "@babylonjs/core/Debug";
import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/loaders/glTF";
import havokWasmUrl from "../assets/HavokPhysics.wasm?url";
import model from "../assets/a.glb?url";
import van from "vanjs-core";

let count = 0;

const init = async (engine: Engine | WebGPUEngine, havok: any) => {
  const scene = new Scene(engine);
  const havokPlugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);

  const camera = new ArcRotateCamera(
    "MainCamera",
    Math.PI,
    Math.PI / 4,
    20,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);

  new DirectionalLight("MainLight", new Vector3(0.1, -0.5, 0.2), scene);

  const ground = CreateGround("Ground", { width: 100, height: 100 }, scene);
  new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    { mass: 0, friction: 10 },
    scene
  );

  // var physicsViewer = new Debug.PhysicsViewer(scene);
  // for (let mesh of scene.meshes) {
  //   if (mesh.physicsBody) {
  //     physicsViewer.showBody(mesh.physicsBody);
  //   }
  // }

  const folderName = model.split("/").slice(0, -1).join("/").concat("/");
  const fileName = model.split("/").slice(-1)[0];
  const n = await SceneLoader.ImportMeshAsync("", folderName, fileName, scene);
  n.meshes[1].setEnabled(false);

  const x = 20;
  const y = 20;
  const meshesArr: { mesh: AbstractMesh; dir: "up" | "down" }[] = [];
  for (let i = 0; i < x; i++) {
    for (let j = 0; j < y; j++) {
      const cloneMergeMesh = n.meshes[1].clone(
        `cloneMergeMesh${i}${j}`,
        null,
        true
      )!;
      cloneMergeMesh.setEnabled(true);
      cloneMergeMesh.position.x = i * 4 - (x / 2 - 0.5) * 4;
      cloneMergeMesh.position.z = j * 4 - (y / 2 - 0.5) * 4;
      new PhysicsAggregate(
        cloneMergeMesh,
        PhysicsShapeType.CONVEX_HULL,
        { mass: 0, restitution: 0 },
        scene
      );

      cloneMergeMesh.position.y = Math.random() * 4 - 4;
      meshesArr.push({
        mesh: cloneMergeMesh,
        dir: Math.random() > 0.5 ? "up" : "down",
      });
    }
  }

  const bollMaterial = new StandardMaterial("BollMaterial");
  const bollMesh = MeshBuilder.CreateSphere("boll", { diameter: 1.0 });
  bollMesh.setEnabled(false);

  scene.onPointerDown = (evt) => {
    const m = bollMaterial.clone(`BollMaterial${count}`);
    m.diffuseColor = new Color3(0.8, 0.8, 0.8);
    const mesh = bollMesh.clone(`boll${count}`);
    mesh.setEnabled(true);
    mesh.position = new Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z
    );
    mesh.material = m;

    const bollPhysics = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      { mass: 1, friction: 1 },
      scene
    );

    mesh.physicsBody?.setCollisionCallbackEnabled(true);
    const observable = mesh.physicsBody?.getCollisionEndedObservable();
    observable?.add((collisionEvent) => {});

    const pickingRay = scene.createPickingRay(
      evt.clientX,
      evt.clientY,
      Matrix.Identity(),
      camera
    );
    const impulseDirection = pickingRay.direction.normalize();
    const impulse = impulseDirection.scale(50);
    bollPhysics.body.applyImpulse(impulse, bollMesh.position);

    count++;
  };

  engine.runRenderLoop(() => {
    scene.render();

    for (let i = 0; i < meshesArr.length; i++) {
      const mesh = meshesArr[i].mesh;
      const dir = meshesArr[i].dir;
      if (dir === "up") {
        mesh.position.y += 0.05;
        if (mesh.position.y > 0) {
          meshesArr[i].dir = "down";
        }
      } else {
        mesh.position.y -= 0.05;
        if (mesh.position.y < -4) {
          meshesArr[i].dir = "up";
        }
      }
    }
  });
  window.addEventListener("resize", () => {
    engine.resize();
  });
};

const createAsync = async (canvas: HTMLCanvasElement) => {
  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  if (await WebGPUEngine.IsSupportedAsync) {
    const engine = new WebGPUEngine(canvas, {
      adaptToDeviceRatio: true,
      antialias: true,
    });
    await engine.initAsync();
    return await init(engine, havok);
  } else if (Engine.IsSupported) {
    return await init(
      new Engine(canvas, true, {
        adaptToDeviceRatio: true,
        antialias: true,
        disableWebGL2Support: false,
      }),
      havok
    );
  }
  throw new Error("Engine cannot be created.");
};

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("renderCanvas");
  if (!canvas) {
    throw new Error("Undefined #renderCanvas");
  }

  createAsync(canvas as HTMLCanvasElement);
});

const { canvas } = van.tags;

van.add(document.body, canvas({ id: "renderCanvas" }));
