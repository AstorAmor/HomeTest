import { createMetricRepository } from './metricRepository';
import { CycleEntry } from '@/types/cycle';

const STORAGE_KEY = 'hometest:cycle_entries';

export const cycleRepository = createMetricRepository<CycleEntry>(STORAGE_KEY);
