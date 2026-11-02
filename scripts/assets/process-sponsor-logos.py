"""Padroniza os logos de patrocinadores do CIEPS em grafite, sem fundo.

Uso:
  python3 -I scripts/assets/process-sponsor-logos.py <pasta LOGOS extraída> [saida]

Saída padrão: public/cieps/patrocinadores/<cota>/<slug>.png
Também grava app/(unauth)/sponsors.generated.json com as dimensões finais.
"""
import json
import os
import re
import sys
import unicodedata

import numpy as np
from PIL import Image

INK = (31, 31, 31)
MAX_H = 600
PAD = 0.04

# modos: split = painel escuro + fundo claro lado a lado; dark = conteúdo escuro; light = conteúdo claro sobre transparente;
# darkbg = conteúdo claro sobre fundo escuro opaco; solid = usa só a silhueta (alpha)
# (cota, pasta, arquivo, slug, nome, modo)
# Medgrupo (master) é vetorizado à parte: scripts/assets/vectorize-logo.py -> master/medgrupo.svg
LOGOS = [
    ("apoio", "5 - DIAMANTE - LOGO EM DESTAQUE", "Logo HUSF_page-0001 1.png", "husf", "Hospital Universitário Sagrada Família", "dark"),
    ("diamante", "5 - DIAMANTE - LOGO EM DESTAQUE", "Logo Eliza Cardoso Buffet_page-0003 1.png", "eliza-cardoso", "Eliza Cardoso Serviço de Buffet", "dark"),
    ("ouro", "4 - OURO - LOGO GRANDE", "Ativo 20 1.png", "proformat", "Proformat Fotografias", "light"),
    ("ouro", "4 - OURO - LOGO GRANDE", "Café Vasconcelos - Logos_page-0001 1.png", "cafe-vasconcelos", "Café Vasconcelos", "dark"),
    ("ouro", "4 - OURO - LOGO GRANDE", "LOGO-TOPWAY-preta 1.png", "topway", "Topway Nutrition", "dark"),
    ("ouro", "4 - OURO - LOGO GRANDE", "Logo_GM_Completa_sem_fundo_page-0001 1.png", "guarana-mineiro", "Guaraná Mineiro", "dark"),
    ("ouro", "4 - OURO - LOGO GRANDE", "Q.imagens azul empresas 1.png", "q-imagem", "Q.imagem Filmes", "split"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "IDV ÉDEN (2)_page-0001 1.png", "eden", "Éden Estética e Bem-Estar", "darkbg"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "IMG_5897 1.png", "medcor-cematri", "Medcor Cursos e Cematri", "dark"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "LOGO PALÁCIO DE CRISTAL 1.png", "palacio-de-cristal", "Palácio de Cristal", "solid"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "LOGO UNICRED_page-0001 1.png", "unicred", "Unicred", "dark"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "Logo - Smart Fluency 1.png", "smart-fluency", "Smart Fluency", "dark"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "logo 1_page-0001 2.png", "ana-godoi", "Ana Godoi Decoração", "light"),
    ("prata", "3 - PRATA - LOGO MÉDIA", "logo escura_page-0001 1.png", "cafe-da-ana", "Café da Ana", "dark"),
    ("bronze", "2 - BRONZE - LOGO MENOR", "36C60A62-8D92-4D57-AA15-F6120CFFA048 1.png", "cremiatta", "Cremiatta Sorvetes e Açaí", "dark"),
    ("bronze", "2 - BRONZE - LOGO MENOR", "PHOTO-2026-10-19-10-55-31 1.png", "grupo-fuerza", "Grupo Fuerza", "dark"),
    ("bronze", "2 - BRONZE - LOGO MENOR", "Unimed-araguari_box-pinheiro_page-0001 1.png", "unimed-araguari", "Unimed Araguari", "dark"),
    ("bronze", "2 - BRONZE - LOGO MENOR", "logo pdf_page-0001 1.png", "livraria-phl", "Livraria PHL", "dark"),
    ("apoio", "1 - APOIO", "IMG_1094 1.png", "prefeitura-araguari", "Prefeitura de Araguari", "dark"),
    ("apoio", "1 - APOIO", "ABMLPM 2022 1.png", "abmlpm", "ABMLPM", "dark"),
    ("apoio", "1 - APOIO", "Logo ABN CE MG_Negativo 1.png", "abn-mg", "Academia Brasileira de Neurologia - MG", "light"),
]


def _norm(name):
    # o unzip pode trocar acentos por #U00e9 e o macOS usa NFD
    name = re.sub(r"#U([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), name)
    return unicodedata.normalize("NFC", name)


def find(root, folder, fname):
    def pick(base, wanted):
        for entry in os.listdir(base):
            if _norm(entry) == _norm(wanted):
                return os.path.join(base, entry)
        raise FileNotFoundError(os.path.join(base, wanted))

    return pick(pick(root, folder), fname)


def to_alpha(img, mode):
    a = np.asarray(img.convert("RGBA")).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    border = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
    if mode == "dark":
        # fundo opaco quase branco (ex.: #f9f9f9) também some
        bg = float(np.median(border)) if alpha[0, 0] > 0.9 else 1.0
        out = alpha * np.clip((bg - lum) / max(bg, 1e-3), 0, 1)
    elif mode == "light":
        out = alpha * lum
    elif mode == "darkbg":
        bg = float(np.median(border))
        out = np.clip((lum - bg) / max(1 - bg, 1e-3), 0, 1) * alpha
    elif mode == "split":
        # painel escuro à esquerda (símbolo claro) + fundo claro à direita (texto escuro)
        cut = int(lum.shape[1] * 0.2815)
        left, right = lum[:, :cut], lum[:, cut:]
        bl = float(np.median(left[:, :4]))
        br = float(np.median(right[:, -4:]))
        out = np.concatenate([
            np.clip((left - bl) / max(1 - bl, 1e-3), 0, 1),
            np.clip((br - right) / max(br, 1e-3), 0, 1),
        ], axis=1) * alpha
        out[:, max(cut - 4, 0):cut + 4] = 0  # emenda entre os dois painéis
    elif mode == "solid":
        out = alpha
    else:
        raise ValueError(mode)
    nz = out[out > 0.04]
    if nz.size and mode != "solid":
        out = np.clip(out / max(np.percentile(nz, 98), 1e-3), 0, 1)
    return out


def process(src, mode):
    img = Image.open(src)
    alpha = to_alpha(img, mode)
    h, w = alpha.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = INK
    out[..., 3] = (alpha * 255).astype(np.uint8)
    res = Image.fromarray(out, "RGBA")
    bbox = Image.fromarray(out[..., 3]).point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox:
        res = res.crop(bbox)
    px, py = int(res.width * PAD), int(res.height * PAD)
    canvas = Image.new("RGBA", (res.width + 2 * px, res.height + 2 * py), INK + (0,))
    canvas.paste(res, (px, py))
    if canvas.height > MAX_H:
        ratio = MAX_H / canvas.height
        canvas = canvas.resize((round(canvas.width * ratio), MAX_H), Image.LANCZOS)
    return canvas


def main():
    src_root = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out_root = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, "public/cieps/patrocinadores")
    meta = []
    for tier, folder, fname, slug, name, mode in LOGOS:
        path = find(src_root, folder, fname)
        res = process(path, mode)
        d = os.path.join(out_root, tier)
        os.makedirs(d, exist_ok=True)
        res.save(os.path.join(d, slug + ".png"), optimize=True)
        meta.append({"tier": tier, "slug": slug, "name": name, "w": res.width, "h": res.height})
        print(tier, slug, res.size)
    with open(os.path.join(out_root, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
