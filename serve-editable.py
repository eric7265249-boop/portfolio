#!/usr/bin/env python3
"""Loopback-only static preview with a small, token-protected content editor API.

Run: python3 serve-editable.py --port 8765
Only dist/content-overrides.json and validated dist/assets/uploads images are written.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import hmac
import html
from html.parser import HTMLParser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import re
import secrets
import tempfile
import threading
from urllib.parse import unquote, urlsplit
import uuid
import webbrowser
import xml.etree.ElementTree as ET

MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_IMAGE_BODY = ((MAX_IMAGE_BYTES + 2) // 3) * 4 + 64 * 1024
MAX_SAVE_BODY = 5 * 1024 * 1024
MAX_EDIT_KEYS = 12000
ALLOWED_MIMES = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
    "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg",
}
STYLE_PROPERTIES = {
    "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "word-spacing", "text-align", "text-transform",
    "text-decoration", "text-decoration-color", "text-decoration-thickness",
    "color", "background-color", "opacity", "object-fit", "object-position",
    "position", "left", "top", "right", "bottom", "width", "height",
    "max-width", "max-height", "min-width", "min-height", "border-radius", "transform",
}
HTML_TAGS = {"span", "b", "em", "br", "strong", "i", "u", "s"}
HTML_DROP_CONTENT = {
    "script", "style", "iframe", "object", "embed", "svg", "math", "template",
    "noscript", "textarea", "xmp", "plaintext", "title",
}
COLOR_RE = re.compile(
    r"(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{1,30}|"
    r"(?:rgba?|hsla?)\([0-9.,%+\- /deg]*\))\Z"
)
SIZE_RE = re.compile(
    r"(?:-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|vw|vh|svw|svh|vmin|vmax|pt)?|"
    r"auto|normal|none|min-content|max-content|fit-content|inherit|initial|unset)\Z"
)
SVG_FORBIDDEN_TAGS = {
    "script", "foreignobject", "iframe", "object", "embed", "audio", "video",
    "link", "meta", "base", "animate", "animatemotion", "animatetransform",
    "set", "discard", "mpath", "animatecolor", "handler", "listener",
}
DATA_URL_PREFIXES = (
    "data:image/png;base64,", "data:image/jpeg;base64,", "data:image/gif;base64,",
    "data:image/webp;base64,", "data:font/woff;base64,", "data:font/woff2;base64,",
    "data:font/ttf;base64,", "data:font/otf;base64,",
    "data:application/font-woff;base64,", "data:application/font-sfnt;base64,",
    "data:application/x-font-ttf;base64,", "data:application/x-font-opentype;base64,",
)
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


class EditorError(ValueError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = status


def empty_content() -> dict:
    return {"version": 1, "changes": {}, "orders": {}, "metadata": {}}


def short_string(value, label: str, limit: int = 300) -> str:
    if not isinstance(value, str) or len(value) > limit or "\x00" in value:
        raise EditorError(f"{label} must be a string of at most {limit} characters")
    return value


def key_string(value, label: str = "edit key") -> str:
    value = short_string(value, label)
    if not value or CONTROL_RE.search(value):
        raise EditorError(f"{label} must not be empty or contain control characters")
    return value


def css_property(name: str) -> str:
    if not isinstance(name, str):
        raise EditorError("Style property names must be strings")
    # Both fontSize and font-size inputs are accepted; stored keys are CSS names.
    return re.sub(r"[A-Z]", lambda m: "-" + m.group(0).lower(), name).lower()


def sanitize_style(style: dict, *, strict: bool = True) -> dict:
    if not isinstance(style, dict) or len(style) > 50:
        raise EditorError("style must be an object with at most 50 properties")
    result = {}
    for raw_name, raw_value in style.items():
        name = css_property(raw_name)
        if name not in STYLE_PROPERTIES:
            if strict:
                raise EditorError(f"Style property is not editable: {name}")
            continue
        if isinstance(raw_value, bool) or not isinstance(raw_value, (str, int, float)):
            if strict:
                raise EditorError(f"Invalid style value for {name}")
            continue
        if isinstance(raw_value, float) and not math.isfinite(raw_value):
            raise EditorError("Style numbers must be finite")
        value = str(raw_value).strip()
        if not value or len(value) > 500 or re.search(r"[<>;{}@\\\x00-\x1f\x7f]", value):
            if strict:
                raise EditorError(f"Unsafe style value for {name}")
            continue
        low = value.lower()
        valid = not any(s in low for s in ("url(", "expression", "javascript:", "vbscript:", "-moz-binding", "behavior:"))
        if name in {"color", "background-color", "text-decoration-color"}:
            valid = valid and bool(COLOR_RE.fullmatch(value))
        elif name == "font-family":
            valid = valid and bool(re.fullmatch(r"[\w\s.,'\"\-]+", value, re.UNICODE))
        elif name == "font-weight":
            valid = valid and (low in {"normal", "bold", "bolder", "lighter", "inherit"} or bool(re.fullmatch(r"(?:[1-9]\d{0,2}|1000)", value)))
        elif name == "font-style":
            valid = valid and low in {"normal", "italic", "oblique", "inherit"}
        elif name == "text-align":
            valid = valid and low in {"left", "right", "center", "justify", "start", "end", "inherit"}
        elif name == "text-transform":
            valid = valid and low in {"none", "uppercase", "lowercase", "capitalize", "inherit"}
        elif name == "text-decoration":
            valid = valid and all(part in {"none", "underline", "overline", "line-through", "solid", "double", "dotted", "dashed", "wavy", "inherit"} for part in low.split())
        elif name == "object-fit":
            valid = valid and low in {"contain", "cover", "fill", "none", "scale-down"}
        elif name == "object-position":
            parts = low.split()
            valid = valid and 1 <= len(parts) <= 4 and all(SIZE_RE.fullmatch(v) or v in {"left", "right", "top", "bottom", "center"} for v in parts)
        elif name == "transform":
            valid = valid and low == "none"
        elif name == "position":
            valid = valid and low in {"static", "relative", "absolute", "fixed", "sticky"}
        elif name == "opacity":
            try:
                valid = valid and 0 <= float(value) <= 1
            except ValueError:
                valid = False
        elif name == "border-radius":
            valid = valid and all(SIZE_RE.fullmatch(v) for v in low.replace("/", " ").split())
        else:
            valid = valid and bool(SIZE_RE.fullmatch(low))
        if not valid:
            if strict:
                raise EditorError(f"Unsupported style value for {name}")
            continue
        result[name] = value
    return result


class BasicHTMLSanitizer(HTMLParser):
    """Keep basic inline formatting; drop active subtrees and all event attributes."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.open_tags: list[str] = []
        self.drop_stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.drop_stack:
            if tag not in {"br", "img", "hr", "input", "meta", "link", "embed", "source", "area", "base", "wbr"}:
                self.drop_stack.append(tag)
            return
        if tag in HTML_DROP_CONTENT:
            self.drop_stack.append(tag)
            return
        if tag not in HTML_TAGS:
            return
        safe = []
        for name, value in attrs:
            name = name.lower()
            value = value or ""
            if name == "style":
                declarations = {}
                for bit in value.split(";"):
                    if ":" in bit:
                        k, v = bit.split(":", 1)
                        declarations[k.strip()] = v.strip()
                cleaned = sanitize_style(declarations, strict=False)
                if cleaned:
                    safe.append(("style", ";".join(f"{k}:{v}" for k, v in cleaned.items())))
            elif name == "class" and len(value) <= 300 and re.fullmatch(r"[\w\s\-]+", value):
                safe.append((name, value))
            elif name in {"data-edit-key", "data-edit-kind"} and len(value) <= 300 and re.fullmatch(r"[\w: .\-]+", value):
                safe.append((name, value))
            elif name == "dir" and value.lower() in {"ltr", "rtl", "auto"}:
                safe.append((name, value.lower()))
            elif name == "lang" and re.fullmatch(r"[a-zA-Z0-9-]{1,40}", value):
                safe.append((name, value))
        self.output.append("<" + tag + "".join(f' {k}="{html.escape(v, quote=True)}"' for k, v in safe) + ">")
        if tag != "br":
            self.open_tags.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() != "br":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.drop_stack:
            if tag in self.drop_stack:
                while self.drop_stack:
                    if self.drop_stack.pop() == tag:
                        break
            return
        if tag in self.open_tags:
            while self.open_tags:
                current = self.open_tags.pop()
                self.output.append("</" + current + ">")
                if current == tag:
                    break

    def handle_data(self, data):
        if not self.drop_stack:
            self.output.append(html.escape(data, quote=False))

    def result(self):
        return "".join(self.output) + "".join("</" + tag + ">" for tag in reversed(self.open_tags))


