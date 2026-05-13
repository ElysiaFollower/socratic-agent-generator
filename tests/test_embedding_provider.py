import httpx

from utils.embedding_provider import VolcengineArkEmbeddings


class FakeHTTPClient:
    def __init__(self):
        self.requests = []

    def post(self, url, json, headers):
        self.requests.append((url, json, headers))
        return httpx.Response(
            200,
            json={"data": [{"index": 0, "embedding": [1, 2, 3]}]},
            request=httpx.Request("POST", url),
        )


def test_volcengine_text_embedding_payload():
    client = FakeHTTPClient()
    embeddings = VolcengineArkEmbeddings(
        api_key="test-key",
        base_url="https://ark.example/api/v3",
        model="doubao-embedding-text-240515",
        client=client,
    )

    result = embeddings.embed_query("TCP SYN backlog")

    assert result == [1.0, 2.0, 3.0]
    url, payload, headers = client.requests[0]
    assert url == "https://ark.example/api/v3/embeddings"
    assert payload == {
        "model": "doubao-embedding-text-240515",
        "input": ["TCP SYN backlog"],
    }
    assert headers["Authorization"] == "Bearer test-key"


def test_volcengine_vision_embedding_uses_multimodal_endpoint():
    class VisionClient(FakeHTTPClient):
        def post(self, url, json, headers):
            self.requests.append((url, json, headers))
            return httpx.Response(
                200,
                json={"data": {"embedding": [4, 5]}},
                request=httpx.Request("POST", url),
            )

    client = VisionClient()
    embeddings = VolcengineArkEmbeddings(
        api_key="test-key",
        base_url="https://ark.example/api/v3",
        model="doubao-embedding-vision-251215",
        client=client,
    )

    assert embeddings.embed_query("TCP SYN backlog") == [4.0, 5.0]
    url, payload, _ = client.requests[0]
    assert url == "https://ark.example/api/v3/embeddings/multimodal"
    assert payload == {
        "model": "doubao-embedding-vision-251215",
        "input": [{"type": "text", "text": "TCP SYN backlog"}],
    }
