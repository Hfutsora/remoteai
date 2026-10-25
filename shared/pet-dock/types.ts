export type PetDockState = 'disabled' | 'waitingForCodex' | 'waitingForPet'
  | 'active' | 'unavailable' | 'unsupported';

export interface PetDockStatus {
  enabled: boolean;
  state: PetDockState;
}

export interface PetDockApi {
  load: () => Promise<PetDockStatus>;
  save: (enabled: boolean) => Promise<PetDockStatus>;
}