def sanitize_html(value: str) -> str:
    value = short_string(value, "html", 2 * 1024 * 1024)
    parser = BasicHTMLSanitizer()
    try:
        parser.feed(value)
        parser.close()
        return parser.result()
    except (ValueError, RecursionError) as exc:
        raise EditorError("Invalid editable HTML") from exc


def safe_relative_path(value: str) -> str:
    value = short_string(value, "path", 2000)
    if CONTROL_RE.search(value) or "\\" in value:
        raise EditorError("Unsafe path")
    parts = urlsplit(value)
    if parts.scheme or parts.netloc:
        raise EditorError("Path must be local to this website")
    path = unquote(parts.path)
    if "\\" in path or CONTROL_RE.search(path):
        raise EditorError("Unsafe encoded path")
    path = path[1:] if path.startswith("/") else path
    if not path or path.startswith("/") or any(s in {".", "..", ""} for s in path.split("/")):
        raise EditorError("Invalid relative path")
    return path


def sanitize_src(value: str, site_dir: Path) -> str:
    path = safe_relative_path(value)
    if not path.startswith("assets/"):
        raise EditorError("Image source must be inside assets/")
    resolved = (site_dir / path).resolve()
    if not resolved.is_relative_to((site_dir / "assets").resolve()) or not resolved.is_file():
        raise EditorError("Image asset does not exist")
    # Preserve simple cache/version queries already present on site assets.
    parts = urlsplit(value)
    return path + ("?" + parts.query if parts.query else "") + ("#" + parts.fragment if parts.fragment else "")


