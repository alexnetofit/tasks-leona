#!/usr/bin/env python3
"""
Analisa export do Notion + tarefas do Supabase, faz matching por título,
extrai descrição limpa do HTML e reporta o que será atualizado.

Uso:
    python3 scripts/analyze_notion.py             # só preview (não altera)
    python3 scripts/analyze_notion.py --apply     # aplica nas vazias + fracas
    python3 scripts/analyze_notion.py --apply --only-empty  # só nas vazias
    python3 scripts/analyze_notion.py --apply --overwrite   # sobrescreve TODAS
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup, Tag

NOTION_DIR = Path(
    "/Users/alexnetosoueu/Desktop/Private & Shared 2/Projeto 1M de MRR até Dezembro"
)


def load_env() -> dict:
    env: dict[str, str] = {}
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def normalize_title(s: str) -> str:
    """Normaliza título: lowercase, sem acentos, sem http(s)://, sem pontuação."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    # Remove esquemas que o Notion adicionou em links inline (ex: "Kie.ai" → "http://Kie.ai")
    s = re.sub(r"https?://", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Tags que mantemos (compatíveis com Tiptap StarterKit + Image + Link)
ALLOWED_TAGS = {
    "p", "br", "strong", "em", "s", "code",
    "h1", "h2", "h3",
    "ul", "ol", "li",
    "blockquote", "pre",
    "a", "img", "hr",
}

ALLOWED_ATTRS = {
    "a": ["href"],
    "img": ["src", "alt"],
}


def clean_node(node: Tag) -> None:
    if not isinstance(node, Tag):
        return
    for child in list(node.children):
        if isinstance(child, Tag):
            clean_node(child)
    keep = ALLOWED_ATTRS.get(node.name, [])
    for attr in list(node.attrs.keys()):
        if attr not in keep:
            del node.attrs[attr]


# Headings que aparecem no template padrão do Notion e são lixo
BOILERPLATE_HEADINGS = {
    "subtarefas", "arquivos de apoio", "anexos", "subtasks",
}

# Frase exata do template vazio
BOILERPLATE_PHRASES = {
    "inclua uma visao geral da tarefa e detalhes relacionados",
    "include an overview of the task and any relevant details",
}


def is_boilerplate_text(text: str) -> bool:
    norm = normalize_title(text)
    return norm in BOILERPLATE_PHRASES


def unwrap_or_remove(soup: BeautifulSoup) -> None:
    """Remove tags inúteis e desembrulha containers."""
    for el in soup.select(
        ".checkbox, .to-do-children-unchecked, .to-do-children-checked, .indented"
    ):
        el.decompose()

    for sel in [".properties", ".page-header-icon", ".page-title", ".page-description"]:
        for el in soup.select(sel):
            el.decompose()

    for el in soup.find_all("header"):
        el.decompose()

    # Remove figures problemáticos
    for fig in list(soup.find_all("figure")):
        text = fig.get_text(strip=True)
        href = ""
        a = fig.find("a")
        if a and a.has_attr("href"):
            href = a["href"]
        if (
            href.startswith("attachment:")
            or "notion.soundefined" in href
            or text.startswith("attachment:")
            or not text
        ):
            fig.decompose()

    # Remove links pra attachment
    for a in list(soup.find_all("a")):
        href = a.get("href", "")
        if href.startswith("attachment:") or "notion.soundefined" in href:
            a.unwrap()

    # Remove imagens problemáticas
    for img in list(soup.find_all("img")):
        src = img.get("src", "")
        if src.startswith("attachment:") or not src or "notion.so/icons/" in src:
            img.decompose()

    # Desembrulha divs e spans
    for div in list(soup.find_all("div")):
        div.unwrap()
    for span in list(soup.find_all("span")):
        span.unwrap()

    # Remove parágrafos que são só boilerplate
    for p in list(soup.find_all("p")):
        if is_boilerplate_text(p.get_text(" ", strip=True)):
            p.decompose()

    # Remove headings boilerplate junto com o conteúdo dele até o próximo heading
    for h in list(soup.find_all(["h1", "h2", "h3"])):
        norm = normalize_title(h.get_text(" ", strip=True))
        if norm in BOILERPLATE_HEADINGS:
            # Remove o heading e tudo até o próximo heading do mesmo ou superior nível
            sibling = h.find_next_sibling()
            h.decompose()
            while sibling and (not isinstance(sibling, Tag) or sibling.name not in {"h1", "h2", "h3"}):
                nxt = sibling.find_next_sibling() if isinstance(sibling, Tag) else None
                if isinstance(sibling, Tag):
                    sibling.decompose()
                sibling = nxt

    # Também remove um "Descrição da tarefa" inicial se for só esse heading sobrando
    for h in list(soup.find_all(["h1", "h2", "h3"])):
        norm = normalize_title(h.get_text(" ", strip=True))
        if norm in {"descricao da tarefa", "descricao", "task description", "description"}:
            h.decompose()

    # Limpa li/ul vazios
    for li in list(soup.find_all("li")):
        if not li.get_text(strip=True) and not li.find(["img", "a"]):
            li.decompose()
    for ul in list(soup.find_all(["ul", "ol"])):
        if not ul.find_all("li"):
            ul.decompose()


def extract_description(html_path: Path) -> tuple[str, str]:
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "lxml")

    title_el = soup.find("h1", class_="page-title")
    title = title_el.get_text(" ", strip=True) if title_el else html_path.stem

    body = soup.find("div", class_="page-body")
    if body is None:
        return title, ""

    body_soup = BeautifulSoup(str(body), "lxml")
    unwrap_or_remove(body_soup)

    inner = body_soup.find("div", class_="page-body") or body_soup
    if isinstance(inner, Tag):
        clean_node(inner)
        for tag in list(inner.find_all(True)):
            if tag.name not in ALLOWED_TAGS:
                tag.unwrap()

    if isinstance(inner, Tag):
        html_out = "".join(str(c) for c in inner.children).strip()
    else:
        html_out = str(inner).strip()

    html_out = re.sub(r"\n\s*\n", "\n", html_out)
    html_out = re.sub(r"<p>\s*</p>", "", html_out)
    html_out = re.sub(r"<p>\s*<br\s*/?>\s*</p>", "", html_out)
    html_out = html_out.strip()

    return title, html_out


