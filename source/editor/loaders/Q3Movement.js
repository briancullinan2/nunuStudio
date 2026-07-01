import * as THREE from 'three';

/**
 * Q3MovementProcessor
 * Port of the official Quake 3 bg_pmove.c / bg_slidemove.c physics pipeline.
 * Simulates frame-rate independent friction, air strafe acceleration, stepping,
 * and handles surface flags for kill brush interactions.
 */
export class Q3MovementProcessor {
	constructor(bspSceneInstance) {
		this.bsp = bspSceneInstance;

		// Player Physical Dimensions (matching standard bounding box limits)
		this.mins = new THREE.Vector3(-15, -15, -24);
		this.maxs = new THREE.Vector3(15, 15, 32);
		this.playerRadius = 15.0;

		// Core Kinematic State Vectors
		this.position = new THREE.Vector3(0, 0, 0);
		this.velocity = new THREE.Vector3(0, 0, 0);

		this.onGround = false;
		this.walking = false;
		this.groundTrace = null;

		// Quake 3 Movement Tuning Profiles
		this.stopSpeed = 100.0;
		this.jumpVelocity = 270.0; // Standard JUMP_VELOCITY scaling metric
		this.accelerateSpeed = 10.0;
		this.airAccelerateSpeed = 1.0;
		this.frictionCoefficient = 6.0;
		this.gravityMagnitude = 800.0; // Correct native Q3 baseline gravity units
		this.stepSizeHeight = 18.0;
		this.overClip = 1.001;
		this.minWalkNormalZ = 0.7; // MIN_WALK_NORMAL Cosine threshold slope check

		// Diagnostics
		this.isDead = false;
	}

	/**
	 * Resets vectors and tracks entity health states
	 */
	teleport(posVector) {
		this.position.copy(posVector);
		this.velocity.set(0, 0, 0);
		this.onGround = false;
		this.isDead = false;
	}

	/**
	 * Main simulation tick. Chops arbitrary frame deltas into stable micro-steps (pmove_fixed execution style)
	 */
	update(wishDir, cmdJump, deltaTime) {
		if(this.isDead) return this.position;

		// Prevent frame drops from causing massive physics tunneling slips
		let timeRemaining = Math.min(deltaTime, 0.1);
		const fixedSliceStep = 0.008; // Simulate steady ~125Hz simulation ticks

		while(timeRemaining > 0) {
			const dt = Math.min(timeRemaining, fixedSliceStep);
			this._singleStepSimulate(wishDir, cmdJump, dt);
			timeRemaining -= dt;
		}

		return this.position;
	}

	_singleStepSimulate(wishDir, cmdJump, dt) {
		// 1. Structural Ground Trace Verification Pass
		this._performGroundTrace();

		// 2. Core Air vs Ground Friction Pipelines
		if(this.walking) {
			this._applyFriction(dt);
			this._walkMove(wishDir, cmdJump, dt);
		} else {
			this._airMove(wishDir, dt);
		}

		// 3. Re-evaluate post-movement ground alignment
		this._performGroundTrace();
	}

	_performGroundTrace() {
		const checkPoint = this.position.clone();
		checkPoint.y -= 0.25; // Standard drop-check offset distance

		// Query our BSP bounding collision layer trace method
		const trace = this.bsp.trace(this.position, checkPoint, this.playerRadius);
		this.groundTrace = trace;

		// Check for Kill Brush Surface/Content Flags
		if(trace.fraction < 1.0 && trace.surfaceFlags) {
			// Check if surface contains no damage protection or matches hazard content bits
			const SURF_NODAMAGE = 0x00000004; // Standard Q3 surface bit flag definitions
			if(trace.surfaceFlags & SURF_NODAMAGE || trace.contents & 0x40000000) {
				this._handlePlayerDeath();
				return;
			}
		}

		if(trace.allSolid || trace.fraction === 1.0) {
			this.onGround = false;
			this.walking = false;
			return;
		}

		// Check if player is upwardly airborne from jump velocity or explosion knocks
		if(this.velocity.y > 0 && this.velocity.dot(trace.plane.normal) > 10) {
			this.onGround = false;
			this.walking = false;
			return;
		}

		// Check for steep slopes
		if(trace.plane.normal.y < this.minWalkNormalZ) {
			this.onGround = false;
			this.walking = true; // Slideable steep plane properties toggle
			return;
		}

		this.onGround = true;
		this.walking = true;
	}

