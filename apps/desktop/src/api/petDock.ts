import type { PetDockApi, PetDockStatus } from '../../../../shared/pet-dock/types';
import { hasLocalBackend, invoke } from './backend';

export const petDockApi: PetDockApi = {
  load: () => hasLocalBackend ? invoke<PetDockStatus>('get_pet_dock_status')
    : Promise.resolve({ enabled: false, state: 'unsupported' }),
  save: (enabled) => invoke<PetDockStatus>('set_pet_dock_enabled', { enabled }),
};
