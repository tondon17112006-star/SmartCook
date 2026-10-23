export function getHealth() {
  return {
    status: 'ok',
    service: 'SmartCook API',
    timestamp: new Date().toISOString(),
  };
}