def sanitize_href(value: str, known_pages: set[str]) -> str:
    value = short_string(value, "href", 3000).strip()
    if not value or CONTROL_RE.search(value) or "\\" in value:
        raise EditorError("Invalid link")
    if value.startswith("#"):
        return value
    parts = urlsplit(value)
    scheme = parts.scheme.lower()
    if scheme in {"http", "https"} and parts.hostname:
        return value
    if scheme in {"mailto", "tel"} and parts.path:
        return value
    if scheme or parts.netloc:
        raise EditorError("Unsupported link scheme")
    path = safe_relative_path(value)
    if path not in known_pages:
        raise EditorError("Relative links must point to a known HTML page")
    return value


def sanitize_patch(patch: dict, site_dir: Path, known_pages: set[str]) -> dict:
    if not isinstance(patch, dict):
        raise EditorError("Each edit must be an object or null")
    allowed = {"html", "style", "src", "alt", "href", "hidden"}
    if set(patch) - allowed:
        raise EditorError("Edit contains unsupported fields")
    result = {}
    if "html" in patch:
        result["html"] = sanitize_html(patch["html"])
    if "style" in patch:
        result["style"] = sanitize_style(patch["style"])
    if "src" in patch:
        result["src"] = sanitize_src(patch["src"], site_dir)
    if "alt" in patch:
        result["alt"] = short_string(patch["alt"], "alt", 2000)
    if "href" in patch:
        result["href"] = sanitize_href(patch["href"], known_pages)
    if "hidden" in patch:
        if not isinstance(patch["hidden"], bool):
            raise EditorError("hidden must be a boolean")
        result["hidden"] = patch["hidden"]
    return result


def page_key(value: str, known_pages: set[str]) -> str:
    value = key_string(value, "page path")
    if value == "*":
        return value
    path = safe_relative_path(value)
    if urlsplit(value).query or urlsplit(value).fragment or path not in known_pages:
        raise EditorError("Page path must name a known HTML page")
    return path


