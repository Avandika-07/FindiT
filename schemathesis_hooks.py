"""Schemathesis hooks: generate small, real images for `image/*` multipart parts."""
import io

import schemathesis
from hypothesis import strategies as st
from PIL import Image


def _encode(fmt):
    def build(args):
        width, height, rgb = args
        buf = io.BytesIO()
        Image.new("RGB", (width, height), rgb).save(buf, fmt)
        return buf.getvalue()

    return build


_shape = st.tuples(
    st.integers(min_value=1, max_value=64),
    st.integers(min_value=1, max_value=64),
    st.tuples(*[st.integers(min_value=0, max_value=255)] * 3),
)

schemathesis.openapi.media_type("image/jpeg", _shape.map(_encode("JPEG")))
schemathesis.openapi.media_type("image/png", _shape.map(_encode("PNG")))
schemathesis.openapi.media_type("image/webp", _shape.map(_encode("WEBP")))
