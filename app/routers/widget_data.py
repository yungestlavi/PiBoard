"""Proxy lato server per i dati dei widget.

Il display gira in un browser e non puo' chiamare direttamente feed RSS/iCal o
API meteo esterne (CORS, e per non esporre nulla). Questi endpoint fanno il
fetch lato server con httpx e restituiscono JSON gia' pronto da disegnare.
Tutti sono tolleranti ai guasti: in caso di rete assente tornano un errore
morbido cosi' il widget mostra l'ultimo stato o un placeholder.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

import httpx
import recurring_ical_events
from fastapi import APIRouter, Query
from icalendar import Calendar

from ..config import settings

router = APIRouter(prefix="/api/widget-data", tags=["widget-data"])

# Codici meteo WMO -> (descrizione, emoji)
WMO = {
    0: ("Sereno", "☀️"), 1: ("Poco nuvoloso", "🌤️"), 2: ("Nuvoloso", "⛅"),
    3: ("Coperto", "☁️"), 45: ("Nebbia", "🌫️"), 48: ("Nebbia", "🌫️"),
    51: ("Pioviggine", "🌦️"), 53: ("Pioviggine", "🌦️"), 55: ("Pioviggine", "🌦️"),
    61: ("Pioggia", "🌧️"), 63: ("Pioggia", "🌧️"), 65: ("Pioggia forte", "🌧️"),
    71: ("Neve", "🌨️"), 73: ("Neve", "🌨️"), 75: ("Neve forte", "❄️"),
    80: ("Rovesci", "🌦️"), 81: ("Rovesci", "🌦️"), 82: ("Rovesci forti", "⛈️"),
    95: ("Temporale", "⛈️"), 96: ("Temporale", "⛈️"), 99: ("Temporale", "⛈️"),
}


@router.get("/weather")
async def weather(
    lat: float = Query(...), lon: float = Query(...), units: str = "metric"
):
    unit = "celsius" if units == "metric" else "fahrenheit"
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m"
        "&daily=temperature_2m_max,temperature_2m_min,weather_code"
        f"&forecast_days=4&temperature_unit={unit}&timezone=auto"
    )
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            cur = data["current"]
            daily = data.get("daily", {})
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    desc, icon = WMO.get(int(cur.get("weather_code", -1)), ("—", "🌡️"))
    sym = "°C" if units == "metric" else "°F"
    days_it = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
    forecast = []
    times = daily.get("time", []) or []
    for i in range(1, min(len(times), 4)):  # i giorni successivi a oggi
        d2, ic2 = WMO.get(int(daily["weather_code"][i]), ("—", "🌡️"))
        dt = datetime.fromisoformat(times[i])
        forecast.append({
            "day": days_it[dt.weekday()],
            "hi": round(daily["temperature_2m_max"][i]),
            "lo": round(daily["temperature_2m_min"][i]),
            "icon": ic2,
        })
    return {
        "ok": True,
        "temp": round(cur["temperature_2m"]),
        "unit": sym,
        "humidity": cur.get("relative_humidity_2m"),
        "wind": round(cur.get("wind_speed_10m", 0)),
        "hi": round(daily["temperature_2m_max"][0]) if times else None,
        "lo": round(daily["temperature_2m_min"][0]) if times else None,
        "desc": desc,
        "icon": icon,
        "forecast": forecast,
    }


@router.get("/geocode")
async def geocode(name: str = Query(...), country: str = "", count: int = 12):
    """Cerca una città (Open-Meteo geocoding). Filtra per Paese se indicato."""
    params = {"name": name, "count": max(count, 1), "language": "it", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            r = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search", params=params
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc), "results": []}

    out = []
    for res in (data.get("results") or []):
        if country and (res.get("country_code", "").upper() != country.upper()):
            continue
        out.append({
            "name": res.get("name"),
            "region": res.get("admin1") or res.get("admin2") or "",
            "country": res.get("country"),
            "country_code": res.get("country_code"),
            "lat": res.get("latitude"),
            "lon": res.get("longitude"),
        })
    return {"ok": True, "results": out}


@router.get("/rss")
async def rss(url: str = Query(...), limit: int = 8):
    try:
        async with httpx.AsyncClient(
            timeout=settings.http_timeout, follow_redirects=True
        ) as client:
            r = await client.get(url, headers={"User-Agent": "PiBoard/1.0"})
            r.raise_for_status()
            root = ET.fromstring(r.content)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "items": []}

    items = []
    # RSS 2.0: channel/item ; Atom: entry
    for node in root.iter():
        tag = node.tag.split("}")[-1]
        if tag in ("item", "entry"):
            title = link = ""
            for child in node:
                ctag = child.tag.split("}")[-1]
                if ctag == "title":
                    title = (child.text or "").strip()
                elif ctag == "link":
                    link = (child.text or child.get("href") or "").strip()
            if title:
                items.append({"title": title, "link": link})
        if len(items) >= limit:
            break
    return {"ok": True, "items": items[:limit]}


@router.get("/ical")
async def ical(url: str = Query(...), days: int = 60, limit: int = 30):
    """Scarica un calendario iCal (Google Calendar, Outlook, Apple…) ed espande
    anche gli eventi ricorrenti nella finestra richiesta."""
    try:
        async with httpx.AsyncClient(
            timeout=settings.http_timeout, follow_redirects=True
        ) as client:
            r = await client.get(url, headers={"User-Agent": "PiBoard/1.0"})
            r.raise_for_status()
            cal = Calendar.from_ical(r.content)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "events": []}

    start = date.today()
    end = start + timedelta(days=max(days, 1))
    try:
        occurrences = recurring_ical_events.of(cal).between(start, end)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "events": []}

    events = []
    for ev in occurrences:
        summary = str(ev.get("SUMMARY", "")).strip()
        dtstart = ev.get("DTSTART")
        if not summary or dtstart is None:
            continue
        val = dtstart.dt
        all_day = not isinstance(val, datetime)  # solo data => evento intera giornata
        events.append({
            "summary": summary,
            "start": val.isoformat(),
            "allDay": all_day,
            "location": str(ev.get("LOCATION", "")).strip(),
        })
    events.sort(key=lambda e: e["start"])
    return {"ok": True, "events": events[:limit]}