	_applyFriction(dt) {
		const velFlat = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
		const speed = velFlat.length();

		if(speed < 1.0) {
			this.velocity.x = 0;
			this.velocity.z = 0;
			return;
		}

		const control = speed < this.stopSpeed ? this.stopSpeed : speed;
		const drop = control * this.frictionCoefficient * dt;

		let newSpeed = speed - drop;
		if(newSpeed < 0) newSpeed = 0;
		newSpeed /= speed;

		this.velocity.x *= newSpeed;
		this.velocity.z *= newSpeed;
	}

	_accelerate(wishDir, wishSpeed, accel, dt) {
		const currentSpeed = this.velocity.dot(wishDir);
		const addSpeed = wishSpeed - currentSpeed;

		if(addSpeed <= 0) return;

		let accelSpeed = accel * dt * wishSpeed;
		if(accelSpeed > addSpeed) accelSpeed = addSpeed;

		this.velocity.addScaledVector(wishDir, accelSpeed);
	}

	_walkMove(wishDir, cmdJump, dt) {
		// Evaluate jump commands prior to calculating planar walk updates
		if(cmdJump && this.onGround) {
			this.onGround = false;
			this.walking = false;
			this.velocity.y = this.jumpVelocity;
			return;
		}

		// Project moves to align cleanly alongside ground normals
		const forwardProj = new THREE.Vector3(wishDir.x, wishDir.y, wishDir.z).normalize();
		this._clipVelocity(forwardProj, this.groundTrace.plane.normal, forwardProj, this.overClip);
		forwardProj.normalize();

		const speed = wishDir.length() * 320.0; // Q3 Max running velocity scale
		this._accelerate(forwardProj, speed, this.accelerateSpeed, dt);

		// Slide parallel safely against ground curves
		this._clipVelocity(this.velocity, this.groundTrace.plane.normal, this.velocity, this.overClip);

		if(this.velocity.x === 0 && this.velocity.z === 0) return;

		this._stepSlideMove(false, dt);
	}

	_airMove(wishDir, dt) {
		// Lock velocity components directly on flat planes for strafe evaluations
		const flatWish = new THREE.Vector3(wishDir.x, 0, wishDir.z).normalize();
		const speed = flatWish.length() * 320.0;

		// Air acceleration calculations use airAccelerate profiles to avoid strafe constraints
		this._accelerate(flatWish, speed, this.airAccelerateSpeed, dt);

		if(this.groundTrace && this.groundTrace.plane) {
			this._clipVelocity(this.velocity, this.groundTrace.plane.normal, this.velocity, this.overClip);
		}

		this._stepSlideMove(true, dt);
	}

