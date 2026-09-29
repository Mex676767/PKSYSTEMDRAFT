import re
from kokoro_onnx import Kokoro
from misaki import zh
EN = {
 "lara": "lˈɑɹə", "lululemon": "lˈululˌɛmən", "get low": "ɡɛt lˈO", "alo": "ˈɑlO",
 "ceo": "sˌiˌiˈO", "heidi o'neill": "hˈIdi Onˈil", "chip wilson": "ʧˈɪp wˈɪlsən", "on": "ˈɔn",
}
def en_callable(t):
    words = t.strip().lower().split()
    out, i = [], 0
    while i < len(words):
        for j in range(len(words), i, -1):
            k = " ".join(words[i:j])
            if k in EN:
                out.append(EN[k]); i = j; break
        else:
            raise KeyError(f"no phonemes for English {words[i]!r} in {t!r}")
    return " ".join(out)
g2p = zh.ZHG2P(version="1.1", en_callable=en_callable)
kok = Kokoro("../voices/kokoro-v1.1-zh.onnx", "../voices/voices-v1.1-zh.bin", vocab_config="../voices/config-zh.json")
def synth(text, voice="zf_001", speed=1.0):
    ph, _ = g2p(text)
    s, sr = kok.create(ph, voice=voice, speed=speed, is_phonemes=True)
    return s, sr, ph
