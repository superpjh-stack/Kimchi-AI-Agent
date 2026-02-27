// D6: GET /api/alerts/stream — SSE 실시간 알림 스트림
import { createSensorClient } from '@/lib/process/sensor-client';
import { checkAlerts } from '@/lib/process/alert-rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_INTERVAL = parseInt(process.env.SENSOR_POLL_INTERVAL ?? '30000', 10);

export async function GET(): Promise<Response> {
  const client = createSensorClient();
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (cancelled) return;
        try {
          const data = await client.getCurrentData();
          const alerts = checkAlerts(data);

          if (alerts.length > 0) {
            const payload = JSON.stringify({ type: 'alerts', alerts });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } else {
            // heartbeat — 연결 유지
            const hb = JSON.stringify({ type: 'heartbeat', timestamp: data.timestamp });
            controller.enqueue(encoder.encode(`data: ${hb}\n\n`));
          }
        } catch {
          if (!cancelled) {
            try {
              const errPayload = JSON.stringify({ type: 'error', message: '센서 데이터 조회 실패' });
              controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
            } catch { /* controller already closed */ }
          }
        }
      };

      await send();
      intervalId = setInterval(send, POLL_INTERVAL);
    },
    cancel() {
      cancelled = true;
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
