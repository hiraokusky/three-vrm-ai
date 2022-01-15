import React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMSchema } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import CANNON, { IContactMaterialOptions, Shape, Vec3 } from "cannon";

import { Menu } from 'antd';
import { AppstoreOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';

import 'antd/dist/antd.css';

const { SubMenu } = Menu;

// https://threejsfundamentals.org/threejs/lessons/threejs-cleanup.html
class ResourceTracker {
    constructor() {
        this.resources = new Set();
    }
    track(resource) {
        if (resource.dispose || resource instanceof THREE.Object3D) {
            this.resources.add(resource);
        }
        return resource;
    }
    untrack(resource) {
        this.resources.delete(resource);
    }
    dispose() {
        for (const resource of this.resources) {
            if (resource instanceof THREE.Object3D) {
                if (resource.parent) {
                    resource.parent.remove(resource);
                }
            }
            if (resource.dispose) {
                resource.dispose();
            }
        }
        this.resources.clear();
    }
}

class AIAvatar {

}

export default class AIWorld extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            canvas: null,
            newPose: false,
        };
        this.animate = this.animate.bind(this);
    }

    // Create a plane
    createGround(world) {
        // Plane Materialの質量定義
        var groundMat = new CANNON.Material('groundMat');
        var groundShape = new CANNON.Plane();
        var groundBody = new CANNON.Body({
            mass: 0,
            material: groundMat
        });
        groundBody.addShape(groundShape);
        // 90度回転してy=0平面にする
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, -1, 0);
        world.addBody(groundBody);
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load(

            // URL of the VRM you want to load
            '/three-vrm-ai/vrm/three-vrm-girl.vrm',
            // '/vrm/elmiku-v4x-0.8.vrm',

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
                    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.x = 0;

                    // camera:THREE.Camera 今回はOrbitControlsで操作しているカメラ 
                    vrm.lookAt.target = this.camera;

                    // 目線をターゲットに追従させ更新する
                    vrm.lookAt.autoUpdate = true;

                    // ボーンを階層化する
                    this.constructBody();
                    console.log(this.body);

                    // 階層化されたボーンをたどる
                    this.createObjectBody();

                    // this.updateObject(VRMSchema.HumanoidBoneName.Hips);

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
    }

    ///////////////////////////////////////////////////////////////////
    // ボーンのオブジェクト化処理
    ///////////////////////////////////////////////////////////////////

    createObjectBody() {
        // this.bodyから対象のボーンを見つける
        for (const key of Object.keys(this.body)) {
            this.createObjectBone(this.body[key], 0);
        }
    }

    createObjectBone(parent, depth) {
        if (parent) {
            for (const co2key of Object.keys(parent.children)) {
                const node = parent.children[co2key];
                const name = node["name"];
                this.createObject(parent, name);
                this.createObjectBone(node, depth + 1);
            }
        }
    }

    // オブジェクトをつくる
    createObject(parent, name) {
        if (!this.bodies[name]) {
            const pos = this.getBoneNode(name).position;
            var position = new CANNON.Vec3(pos.x, pos.y, pos.z);
            const pname = parent["name"];
            let d = 1;
            if (pname) {
                // 親までの距離
                d = pos.distanceTo(this.getBoneNode(pname).position);
            }
            var body = new CANNON.Body({
                mass: 0,
                position: position,
                material: new CANNON.Material('groundMat'),
            });
            body.addShape(new CANNON.Sphere(0.001));
            this.world.addBody(body);

            body["d"] = d;
            this.bodies[name] = body;
        }
        this.updateObject(name);
    }

    updateObjectBody() {
        // this.bodyから対象のボーンを見つける
        for (const key of Object.keys(this.body)) {
            this.updateObjectBone(this.body[key], 0);
        }
    }

    updateObjectBone(parent, depth) {
        if (parent) {
            for (const co2key of Object.keys(parent.children)) {
                const node = parent.children[co2key];
                const name = node["name"];
                this.updateObject(parent, name);
                this.updateObjectBone(node, depth + 1);
            }
        }
    }

    updateObject(parent, name) {
        const pname = parent["name"];
        if (pname) {
            const ppos = this.getBoneNode(pname).position;
            const pos = this.getBoneNode(name).position;
            const npos = this.bodies[name].position;

            // 長さを維持するように動く
            const d = this.bodies[name].d;
            const pv = new THREE.Vector3(ppos.x, ppos.y, ppos.z);
            let nv = new THREE.Vector3(npos.x, npos.y, npos.z);
            nv = nv.sub(pv);
            nv = nv.normalize();
            nv = nv.multiplyScalar(d);

            // this.bodies[name].position.set(nv.x, nv.y, nv.z);            
            // this.getBoneNode(name).position.copy(this.bodies[name].position);

            // if (name === VRMSchema.HumanoidBoneName.RightHand) {
            //     console.log(this.getBoneNode(name))
            // }

            // 方向に向けて回転を制御する(うまくいってるっぽい)
            // this.getBoneNode(name).quaternion.setFromUnitVectors(pos, ppos);
        }
    }

    moveModel(v) {
        const p = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position;
        p.x += v.x;
        p.y += v.y;
        p.z += v.z;
        this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.set(p.x, p.y, p.z);
    }

    g = 0;
    ga = 0.01;

    fallModel(v) {
        // 地面から浮いていたら重力を適用
        let min = this.getMinY();
        let p = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position;
        if (min > 0) {
            this.g -= this.ga;
            p.y += this.g;
        }
        this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.set(p.x, p.y, p.z);

        min = this.getMinY();
        p = this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position;
        if (min < 0) {
            // 地面に埋め込んだら地面に戻す
            p.y += -min;
            this.g = 0;
        }
        this.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.set(p.x, p.y, p.z);
    }

    getMinY() {
        let max = 1;
        for (let key of Object.keys(this.limits)) {
            var target = new THREE.Vector3()
            this.getBoneNode(key).getWorldPosition(target);
            if (target.y <= 0) {
                if (target.y < max) {
                    max = target.y;
                }
            }
        }
        return max;
    }

    moveObject(name, v) {
        const p = this.bodies[name].position;
        p.x += v.x;
        p.y += v.y;
        p.z += v.z;
        this.bodies[name].position.set(p.x, p.y, p.z);

        // // 親に向かって移動
        // // 子に向かって移動
        // for (const key of Object.keys(this.bodies)) {
        //     if (key !== name) {
        //         const node = this.bodies[key];
        //         const r = 0.5;
        //         const p = node.position;
        //         p.x += v.x * r;
        //         p.y += v.y * r;
        //         p.z += v.z * r;
        //         node.position.set(p.x, p.y, p.z);
        //     }
        // }
    }

    ///////////////////////////////////////////////////////////////////
    // ボーンのオブジェクト化処理
    ///////////////////////////////////////////////////////////////////

    poseDebug() {
        const s = 1 * Math.PI * Math.sin(Math.PI * this.clock.elapsedTime);
        this.rotateOne("rightUpperArm", s, 0, 0);
        this.rotateOne("leftUpperArm", s, 0, 0);
        this.rotateOne("leftLowerArm", s, 0, 0);
        // this.rotateOne("rightLowerArm",s, 0, 0);
        // this.rotateOne("upperChest", s, 0, 0);
        // this.rotateOne("chest", s, 0, 0);
        // this.rotateOne("spine", s, 0, 0);
        // this.rotateOne("leftUpperLeg", -s, 0, 0);
        // this.rotateOne("rightUpperLeg", -s, 0, 0);
        // this.rotateOne("leftShoulder", s, s, s);
        // this.rotateOne("rightShoulder", s, s, s);
    }

    rotations = {
    }

    pose() {
        // this.poseDebug();
        // return;
        
        // 各ボーンの回転
        for (const key of Object.keys(this.bodies)) {
            if (!Object.keys(this.limits).includes(key)) {
                continue;
            }

            // 最初の回転
            if (!Object.keys(this.rotations).includes(key)) {
                this.rotations[key] = [
                    [0, 0, 0], // position
                    [0, 0, 0], // velocity
                    [0, 0, 0] // dst
                ];
            }

            // 現在地と目的地から移動量を決める
            let v = 0.1;
            let current = this.rotations[key];
            let dx = current[0][0];
            let dy = current[0][1];
            let dz = current[0][2];
            dx += (current[2][0] - dx) * v;
            dy += (current[2][1] - dy) * v;
            dz += (current[2][2] - dz) * v;

            // 回転する
            this.rotateOne(key, dx, dy, dz);

            // 現在地を更新する
            current[0][0] = dx;
            current[0][1] = dy;
            current[0][2] = dz;

            // 目的地を変更する
            if (Math.abs(current[2][0] - current[0][0]) < 0.01) {
                if (this.state.newPose) {
                    this.decideDestination(key, current);
                }
            }
        }

        if (this.state.newPose) {
            this.setState({ newPose: false });
        }

        this.fallModel();
    }

    // 特定のボーンの座標が目的地に近くなるようにする
    decideDestination(key, current) {
        if (Math.abs(current[2][0] - current[0][0]) < 0.01) {
            var limits = this.limits[key];
            let dstx = this.randomR(limits, "x")
            let dsty = this.randomR(limits, "y")
            let dstz = this.randomR(limits, "z")
            this.rotations[key] = [
                [current[0][0], current[0][1], current[0][2]], // position
                [0, 0, 0], // velocity
                [dstx, dsty, dstz] // dst
            ];
        }
    }

    // 回転量を制限の範囲でランダムに決める
    randomR(limits, axis) {
        let min = this.limitX(limits, axis, -0.5 * Math.PI);
        let max = this.limitX(limits, axis, 0.5 * Math.PI);
        return Math.random() * (max - min) + min;
    }

    // 回転量をランダムに決める(MAX)
    randomX(x) {
        x = 0.5 * Math.PI * (Math.random() - 0.5) * 2;
        return x;
    }

    // 関節可動域
    limits = {
        "neck": {
            "axis": "y",
            "x": [-0.2, 0.3], // -が前
            "y": [-0.2, 0.2],
            "z": [-0.2, 0.2],
        },
        "upperChest": {
            "axis": "y",
            "x": [-0.2, 0.1], // -が前
            "y": [-0.1, 0.1],
            "z": [-0.1, 0.1],
        },
        "chest": {
            "axis": "y",
            "x": [-0.2, 0.1], // -が前
            "y": [-0.1, 0.1],
            "z": [-0.1, 0.1],
        },
        "spine": {
            "axis": "y",
            "x": [-0.1, 0.1], // -が前
            "y": [-0.1, 0.1],
            "z": [-0.1, 0.1],
        },
        "leftShoulder": {
            "axis": "x",
            "x": [-0, 0], // -が後ろ
            "y": [-0, 0], // +が前
            "z": [-0, 0],
        },
        "rightShoulder": {
            "axis": "x",
            "x": [-0, 0], // -が後ろ
            "y": [-0, 0], // +が前
            "z": [-0, 0],
        },
        "leftUpperArm": {
            "axis": "x",
            "x": [-0.25, 0.5], // -が後ろ
            "y": [-0.75, 0.25],
            "z": [-0.25, 0.25],
        },
        "leftLowerArm": {
            "axis": "x",
            "x": [-0.5, 0.5], // -が後ろ
            "y": [-0.75, 0],
            "z": [-0, 0.75],
        },
        "rightUpperArm": {
            "axis": "x",
            "x": [-0.25, 0.5], // -が後ろ
            "y": [-0.25, 0.75],
            "z": [-0.25, 0.25],
        },
        "rightLowerArm": {
            "axis": "x",
            "x": [-0.5, 0.5], // -が後ろ
            "y": [-0, 0.75],
            "z": [-0.75, 0],
        },

        "leftUpperLeg": {
            "axis": "y",
            "x": [-0, 0.75], // 前のみ
            "y": [-0.25, 0.25], // ねじり
            "z": [-0.25, 0.25],
        },
        "rightUpperLeg": {
            "axis": "y",
            "x": [-0, 0.75], // 前のみ
            "y": [-0.25, 0.25], // ねじり
            "z": [-0.25, 0.25],
        },
        "leftLowerLeg": {
            "axis": "y",
            "x": [-0.75, 0], // 後ろのみ
            "y": [-0.25, 0.25], // ねじり
            "z": [-0, 0],
        },
        "rightLowerLeg": {
            "axis": "y",
            "x": [-0.75, 0], // 後ろのみ
            "y": [-0.25, 0.25], // ねじり
            "z": [-0, 0],
        },
        "leftToes": {
            "axis": "y",
            "x": [-0, 0], // 後ろのみ
            "y": [-0, 0], // ねじり
            "z": [-0, 0],
        },
        "rightToes": {
            "axis": "y",
            "x": [-0, 0], // 後ろのみ
            "y": [-0, 0], // ねじり
            "z": [-0, 0],
        },
        // "hips": {
        //     "x": [-1, 1],
        //     "y": [-1, 1],
        //     "z": [-1, 1],
        // }
    }

    headBones = [
        VRMSchema.HumanoidBoneName.Hips,
        VRMSchema.HumanoidBoneName.Spine,
        VRMSchema.HumanoidBoneName.Chest,
        VRMSchema.HumanoidBoneName.UpperChest,
        VRMSchema.HumanoidBoneName.Neck,
        VRMSchema.HumanoidBoneName.Head,
    ];
    leftEyeBones = [
        VRMSchema.HumanoidBoneName.Head,
        VRMSchema.HumanoidBoneName.LeftEye,
    ];
    rightEyeBones = [
        VRMSchema.HumanoidBoneName.Head,
        VRMSchema.HumanoidBoneName.RightEye,
    ];
    leftHandBones = [
        VRMSchema.HumanoidBoneName.UpperChest,
        VRMSchema.HumanoidBoneName.LeftShoulder,
        VRMSchema.HumanoidBoneName.LeftUpperArm,
        VRMSchema.HumanoidBoneName.LeftLowerArm,
        VRMSchema.HumanoidBoneName.LeftHand,
    ];
    rightHandBones = [
        VRMSchema.HumanoidBoneName.UpperChest,
        VRMSchema.HumanoidBoneName.RightShoulder,
        VRMSchema.HumanoidBoneName.RightUpperArm,
        VRMSchema.HumanoidBoneName.RightLowerArm,
        VRMSchema.HumanoidBoneName.RightHand,
    ];
    leftFootBones = [
        VRMSchema.HumanoidBoneName.Hips,
        VRMSchema.HumanoidBoneName.LeftUpperLeg,
        VRMSchema.HumanoidBoneName.LeftLowerLeg,
        VRMSchema.HumanoidBoneName.LeftFoot,
        VRMSchema.HumanoidBoneName.LeftToes,
    ];
    rightFootBones = [
        VRMSchema.HumanoidBoneName.Hips,
        VRMSchema.HumanoidBoneName.RightUpperLeg,
        VRMSchema.HumanoidBoneName.RightLowerLeg,
        VRMSchema.HumanoidBoneName.RightFoot,
        VRMSchema.HumanoidBoneName.RightToes,
    ];

    // ボーンを回転する
    // 特定の順番で軸回転しないとおかしくなる
    // クオータニオンを使って回転する
    rotateOne(key, x, y, z) {
        if (!Object.keys(this.limits).includes(key)) {
            return;
        }
        var limits = this.limits[key];
        var axis = limits['axis'];
        var node = this.getBoneNode(key);
        var quaternion = new THREE.Quaternion();
        var target = new THREE.Quaternion();
        if (axis === "x") {
            target.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.limitX(limits, "y", y));
            quaternion.multiply(target);
            target = new THREE.Quaternion();
            target.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.limitX(limits, "z", z));
            quaternion.multiply(target);
            target = new THREE.Quaternion();
            target.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.limitX(limits, "x", x));
            quaternion.multiply(target);
        } else { // y
            target.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.limitX(limits, "x", x));
            quaternion.multiply(target);
            target = new THREE.Quaternion();
            target.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.limitX(limits, "z", z));
            quaternion.multiply(target);
            target = new THREE.Quaternion();
            target.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.limitX(limits, "y", y));
            quaternion.multiply(target);
        }
        node.setRotationFromQuaternion(quaternion);
    }

    limitX(limits, axis, x) {
        let l = limits[axis][0] * 1 * Math.PI;
        let u = limits[axis][1] * 1 * Math.PI;
        if (x < l) x = l;
        if (x > u) x = u;
        return x;
    }

    ///////////////////////////////////////////////////////////////////
    // ボーンの階層化処理
    ///////////////////////////////////////////////////////////////////

    // ボーンの階層構造
    body = {};

    // ボディを階層化する
    constructBody() {
        // ボディにボーンをセットする
        for (const key of Object.keys(this.currentVrm.humanoid.humanBones)) {
            const bones = this.currentVrm.humanoid.humanBones[key];
            if (bones && bones.length > 0) {
                this.setBoneInBody(bones[0].node.parent, bones[0].node);
            }
        }

        // 仮親ボーンが子ボーンリストに存在したら、親から外して子ボーンリストにつける
        for (const name of Object.keys(this.body)) {
            for (const key of Object.keys(this.body)) {
                this.treeBone(this.body[key], name);
            }
        }

        // 階層化したボーンにボーン情報を付加する
        // 親ボーンへの距離を保持する
        // IKを処理するときにこの距離を維持するようにする
        for (const key of Object.keys(this.body)) {
            this.infoBone(this.body[key]);
        }
    }

    // ボディにボーンをセットする
    setBoneInBody(parent, bone) {
        if (!(parent.name in this.body)) {
            this.body[parent.name] = { children: {} };
        }
        this.body[parent.name].node = parent
        this.body[parent.name].children[bone.name] = { node: bone, children: {} };
    }

    // 仮親ボーンが子ボーンリストに存在したら、親から外して子ボーンリストにつける
    treeBone(parent, name) {
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
                this.treeBone(children[co2key], name);
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

    ///////////////////////////////////////////////////////////////////
    // 3Dワールドの初期化
    ///////////////////////////////////////////////////////////////////

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
        // document.body.appendChild(this.renderer.domElement);

        // camera
        this.camera = new THREE.PerspectiveCamera(30.0, canvas.clientWidth / canvas.clientHeight, 0.1, 500.0);
        this.camera.position.set(0.0, 1.0, 5.0);

        // camera controls
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.screenSpacePanning = true;
        controls.target.set(0.0, 1.0, 0.0);
        controls.update();

        // scene
        this.scene = new THREE.Scene();

        // light
        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1.0, 1.0, 1.0).normalize();
        this.scene.add(light);

        // Setup our world
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // m/s²
        this.world.gravity.set(0, -0.982, 0); // m/s²
        // ぶつかっている「可能性のある」剛体同士を見つける作業
        this.world.broadphase = new CANNON.NaiveBroadphase();
        // 反復計算回数
        this.world.solver.iterations = 5;
        // 許容値
        this.world.solver.tolerance = 0.1;

        // 地面を作る
        this.createGround(this.world);

        // モデルをロードする
        this.loadModel();

        if (this.props.debug) {
            // helpers
            const gridHelper = new THREE.GridHelper(10, 10);
            this.scene.add(gridHelper);

            const axesHelper = new THREE.AxesHelper(5);
            this.scene.add(axesHelper);
        }

        this.animate(0);
    };

    ///////////////////////////////////////////////////////////////////
    // 
    ///////////////////////////////////////////////////////////////////

    // animate
    // ik = undefined;
    camera = undefined;
    scene = undefined;
    renderer = undefined;
    currentVrm = undefined;
    clock = new THREE.Clock();

    // movingTarget = undefined;

    getBoneNode(name) {
        return this.currentVrm.humanoid.getBoneNode(name);
    }

    getBlendShapeProxy() {
        return this.currentVrm.blendShapeProxy;
    }

    // fixedTimeStep = 1.0 / 60.0; // seconds
    // maxSubSteps = 3;
    // lastTime = undefined;

    // Cannon
    bodies = {};
    vx = -0.01;
    count = 0;

    animate(time) {
        window.requestAnimationFrame(this.animate);

        if (this.currentVrm) {
            const deltaTime = this.clock.getDelta();

            this.pose();

            this.currentVrm.update(deltaTime);
            if (this.world) {
                this.world.step(deltaTime);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    render() {
        return (
            <>
                <canvas id="canvas"
                    style={{
                        pointerEvents: this.props.debug ? "auto" : "none",
                        position: "absolute",
                        // bottom: this.state.canvas ? -this.state.canvas.clientHeight / 2 + "px" : "0px",
                        // right: this.state.canvas ? -this.state.canvas.clientWidth / 2 + "px" : "0px",
                        right: "0px",
                        width: "100vw",
                        height: "100vh"
                    }}
                    ref={this.onCanvasLoaded} />
                <div>
                    <Menu theme="dark"
                        mode="inline" onClick={(a, b) => {
                            this.setState({ newPose: true });
                        }} style={{ width: 150 }}>
                        <Menu.Item key="random">Next pose</Menu.Item>
                    </Menu>
                </div>
            </>
        );
    }

    createJoint(parent, co) {
        let pname = this.bodies[parent["name"]];
        let cname = this.bodies[co["name"]];
        let p = pname.position;
        let c = cname.position;
        console.log(pname, cname)
        if (!pname || !cname) {
            return;
        }
        const angleA = Math.PI / 4;
        const angleB = Math.PI / 3;
        const twistAngle = Math.PI / 8;
        const pelvisLength = 0.4;

        var spineJoint = new CANNON.DistanceConstraint(pname, cname, 0.1);
        // var spineJoint = new CANNON.ConeTwistConstraint(pname, cname, {
        //     pivotA: new CANNON.Vec3(0, pelvisLength / 2, 0),
        //     pivotB: new CANNON.Vec3(0, -pelvisLength / 2, 0),
        //     axisA: CANNON.Vec3.UNIT_Y,
        //     axisB: CANNON.Vec3.UNIT_Y,
        //     angle: angleA,
        //     twistAngle: twistAngle
        // });
        this.world.addConstraint(spineJoint);
    }

    // 目標の動作をする
    // どういう順番でどういう動きをしたらいいかを覚える
    // まずは特定の部位を目標の場所へ移動させる、つまりIK
    // FABRIKという手法がある。基本それにする。

    // this.bodyにRootから全ボーンをセットした。
    // pointを指定すると、それを移動する。
    // pointにつながったボーンを上と下に向けて動かす。
    // 基本はそのまま動かす。無重力空間っぽく。

    doik() {
        // this.bodyから対象のボーンを見つける
        for (const key of Object.keys(this.body)) {
            this.targetBone(this.body[key], 0);
        }
        this.firstable = false;
    }

    firstable = true;

    targetBone(parent, depth) {
        if (parent) {
            for (const co2key of Object.keys(parent.children)) {
                const node = parent.children[co2key];
                const name = node["name"];

                // update
                this.updateObject(name);

                // 子ボーンを処理
                if (depth < 2) {
                    this.targetBone(node, depth + 1);
                }

                if (this.firstable) {
                    // ジョイントを追加
                    for (const coco of Object.keys(node.children)) {
                        const co = node.children[coco];
                        this.createJoint(node, co);
                    }
                }

                // if (name === source) {
                //     // 目的のボーンを見つけた
                //     const bone = this.getBoneNode(name);

                //     // 目的のボーンを移動する
                //     // 差分をとる
                //     const d = target - bone.position;
                //     // 移動
                //     const px = bone.position.x + d.x;
                //     const py = bone.position.y + d.y;
                //     const pz = bone.position.z + d.z;
                //     bone.position.set(px, py, pz);

                //     // つながっているボーンを距離が一定になるように移動する
                //     // 親を１つずつ辿る
                //     // 子を１つずつ辿る

                //     // まず先端を全部くっつける(最後がくっつかなくなる)
                //     // ただし、曲がらない方向にはいかない
                //     // また曲がってもつらい方向の場合は痛みを増やす

                //     // 次に根元をくっつける

                //     // 先端→根本を繰り返し、収束させる

                //     return;
                // }
            }
        }
    }
}