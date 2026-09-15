import Constants from 'expo-constants';

export function getApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri}`;
  }
  // Fallback para web, donde el origin ya es correcto
  return '';
}
