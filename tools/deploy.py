"""Saspiež gatavos klipus cilpās (480², bez skaņas, gali sapludināti) un nokopē uz kartītes mapi un HA www.

python deploy.py — apstrādā visus <vārds>_<idle|talk>, kuriem ir gatavs WanGP rezultāts
"""
import re
import shutil
import subprocess
from pathlib import Path

OUT = Path(r"D:\ai\Wan2GP\outputs")
CARD = Path(r"C:\Users\Guntars\Desktop\lenovo\ha\avatar-card")
HA = Path(r"\\home2\config\www\avatar-card")
FADE = 0.5


def duration(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def main():
    # WanGP saglabā katru logu: name.mp4, name(2).mp4, ... — pēdējais (garākais) ir pilnais klips.
    finals = {}
    for p in OUT.glob("*_*.mp4"):
        m = re.fullmatch(r"(\w+_(?:idle|talk))(?:\((\d+)\))?\.mp4", p.name)
        if not m or m.group(1).startswith("avatar_"):  # avatar_* = pirmais (pilsētas) komplekts, jau gatavs
            continue
        key, n = m.group(1), int(m.group(2) or 1)
        if key not in finals or n > finals[key][0]:
            finals[key] = (n, p)
    for key, (_, src) in sorted(finals.items()):
        dst = CARD / f"{key}.mp4"
        if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
            continue
        d = duration(src)
        flt = (f"[0:v]split[a][b];[a]trim={FADE},setpts=PTS-STARTPTS[main];[b]trim=0:{FADE},setpts=PTS-STARTPTS[head];"
               f"[main][head]xfade=transition=fade:duration={FADE}:offset={d - 2 * FADE:.3f},scale=480:480,format=yuv420p[v]")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", flt, "-map", "[v]", "-an",
                        "-c:v", "libx264", "-profile:v", "main", "-crf", "25", "-preset", "slow", "-movflags", "+faststart",
                        str(dst)], check=True)
        shutil.copy2(dst, HA / dst.name)
        print(f"{key}: {d:.1f}s -> {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
