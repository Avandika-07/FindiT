"""
Request validation.

`SpecValidator` checks path parameters, query parameters and JSON bodies against the
schemas written in openapi.yaml, so the server can never silently drift away from the
contract. It is a small handwritten JSON-schema checker that understands the subset of
OpenAPI 3.0 the contract uses ($ref, type, nullable, enum, minLength, maxLength, pattern,
minimum, maximum, format date, required, additionalProperties, minProperties, oneOf with
a discriminator). Every error comes back as a plain-English message per field.

`validate_photo` checks uploaded images with Pillow and re-saves them without EXIF data.
"""
import io
import re
from datetime import date

import yaml
from django.conf import settings
from PIL import Image, ImageFilter, UnidentifiedImageError

from .http import ApiError

_SPEC = None


def load_spec():
    global _SPEC
    if _SPEC is None:
        with open(settings.OPENAPI_PATH, encoding="utf-8") as fh:
            _SPEC = yaml.safe_load(fh)
    return _SPEC


# JSON Schema patterns use ECMAScript regex, where \s is a narrower set than Python's
# (Python also counts the \x1c-\x1f control characters as whitespace).
_ECMA_SPACE = "\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"


def ecma_pattern(pattern):
    """Translate the ECMAScript-only differences: \\s/\\S sets, and `$` never matching before a final newline."""
    out = pattern.replace("\\S", f"[^{_ECMA_SPACE}]").replace("\\s", f"[{_ECMA_SPACE}]")
    if out.endswith("$") and not out.endswith("\\$"):
        out = out[:-1] + "\\Z"
    return out


def _label(field):
    if not field:
        return "Value"
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", field.split(".")[-1])
    return name.replace("_", " ").capitalize()


