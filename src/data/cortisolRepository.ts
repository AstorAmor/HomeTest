import { createMetricRepository } from './metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const STORAGE_KEY = 'hometest:cortisol_entries';

export const cortisolRepository = createMetricRepository<SimpleMetricEntry>(STORAGE_KEY);
