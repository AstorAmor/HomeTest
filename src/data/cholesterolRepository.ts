import { createMetricRepository } from './metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const STORAGE_KEY = 'hometest:cholesterol_entries';

export const cholesterolRepository = createMetricRepository<SimpleMetricEntry>(STORAGE_KEY);
