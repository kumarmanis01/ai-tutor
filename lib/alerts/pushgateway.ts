import client from 'prom-client';

const gatewayUrl = process.env.PUSHGATEWAY_URL;

export async function pushMetricsOnce(): Promise<void> {
  if (!gatewayUrl) return;
  try {
    const Pushgateway = (client as any).Pushgateway;
    if (!Pushgateway) return;
    const pg = new Pushgateway(gatewayUrl);
    const registry = (client as any).register;
    await new Promise<void>((res, rej) => {
      pg.pushAdd({ jobName: 'alert-evaluator', registry }, (err: any) => {
        if (err) return rej(err);
        res();
      });
    });
  } catch {
    // swallow — pushgateway is optional
  }
}

export default pushMetricsOnce;
