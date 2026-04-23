import test from "node:test";
import assert from "node:assert/strict";
import {
  ModuleExecutionConcurrencyController,
} from "../../src/modules/shared/module-execution-concurrency-controller.ts";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

test("module execution concurrency controller queues work when a module limit is exhausted", async () => {
  const controller = new ModuleExecutionConcurrencyController({
    limits: {
      global: 2,
      screening: 2,
      editing: 1,
      proofreading: 1,
    },
  });
  const releaseFirst = createDeferred<void>();
  const firstStarted = createDeferred<void>();
  const secondStarted = createDeferred<void>();
  const started: string[] = [];

  const first = controller.run({
    module: "proofreading",
    task: async () => {
      started.push("first");
      firstStarted.resolve();
      await releaseFirst.promise;
      return "first-complete";
    },
  });

  await firstStarted.promise;

  const second = controller.run({
    module: "proofreading",
    task: async () => {
      started.push("second");
      secondStarted.resolve();
      return "second-complete";
    },
  });

  await Promise.resolve();

  assert.deepEqual(started, ["first"]);
  assert.deepEqual(controller.getSnapshot(), {
    active: {
      global: 1,
      screening: 0,
      editing: 0,
      proofreading: 1,
    },
    queued: {
      global: 1,
      screening: 0,
      editing: 0,
      proofreading: 1,
    },
    limits: {
      global: 2,
      screening: 2,
      editing: 1,
      proofreading: 1,
    },
  });

  releaseFirst.resolve();

  assert.equal(await first, "first-complete");
  await secondStarted.promise;
  assert.equal(await second, "second-complete");
  assert.deepEqual(started, ["first", "second"]);
}
);

test("module execution concurrency controller enforces the global limit across modules", async () => {
  const controller = new ModuleExecutionConcurrencyController({
    limits: {
      global: 1,
      screening: 1,
      editing: 1,
      proofreading: 1,
    },
  });
  const releaseFirst = createDeferred<void>();
  const firstStarted = createDeferred<void>();
  const secondStarted = createDeferred<void>();
  const started: string[] = [];

  const first = controller.run({
    module: "screening",
    task: async () => {
      started.push("screening");
      firstStarted.resolve();
      await releaseFirst.promise;
      return "screening-complete";
    },
  });

  await firstStarted.promise;

  const second = controller.run({
    module: "editing",
    task: async () => {
      started.push("editing");
      secondStarted.resolve();
      return "editing-complete";
    },
  });

  await Promise.resolve();

  assert.deepEqual(started, ["screening"]);
  assert.deepEqual(controller.getSnapshot(), {
    active: {
      global: 1,
      screening: 1,
      editing: 0,
      proofreading: 0,
    },
    queued: {
      global: 1,
      screening: 0,
      editing: 1,
      proofreading: 0,
    },
    limits: {
      global: 1,
      screening: 1,
      editing: 1,
      proofreading: 1,
    },
  });

  releaseFirst.resolve();

  assert.equal(await first, "screening-complete");
  await secondStarted.promise;
  assert.equal(await second, "editing-complete");
  assert.deepEqual(started, ["screening", "editing"]);
}
);
