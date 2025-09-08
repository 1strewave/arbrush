import asyncio, json, os, base64
from datetime import datetime
import websockets

WS_HOST = os.getenv("WS_HOST", "127.0.0.1")
WS_PORT = int(os.getenv("WS_PORT", "9876"))

async def on_message(ws, msg):
    try:
        data = json.loads(msg)
    except:
        return
    t = data.get("type")
    if t == "hand":
        print(f"[hand] pinch={data.get('pinch_active')} erase={data.get('erase_active')} point={data.get('pinch_point')}")
    elif t == "save_png":
        data_url = data.get("data_url", "")
        if data_url.startswith("data:image/png;base64,"):
            raw = base64.b64decode(data_url.split(",", 1)[1])
            os.makedirs("captures", exist_ok=True)
            name = datetime.now().strftime("captures/draw_%Y%m%d_%H%M%S.png")
            with open(name, "wb") as f:
                f.write(raw)
            await ws.send(json.dumps({"type": "save_ok", "path": name}))
        else:
            await ws.send(json.dumps({"type": "save_err", "error": "bad_data_url"}))

async def handler(ws):
    async for msg in ws:
        await on_message(ws, msg)

async def main():
    async with websockets.serve(handler, WS_HOST, WS_PORT):
        print(f"WebSocket: ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