class SpecValidator:
    def __init__(self, spec):
        self.spec = spec
        self._operations = {}
        for path, path_item in spec.get("paths", {}).items():
            shared = path_item.get("parameters", [])
            for method, op in path_item.items():
                if method == "parameters" or not isinstance(op, dict):
                    continue
                params = [self.resolve(p) for p in shared + op.get("parameters", [])]
                self._operations[op["operationId"]] = {
                    "path": path,
                    "method": method.upper(),
                    "params": params,
                    "body": op.get("requestBody"),
                    "secured": bool(op.get("security", spec.get("security", []))),
                }

    def operation(self, operation_id):
        return self._operations[operation_id]

    def resolve(self, node):
        seen = 0
        while isinstance(node, dict) and "$ref" in node:
            ref = node["$ref"]
            target = self.spec
            for part in ref.lstrip("#/").split("/"):
                target = target[part]
            node = target
            seen += 1
            if seen > 20:
                raise RuntimeError(f"$ref loop at {ref}")
        return node

    # ---- parameters --------------------------------------------------------------

    def parse_params(self, operation_id, path_kwargs, query):
        """Return {name: value} for every declared path/query parameter, coerced to Python types."""
        op = self.operation(operation_id)
        values, errors = {}, {}
        for param in op["params"]:
            name, where = param["name"], param["in"]
            schema = self.resolve(param.get("schema", {}))
            if where == "path":
                raw = path_kwargs.get(name)
            elif where == "query":
                raw = query.get(name) if name in query else None
            else:
                continue
            if raw is None:
                if param.get("required"):
                    errors[name] = f"{_label(name)} is required."
                elif "default" in schema:
                    values[name] = schema["default"]
                else:
                    values[name] = None
                continue
            try:
                coerced = self._coerce_param(raw, schema)
            except ValueError:
                errors[name] = f"{_label(name)} must be {self._describe(schema)}."
                continue
            self._check(coerced, schema, name, errors)
            values[name] = coerced
        if errors:
            raise ApiError(400, "validation_error", "Some details are not valid.", fields=errors)
        return values

    def _coerce_param(self, raw, schema):
        kind = schema.get("type")
        if kind == "integer":
            if not re.fullmatch(r"[+-]?\d{1,12}", raw.strip()):
                raise ValueError
            return int(raw)
        if kind == "number":
            return float(raw)
        if kind == "boolean":
            if raw.lower() in ("true", "1"):
                return True
            if raw.lower() in ("false", "0"):
                return False
            raise ValueError
        return raw

    @staticmethod
    def _describe(schema):
        kind = schema.get("type")
        if schema.get("format") == "date":
            return "a date like 2024-08-15"
        return {"integer": "a whole number", "number": "a number", "boolean": "true or false"}.get(
            kind, "text"
        )

    # ---- bodies ------------------------------------------------------------------

    def validate_body(self, operation_id, data):
        op = self.operation(operation_id)
        body = op["body"]
        if not body:
            return data
        schema = self.resolve(body["content"]["application/json"]["schema"])
        errors = {}
        self._check(data, schema, "", errors)
        if errors:
            raise ApiError(400, "validation_error", "Some details are not valid.", fields=errors)
        return data

    def _check(self, value, schema, path, errors):
        schema = self.resolve(schema)
        if value is None:
            if not schema.get("nullable"):
                errors[path or "body"] = f"{_label(path)} cannot be empty."
            return
        if "oneOf" in schema:
            self._check_one_of(value, schema, path, errors)
            return
        kind = schema.get("type")
        if kind == "object" or (kind is None and "properties" in schema):
            self._check_object(value, schema, path, errors)
            return
        if kind == "array":
            if not isinstance(value, list):
                errors[path or "body"] = f"{_label(path)} must be a list."
                return
            for i, entry in enumerate(value):
                self._check(entry, schema.get("items", {}), f"{path}[{i}]", errors)
            return
        if kind == "string":
            if not isinstance(value, str):
                errors[path or "body"] = f"{_label(path)} must be text."
                return
            if "enum" in schema and value not in schema["enum"]:
                errors[path] = f"{_label(path)} must be one of: {', '.join(map(str, schema['enum']))}."
                return
            if "minLength" in schema and len(value) < schema["minLength"]:
                errors[path] = f"{_label(path)} must be at least {schema['minLength']} characters."
                return
            if "maxLength" in schema and len(value) > schema["maxLength"]:
                errors[path] = f"{_label(path)} must be at most {schema['maxLength']} characters."
                return
            if "pattern" in schema and not re.search(ecma_pattern(schema["pattern"]), value):
                errors[path] = f"{_label(path)} is not in the expected format."
                return
            if schema.get("format") == "date":
                try:
                    date.fromisoformat(value)
                except ValueError:
                    errors[path] = f"{_label(path)} must be a date like 2024-08-15."
            return
        if kind in ("integer", "number"):
            ok = isinstance(value, (int, float)) and not isinstance(value, bool)
            if ok and kind == "integer" and isinstance(value, float) and not value.is_integer():
                ok = False
            if not ok:
                errors[path or "body"] = f"{_label(path)} must be {'a whole number' if kind == 'integer' else 'a number'}."
                return
            if "minimum" in schema and value < schema["minimum"]:
                errors[path] = f"{_label(path)} must be at least {schema['minimum']}."
            elif "maximum" in schema and value > schema["maximum"]:
                errors[path] = f"{_label(path)} must be at most {schema['maximum']}."
            return
        if kind == "boolean" and not isinstance(value, bool):
            errors[path or "body"] = f"{_label(path)} must be true or false."

    def _check_object(self, value, schema, path, errors):
        if not isinstance(value, dict):
            errors[path or "body"] = "Send a JSON object."
            return
        props = schema.get("properties", {})
        prefix = f"{path}." if path else ""
        for name in schema.get("required", []):
            if name not in value:
                errors[prefix + name] = f"{_label(name)} is required."
        if schema.get("additionalProperties") is False:
            for name in value:
                if name not in props:
                    errors[prefix + name] = f"{_label(name)} is not a known field."
        if "minProperties" in schema and len(value) < schema["minProperties"]:
            errors[path or "body"] = "Send at least one field to change."
        for name, sub in props.items():
            if name in value:
                self._check(value[name], sub, prefix + name, errors)

    def _check_one_of(self, value, schema, path, errors):
        disc = schema.get("discriminator")
        if disc and isinstance(value, dict):
            prop = disc["propertyName"]
            mapping = disc.get("mapping", {})
            if isinstance(value.get(prop), str) and value[prop] in mapping:
                self._check(value, {"$ref": mapping[value[prop]]}, path, errors)
                return
            choices = ", ".join(mapping) if mapping else "a known value"
            errors[(f"{path}." if path else "") + prop] = f"{_label(prop)} must be one of: {choices}."
            return
        passing = 0
        for option in schema["oneOf"]:
            trial = {}
            self._check(value, option, path, trial)
            passing += not trial
        if passing != 1:
            errors[path or "body"] = f"{_label(path)} does not match any allowed shape."


