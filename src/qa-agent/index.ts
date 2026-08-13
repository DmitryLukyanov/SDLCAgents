import * as core from "@actions/core";
import { prepare } from "./prepare";
import { publish } from "./publish";
import { validate } from "./validate";

async function run(): Promise<void> {
  const step = core.getInput("step", { required: true });

  if (step === "prepare") {
    await prepare();
    return;
  }

  if (step === "validate") {
    validate();
    return;
  }

  if (step === "publish") {
    await publish();
    return;
  }

  throw new Error(`Unknown step: ${step}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
