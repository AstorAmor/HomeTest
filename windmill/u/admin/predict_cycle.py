import statistics
from datetime import datetime, timedelta


def main(cycle_starts: list[str]):
    """
    cycle_starts: lista de fechas ISO (YYYY-MM-DD) del primer dia de cada
    ciclo registrado, en cualquier orden. Devuelve la prediccion del
    proximo inicio de ciclo usando mediana de duracion + ventana de
    incertidumbre basada en desviacion estandar (acotada 2-7 dias).

    Metodo basado en el enfoque de trackers open-source (ej.
    keo571/period-tracker): sin ML, deterministico, mejora con mas datos.
    """
    if len(cycle_starts) < 2:
        return {
            "error": "Se necesitan al menos 2 ciclos registrados para predecir",
            "cycles_logged": len(cycle_starts),
        }

    dates = sorted(datetime.fromisoformat(d[:10]) for d in cycle_starts)

    # Duracion de cada ciclo = diferencia entre inicios consecutivos
    lengths = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

    # Usar como maximo los ultimos 6 ciclos (los mas recientes pesan mas)
    recent_lengths = lengths[-6:]

    median_length = statistics.median(recent_lengths)
    avg_length = statistics.mean(recent_lengths)
    std_dev = statistics.pstdev(recent_lengths) if len(recent_lengths) > 1 else 0

    # Ventana de incertidumbre acotada entre 2 y 7 dias
    window_days = max(2, min(7, round(std_dev)))

    last_start = dates[-1]
    predicted_next = last_start + timedelta(days=round(median_length))

    today = datetime.now()
    days_since_predicted = (today - predicted_next).days
    is_late = days_since_predicted > window_days

    n = len(recent_lengths)
    if n < 3:
        confidence = "low"
    elif n < 5:
        confidence = "medium"
    else:
        confidence = "high"

    return {
        "predicted_next_start": predicted_next.strftime("%Y-%m-%d"),
        "window_days": window_days,
        "median_cycle_length": median_length,
        "avg_cycle_length": round(avg_length, 1),
        "std_dev_days": round(std_dev, 1),
        "cycles_used": n,
        "cycles_logged": len(dates),
        "confidence": confidence,
        "is_late": is_late,
        "days_late": max(0, days_since_predicted) if is_late else 0,
    }