def merge_content(existing: dict, payload: dict, site_dir: Path) -> dict:
    """Merge pages; each non-null edit key replaces its entire prior snapshot."""
    if not isinstance(payload, dict) or set(payload) - {"changes", "orders", "metadata", "token"}:
        raise EditorError("Invalid save payload")
    if not isinstance(existing, dict):
        raise EditorError("Stored editor content is invalid", HTTPStatus.INTERNAL_SERVER_ERROR)
    known_pages = {p.relative_to(site_dir).as_posix() for p in site_dir.rglob("*.html") if p.is_file() and not any(s.startswith(".") for s in p.relative_to(site_dir).parts)}
    merged = json.loads(json.dumps(existing, ensure_ascii=False, allow_nan=False))
    merged["version"] = 1
    count = 0
    for section in ("changes", "orders", "metadata"):
        merged.setdefault(section, {})
        if not isinstance(merged[section], dict):
            raise EditorError("Stored editor section is invalid", HTTPStatus.INTERNAL_SERVER_ERROR)
        incoming = payload.get(section, {})
        if not isinstance(incoming, dict) or len(incoming) > 500:
            raise EditorError(f"{section} must be an object with at most 500 pages")
        for raw_page, page_value in incoming.items():
            page = page_key(raw_page, known_pages)
            if page_value is None:
                merged[section].pop(page, None)
                continue
            if not isinstance(page_value, dict):
                raise EditorError(f"{section} page value must be an object or null")
            if section == "metadata":
                if set(page_value) - {"title"}:
                    raise EditorError("Only page title metadata is editable")
                cleaned = {}
                if "title" in page_value and page_value["title"] is not None:
                    cleaned["title"] = short_string(page_value["title"], "title", 300)
                if cleaned:
                    merged[section][page] = cleaned
                else:
                    merged[section].pop(page, None)
                continue
            target = merged[section].setdefault(page, {})
            if not isinstance(target, dict):
                raise EditorError("Stored editor page is invalid", HTTPStatus.INTERNAL_SERVER_ERROR)
            for raw_key, value in page_value.items():
                key = key_string(raw_key)
                count += 1
                if count > MAX_EDIT_KEYS:
                    raise EditorError("Too many editable keys in one save")
                if value is None:
                    target.pop(key, None)
                elif section == "changes":
                    cleaned = sanitize_patch(value, site_dir, known_pages)
                    if cleaned:
                        target[key] = cleaned
                    else:
                        target.pop(key, None)
                else:
                    if not isinstance(value, list) or len(value) > 5000:
                        raise EditorError("Block order must be an array with at most 5000 child keys")
                    order = [key_string(v, "child block key") for v in value]
                    if len(order) != len(set(order)):
                        raise EditorError("Block order must not repeat child keys")
                    target[key] = order
            if not target:
                merged[section].pop(page, None)
    return merged


def safe_svg_uri(value: str) -> bool:
    value = value.strip().strip("'\"").strip()
    if value.startswith("#") and len(value) > 1:
        return not bool(CONTROL_RE.search(value))
    lower = value.lower()
    if lower.startswith(DATA_URL_PREFIXES):
        payload = value.split(",", 1)[1]
        try:
            base64.b64decode(re.sub(r"\s+", "", payload), validate=True)
            return True
        except (ValueError, binascii.Error):
            return False
    return False


def validate_svg_css(value: str):
    if "\\" in value or re.search(r"@import|expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:", value, re.I):
        raise EditorError("SVG contains unsafe CSS")
    for match in re.finditer(r"url\s*\(\s*(.*?)\s*\)", value, re.I | re.S):
        if not safe_svg_uri(match.group(1)):
            raise EditorError("SVG may not load external URLs")