def text_only(html: str) -> str:
    """Extrai texto puro do HTML pra avaliar se vale a pena."""
    if not html:
        return ""
    return BeautifulSoup(html, "lxml").get_text(" ", strip=True)


def is_weak_description(desc: str | None) -> bool:
    """Considera 'fraca' descrições muito curtas ou que são só metadado."""
    if not desc:
        return True
    txt = text_only(desc).strip()
    if len(txt) < 20:
        return True
    # Só "Branch: features/foo" ou "Tags: bar" são fracas
    if re.match(r"^(branch|tags?)\s*:\s*\S+\s*$", txt, re.IGNORECASE):
        return True
    if re.match(r"^(branch|tags?)\s*:\s*\S+\s*$", txt.replace("\n", " ").strip(), re.IGNORECASE):
        return True
    return False


def supabase_get_tasks(env: dict) -> list[dict]:
    url = env["SUPABASE_URL"].rstrip("/") + "/rest/v1/tasks?select=id,title,description&limit=1000"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def supabase_patch_task(env: dict, task_id: str, payload: dict) -> tuple[int, str]:
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/tasks?id=eq.{task_id}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
            "content-type": "application/json",
            "prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--only-empty",
        action="store_true",
        help="Só preenche tarefas com descrição vazia (default: preenche vazias + fracas)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Sobrescreve TODAS, mesmo as boas",
    )
    args = parser.parse_args()

    env = load_env()
    if "SUPABASE_URL" not in env or "SUPABASE_SERVICE_ROLE_KEY" not in env:
        print("ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env")
        return 1

    if not NOTION_DIR.exists():
        print(f"ERRO: Pasta Notion não encontrada: {NOTION_DIR}")
        return 1

    tasks = supabase_get_tasks(env)
    print(f"Supabase: {len(tasks)} tarefas carregadas")

    by_title: dict[str, dict] = {}
    for t in tasks:
        key = normalize_title(t["title"] or "")
        if key in by_title:
            print(f"  ! título duplicado: {t['title']!r}")
        by_title[key] = t

    html_files = sorted(NOTION_DIR.glob("*.html"))
    print(f"Notion: {len(html_files)} HTMLs encontrados\n")

    matched: list[tuple[dict, str, str]] = []  # (task, ntitle, desc_html)
    no_match: list[tuple[str, Path]] = []
    empty_html: list[tuple[dict, str, Path]] = []

    for f in html_files:
        title, desc_html = extract_description(f)
        if not title.strip():
            continue
        key = normalize_title(title)
        task = by_title.get(key)
        if not task:
            no_match.append((title, f))
            continue
        plain = text_only(desc_html)
        if not plain or len(plain) < 5:
            empty_html.append((task, title, f))
            continue
        matched.append((task, title, desc_html))

    print("=" * 70)
    print(f"MATCHED com conteúdo:        {len(matched)}")
    print(f"HTML sem conteúdo no Notion: {len(empty_html)}")
    print(f"HTML sem match no Supabase:  {len(no_match)}")
    print("=" * 70)

    if no_match:
        print("\n--- HTMLs sem match ---")
        for title, f in no_match:
            print(f"  • {title!r}")

    # Classifica destino dos updates
    updates: list[tuple[dict, str, str, str]] = []  # (task, ntitle, new_desc, reason)
    skipped_good: list[dict] = []

    for task, ntitle, new_desc in matched:
        cur = task.get("description") or ""
        cur_txt = text_only(cur).strip()

        if not cur_txt:
            updates.append((task, ntitle, new_desc, "VAZIA"))
        elif args.overwrite:
            updates.append((task, ntitle, new_desc, "OVERWRITE"))
        elif is_weak_description(cur) and not args.only_empty:
            updates.append((task, ntitle, new_desc, "FRACA"))
        else:
            skipped_good.append(task)

    print(f"\n>> A APLICAR: {len(updates)} updates")
    print(f"   • {sum(1 for _,_,_,r in updates if r == 'VAZIA')} vazias")
    print(f"   • {sum(1 for _,_,_,r in updates if r == 'FRACA')} fracas (curtas/só metadado)")
    print(f"   • {sum(1 for _,_,_,r in updates if r == 'OVERWRITE')} overwrite forçado")
    print(f">> MANTIDAS: {len(skipped_good)} já têm descrição boa")

    print("\n--- Preview (10 primeiras a atualizar) ---")
    for task, ntitle, new_desc, reason in updates[:10]:
        preview = re.sub(r"<[^>]+>", " ", new_desc)
        preview = re.sub(r"\s+", " ", preview).strip()[:140]
        print(f"  [{reason:9s}] {task['title'][:50]:50s} → {preview}...")

    if not args.apply:
        print("\n(rodada de análise apenas — use --apply pra aplicar)")
        return 0

    print(f"\n>> Aplicando {len(updates)} updates...")
    ok, fail = 0, 0
    for task, ntitle, new_desc, reason in updates:
        status, body = supabase_patch_task(env, task["id"], {"description": new_desc})
        if status in (200, 204):
            ok += 1
            print(f"  ✓ [{reason}] {task['title']}")
        else:
            fail += 1
            print(f"  ✗ {task['title']} → {status} {body[:120]}")

    print(f"\nRESULTADO: {ok} ok, {fail} falhas")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
