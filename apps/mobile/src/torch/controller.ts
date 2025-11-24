export type TorchState = 'on' | 'off';

type TorchController = (state: TorchState) => Promise<void>;

let controller: TorchController | null = null;

export function registerTorchController(fn: TorchController | null) {
  controller = fn;
}

export async function requestTorchState(state: TorchState) {
  if (!controller) {
    throw new Error('torch controller unavailable');
  }
  await controller(state);
}

export function hasTorchController() {
  return controller !== null;
}

