# ArBrush

ArBrush is a simple desktop app (Electron + Python) that lets you draw in the air using your hand in front of a webcam.  
Hand tracking is powered by MediaPipe Hands (JS).

## How it works
- **Pinch (index + thumb together)** — draw a line.  
- **Fist** — erase an area under your hand.  
- Video is mirrored for natural interaction.  
- You can adjust stroke thickness and save your drawing as PNG.

## Purpose
This project demonstrates how to combine **hand gesture tracking (MediaPipe)** with an **Electron interface** and a lightweight **Python server** for saving images. It serves as a foundation for more advanced gesture-controlled interactive apps.
