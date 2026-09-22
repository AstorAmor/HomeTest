export async function POST(request: Request) {
  const body = await request.json();
  const cycleStarts: string[] = body.cycle_starts ?? [];

  const windmillUrl = process.env.WINDMILL_URL;
  const workspace = process.env.WINDMILL_WORKSPACE;
  const token = process.env.WINDMILL_TOKEN;

  if (!windmillUrl || !workspace || !token) {
    return Response.json(
      { error: 'Windmill no está configurado en el servidor (.env.local)' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${windmillUrl}/api/w/${workspace}/jobs/run_wait_result/p/u/admin/predict_cycle`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cycle_starts: cycleStarts }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: `Windmill error (${response.status}): ${JSON.stringify(data)}` },
        { status: 502 }
      );
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error calling Windmill' },
      { status: 500 }
    );
  }
}
