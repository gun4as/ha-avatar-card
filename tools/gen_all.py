"""Ģenerē visu avatāru klipus vienā reizē (modelis ielādējas vienreiz).

python gen_all.py [vārds ...]   — bez argumentiem: visi; izvade D:\\ai\\Wan2GP\\outputs\\<vārds>_<idle|talk>.mp4
"""
import sys
from pathlib import Path

ROOT = Path(r"D:\ai\Wan2GP")
HERE = Path(r"D:\ai\avatar")
sys.path.insert(0, str(ROOT))

from shared.api import init  # noqa: E402

LIGHTX2V = {
    "activated_loras": ["https://huggingface.co/DeepBeepMeep/Wan2.1/resolve/main/loras_accelerators/Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64.safetensors"],
    "loras_multipliers": "1",
    "num_inference_steps": 4,
    "guidance_phases": 1,
    "guidance_scale": 1,
    "alt_guidance_scale": 1,
    "audio_guidance_scale": 1,
}

ROOM = "futuristic smart home interior with glowing ceiling lights and floating holographic displays in the background"
FACES = {
    "virietis": ("A friendly middle-aged man with short dark hair and a grey stubble beard, wearing a dark polo shirt", "nils.mp3"),
    "sieviete": ("A friendly middle-aged woman with shoulder-length dark hair, wearing a dark polo shirt", "everita.mp3"),
    "elfs": ("A cheerful forest elf man with messy green hair with leaves and twigs, pointy ears and a red nose, wearing a dark polo shirt", "nils.mp3"),
    "elfe": ("A cheerful forest elf woman with long green braided hair with leaves and pine cones, pointy ears, wearing a dark polo shirt", "everita.mp3"),
    "robots": ("A friendly white humanoid robot with a black glass visor face showing glowing blue eyes and a glowing wave mouth", "nils.mp3"),
    "pilsetniece": ("A friendly woman with shoulder-length dark wavy hair and a small earbud, wearing a dark jacket, blurred night city lights behind her", "everita.mp3"),
    "holovirietis": ("A friendly glowing translucent hologram of a man made of cyan light and sparkling particles, wearing a dark polo shirt", "nils.mp3"),
    "holosieviete": ("A friendly glowing translucent hologram of a woman with long flowing hair made of cyan light and sparkling particles, wearing a dark polo shirt", "everita.mp3"),
}


def job(name, kind):
    who, voice = FACES[name]
    room = "softly blurred background" if "city" in who else ROOM  # pilsētas bildēm fons jau aprakstīts
    if kind == "talk":
        prompt = (f"{who} talks calmly and friendly to the camera, natural lip movement, small natural head movements, "
                  f"occasional blinking, head and shoulders shot, static camera, {room}.")
        audio, length, seed = HERE / voice, "10.6s", 42
    else:
        prompt = (f"{who} listens silently and looks at the camera, mouth closed, slight friendly smile, natural blinking, "
                  f"very small head movements, head and shoulders shot, static camera, {room}.")
        audio, length, seed = HERE / "klusums-8s.wav", "6s", 7
    img = str(HERE / "faces" / f"{name}.jpg")
    return {
        "prompt": prompt,
        "image_prompt_type": "S",
        "image_start": img,
        "image_refs": [img],
        "audio_prompt_type": "A",
        "audio_guide": str(audio),
        "resolution": "512x512",
        "video_length": length,
        "seed": seed,
        "output_filename": f"{name}_{kind}",
    }


def main():
    names = sys.argv[1:] or list(FACES)
    out = sys.__stdout__  # WanGP pārtver sys.stdout — rakstām tieši konsolē

    def log(msg):
        out.write(msg + "\n")
        out.flush()

    session = init(root=ROOT, cli_args=["--attention", "sage2", "--profile", "4"])
    defaults = session.get_default_settings("infinitetalk")
    failed = 0
    for name in names:
        for kind in ("idle", "talk"):
            settings = dict(defaults)
            settings.update(LIGHTX2V)
            settings.update(job(name, kind))
            log(f"=== {name} {kind}")
            result = session.submit_task(settings).result()
            if result.success:
                log(f"OK {name} {kind} {result.generated_files[-1]}")
            else:
                failed += 1
                for e in result.errors:
                    log(f"ERROR {name} {kind} {e.message}")
    log(f"DONE failed={failed}")


if __name__ == "__main__":
    main()
