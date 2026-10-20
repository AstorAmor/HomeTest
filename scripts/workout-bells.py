"""Timbres del entrenamiento: suenan al acabar la cuenta atrás (descanso, ejercicio por tiempo y
cambio de lado). Se sintetizan aquí para no depender de sonidos con licencia de terceros.

    python scripts/workout-bells.py

Escribe assets/sounds/kuova_*.wav (mono, 22,05 kHz, 16 bits). Los mismos ficheros van en la APK
(plugin expo-notifications, `sounds` en app.json) para que suenen con la pantalla bloqueada: si
cambias o añades uno, hace falta una APK nueva para el aviso con la pantalla bloqueada (en la
app abierta basta con una actualización). Los nombres solo pueden llevar minúsculas, números y _.
"""

from pathlib import Path
import wave

import numpy as np

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds)) / RATE


def strike(seconds: float, partials: list[tuple[float, float, float]], attack: float = 0.004) -> np.ndarray:
    """Golpe de campana: (frecuencia Hz, amplitud, tiempo de caída s) por parcial."""
    t = t_axis(seconds)
    out = np.zeros_like(t)
    for freq, amp, decay in partials:
        out += amp * np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)
    env = np.minimum(1.0, t / attack)  # sin clic al empezar
    return out * env


def place(total: float, pieces: list[tuple[float, np.ndarray]]) -> np.ndarray:
    out = np.zeros(int(RATE * total))
    for at, sig in pieces:
        i = int(RATE * at)
        n = min(len(sig), len(out) - i)
        out[i : i + n] += sig[:n]
    return out


def fade_out(sig: np.ndarray, seconds: float = 0.08) -> np.ndarray:
    n = int(RATE * seconds)
    sig[-n:] *= np.linspace(1.0, 0.0, n)
    return sig


def write(name: str, sig: np.ndarray, peak: float = 0.89) -> None:
    sig = fade_out(sig / np.max(np.abs(sig)) * peak)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((sig * 32767).astype("<i2").tobytes())
    print(f"{name}.wav  {len(sig) / RATE:.1f} s")


# Campana: campanilla de mano clara (parciales inarmónicos de campana, base 880 Hz)
f = 880.0
write(
    "kuova_campana",
    strike(
        2.2,
        [
            (f * 0.5, 0.25, 1.4),
            (f, 1.0, 1.1),
            (f * 1.19, 0.45, 0.8),
            (f * 1.5, 0.35, 0.7),
            (f * 2.0, 0.4, 0.5),
            (f * 2.52, 0.2, 0.35),
            (f * 3.01, 0.12, 0.25),
        ],
    ),
)

# Cuenco: grave y largo, con el batido suave de dos modos casi iguales
f = 330.0
write(
    "kuova_cuenco",
    strike(
        3.2,
        [
            (f, 1.0, 1.8),
            (f * 1.004, 0.6, 1.8),
            (f * 2.71, 0.45, 1.1),
            (f * 2.715, 0.3, 1.1),
            (f * 5.15, 0.15, 0.6),
        ],
        attack=0.012,
    ),
)

# Tres toques: tres campanillas ascendentes, rápidas
def chime(freq: float) -> np.ndarray:
    return strike(0.9, [(freq, 1.0, 0.35), (freq * 2.0, 0.3, 0.2), (freq * 3.0, 0.1, 0.12)])


write("kuova_toques", place(1.5, [(0.0, chime(1318.5)), (0.2, chime(1568.0)), (0.4, chime(2093.0))]))


# Pitido: dos pitidos cortos de cronómetro
def beep(freq: float, seconds: float = 0.14) -> np.ndarray:
    t = t_axis(seconds)
    env = np.minimum(1.0, np.minimum(t / 0.006, (seconds - t) / 0.012))
    return np.sin(2 * np.pi * freq * t) * env + 0.15 * np.sin(2 * np.pi * freq * 2 * t) * env


write("kuova_pitido", place(0.6, [(0.0, beep(1760.0)), (0.24, beep(1760.0))]), peak=0.7)
