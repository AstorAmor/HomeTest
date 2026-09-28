import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const STORAGE_KEY = 'hometest:cholesterol_entries';

export const cholesterolRepository = createMetricRepository<SimpleMetricEntry>(
  STORAGE_KEY,
  simpleMetricRemote('cholesterol_total')
);