def validate_svg(data: bytes):
    # Validate declarations as decoded text so UTF-16 cannot hide a DTD with NULs.
    try:
        if data.startswith((b"\xff\xfe", b"\xfe\xff")):
            xml_text = data.decode("utf-16")
        else:
            xml_text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EditorError("SVG must use UTF-8 or BOM-marked UTF-16") from exc
    if "\x00" in xml_text or re.search(r"<!\s*(?:DOCTYPE|ENTITY)", xml_text, re.I):
        raise EditorError("SVG document declarations and entities are not supported")
    if re.search(r"<\?(?!xml(?:\s|\?>))", xml_text, re.I):
        raise EditorError("SVG processing instructions are not supported")
    declaration = re.search(r"<\?xml\s[^?]*encoding\s*=\s*['\"]([^'\"]+)['\"]", xml_text, re.I)
    if declaration and declaration.group(1).lower() not in {"utf-8", "utf8", "utf-16", "utf-16le", "utf-16be"}:
        raise EditorError("SVG encoding declaration must use UTF-8 or UTF-16")
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise EditorError("Invalid SVG XML") from exc
    if root.tag.rsplit("}", 1)[-1].lower() != "svg":
        raise EditorError("SVG root element is required")
    count = 0
    for element in root.iter():
        count += 1
        if count > 100000 or len(element.attrib) > 100:
            raise EditorError("SVG is too complex")
        name = element.tag.rsplit("}", 1)[-1].lower()
        if name in SVG_FORBIDDEN_TAGS:
            raise EditorError(f"SVG element is not allowed: {name}")
        if name == "style":
            validate_svg_css("".join(element.itertext()))
        for attr, value in element.attrib.items():
            local = attr.rsplit("}", 1)[-1].lower()
            if local.startswith("on"):
                raise EditorError("SVG event handlers are not allowed")
            if local == "base":
                raise EditorError("SVG may not change its base URL")
            if local in {"href", "src"} and not safe_svg_uri(value):
                raise EditorError("SVG href must be an internal reference or embedded safe data")
            if local == "style" or re.search(r"url\s*\(", value, re.I):
                validate_svg_css(value)
            if re.search(r"javascript\s*:|vbscript\s*:", value, re.I):
                raise EditorError("SVG contains an unsafe URI")


