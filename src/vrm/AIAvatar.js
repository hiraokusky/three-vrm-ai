import React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMSchema } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
// import { IK, IKChain, IKJoint, IKBallConstraint } from 'three-ik';
// import CANNON, { IContactMaterialOptions, Shape, Vec3 } from "cannon";

export default class AIAvatar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            canvas: null
        };
        this.animate = this.animate.bind(this);
    }

    onCanvasLoaded = (canvas) => {
        if (!canvas) {
            return;
        }

        if (this.currentVrm) {
            return;
        }

        this.setState({ canvas: canvas });

        // renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !this.props.debug ? true : false });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        // camera
        this.camera = new THREE.PerspectiveCamera(30.0, canvas.clientWidth / canvas.clientHeight, 0.1, 50.0);
        this.camera.position.set(0.0, 0.0, 10.0);

        // camera controls
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.screenSpacePanning = true;
        controls.target.set(0.0, 0.0, 0.0);
        controls.update();

        // scene
        this.scene = new THREE.Scene();

        // light
        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1.0, 1.0, 1.0).normalize();
        this.scene.add(light);

        // Setup our world
        // this.world = new CANNON.World();
        // this.world.gravity.set(0, 0, -9.82); // m/s²

        // // Create a sphere
        // var radius = 1; // m
        // this.sphereBody = new CANNON.Body({
        //     mass: 5, // kg
        //     position: new CANNON.Vec3(0, 0, 10), // m
        //     shape: new CANNON.Sphere(radius)
        // });
        // this.world.addBody(this.sphereBody);

        // // Create a plane
        // var groundBody = new CANNON.Body({
        //     mass: 0 // mass == 0 makes the body static
        // });
        // var groundShape = new CANNON.Plane();
        // groundBody.addShape(groundShape);
        // this.world.addBody(groundBody);

        const loader = new GLTFLoader();
        loader.load(

            // URL of the VRM you want to load
            // '/vrm/three-vrm-girl.vrm',
            '/vrm/elmiku-v4x-0.8.vrm',

            // called when the resource is loaded
            (gltf) => {

                // generate a VRM instance from gltf
                VRM.from(gltf).then((vrm) => {

                    console.log(vrm);

                    // add the loaded vrm to the scene
                    this.scene.add(vrm.scene);
                    this.currentVrm = vrm;

                    // カメラの方を向く
                    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;

                    // -X象限に移動
                    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.x = -1;

                    // camera:THREE.Camera 今回はOrbitControlsで操作しているカメラ 
                    vrm.lookAt.target = this.camera;

                    // 目線をターゲットに追従させ更新する
                    vrm.lookAt.autoUpdate = true;

                    // ボーンを階層化する
                    console.log(this.currentVrm.humanoid.humanBones);
                    for (const key of Object.keys(this.currentVrm.humanoid.humanBones)) {
                        const bones = this.currentVrm.humanoid.humanBones[key];
                        if (bones && bones.length > 0) {
                            this.setBoneInBody(bones[0].node.parent, bones[0].node);
                        }
                    }
                    this.constructBody();
                    console.log(this.body);

                    // // IKのセットアップ
                    // this.ik = new IK();
                    // this.ik.isIK = true;

                    // this.movingTarget = new THREE.Mesh(
                    //     new THREE.SphereBufferGeometry(0.1),
                    //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
                    // );
                    // this.movingTarget.position.z = 2;

                    // const chain = new IKChain();
                    // const constraints = [new IKBallConstraint(90)];
                    // let bone;
                    // for (let i = 0; i < this.leftHandBones.length - 1; i++) {
                    //     bone = this.getBoneNode(this.leftHandBones[i]);
                    //     let target = null;
                    //     if (i === this.leftHandBones.length - 2) {
                    //         target = this.getBoneNode(this.leftHandBones[i + 1]);
                    //     }
                    //     chain.add(new IKJoint(bone, { constraints }), { target });
                    // }

                    // // Add the chain to the IK system
                    // this.ik.add(chain);
                });

            },

            // called while loading is progressing
            (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),

            // called when loading has errors
            (error) => console.error(error)

        );

        if (this.props.debug) {
            // helpers
            const gridHelper = new THREE.GridHelper(10, 10);
            this.scene.add(gridHelper);

            const axesHelper = new THREE.AxesHelper(5);
            this.scene.add(axesHelper);
        }

        this.animate(0);
    };

    // ボーンの階層構造
    body = {};

    // ボディにボーンをセットする
    setBoneInBody(parent, bone) {
        if (!(parent.name in this.body)) {
            this.body[parent.name] = { children: {} };
        }
        this.body[parent.name].node = parent
        this.body[parent.name].children[bone.name] = { node: bone, children: {} };
    }

    // ボディを階層化する
    constructBody() {
        // 仮親ボーンが子ボーンリストに存在したら、親から外して子ボーンリストにつける
        for (const name of Object.keys(this.body)) {
            for (const key of Object.keys(this.body)) {
                this.searchBone(this.body[key], name);
            }
        }
        // 階層化したボーンにボーン情報を付加する
        // 親ボーンへの距離を保持する
        // IKを処理するときにこの距離を維持するようにする
        for (const key of Object.keys(this.body)) {
            this.infoBone(this.body[key]);
        }
    }

    // 仮親ボーンが子ボーンリストに存在したら、親から外して子ボーンリストにつける
    searchBone(parent, name) {
        if (parent) {
            const children = parent.children;
            for (const co2key of Object.keys(children)) {
                // 子と一致したらそこに移動
                if (co2key === name) {
                    children[co2key] = this.body[name];
                    delete this.body[name];
                    return;
                }
                // さらに探索
                this.searchBone(children[co2key], name);
            }
        }
    }

    // HumanoidBoneNameと対応付ける
    infoBone(parent) {
        if (parent) {
            const pnode = parent.node;
            const children = parent.children;
            for (const co2key of Object.keys(children)) {
                // 親ボーンとの距離を算出

                // 名前の対応付け
                Object.entries(VRMSchema.HumanoidBoneName).forEach(([key, value]) => {
                    const b = this.getBoneNode(value);
                    if (b && children[co2key].node.name === b.name) {
                        children[co2key]["name"] = value;
                    }
                });
                // 子ボーンを処理
                this.infoBone(children[co2key])
            }
        }
    }

    // animate
    // ik = undefined;
    camera = undefined;
    scene = undefined;
    renderer = undefined;
    currentVrm = undefined;
    clock = new THREE.Clock();
    vx = -0.01;

    // movingTarget = undefined;

    getBoneNode(name) {
        return this.currentVrm.humanoid.getBoneNode(name);
    }

    getBlendShapeProxy() {
        return this.currentVrm.blendShapeProxy;
    }

    // headBones = [
    //     VRMSchema.HumanoidBoneName.Hips,
    //     VRMSchema.HumanoidBoneName.Spine,
    //     VRMSchema.HumanoidBoneName.Chest,
    //     VRMSchema.HumanoidBoneName.UpperChest,
    //     VRMSchema.HumanoidBoneName.Neck,
    //     VRMSchema.HumanoidBoneName.Head,
    // ];
    // leftEyeBones = [
    //     VRMSchema.HumanoidBoneName.Head,
    //     VRMSchema.HumanoidBoneName.LeftEye,
    // ];
    // rightEyeBones = [
    //     VRMSchema.HumanoidBoneName.Head,
    //     VRMSchema.HumanoidBoneName.RightEye,
    // ];
    // leftHandBones = [
    //     VRMSchema.HumanoidBoneName.UpperChest,
    //     VRMSchema.HumanoidBoneName.LeftShoulder,
    //     VRMSchema.HumanoidBoneName.LeftUpperArm,
    //     VRMSchema.HumanoidBoneName.LeftLowerArm,
    //     VRMSchema.HumanoidBoneName.LeftHand,
    // ];
    // rightHandBones = [
    //     VRMSchema.HumanoidBoneName.UpperChest,
    //     VRMSchema.HumanoidBoneName.RightShoulder,
    //     VRMSchema.HumanoidBoneName.RightUpperArm,
    //     VRMSchema.HumanoidBoneName.RightLowerArm,
    //     VRMSchema.HumanoidBoneName.RightHand,
    // ];
    // leftFootBones = [
    //     VRMSchema.HumanoidBoneName.Hips,
    //     VRMSchema.HumanoidBoneName.LeftUpperLeg,
    //     VRMSchema.HumanoidBoneName.LeftLowerLeg,
    //     VRMSchema.HumanoidBoneName.LeftFoot,
    //     VRMSchema.HumanoidBoneName.LeftToes,
    // ];
    // rightFootBones = [
    //     VRMSchema.HumanoidBoneName.Hips,
    //     VRMSchema.HumanoidBoneName.RightUpperLeg,
    //     VRMSchema.HumanoidBoneName.RightLowerLeg,
    //     VRMSchema.HumanoidBoneName.RightFoot,
    //     VRMSchema.HumanoidBoneName.RightToes,
    // ];

    doik(source, target) {
        // 目標の動作をする
        // どういう順番でどういう動きをしたらいいかを覚える
        // まずは特定の部位を目標の場所へ移動させる、つまりIK
        // FABRIKという手法がある。基本それにする。

        // this.bodyにRootから全ボーンをセットした。
        // pointを指定すると、それを移動する。
        // pointにつながったボーンを上と下に向けて動かす。
        // 基本はそのまま動かす。無重力空間っぽく。

        // this.bodyから対象のボーンを見つける
        for (const key of Object.keys(this.body)) {
            this.targetBone(source,  target, this.body[key]);
        }
    }

    targetBone(source, target, parent) {
        if (parent) {
            const pnode = parent.node;
            const children = parent.children;
            for (const co2key of Object.keys(children)) {
                const name = children[co2key]["name"];
                if (name === source) {
                    // 目的のボーンを見つけた
                    const bone = this.getBoneNode(name);

                    // 目的のボーンを移動する
                    // 差分をとる
                    const d = target - bone.position;
                    // 移動
                    const px = bone.position.x + d.x;
                    const py = bone.position.y + d.y;
                    const pz = bone.position.z + d.z;
                    bone.position.set(px, py, pz);

                    // つながっているボーンを距離が一定になるように移動する
                    // 親を１つずつ辿る
                    // 子を１つずつ辿る

                    // まず先端を全部くっつける(最後がくっつかなくなる)
                    // ただし、曲がらない方向にはいかない
                    // また曲がってもつらい方向の場合は痛みを増やす

                    // 次に根元をくっつける

                    // 先端→根本を繰り返し、収束させる

                    return;
                }

                // 子ボーンを処理
                this.targetBone(source,  target, children[co2key])
            }
        }
    }

    // fixedTimeStep = 1.0 / 60.0; // seconds
    // maxSubSteps = 3;
    // lastTime = undefined;

    animate(time) {
        window.requestAnimationFrame(this.animate);

        // if (this.lastTime !== undefined) {
        //     var dt = (time - this.lastTime) / 1000;
        //     this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);
        // }
        // console.log("Sphere z position: " + this.sphereBody.position.z);
        // this.lastTime = time;

        const deltaTime = this.clock.getDelta();

        if (this.currentVrm) {

            // move
            let px = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.x;
            let py = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.y;
            let pz = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.z;

            px += this.vx;
            if (px < -5 || px > 0) {
                this.vx = -this.vx;
            }
            // this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.set(px, py, pz);

            // bones
            const s = 0.45 * Math.PI * Math.sin(Math.PI * this.clock.elapsedTime);
            this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y = s * 2;
            this.getBoneNode(VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = s;
            this.getBoneNode(VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -s;

            // blend shapes
            // this.getBlendShapeProxy().setValue(VRMSchema.BlendShapePresetName.Fun, .7);
            // this.getBlendShapeProxy().setValue(VRMSchema.BlendShapePresetName.Sorrow, .2);
            // this.getBlendShapeProxy().update();

            // update vrm
            this.currentVrm.update(deltaTime);

            // this.movingTarget.position.x = px;
            // IKの状態を更新する
            // this.ik.solve();
            // let target = this.getBoneNode(VRMSchema.HumanoidBoneName.RightHand).position;
            // target.x += 0.01;
            // this.doik(VRMSchema.HumanoidBoneName.LeftHand, target);
        }

        this.renderer.render(this.scene, this.camera);
    }

    render() {
        return (
            <canvas id="canvas"
                style={{
                    pointerEvents: this.props.debug ? "auto" : "none",
                    zIndex: "999",
                    position: "fixed",
                    bottom: this.state.canvas ? -this.state.canvas.clientHeight / 2 + "px" : "0px",
                    right: this.state.canvas ? -this.state.canvas.clientWidth / 2 + "px" : "0px",
                    width: "200vw",
                    height: "200vh"
                }}
                ref={this.onCanvasLoaded} />
        );
    }
}