	_slideMove(gravityActive, dt) {
		const numBumps = 4;
		const planes = [];

		const endVelocity = this.velocity.clone();
		if(gravityActive) {
			endVelocity.y -= this.gravityMagnitude * dt;
			this.velocity.y = (this.velocity.y + endVelocity.y) * 0.5;

			if(this.groundTrace && this.groundTrace.plane) {
				this._clipVelocity(this.velocity, this.groundTrace.plane.normal, this.velocity, this.overClip);
			}
		}

		if(this.groundTrace && this.groundTrace.plane) {
			planes.push(this.groundTrace.plane.normal.clone());
		}
		planes.push(this.velocity.clone().normalize());

		let timeLeft = dt;
		const endPos = new THREE.Vector3();

		for(let bump = 0; bump < numBumps; bump++) {
			endPos.addVectors(this.position, this.velocity.clone().multiplyScalar(timeLeft));

			const trace = this.bsp.trace(this.position, endPos, this.playerRadius);

			if(trace.allSolid) {
				this.velocity.y = 0;
				return true; // Completely wedged, halt evaluation updates
			}

			if(trace.fraction > 0) {
				this.position.copy(trace.endPos);
			}

			if(trace.fraction === 1.0) break; // Finished distance successfully

			timeLeft -= timeLeft * trace.fraction;
			planes.push(trace.plane.normal.clone());

			// Slide against intersecting plane layers (crease intersection checking loop)
			let i = 0;
			for(i = 0; i < planes.length; i++) {
				if(this.velocity.dot(planes[i]) >= 0.1) continue;

				const clipVel = new THREE.Vector3();
				const clipEndVel = new THREE.Vector3();
				this._clipVelocity(this.velocity, planes[i], clipVel, this.overClip);
				this._clipVelocity(endVelocity, planes[i], clipEndVel, this.overClip);

				// Secondary plane collision check
				let j = 0;
				for(j = 0; j < planes.length; j++) {
					if(i === j) continue;
					if(clipVel.dot(planes[j]) >= 0.1) continue;

					this._clipVelocity(clipVel, planes[j], clipVel, this.overClip);
					this._clipVelocity(clipEndVel, planes[j], clipEndVel, this.overClip);

					if(clipVel.dot(planes[i]) >= 0) continue;

					// Crease vector generation via Cross products
					const creaseDir = new THREE.Vector3().crossVectors(planes[i], planes[j]).normalize();
					let d = this.velocity.dot(creaseDir);
					clipVel.copy(creaseDir).multiplyScalar(d);

					const creaseEndDir = new THREE.Vector3().crossVectors(planes[i], planes[j]).normalize();
					d = endVelocity.dot(creaseEndDir);
					clipEndVel.copy(creaseEndDir).multiplyScalar(d);

					// Third plane intersection safety lock
					for(let k = 0; k < planes.length; k++) {
						if(k === i || k === j) continue;
						if(clipVel.dot(planes[k]) >= 0.1) continue;

						this.velocity.set(0, 0, 0);
						return true;
					}
				}

				this.velocity.copy(clipVel);
				endVelocity.copy(clipEndVel);
				break;
			}
		}

		if(gravityActive) {
			this.velocity.copy(endVelocity);
		}

		return true;
	}

	_stepSlideMove(gravityActive, dt) {
		const startOrigin = this.position.clone();
		const startVelocity = this.velocity.clone();

		// 1. Perform primary horizontal translation slide step evaluation
		this._slideMove(gravityActive, dt);

		const downOrigin = this.position.clone();
		const downVelocity = this.velocity.clone();

		// 2. Re-evaluate using steps from original starting configuration
		const upTarget = startOrigin.clone();
		upTarget.y += this.stepSizeHeight;

		const upTrace = this.bsp.trace(startOrigin, upTarget, this.playerRadius);
		if(upTrace.allSolid) return; // Overhead ceiling obstruction prevents stepping up

		const actualStepHeight = upTrace.endPos.y - startOrigin.y;
		this.position.copy(upTrace.endPos);
		this.velocity.copy(startVelocity);

		this._slideMove(gravityActive, dt);

		// 3. Project down target path following step traversal
		const downTarget = this.position.clone();
		downTarget.y -= actualStepHeight;

		const downTrace = this.bsp.trace(this.position, downTarget, this.playerRadius);
		if(!downTrace.allSolid) {
			this.position.copy(downTrace.endPos);
		}

		// Compare results: check if stepping yielded better forward translation than sliding flat
		if(downTrace.fraction < 1.0) {
			this._clipVelocity(this.velocity, downTrace.plane.normal, this.velocity, this.overClip);
		}

		const slideDistSq = new THREE.Vector3().subVectors(downOrigin, startOrigin).setComponent(1, 0).lengthSq();
		const stepDistSq = new THREE.Vector3().subVectors(this.position, startOrigin).setComponent(1, 0).lengthSq();

		if(slideDistSq > stepDistSq) {
			// Sliding flat was more efficient; discard step operations and revert metrics
			this.position.copy(downOrigin);
			this.velocity.copy(downVelocity);
		}
	}

	_clipVelocity(inVel, normal, outVel, overbounce) {
		let backoff = inVel.dot(normal);
		if(backoff < 0) {
			backoff *= overbounce;
		} else {
			backoff /= overbounce;
		}
		outVel.copy(inVel).addScaledVector(normal, -backoff);
	}

	_handlePlayerDeath() {
		this.isDead = true;
		this.velocity.set(0, 0, 0);
		console.log("Q3MovementProcessor: Player touched kill brush geometry volume bounds.");

		if(typeof this.onPlayerKilled === 'function') {
			this.onPlayerKilled();
		}
	}
}