def decode_image(payload: dict) -> tuple[bytes, str]:
    if not isinstance(payload, dict) or set(payload) - {"token", "name", "mime", "data"}:
        raise EditorError("Invalid image upload payload")
    mime = short_string(payload.get("mime", ""), "mime", 100).lower().strip()
    if mime not in ALLOWED_MIMES:
        raise EditorError("Only PNG, JPEG, GIF, WebP and SVG images are supported")
    short_string(payload.get("name", "image"), "name", 500)
    encoded = payload.get("data")
    if not isinstance(encoded, str) or len(encoded) > MAX_IMAGE_BODY:
        raise EditorError("Image data is missing or too large", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
    if encoded.startswith("data:"):
        try:
            prefix, encoded = encoded.split(",", 1)
        except ValueError as exc:
            raise EditorError("Invalid image data URL") from exc
        if prefix.lower() != "data:" + mime + ";base64":
            raise EditorError("Image data URL type does not match mime")
    try:
        data = base64.b64decode(re.sub(r"\s+", "", encoded), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise EditorError("Image data is not valid base64") from exc
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise EditorError("Image must be at most 25 MB", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
    valid = (
        mime == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n")
        or mime in {"image/jpeg", "image/jpg"} and data.startswith(b"\xff\xd8\xff")
        or mime == "image/gif" and data.startswith((b"GIF87a", b"GIF89a"))
        or mime == "image/webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    )
    if mime == "image/svg+xml":
        validate_svg(data)
        valid = True
    if not valid:
        raise EditorError("Image bytes do not match the declared type")
    return data, ALLOWED_MIMES[mime]


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", prefix=".editor-", dir=path.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


class EditorHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, *, site_dir: Path):
        if server_address[0] != "127.0.0.1":
            raise ValueError("Editable preview must bind to 127.0.0.1")
        self.site_dir = site_dir.resolve()
        if not self.site_dir.is_dir():
            raise ValueError("dist directory does not exist")
        self.auth_token = secrets.token_urlsafe(32)
        self.write_lock = threading.RLock()
        super().__init__(server_address, EditorHandler)

    def read_content(self):
        file = self.site_dir / "content-overrides.json"
        if not file.exists():
            return empty_content()
        if not file.resolve().is_relative_to(self.site_dir):
            raise EditorError("Stored editor content is outside the preview", HTTPStatus.INTERNAL_SERVER_ERROR)
        try:
            value = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise EditorError("Stored editor content could not be read", HTTPStatus.INTERNAL_SERVER_ERROR) from exc
        if not isinstance(value, dict):
            raise EditorError("Stored editor content is invalid", HTTPStatus.INTERNAL_SERVER_ERROR)
        return value

    @staticmethod
    def revision(content: dict):
        normalized = json.dumps(content, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(normalized).hexdigest()[:20]

    def write_content(self, content: dict):
        data = (json.dumps(content, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
        atomic_write(self.site_dir / "content-overrides.json", data)


class EditorHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ChaoEditablePreview/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(args[2].site_dir), **kwargs)

    def log_message(self, fmt, *args):
        # No body/header/token logging. Strip query strings from normal request log.
        if args and isinstance(args[0], str):
            args = (re.sub(r"\?\S*", "", args[0]),) + args[1:]
        super().log_message(fmt, *args)

    def _origin_guard(self):
        hosts = self.headers.get_all("Host", [])
        if len(hosts) != 1 or re.search(r"[\s/@\\]", hosts[0]):
            raise EditorError("Invalid preview host", HTTPStatus.FORBIDDEN)
        try:
            host = urlsplit("//" + hosts[0])
            port = host.port or 80
        except ValueError as exc:
            raise EditorError("Invalid preview host", HTTPStatus.FORBIDDEN) from exc
        if host.hostname not in {"localhost", "127.0.0.1"} or host.username or host.password or port != self.server.server_port:
            raise EditorError("Preview is available only through its loopback host", HTTPStatus.FORBIDDEN)
        origins = self.headers.get_all("Origin", [])
        if len(origins) > 1:
            raise EditorError("Invalid request origin", HTTPStatus.FORBIDDEN)
        if origins:
            try:
                origin = urlsplit(origins[0])
                origin_port = origin.port or (80 if origin.scheme == "http" else 443)
            except ValueError as exc:
                raise EditorError("Invalid request origin", HTTPStatus.FORBIDDEN) from exc
            if origin.scheme != "http" or origin.hostname != host.hostname or origin_port != port or origin.username or origin.password or origin.path or origin.query or origin.fragment:
                raise EditorError("Editor requests must originate from this preview", HTTPStatus.FORBIDDEN)

    def _authenticate(self):
        tokens = self.headers.get_all("X-Editor-Token", [])
        if len(tokens) != 1 or not hmac.compare_digest(tokens[0], self.server.auth_token):
            raise EditorError("A valid editor token is required", HTTPStatus.FORBIDDEN)

    def _json_response(self, value, status=HTTPStatus.OK, *, head=False):
        body = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def _json_body(self, limit):
        if self.headers.get("Transfer-Encoding"):
            raise EditorError("Chunked editor requests are not supported")
        if self.headers.get_content_type() != "application/json":
            raise EditorError("Editor requests require application/json")
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not re.fullmatch(r"\d+", lengths[0]):
            raise EditorError("Content-Length is required", HTTPStatus.LENGTH_REQUIRED)
        length = int(lengths[0])
        if length > limit:
            self.close_connection = True
            raise EditorError("Request body is too large", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        self.connection.settimeout(30)
        raw = self.rfile.read(length)
        if len(raw) != length:
            raise EditorError("Incomplete request body")
        try:
            return json.loads(raw.decode("utf-8"), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite number")))
        except (ValueError, UnicodeDecodeError) as exc:
            raise EditorError("Invalid JSON body") from exc

    def translate_path(self, path):
        translated = Path(super().translate_path(path)).resolve()
        if not translated.is_relative_to(self.server.site_dir):
            # A nonexistent path within dist avoids exposing a symlink target.
            return str(self.server.site_dir / ".editor-path-not-found")
        return str(translated)

    def do_GET(self):
        try:
            self._origin_guard()
            route = urlsplit(self.path).path
            if route == "/api/editor/status":
                with self.server.write_lock:
                    content = self.server.read_content()
                    self._json_response({"available": True, "token": self.server.auth_token, "revision": self.server.revision(content)})
            elif route == "/content-overrides.json":
                with self.server.write_lock:
                    self._json_response(self.server.read_content())
            elif route.startswith("/api/"):
                self._json_response({"error": "Unknown editor endpoint"}, HTTPStatus.NOT_FOUND)
            else:
                super().do_GET()
        except EditorError as exc:
            self._json_response({"error": str(exc)}, exc.status)
        except (OSError, ValueError):
            self._json_response({"error": "Preview request failed"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_HEAD(self):
        try:
            self._origin_guard()
            if urlsplit(self.path).path.startswith("/api/"):
                self._json_response({"available": True}, head=True)
            else:
                super().do_HEAD()
        except EditorError as exc:
            self._json_response({"error": str(exc)}, exc.status, head=True)

    def do_OPTIONS(self):
        try:
            self._origin_guard()
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Allow", "GET, HEAD, POST, OPTIONS")
            self.send_header("Content-Length", "0")
            self.end_headers()
        except EditorError as exc:
            self._json_response({"error": str(exc)}, exc.status)

    def do_POST(self):
        try:
            self._origin_guard()
            self._authenticate()
            route = urlsplit(self.path).path
            if route not in {"/api/editor/asset", "/api/editor/save", "/api/editor/reset"}:
                raise EditorError("Unknown editor endpoint", HTTPStatus.NOT_FOUND)
            payload = self._json_body(MAX_IMAGE_BODY if route.endswith("/asset") else MAX_SAVE_BODY)
            if route.endswith("/asset"):
                data, extension = decode_image(payload)
                with self.server.write_lock:
                    target = self.server.site_dir / "assets" / "uploads" / (uuid.uuid4().hex + extension)
                    if not target.parent.resolve().is_relative_to(self.server.site_dir):
                        raise EditorError("Upload directory is outside the preview", HTTPStatus.FORBIDDEN)
                    atomic_write(target, data)
                self._json_response({"path": target.relative_to(self.server.site_dir).as_posix()}, HTTPStatus.CREATED)
            elif route.endswith("/save"):
                with self.server.write_lock:
                    content = merge_content(self.server.read_content(), payload, self.server.site_dir)
                    self.server.write_content(content)
                    revision = self.server.revision(content)
                self._json_response({"ok": True, "revision": revision, "content": content})
            else:
                if not isinstance(payload, dict) or set(payload) - {"token"}:
                    raise EditorError("Reset payload must be an empty object")
                with self.server.write_lock:
                    content = empty_content()
                    self.server.write_content(content)
                self._json_response({"ok": True, "revision": self.server.revision(content), "content": content})
        except EditorError as exc:
            # An auth/origin rejection occurs before consuming an arbitrary body.
            self.close_connection = True
            self._json_response({"error": str(exc)}, exc.status)
        except (OSError, ValueError, TypeError):
            self.close_connection = True
            self._json_response({"error": "Editor operation failed"}, HTTPStatus.INTERNAL_SERVER_ERROR)


def default_directory() -> Path:
    parent = Path(__file__).resolve().parent
    return parent / "dist" if (parent / "dist").is_dir() else parent


def create_server(port: int = 8765, *, site_dir: Path | None = None) -> EditorHTTPServer:
    root = Path(site_dir) if site_dir is not None else default_directory()
    return EditorHTTPServer(("127.0.0.1", port), site_dir=root)


def main():
    parser = argparse.ArgumentParser(description="Serve the portfolio and its local content editor on loopback only.")
    parser.add_argument("--port", type=int, default=8765, help="Local port (default: 8765)")
    parser.add_argument("--directory", type=Path, default=None, help="Website directory (default: adjacent dist/, otherwise the script directory)")
    parser.add_argument("--open", action="store_true", help="Open the local editor after binding (disabled by default)")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    try:
        server = create_server(args.port, site_dir=args.directory)
    except OSError as exc:
        parser.exit(1, f"Could not start preview: {exc}\n")
    print(f"Editable portfolio preview: http://127.0.0.1:{server.server_port}/", flush=True)
    if args.open:
        webbrowser.open(f"http://127.0.0.1:{server.server_port}/editor.html")
    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
