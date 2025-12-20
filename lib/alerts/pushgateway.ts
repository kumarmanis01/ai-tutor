import { Registry, Pushgateway } from 'prom-client';
import client from 'prom-client';

const gatewayUrl = process.env.PUSHGATEWAY_URL;

export async function pushMetricsOnce() {
  if (!gatewayUrl) return;
  try {
    const pg = new Pushgateway(gatewayUrl);
    const registry = client.register as unknown as Registry;
    await new Promise<void>((res, rej) => {
      pg.pushAdd({ jobName: 'alert-evaluator', registry }, (err) => {
        if (err) return rej(err);
        res();
      });
    });
  } catch (e) {
    // swallow — pushgateway is optional
  }
}

export default pushMetricsOnce;