_VALIDATOR = None


def spec_validator():
    global _VALIDATOR
    if _VALIDATOR is None:
        _VALIDATOR = SpecValidator(load_spec())
    return _VALIDATOR


# ---- small helpers for /ext/ endpoints ----------------------------------------------

def require_str(data, name, *, min_len=1, max_len=500, required=True):
    value = data.get(name)
    if value is None or value == "":
        if required:
            raise ApiError(400, "validation_error", f"{_label(name)} is required.", fields={name: f"{_label(name)} is required."})
        return None
    if not isinstance(value, str) or not (min_len <= len(value.strip()) <= max_len):
        msg = f"{_label(name)} must be {min_len} to {max_len} characters."
        raise ApiError(400, "validation_error", msg, fields={name: msg})
    return value.strip()


def int_param(request, name, default, lo, hi):
    raw = request.GET.get(name)
    if raw is None or raw == "":
        return default
    if not re.fullmatch(r"\d{1,6}", raw):
        raise ApiError(400, "validation_error", f"{_label(name)} must be a whole number.")
    return max(lo, min(hi, int(raw)))


# ---- photos ------------------------------------------------------------------------

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_photo(upload):
    """
    Check an uploaded file really is a JPEG, PNG or WEBP under MAX_UPLOAD_MB.
    Returns (clear_bytes, blurred_bytes, pil_image). Both copies are re-encoded as JPEG,
    which strips EXIF data such as GPS location.
    """
    if upload is None:
        raise ApiError(400, "validation_error", "Choose a photo to upload.", fields={"photo": "Choose a photo to upload."})
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    if upload.size > limit:
        raise ApiError(413, "file_too_large", f"Photo is larger than {settings.MAX_UPLOAD_MB} MB. Choose a smaller one.")
    raw = upload.read()
    try:
        probe = Image.open(io.BytesIO(raw))
        fmt = probe.format
        probe.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise ApiError(400, "invalid_photo", "That file is not a photo we can read. Use a JPEG, PNG or WEBP image.")
    if fmt not in ALLOWED_FORMATS:
        raise ApiError(400, "invalid_photo", "Use a JPEG, PNG or WEBP photo.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (OSError, ValueError, Image.DecompressionBombError):
        raise ApiError(400, "invalid_photo", "That photo looks damaged. Try another one.")
    image = image.convert("RGB")
    image.thumbnail((1600, 1600))

    clear = io.BytesIO()
    image.save(clear, "JPEG", quality=85)  # re-encoding drops EXIF
    small = image.copy()
    small.thumbnail((480, 480))
    blurred = io.BytesIO()
    small.filter(ImageFilter.GaussianBlur(radius=14)).save(blurred, "JPEG", quality=70)
    return clear.getvalue(), blurred.getvalue(), image
